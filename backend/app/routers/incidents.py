from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.models.incident import Incident

router = APIRouter()

class IncidentStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class IncidentCreate(BaseModel):
    node_id: str
    leak_type: Optional[str] = "Abrupt Rupture"
    diameter_mm: Optional[float] = 50.0
    water_loss_liters_per_hour: Optional[float] = 5000.0
    financial_loss_inr_per_hour: Optional[float] = None
    severity: Optional[str] = None
    source: Optional[str] = "live_telemetry"
    status: Optional[str] = "New"
    notes: Optional[str] = None

@router.get("")
def list_incidents(
    status: Optional[str] = Query(None, description="Filter by status: 'all', 'active', 'New', 'Acknowledged', 'Dispatched', 'Resolved'"),
    severity: Optional[str] = Query(None, description="Filter by severity: 'Critical', 'Warning', 'Info'"),
    source: Optional[str] = Query(None, description="Filter by source: 'all', 'live_telemetry', 'benchmark_scenario'"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Incident)
    
    # Calculate overall stats before pagination filters
    all_rows = db.query(Incident).all()
    total_count = len(all_rows)
    active_count = sum(1 for r in all_rows if r.status in ("New", "Acknowledged", "Dispatched"))
    critical_count = sum(1 for r in all_rows if (r.severity == "Critical" or (r.diameter_mm or 0) >= 50.0) and r.status != "Resolved")
    resolved_count = sum(1 for r in all_rows if r.status == "Resolved")
    
    if status and status.lower() != "all":
        if status.lower() == "active":
            query = query.filter(Incident.status.in_(["New", "Acknowledged", "Dispatched"]))
        else:
            query = query.filter(Incident.status.ilike(status))
            
    if severity and severity.lower() != "all":
        query = query.filter(Incident.severity.ilike(severity))

    if source and source.lower() != "all":
        query = query.filter(Incident.source.ilike(source))
        
    query = query.order_by(Incident.id.desc()).limit(limit)
    incidents = query.all()
    
    return {
        "status": "success",
        "total_count": total_count,
        "active_count": active_count,
        "critical_count": critical_count,
        "resolved_count": resolved_count,
        "incidents": [inc.to_dict() for inc in incidents]
    }

@router.get("/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident.to_dict()

@router.post("")
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    # Auto-calculate severity if not provided
    sev = payload.severity
    diam = payload.diameter_mm or 0.0
    flow = payload.water_loss_liters_per_hour or 0.0
    if not sev:
        if diam >= 50.0 or flow >= 5000:
            sev = "Critical"
        elif diam >= 15.0 or flow >= 1000:
            sev = "Warning"
        else:
            sev = "Info"
            
    financial_rate = payload.financial_loss_inr_per_hour
    if financial_rate is None:
        financial_rate = round((flow / 1000.0) * 25.0, 2)

    incident = Incident(
        node_id=payload.node_id,
        leak_type=payload.leak_type or "Abrupt Rupture",
        diameter_mm=diam,
        water_loss_liters_per_hour=flow,
        financial_loss_inr_per_hour=financial_rate,
        severity=sev,
        source=payload.source or "live_telemetry",
        status=payload.status or "New",
        notes=payload.notes
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    # Generate canonical code
    if not incident.incident_code:
        incident.incident_code = f"INC-2026-{incident.id:04d}"
        db.commit()
        db.refresh(incident)
        
    return incident.to_dict()

@router.patch("/{incident_id}/status")
def update_incident_status(incident_id: int, payload: IncidentStatusUpdate, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    valid_statuses = ["New", "Acknowledged", "Dispatched", "Resolved"]
    normalized = next((s for s in valid_statuses if s.lower() == payload.status.lower()), None)
    if not normalized:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
    incident.status = normalized
    if payload.notes:
        incident.notes = payload.notes
        
    now = datetime.utcnow()
    if normalized == "Acknowledged" and not incident.acknowledged_at:
        incident.acknowledged_at = now
    elif normalized == "Resolved":
        incident.resolved_at = now
        
    db.commit()
    db.refresh(incident)
    return incident.to_dict()

@router.post("/{incident_id}/acknowledge")
def acknowledge_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    incident.status = "Acknowledged"
    if not incident.acknowledged_at:
        incident.acknowledged_at = datetime.utcnow()
        
    db.commit()
    db.refresh(incident)
    return incident.to_dict()

@router.post("/{incident_id}/resolve")
def resolve_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    incident.status = "Resolved"
    incident.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(incident)
    return incident.to_dict()

@router.delete("/clear")
def clear_all_incidents(db: Session = Depends(get_db)):
    count = db.query(Incident).delete()
    db.commit()
    return {"status": "success", "deleted_count": count}

@router.delete("/{incident_id}")
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()
    return {"status": "success", "deleted_id": incident_id}
