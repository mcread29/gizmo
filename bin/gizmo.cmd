@echo off
setlocal
set "GIZMO_ROOT=%~dp0.."
node "%GIZMO_ROOT%\node_modules\tsx\dist\cli.mjs" "%GIZMO_ROOT%\scripts\gizmo.ts" %*
exit /b %errorlevel%
