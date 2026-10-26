import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import {
  DOUBLE_INLAY,
  FRET_COUNT,
  INLAY_FRETS,
  KEY_MAP,
  STRING_COUNT,
  STRING_LABELS,
  TUNINGS,
  fretMidi,
  fretWidths,
  scaleDegree,
  solfegeForDegree,
  SCALES,
} from "@/lib/bass/theory";
import { pluck } from "@/lib/bass/audio";
import { useBassStore } from "@/lib/bass/store";
import { grooveById, hitsAt } from "@/lib/bass/grooves";

/** Frets drawn after the nut. Open strings (fret 0) sit in a label column left of the nut. */
const DEFAULT_BOARD_FRETS = 12;

const OPEN_COL = "3rem";
const NUT_COL = "0.55rem";

function fretTemplate(frets: number) {
  const widths = fretWidths(frets);
  return `${OPEN_COL} ${NUT_COL} ${widths.map((w) => `minmax(2.6rem, ${w.toFixed(5)}fr)`).join(" ")}`;
}

const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const NATURAL_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
// Key signatures spelled with sharps; everything else (flat keys, C major / A minor) uses flats.
const SHARP_MAJOR = new Set([7, 2, 9, 4, 11]);
const SHARP_MINOR = new Set([4, 11, 6, 1, 8]);

/** Spell accidentals from the active key (root + scale); default flats. */
function spellingFor(rootPc: number, intervals: readonly number[]): readonly string[] {
  const minorish = intervals.includes(3) && !intervals.includes(4);
  const sharp = minorish ? SHARP_MINOR.has(rootPc) : SHARP_MAJOR.has(rootPc);
  return sharp ? SHARP_NAMES : FLAT_NAMES;
}

const pcOf = (midi: number) => ((midi % 12) + 12) % 12;

function invertKeyMap() {
  const out: Record<string, string> = {};
  for (const [key, loc] of Object.entries(KEY_MAP)) {
    out[`${loc.string}-${loc.fret}`] = key.length === 1 ? key.toUpperCase() : key;
  }
  return out;
}

const KEY_AT = invertKeyMap();

function fretLabelText(
  midi: number,
  deg: number | null,
  labelMode: "notes" | "solfege" | "both",
  names: readonly string[],
): string {
  const note = names[pcOf(midi)];
  const solfa = solfegeForDegree(deg);
  if (labelMode === "notes") return note;
  if (labelMode === "solfege") return solfa ?? "";
  // both: note always; solfège only on lit scale frets
  if (solfa) return `${note} ${solfa}`;
  return note;
}

