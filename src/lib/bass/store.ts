import { create } from "zustand";
import { isRunning, plugIn, pluck, setAmp, setTuning, silenceAll } from "./audio";
import { stopMetronome } from "./metronome";
import { GROOVES, type Groove } from "./grooves";
import type { ScaleId, TuningId } from "./theory";

export type BassState = {
  live: boolean;
  soundOn: boolean;
  volume: number;
  tone: number;
  drive: number;
  muted: boolean;
  showNotes: boolean;
  showKeys: boolean;
  metronome: boolean;
  tuningId: TuningId;
  scaleId: ScaleId;
  rootPc: number;
  grooveId: string | null;
  playing: boolean;
  playhead: number;
  lastNote: { string: number; fret: number; midi: number } | null;
  buzzing: number | null;
  beatOn: boolean;
  goLive: (opts?: { demo?: boolean }) => void;
  setVolume: (n: number) => void;
  setTone: (n: number) => void;
  setDrive: (n: number) => void;
  toggleMute: () => void;
  toggleNotes: () => void;
  toggleKeys: () => void;
  toggleMetronome: () => void;
  setTuningId: (id: TuningId) => void;
  setScaleId: (id: ScaleId) => void;
  setRootPc: (n: number) => void;
  setGrooveId: (id: string | null) => void;
  setPlaying: (v: boolean) => void;
  setPlayhead: (n: number) => void;
  setLastNote: (n: BassState["lastNote"]) => void;
  setBuzzing: (n: number | null) => void;
  setBeatOn: (v: boolean) => void;
  stopAll: () => void;
};

export const useBassStore = create<BassState>((set, get) => ({
  live: false,
  soundOn: false,
  volume: 0.82,
  tone: 0.62,
  drive: 0.18,
  muted: false,
  showNotes: true,
  showKeys: false,
  metronome: false,
  tuningId: "standard",
  scaleId: "minPent",
  rootPc: 4,
  grooveId: GROOVES[0]?.id ?? null,
  playing: false,
  playhead: -1,
  lastNote: null,
  buzzing: null,
  beatOn: false,
  goLive: (opts) => {
    const s = get();
    setAmp({
      volume: s.volume,
      tone: s.tone,
      drive: s.drive,
      muted: s.muted,
    });
    setTuning(s.tuningId);
    void plugIn().then((ok) => {
      set({ live: true, soundOn: ok || isRunning() });
      if (ok && opts?.demo) {
        pluck(0, 7);
        set({
          lastNote: { string: 0, fret: 7, midi: 62 },
          buzzing: 0,
        });
        window.setTimeout(() => {
          if (get().buzzing === 0) set({ buzzing: null });
        }, 320);
      }
    });
  },
  setVolume: (n) => {
    set({ volume: n });
    setAmp({ volume: n });
  },
  setTone: (n) => {
    set({ tone: n });
    setAmp({ tone: n });
  },
  setDrive: (n) => {
    set({ drive: n });
    setAmp({ drive: n });
  },
  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    setAmp({ muted });
  },
  toggleNotes: () => set({ showNotes: !get().showNotes }),
  toggleKeys: () => set({ showKeys: !get().showKeys }),
  toggleMetronome: () => set({ metronome: !get().metronome }),
  setTuningId: (id) => {
    set({ tuningId: id });
    setTuning(id);
  },
  setScaleId: (id) => set({ scaleId: id }),
  setRootPc: (n) => set({ rootPc: n }),
  setGrooveId: (id) => set({ grooveId: id, playhead: -1 }),
  setPlaying: (v) => set({ playing: v, playhead: v ? 0 : -1 }),
  setPlayhead: (n) => set({ playhead: n }),
  setLastNote: (n) => set({ lastNote: n }),
  setBuzzing: (n) => set({ buzzing: n }),
  setBeatOn: (v) => set({ beatOn: v }),
  stopAll: () => {
    silenceAll();
    stopMetronome();
    set({ playing: false, playhead: -1, buzzing: null, beatOn: false });
  },
}));

export function currentGroove(): Groove | undefined {
  const id = useBassStore.getState().grooveId;
  return GROOVES.find((g) => g.id === id);
}
