import { uploadMarketingTempFetchableUrl } from "@/lib/marketing-blob-temp";

const MAX_RESUME_CHARS = 50_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function resumeExcerpt(text: string | null | undefined, max = 280) {
  if (!text?.trim()) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export async function extractResumeText(buffer: Buffer, fileName: string, mimeType: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (
    mimeType.startsWith("text/") ||
    ext === "txt" ||
    ext === "md" ||
    mimeType === "application/json"
  ) {
    return buffer.toString("utf-8").slice(0, MAX_RESUME_CHARS);
  }

  if (ext === "pdf" || mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    return parsed.text.slice(0, MAX_RESUME_CHARS);
  }

  throw new Error("Unsupported file type. Upload PDF, TXT, or MD.");
}

export async function storeResumeUpload(input: {
  userId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  if (input.buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("Resume must be 5 MB or smaller.");
  }

  const resumeText = await extractResumeText(input.buffer, input.fileName, input.mimeType);
  if (!resumeText.trim()) {
    throw new Error("Could not read text from that file. Try a PDF export or paste plain text.");
  }

  let resumeBlobPath: string | undefined;
  try {
    const blobUrl = await uploadMarketingTempFetchableUrl(
      `resumes/${input.userId}/${Date.now()}-${input.fileName.replace(/[^\w.-]+/g, "_")}`,
      input.buffer,
      input.mimeType || "application/octet-stream"
    );
    if (blobUrl) resumeBlobPath = blobUrl;
  } catch (error) {
    console.warn("[career-resume] blob upload skipped", error);
  }

  return { resumeText, resumeFileName: input.fileName, resumeBlobPath };
}
