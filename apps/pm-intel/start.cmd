@echo off
setlocal
cd /d "%~dp0\..\.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install the LTS build from https://nodejs.org then close and reopen this window.
  pause
  exit /b 1
)

echo Enabling pnpm via Corepack...
call corepack enable
if errorlevel 1 (
  echo Corepack failed. If Node is older than 16.13, install a current LTS from https://nodejs.org
  pause
  exit /b 1
)
call corepack prepare pnpm@9.15.0 --activate

echo Installing workspace dependencies...
call pnpm install
if errorlevel 1 (
  echo pnpm install failed.
  pause
  exit /b 1
)

echo Starting PM Intel on http://localhost:3020
call pnpm pm-intel
pause
