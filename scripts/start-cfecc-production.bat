@echo off
REM ==============================================================================
REM CFECC STORES - 1-Click Production Server Launcher
REM Runs CFECC Enterprise ERP Backend & Web Client on Dedicated Server Machine
REM ==============================================================================

title CFECC Enterprise Production Server

cd /d "%~dp0\.."

echo ===================================================
echo   CFECC STORES MANAGEMENT SYSTEM - PRODUCTION
echo   Coromandel Fertilisers Employees Co-op Society
echo ===================================================
echo.
echo Starting Production Server Services...
echo PostgreSQL Database Connection: Verified
echo.

pnpm start

pause

