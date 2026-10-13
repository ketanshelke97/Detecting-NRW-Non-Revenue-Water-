import math

GRAVITY = 9.81

def calculate_torricelli_loss(diameter_m: float, pressure_head_m: float, cd: float = 0.65) -> float:
    """
    Calculates water loss using Torricelli's orifice hydraulics formula:
    Q = Cd * A * sqrt(2 * g * H)
    Returns flow in cubic meters per second (m^3/s).
    """
    if pressure_head_m <= 0 or diameter_m <= 0:
        return 0.0
    
    area = math.pi * (diameter_m / 2) ** 2
    velocity = math.sqrt(2 * GRAVITY * pressure_head_m)
    flow_m3_s = cd * area * velocity
    
    return flow_m3_s

def flow_to_liters_per_hour(flow_m3_s: float) -> float:
    return flow_m3_s * 1000 * 3600

def calculate_financial_loss(liters_per_hour: float, tariff_per_liter: float = 0.025) -> float:
    return liters_per_hour * tariff_per_liter
