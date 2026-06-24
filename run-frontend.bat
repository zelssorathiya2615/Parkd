@echo off
echo =======================================================
echo Opening Parkd Application
echo =======================================================
echo Ensure you have started the backend using run-backend.bat
echo first, otherwise the application will not load properly.
echo.
timeout /t 2
start http://localhost:3000/index.html
