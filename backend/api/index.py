import sys
from pathlib import Path

# Tambahkan direktori root backend ke sys.path agar Vercel dapat menemukan modul app
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app

