import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "NRW Water Leak Detection API"
    VERSION: str = "1.0.0"
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    MODELS_DIR: str = os.path.join(BASE_DIR, "models")
    
    # Database
    DATABASE_URL: str = "sqlite:///./leakdb.sqlite"

settings = Settings()
