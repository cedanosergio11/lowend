import { renderAscii } from "./ascii";
import type { BassStringIndex, JobNote, JobResult } from "./types";
import { MAX_DURATION_MS } from "./types";

/** Standard EADG open frequencies (Hz). String index E=0 … G=3. */
export const OPEN_HZ: readonly number[] = [
  41.20344461410874, 55.0, 73.41619197947974, 97.99885899543733,
];
export const BAND_LO = 40;
export const BAND_HI = 350;

export type DecodedAudio = {
  sampleRate: number;
  durationMs: number;
  samples: Float32Array;
};

/** Minimal PCM WAV decoder — returns null on corrupt / unsupported WAV. */
export function decodeWav(bytes: Uint8Array): DecodedAudio | null {
  if (bytes.byteLength < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (o: number, n: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(o, o + n)));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE") return null;
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= view.byteLength) {
    const id = ascii(offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (id === "fmt " && size >= 16) {
      audioFormat = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      sampleRate = view.getUint32(start + 4, true);
      bitsPerSample = view.getUint16(start + 14, true);
    } else if (id === "data") {
      dataOffset = start;
      dataSize = size;
      break;
    }
    offset = start + size + (size % 2);
  }
  if (dataOffset < 0 || sampleRate <= 0 || channels < 1) return null;
  if (audioFormat !== 1 || bitsPerSample !== 16) return null;
  const frameCount = Math.floor(dataSize / (2 * channels));
  if (frameCount <= 0) return null;
  const mono = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const pos = dataOffset + (i * channels + ch) * 2;
      sum += view.getInt16(pos, true) / 32768;
    }
    mono[i] = sum / channels;
  }
  return { sampleRate, durationMs: (frameCount / sampleRate) * 1000, samples: mono };
}

export function estimateDurationFromSize(byteLength: number, ext: string): number | null {
  const bitrate = ext === ".flac" ? 900_000 : ext === ".wav" ? 1_411_200 : 160_000;
  if (bitrate <= 0 || byteLength <= 0) return null;
  return (byteLength * 8 * 1000) / bitrate;
}

export function mapHzToFret(hz: number): { string: BassStringIndex; fret: number; conf: number } {
  let best: { string: BassStringIndex; fret: number; cents: number } | null = null;
  for (let s = 0; s < 4; s++) {
    const open = OPEN_HZ[s]!;
    const fretRound = Math.round(12 * Math.log2(hz / open));
    if (fretRound < 0 || fretRound > 24) continue;
    const targetHz = open * Math.pow(2, fretRound / 12);
    const cents = Math.abs(1200 * Math.log2(hz / targetHz));
    if (!best || cents < best.cents) best = { string: s as BassStringIndex, fret: fretRound, cents };
  }
  if (!best) return { string: 0, fret: 0, conf: 0.15 };
  return { string: best.string, fret: best.fret, conf: Math.max(0, Math.min(1, 1 - best.cents / 50)) };
}

function stubPlaceholderResult(durationMs: number, reason: string): JobResult {
  const dur = Math.max(1000, Math.min(durationMs || 4000, MAX_DURATION_MS));
  const notes: JobNote[] = [
    { string: 0, fret: 0, tMs: 0, durMs: 400, hz: OPEN_HZ[0]!, confidence: 0.2 },
    { string: 1, fret: 0, tMs: 1000, durMs: 400, hz: OPEN_HZ[1]!, confidence: 0.2 },
  ].filter((n) => n.tMs < dur - 200);
  return {
    label: "Estimated",
    tuning: "EADG",
    sampleRate: 44100,
    durationMs: Math.round(dur),
    notes,
    ascii: renderAscii(notes, dur),
    caveats: [
      "stub notes — not real pitch detection yet",
      `Decode unavailable (${reason}); placeholder notes only.`,
    ],
  };
}

export type AnalyzeInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

export function analyzeUpload(input: AnalyzeInput): JobResult {
  const lower = input.fileName.toLowerCase();
  const isWav =
    lower.endsWith(".wav") ||
    input.mimeType.includes("wav") ||
    input.mimeType.includes("wave");
  if (isWav) {
    const decoded = decodeWav(input.bytes);
    if (!decoded) return stubPlaceholderResult(4000, "corrupt or unsupported WAV");
    if (decoded.durationMs > MAX_DURATION_MS) {
      throw Object.assign(new Error("Audio longer than 8 minutes"), { code: 413 });
    }
    // Honest stub: WAV decodes for duration gate; note list is placeholder until full DSP lands.
    return stubPlaceholderResult(decoded.durationMs, "WAV decoded; pitch DSP deferred");
  }
  const ext =
    ([".mp3", ".m4a", ".flac", ".wav"] as const).find((e) => lower.endsWith(e)) ?? ".mp3";
  const est = estimateDurationFromSize(input.bytes.byteLength, ext) ?? 4000;
  return stubPlaceholderResult(est, `${ext} decode not implemented in V1 Node stub`);
}
