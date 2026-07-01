# Copy from Firebase Console after registering Android app com.mymotivelife.app
# See docs/FIREBASE_AND_PLAY_TESTING.md

param(
  [Parameter(Mandatory = $true)]
  [string]$AabPath,
  [Parameter(Mandatory = $true)]
  [string]$FirebaseAppId,
  [string]$Group = "founding-testers",
  [string]$Notes = "MotiveLife beta build"
)

if (-not (Test-Path $AabPath)) {
  Write-Error "AAB not found: $AabPath"
  exit 1
}

firebase appdistribution:distribute $AabPath `
  --app $FirebaseAppId `
  --groups $Group `
  --release-notes $Notes
