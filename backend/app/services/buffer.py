import collections

class SlidingBuffer:
    def __init__(self, window_size=120):
        self.window_size = window_size
        self.buffer = collections.deque(maxlen=window_size)

    def add_readings(self, readings):
        self.buffer.append(readings)

    def get_features(self):
        """
        Returns raw features (for the Detection Model) AND 
        Deltas (for the Localization, Type, and Diameter models).
        """
        if not self.buffer:
            return {"raw_features": [0.0] * 11, "deltas": {}}
            
        import numpy as np
        
        # 1. RAW FEATURES (For Detection Model)
        latest = self.buffer[-1]
        raw_features = []
        pressure_keys = [k for k in latest.keys() if k != "timestamp"]
        
        for key in pressure_keys:
            raw_features.append(float(latest[key]))
            
        # 2. DELTAS (For Localization, Type, Diameter Models)
        # We calculate the mean of the most recent steps (leak_mean) 
        # minus the mean of the oldest steps in the buffer (pre_mean)
        deltas = {}
        
        # If we don't have enough history, just return 0 deltas
        if len(self.buffer) < 10:
            for key in pressure_keys:
                deltas[f"{key}_delta"] = 0.0
        else:
            # Most recent 10 steps
            recent_steps = list(self.buffer)[-10:]
            # Oldest steps in the buffer
            old_steps = list(self.buffer)[:10]
            
            for key in pressure_keys:
                leak_mean = np.mean([r[key] for r in recent_steps if key in r])
                pre_mean = np.mean([r[key] for r in old_steps if key in r])
                deltas[f"{key}_delta"] = float(leak_mean - pre_mean)
                
        return {"raw_features": raw_features, "deltas": deltas}