export function Fretboard({ frets = DEFAULT_BOARD_FRETS }: { frets?: number } = {}) {
  const boardFrets = Math.max(1, Math.min(frets, FRET_COUNT));
  const template = fretTemplate(boardFrets);
  const live = useBassStore((s) => s.live);
  const goLive = useBassStore((s) => s.goLive);
  const tuningId = useBassStore((s) => s.tuningId);
  const labelMode = useBassStore((s) => s.labelMode);
  const showKeys = useBassStore((s) => s.showKeys);
  const scaleId = useBassStore((s) => s.scaleId);
  const rootPc = useBassStore((s) => s.rootPc);
  const buzzing = useBassStore((s) => s.buzzing);
  const lastNote = useBassStore((s) => s.lastNote);
  const grooveId = useBassStore((s) => s.grooveId);
  const playing = useBassStore((s) => s.playing);
  const playhead = useBassStore((s) => s.playhead);
  const setLastNote = useBassStore((s) => s.setLastNote);
  const setBuzzing = useBassStore((s) => s.setBuzzing);

  const openMidi = TUNINGS[tuningId].openMidi;
  const intervals = SCALES[scaleId].intervals;
  // Solfège/Both always label movable-Do Major (Do–Ti incl. Re+La);
  // union active scale so Me/Fi/Te still appear when that scale is on.
  // Highlight stays on the selected scale only.
  const labelIntervals =
    labelMode === "solfege" || labelMode === "both"
      ? [...new Set([...SCALES.major.intervals, ...intervals])].sort(
          (a, b) => a - b,
        )
      : intervals;
  const names = spellingFor(rootPc, intervals);
  // String names come from the tuning, not a hard-coded G D A E.
  const stringNames = openMidi.map((m) => names[pcOf(m)]);
  const groove = grooveById(grooveId);
  const activeHits =
    playing && groove && playhead >= 0 ? hitsAt(groove, playhead) : [];

  const pointer = useRef<{ string: number; fret: number } | null>(null);
  const buzzTimer = useRef<number | null>(null);
  const lastPlay = useRef(0);

  const stringThickness = useMemo(() => [1.25, 1.7, 2.25, 2.9], []);

  function playFret(stringIndex: number, fret: number, hammer = false) {
    const now = performance.now();
    if (!hammer && now - lastPlay.current < 40) return;
    lastPlay.current = now;
    if (!live) goLive();
    pluck(stringIndex, fret, { hammer });
    const midi = fretMidi(openMidi, stringIndex, fret);
    setLastNote({ string: stringIndex, fret, midi });
    setBuzzing(stringIndex);
    if (buzzTimer.current) window.clearTimeout(buzzTimer.current);
    buzzTimer.current = window.setTimeout(() => setBuzzing(null), 280);
  }

  function pressCell(
    e: { stopPropagation: () => void },
    stringIndex: number,
    fret: number,
    hammer = false,
  ) {
    e.stopPropagation();
    pointer.current = { string: stringIndex, fret };
    playFret(stringIndex, fret, hammer);
  }

  function locFromEvent(e: { clientX: number; clientY: number }) {
    const node = document.elementFromPoint(e.clientX, e.clientY);
    const cell = node instanceof Element ? node.closest("[data-string]") : null;
    if (!cell) return null;
    const stringIndex = Number(cell.getAttribute("data-string"));
    const fret = Number(cell.getAttribute("data-fret"));
    if (Number.isNaN(stringIndex) || Number.isNaN(fret)) return null;
    return { string: stringIndex, fret };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.buttons === 0) {
      pointer.current = null;
      return;
    }
    const loc = locFromEvent(e);
    if (!loc) return;
    const prev = pointer.current;
    if (!prev) {
      pointer.current = loc;
      playFret(loc.string, loc.fret, false);
      return;
    }
    if (prev.string === loc.string && prev.fret !== loc.fret) {
      pointer.current = loc;
      playFret(loc.string, loc.fret, true);
    }
  }

  function onPointerUp() {
    pointer.current = null;
  }

  useEffect(() => {
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  function dotClass(midi: number, fret: number, stringIndex: number) {
    const pc = pcOf(midi);
    const highlightDeg = scaleDegree(midi, rootPc, intervals);
    const active = lastNote?.string === stringIndex && lastNote.fret === fret;
    const grooveHit = activeHits.some(
      (h) => h.string === stringIndex && h.fret === fret,
    );
    if (active || grooveHit) return "bg-live text-bg ring-2 ring-live scale-110";
    const base = NATURAL_PCS.has(pc)
      ? "bg-orange-50 text-orange-900 ring-2 ring-orange-500"
      : "bg-sky-50 text-sky-900 ring-2 ring-sky-600";
    if (highlightDeg === 0) return `${base} ring-[3px] outline-2 outline-offset-1 outline-accent font-bold`;
    if (highlightDeg != null) return base;
    return `${base} opacity-40`;
  }

  function dotText(midi: number, stringIndex: number, fret: number) {
    const labelDeg = scaleDegree(midi, rootPc, labelIntervals);
    const text = fretLabelText(midi, labelDeg, labelMode, names);
    if (text) return text;
    if (showKeys) return KEY_AT[`${stringIndex}-${fret}`] ?? "";
    return "";
  }

  const dotSize =
    labelMode === "both"
      ? "size-10 min-w-10 px-1 text-[0.62rem] leading-tight"
      : "size-8 text-[0.78rem]";

  return (
    <div className="w-full">
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <p className="font-mono text-xs tracking-wide text-muted uppercase">
          {TUNINGS[tuningId].label} · {stringNames.join(" ")}
        </p>
        <p className="font-mono text-xs tabular-nums text-muted" aria-live="polite">
          {lastNote
            ? `${stringNames[lastNote.string] ?? STRING_LABELS[lastNote.string]} ${lastNote.fret === 0 ? "open" : `fret ${lastNote.fret}`} · ${names[pcOf(lastNote.midi)]}${Math.floor(lastNote.midi / 12) - 1}`
            : live
              ? "Tap a fret"
              : "Tap a fret to plug in"}
        </p>
      </div>

      <div
        className="overflow-x-auto rounded-xl p-2"
        style={{
          background:
            "linear-gradient(180deg, var(--color-raised), var(--color-surface))",
          boxShadow: "var(--shadow-border)",
        }}
      >
        <div
          role="group"
          aria-label={`Bass fretboard, ${TUNINGS[tuningId].label} tuning, open strings ${stringNames.join(" ")} top to bottom, frets 1 to ${boardFrets}`}
          className="relative select-none"
          style={{ minWidth: `calc(${OPEN_COL} + ${NUT_COL} + ${boardFrets} * 2.6rem)` }}
          onPointerDown={(e) => {
            const loc = locFromEvent(e);
            if (!loc) return;
            pointer.current = loc;
            playFret(loc.string, loc.fret, false);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Board: starts at the nut; open-string column stays outside it. */}
          <div
            className="pointer-events-none absolute right-0 bottom-0 rounded-r-lg"
            style={{
              top: "1.5rem",
              left: `calc(${OPEN_COL} + ${NUT_COL})`,
              background:
                "linear-gradient(90deg, transparent 94%, rgba(0,0,0,0.35)), linear-gradient(180deg, var(--color-wood) 0%, var(--color-wood-mid) 48%, var(--color-wood-dark) 100%)",
            }}
            aria-hidden
          />
          {/* Nut */}
          <div
            className="pointer-events-none absolute bottom-0 z-[2] rounded-[2px] bg-zinc-800 ring-1 ring-black/60"
            style={{ top: "1.5rem", left: OPEN_COL, width: NUT_COL }}
            aria-hidden
          />

          <div className="relative grid h-6" style={{ gridTemplateColumns: template }} aria-hidden>
            <div className="flex items-center justify-center font-mono text-[0.6rem] text-muted uppercase">
              open
            </div>
            <div />
            {Array.from({ length: boardFrets }, (_, i) => (
              <div
                key={i}
                className={
                  "flex items-center justify-center font-mono text-[0.65rem] tabular-nums " +
                  (INLAY_FRETS.has(i + 1) ? "text-fg" : "text-muted")
                }
              >
                {i + 1}
              </div>
            ))}
          </div>

          {Array.from({ length: STRING_COUNT }, (_, stringIndex) => {
            const openNote = openMidi[stringIndex];
            return (
              <div
                key={stringIndex}
                className="relative grid"
                style={{ gridTemplateColumns: template }}
              >
                {/* Open string (tab fret 0): label circle left of the nut. */}
                <button
                  type="button"
                  data-string={stringIndex}
                  data-fret={0}
                  aria-label={`${stringNames[stringIndex]} string open, ${names[pcOf(openNote)]}`}
                  className="fret-cell relative z-10 flex h-11 items-center justify-center"
                  onPointerDown={(e) => pressCell(e, stringIndex, 0)}
                >
                  <span
                    className={
                      "fret-dot flex items-center justify-center rounded-full font-mono font-semibold transition-transform " +
                      dotSize + " " + dotClass(openNote, 0, stringIndex)
                    }
                  >
                    {dotText(openNote, stringIndex, 0)}
                  </span>
                </button>
                <div aria-hidden />
                {Array.from({ length: boardFrets }, (_, i) => {
                  const f = i + 1;
                  const midi = fretMidi(openMidi, stringIndex, f);
                  return (
                    <button
                      key={f}
                      type="button"
                      data-string={stringIndex}
                      data-fret={f}
                      aria-label={`${stringNames[stringIndex]} string fret ${f}, ${names[pcOf(midi)]}`}
                      className={
                        "fret-cell relative z-10 flex h-11 items-center justify-center border-l border-fret/40 " +
                        (INLAY_FRETS.has(f) ? "bg-white/[0.07]" : "")
                      }
                      onPointerDown={(e) => pressCell(e, stringIndex, f)}
                    >
                      {stringIndex === 1 && INLAY_FRETS.has(f) ? (
                        <span
                          className={
                            "pointer-events-none absolute left-1/2 top-full z-[1] flex -translate-x-1/2 -translate-y-1/2 " +
                            (DOUBLE_INLAY.has(f) ? "gap-1.5" : "")
                          }
                          aria-hidden
                        >
                          <span className="size-2.5 rounded-full bg-inlay/75" />
                          {DOUBLE_INLAY.has(f) ? (
                            <span className="size-2.5 rounded-full bg-inlay/75" />
                          ) : null}
                        </span>
                      ) : null}
                      <span
                        className={
                          "fret-dot relative z-10 flex items-center justify-center rounded-full font-mono font-semibold tracking-tight transition-transform " +
                          dotSize + " " + dotClass(midi, f, stringIndex)
                        }
                      >
                        {dotText(midi, stringIndex, f)}
                      </span>
                    </button>
                  );
                })}
                <span
                  className={
                    "string-wire pointer-events-none absolute top-1/2 right-0 z-[3] -translate-y-1/2 bg-string " +
                    (buzzing === stringIndex ? "string-buzz" : "")
                  }
                  style={{
                    height: stringThickness[stringIndex],
                    left: OPEN_COL,
                  }}
                  aria-hidden
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
