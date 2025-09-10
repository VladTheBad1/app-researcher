@echo off

set REPO_URL=https://github.com/Gravicity/SAZ-CCPM.git
set TEMP_DIR=.saz_temp_%RANDOM%

echo Installing SAZ-CCPM...

rem Clone to temp directory
echo Downloading framework...
git clone %REPO_URL% %TEMP_DIR% 2>nul

if %ERRORLEVEL% EQU 0 (
    echo Download complete
    
    rem Create directories
    if not exist .claude\saz-docs mkdir .claude\saz-docs
    
    rem Move ONLY framework documentation to safe location
    echo Organizing framework files...
    if exist %TEMP_DIR%\README.md move %TEMP_DIR%\README.md .claude\saz-docs\ >nul 2>&1
    if exist %TEMP_DIR%\LICENSE move %TEMP_DIR%\LICENSE .claude\saz-docs\LICENSE.md >nul 2>&1
    if exist %TEMP_DIR%\AGENTS.md move %TEMP_DIR%\AGENTS.md .claude\saz-docs\ >nul 2>&1
    if exist %TEMP_DIR%\COMMANDS.md move %TEMP_DIR%\COMMANDS.md .claude\saz-docs\ >nul 2>&1
    if exist %TEMP_DIR%\CHANGELOG.md move %TEMP_DIR%\CHANGELOG.md .claude\saz-docs\ >nul 2>&1
    if exist %TEMP_DIR%\screenshot.webp move %TEMP_DIR%\screenshot.webp .claude\saz-docs\ >nul 2>&1
    
    rem Copy .claude contents
    xcopy /E /I /Y %TEMP_DIR%\.claude .claude >nul 2>&1
    
    rem Copy install directory for reference
    if exist %TEMP_DIR%\install xcopy /E /I /Y %TEMP_DIR%\install .claude\saz-docs\install >nul 2>&1
    
    rem Cleanup
    rmdir /s /q %TEMP_DIR% 2>nul
    
    echo SAZ-CCPM installed successfully!
    echo Documentation: .claude\saz-docs\
    echo Next: Run '/pm:init' to initialize project management
) else (
    echo Installation failed
    rmdir /s /q %TEMP_DIR% 2>nul
    exit /b 1
)