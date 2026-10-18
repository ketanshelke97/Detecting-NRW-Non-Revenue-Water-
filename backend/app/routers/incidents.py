import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.models.incident import Incident

router = APIRouter()

NET1_ISOLATION_MAP: Dict[str, Dict[str, Any]] = {
    "9":  {"valves": ["V-PUMP9"], "pipes": ["PUMP-9"], "zone": "Zone 1 - Main Pumping Station", "elevation": 0.0},
    "10": {"valves": ["V-PUMP9", "V-PIPE10"], "pipes": ["PUMP-9", "PIPE-10"], "zone": "Zone 1 - Pumping Transmission Main", "elevation": 216.4},
    "11": {"valves": ["V-PIPE10", "V-PIPE11", "V-PIPE111"], "pipes": ["PIPE-10", "PIPE-11", "PIPE-111"], "zone": "Zone 2 - Primary Distribution Trunk", "elevation": 216.4},
    "12": {"valves": ["V-PIPE11", "V-PIPE12", "V-PIPE110", "V-PIPE112"], "pipes": ["PIPE-11", "PIPE-12", "PIPE-110", "PIPE-112"], "zone": "Zone 2 - Central Network Hub", "elevation": 213.4},
    "13": {"valves": ["V-PIPE12", "V-PIPE113"], "pipes": ["PIPE-12", "PIPE-113"], "zone": "Zone 3 - East Sub-Grid Main", "elevation": 211.8},
    "2":  {"valves": ["V-PIPE110"], "pipes": ["PIPE-110"], "zone": "Zone 2 - Elevated Balancing Reservoir", "elevation": 259.1},
    "21": {"valves": ["V-PIPE111", "V-PIPE21", "V-PIPE121"], "pipes": ["PIPE-111", "PIPE-21", "PIPE-121"], "zone": "Zone 4 - South-West Feeder Grid", "elevation": 213.4},
    "22": {"valves": ["V-PIPE112", "V-PIPE21", "V-PIPE22", "V-PIPE122"], "pipes": ["PIPE-112", "PIPE-21", "PIPE-22", "PIPE-122"], "zone": "Zone 4 - South Central Sector", "elevation": 211.8},
    "23": {"valves": ["V-PIPE113", "V-PIPE22", "V-PIPE23"], "pipes": ["PIPE-113", "PIPE-22", "PIPE-23"], "zone": "Zone 4 - South-East Commercial District", "elevation": 210.3},
    "31": {"valves": ["V-PIPE121", "V-PIPE31"], "pipes": ["PIPE-121", "PIPE-31"], "zone": "Zone 5 - West Residential Sector", "elevation": 213.4},
    "32": {"valves": ["V-PIPE122", "V-PIPE31", "V-PIPE32"], "pipes": ["PIPE-122", "PIPE-31", "PIPE-32"], "zone": "Zone 5 - Central Residential Sector", "elevation": 210.3},
    "33": {"valves": ["V-PIPE23", "V-PIPE32"], "pipes": ["PIPE-23", "PIPE-32"], "zone": "Zone 5 - East Residential Terminal", "elevation": 208.8},
}

def get_equipment_recommendations(diameter_mm: float) -> list[str]:
    equipment = [
        "Digital Hydraulic Pressure Data-Logger",
        "Acoustic Leak Correlator & Ground Microphone",
        "Traffic Safety Cones & Perimeter Barricades"
    ]
    if diameter_mm >= 100.0:
        equipment.extend([
            f"Heavy-Duty Full-Enclosure Split Collar Clamp ({int(diameter_mm * 1.1)}mm)",
            "High-Capacity Submersible Dewatering Trash Pump (10 HP)",
            "Hydraulic Excavator & Trench Shoring Box",
            "Replacement Ductile Iron Pipe Spool"
        ])
    elif diameter_mm >= 30.0:
        equipment.extend([
            f"Stainless Steel Repair Clamp ({int(diameter_mm * 1.15)}mm)",
            "Submersible Dewatering Pump (5.5 HP)",
            "Pneumatic Pavement Breaker & Trench Shovel",
            "Mechanical Pipe Coupling Set"
        ])
    else:
        equipment.extend([
            f"Quick-Seal Band Clamp ({max(15, int(diameter_mm * 1.2))}mm)",
            "Manual Trenching Tools & Dewatering Hand Siphon",
            "Ultrasonic Pipe Wall Thickness Gauge"
        ])
    return equipment

class IncidentStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class IncidentDispatchRequest(BaseModel):
    team_name: Optional[str] = "Jal Shakti Rapid Response Unit 1"
    technician_name: Optional[str] = "Er. Rajesh Patil"
    contact_number: Optional[str] = "+91 98230 11223"
    priority: Optional[str] = "P1 - Critical"
    estimated_arrival_minutes: Optional[int] = 25
    isolation_valves: Optional[List[str]] = None
    equipment_checklist: Optional[List[str]] = None
    notes: Optional[str] = None

