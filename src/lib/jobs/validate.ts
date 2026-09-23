import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_PREFIXES,
  MAX_DURATION_MS,
} from "./types";
import { decodeWav, estimateDurationFromSize } from "./analyze";

export type ValidateOk = {
  ok: true;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  durationMsHint: number | null;
};

export type ValidateErr = {
  ok: false;
  status: 400 | 413;
  message: string;
};

export type ValidateResult = ValidateOk | ValidateErr;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isAcceptedAudio(fileName: string, mimeType: string): boolean {
  const ext = extOf(fileName);
  const extOk = (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
  const mime = mimeType.toLowerCase().split(";")[0]!.trim();
  const mimeOk =
    mime === "" ||
    mime === "application/octet-stream" ||
    (ACCEPTED_MIME_PREFIXES as readonly string[]).some(
      (p) => mime === p || mime.startsWith(p + "/"),
    ) ||
    mime.startsWith("audio/");
  // Require extension match; MIME alone is not enough (empty/corrupt uploads).
  return extOk && (mimeOk || mime === "application/octet-stream" || mime === "");
}

export async function validateUpload(form: FormData): Promise<ValidateResult> {
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, status: 400, message: "Missing multipart field `file`" };
  }
  if (file.size === 0) {
    return { ok: false, status: 400, message: "Empty file" };
  }

  const fileName = file.name || "upload.bin";
  const mimeType = file.type || "";
  if (!isAcceptedAudio(fileName, mimeType)) {
    return {
      ok: false,
      status: 400,
      message: "Non-audio or unsupported type (want wav|mp3|m4a|flac)",
    };
  }

  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  if (bytes.byteLength === 0) {
    return { ok: false, status: 400, message: "Empty file" };
  }

  const lower = fileName.toLowerCase();
  let durationMsHint: number | null = null;

  if (lower.endsWith(".wav") || mimeType.includes("wav")) {
    const decoded = decodeWav(bytes);
    if (!decoded) {
      return { ok: false, status: 400, message: "Corrupt or unsupported WAV" };
    }
    durationMsHint = decoded.durationMs;
    if (decoded.durationMs > MAX_DURATION_MS) {
      return { ok: false, status: 413, message: "Audio longer than 8 minutes" };
    }
  } else {
    const ext = extOf(fileName);
    durationMsHint = estimateDurationFromSize(bytes.byteLength, ext);
    if (durationMsHint != null && durationMsHint > MAX_DURATION_MS * 1.15) {
      // Soft duration check with 15% slack on the bitrate estimate
      return { ok: false, status: 413, message: "Audio longer than 8 minutes (estimated)" };
    }
  }

  return { ok: true, fileName, mimeType, bytes, durationMsHint };
}
