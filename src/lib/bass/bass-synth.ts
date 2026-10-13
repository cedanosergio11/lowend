/**
 * Song-demo bass synth (440Hz spec).
 * Voice: saw @ f + sine @ f/2 -> lowpass 900 Hz -> ADSR env -> bus -> amp rack input.
 * Env: attack 5 ms, decay 250 ms to 60 % sustain, release 80 ms.
 * ONE envelope per NoteEvent (holds are pre-merged); long notes fade sustain toward 30 %
 * across the event (reaches 30 % at 7.5 s, the long-G hold length).
 */
import { midiToFreq } from "./theory";

export const SYNTH = {
  attackSec: 0.005,
  decaySec: 0.25,
  sustain: 0.6,
  holdFloor: 0.3,
  holdFadeRefSec: 7.5,
  releaseSec: 0.08,
  lowpassHz: 900,
  sawLevel: 0.5,
  subLevel: 0.5,
  /** Bus level into the amp rack (≈ −10 dBFS peak per voice before amp volume). Hearing-safe default. */
  busLevel: 0.32,
} as const;

export interface ScheduledVoice {
  oscs: OscillatorNode[];
  env: GainNode;
  start: number;
  end: number;
}

/** Envelope level at time t (seconds since note start) before release. */
export function envLevelAt(t: number, durationSec: number): number {
  const { attackSec: a, decaySec: d, sustain: s } = SYNTH;
  if (t <= 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - ((t - a) / d) * (1 - s);
  const fadeFrac = Math.min(1, durationSec / SYNTH.holdFadeRefSec);
  const endLevel = s - (s - SYNTH.holdFloor) * fadeFrac;
  const sustainSpan = Math.max(1e-6, durationSec - a - d);
  return s + (endLevel - s) * Math.min(1, (t - a - d) / sustainSpan);
}

export class BassSynth {
  readonly bus: GainNode;
  private voices: ScheduledVoice[] = [];

  constructor(
    private readonly audio: AudioContext,
    destination: AudioNode,
  ) {
    this.bus = audio.createGain();
    this.bus.gain.value = SYNTH.busLevel;
    this.bus.connect(destination);
  }

  /** Schedule one note at absolute AudioContext time `when`. */
  scheduleNote(midi: number, when: number, durationSec: number): ScheduledVoice {
    const a = this.audio;
    const f = midiToFreq(midi);
    const saw = a.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.setValueAtTime(f, when);
    const sub = a.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(f / 2, when);
    const sawG = a.createGain();
    sawG.gain.value = SYNTH.sawLevel;
    const subG = a.createGain();
    subG.gain.value = SYNTH.subLevel;
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = SYNTH.lowpassHz;
    lp.Q.value = 0.7;
    const env = a.createGain();
    saw.connect(sawG).connect(lp);
    sub.connect(subG).connect(lp);
    lp.connect(env).connect(this.bus);

    const dur = Math.max(0.02, durationSec);
    const g = env.gain;
    g.setValueAtTime(0, when);
    const { attackSec: at, decaySec: dc } = SYNTH;
    if (dur <= at) {
      g.linearRampToValueAtTime(envLevelAt(dur, dur), when + dur);
    } else {
      g.linearRampToValueAtTime(1, when + at);
      if (dur <= at + dc) {
        g.linearRampToValueAtTime(envLevelAt(dur, dur), when + dur);
      } else {
        g.linearRampToValueAtTime(SYNTH.sustain, when + at + dc);
        g.linearRampToValueAtTime(envLevelAt(dur, dur), when + dur);
      }
    }
    const end = when + dur + SYNTH.releaseSec;
    g.linearRampToValueAtTime(0, end);
    saw.start(when);
    sub.start(when);
    saw.stop(end + 0.02);
    sub.stop(end + 0.02);
    const v: ScheduledVoice = { oscs: [saw, sub], env, start: when, end };
    this.voices.push(v);
    saw.onended = () => {
      this.voices = this.voices.filter((x) => x !== v);
      try {
        env.disconnect();
      } catch {
        /* gone */
      }
    };
    return v;
  }

  /** Stop everything now with a short fade (no click), then detach the bus. */
  dispose(fadeSec = 0.03) {
    const now = this.audio.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.linearRampToValueAtTime(0, now + fadeSec);
    for (const v of this.voices) {
      for (const o of v.oscs) {
        try {
          o.stop(now + fadeSec + 0.01);
        } catch {
          /* not started / stopped */
        }
      }
    }
    this.voices = [];
    const bus = this.bus;
    setTimeout(() => {
      try {
        bus.disconnect();
      } catch {
        /* gone */
      }
    }, (fadeSec + 0.05) * 1000);
  }
}
