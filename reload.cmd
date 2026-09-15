@echo off
setlocal
cd /d "%~dp0"
call pnpm web:update %*
exit /b %errorlevel%
