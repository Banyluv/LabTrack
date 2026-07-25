@echo off
cd /d "%~dp0"
start "LabTrack Frontend" cmd /c "cd /d \"%~dp0\" && node node_modules\vite\bin\vite.js --host"