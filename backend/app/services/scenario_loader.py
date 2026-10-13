import os
import pandas as pd
from app.core.config import settings

def load_scenario(scenario_id: str):
    """
    Loads a specific benchmark scenario from the data directory.
    """
    path = os.path.join(settings.DATA_DIR, "scenarios", f"{scenario_id}.csv")
    if os.path.exists(path):
        return pd.read_csv(path)
    return None
