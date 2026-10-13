from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import joblib
import os

app = Flask(__name__)

# ============================================================
# LOAD MODELS AND DATA
# ============================================================

print("Loading models...")

MODEL_DETECTION = "../data/net1/random_forest_v3_temporal.joblib"
MODEL_LOCALIZATION = "../data/net1/localization_rf_v2.joblib"
MODEL_TYPE = "../data/net1/leak_type_rf_v2.joblib"
MODEL_DIAMETER = "../data/net1/leak_diameter_rf_v2.joblib"

TEST_FILE = "../data/net1/test_temporal_features.csv"
METADATA_FILE = "../data/net1/leak_metadata.csv"

try:
    detector = joblib.load(MODEL_DETECTION)
    localizer = joblib.load(MODEL_LOCALIZATION)
    type_model = joblib.load(MODEL_TYPE)
    diameter_model = joblib.load(MODEL_DIAMETER)
    print("✓ All models loaded successfully")
    print(f"  Localizer expects features: {list(localizer.feature_names_in_)}")
except FileNotFoundError as e:
    print(f"✗ Model not found: {e}")
except AttributeError:
    print("  (localizer has no feature_names_in_ — older sklearn version)")

try:
    test_df = pd.read_csv(TEST_FILE)
    metadata = pd.read_csv(METADATA_FILE)
    print(f"✓ Test data loaded: {len(test_df)} rows")
except FileNotFoundError as e:
    print(f"✗ Data not found: {e}")

# ============================================================
# ROUTES
# ============================================================

@app.route('/')
def index():
    scenarios = sorted(test_df['Scenario'].unique())
    return render_template('index.html', scenarios=scenarios)


@app.route('/get_scenarios')
def get_scenarios():
    scenarios = sorted(test_df['Scenario'].unique().tolist())
    return jsonify({'scenarios': scenarios})


@app.route('/analyze', methods=['POST'])
def analyze():
    scenario_name = request.json.get('scenario')

    if not scenario_name:
        return jsonify({'error': 'No scenario selected'}), 400

    try:
        scenario_df = test_df[test_df['Scenario'] == scenario_name].sort_values('Index')

        if scenario_df.empty:
            return jsonify({'error': f'Scenario {scenario_name} not found'}), 404

        # ---- DETECTION ----
        X = scenario_df.drop(columns=['Scenario', 'Index', 'Label'])
        probs = detector.predict_proba(X)[:, 1]
        row_preds = (probs >= 0.45).astype(int)
        positive_frac = np.mean(row_preds)

        is_leak = positive_frac >= 0.01

        result = {
            'scenario': scenario_name,
            'detection': 'Leak Detected' if is_leak else 'No Leak',
            'confidence': float(positive_frac),
        }

        if not is_leak:
            return jsonify(result)

        # ---- LOCALIZATION / TYPE / DIAMETER ----
        pressure_cols = [c for c in X.columns if 'Pressure_Node' in c and '_delta' not in c]
        print(f"[DEBUG] pressure_cols found: {pressure_cols}")

        leak_indices = np.where(row_preds == 1)[0]
        print(f"[DEBUG] leak_indices count: {len(leak_indices)}")

        if pressure_cols and len(leak_indices) > 10:
            leak_mean = scenario_df.iloc[leak_indices][pressure_cols].mean()

            pre_start = max(0, leak_indices[0] - 100)
            pre_mean = scenario_df.iloc[pre_start:leak_indices[0]][pressure_cols].mean()

            deltas = leak_mean - pre_mean
            delta_df = pd.DataFrame([deltas])
            delta_df.columns = [c + '_delta' for c in pressure_cols]

            print(f"[DEBUG] delta_df columns: {list(delta_df.columns)}")
            print(f"[DEBUG] delta_df values: {delta_df.values}")

            try:
                expected_cols = list(localizer.feature_names_in_)
                delta_df = delta_df[expected_cols]  # reorder/match exactly

                node_probs = localizer.predict_proba(delta_df)[0]
                top_nodes = [int(localizer.classes_[i]) for i in np.argsort(node_probs)[-3:][::-1]]
                result['top_nodes'] = ','.join(map(str, top_nodes))

                result['leak_type'] = type_model.predict(delta_df)[0]
                result['diameter'] = float(diameter_model.predict(delta_df)[0])

                print(f"[DEBUG] SUCCESS: {result}")

            except Exception as e:
                print(f"[ERROR] Localization/Type/Diameter failed: {e}")
                result['debug_error'] = str(e)
        else:
            print("[DEBUG] Skipped — not enough leak_indices or no pressure_cols")

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("\n" + "="*60)
    print("NRW LEAK DETECTION PROTOTYPE")
    print("="*60)
    print("Starting Flask app...")
    print("Open http://localhost:8000 in your browser")
    print("="*60 + "\n")
    app.run(debug=True, port=8000)