class DirectDispatchRequest(BaseModel):
    node_id: str
    leak_type: Optional[str] = "Abrupt Rupture"
    diameter_mm: Optional[float] = 50.0
    water_loss_liters_per_hour: Optional[float] = 5000.0
    financial_loss_inr_per_hour: Optional[float] = None
    severity: Optional[str] = "Critical"
    source: Optional[str] = "live_telemetry"
    team_name: Optional[str] = "Jal Shakti Rapid Response Unit 1"
    technician_name: Optional[str] = "Er. Rajesh Patil"
    contact_number: Optional[str] = "+91 98230 11223"
    priority: Optional[str] = "P1 - Critical"
    isolation_valves: Optional[List[str]] = None
    equipment_checklist: Optional[List[str]] = None
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
        
    now = datetime.now()
    if incident.source == "benchmark_scenario" and incident.timestamp and incident.timestamp.year < 2026:
        now = incident.timestamp + (timedelta(hours=2) if normalized == "Resolved" else timedelta(minutes=15))

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
        now = datetime.now()
        if incident.source == "benchmark_scenario" and incident.timestamp and incident.timestamp.year < 2026:
            now = incident.timestamp + timedelta(minutes=5)
        incident.acknowledged_at = now
        
    db.commit()
    db.refresh(incident)
    return incident.to_dict()

@router.post("/{incident_id}/resolve")
def resolve_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    now = datetime.now()
    if incident.source == "benchmark_scenario" and incident.timestamp and incident.timestamp.year < 2026:
        now = incident.timestamp + timedelta(hours=2)
    incident.status = "Resolved"
    incident.resolved_at = now
    db.commit()
    db.refresh(incident)
    return incident.to_dict()

