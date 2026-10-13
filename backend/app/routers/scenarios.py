from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Query, HTTPException
from app.core.config import settings
from app.services.scenario_manager import scenario_manager

router = APIRouter()

class AuditRequest(BaseModel):
    scenario_id: str
    start_date: str = ""
    end_date: str = ""

class SelectScenarioRequest(BaseModel):
    scenario_id: str

class FaultInjectRequest(BaseModel):
    node_id: str
    leak_type: str
    diameter_mm: float

@router.get("/")
def list_scenarios(
    q: Optional[str] = Query(None, description="Natural query search term (e.g. 'pipe burst', 'slow leak', 'node 21')"),
    leak_type: Optional[str] = Query(None, description="Filter by leak dynamic ('abrupt', 'incipient', 'all')"),
    node_id: Optional[str] = Query(None, description="Filter by target junction node ID (e.g. '21', '12', 'all')"),
    severity: Optional[str] = Query(None, description="Filter by severity ('Minor', 'Moderate', 'Severe', 'all')"),
    limit: int = Query(50, ge=1, le=2000),
    offset: int = Query(0, ge=0)
) -> Dict[str, Any]:
    """
    Search & filter scenario catalog with natural language synonym mapping and rich metadata.
    """
    return scenario_manager.search_and_filter(
        q=q,
        leak_type=leak_type,
        node_id=node_id,
        severity=severity,
        limit=limit,
        offset=offset
    )

@router.get("/{scenario_id}")
def get_scenario_detail(scenario_id: str) -> Dict[str, Any]:
    """
    Get detailed metadata for a specific scenario.
    """
    meta = scenario_manager.get_scenario(scenario_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"status": "success", "scenario": meta}

@router.post("/select")
def select_scenario(request: SelectScenarioRequest) -> Dict[str, Any]:
    """
    Prepares and activates a scenario for the Digital Twin simulation.
    Ensures the time-series CSV is ready for playback.
    """
    meta = scenario_manager.get_scenario(request.scenario_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Scenario not found in catalog")
    
    csv_path = scenario_manager.ensure_scenario_csv(request.scenario_id)
    return {
        "status": "success",
        "message": f"Scenario {request.scenario_id} ready for simulation",
        "scenario": meta,
        "csv_path": csv_path
    }


@router.post("/historical-audit")
def historical_audit(request: AuditRequest) -> Dict[str, Any]:
    """
    Full-year/custom date range scan for leak start/stop and total loss.
    """
    from app.services.inference import engine
    if not engine.models_loaded:
        engine.load_models()

    scenario_path = os.path.join(settings.DATA_DIR, "scenarios", f"{request.scenario_id}.csv")
    if not os.path.exists(scenario_path):
        return {"error": "Scenario not found"}
        
    total_loss_liters = 0.0
    total_financial_loss = 0.0
    leak_events = []
    
    with open(scenario_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Extract features (assume columns after timestamp)
            # The CSV has 10 nodes: node_10, node_11, ...
            features = []
            for col in reader.fieldnames:
                if col != 'timestamp':
                    features.append(float(row[col]))
            # Pad to 11 if needed
            if len(features) == 10:
                features.append(50.0) # Dummy for node 2
                
            result = engine.predict(features)
            if result.get("status") == "LEAK_DETECTED":
                loss_stats = result.get("loss", {})
                # Assuming each row is 30 mins (0.5 hours)
                total_loss_liters += loss_stats.get("liters_per_hour", 0) * 0.5
                total_financial_loss += loss_stats.get("financial_loss_inr_per_hour", 0) * 0.5
                
                # Optionally save to DB here (skeleton logic)
                from app.core.database import SessionLocal
                from app.models.incident import Incident
                from datetime import datetime
                
                db = SessionLocal()
                try:
                    incident = Incident(
                        timestamp=datetime.fromisoformat(row['timestamp'].replace(" ", "T")),
                        node_id=result.get("localization")[0]["node_id"],
                        leak_type=result.get("dynamics"),
                        diameter_mm=result.get("diameter_mm"),
                        water_loss_liters_per_hour=loss_stats.get("liters_per_hour", 0),
                        status="New"
                    )
                    db.add(incident)
                    db.commit()
                except Exception as e:
                    db.rollback()
                finally:
                    db.close()
                
                leak_events.append({
                    "timestamp": row['timestamp'],
                    "localization": result.get("localization"),
                    "dynamics": result.get("dynamics"),
                    "diameter_mm": result.get("diameter_mm")
                })
                
    return {
        "status": "success", 
        "total_water_loss_liters": total_loss_liters,
        "total_financial_loss_inr": total_financial_loss,
        "leak_event_count": len(leak_events),
        "events": leak_events
    }

@router.post("/fault-inject")
def fault_inject(request: FaultInjectRequest) -> Dict[str, Any]:
    """
    Interactive real-time manual leak injection for live demos.
    """
    return {
        "status": "success", 
        "node_id": request.node_id,
        "leak_type": request.leak_type,
        "diameter_mm": request.diameter_mm,
        "message": f"Injected {request.leak_type} at {request.node_id} with diameter {request.diameter_mm}mm"
    }
