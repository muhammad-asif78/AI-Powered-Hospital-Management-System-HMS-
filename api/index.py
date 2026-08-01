import sys
import os

# Add backend directory to path so app.main imports resolve properly on Vercel
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app

class VercelPathFixMiddleware:
    """Ensures ASGI path includes /api prefix regardless of Vercel serverless routing strip."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if not path.startswith("/api"):
                scope["path"] = "/api" + (path if path.startswith("/") else "/" + path)
        await self.app(scope, receive, send)

# Vercel entrypoint can expose app directly or wrapped
app = VercelPathFixMiddleware(app)
