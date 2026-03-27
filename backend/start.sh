#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Start the Brain Tumor Diagnosis Backend
# Run this from the project root: bash backend/start.sh
# ──────────────────────────────────────────────────────────────

set -e

echo "🩺 Sentinel 3 — Backend"
echo "======================================================="

cd "$(dirname "$0")"

# 1. Ensure pip is available
if ! python3 -m pip --version &>/dev/null; then
  echo "❌ pip is not available. Installing it now (requires sudo)..."
  sudo apt install -y python3-pip python3-venv
fi

# 2. Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
  echo "📦 Creating Python virtual environment..."
  python3 -m venv venv 2>/dev/null || {
    echo "⚠  venv unavailable — installing to user site-packages instead."
    python3 -m pip install --user -r requirements.txt -q
    echo "✅ Dependencies installed (user mode)."
    echo "🚀 Starting Flask backend on http://localhost:5000 ..."
    python3 app.py
    exit 0
  }
fi

# 3. Activate venv
source venv/bin/activate

# 4. Install / upgrade dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo ""
echo "✅ Dependencies installed."
echo "🚀 Starting Flask backend on http://localhost:5000 ..."
echo "   (First run will download the model from HuggingFace — this may take a few minutes)"
echo ""

python3 app.py
