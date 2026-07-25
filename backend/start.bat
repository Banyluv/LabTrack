@echo off
cd /d "%~dp0"

:: Check if venv exists
if not exist "venv\Scripts\python.exe" (
    echo Virtual environment not found. Creating one...
    python -m venv venv
    echo Installing dependencies...
    venv\Scripts\python.exe -m pip install -r requirements.txt
    echo Setup complete.
)

echo Starting backend server on http://0.0.0.0:5000 ...
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 5000
pause
