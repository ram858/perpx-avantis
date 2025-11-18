#!/bin/bash
# Script to start the Avantis Service locally

cd "$(dirname "$0")/avantis-service"

echo "🚀 Starting Avantis Service..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "📦 Running setup script..."
    ./setup.sh
    if [ $? -ne 0 ]; then
        echo "❌ Setup failed!"
        exit 1
    fi
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Check if uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

# Load environment variables from .env if it exists
if [ -f ".env" ]; then
    echo "📝 Loading environment from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start the service
echo "🌟 Starting Avantis Service on http://localhost:8000"
echo "📊 Health check: http://localhost:8000/health"
echo "📚 API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

