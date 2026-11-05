import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn.utils.parallel")
warnings.filterwarnings("ignore", message=".*sklearn.utils.parallel.*")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# Import routers
from app.routers import network, scenarios, telemetry, incidents

from app.core.database import engine, Base
from app.models import incident

# Create database tables and ensure updated schema
Base.metadata.create_all(bind=engine)
incident.upgrade_incident_table_schema(engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for NRW Water Leak Detection & Digital Twin System"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, set this to the specific origins of the frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(network.router, prefix="/api/network", tags=["network"])
app.include_router(scenarios.router, prefix="/api/scenarios", tags=["scenarios"])
app.include_router(telemetry.router, prefix="/api", tags=["telemetry"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["incidents"])

# Mount Frontend Static Assets & SPA Fallback for Production
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

candidates = [
    os.path.join(os.path.dirname(settings.BASE_DIR), "frontend", "dist"),
    os.path.join(settings.BASE_DIR, "dist"),
    os.path.join(settings.BASE_DIR, "static"),
]
dist_dir = next((d for d in candidates if os.path.exists(d) and os.path.isfile(os.path.join(d, "index.html"))), None)

if dist_dir:
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = os.path.join(dist_dir, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)
        return FileResponse(os.path.join(dist_dir, "index.html"))
else:
    @app.get("/")
    def root():
        return {"message": "Welcome to the NRW Leak Detection API"}
