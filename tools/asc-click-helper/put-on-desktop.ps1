# Puts MotiveLife ASC helper on your Desktop (no git required).
# Right-click → Run with PowerShell, or: irm <raw-url> | iex
#
# Floating mouse coach lives on this branch until PR #29 merges.
# After merge, set:  $env:ASC_HELPER_REF = "main"

$ErrorActionPreference = "Stop"
$dest = Join-Path $env:USERPROFILE "Desktop\asc-click-helper"
$ref = if ($env:ASC_HELPER_REF) { $env:ASC_HELPER_REF } else { "cursor/asc-helper-coach-cursor-13b9" }
$base = "https://raw.githubusercontent.com/mazensamhat/motivelife/$ref/tools/asc-click-helper"
$bust = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "Downloading MotiveLife ASC helper from ref: $ref"

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
  Invoke-WebRequest -Uri "$base/$rel`?t=$bust" -OutFile $out -UseBasicParsing
}

$manifest = Get-Content (Join-Path $dest "manifest.json") -Raw | ConvertFrom-Json
$coachPath = Join-Path $dest "content\coach.js"
if (-not (Test-Path $coachPath)) {
  throw "coach.js missing — wrong ref or incomplete download. Ref was: $ref"
}
if ($manifest.version -lt "1.5.1") {
  throw "Got extension $($manifest.version) but need 1.5.1+. Ref was: $ref"
}

Write-Host ""
Write-Host "Done. Version $($manifest.version)  Folder: $dest"
Write-Host "chrome://extensions -> Remove old helper if needed -> Load unpacked -> select that folder"
Write-Host "Or if already loaded: click Reload, then hard-refresh ASC (Ctrl+Shift+R)"
Write-Host "Then: Extension Options -> set ASC_HELPER_SECRET"
explorer.exe $dest
