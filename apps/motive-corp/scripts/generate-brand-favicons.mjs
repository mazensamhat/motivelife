/**
 * Crop brand marks from full logos and write favicon sets for Motive sites.
 * Run from apps/motive-corp (where sharp is installed):
 *   node scripts/generate-brand-favicons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file lives at apps/motive-corp/scripts → monorepo root is ../..
const CORP_APP = path.join(__dirname, "..");
const ROOT = path.join(CORP_APP, "..", "..");
const WORK = path.join(__dirname, ".favicon-work");
const ASSETS = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-Mazen-Documents-motivelife-ai",
  "assets",
);

function findAsset(pattern) {
  const files = fs.readdirSync(ASSETS).filter((f) => f.includes(pattern) && f.endsWith(".png"));
  files.sort();
  const hit = files.find((f) => f.includes(pattern)) || files[0];
  if (!hit) throw new Error(`Asset not found for pattern: ${pattern}`);
  return path.join(ASSETS, hit);
}

const SOURCES = {
  pulse: findAsset("ChatGPT_Image_Jul_10__2026__11_38_23_PM-9b1f2fde"),
  corpFamily: findAsset("ChatGPT_Image_Jul_11__2026__08_15_43_PM-edc77f0d"),
  life: findAsset("ChatGPT_Image_Jul_2__2026__11_05_57_PM-dab036f2"),
  iq: findAsset("ChatGPT_Image_Jul_2__2026__11_04_29_PM-6f511325"),
  fx: findAsset("ChatGPT_Image_Jul_2__2026__11_04_24_PM-b23078e2"),
};

/** Crop top-center square mark from a full lockup (icon above wordmark). */
async function extractMark(src, { topRatio = 0.05, heightRatio = 0.42 } = {}) {
  const meta = await sharp(src).metadata();
  const W = meta.width;
  const H = meta.height;
  const markH = Math.round(H * heightRatio);
  const markTop = Math.round(H * topRatio);
  const markW = markH;
  const markLeft = Math.round((W - markW) / 2);
  return sharp(src)
    .extract({
      left: Math.max(0, markLeft),
      top: Math.max(0, markTop),
      width: Math.min(markW, W - Math.max(0, markLeft)),
      height: Math.min(markH, H - Math.max(0, markTop)),
    })
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png();
}

/** Crop gold Motive-Corp M from the family collage (top half, centered). */
async function extractCorpFromFamily(src) {
  const meta = await sharp(src).metadata();
  const W = meta.width;
  const H = meta.height;
  const box = {
    left: Math.round(W * 0.28),
    top: Math.round(H * 0.04),
    width: Math.round(W * 0.44),
    height: Math.round(H * 0.32),
  };
  return sharp(src)
    .extract(box)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png();
}

async function writeSizes(markPipeline, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const base = await markPipeline.toBuffer();

  const sizes = [
    { name: "icon.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "favicon-32.png", size: 32 },
    { name: "favicon-48.png", size: 48 },
    { name: "favicon.png", size: 32 },
  ];

  for (const { name, size } of sizes) {
    const out = path.join(outDir, name);
    await sharp(base)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .png()
      .toFile(out);
    console.log("  wrote", out);
  }

  try {
    await sharp(base)
      .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .toFormat("ico")
      .toFile(path.join(outDir, "favicon.ico"));
    console.log("  wrote favicon.ico");
  } catch {
    // PNG favicons are enough for Next/Vercel; copy 32px as favicon.ico is invalid.
    console.log("  (no ico encoder — PNG favicons only)");
  }

  await sharp(base).png().toFile(path.join(outDir, "mark-1024.png"));
  return base;
}

async function copyInto(files, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const [srcName, destName] of files) {
    const dest = path.join(destDir, destName);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(srcName, dest);
    console.log("  copy", dest);
  }
}

function copyIfIco(srcDir, destPath) {
  const ico = path.join(srcDir, "favicon.ico");
  if (fs.existsSync(ico)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(ico, destPath);
    console.log("  copy", destPath);
  }
}

