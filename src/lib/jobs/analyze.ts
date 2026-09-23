import { renderAscii } from "./ascii";
import type { BassStringIndex, JobNote, JobResult } from "./types";
import { MAX_DURATION_MS } from "./types";

/** Standard EADG open frequencies (Hz). String index E=0 … G=3. */
const OPEN_HZ: readonly number[] = [
  41.20344461410874, // E1
  55.0, // A1
  73.41619197947974, // D2
  97.99885899543733, // G2
];

const BAND_LO = 40;
const BAND_HI = 350;
const MAX_FRET = 24;
const PREFER_MAX_FRET = 12;

export type DecodedAudio = {
  sampleRate: number;
  durationMs: number;
  samples: Float32Array; // mono
};

function readAscii(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

/**
 * Minimal PCM WAV decoder (16-bit or 32-bit float, mono/stereo).
 * Returns null on corrupt / unsupported WAV.
 */
export function decodeWav(bytes: Uint8Array): DecodedAudio | null {
  if (bytes.byteLength < 44) return null;
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const view = new DataView(buf);
  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") return null;

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const id = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (id === "fmt ") {
      if (size < 16) return null;
      audioFormat = view.getUint16(chunkStart, true);
      channels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (id === "data") {
      dataOffset = chunkStart;
      dataSize = size;
      break;
    }
    offset = chunkStart + size + (size % 2);
  }

  if (dataOffset < 0 || sampleRate <= 0 || channels < 1) return null;
  // 1 = PCM, 3 = IEEE float
  if (audioFormat !== 1 && audioFormat !== 3) return null;
  if (audioFormat === 1 && bitsPerSample !== 16 && bitsPerSample !== 8 && bitsPerSample !== 24) {
    return null;
  }
  if (audioFormat === 3 && bitsPerSample !== 32) return null;

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * channels));
  if (frameCount <= 0) return null;

  const mono = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const pos = dataOffset + (i * channels + ch) * bytesPerSample;
      if (pos + bytesPerSample > view.byteLength) break;
      let sample = 0;
      if (audioFormat === 3) {
        sample = view.getFloat32(pos, true);
      } else if (bitsPerSample === 8) {
        sample = (view.getUint8(pos) - 128) / 128;
      } else if (bitsPerSample === 16) {
        sample = view.getInt16(pos, true) / 32768;
      } else {
        // 24-bit little-endian
        const b0 = view.getUint8(pos);
        const b1 = view.getUint8(pos + 1);
        const b2 = view.getUint8(pos + 2);
        let v = (b2 << 16) | (b1 << 8) | b0;
        if (v & 0x800000) v |= ~0xffffff;
        sample = v / 8388608;
      }
      sum += sample;
    }
    mono[i] = sum / channels;
  }

  return {
    sampleRate,
    durationMs: (frameCount / sampleRate) * 1000,
    samples: mono,
  };
}

/** Rough duration estimate for non-WAV from byte size (stub). */
export function estimateDurationFromSize(
  byteLength: number,
  ext: string,
): number | null {
  // Rough bitrate assumptions — stub only
  const bitrate =
    ext === ".flac" ? 900_000 : ext === ".wav" ? 1_411_200 : 160_000;
  if (bitrate <= 0 || byteLength <= 0) return null;
  return (byteLength * 8 * 1000) / bitrate;
}

function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Map frequency → preferred (string, fret) on EADG; prefer frets 0–12 on ties. */
export function mapHzToFret(hz: number): { string: BassStringIndex; fret: number; conf: number } {
  let best: { string: BassStringIndex; fret: number; cents: number; prefer: boolean } | null =
    null;

  for (let s = 0; s < 4; s++) {
    const open = OPEN_HZ[s]!;
    const fretExact = 12 * Math.log2(hz / open);
    const fretRound = Math.round(fretExact);
    if (fretRound < 0 || fretRound > MAX_FRET) continue;
    const targetHz = open * Math.pow(2, fretRound / 12);
    const cents = Math.abs(1200 * Math.log2(hz / targetHz));
    const prefer = fretRound <= PREFER_MAX_FRET;
    if (
      !best ||
      cents < best.cents - 1e-6 ||
      (Math.abs(cents - best.cents) < 1e-6 && prefer && !best.prefer) ||
      (Math.abs(cents - best.cents) < 1e-6 && prefer === best.prefer && fretRound < best.fret)
    ) {
      best = { string: s as BassStringIndex, fret: fretRound, cents, prefer };
    }
  }

  if (!best) {
    // Fallback: clamp to nearest open-string pitch class on E
    return { string: 0, fret: 0, conf: 0.15 };
  }
  const conf = Math.max(0, Math.min(1, 1 - best.cents / 50));
  return { string: best.string, fret: best.fret === 0 ? 0 : best.fret, conf };
}

