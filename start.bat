@echo off
echo 🚀 Starting GameBackend API...
echo.

where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Bun is not installed. Installing dependencies with npm instead...
    npm install
    npm run dev
) else (
    echo ✅ Bun detected
    echo 📦 Installing dependencies...
    bun install
    echo.
    echo 🔥 Starting development server...
    bun dev
)

