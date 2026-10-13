// Song tabs for LOWEND. Data layer only (UI lives in components/studio).
// Source: 440Hz estimate from Sergio's MP3 (/workspace/tabs/Pista_1_unknown_bass_tab.txt).
// ASCII lines are stored verbatim; never edit notes here without 440Hz sign-off.
import type { ScaleId, TuningId } from "./theory";

export type TabString = "G" | "D" | "A" | "E";
export const TAB_STRINGS: readonly TabString[] = ["G", "D", "A", "E"];

/** One 8th-note slot. null = rest. */
export type TabCell = { fret: number } | { hold: true } | null;
/** Exactly 8 cells per string. */
export type TabBar = Record<TabString, TabCell[]>;

export type Confidence = "low" | "medium" | "medium-high";

export interface TabSection {
  id: string;
  name: string;
  confidence: Confidence;
  repeat?: string;
  notes: string[];
  /** Verbatim ASCII lines from the source file (G, D, A, E order). */
  ascii: string[];
  bars: TabBar[];
}

export interface FormStep {
  /** Section id, or "intro" / "end" for non-tab steps. */
  sectionId: string;
  times?: number;
  bars?: number;
  note?: string;
}

export interface FormPart {
  name: string;
  steps: FormStep[];
}

export interface SongTab {
  id: string;
  title: string;
  artist: string;
  year: number;
  status: "estimated";
  source: string;
  caveats: string[];
  bpm: number;
  meter: [4, 4];
  eighthsPerBar: 8;
  key: { root: "G"; mode: "minor"; estimated: true };
  /** TUNINGS.eb openMidi [42,37,32,27] = Gb Db Ab Eb (G D A E strings, half-step down). */
  tuningId: Extract<TuningId, "eb">;
  sections: TabSection[];
  form: FormPart[];
}

export const EIGHTHS_PER_BAR = 8;
const BAR_CHARS = EIGHTHS_PER_BAR * 2;

function parseCell(pair: string, where: string): TabCell {
  const c = pair[0];
  if (pair[1] !== "-" && pair[1] !== "~" && !/\d/.test(pair[1]))
    throw new Error(`bad filler '${pair[1]}' at ${where}`);
  if (/\d/.test(c)) {
    if (/\d/.test(pair[1])) return { fret: Number(pair) };
    return { fret: Number(c) };
  }
  if (c === "~") return { hold: true };
  if (c === "-") return null;
  throw new Error(`bad tab char '${c}' at ${where}`);
}

/**
 * Parse ASCII tab lines ("G|....|....|" etc., any order, trailing comments ok)
 * into bars of 8 eighth-note cells per string. Pure.
 */
export function parseAsciiBars(lines: readonly string[]): TabBar[] {
  const perString: Partial<Record<TabString, TabCell[][]>> = {};
  for (const line of lines) {
    const m = /^\s*([GDAE])\|(.*)$/.exec(line);
    if (!m) throw new Error(`not a tab line: ${line}`);
    const s = m[1] as TabString;
    if (perString[s]) throw new Error(`duplicate string ${s}`);
    const body = m[2];
    const last = body.lastIndexOf("|");
    const chunks = body.slice(0, last).split("|");
    perString[s] = chunks.map((chunk, b) => {
      if (chunk.length !== BAR_CHARS)
        throw new Error(`${s} bar ${b + 1}: ${chunk.length} chars, expected ${BAR_CHARS}`);
      const cells: TabCell[] = [];
      for (let i = 0; i < BAR_CHARS; i += 2)
        cells.push(parseCell(chunk.slice(i, i + 2), `${s} bar ${b + 1} cell ${i / 2}`));
      return cells;
    });
  }
  const missing = TAB_STRINGS.filter((s) => !perString[s]);
  if (missing.length) throw new Error(`missing strings: ${missing.join(",")}`);
  const n = perString.G!.length;
  if (TAB_STRINGS.some((s) => perString[s]!.length !== n))
    throw new Error("strings have different bar counts");
  return Array.from({ length: n }, (_, b) => ({
    G: perString.G![b],
    D: perString.D![b],
    A: perString.A![b],
    E: perString.E![b],
  }));
}

export type StandardCell = { fret: number } | { fret: null; unplayable: true } | { hold: true } | null;

/** Eb-tuned cell -> standard EADG view (fret - 1). Open strings become unplayable. */
export function toStandardTuning(cell: TabCell): StandardCell {
  if (cell === null || "hold" in cell) return cell;
  if (cell.fret <= 0) return { fret: null, unplayable: true };
  return { fret: cell.fret - 1 };
}

function section(s: Omit<TabSection, "bars">): TabSection {
  return { ...s, bars: parseAsciiBars(s.ascii) };
}

