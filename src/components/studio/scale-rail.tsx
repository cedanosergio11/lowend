import { Button } from "@/components/ui/button";
import { useBassStore } from "@/lib/bass/store";
import { ROOTS, SCALES, type ScaleId } from "@/lib/bass/theory";

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

export function ScaleRail() {
  const scaleId = useBassStore((s) => s.scaleId);
  const rootPc = useBassStore((s) => s.rootPc);
  const setScaleId = useBassStore((s) => s.setScaleId);
  const setRootPc = useBassStore((s) => s.setRootPc);

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
      <div className="flex flex-wrap gap-1.5">
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
    </section>
  );
}
