// Pure playback data for song tabs: tab cells -> timed note events + cursor lookup.
// No audio here; the synth/UI (Cate) consumes NoteEvent[].
import { TUNINGS } from "./theory";
import { EIGHTHS_PER_BAR, TAB_STRINGS } from "./songs";
import type { SongTab, TabBar, TabCell, TabString } from "./songs";

export type PlaybackSpeed = 0.5 | 0.75 | 1;

export interface SongToEventsOptions {
  /** Play one pass of this section's drawn bars (for looping). Omit for the full form. */
  sectionId?: string;
  speed?: PlaybackSpeed;
  /** Defaults to song.bpm. */
  bpm?: number;
}

export interface NoteEvent {
  startEighth: number;
  durationEighths: number;
  startSec: number;
  durationSec: number;
  midi: number;
  string: TabString;
  fret: number;
  sectionId: string;
  formPartIndex?: number;
  stepIndex?: number;
  /** Drawn bar index within the section (sustain bars report the last drawn bar). */
  barIndex: number;
  cellIndex: number;
}

/** One eighth-note slot on the timeline (rests and intro included). */
export interface CursorSlot {
  sectionId: string;
  barIndex: number;
  cellIndex: number;
  formPartIndex?: number;
  stepIndex?: number;
}

export interface SongEvents {
  events: NoteEvent[];
  totalEighths: number;
  totalSeconds: number;
  eighthSec: number;
  /** slots[i] = what the cursor shows during eighth i. Length = totalEighths. */
  slots: CursorSlot[];
}

export interface CursorPosition {
  sectionId: string;
  barIndex: number;
  cellIndex: number;
}

const STRING_INDEX: Record<TabString, number> = { G: 0, D: 1, A: 2, E: 3 };

/** Eighth-note length in seconds: 60 / (bpm * speed) / 2. */
export function eighthSeconds(bpm: number, speed: PlaybackSpeed = 1): number {
  return 60 / (bpm * speed) / 2;
}

const SILENT_BAR: TabBar = { G: [], D: [], A: [], E: [] };

/** Bar played past the drawn length: sustains any note still ringing at the end of `last`. */
function sustainBar(last: TabBar): TabBar {
  const bar = {} as TabBar;
  for (const s of TAB_STRINGS) {
    const end = last[s][EIGHTHS_PER_BAR - 1];
    const ringing = end !== null && end !== undefined;
    bar[s] = Array.from({ length: EIGHTHS_PER_BAR }, (): TabCell => (ringing ? { hold: true } : null));
  }
  return bar;
}

interface PlannedBar {
  bar: TabBar;
  slot: Omit<CursorSlot, "cellIndex">;
}

function planSection(
  song: SongTab,
  sectionId: string,
  times: number,
  barsOverride: number | undefined,
  ctx: { formPartIndex?: number; stepIndex?: number },
): PlannedBar[] {
  const out: PlannedBar[] = [];
  if (sectionId === "intro") {
    for (let i = 0; i < (barsOverride ?? 0); i++)
      out.push({ bar: SILENT_BAR, slot: { sectionId, barIndex: i, ...ctx } });
    return out;
  }
  const section = song.sections.find((s) => s.id === sectionId);
  if (!section) return out; // "end" and other markers take no time
  const drawn = section.bars;
  const n = barsOverride ?? drawn.length;
  for (let t = 0; t < times; t++) {
    for (let i = 0; i < n; i++) {
      const bar = i < drawn.length ? drawn[i] : sustainBar(drawn[drawn.length - 1]);
      out.push({ bar, slot: { sectionId, barIndex: Math.min(i, drawn.length - 1), ...ctx } });
    }
  }
  return out;
}

/**
 * Expand a song (or one section) into timed note events. Pure.
 * Fret = new note; hold (~) extends the previous note on that string (across bars/steps);
 * rest/null ends it. Pitch = TUNINGS[song.tuningId].openMidi[string] + fret.
 */
export function songToEvents(song: SongTab, opts: SongToEventsOptions = {}): SongEvents {
  const eighthSec = eighthSeconds(opts.bpm ?? song.bpm, opts.speed ?? 1);
  const open = TUNINGS[song.tuningId].openMidi;

  let plan: PlannedBar[];
  if (opts.sectionId) {
    if (!song.sections.some((s) => s.id === opts.sectionId))
      throw new Error(`unknown section ${opts.sectionId}`);
    plan = planSection(song, opts.sectionId, 1, undefined, {});
  } else {
    plan = song.form.flatMap((part, formPartIndex) =>
      part.steps.flatMap((step, stepIndex) =>
        planSection(song, step.sectionId, step.times ?? 1, step.bars, { formPartIndex, stepIndex }),
      ),
    );
  }

  const events: NoteEvent[] = [];
  const slots: CursorSlot[] = [];
  const active: Partial<Record<TabString, NoteEvent>> = {};
  plan.forEach((p, b) => {
    for (let c = 0; c < EIGHTHS_PER_BAR; c++) {
      const at = b * EIGHTHS_PER_BAR + c;
      slots.push({ ...p.slot, cellIndex: c });
      for (const s of TAB_STRINGS) {
        const cell = p.bar[s][c] ?? null;
        if (cell === null) {
          delete active[s];
        } else if ("hold" in cell) {
          const ev = active[s];
          if (ev) ev.durationEighths += 1;
        } else {
          const ev: NoteEvent = {
            startEighth: at,
            durationEighths: 1,
            startSec: 0,
            durationSec: 0,
            midi: open[STRING_INDEX[s]] + cell.fret,
            string: s,
            fret: cell.fret,
            sectionId: p.slot.sectionId,
            barIndex: p.slot.barIndex,
            cellIndex: c,
          };
          if (p.slot.formPartIndex !== undefined) ev.formPartIndex = p.slot.formPartIndex;
          if (p.slot.stepIndex !== undefined) ev.stepIndex = p.slot.stepIndex;
          events.push(ev);
          active[s] = ev;
        }
      }
    }
  });
  for (const ev of events) {
    ev.startSec = ev.startEighth * eighthSec;
    ev.durationSec = ev.durationEighths * eighthSec;
  }
  const totalEighths = slots.length;
  return { events, totalEighths, totalSeconds: totalEighths * eighthSec, eighthSec, slots };
}

/** Cursor at a playback time. null before 0, at/after the end, or for NaN. */
export function cursorAt(result: SongEvents, seconds: number): CursorPosition | null {
  if (!(seconds >= 0) || seconds >= result.totalSeconds) return null;
  const i = Math.min(Math.floor(seconds / result.eighthSec + 1e-9), result.totalEighths - 1);
  const s = result.slots[i];
  return { sectionId: s.sectionId, barIndex: s.barIndex, cellIndex: s.cellIndex };
}
