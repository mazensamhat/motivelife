# Puts MotiveLife ASC helper on your Desktop (no git required).
# Right-click → Run with PowerShell, or: irm <raw-url> | iex

$ErrorActionPreference = "Stop"
$dest = Join-Path $env:USERPROFILE "Desktop\asc-click-helper"
$base = "https://raw.githubusercontent.com/mazensamhat/motivelife/main/tools/asc-click-helper"

$files = @(
  "manifest.json",
  "README.md",
  "INSTALL-WINDOWS.md",
  "background.js",
  "put-on-desktop.ps1",
  "popup/popup.html",
  "options/options.html",
  "options/options.js",
  "content/overlay.css",
  "content/overlay.js",
  "content/page-reader.js",
  "content/steps.js",
  "content/coach.js"
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
Write-Host "chrome://extensions -> Load unpacked -> select that folder"
Write-Host "Then: Extension Options -> set ASC_HELPER_SECRET"
explorer.exe $dest
