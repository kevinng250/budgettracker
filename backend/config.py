import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "data", "budget.db")
CORS_ORIGINS = ["http://localhost:5173"]
