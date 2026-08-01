import sys
import os
from urllib.parse import parse_qs

# Add backend directory to path so app.main imports resolve properly on Vercel
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app

class VercelPathFixMiddleware:
    """Extracts true API path from query string or headers in Vercel Serverless environment."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            query_string = scope.get("query_string", b"").decode("utf-8")
            parsed_qs = parse_qs(query_string)
            headers = dict(scope.get("headers", []))
            
            path_param = parsed_qs.get("path", [None])[0]
            x_forwarded_uri = headers.get(b"x-forwarded-uri", b"").decode("utf-8")
            raw_path = scope.get("path", "")
            
            if path_param:
                target_path = path_param
            elif x_forwarded_uri:
                target_path = x_forwarded_uri
            else:
                target_path = raw_path
                
            clean_path = target_path.replace("/api/index.py", "").replace("/api/index", "")
            if not clean_path or clean_path == "/":
                clean_path = "/api/health"
            elif not clean_path.startswith("/api"):
                clean_path = "/api" + (clean_path if clean_path.startswith("/") else "/" + clean_path)
                
            scope["path"] = clean_path
            scope["root_path"] = ""
        await self.app(scope, receive, send)

app = VercelPathFixMiddleware(app)
