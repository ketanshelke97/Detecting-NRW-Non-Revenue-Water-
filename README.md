# NRW Digital Twin - Non-Revenue Water Leak Detection & SCADA System

An advanced SCADA digital twin and machine learning system for real-time detection, localization, and classification of Non-Revenue Water (NRW) in municipal water distribution networks (Net1).

---

## 🌟 Key Features

- **Interactive SCADA Digital Twin**: Interactive network topology visualization using `@xyflow/react` (React Flow) with live pressure gradient heatmaps, node telemetry, and pipe flow animations.
- **Machine Learning Inference Pipeline**: Multi-target Random Forest models predicting:
  - **Leak Occurrence**: Anomaly detection with dynamic baselines.
  - **Leak Localization**: Pinpoints fault node coordinates (e.g., Node 11, Node 22).
  - **Leak Dynamics**: Classifies incipient leaks, burst leaks, or transient events.
  - **Leak Diameter & Rate**: Estimates orifice size (mm) and calculates physical volume loss ($L/hr$) via Torricelli orifice equations.
- **Financial & Volume Loss Analytics**: Real-time economic loss calculation (USD/INR per hour) and cumulative NRW water loss tracking.
- **Real-Time WebSocket Telemetry**: High-frequency duplex streaming between FastAPI and React with playback controls (Play, Pause, Reset, 1x/2x/5x speed).
- **Fault Injection & Scenario Engine**:
  - Test pre-configured leak scenarios (Scenario-1, Scenario-107, Scenario-RealLeak, etc.).
  - Interactive fault injection: simulate burst pipes, valve closures, and pressure drops on the fly.
- **SCADA Control Deck**: Pressure envelopes, hydraulic gradients, flow rates, and cumulative loss charts powered by Recharts.

---

## 🛠️ Tech Stack

- **Backend**:
  - Python 3.10+ / 3.14
  - FastAPI & Starlette WebSockets
  - Scikit-Learn, NumPy, Pandas, Joblib
  - SQLAlchemy & SQLite
- **Frontend**:
  - React 19 + TypeScript + Vite
  - TailwindCSS
  - React Flow (`@xyflow/react`)
  - Recharts & Lucide React
  - Zustand (State Management) & TanStack Query

---

## 🚀 Quick Setup on a New Machine

Follow these simple steps after cloning the repository:

### 1. Clone the Repository
```bash
git clone https://github.com/ketanshelke97/Detecting-NRW-Non-Revenue-Water-.git
cd Detecting-NRW-Non-Revenue-Water-
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
.\venv\Scripts\activate.bat
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server (port 8000)
python -m uvicorn app.main:app --port 8000 --reload
```
The backend API will run at `http://localhost:8000` (Swagger docs available at `http://localhost:8000/docs`).

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 📁 Repository Structure

```text
├── .gitignore                     # Git ignore rules (filters node_modules, pycache, huge datasets)
├── IMPLEMENTATION_PLAN.md         # Detailed system design and architecture specs
├── README.md                      # Project documentation and setup guide
├── backend/
│   ├── app/
│   │   ├── core/                  # Database config and settings
│   │   ├── models/                # SQLAlchemy incident and leak models
│   │   ├── routers/               # API endpoints (network, scenarios, telemetry)
│   │   ├── services/              # Hydraulics, inference engine, topology, scenario loader
│   │   └── main.py                # FastAPI entry point
│   ├── data/                      # Net1 network topology and scenario CSVs
│   ├── models/                    # Trained Random Forest ML weights (v2 models)
│   ├── scripts/                   # Training and benchmark scripts
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/            # Layout, SCADA Map, Charts, Fault Injection, Telemetry Deck
│   │   ├── hooks/                 # WebSocket and topology hooks
│   │   ├── store/                 # Zustand SCADA store
│   │   ├── services/              # Axios API service
│   │   ├── App.tsx                # Main SCADA dashboard
│   │   └── main.tsx               # App mount
│   ├── package.json               # Node.js dependencies
│   └── vite.config.ts             # Vite configuration
└── scratch/                       # Test and utility scripts
```

---

## 🧪 Testing the System

1. Open `http://localhost:5173`.
2. Click **Play** on the SCADA toolbar to start the live telemetry simulation.
3. Use the **Scenario Catalog** or **Fault Injection Panel** to trigger a leak.
4. Watch the Digital Twin map highlight the localized leak node in red/orange with real-time pressure loss metrics and financial impact indicators.
