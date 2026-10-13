import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ampInput, currentTime, plugIn, scheduleClick, setAmp } from "@/lib/bass/audio";
import { BassSynth } from "@/lib/bass/bass-synth";
import { EIGHTHS_PER_BAR, type SongTab } from "@/lib/bass/songs";
import {
  cursorAt,
  songToEvents,
  type CursorPosition,
  type NoteEvent,
  type PlaybackSpeed,
  type SongEvents,
} from "@/lib/bass/song-playback";
import { useBassStore } from "@/lib/bass/store";

/** Same look-ahead pattern as the metronome: 25 ms poll, 100 ms ahead on AudioContext time. */
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1;
const START_DELAY = 0.08;
const SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1];
const STRING_INDEX = { G: 0, D: 1, A: 2, E: 3 } as const;

export interface PlayerCursor extends CursorPosition {
  /** The note sounding right now, if any (for the fretboard). */
  note: NoteEvent | null;
}

/** Debug log of what was scheduled (verification only; capped). */
type SchedLog = { kind: "note" | "click"; idx: number; when: number; rel: number; midi?: number };
declare global {
  interface Window {
    __lowendSongDemo?: { eighthSec: number; t0: number; log: SchedLog[] };
  }
}

interface Session {
  synth: BassSynth;
  data: SongEvents;
  loop: boolean;
  /** AudioContext time where pass 0 begins. */
  t0: number;
  pass: number;
  nextEvent: number;
  nextClick: number;
  timer: ReturnType<typeof setTimeout> | null;
  raf: number | null;
}

