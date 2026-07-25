$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

# Check if venv exists, create if not
if (-not (Test-Path ".\venv\Scripts\python.exe")) {
    Write-Host "Virtual environment not found. Creating one..."
    python -m venv venv
    Write-Host "Installing dependencies..."
    & ".\venv\Scripts\python.exe" -m pip install -r requirements.txt
    Write-Host "Setup complete."
}

Write-Host "Starting backend server on http://0.0.0.0:5000 ..."
& ".\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 5000
