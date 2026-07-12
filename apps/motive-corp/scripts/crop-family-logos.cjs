const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const brandDir = path.join(__dirname, "..", "public", "brand");
const src = path.join(brandDir, "motive-corp-family.png");

async function main() {
  const meta = await sharp(src).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log("Source metadata:", { width: W, height: H, format: meta.format });

  const corp = {
    left: Math.round(W * 0.15),
    top: Math.round(H * 0.02),
    width: Math.round(W * 0.70),
    height: Math.round(H * 0.46),
  };

  const rowTop = Math.round(H * 0.58);
  const rowHeight = Math.round(H * 0.30);
  const quarter = W / 4;
  const padX = Math.round(quarter * 0.06);
  const padY = Math.round(rowHeight * 0.04);

  function logoBox(index) {
    const left = Math.round(index * quarter + padX);
    const width = Math.round(quarter - 2 * padX);
    return {
      left,
      top: rowTop + padY,
      width,
      height: rowHeight - 2 * padY,
    };
  }

  const crops = [
    { name: "motive-corp-logo.png", box: corp },
    { name: "motivelife-from-family.png", box: logoBox(0) },
    { name: "motiveiq.png", box: logoBox(1) },
    { name: "motivefx-from-family.png", box: logoBox(2) },
    { name: "motivepulse-from-family.png", box: logoBox(3) },
  ];

  console.log("\nCrop boxes:");
  for (const c of crops) {
    console.log(`  ${c.name}:`, c.box);
  }

  for (const c of crops) {
    const out = path.join(brandDir, c.name);
    await sharp(src).extract(c.box).png().toFile(out);
    console.log(`Wrote ${c.name}`);
  }

  console.log("\n--- Verification ---");
  const all = fs
    .readdirSync(brandDir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort();
  for (const name of all) {
    const p = path.join(brandDir, name);
    const st = fs.statSync(p);
    const m = await sharp(p).metadata();
    console.log(`${name}: ${st.size} bytes, ${m.width}x${m.height} (${m.format})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
