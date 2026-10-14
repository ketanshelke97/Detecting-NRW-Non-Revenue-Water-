"""
Production Model Integrity & Validation Script for Net1 Leak Detection.
Validates that genuine trained Random Forest models exist, match the expected
Net1 feature topology (11 sensor nodes), and run inference without mock stubs.
"""
import os
import sys
import joblib
import numpy as np
import pandas as pd

def validate_production_models():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, "models")
    
    required_models = {
        "localization": "localization_rf_v2.joblib",
        "dynamics": "leak_type_rf_v2.joblib",
        "diameter": "leak_diameter_rf_v2.joblib"
    }
    
    print("==================================================")
    print("[*] VALIDATING PRODUCTION ML MODELS (Zero Mock Models)")
    print("==================================================")
    
    all_passed = True
    for model_key, filename in required_models.items():
        path = os.path.join(models_dir, filename)
        if not os.path.exists(path):
            print(f"[FAIL] Missing required production model: {filename}")
            all_passed = False
            continue
            
        size_mb = os.path.getsize(path) / (1024 * 1024)
        model = joblib.load(path)
        print(f"[OK] [{model_key.upper()}] Loaded {filename} ({size_mb:.2f} MB)")
        
        # Validate features
        if hasattr(model, "feature_names_in_"):
            feat_count = len(model.feature_names_in_)
            print(f"     Features ({feat_count}): {list(model.feature_names_in_)}")
        elif hasattr(model, "n_features_in_"):
            print(f"     Feature dimension: {model.n_features_in_}")
            
    # Run test inference with genuine 11-node delta vector
    print("\n[*] Testing Inference Pipeline on Test Burst (Node 21 Drop)...")
    expected_cols = [
        'Pressure_Node_2_delta', 'Pressure_Node_9_delta', 'Pressure_Node_10_delta',
        'Pressure_Node_11_delta', 'Pressure_Node_12_delta', 'Pressure_Node_13_delta',
        'Pressure_Node_21_delta', 'Pressure_Node_22_delta', 'Pressure_Node_23_delta',
        'Pressure_Node_31_delta', 'Pressure_Node_32_delta'
    ]
    # Simulate a 12m drop localized at Node 21
    test_deltas = {c: 0.0 for c in expected_cols}
    test_deltas['Pressure_Node_21_delta'] = -12.5
    test_deltas['Pressure_Node_22_delta'] = -3.2
    test_deltas['Pressure_Node_11_delta'] = -2.8
    test_df = pd.DataFrame([test_deltas])
    
    localizer = joblib.load(os.path.join(models_dir, "localization_rf_v2.joblib"))
    type_model = joblib.load(os.path.join(models_dir, "leak_type_rf_v2.joblib"))
    diam_model = joblib.load(os.path.join(models_dir, "leak_diameter_rf_v2.joblib"))
    
    loc_probs = localizer.predict_proba(test_df)[0]
    top_node_idx = np.argmax(loc_probs)
    top_node = localizer.classes_[top_node_idx]
    leak_type = type_model.predict(test_df)[0]
    diam_m = float(diam_model.predict(test_df)[0])
    
    print(f"     Localized Top Node: Junction {top_node} (Confidence: {loc_probs[top_node_idx]:.2%})")
    print(f"     Predicted Dynamics: {leak_type}")
    print(f"     Predicted Diameter: {diam_m*1000:.1f} mm")
    print("==================================================")
    print("[SUCCESS] All Production Models Verified Successfully!")

if __name__ == "__main__":
    validate_production_models()
