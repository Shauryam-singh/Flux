@echo off
echo Starting Brave with remote debugging on port 9222...
echo.
echo This enables Flux to control your real browser with
echo all your tabs, sessions, and logged-in state.
echo.
echo Close this window to keep Brave running, or press Ctrl+C to stop.
echo.

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
    echo.
    echo Common paths:
    echo   C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe
    echo   %LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe
    pause
    exit /b 1
)

echo Found Brave: %BRAVE_PATH%
echo.

start "" "%BRAVE_PATH%" --remote-debugging-port=9222

echo Brave launched with CDP on port 9222.
echo Flux can now control your browser.
echo.
timeout /t 3 >nul
