@echo off
echo =======================================================
echo Parkd Database Initialization
echo =======================================================
echo This script will initialize the Oracle database.
echo Ensure your .env file is configured correctly with:
echo DB_USER, DB_PASSWORD, and DB_CONNECT_STRING
echo.

node -e "require('dotenv').config(); const c = 'sqlplus ' + process.env.DB_USER + '/' + process.env.DB_PASSWORD + '@' + process.env.DB_CONNECT_STRING + ' @init_db.sql'; const { execSync } = require('child_process'); try { execSync(c, {stdio: 'inherit'}); } catch(e) { console.error('SQLPlus Error'); }"

echo.
echo Running Password Hasher...
node database/set_passwords.js

echo.
echo Database Initialization Complete!
pause
