# PowerShell script to set up the Avantis service environment
# This script creates a virtual environment and installs dependencies

Write-Host "Setting up Avantis Service..." -ForegroundColor Green

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found: $pythonVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: Python not found. Please install Python 3.11+ and try again." -ForegroundColor Red
    Write-Host "You can download Python from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Create virtual environment if it doesn't exist
if (-Not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    python -m venv venv
} else {
    Write-Host "Virtual environment already exists." -ForegroundColor Yellow
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& "venv\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

# Install dependencies
Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Cyan
pip install -r requirements.txt

Write-Host "`nSetup complete! To activate the virtual environment in the future, run:" -ForegroundColor Green
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor Cyan
Write-Host "`nTo run the service:" -ForegroundColor Green
Write-Host "  python main.py" -ForegroundColor Cyan

