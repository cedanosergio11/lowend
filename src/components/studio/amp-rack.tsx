import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pluck } from "@/lib/bass/audio";
import { useBassStore } from "@/lib/bass/store";
import { STRING_LABELS, TUNINGS, noteName } from "@/lib/bass/theory";

export function AmpRack() {
  const live = useBassStore((s) => s.live);
  const goLive = useBassStore((s) => s.goLive);
  const volume = useBassStore((s) => s.volume);
  const tone = useBassStore((s) => s.tone);
  const drive = useBassStore((s) => s.drive);
  const muted = useBassStore((s) => s.muted);
  const setVolume = useBassStore((s) => s.setVolume);
  const setTone = useBassStore((s) => s.setTone);
  const setDrive = useBassStore((s) => s.setDrive);
  const toggleMute = useBassStore((s) => s.toggleMute);
  const tuningId = useBassStore((s) => s.tuningId);
  const setTuningId = useBassStore((s) => s.setTuningId);
  const showNotes = useBassStore((s) => s.showNotes);
  const showKeys = useBassStore((s) => s.showKeys);
  const metronome = useBassStore((s) => s.metronome);
  const toggleNotes = useBassStore((s) => s.toggleNotes);
  const toggleKeys = useBassStore((s) => s.toggleKeys);
  const toggleMetronome = useBassStore((s) => s.toggleMetronome);
  const beatOn = useBassStore((s) => s.beatOn);
  const lastNote = useBassStore((s) => s.lastNote);
  const setLastNote = useBassStore((s) => s.setLastNote);
  const setBuzzing = useBassStore((s) => s.setBuzzing);

  const open = TUNINGS[tuningId].openMidi;

  function playOpen(stringIndex: number) {
    if (!live) goLive();
    pluck(stringIndex, 0);
    setLastNote({
      string: stringIndex,
      fret: 0,
      midi: open[stringIndex],
    });
    setBuzzing(stringIndex);
  }

  return (
    <section
      className="rounded-xl bg-surface p-3 md:p-4"
      style={{ boxShadow: "var(--shadow-border)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn("beat-led size-2 rounded-full bg-border", beatOn && "on")}
            aria-hidden
          />
          <h2 className="font-display text-lg tracking-wide text-fg">Amp</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={muted ? "primary" : "outline"}
            size="icon"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SliderField
          label="Volume"
          value={volume}
          display={`${Math.round(volume * 10)}`}
          onChange={setVolume}
        />
        <SliderField
          label="Tone"
          value={tone}
          display={tone < 0.33 ? "Dark" : tone > 0.7 ? "Bright" : "Round"}
          onChange={setTone}
        />
        <SliderField
          label="Drive"
          value={drive}
          display={drive < 0.2 ? "Clean" : drive > 0.65 ? "Grit" : "Warm"}
          onChange={setDrive}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">
            Tuning
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.values(TUNINGS) as Array<(typeof TUNINGS)[keyof typeof TUNINGS]>).map(
              (t) => (
                <Button
                  key={t.id}
                  variant={tuningId === t.id ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setTuningId(t.id)}
                >
                  {t.label}
                </Button>
              ),
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">
            Open strings
          </p>
                    <div className="flex flex-wrap gap-2">
            {STRING_LABELS.map((label, i) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                onClick={() => playOpen(i)}
              >
                {label}
                <span className="ml-1 font-mono text-xs text-muted">
                  {noteName(open[i])}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant={showNotes ? "primary" : "outline"}
          size="sm"
          onClick={toggleNotes}
        >
          Notes
        </Button>
        <Button
          variant={showKeys ? "primary" : "outline"}
          size="sm"
          onClick={toggleKeys}
        >
          Keys
        </Button>
        <Button
          variant={metronome ? "primary" : "outline"}
          size="sm"
          onClick={toggleMetronome}
        >
          Click
        </Button>
      </div>

      {lastNote ? (
        <p className="mt-4 font-mono text-xs text-muted">
          Last: {STRING_LABELS[lastNote.string]} fret {lastNote.fret} ·{" "}
          {noteName(lastNote.midi)}
        </p>
      ) : null}
    </section>
  );
}

function SliderField({
  label,
  value,
  display,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs tracking-wide text-muted uppercase">
          {label}
        </span>
        <span className="font-mono text-xs text-fg">{display}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </label>
  );
}
