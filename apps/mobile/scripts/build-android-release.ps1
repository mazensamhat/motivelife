# Build signed MotiveLife Android App Bundle (AAB) for Play Console.
# Requires: Android Studio JBR, local.properties, keystore.properties, upload .jks

$ErrorActionPreference = "Stop"
$mobileRoot = Split-Path $PSScriptRoot -Parent
$androidRoot = Join-Path $mobileRoot "android"
$aabPath = Join-Path $androidRoot "app\build\outputs\bundle\release\app-release.aab"
$keystoreProps = Join-Path $androidRoot "keystore.properties"
$keystoreExample = Join-Path $androidRoot "keystore.properties.example"
$keystoreDir = Join-Path $androidRoot "keystore"
$keystoreJks = Join-Path $keystoreDir "motivelife-upload-v2.jks"

$jbr = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path (Join-Path $jbr "bin\java.exe"))) {
  $jbr = Join-Path $env:LOCALAPPDATA "Programs\Android\Android Studio\jbr"
}
if (-not (Test-Path (Join-Path $jbr "bin\java.exe"))) {
  Write-Error "Android Studio JBR not found. Install Android Studio or set JAVA_HOME."
}

$env:JAVA_HOME = $jbr
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

function Open-InEditor([string]$path) {
  if (Get-Command notepad.exe -ErrorAction SilentlyContinue) {
    Start-Process notepad.exe $path
  }
}

if (-not (Test-Path $keystoreProps)) {
  if (Test-Path $keystoreExample) {
    Copy-Item $keystoreExample $keystoreProps
  } else {
    Write-Error "Missing $keystoreExample"
  }
}

$propsText = Get-Content $keystoreProps -Raw
$needsPasswords = $propsText -match "REPLACE_ME" -or $propsText -notmatch "storePassword=\S+"

if ($needsPasswords -or -not (Test-Path $keystoreJks)) {
  Write-Host ""
  Write-Host "STOP: signing is not set up yet." -ForegroundColor Yellow
  Write-Host ""

  if (-not (Test-Path $keystoreJks)) {
    Write-Host "Missing keystore file:" -ForegroundColor Red
    Write-Host "  $keystoreJks"
    Write-Host ""
    Write-Host "Find motivelife-upload-v2.jks on this PC (Downloads, Bitwarden attachments, backup drive),"
    Write-Host "then copy it here:"
    Write-Host "  $keystoreDir"
    if (-not (Test-Path $keystoreDir)) {
      New-Item -ItemType Directory -Path $keystoreDir | Out-Null
      Write-Host "Created that folder for you."
    }
    Write-Host ""
  } else {
    Write-Host "Keystore file OK:" -ForegroundColor Green
    Write-Host "  $keystoreJks"
    Write-Host ""
  }

  Write-Host "Edit this file (opening Notepad now):" -ForegroundColor Cyan
  Write-Host "  $keystoreProps"
  Write-Host ""
  Write-Host "Change ONLY these two lines to the real passwords from your password manager:"
  Write-Host "  storePassword=..."
  Write-Host "  keyPassword=..."
  Write-Host ""
  Write-Host "Leave these alone:"
  Write-Host "  storeFile=../keystore/motivelife-upload-v2.jks"
  Write-Host "  keyAlias=motivelife"
  Write-Host ""
  Write-Host "Save the file, then run again:"
  Write-Host "  npm run build:android:release"
  Write-Host ""
  Open-InEditor $keystoreProps
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
Write-Host "Done. Upload this AAB to Play Console:" -ForegroundColor Green
Write-Host "  $($info.FullName)"
Write-Host ("  {0} MB - {1}" -f ([math]::Round($info.Length / 1MB, 2)), $info.LastWriteTime)
Write-Host ""
Write-Host "versionCode/versionName: android/app/build.gradle"
