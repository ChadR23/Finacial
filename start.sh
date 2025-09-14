#!/bin/bash

echo "🚀 Starting Personal Expense Tracker..."
echo

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Kill existing processes on ports 5000 and 3000
echo "🧹 Cleaning up existing processes..."
if check_port 5000; then
    echo "Stopping existing backend server on port 5000..."
    lsof -ti:5000 | xargs kill -9 2>/dev/null
fi

if check_port 3000; then
    echo "Stopping existing frontend server on port 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
fi

# Start backend
echo "🐍 Starting backend server..."
cd backend
source venv/bin/activate 2>/dev/null || { echo "❌ Virtual environment not found. Run setup.py first."; exit 1; }
python app.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Clear Next.js cache and start frontend
echo "🧹 Clearing Next.js cache..."
cd frontend-nextjs
if [ -d ".next" ]; then
    rm -rf .next
    echo "✅ Cache cleared"
else
    echo "ℹ️  No cache to clear"
fi

echo "⚛️  Starting frontend server..."
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 5

# Open browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
fi

# Open browser (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000 2>/dev/null
fi

echo
echo "✅ Both servers are starting..."
echo "📊 Backend API: http://localhost:5000"
echo "🌐 Frontend:    http://localhost:3000"
echo
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
trap 'echo "🛑 Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT
wait
