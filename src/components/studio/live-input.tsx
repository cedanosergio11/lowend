import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBassStore } from "@/lib/bass/store";
import { SCALES, STRING_LABELS, TUNINGS } from "@/lib/bass/theory";
import { pcOf, spellingFor } from "@/lib/bass/spelling";
import {
  listInputs,
  pickDefault,
  startLive,
  type LiveFrame,
  type LiveSession,
} from "@/lib/live/engine";
import { mapHz, type LiveReading, type Position } from "@/lib/live/pitch-map";

type Status = "idle" | "starting" | "listening" | "denied" | "nodevice" | "error";

const CLIP_DB = -1;
const GATE_DB = -50;
const METER_FLOOR_DB = -60;

/** Dev-only: `?livetest=41.2` drives the chain with an OscillatorNode instead of the mic. */
function testToneHz(): number | undefined {
  if (!import.meta.env.DEV || typeof window === "undefined") return undefined;
  const v = Number(new URLSearchParams(window.location.search).get("livetest"));
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

export function LiveInput() {
  const tuningId = useBassStore((s) => s.tuningId);
  const rootPc = useBassStore((s) => s.rootPc);
  const scaleId = useBassStore((s) => s.scaleId);
  const setLastNote = useBassStore((s) => s.setLastNote);
  const setBuzzing = useBassStore((s) => s.setBuzzing);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [frame, setFrame] = useState<LiveFrame | null>(null);
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [hz, setHz] = useState(0);

  const session = useRef<LiveSession | null>(null);
  const prevPos = useRef<Position | null>(null);
  const testHz = useMemo(testToneHz, []);

  const openMidi = TUNINGS[tuningId].openMidi;
  const names = spellingFor(rootPc, SCALES[scaleId].intervals);
  const ctxRef = useRef({ openMidi, names });
  ctxRef.current = { openMidi, names };

  function onFrame(f: LiveFrame) {
    setFrame(f);
    if (f.hz > 0) {
      const r = mapHz(f.hz, ctxRef.current.openMidi, ctxRef.current.names, prevPos.current);
      setReading(r);
      setHz(f.hz);
      if (r?.position) {
        const p = r.position;
        if (!prevPos.current || p.string !== prevPos.current.string || p.fret !== prevPos.current.fret) {
          setLastNote({ string: p.string, fret: p.fret, midi: r.midi });
          setBuzzing(p.string);
        }
        prevPos.current = p;
      }
    } else if (!f.holding) {
      setReading(null);
      setHz(0);
      setBuzzing(null);
    }
  }

  async function refreshDevices() {
    const list = await listInputs();
    setDevices(list);
    if (!deviceId || !list.some((d) => d.deviceId === deviceId)) setDeviceId(pickDefault(list));
    return list;
  }

  async function start(id = deviceId) {
    setStatus("starting");
    setError("");
    try {
      if (!testHz) {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus("nodevice");
          return;
        }
        const before = await listInputs();
        if (before.length === 0) {
          setStatus("nodevice");
          return;
        }
      }
      session.current = await startLive({ deviceId: id || undefined, testHz, onFrame });
      setStatus("listening");
      if (!testHz) {
        // Labels are only exposed after permission; re-pick Focusrite/Scarlett if we weren't on it.
        const list = await refreshDevices();
        const preferred = pickDefault(list);
        if (!id && preferred && session.current.deviceLabel && !/focusrite|scarlett/i.test(session.current.deviceLabel)) {
          const match = list.find((d) => d.deviceId === preferred);
          if (match && /focusrite|scarlett/i.test(match.label)) {
            stop();
            setDeviceId(preferred);
            void start(preferred);
          }
        }
      }
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setStatus("nodevice");
      else {
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  function stop() {
    session.current?.stop();
    session.current = null;
    prevPos.current = null;
    setFrame(null);
    setReading(null);
    setHz(0);
    setBuzzing(null);
    setStatus("idle");
  }

  useEffect(() => {
    void refreshDevices();
    const md = navigator.mediaDevices;
    const onChange = () => void refreshDevices();
    md?.addEventListener?.("devicechange", onChange);
    if (testHz) void start();
    return () => {
      md?.removeEventListener?.("devicechange", onChange);
      session.current?.stop();
      session.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listening = status === "listening";
  const level = frame?.rmsDb ?? METER_FLOOR_DB;
  const clipping = listening && (frame?.samplePeakDb ?? -200) >= CLIP_DB;
  const tooLow = listening && !clipping && level < GATE_DB;
  const cents = Math.round(reading?.cents ?? 0) || 0; // no "-0"
  const inTune = reading != null && Math.abs(cents) <= 5;

  const message =
    status === "denied"
      ? "Mic permission blocked — allow microphone for this site in the browser's address bar, then press Start."
      : status === "nodevice"
        ? "No audio input found — plug in your interface (Focusrite/Scarlett) and press Start."
        : status === "error"
          ? `Couldn't start audio — ${error}`
          : clipping
            ? "Clipping — turn the interface input gain down until the clip light stays off."
            : tooLow
              ? "Signal too low — raise the interface gain or play a little harder."
              : listening
                ? reading
                  ? "Listening — note detected."
                  : "Listening — play a single note."
                : status === "starting"
                  ? "Starting…"
                  : "Press Start listening and play a note.";
  const tone =
    status === "denied" || status === "nodevice" || status === "error" || clipping
      ? "text-red-400"
      : tooLow
        ? "text-amber-300"
        : "text-muted";

  const posText = reading?.position
    ? `${names[pcOf(openMidi[reading.position.string])] ?? STRING_LABELS[reading.position.string]} string · ${reading.position.fret === 0 ? "open" : `fret ${reading.position.fret}`}`
    : reading
      ? `Out of range for ${TUNINGS[tuningId].label} tuning`
      : "—";

  const meterPct = Math.max(0, Math.min(100, ((level - METER_FLOOR_DB) / -METER_FLOOR_DB) * 100));

  return (
    <section
      aria-labelledby="live-input-title"
      className="min-w-0 rounded-xl bg-surface p-3 md:p-5"
      style={{ boxShadow: "var(--shadow-border)" }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="live-input-title" className="font-display text-xl tracking-wide text-fg">
            Live input
          </h2>
          <p className="font-mono text-xs text-muted">
            Lag ≈ 60–100 ms — for checking notes, not timing.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 font-mono text-xs text-muted">
            Input device
            <select
              className="h-11 max-w-[14rem] rounded-md bg-raised px-2 text-sm text-fg"
              style={{ boxShadow: "var(--shadow-border)" }}
              value={deviceId}
              disabled={listening || !!testHz}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              {testHz ? <option value="">Test tone {testHz} Hz (dev)</option> : null}
              {!testHz && devices.length === 0 ? <option value="">No inputs yet</option> : null}
              {!testHz &&
                devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Input ${i + 1} (label after permission)`}
                  </option>
                ))}
            </select>
          </label>
          <Button
            size="md"
            className="min-w-40"
            aria-pressed={listening}
            disabled={status === "starting"}
            onClick={() => (listening ? stop() : void start())}
          >
            {listening ? "Stop listening" : "Start listening"}
          </Button>
        </div>
      </div>

      <p role="status" className={cn("mb-3 font-mono text-xs", tone)}>
        {message}
      </p>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex items-center gap-4 rounded-lg bg-raised p-3">
          <div
            aria-live="polite"
            aria-atomic="true"
            aria-label={reading ? `Note ${reading.name}${reading.octave}, ${cents > 0 ? "+" : ""}${cents.toFixed(0)} cents` : "No note"}
            className={cn(
              "flex size-24 shrink-0 items-center justify-center rounded-full font-display text-5xl",
              inTune ? "bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-400" : "bg-surface text-fg ring-1 ring-fg/20",
            )}
          >
            {reading ? reading.name : "–"}
            {reading ? <sub className="ml-0.5 font-mono text-base text-muted">{reading.octave}</sub> : null}
          </div>
          <div className="min-w-0 font-mono">
            <p className={cn("text-3xl tabular-nums", inTune ? "text-emerald-300" : "text-fg")}>
              {reading ? `${cents > 0 ? "+" : ""}${cents.toFixed(0)}¢` : "—"}
            </p>
            <p className="text-sm tabular-nums text-muted">{hz > 0 ? `${hz.toFixed(1)} Hz` : "— Hz"}</p>
            <p className="truncate text-xs text-muted">{posText}</p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[0.65rem] text-muted">
              <span>-50¢</span><span>0</span><span>+50¢</span>
            </div>
            <div
              role="meter"
              aria-label="Tuning, cents off"
              aria-valuemin={-50}
              aria-valuemax={50}
              aria-valuenow={reading ? Math.round(cents) : 0}
              className="relative h-6 rounded-sm bg-raised"
            >
              <div className="absolute inset-y-0 rounded-sm bg-emerald-500/25" style={{ left: "45%", width: "10%" }} />
              <div className="absolute inset-y-0 left-1/2 w-px bg-fg/40" />
              <div
                className={cn(
                  "absolute inset-y-[-3px] w-1 -translate-x-1/2 rounded-full transition-[left] duration-75",
                  !reading ? "bg-fg/20" : inTune ? "bg-emerald-400" : "bg-accent",
                )}
                style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[0.65rem] text-muted">
              <span>Input {listening ? `${level.toFixed(1)} dBFS` : "— dBFS"}</span>
              <span className={clipping ? "text-red-400" : ""}>{clipping ? "CLIP" : "clip ≥ -1 dBFS"}</span>
            </div>
            <div
              role="meter"
              aria-label="Input level, dBFS"
              aria-valuemin={METER_FLOOR_DB}
              aria-valuemax={0}
              aria-valuenow={Math.round(level)}
              className="relative h-3 overflow-hidden rounded-sm bg-raised"
            >
              <div
                className={cn("absolute inset-y-0 left-0", clipping ? "bg-red-500" : level < GATE_DB ? "bg-amber-400/70" : "bg-emerald-500")}
                style={{ width: `${meterPct}%` }}
              />
              <div className="absolute inset-y-0 w-px bg-fg/50" style={{ left: `${((GATE_DB - METER_FLOOR_DB) / -METER_FLOOR_DB) * 100}%` }} />
            </div>
          </div>
          <p className="font-mono text-xs tabular-nums text-muted">
            Confidence {frame && frame.confidence > 0 ? frame.confidence.toFixed(2) : "—"} · {TUNINGS[tuningId].label} tuning
          </p>
        </div>
      </div>
    </section>
  );
}
