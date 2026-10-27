// @ts-nocheck — AudioWorkletGlobalScope file. Kept in plain-JS syntax on purpose:
// Vite emits `new URL('./pitch-worklet.ts', import.meta.url)` targets as a static asset
// (not transpiled), so no type annotations here.
//
// Spec (440Hz): YIN, 4096 window, 512 hop, 35–400 Hz, confidence ≥ 0.85,
// RMS gate < -50 dBFS = no note. Onset: RMS rise > 6 dB within ~20 ms.
// Hold note until RMS drops 12 dB below its peak.

const WINDOW = 4096;
const HOP = 512;
const MIN_HZ = 35;
const MAX_HZ = 400;
const CONF_MIN = 0.85;
const GATE_DB = -50;
const ONSET_RISE_DB = 6;
const ONSET_WINDOW_S = 0.02;
const HOLD_DROP_DB = 12;
const YIN_THRESHOLD = 0.15; // 1 - CONF_MIN

const toDb = (x) => (x > 1e-10 ? 20 * Math.log10(x) : -200);

class PitchAnalyzer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(WINDOW);
    this.write = 0;
    this.filled = 0;
    this.sinceHop = 0;
    this.half = WINDOW / 2;
    this.diff = new Float32Array(this.half);
    this.frame = new Float32Array(WINDOW);
    // ~20 ms of per-block (128-sample) RMS history for onset detection.
    this.histLen = Math.max(2, Math.ceil((ONSET_WINDOW_S * sampleRate) / 128));
    this.hist = [];
    this.holding = false;
    this.peakDb = -200;
    this.onsetFlag = false;
    this.hopPeak = 0;
    // Envelope RMS over one period of the lowest note (35 Hz), so a steady low B/E
    // doesn't flutter block-to-block and fake onsets.
    this.envLen = Math.ceil(sampleRate / MIN_HZ);
    this.envSq = new Float32Array(this.envLen);
    this.envPos = 0;
    this.envSum = 0;
  }

  yin(frame) {
    const half = this.half;
    const d = this.diff;
    const tauMin = Math.max(2, Math.floor(sampleRate / MAX_HZ));
    const tauMax = Math.min(half - 1, Math.ceil(sampleRate / MIN_HZ));
    d[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let i = 0; i < half; i++) {
        const delta = frame[i] - frame[i + tau];
        sum += delta * delta;
      }
      running += sum;
      d[tau] = running > 0 ? (sum * tau) / running : 1; // CMND
    }
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (d[t] < YIN_THRESHOLD) {
        while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      // No dip under threshold: report best minimum with its (low) confidence.
      let best = tauMin;
      for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[best]) best = t;
      tau = best;
    }
    let better = tau;
    if (tau > 1 && tau < tauMax) {
      const s0 = d[tau - 1], s1 = d[tau], s2 = d[tau + 1];
      const den = 2 * (2 * s1 - s2 - s0);
      if (den !== 0) better = tau + (s2 - s0) / den;
    }
    return { hz: sampleRate / better, confidence: Math.max(0, 1 - d[tau]) };
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let pk = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const x2 = x * x;
      this.envSum += x2 - this.envSq[this.envPos];
      this.envSq[this.envPos] = x2;
      this.envPos = (this.envPos + 1) % this.envLen;
      const ax = x < 0 ? -x : x;
      if (ax > pk) pk = ax;
      this.buf[this.write] = x;
      this.write = (this.write + 1) % WINDOW;
    }
    this.filled = Math.min(WINDOW, this.filled + ch.length);
    this.sinceHop += ch.length;
    if (pk > this.hopPeak) this.hopPeak = pk;

    const blockDb = toDb(Math.sqrt(Math.max(0, this.envSum) / this.envLen));
    // Onset: rise > 6 dB vs the quietest block in the last ~20 ms.
    const floor = this.hist.length ? Math.min(...this.hist) : blockDb;
    this.hist.push(blockDb);
    if (this.hist.length > this.histLen) this.hist.shift();
    if (blockDb > GATE_DB && blockDb - floor > ONSET_RISE_DB) {
      this.onsetFlag = true;
      this.holding = true;
      this.peakDb = blockDb;
    }
    if (this.holding) {
      if (blockDb > this.peakDb) this.peakDb = blockDb;
      if (blockDb < this.peakDb - HOLD_DROP_DB || blockDb < GATE_DB) this.holding = false;
    } else if (blockDb > GATE_DB && this.peakDb < GATE_DB) {
      // Sustained signal that never produced a sharp onset (e.g. fade-in): start holding.
      this.holding = true;
      this.peakDb = blockDb;
    }
    if (!this.holding && blockDb < GATE_DB) this.peakDb = -200;

    if (this.sinceHop >= HOP && this.filled >= WINDOW) {
      this.sinceHop = 0;
      const f = this.frame;
      let s2 = 0;
      for (let i = 0; i < WINDOW; i++) {
        const x = this.buf[(this.write + i) % WINDOW];
        f[i] = x;
        s2 += x * x;
      }
      const rmsDb = toDb(Math.sqrt(s2 / WINDOW));
      let hz = 0;
      let confidence = 0;
      if (rmsDb >= GATE_DB) {
        const r = this.yin(f);
        confidence = r.confidence;
        hz = confidence >= CONF_MIN && r.hz >= MIN_HZ && r.hz <= MAX_HZ ? r.hz : 0;
      }
      this.port.postMessage({
        hz,
        confidence,
        rmsDb,
        peakDb: this.peakDb,
        onset: this.onsetFlag,
        holding: this.holding,
        samplePeakDb: toDb(this.hopPeak), // extra: true sample peak for the clip warning
      });
      this.hopPeak = 0;
      this.onsetFlag = false;
    }
    return true;
  }
}

registerProcessor("lowend-pitch", PitchAnalyzer);
