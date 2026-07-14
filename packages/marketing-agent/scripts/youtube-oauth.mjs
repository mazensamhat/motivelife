#!/usr/bin/env node
/**
 * One-time Google OAuth for YouTube Shorts upload (youtube.upload).
 *
 * Usage:
 *   set MARKETING_YOUTUBE_CLIENT_ID / MARKETING_YOUTUBE_CLIENT_SECRET
 *   (or GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
 *   node ./scripts/youtube-oauth.mjs
 *
 * Add http://127.0.0.1:8765/callback as an authorized redirect URI
 * on the OAuth Web client in Google Cloud Console.
 *
 * Sign in with the Google account that owns the Target YouTube channel.
 * Copy the printed refresh_token into Vercel (e.g. MARKETING_MOTIVEFX_YOUTUBE_REFRESH_TOKEN).
 */
import http from "node:http";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PORT = 8765;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

const clientId =
  process.env.MARKETING_YOUTUBE_CLIENT_ID?.trim() ||
  process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret =
  process.env.MARKETING_YOUTUBE_CLIENT_SECRET?.trim() ||
  process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error(
    "Missing OAuth client. Set MARKETING_YOUTUBE_CLIENT_ID + MARKETING_YOUTUBE_CLIENT_SECRET\n" +
      "(or GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)."
  );
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

function exchangeCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).then(async (res) => {
    const text = await res.text();
    if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${text}`);
    return JSON.parse(text);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const err = url.searchParams.get("error");
    if (err) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(`OAuth error: ${err}`);
      console.error("OAuth error:", err);
      server.close();
      process.exit(1);
    }
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing code");
      return;
    }

    const tokens = await exchangeCode(code);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<html><body><h1>YouTube OAuth complete</h1><p>You can close this tab and return to the terminal.</p></body></html>"
    );

    console.log("\n=== Save to Vercel / .env (do not commit) ===\n");
    if (tokens.refresh_token) {
      console.log(`MARKETING_MOTIVEFX_YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      console.log(
        "No refresh_token in response. Revoke prior grant at https://myaccount.google.com/permissions and re-run with prompt=consent."
      );
    }
    console.log(`MARKETING_MOTIVEFX_YOUTUBE_CHANNEL_ID=UCIXSsWKLSitr8mtlRZ20TfA`);
    console.log("\naccess_token expires soon — only the refresh_token is needed long-term.\n");
    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(String(e));
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", async () => {
  console.log("YouTube OAuth helper");
  console.log(`Redirect URI must be registered: ${REDIRECT_URI}`);
  console.log("\nOpen this URL in your browser:\n");
  console.log(authUrl.toString());
  console.log("\nWaiting for callback…\n");

  try {
    const rl = createInterface({ input, output });
    await rl.question("(Press Enter if the browser did not open automatically — paste URL if needed is not required)\n");
    rl.close();
  } catch {
    /* non-interactive */
  }
});
