@echo off
echo Creating cat feeder tracker project structure...

set ROOT=%USERPROFILE%\Documents\cat-feeder

mkdir "%ROOT%"
mkdir "%ROOT%\frontend"
mkdir "%ROOT%\frontend\app"
mkdir "%ROOT%\frontend\app\api"
mkdir "%ROOT%\frontend\app\api\feedings"
mkdir "%ROOT%\frontend\components"
mkdir "%ROOT%\frontend\lib"
mkdir "%ROOT%\esp32"

:: Frontend files
type nul > "%ROOT%\frontend\app\page.tsx"
type nul > "%ROOT%\frontend\app\layout.tsx"
type nul > "%ROOT%\frontend\app\globals.css"
type nul > "%ROOT%\frontend\app\api\feedings\route.ts"
type nul > "%ROOT%\frontend\components\FeedingLog.tsx"
type nul > "%ROOT%\frontend\components\LastFed.tsx"
type nul > "%ROOT%\frontend\lib\supabase.ts"
type nul > "%ROOT%\frontend\.env.local"
type nul > "%ROOT%\frontend\package.json"
type nul > "%ROOT%\frontend\next.config.js"

:: ESP32 files
type nul > "%ROOT%\esp32\cat_feeder.ino"
type nul > "%ROOT%\esp32\config.h"

echo.
echo Done! Project created at %ROOT%
echo.
echo Structure:
echo cat-feeder/
echo   frontend/
echo     app/
echo       page.tsx
echo       layout.tsx
echo       globals.css
echo       api/feedings/route.ts
echo     components/
echo       FeedingLog.tsx
echo       LastFed.tsx
echo     lib/
echo       supabase.ts
echo     .env.local
echo     package.json
echo     next.config.js
echo   esp32/
echo     cat_feeder.ino
echo     config.h
echo.
pause
