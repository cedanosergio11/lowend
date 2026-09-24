import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getMetronomeLatencyMs,
  onMetronomeStopped,
  setMetronomeBeatListener,
  setMetronomeBpm,
  setMetronomeSound,
  startMetronome,
  stopMetronome,
  type MetroSound,
  type TimeSig,
} from "@/lib/bass/metronome";
import { useBassStore } from "@/lib/bass/store";

const BPM_MIN = 40;
const BPM_MAX = 240;

export function MetronomePanel() {
  const live = useBassStore((s) => s.live);
  const goLive = useBassStore((s) => s.goLive);
  const [bpm, setBpm] = useState(100);
  const [sig, setSig] = useState<TimeSig>("4/4");
  const [sound, setSound] = useState<MetroSound>("click");
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    setMetronomeBeatListener((b) => {
      setBeat(b);
      window.setTimeout(() => setBeat(-1), 80);
    });
    return () => {
      setMetronomeBeatListener(null);
      stopMetronome();
    };
  }, []);

  useEffect(() => {
    return onMetronomeStopped(() => {
      setRunning(false);
      setBeat(-1);
    });
  }, []);

  async function toggle() {
    if (running) {
      stopMetronome();
      setRunning(false);
      setBeat(-1);
      return;
    }
    if (!live) goLive();
    const ok = await startMetronome({ bpm, timeSig: sig, sound });
    if (!ok) return;
    setRunning(true);
    setLatency(getMetronomeLatencyMs());
  }

  function onBpm(n: number) {
    const next = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(n)));
    setBpm(next);
    setMetronomeBpm(next);
  }

  function onSig(next: TimeSig) {
    setSig(next);
    if (running) {
      void startMetronome({ bpm, timeSig: next, sound });
    }
  }

  function onSound(next: MetroSound) {
    setSound(next);
    setMetronomeSound(next);
    if (running) {
      void startMetronome({ bpm, timeSig: sig, sound: next });
    }
  }

  const beats = sig === "3/4" ? 3 : 4;

  return (
    <section
      className="rounded-xl bg-surface p-3 md:p-4"
      style={{ boxShadow: "var(--shadow-border)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "beat-led size-2 rounded-full bg-border",
              beat === 0 && "on",
            )}
            aria-hidden
          />
          <h2 className="font-display text-lg tracking-wide text-fg">
            Metronome
          </h2>
        </div>
        <Button
          variant={running ? "primary" : "outline"}
          size="sm"
          onClick={() => void toggle()}
          aria-label={running ? "Stop metronome" : "Start metronome"}
        >
          {running ? (
            <>
              <Pause className="size-3.5" />
              Stop
            </>
          ) : (
            <>
              <Play className="size-3.5 ml-px" />
              Start
            </>
          )}
        </Button>
      </div>

      <div className="mb-4 flex gap-1.5" aria-hidden>
        {Array.from({ length: beats }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full bg-border transition-colors",
              beat === i && (i === 0 ? "bg-live" : "bg-accent"),
            )}
          />
        ))}
      </div>

      <div className="mb-4">
        <p className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">
          Sound
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["click", "Click"],
              ["kit", "Kit"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              variant={sound === id ? "primary" : "outline"}
              size="sm"
              onClick={() => onSound(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 flex items-baseline justify-between gap-2">
          <span className="font-mono text-xs tracking-wide text-muted uppercase">
            BPM
          </span>
          <span className="font-mono text-xs text-fg tabular-nums">{bpm}</span>
        </span>
        <input
          type="range"
          min={BPM_MIN}
          max={BPM_MAX}
          step={1}
          value={bpm}
          onChange={(e) => onBpm(Number(e.target.value))}
          aria-label="BPM"
        />
      </label>

      <div className="mt-4">
        <p className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">
          Time signature
        </p>
        <div className="flex flex-wrap gap-2">
          {(["4/4", "3/4"] as const).map((s) => (
            <Button
              key={s}
              variant={sig === s ? "primary" : "outline"}
              size="sm"
              onClick={() => onSig(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <p className="mt-4 font-mono text-xs text-muted">
        {sound === "kit"
          ? "Synth kit · kick/snare/hat · dry bus"
          : "Click · accent on 1 · dry bus"}
        {" · look-ahead ~25 ms"}
        {latency !== null ? ` · output ~${latency} ms` : ""}
        . No sample packs.
      </p>
    </section>
  );
}
