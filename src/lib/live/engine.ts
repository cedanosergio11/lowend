/** Live input audio graph. Browser-only; never connected to destination. */
export type LiveFrame = {
  hz: number;
  confidence: number;
  rmsDb: number;
  peakDb: number;
  onset: boolean;
  holding: boolean;
  /** Max |sample| over the hop, dBFS (clip warning ≥ -1). */
  samplePeakDb: number;
};

export type LiveSession = { stop: () => void; sampleRate: number; deviceLabel: string };

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

const PREFERRED = /focusrite|scarlett/i;

export async function listInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "audioinput");
}

export function pickDefault(devices: MediaDeviceInfo[]): string {
  return (devices.find((d) => PREFERRED.test(d.label)) ?? devices[0])?.deviceId ?? "";
}

/**
 * Start listening. `testHz` (dev only, ?livetest=) swaps getUserMedia for an
 * OscillatorNode feeding the same filter → worklet chain.
 */
export async function startLive(opts: {
  deviceId?: string;
  testHz?: number;
  onFrame: (f: LiveFrame) => void;
}): Promise<LiveSession> {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  let stream: MediaStream | null = null;
  let source: AudioNode;
  let osc: OscillatorNode | null = null;
  let deviceLabel = "";
  try {
    if (opts.testHz) {
      osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = opts.testHz;
      const g = ctx.createGain();
      g.gain.value = 0.25; // ≈ -15 dBFS RMS
      osc.connect(g);
      osc.start();
      source = g;
      deviceLabel = `Test tone ${opts.testHz} Hz`;
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...AUDIO_CONSTRAINTS,
          ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : {}),
        },
      });
      deviceLabel = stream.getAudioTracks()[0]?.label ?? "";
      source = ctx.createMediaStreamSource(stream);
    }

    const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: 30 });
    const lp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 1200 });
    await ctx.audioWorklet.addModule(new URL("./pitch-worklet.ts", import.meta.url));
    const node = new AudioWorkletNode(ctx, "lowend-pitch", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
    });
    node.port.onmessage = (e: MessageEvent<LiveFrame>) => opts.onFrame(e.data);
    source.connect(hp).connect(lp).connect(node);
    if (ctx.state === "suspended") await ctx.resume();

    return {
      sampleRate: ctx.sampleRate,
      deviceLabel,
      stop: () => {
        node.port.onmessage = null;
        osc?.stop();
        stream?.getTracks().forEach((t) => t.stop());
        void ctx.close();
      },
    };
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    void ctx.close();
    throw err;
  }
}
