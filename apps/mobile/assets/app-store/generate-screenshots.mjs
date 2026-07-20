/**
 * Generate App Store Connect screenshots into this folder.
 * Run: npx playwright install chromium && node generate-screenshots.mjs
 *
 * Outputs (upload these):
 *   6.9-*.png  → ASC iPhone 6.9" Display (1320×2868)
 *   6.5-*.png  → ASC iPhone 6.5" Display (1284×2778)
 *   ipad-*.png → ASC iPad 12.9" (2048×2732)
 *   iphone-07-pro.png → subscription App Review screenshot
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(root, "screenshots.html");
const marketingDir = join(root, "../../../web/public/marketing/screenshots");

const shots = [
  { id: "phone-01", tmp: "_tmp-phone-01.png", width: 1284, height: 2778 },
  { id: "phone-02", tmp: "_tmp-phone-02.png", width: 1284, height: 2778 },
  { id: "phone-03", tmp: "_tmp-phone-03.png", width: 1284, height: 2778 },
  { id: "phone-04", tmp: "_tmp-phone-04.png", width: 1284, height: 2778 },
  { id: "phone-05", tmp: "_tmp-phone-05.png", width: 1284, height: 2778 },
  { id: "phone-06", tmp: "_tmp-phone-06.png", width: 1284, height: 2778 },
  { id: "phone-07", tmp: "iphone-07-pro.png", width: 1284, height: 2778 },
  { id: "ipad-01", tmp: "ipad-01-today.png", width: 2048, height: 2732 },
  { id: "ipad-02", tmp: "ipad-02-voice.png", width: 2048, height: 2732 },
  { id: "ipad-03", tmp: "ipad-03-life-graph.png", width: 2048, height: 2732 },
  { id: "ipad-04", tmp: "ipad-04-predictions.png", width: 2048, height: 2732 },
  { id: "ipad-05", tmp: "ipad-05-money.png", width: 2048, height: 2732 },
  { id: "ipad-06", tmp: "ipad-06-life-feed.png", width: 2048, height: 2732 },
  { id: "ipad-07", tmp: "ipad-07-my-life.png", width: 2048, height: 2732 },
  { id: "ipad-08", tmp: "ipad-08-command-center.png", width: 2048, height: 2732 },
  { id: "ipad-09", tmp: "ipad-09-goals.png", width: 2048, height: 2732 },
  { id: "ipad-10", tmp: "ipad-10-trust.png", width: 2048, height: 2732 },
];

const phoneOut = [
  ["_tmp-phone-01.png", "01-today"],
  ["_tmp-phone-02.png", "02-voice"],
  ["_tmp-phone-03.png", "03-life-graph"],
  ["_tmp-phone-04.png", "04-predictions"],
  ["_tmp-phone-05.png", "05-money"],
  ["_tmp-phone-06.png", "06-life-feed"],
];

function resizePng(src, dest, width, height) {
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert("RGB")
im = im.resize((${width}, ${height}), Image.Resampling.LANCZOS)
im.save(${JSON.stringify(dest)}, "PNG", optimize=True)
`;
  const r = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "resize failed");
}

function copyPng(src, dest) {
  const py = `
from PIL import Image
from shutil import copyfile
im = Image.open(${JSON.stringify(src)})
if im.size != (1284, 2778):
  im = im.convert("RGB").resize((1284, 2778), Image.Resampling.LANCZOS)
  im.save(${JSON.stringify(dest)}, "PNG", optimize=True)
else:
  copyfile(${JSON.stringify(src)}, ${JSON.stringify(dest)})
`;
  const r = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "copy failed");
}

const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/screenshots.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(readFileSync(htmlPath));
    return;
  }
  if (req.url === "/icon.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(readFileSync(join(root, "..", "icon.png")));
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const page = await browser.newPage();

for (const shot of shots) {
  await page.setViewportSize({ width: shot.width + 40, height: shot.height + 40 });
  await page.goto(`${base}/screenshots.html`, { waitUntil: "networkidle" });
  await page.locator(`#${shot.id}`).screenshot({ path: join(root, shot.tmp), type: "png" });
  console.log(`Captured ${shot.tmp}`);
}

await browser.close();
server.close();

for (const [tmp, slug] of phoneOut) {
  const src = join(root, tmp);
  copyPng(src, join(root, `6.5-${slug}.png`));
  resizePng(src, join(root, `6.9-${slug}.png`), 1320, 2868);
  console.log(`Wrote 6.5-${slug}.png + 6.9-${slug}.png`);
}

// marketing refs
resizePng(join(root, "_tmp-phone-01.png"), join(marketingDir, "phone-01-today.png"), 1080, 1920);
resizePng(join(root, "_tmp-phone-02.png"), join(marketingDir, "phone-02-voice.png"), 1080, 1920);
resizePng(join(root, "_tmp-phone-03.png"), join(marketingDir, "phone-03-life-graph.png"), 1080, 1920);

import { unlinkSync } from "node:fs";
for (const [tmp] of phoneOut) {
  try {
    unlinkSync(join(root, tmp));
  } catch {
    /* ignore */
  }
}

console.log("\nDone. Upload 6.9-*, 6.5-*, ipad-*, and iphone-07-pro.png from this folder.");
