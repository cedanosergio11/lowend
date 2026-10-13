import { createFileRoute, Link } from "@tanstack/react-router";
import { BassMark } from "@/components/studio/mark";
import { StudioNav } from "@/components/studio/studio-nav";
import { SongTabView } from "@/components/studio/song-tab";
import { Fretboard } from "@/components/studio/fretboard";
import { ScaleRail } from "@/components/studio/scale-rail";
import { MetronomePanel } from "@/components/studio/metronome-panel";

export const Route = createFileRoute("/song")({ component: SongPage });

function SongPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl min-w-0 flex-col gap-5 overflow-x-clip px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <BassMark className="size-10 text-fg" />
          <div>
            <p className="font-mono text-xs tracking-wider text-muted uppercase">Bass studio</p>
            <h1 className="font-display text-3xl leading-none tracking-wide text-fg">LOWEND</h1>
          </div>
        </Link>
        <StudioNav />
      </header>
      <SongTabView />
      <Fretboard />
      <div className="grid gap-4 lg:grid-cols-2">
        <ScaleRail />
        <MetronomePanel />
      </div>
    </div>
  );
}
