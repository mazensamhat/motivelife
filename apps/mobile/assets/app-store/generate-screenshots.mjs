/**
 * Generate App Store Connect screenshots from screenshots.html
 * Run: node apps/mobile/assets/app-store/generate-screenshots.mjs
 *
 * iPhone 6.7" (1290×2796) and iPad Pro 12.9" (2048×2732)
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
  { id: "phone-01", file: "iphone-01-today.png", width: 1290, height: 2796 },
  { id: "phone-02", file: "iphone-02-voice.png", width: 1290, height: 2796 },
  { id: "phone-03", file: "iphone-03-life-graph.png", width: 1290, height: 2796 },
  { id: "phone-04", file: "iphone-04-predictions.png", width: 1290, height: 2796 },
  { id: "phone-05", file: "iphone-05-money.png", width: 1290, height: 2796 },
  { id: "phone-06", file: "iphone-06-life-feed.png", width: 1290, height: 2796 },
  { id: "ipad-01", file: "ipad-01-today.png", width: 2048, height: 2732 },
  { id: "ipad-02", file: "ipad-02-voice.png", width: 2048, height: 2732 },
  { id: "ipad-03", file: "ipad-03-life-graph.png", width: 2048, height: 2732 },
  { id: "ipad-04", file: "ipad-04-predictions.png", width: 2048, height: 2732 },
  { id: "ipad-05", file: "ipad-05-money.png", width: 2048, height: 2732 },
  { id: "ipad-06", file: "ipad-06-life-feed.png", width: 2048, height: 2732 },
  { id: "ipad-07", file: "ipad-07-my-life.png", width: 2048, height: 2732 },
  { id: "ipad-08", file: "ipad-08-command-center.png", width: 2048, height: 2732 },
  { id: "ipad-09", file: "ipad-09-goals.png", width: 2048, height: 2732 },
  { id: "ipad-10", file: "ipad-10-trust.png", width: 2048, height: 2732 },
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
