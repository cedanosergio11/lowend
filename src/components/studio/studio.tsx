import { useEffect, useRef } from "react";
import { BassMark } from "@/components/studio/mark";
import { Fretboard } from "@/components/studio/fretboard";
import { AmpRack } from "@/components/studio/amp-rack";
import { ScaleRail } from "@/components/studio/scale-rail";
import { GrooveDeck } from "@/components/studio/groove-deck";
import { SongToTabs } from "@/components/studio/song-to-tabs";
import { Button } from "@/components/ui/button";
import { click, currentTime, plugIn, pluck, resumeIfNeeded } from "@/lib/bass/audio";
import { grooveById, totalSteps } from "@/lib/bass/grooves";
import { useBassStore } from "@/lib/bass/store";
import { KEY_MAP, TUNINGS, fretMidi } from "@/lib/bass/theory";

export function Studio() {
  const live = useBassStore((s) => s.live);
  const soundOn = useBassStore((s) => s.soundOn);
  const goLive = useBassStore((s) => s.goLive);
  const playing = useBassStore((s) => s.playing);
  const grooveId = useBassStore((s) => s.grooveId);
  const metronome = useBassStore((s) => s.metronome);
  const showKeys = useBassStore((s) => s.showKeys);
  const tuningId = useBassStore((s) => s.tuningId);
  const setPlaying = useBassStore((s) => s.setPlaying);
  const setPlayhead = useBassStore((s) => s.setPlayhead);
  const setLastNote = useBassStore((s) => s.setLastNote);
  const setBuzzing = useBassStore((s) => s.setBuzzing);
  const setBeatOn = useBassStore((s) => s.setBeatOn);
  const stopAll = useBassStore((s) => s.stopAll);

  const loopRef = useRef<{
    start: number;
    lastStep: number;
    lastBeat: number;
    lastPulse: boolean;
  } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        const state = useBassStore.getState();
        if (state.playing) state.stopAll();
        else if (state.grooveId) {
          if (!state.live) state.goLive();
          state.setPlaying(true);
        }
        return;
      }
      if (e.key === "Escape") {
        stopAll();
        return;
      }
      const loc = KEY_MAP[e.key.toLowerCase()] ?? KEY_MAP[e.key];
      if (!loc) return;
      e.preventDefault();
      const state = useBassStore.getState();
      if (!state.live) state.goLive();
      pluck(loc.string, loc.fret);
      const midi = fretMidi(TUNINGS[state.tuningId].openMidi, loc.string, loc.fret);
      setLastNote({ string: loc.string, fret: loc.fret, midi });
      setBuzzing(loc.string);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setBuzzing, setLastNote, stopAll]);

  useEffect(() => {
    if (!playing) {
      loopRef.current = null;
      setBeatOn(false);
      return;
    }
    const groove = grooveById(grooveId);
    if (!groove) {
      setPlaying(false);
      return;
    }
    plugIn();
    resumeIfNeeded();
    const steps = totalSteps(groove);
    const sixteenth = 60 / groove.bpm / 4;
    const start = currentTime() + 0.06;
    loopRef.current = { start, lastStep: -1, lastBeat: -1 };

    let raf = 0;
    const fired = new Set<string>();

    function tick() {
      const state = useBassStore.getState();
      if (!state.playing) return;
      const g = grooveById(state.grooveId);
      if (!g || !loopRef.current) return;
      const now = currentTime();
      const elapsed = now - loopRef.current.start;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const loopLen = steps * sixteenth;
      const pos = elapsed % loopLen;
      const step = Math.min(steps - 1, Math.floor(pos / sixteenth));
      if (step !== loopRef.current.lastStep) {
        loopRef.current.lastStep = step;
        setPlayhead(step);
        for (const hit of g.hits) {
          const key = `${hit.at}-${hit.string}-${hit.fret}`;
          const inWindow = step === hit.at;
          if (inWindow && !fired.has(key)) {
            fired.add(key);
            pluck(hit.string, hit.fret);
            const midi = fretMidi(
              TUNINGS[state.tuningId].openMidi,
              hit.string,
              hit.fret,
            );
            setLastNote({ string: hit.string, fret: hit.fret, midi });
            setBuzzing(hit.string);
          }
        }
        if (step === 0) fired.clear();
        const beat = Math.floor(step / (g.grid / 4));
        if (beat !== loopRef.current.lastBeat) {
          loopRef.current.lastBeat = beat;
          if (state.metronome) click(0.15);
          setBeatOn(true);
          window.setTimeout(() => setBeatOn(false), 80);
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [
    playing,
    grooveId,
    setBeatOn,
    setBuzzing,
    setLastNote,
    setPlayhead,
    setPlaying,
  ]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BassMark className="size-10 text-fg" />
          <div>
            <p className="font-mono text-xs tracking-wider text-muted uppercase">
              Bass studio
            </p>
            <h1 className="font-display text-3xl leading-none tracking-wide text-fg">
              LOWEND
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {live ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-md bg-raised px-4 font-mono text-xs tracking-wider text-fg uppercase">
              <span className="beat-led size-2 rounded-full bg-live on" />
              Live{showKeys ? " · keys" : ""}
            </span>
          ) : (
            <Button
              onClick={() => goLive({ demo: true })}
              className="h-11"
            >
              Plug in the amp
            </Button>
          )}
        </div>
      </header>

      <section>
        <h1 className="font-display text-3xl leading-none tracking-wide text-fg md:text-4xl">
          Feel the neck. Hear the room.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted md:text-base">
          Four-string bass with scales, grooves, and a Web Audio amp. Tap a fret
          to plug in. Drag for hammer-ons. Space plays the selected groove.
        </p>
        {!live ? (
          <Button
            size="lg"
            className="mt-4 h-14 w-full max-w-sm text-base"
            onClick={() => goLive({ demo: true })}
          >
            Plug in the amp
          </Button>
        ) : null}
      </section>

      <SongToTabs />

      <Fretboard />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          <AmpRack />
          <ScaleRail />
        </div>
        <GrooveDeck />
      </div>
    </div>
  );
}
