/**
 * LOWEND V1 jobs API types — locked contract fields (do not rename).
 *
 * String index: E=0, A=1, D=2, G=3
 * ASCII always G top → E bottom (`G|` `D|` `A|` `E|`), frets as decimal digits, time left→right.
 */

export type JobStatus = "queued" | "running" | "done" | "failed";

/** Contract string indices (pitch-low to high). */
export const STRING_INDEX = {
  E: 0,
  A: 1,
  D: 2,
  G: 3,
} as const;

export type BassStringIndex = 0 | 1 | 2 | 3;

export type JobNote = {
  string: BassStringIndex;
  fret: number; // 0–24
  tMs: number;
  durMs: number;
  hz: number;
  confidence: number; // 0–1
};

export type JobResult = {
  label: "Estimated";
  tuning: "EADG";
  sampleRate: number;
  durationMs: number;
  notes: JobNote[];
  ascii: string;
  caveats: string[];
};

export type Job = {
  jobId: string;
  status: JobStatus;
  progress: number; // 0–1
  error?: string;
  result?: JobResult;
  createdAt: number;
  updatedAt: number;
  /** Original upload metadata (not exposed in GET). */
  fileName?: string;
  mimeType?: string;
  /** Raw bytes kept briefly for analysis (in-memory stub). */
  bytes?: Uint8Array;
};

export type JobCreateResponse = {
  jobId: string;
  status: "queued";
};

export type JobStatusResponse = {
  jobId: string;
  status: JobStatus;
  progress: number;
  error?: string;
  result?: JobResult;
};

export const MAX_DURATION_MS = 8 * 60 * 1000;
export const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".m4a", ".flac"] as const;
export const ACCEPTED_MIME_PREFIXES = [
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/flac",
  "audio/x-flac",
] as const;
