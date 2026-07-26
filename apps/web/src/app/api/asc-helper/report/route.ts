import { json } from "@/lib/api";
import {
  detectStuck,
  stepsForAscSnapshot,
  type AscSnapshot,
} from "@/lib/asc-helper";
import { putAscBlob } from "@/lib/asc-helper-blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(request: Request): boolean {
  const secret = process.env.ASC_HELPER_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = request.headers.get("x-asc-helper-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

type Body = {
  snapshot?: AscSnapshot;
  screenshotDataUrl?: string;
  note?: string;
};

/** Extension → server: page snapshot + optional screenshot; returns next clicks. */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return json({ error: "Unauthorized. Set ASC_HELPER_SECRET and extension secret." }, 401);
  }
  if (!process.env.ASC_HELPER_SECRET?.trim()) {
    return json({ error: "ASC_HELPER_SECRET not configured on server." }, 503);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const snapshot = body.snapshot;
  if (!snapshot?.url) return json({ error: "snapshot.url required" }, 400);

  const stuckReason = detectStuck(snapshot) || body.note || null;
  const steps = stepsForAscSnapshot(snapshot);

  let screenshotUrl: string | null = null;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const dataUrl = body.screenshotDataUrl?.trim();

  if (blobToken && dataUrl?.startsWith("data:image/")) {
    try {
      const comma = dataUrl.indexOf(",");
      const meta = dataUrl.slice(0, comma);
      const b64 = dataUrl.slice(comma + 1);
      const mime = meta.includes("image/png") ? "image/png" : "image/jpeg";
      const buffer = Buffer.from(b64, "base64");
      if (buffer.length <= 1_500_000) {
        const ext = mime === "image/png" ? "png" : "jpg";
        const blob = await putAscBlob(`asc-helper/latest.${ext}`, buffer, {
          contentType: mime,
          token: blobToken,
        });
        screenshotUrl = blob.url;
      }
    } catch (error) {
      console.error("[asc-helper] screenshot upload", error);
    }
  }

  const report = {
    id: `asc_${Date.now()}`,
    receivedAt: new Date().toISOString(),
    stuckReason,
    snapshot,
    steps,
    screenshotUrl,
  };

  let stored = false;
  let storeError: string | null = null;
  let blobUrl: string | null = null;

  if (blobToken) {
    try {
      const blob = await putAscBlob(
        "asc-helper/latest.json",
        JSON.stringify(report, null, 2),
        { contentType: "application/json", token: blobToken }
      );
      stored = true;
      blobUrl = blob.url;
      (report as { blobUrl?: string }).blobUrl = blob.url;
    } catch (error) {
      console.error("[asc-helper] latest.json upload", error);
      storeError = error instanceof Error ? error.message : String(error);
    }
  } else {
    storeError = "BLOB_READ_WRITE_TOKEN missing — Cursor cannot fetch latest across deploys.";
  }

  (globalThis as unknown as { __ascHelperLatest?: typeof report }).__ascHelperLatest = report;

  return json({
    ok: true,
    id: report.id,
    stuckReason,
    steps,
    screenshotUrl,
    stored,
    storeError,
    blobUrl,
    message: stored
      ? "Report stored. Cursor can fetch GET /api/asc-helper/latest with the same secret."
      : `Report received but NOT stored for Cursor. ${storeError || ""}`.trim(),
  });
}
