# Build MotiveLife preview ONLY from the location-fix branch.
# Fails fast if app.json is not 1.0.14+ (prevents installing ancient 1.0.4 IPAs).
param(
  [ValidateSet("ios", "android", "all")]
  [string]$Platform = "all"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MobileEas = Resolve-Path (Join-Path $ScriptDir "..")
$RepoRoot = Resolve-Path (Join-Path $MobileEas "..\..")
$Branch = "cursor/ios-always-location-motivefx-13b9"
$RequiredVersion = "1.0.14"

Set-Location $RepoRoot
Write-Host "Repo: $RepoRoot" -ForegroundColor Cyan

git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw "git fetch failed. Is origin pointing at mazensamhat/motivelife?" }

git checkout $Branch
if ($LASTEXITCODE -ne 0) {
  git checkout -B $Branch "origin/$Branch"
  if ($LASTEXITCODE -ne 0) { throw "Could not checkout $Branch" }
}

git pull origin $Branch
if ($LASTEXITCODE -ne 0) { throw "git pull failed" }

$Head = (git rev-parse --short HEAD).Trim()
$OnBranch = (git branch --show-current).Trim()
Write-Host "HEAD=$Head branch=$OnBranch" -ForegroundColor Cyan

if ($OnBranch -ne $Branch) {
  throw "Still on '$OnBranch', expected '$Branch'. Aborting so we do not build the wrong IPA."
}

Set-Location $MobileEas
$AppJsonPath = Join-Path $MobileEas "app.json"
$AppJson = Get-Content $AppJsonPath -Raw | ConvertFrom-Json
$Version = [string]$AppJson.expo.version
$BuildNumber = [string]$AppJson.expo.ios.buildNumber
$HasAlways = (Get-Content $AppJsonPath -Raw) -match "NSLocationAlwaysAndWhenInUseUsageDescription"
$HasExpoLocation = (Get-Content $AppJsonPath -Raw) -match '"expo-location"'

Write-Host "app.json version=$Version ios.buildNumber=$BuildNumber" -ForegroundColor Cyan
Write-Host "Always key present=$HasAlways  expo-location plugin=$HasExpoLocation" -ForegroundColor Cyan

if ($Version -ne $RequiredVersion) {
  throw "Refusing to build: version is $Version, need $RequiredVersion. You are not on the location-fix commit."
}
if (-not $HasAlways) {
  throw "Refusing to build: NSLocationAlwaysAndWhenInUseUsageDescription missing from app.json."
}
if (-not $HasExpoLocation) {
  throw "Refusing to build: expo-location plugin missing from app.json."
}

Write-Host "OK — building $Version ($BuildNumber) from $Head" -ForegroundColor Green
Write-Host "On the Expo page you MUST see Version $Version ($BuildNumber) and commit $Head before installing." -ForegroundColor Yellow

function Invoke-EasBuild([string]$Plat) {
  Write-Host "`n=== eas build --platform $Plat --profile preview ===" -ForegroundColor Cyan
  npx eas-cli@latest build --platform $Plat --profile preview --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "eas build $Plat failed" }
}

if ($Platform -eq "ios" -or $Platform -eq "all") { Invoke-EasBuild "ios" }
if ($Platform -eq "android" -or $Platform -eq "all") { Invoke-EasBuild "android" }

Write-Host "`nDone. Install ONLY the build that shows $Version ($BuildNumber)." -ForegroundColor Green
