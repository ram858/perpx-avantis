#!/bin/bash
# Bash script to set up the Avantis service environment
# This script creates a virtual environment and installs dependencies

echo "Setting up Avantis Service..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 not found. Please install Python 3.11+ and try again."
    exit 1
fi

echo "Found: $(python3 --version)"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
else
    echo "Virtual environment already exists."
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
python -m pip install --upgrade pip

# Install dependencies
echo "Installing dependencies from requirements.txt..."
pip install -r requirements.txt

echo ""
echo "Setup complete! To activate the virtual environment in the future, run:"
echo "  source venv/bin/activate"
echo ""
echo "To run the service:"
echo "  python main.py"

