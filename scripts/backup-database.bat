@echo off
REM ==============================================================================
REM CFECC STORES - Automated Daily PostgreSQL Database Backup Script
REM Society: Coromandel Fertilisers Employees Co-operative Consumers Society Ltd.
REM ==============================================================================

setlocal enabledelayedexpansion

REM --- 1. CONFIGURATION ---
set PG_BIN="C:\Program Files\PostgreSQL\16\bin"
set DB_NAME=cfecc_db
set DB_USER=postgres
set DB_HOST=127.0.0.1
set DB_PORT=5432
REM Set your PostgreSQL password below:
set PGPASSWORD=YourPostgresPasswordHere

REM Backup Storage Directory (Local Drive / Secondary Drive)
set BACKUP_DIR=C:\CFECC_Backups
set RETENTION_DAYS=30

REM --- 2. CREATE BACKUP DIRECTORY IF NOT EXISTS ---
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

REM --- 3. FORMAT TIMESTAMP (YYYY-MM-DD_HH-MM-SS) ---
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set YYYY=%datetime:~0,4%
set MM=%datetime:~4,2%
set DD=%datetime:~6,2%
set HH=%datetime:~8,2%
set Min=%datetime:~10,2%
set Sec=%datetime:~12,2%
set TIMESTAMP=%YYYY%-%MM%-%DD%_%HH%-%Min%-%Sec%

set BACKUP_FILE=%BACKUP_DIR%\cfecc_backup_%TIMESTAMP%.sql

echo [CFECC Backup] Starting database backup at %DATE% %TIME%...
echo Target File: %BACKUP_FILE%

REM --- 4. EXECUTE PG_DUMP ---
%PG_BIN%\pg_dump.exe -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -F c -b -v -f "%BACKUP_FILE%" %DB_NAME%

if %ERRORLEVEL% EQU 0 (
    echo [CFECC Backup] Backup SUCCESSFUL: %BACKUP_FILE%
) else (
    echo [CFECC Backup] ERROR: Backup failed with error code %ERRORLEVEL%!
    pause
    exit /b %ERRORLEVEL%
)

REM --- 5. CLEAN UP OLD BACKUPS (Keep last 30 days) ---
echo [CFECC Backup] Pruning backups older than %RETENTION_DAYS% days...
forfiles /p "%BACKUP_DIR%" /m cfecc_backup_*.sql /d -%RETENTION_DAYS% /c "cmd /c del @path" 2>nul

echo [CFECC Backup] Backup cycle completed successfully.
echo ==============================================================================

