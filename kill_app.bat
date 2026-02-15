@echo off
echo Killing all Node.js and PHP processes...
taskkill /F /IM node.exe
taskkill /F /IM php.exe
echo Done! All tasks killed.
pause
