import { json } from "@/lib/api";
import { getAscLatestReport } from "@/lib/asc-helper-blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret = process.env.ASC_HELPER_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = request.headers.get("x-asc-helper-secret")?.trim() || "";
  const q = new URL(request.url).searchParams.get("secret")?.trim() || "";
  return bearer === secret || alt === secret || q === secret;
}

/** Cursor / agent fetches the latest extension report (incl. screenshot URL). */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const mem = (globalThis as unknown as { __ascHelperLatest?: unknown }).__ascHelperLatest;
  if (mem) return json({ ok: true, source: "memory", report: mem });

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) {
    return json(
      {
        ok: false,
        error: "No in-memory report and BLOB_READ_WRITE_TOKEN missing.",
      },
      404
    );
  }

  try {
    const report = await getAscLatestReport(blobToken);
    if (!report) return json({ ok: false, error: "No report yet." }, 404);
    return json({ ok: true, source: "blob", report });
  } catch (error) {
    console.error("[asc-helper/latest]", error);
    return json({ ok: false, error: "Could not load latest report." }, 404);
  }
}
