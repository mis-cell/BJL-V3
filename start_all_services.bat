@echo off
title BJCL Full-Stack ERP - Windows Server 2022
color 0A
echo ================================================================
echo    BALLY JUTE COMPANY LIMITED - PRODUCTION ERP RUNNER
echo ================================================================
echo.
echo Server Local IP:  192.168.1.5
echo Database:         PostgreSQL 18 (bjcl_db)
echo.
echo Starting Backend API on http://192.168.1.5:5000 ...
start "BJCL-Backend-API" cmd /k "cd /d %~dp0Backend && npm start"

echo Starting Frontend on http://192.168.1.5:3000 ...
start "BJCL-Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ================================================================
echo  SERVICES LAUNCHED!
echo ================================================================
echo  Access from this server:       http://localhost:3000
echo  Access from other LAN PCs:     http://192.168.1.5:3000
echo ================================================================
echo.
