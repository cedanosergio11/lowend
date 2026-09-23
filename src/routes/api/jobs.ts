import { createFileRoute } from "@tanstack/react-router";
import {
  createJobId,
  enqueueAnalysis,
  putJob,
  validateUpload,
  type Job,
  type JobCreateResponse,
} from "@/lib/jobs";

export const Route = createFileRoute("/api/jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json(
            { error: "Expected multipart form with field `file`" },
            { status: 400 },
          );
        }

        const validated = await validateUpload(form);
        if (!validated.ok) {
          return Response.json({ error: validated.message }, { status: validated.status });
        }

        const now = Date.now();
        const jobId = createJobId();
        const job: Job = {
          jobId,
          status: "queued",
          progress: 0,
          createdAt: now,
          updatedAt: now,
          fileName: validated.fileName,
          mimeType: validated.mimeType,
          bytes: validated.bytes,
        };
        putJob(job);
        enqueueAnalysis(jobId);

        const body: JobCreateResponse = { jobId, status: "queued" };
        return Response.json(body, { status: 201 });
      },
    },
  },
});
