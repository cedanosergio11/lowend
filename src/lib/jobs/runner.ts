import { analyzeUpload } from "./analyze";
import { getJob, updateJob } from "./store";

/** Fire-and-forget in-memory analysis for a queued job. */
export function enqueueAnalysis(jobId: string): void {
  // Defer so POST can return 201 first (avoid relying on bare Promise global in SSR bundles)
  setTimeout(() => {
    void runJob(jobId);
  }, 0);
}

async function runJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job || !job.bytes) {
    updateJob(jobId, {
      status: "failed",
      progress: 1,
      error: "Missing upload bytes",
      bytes: undefined,
    });
    return;
  }

  updateJob(jobId, { status: "running", progress: 0.15 });

  try {
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    updateJob(jobId, { progress: 0.45 });

    const result = analyzeUpload({
      bytes: job.bytes,
      fileName: job.fileName ?? "upload.bin",
      mimeType: job.mimeType ?? "",
    });

    updateJob(jobId, {
      status: "done",
      progress: 1,
      result,
      bytes: undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    updateJob(jobId, {
      status: "failed",
      progress: 1,
      error: message,
      bytes: undefined,
    });
  }
}
