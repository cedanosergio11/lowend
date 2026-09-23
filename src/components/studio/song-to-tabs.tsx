import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  analyzeFileInBrowser,
  downloadAsciiTab,
} from "@/lib/jobs/browser-analyze";
import { isAcceptedAudioFile } from "@/lib/jobs/client";
import type { JobResult } from "@/lib/jobs/types";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "done" | "failed";

const ACCEPT = ".wav,.mp3,.m4a,.flac,audio/wav,audio/mpeg,audio/mp4,audio/flac";

export function SongToTabs() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const busy = phase === "running";

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(0);
    setFileName(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const startWithFile = useCallback(async (file: File) => {
    if (busy) return;
    if (!isAcceptedAudioFile(file)) {
      setError("Use wav, mp3, m4a, or flac.");
      setPhase("failed");
      return;
    }
    setError(null);
    setResult(null);
    setFileName(file.name);
    setPhase("running");
    setProgress(0.05);
    try {
      const out = await analyzeFileInBrowser(file, setProgress);
      setResult(out);
      setPhase("done");
      setProgress(1);
    } catch (e) {
      setPhase("failed");
      setError(e instanceof Error ? e.message : "Analysis failed");
    }
  }, [busy]);

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (file) void startWithFile(file);
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-wider text-muted uppercase">
            Song → tabs
          </p>
          <h2 className="font-display mt-1 text-xl tracking-wide text-fg">
            Upload a track, get estimated bass tabs
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Runs in your browser on this page (wav / mp3 / m4a / flac, ≤8 min).
            Not an official tab. Apple Music links are not audio — upload stays
            required.
          </p>
        </div>
        {result || error ? (
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
            New upload
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-raised/60 px-4 py-6 text-center transition-colors",
          dragOver && "border-accent bg-raised",
          busy && "pointer-events-none opacity-60",
        )}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onPick(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Upload audio file"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => onPick(e.target.files)}
        />
        <p className="text-sm text-fg">
          {busy
            ? `Working${fileName ? ` · ${fileName}` : ""}…`
            : "Drop a song here or click to choose"}
        </p>
        <p className="font-mono text-xs text-subtle">
          wav · mp3 · m4a · flac · max 8 minutes · in-browser
        </p>
      </div>

      {busy ? (
        <div className="mt-4">
          <div className="mb-1 flex justify-between font-mono text-xs text-muted">
            <span className="uppercase tracking-wider">analyzing</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          className="mt-4 rounded-md border border-border bg-raised px-3 py-2 text-sm text-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-raised px-2 py-1 font-mono text-xs tracking-wider text-fg uppercase">
              {result.label}
            </span>
            <span className="font-mono text-xs text-muted">
              {result.tuning} · {(result.durationMs / 1000).toFixed(1)}s ·{" "}
              {result.notes.length} notes
            </span>
            <Button
              size="sm"
              className="ml-auto"
              onClick={() =>
                downloadAsciiTab(result.ascii, fileName ?? "lowend")
              }
            >
              Download .txt
            </Button>
          </div>

          {result.caveats.length > 0 ? (
            <ul className="rounded-md border border-border bg-raised/80 px-3 py-2 text-sm text-muted">
              {result.caveats.map((c) => (
                <li key={c} className="list-inside list-disc">
                  {c}
                </li>
              ))}
            </ul>
          ) : null}

          <pre
            className="overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-fg md:text-sm"
            aria-label="Estimated bass tab ASCII"
          >
            {result.ascii}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