/** Very light IIR-ish band emphasis via moving-average high/low pass combo. */
function bandLimit(samples: Float32Array, sampleRate: number): Float32Array {
  const out = new Float32Array(samples.length);
  // One-pole high-pass ~40 Hz + low-pass ~350 Hz
  const hpRc = 1 / (2 * Math.PI * BAND_LO);
  const lpRc = 1 / (2 * Math.PI * BAND_HI);
  const dt = 1 / sampleRate;
  const hpA = hpRc / (hpRc + dt);
  const lpA = dt / (lpRc + dt);
  let hpPrevIn = 0;
  let hpPrevOut = 0;
  let lpPrev = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i]!;
    const hp = hpA * (hpPrevOut + x - hpPrevIn);
    hpPrevIn = x;
    hpPrevOut = hp;
    lpPrev = lpPrev + lpA * (hp - lpPrev);
    out[i] = lpPrev;
  }
  return out;
}

/** Autocorrelation pitch estimate in [BAND_LO, BAND_HI]; bias toward fundamental. */
function estimatePitch(frame: Float32Array, sampleRate: number): number | null {
  const minLag = Math.floor(sampleRate / BAND_HI);
  const maxLag = Math.min(frame.length - 1, Math.floor(sampleRate / BAND_LO));
  if (maxLag <= minLag + 2) return null;

  let energy = 0;
  for (let i = 0; i < frame.length; i++) energy += frame[i]! * frame[i]!;
  if (energy < 1e-8) return null;

  const corrs = new Float32Array(maxLag + 1);
  let peakCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const n = frame.length - lag;
    for (let i = 0; i < n; i++) corr += frame[i]! * frame[i + lag]!;
    corrs[lag] = corr / n;
    if (corrs[lag]! > peakCorr) peakCorr = corrs[lag]!;
  }
  if (peakCorr <= 0 || peakCorr * frame.length / energy < 0.05) return null;

  // Absolute strongest lag, then halve while half-lag is still a strong peak
  // (pure tones also peak at 2T, 3T — prefer the first period).
  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (corrs[lag]! > corrs[bestLag]!) bestLag = lag;
  }

  let lag = bestLag;
  while (lag % 2 === 0 && lag / 2 >= minLag && corrs[lag / 2]! >= corrs[lag]! * 0.9) {
    lag = lag / 2;
  }
  // Also: if a local peak near lag/2 exists above 85%, prefer it
  const half = Math.round(lag / 2);
  if (half >= minLag && half < lag && corrs[half]! >= corrs[lag]! * 0.85) {
    lag = half;
  }
  return sampleRate / lag;
}

function detectOnsets(
  samples: Float32Array,
  sampleRate: number,
): Array<{ index: number; energy: number }> {
  const win = Math.max(64, Math.floor(sampleRate * 0.02)); // 20ms
  const hop = Math.max(32, Math.floor(win / 2));
  const energies: number[] = [];
  for (let i = 0; i + win < samples.length; i += hop) {
    let e = 0;
    for (let j = 0; j < win; j++) {
      const v = samples[i + j]!;
      e += v * v;
    }
    energies.push(e / win);
  }
  if (energies.length < 3) return [];

  // Positive energy flux (onset strength)
  const flux: number[] = [0];
  for (let i = 1; i < energies.length; i++) {
    flux.push(Math.max(0, energies[i]! - energies[i - 1]!));
  }
  const sorted = [...flux].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const absDev = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = absDev[Math.floor(absDev.length / 2)] ?? 0;
  const threshold = Math.max(median + 3 * (mad || median || 1e-8), 1e-7);

  const onsets: Array<{ index: number; energy: number }> = [];
  let last = -Infinity;
  const minGap = sampleRate * 0.18; // 180ms

  for (let i = 1; i < flux.length - 1; i++) {
    const f = flux[i]!;
    if (f >= threshold && f >= flux[i - 1]! && f >= flux[i + 1]! && energies[i]! > 1e-6) {
      const idx = i * hop;
      if (idx - last >= minGap) {
        onsets.push({ index: idx, energy: energies[i]! });
        last = idx;
      }
    }
  }
  return onsets.slice(0, 64);
}

function mergeNearbyNotes(notes: JobNote[]): JobNote[] {
  if (notes.length === 0) return notes;
  const out: JobNote[] = [];
  for (const n of notes) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.string === n.string &&
      prev.fret === n.fret &&
      n.tMs - prev.tMs < 220
    ) {
      prev.durMs = Math.max(prev.durMs, n.tMs + n.durMs - prev.tMs);
      prev.confidence = Math.max(prev.confidence, n.confidence);
      continue;
    }
    out.push({ ...n });
  }
  return out;
}

