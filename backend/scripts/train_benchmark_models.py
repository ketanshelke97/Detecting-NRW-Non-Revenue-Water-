"""
This script trains the 4 Machine Learning models (Random Forest) for Net1 leak detection.
It generates .joblib files that will be placed in the backend/models/ directory.
"""
import os
import joblib
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
import numpy as np

# Dummy training logic to create the files if they don't exist
def train_dummy_models(models_dir):
    print("Training dummy models...")
    
    # Model 1: Detection
    clf1 = RandomForestClassifier(n_estimators=10)
    X = np.random.rand(100, 11)
    y = np.random.randint(0, 2, 100)
    clf1.fit(X, y)
    joblib.dump(clf1, os.path.join(models_dir, "model_detection.joblib"))
    
    # Model 2: Localization
    clf2 = RandomForestClassifier(n_estimators=10)
    y_loc = np.random.randint(0, 11, 100)
    clf2.fit(X, y_loc)
    joblib.dump(clf2, os.path.join(models_dir, "model_localization.joblib"))
    
    # Model 3: Dynamics
    clf3 = RandomForestClassifier(n_estimators=10)
    y_dyn = np.random.randint(0, 2, 100)
    clf3.fit(X, y_dyn)
    joblib.dump(clf3, os.path.join(models_dir, "model_dynamics.joblib"))
    
    # Model 4: Diameter Regression
    reg4 = RandomForestRegressor(n_estimators=10)
    y_diam = np.random.rand(100) * 0.1
    reg4.fit(X, y_diam)
    joblib.dump(reg4, os.path.join(models_dir, "model_diameter.joblib"))
    
    print("Models saved successfully.")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, "models")
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
    train_dummy_models(models_dir)
