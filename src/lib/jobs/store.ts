import type { Job, JobStatusResponse } from "./types";

const jobs = new Map<string, Job>();

export function createJobId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function putJob(job: Job): void {
  jobs.set(job.jobId, job);
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, patch: Partial<Job>): Job | undefined {
  const cur = jobs.get(jobId);
  if (!cur) return undefined;
  const next: Job = { ...cur, ...patch, updatedAt: Date.now() };
  jobs.set(jobId, next);
  return next;
}

export function toStatusResponse(job: Job): JobStatusResponse {
  const res: JobStatusResponse = {
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
  };
  if (job.error) res.error = job.error;
  if (job.result) res.result = job.result;
  return res;
}
