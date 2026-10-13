from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    node_id = Column(String, index=True)
    leak_type = Column(String)
    diameter_mm = Column(Float)
    water_loss_liters_per_hour = Column(Float)
    status = Column(String, default="New") # e.g. New, Acknowledged, Dispatched, Resolved