@router.post("/{incident_id}/dispatch")
def dispatch_incident(incident_id: int, payload: IncidentDispatchRequest, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    now = datetime.now()
    if incident.source == "benchmark_scenario" and incident.timestamp and incident.timestamp.year < 2026:
        now = incident.timestamp + timedelta(minutes=15)
    incident.status = "Dispatched"
    incident.dispatched_at = now
    incident.dispatch_team = payload.team_name or "Jal Shakti Rapid Response Unit 1"
    incident.technician_name = payload.technician_name or "Er. Rajesh Patil"
    incident.contact_number = payload.contact_number or "+91 98230 11223"
    incident.priority = payload.priority or "P1 - Critical"
    
    if not incident.work_order_code:
        incident.work_order_code = f"WO-2026-{incident.id:04d}"
        
    node_str = str(incident.node_id)
    isolation_info = NET1_ISOLATION_MAP.get(node_str, {"valves": [f"V-{node_str}"]})
    valves_to_save = payload.isolation_valves if payload.isolation_valves is not None else isolation_info["valves"]
    incident.isolation_valves = json.dumps(valves_to_save)
    
    equip_to_save = payload.equipment_checklist if payload.equipment_checklist is not None else get_equipment_recommendations(incident.diameter_mm or 50.0)
    incident.equipment_checklist = json.dumps(equip_to_save)
    
    if payload.notes:
        if incident.notes:
            incident.notes = f"{incident.notes}\n[DISPATCH]: {payload.notes}"
        else:
            incident.notes = payload.notes
            
    db.commit()
    db.refresh(incident)
    return incident.to_dict()

@router.post("/dispatch-direct")
def dispatch_direct_leak(payload: DirectDispatchRequest, db: Session = Depends(get_db)):
    now = datetime.now()
    
    node_str = str(payload.node_id)
    isolation_info = NET1_ISOLATION_MAP.get(node_str, {"valves": [f"V-{node_str}"]})
    valves = payload.isolation_valves if payload.isolation_valves is not None else isolation_info["valves"]
    equipment = payload.equipment_checklist if payload.equipment_checklist is not None else get_equipment_recommendations(payload.diameter_mm or 50.0)
    
    lph = payload.water_loss_liters_per_hour or 5000.0
    inr_per_hour = payload.financial_loss_inr_per_hour or round((lph / 1000.0) * 25.0, 2)
    
    # Check if an active unresolved incident already exists for this node
    existing = db.query(Incident).filter(
        Incident.node_id == node_str,
        Incident.status.in_(["New", "Acknowledged", "Dispatched"])
    ).order_by(Incident.id.desc()).first()

    if existing:
        existing.status = "Dispatched"
        existing.dispatched_at = now
        existing.dispatch_team = payload.team_name or "Jal Shakti Rapid Response Unit 1"
        existing.technician_name = payload.technician_name or "Er. Rajesh Patil"
        existing.contact_number = payload.contact_number or "+91 98230 11223"
        existing.priority = payload.priority or "P1 - Critical"
        existing.isolation_valves = json.dumps(valves)
        existing.equipment_checklist = json.dumps(equipment)
        if payload.notes:
            existing.notes = payload.notes
        if not existing.work_order_code:
            existing.work_order_code = f"WO-2026-{existing.id:04d}"
        db.commit()
        db.refresh(existing)
        return existing.to_dict()

    incident = Incident(
        timestamp=now,
        node_id=node_str,
        leak_type=payload.leak_type or "Abrupt Rupture",
        diameter_mm=payload.diameter_mm or 50.0,
        water_loss_liters_per_hour=lph,
        financial_loss_inr_per_hour=inr_per_hour,
        severity=payload.severity or "Critical",
        source=payload.source or "live_telemetry",
        status="Dispatched",
        dispatched_at=now,
        dispatch_team=payload.team_name or "Jal Shakti Rapid Response Unit 1",
        technician_name=payload.technician_name or "Er. Rajesh Patil",
        contact_number=payload.contact_number or "+91 98230 11223",
        priority=payload.priority or "P1 - Critical",
        isolation_valves=json.dumps(valves),
        equipment_checklist=json.dumps(equipment),
        notes=payload.notes
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    incident.incident_code = f"INC-2026-{incident.id:04d}"
    incident.work_order_code = f"WO-2026-{incident.id:04d}"
    db.commit()
    db.refresh(incident)
    return incident.to_dict()

@router.get("/{incident_id}/work-order")
def get_work_order(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    node_str = str(incident.node_id)
    isolation_info = NET1_ISOLATION_MAP.get(node_str, {
        "valves": [f"V-IN-{node_str}", f"V-OUT-{node_str}"],
        "pipes": [f"PIPE-{node_str}"],
        "zone": "District Metered Area (DMA)",
        "elevation": 210.0
    })
    
    valves = json.loads(incident.isolation_valves) if incident.isolation_valves else isolation_info["valves"]
    equipment = json.loads(incident.equipment_checklist) if incident.equipment_checklist else get_equipment_recommendations(incident.diameter_mm or 50.0)
    
    wo_code = incident.work_order_code or f"WO-2026-{incident.id:04d}"
    
    return {
        "work_order_code": wo_code,
        "incident_code": incident.incident_code or f"INC-2026-{incident.id:04d}",
        "incident_id": incident.id,
        "status": incident.status,
        "priority": incident.priority or "P1 - Critical",
        "created_at": incident.timestamp.isoformat() if incident.timestamp else datetime.now().isoformat(),
        "dispatched_at": incident.dispatched_at.isoformat() if incident.dispatched_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "location": {
            "node_id": node_str,
            "label": f"Junction {node_str}",
            "zone": isolation_info["zone"],
            "elevation_m": isolation_info.get("elevation", 210.0),
            "coordinates": {
                "latitude": round(18.5204 + (float(node_str if node_str.isdigit() else 21) * 0.0012), 4),
                "longitude": round(73.8567 + (float(node_str if node_str.isdigit() else 21) * 0.0015), 4)
            }
        },
        "hydraulics": {
            "leak_type": incident.leak_type or "Abrupt Rupture",
            "diameter_mm": round(incident.diameter_mm or 0.0, 1),
            "efflux_liters_per_hour": round(incident.water_loss_liters_per_hour or 0.0, 1),
            "efflux_m3_per_hour": round((incident.water_loss_liters_per_hour or 0.0) / 1000.0, 2),
            "burn_rate_inr_per_hour": round(incident.financial_loss_inr_per_hour or 0.0, 2),
            "total_volume_lost_m3": round(incident.total_volume_lost_m3 or 0.0, 3),
            "total_cost_inr": round(incident.total_cost_inr or 0.0, 2),
            "severity": incident.severity or "Critical"
        },
        "isolation_protocol": {
            "target_valves": valves,
            "affected_pipes": isolation_info["pipes"],
            "procedure_summary": f"Close valves {', '.join(valves)} to isolate Junction {node_str} while maintaining bypass flow to downstream DMAs.",
            "estimated_affected_connections": int((float(node_str) if node_str.isdigit() else 21) * 45 + 120)
        },
        "equipment_checklist": equipment,
        "field_crew": {
            "team_name": incident.dispatch_team or "Jal Shakti Rapid Response Unit 1",
            "technician_name": incident.technician_name or "Er. Rajesh Patil",
            "contact_number": incident.contact_number or "+91 98230 11223"
        },
        "authority": {
            "department": "Ministry of Jal Shakti • Urban Water Supply Mission",
            "system": "AI-Powered Non-Revenue Water (NRW) SCADA Digital Twin",
            "sign_off_title": "Executive Hydraulic Engineer"
        },
        "notes": incident.notes
    }

@router.delete("/clear")
def clear_all_incidents(db: Session = Depends(get_db)):
    count = db.query(Incident).delete()
    try:
        db.execute(text("DELETE FROM sqlite_sequence WHERE name = 'incidents'"))
    except Exception:
        pass
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
