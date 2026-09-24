import { TUNINGS, midiToFreq, type TuningId } from "./theory";

type Amp = {
  volume: number;
  tone: number;
  drive: number;
  muted: boolean;
};

type Voice = {
  env: GainNode;
  oscs: OscillatorNode[];
  end: number;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let clickBus: GainNode | null = null;
let shaper: WaveShaperNode | null = null;
let ampGain: GainNode | null = null;
let toneFilter: BiquadFilterNode | null = null;
let ready: Promise<void> = Promise.resolve();

const voices: Array<Voice | null> = [null, null, null, null];
let amp: Amp = { volume: 0.82, tone: 0.62, drive: 0.18, muted: false };
let tuningId: TuningId = "standard";

function AudioCtx(): typeof AudioContext | undefined {
  return (
    (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(n);
  const k = amount * 18;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function ensureGraph(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = AudioCtx();
  if (!Ctor) return null;
  const audio = new Ctor({ latencyHint: "interactive" });
  const m = audio.createGain();
  const t = audio.createBiquadFilter();
  t.type = "lowpass";
  t.Q.value = 0.7;
  const s = audio.createWaveShaper();
  s.oversample = "2x";
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 10;
  compressor.ratio.value = 3.5;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.16;
  const cabFilter = audio.createBiquadFilter();
  cabFilter.type = "lowpass";
  cabFilter.frequency.value = 4200;
  cabFilter.Q.value = 0.5;
  const g = audio.createGain();

  t.connect(s);
  s.connect(compressor);
  compressor.connect(cabFilter);
  cabFilter.connect(g);
  g.connect(m);
  m.connect(audio.destination);

  // Dry click bus (440Hz): metronome/practice click bypasses amp/master.
  const click = audio.createGain();
  click.gain.value = 1;
  click.connect(audio.destination);

  ctx = audio;
  toneFilter = t;
  shaper = s;
  ampGain = g;
  master = m;
  clickBus = click;
  applyAmp();
  return audio;
}


function ensureClickBus(audio: AudioContext): GainNode {
  if (clickBus) return clickBus;
  const click = audio.createGain();
  click.gain.value = 1;
  click.connect(audio.destination);
  clickBus = click;
  return click;
}

function applyAmp() {
  if (!ctx || !ampGain || !master || !toneFilter || !shaper) return;
  const now = ctx.currentTime;
  const vol = amp.muted ? 0 : Math.pow(amp.volume, 1.6);
  ampGain.gain.setTargetAtTime(vol, now, 0.03);
  const cutoff = 280 + amp.tone * 3400;
  toneFilter.frequency.setTargetAtTime(cutoff, now, 0.04);
  shaper.curve = distortionCurve(amp.drive);
}

export function audioState(): AudioContextState | "off" {
  return ctx ? ctx.state : "off";
}

export function isRunning(): boolean {
  return Boolean(ctx && ctx.state === "running");
}

export function plugIn(): Promise<boolean> {
  const audio = ensureGraph();
  if (!audio) return Promise.resolve(false);
  if (audio.state === "running") {
    applyAmp();
    ready = Promise.resolve();
    return Promise.resolve(true);
  }
  ready = audio
    .resume()
    .then(() => {
      applyAmp();
    })
    .catch(() => {
      /* autoplay still blocked */
    });
  return ready.then(() => audio.state === "running");
}

export function resumeIfNeeded(): void {
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
}

export function setAmp(next: Partial<Amp>) {
  amp = { ...amp, ...next };
  if (ctx) applyAmp();
}

export function setTuning(id: TuningId) {
  tuningId = id;
}

export function silenceAll() {
  if (!ctx) return;
  for (let i = 0; i < voices.length; i++) releaseString(i, 0.04);
}

export function currentTime(): number {
  return ctx ? ctx.currentTime : 0;
}

function releaseString(stringIndex: number, fade = 0.03) {
  const audio = ctx;
  const v = voices[stringIndex];
  if (!audio || !v) return;
  const now = audio.currentTime;
  try {
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(Math.max(v.env.gain.value, 0.0001), now);
    v.env.gain.exponentialRampToValueAtTime(0.0001, now + fade);
  } catch {
    /* already stopped */
  }
  for (const osc of v.oscs) {
    try {
      osc.stop(now + fade + 0.02);
    } catch {
      /* already stopped */
    }
  }
  voices[stringIndex] = null;
}

function schedulePluck(
  audio: AudioContext,
  stringIndex: number,
  fret: number,
  hammer: boolean,
) {
  if (!toneFilter) return;
  const open = TUNINGS[tuningId].openMidi;
  const midi = open[stringIndex] + fret;
  // Boost low notes with audible harmonics so laptop/phone speakers can hear open E.
  const freq = midiToFreq(midi);
  const now = audio.currentTime + 0.01;

  releaseString(stringIndex, hammer ? 0.01 : 0.018);

  const env = audio.createGain();
  const peak = hammer ? 0.55 : 0.85;
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(peak, now + (hammer ? 0.005 : 0.008));
  env.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.16);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  env.connect(toneFilter);

  const oscs: OscillatorNode[] = [];
  const partials: Array<[number, number, OscillatorType]> = [
    [1, 0.55, "sawtooth"],
    [2, 0.28, "triangle"],
    [3, 0.14, "sine"],
    [4, 0.08, "sine"],
  ];
  for (const [mult, gainAmt, type] of partials) {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, now);
    const g = audio.createGain();
    g.gain.setValueAtTime(gainAmt, now);
    osc.connect(g);
    g.connect(env);
    osc.start(now);
    osc.stop(now + 2.0);
    oscs.push(osc);
  }

  voices[stringIndex] = { env, oscs, end: now + 2.0 };
}

export function pluck(
  stringIndex: number,
  fret: number,
  opts?: { hammer?: boolean },
) {
  const audio = ensureGraph();
  if (!audio) return;
  resumeIfNeeded();
  schedulePluck(audio, stringIndex, fret, Boolean(opts?.hammer));
}

export function click(level = 0.2) {
  const audio = ensureGraph();
  if (!audio) return;
  resumeIfNeeded();
  const bus = ensureClickBus(audio);
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(1200, now);
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(level, now + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  osc.connect(g);
  g.connect(bus);
  osc.start(now);
  osc.stop(now + 0.05);
}

/** Schedule a dry click at absolute AudioContext time (for look-ahead metronome). */
export function scheduleClick(
  when: number,
  opts?: { accent?: boolean; level?: number },
) {
  const audio = ensureGraph();
  if (!audio) return;
  const bus = ensureClickBus(audio);
  const accent = Boolean(opts?.accent);
  const level = opts?.level ?? (accent ? 0.28 : 0.16);
  const freq = accent ? 1800 : 1200;
  const osc = audio.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, when);
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(level, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + (accent ? 0.055 : 0.04));
  osc.connect(g);
  g.connect(bus);
  osc.start(when);
  osc.stop(when + 0.07);
}

/** Base + output latency in ms when the context is up; null if not yet plugged in. */
export function latencyMs(): number | null {
  if (!ctx) return null;
  const base = typeof ctx.baseLatency === "number" ? ctx.baseLatency : 0;
  const out =
    typeof (ctx as AudioContext & { outputLatency?: number }).outputLatency ===
    "number"
      ? (ctx as AudioContext & { outputLatency: number }).outputLatency
      : 0;
  return Math.round((base + out) * 1000);
}

/** Synth kit one-shots on dry clickBus (440Hz V1.1 — no sample packs). */
export function scheduleKick(when: number) {
  const audio = ensureGraph();
  if (!audio) return;
  const bus = ensureClickBus(audio);
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(80, when);
  osc.frequency.exponentialRampToValueAtTime(40, when + 0.12);
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.55, when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
  osc.connect(g);
  g.connect(bus);
  osc.start(when);
  osc.stop(when + 0.25);
}

export function scheduleSnare(when: number) {
  const audio = ensureGraph();
  if (!audio) return;
  const bus = ensureClickBus(audio);
  // Body tone
  const osc = audio.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, when);
  const og = audio.createGain();
  og.gain.setValueAtTime(0.0001, when);
  og.gain.exponentialRampToValueAtTime(0.22, when + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
  osc.connect(og);
  og.connect(bus);
  osc.start(when);
  osc.stop(when + 0.1);
  // Noise burst
  const dur = 0.12;
  const frames = Math.max(1, Math.floor(audio.sampleRate * dur));
  const buf = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buf;
  const bp = audio.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(1800, when);
  bp.Q.value = 0.8;
  const ng = audio.createGain();
  ng.gain.setValueAtTime(0.0001, when);
  ng.gain.exponentialRampToValueAtTime(0.35, when + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(bus);
  src.start(when);
  src.stop(when + dur);
}

export function scheduleHat(when: number) {
  const audio = ensureGraph();
  if (!audio) return;
  const bus = ensureClickBus(audio);
  const dur = 0.05;
  const frames = Math.max(1, Math.floor(audio.sampleRate * dur));
  const buf = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buf;
  const hp = audio.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(7000, when);
  hp.Q.value = 0.7;
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.18, when + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
  src.connect(hp);
  hp.connect(g);
  g.connect(bus);
  src.start(when);
  src.stop(when + dur);
}
