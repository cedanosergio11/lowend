import { createFileRoute } from "@tanstack/react-router";
import { getJob, toStatusResponse } from "@/lib/jobs";

export const Route = createFileRoute("/api/jobs/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const job = getJob(params.id);
        if (!job) {
          return Response.json({ error: "Job not found" }, { status: 404 });
        }
        return Response.json(toStatusResponse(job));
      },
    },
  },
});
