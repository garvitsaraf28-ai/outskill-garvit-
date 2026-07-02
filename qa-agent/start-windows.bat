@echo off
rem Outskill AI Mentor - double-click to run (Windows).
cd /d "%~dp0"
title Outskill AI Mentor
echo.
echo  Outskill AI Mentor
echo  ------------------

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is required ^(free^). Install the LTS from https://nodejs.org
  echo  then double-click this file again.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo  Node.js %%v OK

echo  Installing dependencies (first run takes about a minute)...
call npm install --no-audit --no-fund --loglevel=error

if exist .env goto run
echo.
echo  One-time setup: paste an Anthropic API key.
echo  (Get one at https://console.anthropic.com - API Keys - Create Key)
set /p KEY="Key: "
if "%KEY%"=="" (
  echo  No key entered - run this file again when you have one.
  pause
  exit /b 1
)
>.env echo ANTHROPIC_API_KEY=%KEY%
echo  Saved (only on this computer, in .env)

:run
start "" http://localhost:8787
echo.
echo  Starting - your browser will open at http://localhost:8787
echo  Keep this window open while using the mentor. Close it to stop.
echo.
call npm start