async function main() {
  console.log("Monorepo root:", ROOT);
  console.log("Sources:");
  for (const [k, v] of Object.entries(SOURCES)) console.log(`  ${k}: ${v}`);

  fs.mkdirSync(WORK, { recursive: true });

  console.log("\n[corp]");
  const corpDir = path.join(WORK, "corp");
  await writeSizes(await extractCorpFromFamily(SOURCES.corpFamily), corpDir);
  const corpBrandDir = path.join(CORP_APP, "public", "brand");
  fs.mkdirSync(corpBrandDir, { recursive: true });
  fs.copyFileSync(SOURCES.corpFamily, path.join(corpBrandDir, "motive-corp-family.png"));

  console.log("\n[pulse]");
  const pulseDir = path.join(WORK, "pulse");
  await writeSizes(await extractMark(SOURCES.pulse, { topRatio: 0.06, heightRatio: 0.4 }), pulseDir);

  console.log("\n[life]");
  const lifeDir = path.join(WORK, "life");
  await writeSizes(await extractMark(SOURCES.life, { topRatio: 0.05, heightRatio: 0.42 }), lifeDir);

  console.log("\n[iq]");
  const iqDir = path.join(WORK, "iq");
  await writeSizes(await extractMark(SOURCES.iq, { topRatio: 0.05, heightRatio: 0.42 }), iqDir);

  console.log("\n[fx]");
  const fxDir = path.join(WORK, "fx");
  await writeSizes(await extractMark(SOURCES.fx, { topRatio: 0.05, heightRatio: 0.42 }), fxDir);

  // ========== Deploy into site trees ==========

  console.log("\n→ motive-corp");
  const corpAppDir = path.join(CORP_APP, "src", "app");
  const corpPublic = path.join(CORP_APP, "public");
  await copyInto(
    [
      [path.join(corpDir, "icon.png"), "icon.png"],
      [path.join(corpDir, "apple-touch-icon.png"), "apple-touch-icon.png"],
      [path.join(corpDir, "favicon.png"), "favicon.png"],
    ],
    corpAppDir,
  );
  copyIfIco(corpDir, path.join(corpAppDir, "favicon.ico"));
  await copyInto(
    [
      [path.join(corpDir, "apple-touch-icon.png"), "apple-touch-icon.png"],
      [path.join(corpDir, "icon-192.png"), "icon-192.png"],
      [path.join(corpDir, "icon-512.png"), "icon-512.png"],
      [path.join(corpDir, "mark-1024.png"), path.join("brand", "motive-corp-mark.png")],
    ],
    corpPublic,
  );

  console.log("\n→ motivelife web");
  const lifeApp = path.join(ROOT, "apps", "web", "src", "app");
  const lifePublic = path.join(ROOT, "apps", "web", "public");
  await copyInto(
    [
      [path.join(lifeDir, "icon.png"), "icon.png"],
      [path.join(lifeDir, "apple-touch-icon.png"), "apple-touch-icon.png"],
    ],
    lifeApp,
  );
  copyIfIco(lifeDir, path.join(lifeApp, "favicon.ico"));
  await copyInto(
    [
      [path.join(lifeDir, "mark-1024.png"), path.join("brand", "logo-icon.png")],
      [path.join(lifeDir, "apple-touch-icon.png"), path.join("icons", "apple-touch-icon.png")],
      [path.join(lifeDir, "icon-192.png"), path.join("icons", "icon-192.png")],
      [path.join(lifeDir, "icon-512.png"), path.join("icons", "icon-512.png")],
    ],
    lifePublic,
  );

  console.log("\n→ motivepulse-iq");
  const pulseRoot = path.join(ROOT, "..", "motivepulse-iq");
  const pulseApp = path.join(pulseRoot, "src", "app");
  const pulsePublic = path.join(pulseRoot, "public");
  await copyInto(
    [
      [path.join(pulseDir, "icon.png"), "icon.png"],
      [path.join(pulseDir, "apple-touch-icon.png"), "apple-touch-icon.png"],
      [path.join(pulseDir, "favicon.png"), "favicon.png"],
    ],
    pulseApp,
  );
  copyIfIco(pulseDir, path.join(pulseApp, "favicon.ico"));
  // Replace default Next favicon.ico with our PNG-based icon.png (Next prefers icon.png)
  await copyInto(
    [
      [path.join(pulseDir, "mark-1024.png"), path.join("brand", "motivepulse-mark.png")],
      [path.join(pulseDir, "apple-touch-icon.png"), "apple-touch-icon.png"],
      [path.join(pulseDir, "icon-192.png"), "icon-192.png"],
      [path.join(pulseDir, "icon-512.png"), "icon-512.png"],
      [SOURCES.pulse, path.join("brand", "motivepulse-iq-logo.png")],
    ],
    pulsePublic,
  );

  console.log("\n→ motivefx");
  const fxRoot = path.join(ROOT, "..", "motivefx-ai", "apps", "site");
  const fxApp = path.join(fxRoot, "src", "app");
  const fxPublicBrand = path.join(fxRoot, "public", "brand");
  await copyInto(
    [
      [path.join(fxDir, "icon.png"), "icon.png"],
      [path.join(fxDir, "apple-touch-icon.png"), "apple-touch-icon.png"],
    ],
    fxApp,
  );
  copyIfIco(fxDir, path.join(fxApp, "favicon.ico"));
  await copyInto(
    [
      [path.join(fxDir, "mark-1024.png"), "motivefx-icon.png"],
      [SOURCES.fx, "motivefx-logo.png"],
      [path.join(fxDir, "apple-touch-icon.png"), "apple-touch-icon.png"],
      [path.join(fxDir, "icon-192.png"), "icon-192.png"],
      [path.join(fxDir, "icon-512.png"), "icon-512.png"],
    ],
    fxPublicBrand,
  );
  for (const termBrand of [
    path.join(fxRoot, "public", "terminal", "brand"),
    path.join(fxRoot, "public", "terminal", "terminal", "brand"),
  ]) {
    if (fs.existsSync(path.dirname(termBrand))) {
      fs.mkdirSync(termBrand, { recursive: true });
      fs.copyFileSync(path.join(fxDir, "mark-1024.png"), path.join(termBrand, "motivefx-icon.png"));
      fs.copyFileSync(SOURCES.fx, path.join(termBrand, "motivefx-logo.png"));
    }
  }

  console.log("\n→ motiveiq");
  const iqPublic = path.join(ROOT, "..", "motiveiq_clean", "frontend", "public");
  await copyInto(
    [
      [path.join(iqDir, "favicon.png"), "favicon.png"],
      [path.join(iqDir, "favicon-32.png"), "favicon-32.png"],
      [path.join(iqDir, "apple-touch-icon.png"), "apple-touch-icon.png"],
      [path.join(iqDir, "mark-1024.png"), "motiveiq-icon.png"],
      [SOURCES.iq, "motiveiq-logo.png"],
      [path.join(iqDir, "icon-192.png"), "icon-192.png"],
      [path.join(iqDir, "icon-512.png"), "icon-512.png"],
    ],
    iqPublic,
  );

  console.log("\nDone. Preview marks in", WORK);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
