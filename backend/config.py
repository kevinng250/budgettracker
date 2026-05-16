import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "data", "budget.db")
UPLOAD_ARCHIVE_DIR = os.path.join(BASE_DIR, "data", "uploads")
CORS_ORIGINS = ["http://localhost:5173"]
