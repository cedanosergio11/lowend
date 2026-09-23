import { analyzeDecoded, type DecodedAudio } from "./analyze";
import { MAX_DURATION_MS, type JobResult } from "./types";

function resampleMono(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = src - i0;
    out[i] = samples[i0]! * (1 - frac) + samples[i1]! * frac;
  }
  return out;
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const len = buffer.length;
  const chs = buffer.numberOfChannels;
  const mono = new Float32Array(len);
  for (let c = 0; c < chs; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i]! += data[i]! / chs;
  }
  return mono;
}

/**
 * Pages / client path: decode with Web Audio, then same band-limit → onset →
 * pitch → fret map as the server stub (analyzeDecoded).
 */
export async function analyzeFileInBrowser(
  file: File,
  onProgress?: (p: number) => void,
): Promise<JobResult> {
  onProgress?.(0.08);
  const ac = new AudioContext({ sampleRate: 44100 });
  try {
    const ab = await file.arrayBuffer();
    onProgress?.(0.25);
    let audioBuf: AudioBuffer;
    try {
      audioBuf = await ac.decodeAudioData(ab.slice(0));
    } catch {
      throw new Error("Could not decode that file. Try wav or mp3.");
    }
    onProgress?.(0.45);

    const durationMs = audioBuf.duration * 1000;
    if (!(durationMs > 0)) {
      throw new Error("Empty or unreadable audio.");
    }
    if (durationMs > MAX_DURATION_MS) {
      throw new Error("File longer than 8 minutes.");
    }

    const mono = mixToMono(audioBuf);
    const at441 = resampleMono(mono, audioBuf.sampleRate, 44100);
    const decoded: DecodedAudio = {
      sampleRate: 44100,
      durationMs,
      samples: at441,
    };

    onProgress?.(0.7);
    // Yield so the progress bar can paint before sync DSP.
    await new Promise<void>((r) => setTimeout(r, 0));
    const raw = analyzeDecoded(decoded);
    onProgress?.(0.95);

    const caveats = [
      "Estimated — analyzed in your browser from the file you uploaded (not an official tab).",
      "Band-limit ~40–350 Hz → energy onset → autocorrelation pitch → EADG fret map (prefer frets 0–12 on ties).",
      "No stem separation. Busy mixes, slap ghosts, and chords lower confidence.",
    ];
    if (raw.notes.length === 0) {
      caveats.push("No clear bass-band onsets detected; empty note list.");
    }

    onProgress?.(1);
    return {
      ...raw,
      sampleRate: 44100,
      caveats,
    };
  } finally {
    await ac.close().catch(() => undefined);
  }
}

export function downloadAsciiTab(ascii: string, baseName: string): void {
  const blob = new Blob([ascii + "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName.replace(/\.[^.]+$/, "") || "lowend"}-bass.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
