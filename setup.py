#!/usr/bin/env python3
"""
Personal Expense Tracker Setup Script
Automates the setup process for both backend and frontend
"""

import os
import subprocess
import sys
import platform

def run_command(command, cwd=None):
    """Run a command and return success status"""
    try:
        print(f"Running: {command}")
        result = subprocess.run(command, shell=True, cwd=cwd, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        return False

def check_python():
    """Check if Python 3.10+ is available"""
    version = sys.version_info
    if version.major >= 3 and version.minor >= 10:
        print(f"✅ Python {version.major}.{version.minor} found")
        return True
    else:
        print(f"❌ Python 3.10+ required, found {version.major}.{version.minor}")
        return False

def check_node():
    """Check if Node.js is available"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"✅ Node.js {version} found")
            return True
    except FileNotFoundError:
        pass
    
    print("❌ Node.js not found. Please install Node.js 18+")
    return False

def setup_backend():
    """Set up Python backend"""
    print("\n🐍 Setting up Python backend...")
    
    # Create virtual environment
    venv_command = "python -m venv venv"
    if not run_command(venv_command, cwd="backend"):
        return False
    
    # Activate virtual environment and install dependencies
    if platform.system() == "Windows":
        activate_command = "venv\\Scripts\\activate && pip install -r requirements.txt"
    else:
        activate_command = "source venv/bin/activate && pip install -r requirements.txt"
    
    if not run_command(activate_command, cwd="backend"):
        return False
    
    print("✅ Backend setup complete!")
    return True

def setup_frontend():
    """Set up Next.js frontend"""
    print("\n⚛️  Setting up Next.js frontend...")
    
    if not run_command("npm install", cwd="frontend-nextjs"):
        return False
    
    print("✅ Frontend setup complete!")
    return True

def main():
    """Main setup function"""
    print("🚀 Personal Expense Tracker Setup")
    print("=" * 40)
    
    # Check prerequisites
    if not check_python() or not check_node():
        print("\n❌ Prerequisites not met. Please install required software.")
        sys.exit(1)
    
    # Setup backend
    if not setup_backend():
        print("\n❌ Backend setup failed!")
        sys.exit(1)
    
    # Setup frontend
    if not setup_frontend():
        print("\n❌ Frontend setup failed!")
        sys.exit(1)
    
    # Success message
    print("\n🎉 Setup complete!")
    print("\nTo start the application:")
    print("\n1. Start backend:")
    if platform.system() == "Windows":
        print("   cd backend && venv\\Scripts\\activate && python app.py")
    else:
        print("   cd backend && source venv/bin/activate && python app.py")
    
    print("\n2. Start frontend (in a new terminal):")
    print("   cd frontend-nextjs && npm run dev")
    
    print("\n3. Open http://localhost:3000 in your browser")

if __name__ == "__main__":
    main()
