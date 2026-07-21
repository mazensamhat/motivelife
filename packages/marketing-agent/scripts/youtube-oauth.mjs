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
 * Add http://localhost:8765/callback as an authorized redirect URI
 * on the OAuth Web client in Google Cloud Console.
 *
 * CRITICAL: Sign in with the Google account that owns the brand YouTube
 * channel. If that Google login has a personal channel AND a Brand Account,
 * pick the Brand Account in the Google picker (MotiveLife / MotiveFX) —
 * not your personal "Mazen …" channel. The script verifies channel id
 * after consent and refuses to print a token for the wrong channel.
 */
import http from "node:http";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PORT = 8765;
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
    channelId: "UCzjdFghiI1akeuVeSERu21A",
    handle: "@MotiveLife-ai",
    studio: "https://studio.youtube.com/channel/UCzjdFghiI1akeuVeSERu21A",
  },
  motivefx: {
    label: "MotiveFX",
    refreshEnv: "MARKETING_MOTIVEFX_YOUTUBE_REFRESH_TOKEN",
    channelEnv: "MARKETING_MOTIVEFX_YOUTUBE_CHANNEL_ID",
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

const brandPrefix = `MARKETING_${brandKey.toUpperCase()}_YOUTUBE`;
const clientId =
  process.env[`${brandPrefix}_CLIENT_ID`]?.trim() ||
  process.env.MARKETING_YOUTUBE_CLIENT_ID?.trim() ||
  process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret =
  process.env[`${brandPrefix}_CLIENT_SECRET`]?.trim() ||
  process.env.MARKETING_YOUTUBE_CLIENT_SECRET?.trim() ||
  process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error(
    "Missing OAuth client. Set one of:\n" +
      `  ${brandPrefix}_CLIENT_ID + ${brandPrefix}_CLIENT_SECRET\n` +
      "  MARKETING_YOUTUBE_CLIENT_ID + MARKETING_YOUTUBE_CLIENT_SECRET\n" +
      "  GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET\n" +
      "Use the SAME values as Vercel Production (mismatch → unauthorized_client)."
  );
  process.exit(1);
}

console.log(`Using client_id: ${clientId.slice(0, 12)}…${clientId.slice(-8)}`);

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
// consent + select_account so you can pick the Brand Account, not a leftover personal login.
authUrl.searchParams.set("prompt", "consent select_account");

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

async function fetchMineChannel(accessToken) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id,snippet");
  url.searchParams.set("mine", "true");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`channels.list failed (${res.status}): ${text}`);
  const data = JSON.parse(text);
  const item = data.items?.[0];
  if (!item?.id) return null;
  return { id: item.id, title: item.snippet?.title || item.id };
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
    const mine = tokens.access_token
      ? await fetchMineChannel(tokens.access_token)
      : null;

    if (!mine) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<html><body><h1>No YouTube channel on this Google account</h1><p>Close this tab and try again with the account that owns ${brand.label}.</p></body></html>`
      );
      console.error(
        `\nFAIL: OAuth succeeded but this Google login has no YouTube channel.\n` +
          `Open ${brand.studio} while logged into the brand, then re-run this script.\n`
      );
      server.close();
      process.exit(1);
    }

    if (mine.id !== brand.channelId) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<html><body><h1>Wrong YouTube channel</h1>` +
          `<p>Authorized: <b>${mine.title}</b> (${mine.id})</p>` +
          `<p>Expected ${brand.label}: <b>${brand.handle}</b> (${brand.channelId})</p>` +
          `<p>Close this tab. Re-run the script and in the Google account picker choose the <b>Brand Account</b> for ${brand.label}, not your personal channel.</p>` +
          `</body></html>`
      );
      console.error("\n=== WRONG CHANNEL — token NOT saved ===\n");
      console.error(`Authorized channel: "${mine.title}" (${mine.id})`);
      console.error(`Expected ${brand.label}: ${brand.handle} (${brand.channelId})`);
      console.error(
        `\nFix: Re-run this script. When Google asks which account, pick the Brand Account\n` +
          `for ${brand.label} (Studio: ${brand.studio}), NOT your personal YouTube channel.\n` +
          `Tip: open Studio first in Chrome, switch to ${brand.label}, then re-run OAuth.\n`
      );
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<html><body><h1>${brand.label} YouTube OAuth complete</h1>` +
        `<p>Authorized channel: <b>${mine.title}</b> (${mine.id})</p>` +
        `<p>You can close this tab and return to the terminal.</p></body></html>`
    );

    console.log(`\n=== Save to Vercel motivelife-web Production (do not commit) ===\n`);
    console.log(`Brand: ${brand.label} (${brand.handle})`);
    console.log(`Authorized channel: "${mine.title}" (${mine.id})`);
    console.log(`Studio: ${brand.studio}\n`);
    console.log(
      "IMPORTANT: MotiveLife and MotiveFX each need their OWN refresh token.\n" +
        "Do not copy MotiveFX's token into MARKETING_MOTIVELIFE_* (or the reverse).\n"
    );
    if (tokens.refresh_token) {
      console.log(`${brand.refreshEnv}=${tokens.refresh_token}`);
    } else {
      console.log(
        "No refresh_token in response. Revoke prior grant at https://myaccount.google.com/permissions and re-run with prompt=consent select_account."
      );
    }
    console.log(`${brand.channelEnv}=${brand.channelId}`);
    console.log(
      "\nShared OAuth Web client (same for both brands is OK):\nMARKETING_YOUTUBE_CLIENT_ID=...\nMARKETING_YOUTUBE_CLIENT_SECRET=...\n(or GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)\n" +
        "The refresh token above MUST be minted with that same client_id.\n"
    );
    console.log("access_token expires soon — only the refresh_token is needed long-term.\n");
    console.log(
      "Save the refresh_token in a password manager (Bitwarden / 1Password) before closing this window.\n"
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
  console.log(`Expected channel: ${brand.handle} (${brand.channelId})`);
  console.log(`Studio (switch to this channel first): ${brand.studio}`);
  console.log(
    "\n*** When Google shows accounts, pick the Brand Account for this channel,\n" +
      "*** NOT your personal YouTube channel. Wrong channel → script will refuse the token.\n"
  );
  console.log("\n*** Google Cloud must list this EXACT redirect URI (copy/paste): ***");
  console.log(REDIRECT_URI);
  console.log("*** Also add if you want either form to work: http://127.0.0.1:8765/callback ***\n");
  console.log("Open this URL in your browser:\n");
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
