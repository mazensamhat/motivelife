import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "standalone/styles.css"), "utf8");
const engine = fs.readFileSync(path.join(root, "standalone/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "standalone/app.js"), "utf8");
const seed = fs.readFileSync(path.join(root, "public/data/mazen-recap.json"), "utf8");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PM Intel | Dealer engagement</title>
<style>
${css}
</style>
</head>
<body>
<div class="wrap" id="app">Loading local recap…</div>
<script id="report-data" type="application/json">${seed}</script>
<script>
${engine}
${app}
</script>
</body>
</html>
`;

const out = path.join(root, "Mazen_PM_Intelligence.html");
fs.writeFileSync(out, html);
console.log("wrote", out, "bytes", fs.statSync(out).size);
