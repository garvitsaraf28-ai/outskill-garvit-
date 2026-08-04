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
echo  One-time setup: paste an API key. Two options:
echo    FREE  : OpenRouter key ^(sk-or-...^) from https://openrouter.ai/keys - no card needed
echo    PAID  : Claude key ^(sk-ant-...^) from https://console.anthropic.com - best quality
set /p KEY="Key: "
if "%KEY%"=="" (
  echo  No key entered - run this file again when you have one.
  pause
  exit /b 1
)
if "%KEY:~0,6%"=="sk-or-" (
  >.env echo OPENROUTER_API_KEY=%KEY%
  echo  Saved - running in FREE mode ^(OpenRouter^)
) else (
  >.env echo ANTHROPIC_API_KEY=%KEY%
  echo  Saved - running on Claude
)

:run
start "" http://localhost:8787
echo.
echo  Starting - your browser will open at http://localhost:8787
echo  Keep this window open while using the mentor. Close it to stop.
echo.
call npm start
