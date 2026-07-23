import { get, list, put } from "@vercel/blob";

type Access = "private" | "public";

function isAccessMismatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("private store") || message.includes("public access");
}

/** MotiveLife blob store is private — try private first, then public. */
export async function putAscBlob(
  pathname: string,
  body: string | Buffer,
  opts: { contentType: string; token: string }
) {
  let lastError: unknown;
  for (const access of ["private", "public"] as const) {
    try {
      return await put(pathname, body, {
        access,
        contentType: opts.contentType,
        token: opts.token,
        allowOverwrite: true,
        addRandomSuffix: false,
      });
    } catch (error) {
      lastError = error;
      if (!isAccessMismatch(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Blob upload failed.");
}

export async function getAscLatestReport(token: string): Promise<unknown | null> {
  for (const access of ["private", "public"] as Access[]) {
    try {
      const result = await get("asc-helper/latest.json", {
        access,
        token,
      });
      if (result?.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        return JSON.parse(text);
      }
    } catch (error) {
      if (!isAccessMismatch(error)) {
        console.error("[asc-helper] get", access, error);
      }
    }
  }

  // list + fetch (works for public URLs; for private, get above should have worked)
  try {
    const listed = await list({
      prefix: "asc-helper/",
      token,
      limit: 50,
    });
    const jsonBlob = listed.blobs
      .filter((b) => /latest\.json$/i.test(b.pathname))
      .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];
    if (!jsonBlob) return null;

    // Prefer authenticated get by pathname (private-safe)
    for (const access of ["private", "public"] as Access[]) {
      try {
        const result = await get(jsonBlob.pathname, { access, token });
        if (result?.statusCode === 200 && result.stream) {
          const text = await new Response(result.stream).text();
          return JSON.parse(text);
        }
      } catch {
        /* try next */
      }
    }

    if (jsonBlob.url) {
      const res = await fetch(jsonBlob.url, { cache: "no-store" });
      if (res.ok) return await res.json();
    }
  } catch (error) {
    console.error("[asc-helper] list fallback", error);
  }

  return null;
}
