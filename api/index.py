import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from app.main import app  # noqa: E402, F401
except Exception as exc:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    _err_msg = f"Startup import error: {type(exc).__name__}: {exc}"
    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    async def _startup_error(path: str = ""):
        return JSONResponse(status_code=500, content={"detail": _err_msg})
