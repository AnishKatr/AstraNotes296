import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Default configuration — override in tests via ``test_config``."""

    MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017")
    MONGODB_DB = os.environ.get("MONGODB_DB", "astranotes")
    CORS_ORIGINS = [
        o.strip()
        for o in os.environ.get(
            "CORS_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if o.strip()
    ]
