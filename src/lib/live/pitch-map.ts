/** Pure mapping: detected Hz → MIDI, cents, spelled name, fret position. No DOM, no audio. */
import { pcOf } from "../bass/spelling";

export const A4_HZ = 440;
export const MAX_FRET = 15;

export function hzToMidiFloat(hz: number): number {
  return 69 + 12 * Math.log2(hz / A4_HZ);
}

export type Position = { string: number; fret: number };

export type LiveReading = {
  midi: number;
  cents: number; // -50..+50, + = sharp
  name: string; // spelled, no octave
  octave: number;
  position: Position | null; // null when no fret on this tuning reaches it
};

/** All (string, fret) cells that sound `midi` on a tuning (openMidi: top string first). */
export function candidateFrets(
  midi: number,
  openMidi: readonly number[],
  maxFret = MAX_FRET,
): Position[] {
  const out: Position[] = [];
  openMidi.forEach((open, string) => {
    const fret = midi - open;
    if (fret >= 0 && fret <= maxFret) out.push({ string, fret });
  });
  return out;
}

/** Pick the cell nearest the previous one (fret distance + a small string-jump cost); else lowest fret. */
export function nearestPosition(cands: Position[], prev: Position | null): Position | null {
  if (cands.length === 0) return null;
  const cost = (c: Position) =>
    prev ? Math.abs(c.fret - prev.fret) + 0.5 * Math.abs(c.string - prev.string) : c.fret;
  return cands.reduce((best, c) => (cost(c) < cost(best) ? c : best));
}

export function mapHz(
  hz: number,
  openMidi: readonly number[],
  names: readonly string[],
  prev: Position | null = null,
): LiveReading | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  const f = hzToMidiFloat(hz);
  const midi = Math.round(f);
  const cents = Math.round((f - midi) * 1000) / 10;
  return {
    midi,
    cents,
    name: names[pcOf(midi)],
    octave: Math.floor(midi / 12) - 1,
    position: nearestPosition(candidateFrets(midi, openMidi), prev),
  };
}
