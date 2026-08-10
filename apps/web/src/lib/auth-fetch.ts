/**
 * Same-origin fetch that always sends cookies, and attaches a native JWT when
 * the Expo shell has injected one (Android/iOS WebView cookie loss).
 */

type MotiveWindow = Window & {
  __MOTIVELIFE_SESSION_JWT__?: string;
  ReactNativeWebView?: { postMessage: (msg: string) => void };
};

function nativeJwt(): string | null {
  if (typeof window === "undefined") return null;
  const t = (window as MotiveWindow).__MOTIVELIFE_SESSION_JWT__;
  return typeof t === "string" && t.length > 20 ? t : null;
}

function withAuthHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers ?? undefined);
  const jwt = nativeJwt();
  if (jwt) {
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${jwt}`);
    }
    if (!headers.has("X-MotiveLife-Session")) {
      headers.set("X-MotiveLife-Session", jwt);
    }
  }
  return headers;
}

/** Ask the Expo shell for the SecureStore JWT (if a bridge is listening). */
function requestNativeJwt(timeoutMs = 2_500): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as MotiveWindow;
  if (!w.ReactNativeWebView?.postMessage) return Promise.resolve(nativeJwt());

  const existing = nativeJwt();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const requestId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMsg);
      resolve(nativeJwt());
    }, timeoutMs);

    function onMsg(event: MessageEvent) {
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          data?.type === "native_session_token" &&
          data?.requestId === requestId &&
          typeof data?.token === "string"
        ) {
          window.clearTimeout(timer);
          window.removeEventListener("message", onMsg);
          (window as MotiveWindow).__MOTIVELIFE_SESSION_JWT__ = data.token;
          resolve(data.token);
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener("message", onMsg);
    try {
      w.ReactNativeWebView!.postMessage(
        JSON.stringify({ type: "get_native_session", requestId })
      );
    } catch {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(null);
    }
  });
}

/** Re-set the httpOnly cookie from a native JWT (best-effort). */
async function restoreSessionCookie(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/native-session/restore", {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-MotiveLife-Session": token,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Authenticated fetch for Family Map mutations. Retries once after native
 * session restore when the first attempt returns 401.
 */
export async function authFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const run = () =>
    fetch(input, {
      ...init,
      credentials: "include",
      headers: withAuthHeaders(init),
    });

  let res = await run();
  if (res.status !== 401) return res;

  const token = await requestNativeJwt();
  if (!token) return res;

  await restoreSessionCookie(token);
  res = await run();
  return res;
}
