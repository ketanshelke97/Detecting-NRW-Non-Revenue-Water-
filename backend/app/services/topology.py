import json
import os
from app.core.config import settings

def load_topology():
    """
    Loads the Net1 topology from the JSON file.
    """
    path = os.path.join(settings.DATA_DIR, "net1_topology.json")
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {}
