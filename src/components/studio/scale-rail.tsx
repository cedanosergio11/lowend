import { Button } from "@/components/ui/button";
import { useBassStore } from "@/lib/bass/store";
import {
  ROOTS,
  SCALES,
  type FretLabelMode,
  type ScaleId,
} from "@/lib/bass/theory";

const SCALE_ORDER: ScaleId[] = [
  "off",
  "minPent",
  "blues",
  "dorian",
  "mixo",
  "minor",
  "major",
  "majPent",
];

const LABEL_MODES: { id: FretLabelMode; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "solfege", label: "Solfège" },
  { id: "both", label: "Both" },
];

export function ScaleRail() {
  const scaleId = useBassStore((s) => s.scaleId);
  const rootPc = useBassStore((s) => s.rootPc);
  const labelMode = useBassStore((s) => s.labelMode);
  const setScaleId = useBassStore((s) => s.setScaleId);
  const setRootPc = useBassStore((s) => s.setRootPc);
  const setLabelMode = useBassStore((s) => s.setLabelMode);

  return (
    <section
      className="rounded-xl bg-surface p-3 md:p-4"
      style={{ boxShadow: "var(--shadow-border)" }}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg tracking-wide text-fg">Neck map</h2>
        <p className="font-mono text-xs text-muted">
          {scaleId === "off"
            ? "All notes"
            : `${ROOTS[rootPc]?.name} ${SCALES[scaleId].label}`}
        </p>
      </div>

      <p className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">
        Root
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ROOTS.map((r) => (
          <Button
            key={r.pc}
            variant={rootPc === r.pc ? "primary" : "raised"}
            size="sm"
            className="min-w-10 px-2"
            onClick={() => setRootPc(r.pc)}
          >
            {r.name}
          </Button>
        ))}
      </div>

      <p className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">
        Scale
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {SCALE_ORDER.map((id) => (
          <Button
            key={id}
            variant={scaleId === id ? "primary" : "outline"}
            size="sm"
            onClick={() => setScaleId(id)}
          >
            {SCALES[id].label}
          </Button>
        ))}
      </div>

      <p className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">
        Labels
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LABEL_MODES.map((mode) => (
          <Button
            key={mode.id}
            variant={labelMode === mode.id ? "primary" : "outline"}
            size="sm"
            onClick={() => setLabelMode(mode.id)}
          >
            {mode.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[0.65rem] text-muted">
        Movable Do = Root. Solfège only on lit frets.
      </p>
    </section>
  );
}
