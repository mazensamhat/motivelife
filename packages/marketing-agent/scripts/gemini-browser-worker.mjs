#!/usr/bin/env node
/**
 * Local HTTP worker — automates gemini.google.com with Playwright (MotiveIQ-style).
 * Ops Console calls this when GEMINI_BROWSER_WORKER_URL is set.
 *
 * Start: pnpm gemini:worker
 * Login once: pnpm gemini:login
 */
import http from "node:http";
import { chromium } from "playwright";
import {
  isLoggedIntoGemini,
  profileDir,
  runGeminiGeneration,
  writeTempImage,
} from "./gemini-browser-lib.mjs";

const PORT = Number(process.env.GEMINI_BROWSER_WORKER_PORT || 8765);
const SECRET = process.env.GEMINI_BROWSER_WORKER_SECRET?.trim() || "";
const profile = profileDir();

let browserContext = null;
let busy = false;

function authOk(req) {
  if (!SECRET) return true;
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${SECRET}`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function getContext() {
  if (browserContext) return browserContext;
  browserContext = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return browserContext;
}

async function healthPayload() {
  try {
    const ctx = await getContext();
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto("https://gemini.google.com/app", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const loggedIn = await isLoggedIntoGemini(page);
    return {
      ok: true,
      loggedIn,
      detail: loggedIn ? "Ready for automatic image generation" : "Run pnpm gemini:login first",
      profile,
    };
  } catch (error) {
    return {
      ok: false,
      loggedIn: false,
      detail: error instanceof Error ? error.message : "Worker error",
      profile,
    };
  }
}

async function handleGenerate(body) {
  if (busy) throw new Error("Worker busy — wait for the current Gemini job to finish.");
  busy = true;
  let tempFile = null;
  try {
    const prompt = String(body.prompt ?? body.brief ?? "").trim();
    if (!prompt) throw new Error("prompt is required");

    if (body.referenceBase64) {
      tempFile = await writeTempImage(body.referenceBase64, body.referenceMimeType ?? "image/png");
    }

    const ctx = await getContext();
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    const result = await runGeminiGeneration(page, { prompt, imagePath: tempFile });

    return {
      base64: result.buffer.toString("base64"),
      mimeType: result.mimeType,
      prompt: result.prompt,
    };
  } finally {
    busy = false;
    if (tempFile) {
      await import("node:fs/promises").then((fs) => fs.unlink(tempFile).catch(() => null));
    }
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!authOk(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  try {
    if (req.method === "GET" && req.url === "/health") {
      const payload = await healthPayload();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.method === "POST" && req.url === "/generate") {
      const body = await readJson(req);
      const payload = await handleGenerate(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker error";
    console.error("[gemini-worker]", message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, () => {
  console.log(`Gemini browser worker listening on http://127.0.0.1:${PORT}`);
  console.log(`Profile: ${profile}`);
  console.log("First time: pnpm gemini:login");
  console.log(`Set in Vercel/local env: GEMINI_BROWSER_WORKER_URL=http://127.0.0.1:${PORT}`);
});

process.on("SIGINT", async () => {
  if (browserContext) await browserContext.close();
  process.exit(0);
});
