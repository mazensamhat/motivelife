# Build signed MotiveLife Android App Bundle (AAB) for Play Console.
# Requires: Android Studio JBR, local.properties, keystore.properties

$ErrorActionPreference = "Stop"
$mobileRoot = Split-Path $PSScriptRoot -Parent
$androidRoot = Join-Path $mobileRoot "android"
$aabPath = Join-Path $androidRoot "app\build\outputs\bundle\release\app-release.aab"
$keystoreProps = Join-Path $androidRoot "keystore.properties"
$keystoreExample = Join-Path $androidRoot "keystore.properties.example"

$jbr = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path (Join-Path $jbr "bin\java.exe"))) {
  $jbr = Join-Path $env:LOCALAPPDATA "Programs\Android\Android Studio\jbr"
}
if (-not (Test-Path (Join-Path $jbr "bin\java.exe"))) {
  Write-Error "Android Studio JBR not found. Install Android Studio or set JAVA_HOME."
}

$env:JAVA_HOME = $jbr
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

if (-not (Test-Path $keystoreProps)) {
  Write-Host ""
  Write-Host "Missing keystore.properties — create it once:" -ForegroundColor Yellow
  Write-Host "  1. Copy:  keystore.properties.example  ->  keystore.properties"
  Write-Host "  2. Edit storePassword and keyPassword (motivelife-upload-v2.jks)"
  Write-Host "  3. Re-run: npm run build:android:release"
  Write-Host ""
  if (Test-Path $keystoreExample) {
    Copy-Item $keystoreExample $keystoreProps
    Write-Host "Created $keystoreProps — edit passwords, then re-run this script." -ForegroundColor Cyan
  }
  exit 1
}

Write-Host "Syncing Capacitor..." -ForegroundColor Cyan
Push-Location $mobileRoot
npm run build:android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building release bundle (bundleRelease)..." -ForegroundColor Cyan
Push-Location $androidRoot
.\gradlew.bat bundleRelease --no-daemon
$code = $LASTEXITCODE
Pop-Location
Pop-Location

if ($code -ne 0) {
  Write-Error "Gradle build failed (exit $code)."
}

if (-not (Test-Path $aabPath)) {
  Write-Error "AAB not found at $aabPath"
}

$info = Get-Item $aabPath
Write-Host ""
Write-Host "Success — upload this file to Play Console:" -ForegroundColor Green
Write-Host "  $($info.FullName)"
Write-Host "  $([math]::Round($info.Length / 1MB, 2)) MB · $($info.LastWriteTime)"
Write-Host ""
Write-Host "Version: check android/app/build.gradle (versionCode / versionName)"
