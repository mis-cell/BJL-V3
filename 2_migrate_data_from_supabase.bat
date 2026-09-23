@echo off
title BJCL Raw Jute ERP - Data Migration
color 0B
echo ================================================================
echo    BJCL RAW JUTE ERP - STEP 2: MIGRATE DATA FROM SUPABASE
echo ================================================================
echo.

set /p PGPASS="Enter your PostgreSQL 'postgres' password: "
set PGPASSWORD=%PGPASS%
set DATABASE_URL=postgresql://postgres:%PGPASS%@localhost:5432/bjcl_db

echo.
echo [1/2] Checking dependencies...
call npm install --no-audit

echo.
echo [2/2] Migrating all tables, rows, and relations into bjcl_db...
node "%~dp0scripts\migrate_supabase_to_pg.cjs"

echo.
echo ================================================================
echo  DATA MIGRATION FINISHED!
echo ================================================================
echo Now double click '3_start_server.bat' to launch the ERP!
echo.
pause
