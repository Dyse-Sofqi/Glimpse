@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [x] 未找到 node，请先安装 Node.js 并确保在 PATH 中
  pause
  exit /b 1
)
node "%~dp0login-cookie.js"
if errorlevel 1 (
  echo.
  pause
)
