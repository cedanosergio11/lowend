export const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

export const FRET_COUNT = 15;
export const STRING_COUNT = 4;

/** Top (highest) to bottom (lowest): G D A E — the way you look at a bass. */
export const STRING_LABELS = ["G", "D", "A", "E"] as const;

export type TuningId = "standard" | "dropD" | "eb";

export const TUNINGS: Record<
  TuningId,
  { id: TuningId; label: string; openMidi: [number, number, number, number] }
> = {
  standard: { id: "standard", label: "Standard", openMidi: [43, 38, 33, 28] },
  dropD: { id: "dropD", label: "Drop D", openMidi: [43, 38, 33, 26] },
  eb: { id: "eb", label: "E♭", openMidi: [42, 37, 32, 27] },
};

export type ScaleId =
  | "off"
  | "minPent"
  | "majPent"
  | "blues"
  | "dorian"
  | "mixo"
  | "minor"
  | "major";

export const SCALES: Record<
  ScaleId,
  { id: ScaleId; label: string; intervals: number[] }
> = {
  off: { id: "off", label: "Off", intervals: [] },
  minPent: { id: "minPent", label: "Minor pent", intervals: [0, 3, 5, 7, 10] },
  majPent: { id: "majPent", label: "Major pent", intervals: [0, 2, 4, 7, 9] },
  blues: { id: "blues", label: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
  dorian: { id: "dorian", label: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixo: { id: "mixo", label: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  minor: { id: "minor", label: "Natural minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  major: { id: "major", label: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
};

export const ROOTS = NOTE_NAMES.map((name, pc) => ({ pc, name }));

export const INLAY_FRETS = new Set([3, 5, 7, 9, 12, 15]);
export const DOUBLE_INLAY = new Set([12]);

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function fretMidi(
  openMidi: readonly [number, number, number, number],
  stringIndex: number,
  fret: number,
): number {
  return openMidi[stringIndex] + fret;
}

export function scaleDegree(
  midi: number,
  rootPc: number,
  intervals: number[],
): number | null {
  if (intervals.length === 0) return null;
  const rel = (pitchClass(midi) - rootPc + 12) % 12;
  return intervals.includes(rel) ? rel : null;
}

/** Real-scale fret widths, normalized so they sum to 1. */
export function fretWidths(count: number): number[] {
  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = 1 - Math.pow(2, -i / 12);
    const b = 1 - Math.pow(2, -(i + 1) / 12);
    raw.push(b - a);
  }
  const min = raw[raw.length - 1] ?? 1;
  const boosted = raw.map((w) => Math.max(w, min * 0.92));
  const sum = boosted.reduce((a, b) => a + b, 0);
  return boosted.map((w) => Math.round((w / sum) * 1e6) / 1e6);
}

export const KEY_MAP: Record<string, { string: number; fret: number }> = {};

const G_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const D_KEYS = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const A_KEYS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"];
const E_KEYS = ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"];

G_KEYS.forEach((k, i) => {
  KEY_MAP[k] = { string: 0, fret: i };
});
D_KEYS.forEach((k, i) => {
  KEY_MAP[k] = { string: 1, fret: i };
});
A_KEYS.forEach((k, i) => {
  KEY_MAP[k] = { string: 2, fret: i };
});
E_KEYS.forEach((k, i) => {
  KEY_MAP[k] = { string: 3, fret: i };
});