export function analyzeDecoded(decoded: DecodedAudio): JobResult {
  const filtered = bandLimit(decoded.samples, decoded.sampleRate);
  const onsets = detectOnsets(filtered, decoded.sampleRate);
  const frameLen = Math.floor(decoded.sampleRate * 0.08); // 80ms pitch frames
  const notes: JobNote[] = [];

  for (let i = 0; i < onsets.length; i++) {
    const o = onsets[i]!;
    const start = o.index;
    const end = Math.min(filtered.length, start + frameLen);
    const frame = filtered.subarray(start, end);
    const hz = estimatePitch(frame, decoded.sampleRate);
    if (hz == null) continue;
    const mapped = mapHzToFret(hz);
    const nextStart = onsets[i + 1]?.index ?? Math.min(filtered.length, start + frameLen * 2);
    const durMs = Math.max(80, ((nextStart - start) / decoded.sampleRate) * 1000 * 0.85);
    notes.push({
      string: mapped.string,
      fret: mapped.fret,
      tMs: Math.round((start / decoded.sampleRate) * 1000),
      durMs: Math.round(durMs),
      hz: Math.round(hz * 100) / 100,
      confidence: Math.round(mapped.conf * 1000) / 1000,
    });
  }

  const merged = mergeNearbyNotes(notes);

  const caveats = [
    "V1 stub analysis: band-limit 40–350 Hz → energy onset → autocorrelation pitch → EADG fret map (prefer frets 0–12 on ties).",
    "Not full stem separation; no Demucs. Real DSP owned by 440Hz later.",
    "Pitch/onset is a minimal honest placeholder — treat tabs as Estimated only.",
  ];

  if (merged.length === 0) {
    caveats.push(
      "No clear bass-band onsets detected; empty note list (not silent fake perfection).",
    );
  }

  const ascii = renderAscii(merged, decoded.durationMs);
  return {
    label: "Estimated",
    tuning: "EADG",
    sampleRate: decoded.sampleRate,
    durationMs: Math.round(decoded.durationMs),
    notes: merged,
    ascii,
    caveats,
  };
}

/** Placeholder notes when decode is unavailable — clearly labeled as stub. */
function stubPlaceholderResult(durationMs: number, reason: string): JobResult {
  const sampleRate = 44100;
  const dur = Math.max(1000, Math.min(durationMs || 4000, MAX_DURATION_MS));
  // A few shaped notes on E/A so JSON shape is real; not claimed as detected pitch.
  const skeleton: Array<{ string: BassStringIndex; fret: number; tMs: number; hz: number }> = [
    { string: 0, fret: 0, tMs: 0, hz: OPEN_HZ[0]! },
    { string: 0, fret: 3, tMs: 500, hz: midiToHz(hzToMidi(OPEN_HZ[0]!) + 3) },
    { string: 1, fret: 0, tMs: 1000, hz: OPEN_HZ[1]! },
    { string: 1, fret: 2, tMs: 1500, hz: midiToHz(hzToMidi(OPEN_HZ[1]!) + 2) },
    { string: 0, fret: 5, tMs: 2000, hz: midiToHz(hzToMidi(OPEN_HZ[0]!) + 5) },
  ].filter((n) => n.tMs < dur - 200);

  const notes: JobNote[] = skeleton.map((n) => ({
    string: n.string,
    fret: n.fret,
    tMs: n.tMs,
    durMs: 400,
    hz: Math.round(n.hz * 100) / 100,
    confidence: 0.2,
  }));

  const caveats = [
    "stub notes — not real pitch detection yet",
    `Decode unavailable (${reason}); placeholder notes only to exercise the JSON contract.`,
    "V1 stub: intended pipeline is band-limit 40–350 Hz → pitch/onset → fret map. Full DSP owned by 440Hz.",
  ];

  return {
    label: "Estimated",
    tuning: "EADG",
    sampleRate,
    durationMs: Math.round(dur),
    notes,
    ascii: renderAscii(notes, dur),
    caveats,
  };
}

export type AnalyzeInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

export function analyzeUpload(input: AnalyzeInput): JobResult {
  const lower = input.fileName.toLowerCase();
  const isWav =
    lower.endsWith(".wav") ||
    input.mimeType.includes("wav") ||
    input.mimeType.includes("wave");

  if (isWav) {
    const decoded = decodeWav(input.bytes);
    if (!decoded) {
      return stubPlaceholderResult(4000, "corrupt or unsupported WAV");
    }
    if (decoded.durationMs > MAX_DURATION_MS) {
      // Caller should 413 before this; still guard.
      throw Object.assign(new Error("Audio longer than 8 minutes"), { code: 413 });
    }
    return analyzeDecoded(decoded);
  }

  const ext =
    ([".mp3", ".m4a", ".flac", ".wav"] as const).find((e) => lower.endsWith(e)) ?? ".mp3";
  const est = estimateDurationFromSize(input.bytes.byteLength, ext) ?? 4000;
  return stubPlaceholderResult(est, `${ext} decode not implemented in V1 Node stub`);
}

export { OPEN_HZ, BAND_LO, BAND_HI };
