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
  noteName,
  scaleDegree,
  SCALES,
} from "@/lib/bass/theory";
import { pluck } from "@/lib/bass/audio";
import { useBassStore } from "@/lib/bass/store";
import { grooveById, hitsAt } from "@/lib/bass/grooves";

const WIDTHS = fretWidths(FRET_COUNT);

const FRET_TEMPLATE = `2.75rem 2.5rem ${WIDTHS.map((w) => `minmax(2.4rem, ${w.toFixed(5)}fr)`).join(" ")}`;

const STRING_KEYS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";"],
  ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"],
];

function invertKeyMap() {
  const out: Record<string, string> = {};
  for (const [key, loc] of Object.entries(KEY_MAP)) {
    out[`${loc.string}-${loc.fret}`] = key.length === 1 ? key.toUpperCase() : key;
  }
  return out;
}

const KEY_AT = invertKeyMap();

export function Fretboard() {
  const live = useBassStore((s) => s.live);
  const goLive = useBassStore((s) => s.goLive);
  const tuningId = useBassStore((s) => s.tuningId);
  const showNotes = useBassStore((s) => s.showNotes);
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

  return (
    <div className="w-full">
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <p className="font-mono text-xs tracking-wide text-muted uppercase">
          {TUNINGS[tuningId].label} · {STRING_LABELS.slice().reverse().join(" ")}
        </p>
        <p className="font-mono text-xs tabular-nums text-muted">
          {lastNote
            ? `${STRING_LABELS[lastNote.string]} ${lastNote.fret === 0 ? "open" : lastNote.fret} · ${noteName(lastNote.midi)}`
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
          className="relative overflow-hidden rounded-lg select-none"
          style={{
            minWidth: "52rem",
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.35), transparent 6%, transparent 94%, rgba(0,0,0,0.4)), linear-gradient(180deg, var(--color-wood) 0%, var(--color-wood-mid) 48%, var(--color-wood-dark) 100%)",
          }}
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
          <div className="grid" style={{ gridTemplateColumns: FRET_TEMPLATE }}>
            <div className="flex items-center justify-center font-mono text-xs text-muted">
              #
            </div>
            <div className="flex items-center justify-center rounded-xs bg-nut font-mono text-xs text-bg">
              0
            </div>
            {Array.from({ length: FRET_COUNT }, (_, fret) => (
              <div
                key={fret}
                className="relative flex items-center justify-center border-l border-fret/40 py-1 font-mono text-[0.65rem] text-muted"
              >
                {fret + 1}
                {INLAY_FRETS.has(fret + 1) ? (
                  <span
                    className={
                      DOUBLE_INLAY.has(fret + 1)
                        ? "absolute bottom-1 flex gap-1"
                        : "absolute bottom-1"
                    }
                  >
                    <span className="size-1.5 rounded-full bg-inlay/80" />
                    {DOUBLE_INLAY.has(fret + 1) ? (
                      <span className="size-1.5 rounded-full bg-inlay/80" />
                    ) : null}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          {Array.from({ length: STRING_COUNT }, (_, stringIndex) => (
            <div
              key={stringIndex}
              className="relative grid"
              style={{ gridTemplateColumns: FRET_TEMPLATE }}
            >
              <div className="fret-dot flex size-8 items-center justify-center justify-self-center rounded-xs bg-nut text-xs font-mono text-bg">
                {STRING_LABELS[stringIndex]}
              </div>
              <button
                type="button"
                data-string={stringIndex}
                data-fret={0}
                className="fret-cell relative z-10 flex h-11 items-center justify-center"
                onPointerDown={(e) => pressCell(e, stringIndex, 0)}
              >
                <span
                  className={
                    "fret-dot relative z-10 flex size-7 items-center justify-center rounded-full text-[0.65rem] font-mono " +
                    (lastNote?.string === stringIndex && lastNote.fret === 0
                      ? "bg-live text-bg"
                      : "text-muted")
                  }
                >
                  {showNotes ? noteName(openMidi[stringIndex]) : showKeys ? KEY_AT[`${stringIndex}-0`] ?? "" : ""}
                </span>
              </button>
              {Array.from({ length: FRET_COUNT }, (_, fret) => {
                const f = fret + 1;
                const midi = fretMidi(openMidi, stringIndex, f);
                const deg = scaleDegree(midi, rootPc, intervals);
                const active =
                  lastNote?.string === stringIndex && lastNote.fret === f;
                const grooveHit = activeHits.some(
                  (h) => h.string === stringIndex && h.fret === f,
                );
                return (
                  <button
                    key={f}
                    type="button"
                    data-string={stringIndex}
                    data-fret={f}
                    className="fret-cell relative z-10 flex h-11 items-center justify-center border-l border-fret/30"
                    onPointerDown={(e) => pressCell(e, stringIndex, f)}
                  >
                    <span
                      className={
                        "fret-dot relative z-10 flex size-7 items-center justify-center rounded-full text-[0.65rem] font-mono " +
                        (active || grooveHit
                          ? "bg-live text-bg"
                          : deg === 0
                            ? "bg-accent/90 text-accent-fg"
                            : deg != null
                              ? "bg-raised text-fg"
                              : "text-transparent")
                      }
                    >
                      {showNotes
                        ? noteName(midi).replace(/\d+$/, "")
                        : showKeys
                          ? KEY_AT[`${stringIndex}-${f}`] ?? ""
                          : deg != null
                            ? "•"
                            : ""}
                    </span>
                  </button>
                );
              })}
              <span
                className={
                  "string-wire pointer-events-none absolute top-1/2 right-0 left-12 z-0 -translate-y-1/2 bg-string " +
                  (buzzing === stringIndex ? "string-buzz" : "")
                }
                style={{ height: stringThickness[stringIndex] }}
                aria-hidden
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
