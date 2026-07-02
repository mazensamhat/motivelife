import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 30 * 60 * 1000;

function muxSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET required for marketing mux.");
  return secret;
}

export function signMuxAssetPath(pathname: string, expiresAt = Date.now() + TTL_MS): string {
  const payload = `${pathname}:${expiresAt}`;
  const sig = createHmac("sha256", muxSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyMuxAssetToken(token: string): { pathname: string } | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const sep = payload.lastIndexOf(":");
  if (sep <= 0) return null;
  const pathname = payload.slice(0, sep);
  const expiresAt = Number(payload.slice(sep + 1));
  if (!pathname || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const expected = createHmac("sha256", muxSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return { pathname };
}
