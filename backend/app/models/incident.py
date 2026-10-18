from sqlalchemy import Column, Integer, String, Float, DateTime, Text, text
from datetime import datetime
from app.core.database import Base

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_code = Column(String, index=True, nullable=True) # e.g. INC-2026-0001
    timestamp = Column(DateTime, default=datetime.utcnow)
    node_id = Column(String, index=True)
    leak_type = Column(String) # Abrupt Rupture, Incipient Leak, Medium Split
    diameter_mm = Column(Float)
    water_loss_liters_per_hour = Column(Float)
    financial_loss_inr_per_hour = Column(Float, default=0.0)
    severity = Column(String, default="Critical") # Critical, Warning, Info
    total_volume_lost_m3 = Column(Float, default=0.0)
    total_cost_inr = Column(Float, default=0.0)
    status = Column(String, default="New") # New, Acknowledged, Dispatched, Resolved
    source = Column(String, default="live_telemetry") # live_telemetry, benchmark_scenario
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    def to_dict(self):
        code = self.incident_code or f"INC-2026-{self.id:04d}"
        sev = self.severity
        if not sev:
            if (self.diameter_mm or 0) >= 50.0 or (self.water_loss_liters_per_hour or 0) >= 5000:
                sev = "Critical"
            elif (self.diameter_mm or 0) >= 15.0 or (self.water_loss_liters_per_hour or 0) >= 1000:
                sev = "Warning"
            else:
                sev = "Info"

        inr_per_hour = self.financial_loss_inr_per_hour
        if not inr_per_hour and self.water_loss_liters_per_hour:
            inr_per_hour = round((self.water_loss_liters_per_hour / 1000.0) * 25.0, 2)

        return {
            "id": self.id,
            "incident_code": code,
            "timestamp": self.timestamp.isoformat() if self.timestamp else datetime.utcnow().isoformat(),
            "node_id": str(self.node_id),
            "leak_type": self.leak_type or "Abrupt Rupture",
            "diameter_mm": round(self.diameter_mm or 0.0, 1),
            "water_loss_liters_per_hour": round(self.water_loss_liters_per_hour or 0.0, 1),
            "financial_loss_inr_per_hour": round(inr_per_hour or 0.0, 2),
            "severity": sev,
            "source": self.source or "live_telemetry",
            "total_volume_lost_m3": round(self.total_volume_lost_m3 or 0.0, 3),
            "total_cost_inr": round(self.total_cost_inr or 0.0, 2),
            "status": self.status or "New",
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "notes": self.notes
        }

def upgrade_incident_table_schema(engine):
    """Ensure newly added columns exist in SQLite database if upgraded."""
    expected_cols = {
        "incident_code": "VARCHAR",
        "financial_loss_inr_per_hour": "FLOAT DEFAULT 0.0",
        "severity": "VARCHAR DEFAULT 'Critical'",
        "source": "VARCHAR DEFAULT 'live_telemetry'",
        "total_volume_lost_m3": "FLOAT DEFAULT 0.0",
        "total_cost_inr": "FLOAT DEFAULT 0.0",
        "acknowledged_at": "DATETIME",
        "resolved_at": "DATETIME",
        "notes": "TEXT"
    }
    with engine.connect() as conn:
        try:
            result = conn.execute(text("PRAGMA table_info(incidents)")).fetchall()
            existing_cols = {row[1] for row in result}
            for col, col_type in expected_cols.items():
                if col not in existing_cols:
                    conn.execute(text(f"ALTER TABLE incidents ADD COLUMN {col} {col_type}"))
            conn.commit()
        except Exception as e:
            print(f"[DB MIGRATION] Schema check info: {e}")

