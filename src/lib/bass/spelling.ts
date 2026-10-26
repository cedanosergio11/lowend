/** Key-aware note spelling shared by the Fretboard and Live input. */
export const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"] as const;
export const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;
export const NATURAL_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
// Key signatures spelled with sharps; everything else (flat keys, C major / A minor) uses flats.
const SHARP_MAJOR = new Set([7, 2, 9, 4, 11]);
const SHARP_MINOR = new Set([4, 11, 6, 1, 8]);

/** Spell accidentals from the active key (root + scale intervals); default flats. */
export function spellingFor(rootPc: number, intervals: readonly number[]): readonly string[] {
  const minorish = intervals.includes(3) && !intervals.includes(4);
  const sharp = minorish ? SHARP_MINOR.has(rootPc) : SHARP_MAJOR.has(rootPc);
  return sharp ? SHARP_NAMES : FLAT_NAMES;
}

export const pcOf = (midi: number) => ((midi % 12) + 12) % 12;
