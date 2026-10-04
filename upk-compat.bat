@echo off
setlocal
chcp 65001 >nul
set "LID_COMPAT_NODE=%ProgramFiles%\nodejs\node.exe"
if exist "%LID_COMPAT_NODE%" goto run_compat
set "LID_COMPAT_NODE=node.exe"
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
:run_compat
"%LID_COMPAT_NODE%" --no-warnings "%~dp0upk-compat.js" %*
set "LID_COMPAT_EXIT=%ERRORLEVEL%"
pause
exit /b %LID_COMPAT_EXIT%
:missing_node
echo Node.js 22.5+ is required.
pause
exit /b 1
