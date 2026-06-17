@echo off
cd /d "%~dp0"

where go >nul 2>nul
if errorlevel 1 (
    echo Go is not installed. Install from https://go.dev/dl/
    pause
    exit /b 1
)

if not exist ".env" (
    echo Copy env.example to .env and fill in your keys.
    echo   copy env.example .env
)

echo Starting Go API at http://localhost:8080
go run .
pause