export function SongPlayer({
  song,
  onCursor,
}: {
  song: SongTab;
  onCursor: (c: PlayerCursor | null) => void;
}) {
  const [sectionId, setSectionId] = useState<string>("");
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [clickOn, setClickOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Session | null>(null);
  const clickRef = useRef(clickOn);
  clickRef.current = clickOn;
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;
  const setLastNote = useBassStore((s) => s.setLastNote);
  const setBuzzing = useBassStore((s) => s.setBuzzing);

  const data = useMemo(
    () => songToEvents(song, { sectionId: sectionId || undefined, speed }),
    [song, sectionId, speed],
  );

  // Fretboard: light the sounding note via the shared store.
  const lastKey = useRef("");
  const onNote = (note: NoteEvent | null) => {
    const key = note ? `${note.string}-${note.fret}-${note.startSec}` : "";
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (!note) {
      setBuzzing(null);
      return;
    }
    const si = STRING_INDEX[note.string];
    setLastNote({ string: si, fret: note.fret, midi: note.midi });
    setBuzzing(si);
  };
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;
  function stop() {
    const s = session.current;
    if (!s) return;
    session.current = null;
    if (s.timer !== null) clearTimeout(s.timer);
    if (s.raf !== null) cancelAnimationFrame(s.raf);
    s.synth.dispose();
    // Restore the Amp rack's own drive (demo forces it clean while playing).
    setAmp({ drive: useBassStore.getState().drive });
    setPlaying(false);
    setElapsed(0);
    lastKey.current = "";
    setBuzzing(null);
    onCursorRef.current(null);
  }

  function schedule(s: Session) {
    const horizon = currentTime() + SCHEDULE_AHEAD;
    const { events, totalSeconds, totalEighths, eighthSec } = s.data;
    const log = window.__lowendSongDemo?.log;
    for (;;) {
      const passStart = s.t0 + s.pass * totalSeconds;
      const ev = events[s.nextEvent];
      const clickAt = passStart + s.nextClick * 2 * eighthSec;
      const evAt = ev ? passStart + ev.startSec : Infinity;
      const clickDue = s.nextClick * 2 < totalEighths && clickAt < horizon;
      const evDue = evAt < horizon;
      if (evDue && ev) {
        s.synth.scheduleNote(ev.midi, evAt, ev.durationSec);
        if (log && log.length < 400)
          log.push({ kind: "note", idx: s.nextEvent, when: evAt, rel: evAt - s.t0, midi: ev.midi });
        s.nextEvent++;
        continue;
      }
      if (clickDue) {
        // Quarter-note click; accent on beat 1 of each bar.
        if (clickRef.current)
          scheduleClick(clickAt, { accent: (s.nextClick * 2) % EIGHTHS_PER_BAR === 0 });
        if (log && log.length < 400) log.push({ kind: "click", idx: s.nextClick, when: clickAt, rel: clickAt - s.t0 });
        s.nextClick++;
        continue;
      }
      const passDone = s.nextEvent >= events.length && s.nextClick * 2 >= totalEighths;
      if (passDone && s.loop && passStart + totalSeconds < horizon) {
        s.pass++;
        s.nextEvent = 0;
        s.nextClick = 0;
        continue;
      }
      break;
    }
    s.timer = setTimeout(() => schedule(s), LOOKAHEAD_MS);
  }

  function frame(s: Session) {
    if (session.current !== s) return;
    const t = currentTime() - s.t0;
    const total = s.data.totalSeconds;
    if (!s.loop && t >= total) {
      stop();
      return;
    }
    const local = t < 0 ? 0 : s.loop ? t % total : t;
    const pos = cursorAt(s.data, local);
    const note = pos
      ? (s.data.events.find((e) => local >= e.startSec && local < e.startSec + e.durationSec) ?? null)
      : null;
    onCursorRef.current(pos ? { ...pos, note } : null);
    onNoteRef.current(note);
    setElapsed(local);
    s.raf = requestAnimationFrame(() => frame(s));
  }

  async function play() {
    setError(null);
    stop();
    const ok = await plugIn(); // user gesture -> resume AudioContext
    const amp = ok ? ampInput() : null;
    if (!amp) {
      setError("Audio is blocked. Tap Play again.");
      return;
    }
    // Demo plays clean: amp drive 0 (store/UI default is 0.18) so the synth isn't saturated.
    setAmp({ drive: 0 });
    const t0 = amp.audio.currentTime + START_DELAY;
    window.__lowendSongDemo = { eighthSec: data.eighthSec, t0, log: [] };
    const s: Session = {
      synth: new BassSynth(amp.audio, amp.input),
      data,
      loop: Boolean(sectionId),
      t0,
      pass: 0,
      nextEvent: 0,
      nextClick: 0,
      timer: null,
      raf: null,
    };
    session.current = s;
    setPlaying(true);
    schedule(s);
    s.raf = requestAnimationFrame(() => frame(s));
  }

  // Changing section/speed while playing restarts with the new settings.
  const restartKey = `${sectionId}|${speed}`;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (session.current) void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  // Clean stop on route change / unmount / tab hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, "0")}`;
  };
  const bpm = Math.round(song.bpm * speed);

  return (
    <div className="mt-4 rounded-lg bg-raised/60 p-3 ring-1 ring-accent/30" aria-label="Demo player">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          variant={playing ? "outline" : "primary"}
          onClick={() => (playing ? stop() : void play())}
          className="min-h-11 min-w-28"
          aria-pressed={playing}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Stop" : "Play demo"}
        </Button>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted uppercase">Section</span>
          <select
            className="min-h-11 rounded-md bg-bg px-2 text-fg ring-1 ring-white/10"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">Full song</option>
            {song.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (loop)
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1 rounded-md bg-bg p-1" role="group" aria-label="Speed">
          {SPEEDS.map((sp) => (
            <Button
              key={sp}
              size="sm"
              className="min-h-9"
              variant={speed === sp ? "primary" : "ghost"}
              onClick={() => setSpeed(sp)}
            >
              {sp * 100}%
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          className="min-h-9"
          variant={clickOn ? "primary" : "ghost"}
          onClick={() => setClickOn((v) => !v)}
          aria-pressed={clickOn}
        >
          Click {clickOn ? "on" : "off"}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
        <span className={cn(playing && "text-fg")}>
          {fmt(elapsed)} / {fmt(data.totalSeconds)}
        </span>
        <span>
          {bpm} BPM · 8th = {(data.eighthSec * 1000).toFixed(1)} ms
        </span>
        <span>Synth bass → Amp rack. Keep volume moderate.</span>
        {error ? <span className="text-red-300">{error}</span> : null}
      </div>
    </div>
  );
}
