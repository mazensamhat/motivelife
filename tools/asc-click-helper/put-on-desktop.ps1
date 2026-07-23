# Puts MotiveLife ASC helper on your Desktop (no git required).
# Right-click → Run with PowerShell, or paste into PowerShell.

$ErrorActionPreference = "Stop"
$dest = Join-Path $env:USERPROFILE "Desktop\asc-click-helper"
$base = "https://raw.githubusercontent.com/mazensamhat/motivelife/main/tools/asc-click-helper"

$files = @(
  "manifest.json",
  "README.md",
  "INSTALL-WINDOWS.md",
  "popup/popup.html",
  "content/overlay.css",
  "content/overlay.js",
  "content/page-reader.js",
  "content/steps.js"
)

foreach ($rel in $files) {
  $out = Join-Path $dest ($rel -replace "/", "\")
  $dir = Split-Path $out -Parent
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Write-Host "Downloading $rel ..."
  Invoke-WebRequest -Uri "$base/$rel" -OutFile $out -UseBasicParsing
}

Write-Host ""
Write-Host "Done. Folder: $dest"
Write-Host "Next: chrome://extensions -> Developer mode ON -> Load unpacked -> select that folder"
explorer.exe $dest
