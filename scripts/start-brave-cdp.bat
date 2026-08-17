@echo off
echo ============================================
echo   Flux Browser Control - CDP Setup
echo ============================================
echo.
echo This will close ALL Brave windows and relaunch
echo with remote debugging enabled for Flux.
echo.
echo Your tabs will be restored by Brave's session
echo restore feature (make sure it's enabled in settings).
echo.
set /p CONFIRM="Continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Cancelled.
    exit /b 0
)
echo.

:: Kill all Brave processes
echo Closing existing Brave instances...
taskkill /F /IM brave.exe /T >nul 2>&1
timeout /t 2 >nul

:: Try common Brave install locations
set "BRAVE_PATH="

if exist "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BRAVE_PATH=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
) else if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BRAVE_PATH=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
)

if "%BRAVE_PATH%"=="" (
    echo ERROR: Brave not found in common locations.
    echo Please install Brave or edit this script with the correct path.
    pause
    exit /b 1
)

echo Found Brave: %BRAVE_PATH%
echo.

:: Launch Brave with CDP
echo Launching Brave with remote debugging on port 9222...
start "" "%BRAVE_PATH%" --remote-debugging-port=9222

:: Wait for CDP to become available
echo Waiting for CDP to become available...
set /a RETRIES=0
:WAIT_LOOP
timeout /t 1 >nul
netstat -an | findstr ":9222" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo.
    echo ============================================
    echo   CDP is ready on port 9222!
    echo ============================================
    echo.
    echo Flux can now control your Brave browser.
    echo All your tabs, sessions, and logged-in state
    echo are accessible.
    echo.
    echo You can close this window.
    exit /b 0
)
set /a RETRIES+=1
if %RETRIES% GEQ 15 (
    echo.
    echo ERROR: CDP did not become available within 15 seconds.
    echo Brave may have failed to start with debugging enabled.
    echo Try launching Brave manually with:
    echo   "%BRAVE_PATH%" --remote-debugging-port=9222
    pause
    exit /b 1
)
echo   Waiting... (%RETRIES%/15)
goto WAIT_LOOP
