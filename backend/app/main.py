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

@app.get("/")
def root():
    return {"message": "Welcome to the NRW Leak Detection API"}
