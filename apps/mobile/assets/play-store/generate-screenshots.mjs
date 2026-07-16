/**
 * Generate Google Play Store screenshots from screenshots.html
 * Run: node apps/mobile/assets/play-store/generate-screenshots.mjs
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(root, "screenshots.html");
const outDir = root;

const shots = [
  { id: "phone-1", file: "phone-01-today.png", width: 1080, height: 1920 },
  { id: "phone-2", file: "phone-02-voice.png", width: 1080, height: 1920 },
  { id: "phone-3", file: "phone-03-life-graph.png", width: 1080, height: 1920 },
  { id: "tablet-1", file: "tablet-01-today.png", width: 1600, height: 2560 },
  { id: "tablet-2", file: "tablet-02-life-graph.png", width: 1600, height: 2560 },
];

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
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${base}/screenshots.html`, { waitUntil: "networkidle" });
  const el = page.locator(`#${shot.id}`);
  await el.screenshot({ path: join(outDir, shot.file) });
  console.log(`Wrote ${shot.file} (${shot.width}x${shot.height})`);
}

await browser.close();
server.close();
console.log(`\nDone — files in ${outDir}`);
