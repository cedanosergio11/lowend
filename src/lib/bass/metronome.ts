/**
 * Click-only metronome (440Hz V1).
 * Look-ahead scheduler (~25 ms poll, ~100 ms ahead) — not setInterval on the beat.
 */
import {
  currentTime,
  latencyMs,
  plugIn,
  resumeIfNeeded,
  scheduleClick,
} from "./audio";

export type TimeSig = "4/4" | "3/4";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1;

let timerId: ReturnType<typeof setTimeout> | null = null;
let nextNoteTime = 0;
let beatInBar = 0;
let bpm = 100;
let beatsPerBar = 4;
let running = false;
let onBeat: ((beat: number) => void) | null = null;
const stopListeners = new Set<() => void>();

function beatsFromSig(sig: TimeSig): number {
  return sig === "3/4" ? 3 : 4;
}

function secondsPerBeat(): number {
  return 60 / Math.max(40, Math.min(240, bpm));
}

function scheduleNote(beat: number, time: number) {
  scheduleClick(time, { accent: beat === 0 });
  onBeat?.(beat);
}

function advanceNote() {
  nextNoteTime += secondsPerBeat();
  beatInBar = (beatInBar + 1) % beatsPerBar;
}

function scheduler() {
  if (!running) return;
  const now = currentTime();
  while (nextNoteTime < now + SCHEDULE_AHEAD) {
    scheduleNote(beatInBar, nextNoteTime);
    advanceNote();
  }
  timerId = setTimeout(scheduler, LOOKAHEAD_MS);
}

export function isMetronomeRunning(): boolean {
  return running;
}

export function getMetronomeBpm(): number {
  return bpm;
}

export function getMetronomeLatencyMs(): number | null {
  return latencyMs();
}

export function setMetronomeBpm(next: number) {
  bpm = Math.max(40, Math.min(240, Math.round(next)));
}

export function setMetronomeTimeSig(sig: TimeSig) {
  beatsPerBar = beatsFromSig(sig);
  if (beatInBar >= beatsPerBar) beatInBar = 0;
}

export function setMetronomeBeatListener(fn: ((beat: number) => void) | null) {
  onBeat = fn;
}

export async function startMetronome(opts: {
  bpm: number;
  timeSig: TimeSig;
}): Promise<boolean> {
  setMetronomeBpm(opts.bpm);
  setMetronomeTimeSig(opts.timeSig);
  const ok = await plugIn();
  if (!ok) return false;
  resumeIfNeeded();
  stopMetronomeSchedulerOnly();
  running = true;
  beatInBar = 0;
  nextNoteTime = currentTime() + 0.05;
  scheduler();
  return true;
}

function stopMetronomeSchedulerOnly() {
  running = false;
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

export function onMetronomeStopped(fn: () => void): () => void {
  stopListeners.add(fn);
  return () => {
    stopListeners.delete(fn);
  };
}

export function stopMetronome() {
  const was = running;
  stopMetronomeSchedulerOnly();
  beatInBar = 0;
  if (was) {
    for (const fn of stopListeners) fn();
  }
}
