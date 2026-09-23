@echo off
title BJCL Raw Jute ERP - Database Setup
color 0A
echo ================================================================
echo    BJCL RAW JUTE ERP - STEP 1: INITIALIZE POSTGRESQL 18
echo ================================================================
echo.

set /p PGPASS="Enter your PostgreSQL 'postgres' password: "
set PGPASSWORD=%PGPASS%

echo.
echo [1/3] Creating database 'bjcl_db' in PostgreSQL 18...
"C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres -h localhost -p 5432 bjcl_db
if %errorlevel% neq 0 (
    echo (Note: Database bjcl_db may already exist, proceeding to schema initialization...)
)

echo.
echo [2/3] Importing complete tables, relations, and functions...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432 -d bjcl_db -f "%~dp0init_bjcl_db.sql"

echo.
echo [3/3] Opening Windows Firewall for Port 3000 and 5432...
powershell -Command "New-NetFirewallRule -DisplayName 'BJCL Web App (Port 3000)' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue"
powershell -Command "New-NetFirewallRule -DisplayName 'PostgreSQL 18 (Port 5432)' -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue"

echo.
echo ================================================================
echo  SUCCESS! Database bjcl_db is ready!
echo ================================================================
echo Now double click '2_migrate_data_from_supabase.bat' to copy your data.
echo.
pause
