@echo off
echo =======================================================
echo Parkd Backend Server
echo =======================================================
echo Installing dependencies if needed...
call npm install
echo.
echo Starting server...
npm start
pause
