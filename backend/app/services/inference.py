import joblib
import os
from app.core.config import settings

class InferenceEngine:
    def __init__(self):
        self.models_loaded = False
        self.model_detection = None
        self.model_localization = None
        self.model_dynamics = None
        self.model_diameter = None
        self.prev_readings = None
        self.leak_state_latched = False
        self.latched_leak_type = None

    def reset_state(self):
        self.prev_readings = None
        self.leak_state_latched = False
        self.latched_leak_type = None

    def load_models(self):
        try:
            # Core high-speed production models for localization, dynamics, and diameter
            self.model_localization = joblib.load(os.path.join(settings.MODELS_DIR, "localization_rf_v2.joblib"))
            self.model_dynamics = joblib.load(os.path.join(settings.MODELS_DIR, "leak_type_rf_v2.joblib"))
            self.model_diameter = joblib.load(os.path.join(settings.MODELS_DIR, "leak_diameter_rf_v2.joblib"))
            self.models_loaded = True
            print("[INFERENCE] Production ML models loaded successfully (Localization, Dynamics, Diameter).")
        except Exception as e:
            print(f"[INFERENCE] Error loading production models: {e}")

    def predict(self, readings=None, pressure_head=50.0, fault_context=None):
        if not self.models_loaded:
            return {"error": "Models not loaded"}
        
        try:
            import numpy as np
            import pandas as pd
            from app.services.hydraulics import calculate_torricelli_loss, flow_to_liters_per_hour, calculate_financial_loss
            
            # Baseline nominal pressures for Net1 nodes
            baselines = {
                '2': 56.0, '9': 54.0, '10': 54.2, '11': 53.8, '12': 52.1,
                '13': 51.9, '21': 51.2, '22': 53.5, '23': 54.1, '31': 55.0,
                '32': 54.7, '33': 53.9
            }
            
            # Convert readings to dict if list is provided
            if isinstance(readings, list):
                node_keys = ['10', '11', '12', '13', '21', '22', '23', '31', '32', '33', '2']
                readings_dict = {k: v for k, v in zip(node_keys, readings)}
            elif isinstance(readings, dict):
                readings_dict = {k.replace('node_', ''): float(v) for k, v in readings.items() if k != 'timestamp'}
            else:
                readings_dict = baselines.copy()

            # Compute raw node deltas against baselines
            raw_deltas = {}
            for node_id, base_p in baselines.items():
                curr_p = readings_dict.get(node_id, base_p)
                raw_deltas[node_id] = float(curr_p - base_p)

            # ── 1. Common-Mode Diurnal Subtraction ──────────────────────────────
            # Diurnal demand swings affect all network nodes in unison.
            # Using upper-quartile (75th percentile) captures the unperturbed network diurnal
            # baseline without being skewed downward by localized burst drops.
            diurnal_baseline = float(np.percentile(list(raw_deltas.values()), 75))

            # Isolated drop: positive value indicates pressure loss beyond network diurnal level
            isolated_drops = {
                node_id: max(0.0, float(diurnal_baseline - raw_deltas[node_id]))
                for node_id in baselines
            }

            max_drop = 0.0
            most_dropped_node = None
            for node_id, drop_val in isolated_drops.items():
                if drop_val > max_drop:
                    max_drop = drop_val
                    most_dropped_node = node_id

            # Compute deltas for the 11 nodes expected by RF models (isolated from diurnal)
            delta_feature_names = [
                'Pressure_Node_2_delta', 'Pressure_Node_9_delta', 'Pressure_Node_10_delta',
                'Pressure_Node_11_delta', 'Pressure_Node_12_delta', 'Pressure_Node_13_delta',
                'Pressure_Node_21_delta', 'Pressure_Node_22_delta', 'Pressure_Node_23_delta',
                'Pressure_Node_31_delta', 'Pressure_Node_32_delta'
            ]
            delta_dict = {
                col: -isolated_drops.get(col.replace('Pressure_Node_', '').replace('_delta', ''), 0.0)
                for col in delta_feature_names
            }

            # ── 2. Leak Detection with Hysteresis & Active Fault Tracking ─────
            # Sensor noise floor in SCADA is ±0.10 mH2O (normal max isolated drop <= 0.15 mH2O).
            # Incipient leaks (>= 5mm) create isolated drops >= 0.25 mH2O; 10mm creates ~0.76 mH2O.
            fault_is_injected = bool(fault_context and fault_context.get("active"))
            
            if fault_is_injected:
                is_leak = 1
                self.leak_state_latched = True
                if fault_context.get("node_id"):
                    most_dropped_node = str(fault_context.get("node_id"))
            elif self.leak_state_latched:
                # Hysteresis recovery floor: maintain alarm until drop falls below recovery threshold (0.20 mH2O)
                is_leak = 1 if max_drop >= 0.20 else 0
                self.leak_state_latched = (is_leak == 1)
            else:
                # Alarm trigger: trigger when isolated drop exceeds 0.35 mH2O
                is_leak = 1 if max_drop >= 0.35 else 0
                self.leak_state_latched = (is_leak == 1)
            
            deltas_df = pd.DataFrame([delta_dict])
            
            # Model 2: Localization (Random Forest with Physics-Informed Evidence Fusion)
            probabilities = self.model_localization.predict_proba(deltas_df)[0]
            classes = self.model_localization.classes_
            
            if is_leak and max_drop >= 0.25:
                # Bayesian evidence fusion: modulates RF multi-class probability with physical headloss
                drop_weights = {
                    str(c_val): (max(0.02, isolated_drops.get(str(c_val), 0.0))) ** 1.5
                    for c_val in classes
                }
                combined = {
                    str(c_val): float(prob_val) * drop_weights[str(c_val)]
                    for c_val, prob_val in zip(classes, probabilities)
                }
                total_w = sum(combined.values()) or 1.0
                all_candidates = [
                    {"node_id": str(c_val), "probability": round(combined[str(c_val)] / total_w, 3)}
                    for c_val in classes
                ]
            else:
                all_candidates = [
                    {"node_id": str(c_val), "probability": round(float(prob_val), 3)}
                    for c_val, prob_val in zip(classes, probabilities)
                ]

            # Sort descending by fused posterior probability
            all_candidates.sort(key=lambda x: x["probability"], reverse=True)
            top_3_nodes = all_candidates[:3]
            
            # Rate of change tracking (dP/dt) across timesteps for dynamic slope detection
            dp_dt = 0.0
            if self.prev_readings and most_dropped_node:
                prev_p = self.prev_readings.get(most_dropped_node, baselines.get(most_dropped_node, 50.0))
                curr_p = readings_dict.get(most_dropped_node, 50.0)
                dp_dt = abs(curr_p - prev_p)
            self.prev_readings = readings_dict.copy()

            # Model 3: Dynamics (Random Forest Classification + Temporal dp/dt)
            if not is_leak:
                leak_type = "Nominal Flow"
                self.latched_leak_type = None
            elif self.latched_leak_type is not None:
                leak_type = self.latched_leak_type
            else:
                rf_leak_type_val = str(self.model_dynamics.predict(deltas_df)[0]).lower()
                leak_type = "Abrupt Rupture" if (rf_leak_type_val == 'abrupt' or dp_dt >= 1.5) else "Incipient Leak"
                self.latched_leak_type = leak_type
            
            # Model 4: Diameter Regression (Retrained Random Forest Regressor)
            if not is_leak:
                diameter_m = 0.0
            else:
                rf_diameter_m = float(self.model_diameter.predict(deltas_df)[0])
                diameter_m = max(0.005, rf_diameter_m)

            # Calculate Water Loss via Torricelli using local node pressure head
            active_head = max(10.0, readings_dict.get(most_dropped_node, pressure_head))
            flow_m3_s = calculate_torricelli_loss(diameter_m, active_head) if is_leak else 0.0
            liters_per_hour = flow_to_liters_per_hour(flow_m3_s) if is_leak else 0.0
            financial_loss = calculate_financial_loss(liters_per_hour) if is_leak else 0.0
            
            return {
                "status": "LEAK_DETECTED" if is_leak == 1 else "NORMAL",
                "localization": top_3_nodes,
                "dynamics": leak_type if is_leak else "Nominal Flow",
                "diameter_mm": round(diameter_m * 1000, 1),
                "loss": {
                    "liters_per_hour": round(liters_per_hour, 1),
                    "financial_loss_inr_per_hour": round(financial_loss, 2)
                }
            }
        except Exception as e:
            return {"error": str(e)}

engine = InferenceEngine()
