#!/usr/bin/env node
/**
 * One-time Google login for Gemini browser automation.
 * Opens a visible Chrome window — sign in, then close the window.
 * Session is saved to .gemini-browser-profile for the worker.
 */
import { chromium } from "playwright";
import { isLoggedIntoGemini, profileDir } from "./gemini-browser-lib.mjs";

const dir = profileDir();
console.log(`Gemini profile: ${dir}`);
console.log("Opening Chrome — sign into Google, open Gemini, then close the window.\n");

const context = await chromium.launchPersistentContext(dir, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1280, height: 900 },
  args: ["--disable-blink-features=AutomationControlled"],
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded" });

console.log("Waiting for Gemini chat input (up to 3 min)…");
const deadline = Date.now() + 180_000;
while (Date.now() < deadline) {
  if (await isLoggedIntoGemini(page)) {
    console.log("\n✓ Logged in — session saved. You can close the browser and run: pnpm gemini:worker");
    await page.waitForTimeout(3000);
    await context.close();
    process.exit(0);
  }
  await page.waitForTimeout(2000);
}

console.error("\nTimed out — make sure you completed Google sign-in on gemini.google.com");
await context.close();
process.exit(1);
