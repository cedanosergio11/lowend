import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GROOVES,
  grooveById,
  hitsAt,
  totalSteps,
  type Groove,
} from "@/lib/bass/grooves";
import { useBassStore } from "@/lib/bass/store";
import { STRING_LABELS } from "@/lib/bass/theory";

export function GrooveDeck() {
  const grooveId = useBassStore((s) => s.grooveId);
  const playing = useBassStore((s) => s.playing);
  const playhead = useBassStore((s) => s.playhead);
  const setGrooveId = useBassStore((s) => s.setGrooveId);
  const setPlaying = useBassStore((s) => s.setPlaying);
  const goLive = useBassStore((s) => s.goLive);
  const live = useBassStore((s) => s.live);
  const stopAll = useBassStore((s) => s.stopAll);
  const groove = grooveById(grooveId);

  function togglePlay(id: string) {
    if (!live) goLive();
    if (grooveId === id && playing) {
      stopAll();
      return;
    }
    if (grooveId !== id) setGrooveId(id);
    setPlaying(true);
  }

  return (
    <section
      className="rounded-xl bg-surface p-3 md:p-4"
      style={{ boxShadow: "var(--shadow-border)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg tracking-wide text-fg">Grooves</h2>
        {playing ? (
          <Button variant="outline" size="sm" onClick={stopAll}>
            <Square className="size-3.5" />
            Stop
          </Button>
        ) : null}
      </div>

      <ul className="flex flex-col gap-1.5">
        {GROOVES.map((g) => {
          const on = g.id === grooveId;
          return (
            <li key={g.id}>
              <div
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2",
                  on ? "bg-raised" : "hover:bg-raised/60",
                )}
              >
                <Button
                  variant={on && playing ? "primary" : "outline"}
                  size="icon"
                  className="size-10 shrink-0"
                  aria-label={on && playing ? `Pause ${g.title}` : `Play ${g.title}`}
                  onClick={() => togglePlay(g.id)}
                >
                  {on && playing ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4 ml-px" />
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    if (!on) setGrooveId(g.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium text-fg">
                    {g.title}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted">
                    {g.artist} · {g.bpm} BPM
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {groove ? <TabPreview groove={groove} playhead={playhead} playing={playing} /> : null}
    </section>
  );
}

function TabPreview({
  groove,
  playhead,
  playing,
}: {
  groove: Groove;
  playhead: number;
  playing: boolean;
}) {
  const steps = totalSteps(groove);
  const cols = Math.min(steps, 32);
  const active = playing && playhead >= 0 ? hitsAt(groove, playhead) : [];

  return (
    <div className="mt-4 overflow-x-auto rounded-md bg-bg p-3">
      <p className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">
        Tab · loop {groove.bars} bar{groove.bars === 1 ? "" : "s"}
      </p>
      <div className="min-w-[20rem] font-mono text-xs tabular-nums">
        {STRING_LABELS.map((label, stringIndex) => (
          <div key={label} className="flex items-center gap-2 py-0.5">
            <span className="w-4 text-muted">{label}</span>
            <span className="flex flex-1 gap-px">
              {Array.from({ length: cols }, (_, step) => {
                const hit = groove.hits.find(
                  (h) => h.string === stringIndex && step >= h.at && step < h.at + h.len,
                );
                const onHead = playing && playhead === step;
                return (
                  <span
                    key={step}
                    className={
                      onHead
                        ? "inline-block w-4 text-center text-fg"
                        : hit
                          ? "inline-block w-4 text-center text-accent"
                          : "inline-block w-4 text-center text-border"
                    }
                  >
                    {hit ? hit.fret : "·"}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
