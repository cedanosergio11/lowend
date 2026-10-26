import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setMetronomeBpm, setMetronomeTimeSig } from "@/lib/bass/metronome";
import { useBassStore } from "@/lib/bass/store";
import { SCALES, TUNINGS } from "@/lib/bass/theory";
import {
  SONGS,
  TAB_STRINGS,
  songPresets,
  toStandardTuning,
  type Confidence,
  type FormStep,
  type StandardCell,
  type TabCell,
  type TabSection,
} from "@/lib/bass/songs";

type View = "eb" | "standard";

const CONF_STYLE: Record<Confidence, string> = {
  low: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40",
  medium: "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/40",
  "medium-high": "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/40",
};

export const METRONOME_BPM_EVENT = "lowend:metronome-bpm";

const sectionAnchor = (id: string) => `song-section-${id}`;

export function SongTabView() {
  const song = SONGS[0];
  const [view, setView] = useState<View>("eb");
  const [applied, setApplied] = useState(false);
  const setTuningId = useBassStore((s) => s.setTuningId);
  const setRootPc = useBassStore((s) => s.setRootPc);
  const setScaleId = useBassStore((s) => s.setScaleId);
  // Tuning follows the song as soon as it opens (Pista 1 → E♭); presets only set tempo/key.
  const songTuningId = song?.tuningId;
  useEffect(() => {
    if (songTuningId) setTuningId(songTuningId);
  }, [songTuningId, setTuningId]);
  if (!song) return null;

  function applyPresets() {
    const p = songPresets(song!);
    setMetronomeBpm(p.bpm);
    setMetronomeTimeSig(`${song!.meter[0]}/${song!.meter[1]}` as "4/4");
    window.dispatchEvent(new CustomEvent(METRONOME_BPM_EVENT, { detail: p.bpm }));
    setRootPc(p.rootPc);
    setScaleId(p.scale);
    setApplied(true);
  }

  return (
    <section
      className="min-w-0 rounded-xl bg-surface p-3 md:p-5"
      style={{ boxShadow: "var(--shadow-border)" }}
    >
      <div className="mb-4 rounded-lg bg-amber-400/10 p-3 ring-1 ring-amber-400/40">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-amber-400 px-2 py-0.5 font-mono text-xs font-medium tracking-wider text-black uppercase">
            Estimated
          </span>
          <span className="text-xs text-amber-100/80">
            Machine-estimated from audio. Kept separate from official tabs.
          </span>
        </div>
        <ul className="ml-4 list-disc text-sm text-amber-50/90">
          {song.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wider text-muted uppercase">Song tab</p>
          <h2 className="font-display text-2xl leading-tight tracking-wide text-fg md:text-3xl">
            {song.title}
          </h2>
          <p className="text-sm text-muted">
            {song.artist} · {song.year}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-xs">
            <Chip>{song.bpm} BPM</Chip>
            <Chip>{song.meter.join("/")}</Chip>
            <Chip>
              Key {song.key.root} {song.key.mode} (estimated)
            </Chip>
            <span className="rounded-sm bg-accent px-2 py-1 font-medium text-accent-fg">
              Half step down: E♭ A♭ D♭ G♭
            </span>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2">
          <div className="flex gap-1 rounded-md bg-raised p-1" role="group" aria-label="Tuning view">
            <Button size="sm" variant={view === "eb" ? "primary" : "ghost"} onClick={() => setView("eb")}>
              E♭ tuning (as written)
            </Button>
            <Button
              size="sm"
              variant={view === "standard" ? "primary" : "ghost"}
              onClick={() => setView("standard")}
            >
              Standard (fret −1)
            </Button>
          </div>
          <Button variant="outline" onClick={applyPresets}>
            Apply presets
          </Button>
          {applied ? (
            <p className="font-mono text-xs text-muted">
              Metronome {song.bpm} · {song.key.root} {SCALES.minor.label} · {TUNINGS[song.tuningId].label} tuning
            </p>
          ) : null}
        </div>
      </div>

      {view === "standard" ? (
        <p className="mt-3 text-xs text-muted">
          Standard EADG view: every fret is one lower.{" "}
          <span className="text-red-300">✕</span> marks open-E♭ notes that can&apos;t be played in standard tuning.
        </p>
      ) : null}

      <div className="mt-4">
        <p className="mb-1.5 font-mono text-xs tracking-wide text-muted uppercase">Form (approx.)</p>
        <ol className="flex flex-col gap-1.5">
          {song.form.map((part) => (
            <li key={part.name} className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
              <span className="w-14 shrink-0 font-mono text-xs text-subtle">{part.name}</span>
              {part.steps.map((step, j) => (
                <FormChip key={j} step={step} name={song.sections.find((x) => x.id === step.sectionId)?.name} />
              ))}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 grid min-w-0 gap-3">
        {song.sections.map((s) => (
          <SectionCard key={s.name} section={s} view={view} />
        ))}
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-sm bg-raised px-2 py-1 text-fg">{children}</span>;
}

function SectionCard({ section, view }: { section: TabSection; view: View }) {
  return (
    <article id={sectionAnchor(section.id)} className="scroll-mt-4 min-w-0 rounded-lg bg-raised/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base tracking-wide text-fg">{section.name}</h3>
        <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[11px] uppercase", CONF_STYLE[section.confidence])}>
          {section.confidence}
        </span>
        {section.repeat ? (
          <span className="font-mono text-xs text-muted">{section.repeat}</span>
        ) : null}
      </div>
      <TabGrid section={section} view={view} />
      {section.notes.length ? (
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
          {section.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function FormChip({ step, name }: { step: FormStep; name?: string }) {
  const label = [
    name ?? (step.sectionId === "intro" ? "Intro" : step.sectionId === "end" ? "End" : step.sectionId),
    step.times ? `×${step.times}` : null,
    step.bars ? `${step.bars} bar${step.bars === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const inner = (
    <>
      <span className="text-fg">{label}</span>
      {step.note ? <span className="text-muted"> · {step.note}</span> : null}
    </>
  );
  const cls = "rounded-sm bg-raised px-1.5 py-0.5 font-mono text-xs";
  if (!name) return <span className={cls}>{inner}</span>;
  return (
    <a href={`#${sectionAnchor(step.sectionId)}`} className={cn(cls, "hover:bg-surface hover:ring-1 hover:ring-accent/50")}>
      {inner}
    </a>
  );
}

type Shown = StandardCell;

function isHold(c: Shown | undefined): boolean {
  return !!c && "hold" in c;
}

function TabGrid({ section, view }: { section: TabSection; view: View }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-md bg-bg p-2">
      <div className="inline-flex flex-col font-mono text-sm leading-6">
        {TAB_STRINGS.map((str) => {
          // Flatten the row so sustains can run across bar lines.
          const row: Shown[] = section.bars.flatMap((bar) =>
            bar[str].map((c: TabCell) => (view === "standard" ? toStandardTuning(c) : c)),
          );
          let k = 0;
          return (
            <div key={str} className="flex items-center whitespace-nowrap">
              <span className="w-4 text-muted">{str}</span>
              <span className="text-subtle">|</span>
              {section.bars.map((bar, bi) => (
                <Fragment key={bi}>
                  {bar[str].map((_, ci) => {
                    const i = k++;
                    return <Cell key={ci} cell={row[i]} sustainNext={isHold(row[i + 1])} />;
                  })}
                  <span className="text-subtle">|</span>
                </Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Horizontal sustain line, drawn from the struck note through held cells. */
function SustainLine({ from }: { from: "left" | "center" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-fg/80",
        from === "left" ? "-left-px -right-px" : "left-[70%] -right-px",
      )}
    />
  );
}

function Cell({ cell, sustainNext }: { cell: Shown; sustainNext: boolean }) {
  const base = "relative inline-block w-6 text-center";
  if (cell && "hold" in cell) {
    return (
      <span className={base} title="Hold (sustain)" aria-label="hold">
        <SustainLine from="left" />
        <span className="invisible">~</span>
      </span>
    );
  }
  if (cell && "unplayable" in cell) {
    return (
      <span
        className={cn(base, "font-medium text-red-400")}
        title="Open E♭ — can't be played in standard tuning (fret −1)"
        aria-label="unplayable in standard tuning"
      >
        ✕
      </span>
    );
  }
  if (cell === null) return <span className={cn(base, "text-subtle")}>-</span>;
  return (
    <span className={cn(base, "text-fg")}>
      {sustainNext ? <SustainLine from="center" /> : null}
      <span className="relative">{cell.fret}</span>
    </span>
  );
}
