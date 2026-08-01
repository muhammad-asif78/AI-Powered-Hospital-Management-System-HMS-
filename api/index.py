import sys
import os

# Add backend directory to path so app.main imports resolve properly on Vercel
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app

class VercelPathFixMiddleware:
    """Normalizes Vercel ASGI scope path so FastAPI routing matches consistently."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            raw_path = scope.get("path", "")
            # Strip Vercel entrypoint file name if included in ASGI path
            clean_path = raw_path.replace("/api/index.py", "").replace("/api/index", "")
            if not clean_path or clean_path == "/":
                clean_path = "/api"
            elif not clean_path.startswith("/api"):
                clean_path = "/api" + (clean_path if clean_path.startswith("/") else "/" + clean_path)
            
            scope["path"] = clean_path
            # Set root_path to empty so FastAPI matches path directly
            scope["root_path"] = ""
        await self.app(scope, receive, send)

app = VercelPathFixMiddleware(app)
