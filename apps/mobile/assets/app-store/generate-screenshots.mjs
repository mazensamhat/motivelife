/**
 * Generate App Store Connect screenshots from screenshots.html
 * Run from repo root:
 *   cd apps/mobile/assets/app-store && npx playwright install chromium && node generate-screenshots.mjs
 *
 * Outputs:
 *   - upload/iphone-6.9/*.png @ 1320×2868 (ASC "iPhone 6.9 Display")
 *   - upload/iphone-6.5/*.png @ 1284×2778
 *   - upload/ipad-12.9/*.png @ 2048×2732
 *   - upload/iap-review/iphone-07-pro.png (subscription review screenshot)
 * Also refreshes marketing phone-01..03 (no Play Store copy).
 */
import { createServer } from "node:http";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(root, "screenshots.html");
const outDir = root;
const uploadRoot = join(root, "upload");
const marketingDir = join(root, "../../../web/public/marketing/screenshots");

const shots = [
  { id: "phone-01", file: "iphone-01-today.png", width: 1284, height: 2778 },
  { id: "phone-02", file: "iphone-02-voice.png", width: 1284, height: 2778 },
  { id: "phone-03", file: "iphone-03-life-graph.png", width: 1284, height: 2778 },
  { id: "phone-04", file: "iphone-04-predictions.png", width: 1284, height: 2778 },
  { id: "phone-05", file: "iphone-05-money.png", width: 1284, height: 2778 },
  { id: "phone-06", file: "iphone-06-life-feed.png", width: 1284, height: 2778 },
  { id: "phone-07", file: "iphone-07-pro.png", width: 1284, height: 2778 },
  { id: "phone-08", file: "iphone-08-delete-account.png", width: 1284, height: 2778 },
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

function resizePng(src, dest, width, height) {
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert("RGB")
im = im.resize((${width}, ${height}), Image.Resampling.LANCZOS)
im.save(${JSON.stringify(dest)}, "PNG", optimize=True)
print("resized", ${JSON.stringify(dest)})
`;
  const r = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "resize failed");
  }
  process.stdout.write(r.stdout);
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
  const el = page.locator(`#${shot.id}`);
  await el.screenshot({ path: join(outDir, shot.file), type: "png" });
  console.log(`Wrote ${shot.file} (${shot.width}x${shot.height})`);
}

await browser.close();
server.close();

mkdirSync(join(uploadRoot, "iphone-6.5"), { recursive: true });
mkdirSync(join(uploadRoot, "iphone-6.9"), { recursive: true });
mkdirSync(join(uploadRoot, "iphone-6.9", "alt-1290"), { recursive: true });
mkdirSync(join(uploadRoot, "ipad-12.9"), { recursive: true });
mkdirSync(join(uploadRoot, "iap-review"), { recursive: true });

const phoneListing = [
  "iphone-01-today.png",
  "iphone-02-voice.png",
  "iphone-03-life-graph.png",
  "iphone-04-predictions.png",
  "iphone-05-money.png",
  "iphone-06-life-feed.png",
];

for (const file of phoneListing) {
  const src = join(outDir, file);
  copyFileSync(src, join(uploadRoot, "iphone-6.5", file));
  // ASC "iPhone 6.9 Display" — preferred size in Connect today
  resizePng(src, join(uploadRoot, "iphone-6.9", file), 1320, 2868);
  resizePng(src, join(uploadRoot, "iphone-6.9", "alt-1290", file), 1290, 2796);
}

for (const file of shots.filter((s) => s.file.startsWith("ipad-")).map((s) => s.file)) {
  copyFileSync(join(outDir, file), join(uploadRoot, "ipad-12.9", file));
}

copyFileSync(join(outDir, "iphone-07-pro.png"), join(uploadRoot, "iap-review", "iphone-07-pro.png"));
copyFileSync(
  join(outDir, "iphone-08-delete-account.png"),
  join(uploadRoot, "iap-review", "iphone-08-delete-account.png"),
);
resizePng(join(outDir, "iphone-07-pro.png"), join(uploadRoot, "iap-review", "iphone-07-pro-1320.png"), 1320, 2868);

mkdirSync(marketingDir, { recursive: true });
resizePng(join(outDir, "iphone-01-today.png"), join(marketingDir, "phone-01-today.png"), 1080, 1920);
resizePng(join(outDir, "iphone-02-voice.png"), join(marketingDir, "phone-02-voice.png"), 1080, 1920);
resizePng(join(outDir, "iphone-03-life-graph.png"), join(marketingDir, "phone-03-life-graph.png"), 1080, 1920);

const manifest = `# MotiveLife App Store upload pack (iOS only)

| Folder | Size | ASC slot |
|--------|------|----------|
| \`iphone-6.9/\` | **1320×2868** | **iPhone 6.9" Display** |
| \`iphone-6.5/\` | **1284×2778** | **iPhone 6.5" Display** |
| \`ipad-12.9/\` | 2048×2732 | iPad Pro 12.9" |
| \`iap-review/\` | 1284×2778 | Subscription App Review screenshot |

See \`../UPLOAD_STEP_BY_STEP.md\`.
`;
writeFileSync(join(uploadRoot, "README.md"), manifest);

console.log(`\nDone — upload pack in ${uploadRoot}`);
