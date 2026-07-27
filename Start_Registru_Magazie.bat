@echo off
title Registru Magazie Utilaje - Server Local
cd /d "%~dp0"
echo =======================================================
echo    PORNIRE REGISTRU MAGAZIE UTILAJE (APLICATIE LOCALA)
echo =======================================================
echo Serverul ruleaza pe: http://localhost:3000
echo.
start http://localhost:3000
node server.js
pause
