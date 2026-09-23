@echo off
title BJCL Raw Jute ERP - Server Running
color 0E
echo ================================================================
echo    BJCL RAW JUTE ERP - STEP 3: STARTING LOCAL SERVER
echo ================================================================
echo.

set PORT=3000
set HOST=0.0.0.0

echo Server is starting on port 3000...
echo.
echo ================================================================
echo Local Server URL:       http://localhost:3000
echo Network (LAN) URL:      http://0.0.0.0:3000
echo (Access from other PCs: http://YOUR_SERVER_STATIC_IP:3000)
echo ================================================================
echo.
echo DO NOT CLOSE THIS WINDOW WHILE RUNNING!
echo.

call npm run dev
pause
