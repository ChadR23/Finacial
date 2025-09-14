@echo off
echo Starting Personal Expense Tracker...
echo.

REM Start backend in new window
echo Starting backend server...
start "Backend Server" cmd /k "cd backend && venv\Scripts\activate && python app.py"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend in new window  
echo Starting frontend server...
start "Frontend Server" cmd /k "cd frontend-nextjs && npm run dev"

REM Wait a moment then open browser
timeout /t 5 /nobreak > nul
start http://localhost:3000

echo.
echo Both servers starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
pause
