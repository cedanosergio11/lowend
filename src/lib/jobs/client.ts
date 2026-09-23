import type { JobCreateResponse, JobStatusResponse } from "./types";
import { ACCEPTED_EXTENSIONS } from "./types";

export function isAcceptedAudioFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export async function createJob(file: File): Promise<JobCreateResponse> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/jobs", { method: "POST", body });
  if (res.status === 413) {
    throw new Error("File longer than 8 minutes (or too large for the stub).");
  }
  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      detail = data.error ?? data.message ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return (await res.json()) as JobCreateResponse;
}

export async function getJob(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    throw new Error(`Job status failed (${res.status})`);
  }
  return (await res.json()) as JobStatusResponse;
}

export function tabDownloadUrl(jobId: string): string {
  return `/api/jobs/${encodeURIComponent(jobId)}/tab.txt`;
}
