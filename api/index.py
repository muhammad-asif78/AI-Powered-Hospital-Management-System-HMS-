import sys
import os

# Add backend directory to path so app.main imports resolve properly on Vercel
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app

class VercelPathFixMiddleware:
    """Normalizes Vercel ASGI scope path using x-matched-path header for serverless routing."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            x_matched_path = headers.get(b"x-matched-path", b"").decode("utf-8")
            raw_path = scope.get("path", "")
            
            # Prefer x-matched-path header set by Vercel router if present
            path = x_matched_path if x_matched_path else raw_path
            
            # Clean /api/index.py or /api/index suffixes
            clean_path = path.replace("/api/index.py", "").replace("/api/index", "")
            if not clean_path or clean_path == "/":
                clean_path = "/api/health"
            elif not clean_path.startswith("/api"):
                clean_path = "/api" + (clean_path if clean_path.startswith("/") else "/" + clean_path)
            
            scope["path"] = clean_path
            scope["root_path"] = ""
        await self.app(scope, receive, send)

app = VercelPathFixMiddleware(app)
