from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:8000/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SPOTIFY_CACHE_PATH = os.getenv(
    "SPOTIFY_CACHE_PATH",
    os.path.join(os.path.dirname(__file__), "..", ".spotify_cache"),
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./music.db")
