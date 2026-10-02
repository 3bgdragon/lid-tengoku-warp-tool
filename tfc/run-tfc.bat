@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Vending uses Node.js 22.13 or newer.
  pause
  exit /b 1
)
node "%~dp0companion.js" %*
set "LID_TFC_EXIT=%errorlevel%"
pause
exit /b %LID_TFC_EXIT%
