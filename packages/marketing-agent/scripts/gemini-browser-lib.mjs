import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export function profileDir() {
  return (
    process.env.GEMINI_BROWSER_PROFILE_DIR?.trim() ||
    path.join(REPO_ROOT, ".gemini-browser-profile")
  );
}

export async function writeTempImage(base64, mimeType = "image/png") {
  const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png";
  const file = path.join(os.tmpdir(), `motivelife-gemini-${Date.now()}.${ext}`);
  await fs.writeFile(file, Buffer.from(base64, "base64"));
  return file;
}

export async function imageBufferFromSrc(page, src) {
  if (!src) return null;
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { buffer: Buffer.from(match[2], "base64"), mimeType: match[1] };
  }
  if (src.startsWith("blob:")) {
    const base64 = await page.evaluate(async (blobUrl) => {
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      return await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }, src);
    return { buffer: Buffer.from(base64, "base64"), mimeType: "image/png" };
  }
  const res = await page.request.get(src);
  if (!res.ok()) return null;
  const ct = res.headers()["content-type"] ?? "image/png";
  return { buffer: Buffer.from(await res.body()), mimeType: ct.split(";")[0] };
}

export async function isLoggedIntoGemini(page) {
  const signIn = page.locator('a:has-text("Sign in"), button:has-text("Sign in")').first();
  if (await signIn.isVisible({ timeout: 2500 }).catch(() => false)) return false;
  const input = page.locator('[contenteditable="true"], textarea').first();
  return input.isVisible({ timeout: 8000 }).catch(() => false);
}

export async function runGeminiGeneration(page, { prompt, imagePath }) {
  await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);

  if (!(await isLoggedIntoGemini(page))) {
    throw new Error(
      "Not logged into Google Gemini. Run: pnpm gemini:login — sign in once, then retry."
    );
  }

  if (imagePath) {
    const uploadBtn = page
      .locator(
        'button[aria-label*="Upload" i], button[aria-label*="Add" i], button[aria-label*="image" i], input[type="file"]'
      )
      .first();
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(imagePath);
    } else if (await uploadBtn.count()) {
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), uploadBtn.click()]);
      await chooser.setFiles(imagePath);
    } else {
      throw new Error("Could not find Gemini file upload control.");
    }
    await page.waitForTimeout(2500);
  }

  const editors = page.locator('[contenteditable="true"], textarea');
  const input = editors.last();
  await input.click({ timeout: 15000 });
  await input.fill("");
  await page.keyboard.type(prompt, { delay: 8 });
  await page.waitForTimeout(400);

  const sendBtn = page
    .locator(
      'button[aria-label*="Send" i], button[data-test-id="send-button"], button:has(svg):near([contenteditable="true"])'
    )
    .last();
  if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sendBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const imgs = page.locator(
      'img[src*="googleusercontent"], img[src^="blob:"], img[src^="data:image"], [data-message-author-role="model"] img'
    );
    const count = await imgs.count();
    if (count > 0) {
      const img = imgs.nth(count - 1);
      await img.waitFor({ state: "visible", timeout: 5000 }).catch(() => null);
      const src = await img.getAttribute("src");
      const parsed = await imageBufferFromSrc(page, src);
      if (parsed?.buffer?.length) {
        return {
          buffer: parsed.buffer,
          mimeType: parsed.mimeType,
          prompt,
        };
      }
    }
    await page.waitForTimeout(2000);
  }

  throw new Error("Timed out waiting for Gemini to generate an image (120s).");
}
