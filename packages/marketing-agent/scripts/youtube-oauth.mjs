#!/usr/bin/env node
/**
 * One-time Google OAuth for YouTube Shorts upload (youtube.upload).
 *
 * Usage:
 *   set MARKETING_YOUTUBE_CLIENT_ID / MARKETING_YOUTUBE_CLIENT_SECRET
 *   (or GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
 *   node ./scripts/youtube-oauth.mjs motivelife
 *   node ./scripts/youtube-oauth.mjs motivefx
 *
 * Add http://127.0.0.1:8765/callback as an authorized redirect URI
 * on the OAuth Web client in Google Cloud Console.
 *
 * Sign in with the Google account that owns the target YouTube channel.
 * Copy the printed refresh_token into Vercel (motivelife-web Production).
 */
import http from "node:http";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PORT = 8765;
// Must match Google Cloud → Credentials → OAuth client → Authorized redirect URIs EXACTLY.
// Prefer localhost (not 127.0.0.1) — easy to mistype the other way.
const REDIRECT_URI =
  process.env.YOUTUBE_OAUTH_REDIRECT_URI?.trim() ||
  `http://localhost:${PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

const BRANDS = {
  motivelife: {
    label: "MotiveLife",
    refreshEnv: "MARKETING_MOTIVELIFE_YOUTUBE_REFRESH_TOKEN",
    channelEnv: "MARKETING_MOTIVELIFE_YOUTUBE_CHANNEL_ID",
    clientIdEnv: "MARKETING_MOTIVELIFE_YOUTUBE_CLIENT_ID",
    clientSecretEnv: "MARKETING_MOTIVELIFE_YOUTUBE_CLIENT_SECRET",
    channelId: "UCzjdFghiI1akeuVeSERu21A",
    handle: "@MotiveLife-ai",
    studio: "https://studio.youtube.com/channel/UCzjdFghiI1akeuVeSERu21A",
  },
  motivefx: {
    label: "MotiveFX",
    refreshEnv: "MARKETING_MOTIVEFX_YOUTUBE_REFRESH_TOKEN",
    channelEnv: "MARKETING_MOTIVEFX_YOUTUBE_CHANNEL_ID",
    clientIdEnv: "MARKETING_MOTIVEFX_YOUTUBE_CLIENT_ID",
    clientSecretEnv: "MARKETING_MOTIVEFX_YOUTUBE_CLIENT_SECRET",
    channelId: "UCIXSsWKLSitr8mtlRZ20TfA",
    handle: "MotiveFX channel",
    studio: "https://studio.youtube.com/channel/UCIXSsWKLSitr8mtlRZ20TfA",
  },
};

const brandKey = (process.argv[2] || "motivelife").toLowerCase();
const brand = BRANDS[brandKey];
if (!brand) {
  console.error(`Unknown brand "${brandKey}". Use: motivelife | motivefx`);
  process.exit(1);
}

const clientId =
  process.env[brand.clientIdEnv]?.trim() ||
  process.env.MARKETING_YOUTUBE_CLIENT_ID?.trim() ||
  process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret =
  process.env[brand.clientSecretEnv]?.trim() ||
  process.env.MARKETING_YOUTUBE_CLIENT_SECRET?.trim() ||
  process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error(
    `Missing OAuth client. Set ${brand.clientIdEnv} + ${brand.clientSecretEnv}\n` +
      "(or MARKETING_YOUTUBE_CLIENT_* / GOOGLE_CLIENT_*)."
  );
  process.exit(1);
}

console.log(`Using OAuth client_id: ${clientId.slice(0, 20)}… (must match Vercel ${brand.clientIdEnv})`);

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
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
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
      `<html><body><h1>${brand.label} YouTube OAuth complete</h1><p>You can close this tab and return to the terminal.</p></body></html>`
    );

    console.log(`\n=== Save to Vercel motivelife-web Production (do not commit) ===\n`);
    console.log(`Brand: ${brand.label} (${brand.handle})`);
    console.log(`Studio: ${brand.studio}\n`);
    if (tokens.refresh_token) {
      console.log(`${brand.refreshEnv}=${tokens.refresh_token}`);
    } else {
      console.log(
        "No refresh_token in response. Revoke prior grant at https://myaccount.google.com/permissions and re-run with prompt=consent."
      );
    }
    console.log(`${brand.channelEnv}=${brand.channelId}`);
    console.log(
      `\nOAuth client (must match — mismatch causes unauthorized_client):\n` +
        `${brand.clientIdEnv}=${clientId}\n` +
        `${brand.clientSecretEnv}=…(same secret used for this run)\n` +
        `(or shared MARKETING_YOUTUBE_CLIENT_ID / SECRET / GOOGLE_CLIENT_*)\n`
    );
    console.log("access_token expires soon — only the refresh_token is needed long-term.\n");
    console.log(
      "Save the refresh_token + client secret in a password manager (Bitwarden / 1Password) before closing this window.\n"
    );
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
  console.log(`YouTube OAuth helper — ${brand.label}`);
  console.log(`Channel ID: ${brand.channelId}`);
  console.log("\n*** Google Cloud must list this EXACT redirect URI (copy/paste): ***");
  console.log(REDIRECT_URI);
  console.log("*** Also add if you want either form to work: http://127.0.0.1:8765/callback ***\n");
  console.log("Open this URL in your browser (sign in as the channel owner):\n");
  console.log(authUrl.toString());
  console.log("\nWaiting for callback…\n");

  try {
    const rl = createInterface({ input, output });
    await rl.question("(Press Enter if the browser did not open automatically)\n");
    rl.close();
  } catch {
    /* non-interactive */
  }
});