const PISTA_1_SECTIONS: TabSection[] = [
  section({
    id: "verse",
    name: "Verse riff",
    confidence: "medium-high",
    repeat: "x4 per verse (verse 1 ~x10)",
    notes: [
      "The E-D pickup at the end of bar 2 leads back into bar 1.",
      "The last time through, replace bar 2 with the fill.",
    ],
    ascii: [
      "G|----------------|----------------|",
      "D|3-1-------------|------------4-3-|",
      "A|----------------|----------------|",
      "E|----4-4-2-2-4-1-|--------4-4-----|",
    ],
  }),
  section({
    id: "fill",
    name: "Fill / turnaround",
    confidence: "low",
    notes: ["E E Bb E D Ab G, a fast run up into the next riff."],
    ascii: [
      "G|----------2-1---|",
      "D|------3-1-------|",
      "A|----2-----------|",
      "E|1-1-------------|",
    ],
  }),
  section({
    id: "pre",
    name: "Pre-chorus",
    confidence: "medium",
    repeat: "2 bars x3",
    notes: [],
    ascii: [
      "G|----------------|----------------|",
      "D|----------------|----------------|",
      "A|--2-2-2-2-------|2-2-4-4-4---2-2-|",
      "E|4-----------4-2-|4---------4-----|",
    ],
  }),
  section({
    id: "g-hold",
    name: "G hold",
    confidence: "medium",
    notes: ["1st time hold G ~3-4 bars; before choruses 1 bar then lead in A1 G1"],
    ascii: [
      "G|----------------|----------------|",
      "D|1-1-------------|----------------|",
      "A|----------------|----------------|",
      "E|----4-4-4-4-4-4-|4~~~~~~~~~~~~~~~|",
    ],
  }),
  section({
    id: "chorus",
    name: "Chorus",
    confidence: "medium",
    repeat: "x8 (Eb pedal)",
    notes: [
      "C Bb, then 8ths on low Eb.",
      "The last 2 notes vary per pass; the tab shows one version, not a definitive one.",
      "last 2 notes vary (G-Ab, Ab-Bb, F-G…)",
      "some Eb hits jump up an octave (D string fret 2), play by ear",
    ],
    ascii: [
      "G|----------------|",
      "D|----------------|",
      "A|4-2-------------|",
      "E|----0-0-0-0-4-5-|",
    ],
  }),
];

const v = (times: number): FormStep => ({ sectionId: "verse", times });
const PRE: FormStep = { sectionId: "pre", times: 3 };
const G_BAR: FormStep = { sectionId: "g-hold", note: "1 bar, then lead in A1 G1" };
const G_LONG: FormStep = { sectionId: "g-hold", note: "long hold, ~3-4 bars" };
const CHORUS: FormStep = { sectionId: "chorus", times: 8 };

const PISTA_1_FORM: FormPart[] = [
  { name: "Intro", steps: [{ sectionId: "intro", bars: 2, note: "no bass" }] },
  { name: "Part 1", steps: [v(10), PRE, G_LONG] },
  { name: "Part 2", steps: [v(4), PRE, G_BAR, CHORUS] },
  { name: "Part 3", steps: [v(6), PRE, G_BAR, CHORUS, G_LONG] },
  { name: "Part 4", steps: [v(4), PRE, G_BAR, CHORUS, { sectionId: "end", note: "end on Eb" }] },
];

export const SONGS: SongTab[] = [
  {
    id: "pista-1",
    title: "Pista 1",
    artist: "Unknown artist",
    year: 1993,
    status: "estimated",
    source:
      "440Hz estimate from Sergio's MP3 (demucs htdemucs bass stem, librosa pyin + beat tracking, quantized to 8ths)",
    caveats: [
      "Machine-estimated.",
      "Octave errors are likely (the high E-D notes may be lower).",
      "Rhythms are simplified to 8ths.",
      "Tuning and key are inferences.",
      "Check it by ear.",
      "Not an official tab.",
    ],
    bpm: 96,
    meter: [4, 4],
    eighthsPerBar: 8,
    key: { root: "G", mode: "minor", estimated: true },
    tuningId: "eb",
    sections: PISTA_1_SECTIONS,
    form: PISTA_1_FORM,
  },
];

export interface SongPresets {
  bpm: number;
  root: "G";
  /** Pitch class for store.setRootPc (G = 7). */
  rootPc: number;
  scale: Extract<ScaleId, "minor">;
  tuningId: Extract<TuningId, "eb">;
}

/** Metronome + fretboard presets for a song. */
export function songPresets(song: SongTab): SongPresets {
  return { bpm: song.bpm, root: song.key.root, rootPc: 7, scale: "minor", tuningId: song.tuningId };
}
