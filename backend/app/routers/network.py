from fastapi import APIRouter
from typing import Dict, Any
from app.services.topology import load_topology

router = APIRouter()

@router.get("/net1")
def get_network_topology() -> Dict[str, Any]:
    """
    Returns the Net1 topological graph model including 11 sensor nodes, 
    non-monitored junctions, reservoir, tank, pipe connectivity, and valve coordinates.
    """
    topology_data = load_topology()
    if not topology_data:
        return {"error": "Topology data not found"}
    return topology_data
