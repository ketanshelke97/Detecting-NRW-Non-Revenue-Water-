from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any, List

router = APIRouter()

import asyncio
import csv
import json
import math
import os
import random
import sqlite3
from datetime import datetime, timedelta
from app.core.config import settings

def init_historian_db():
    db_path = os.path.join(settings.BASE_DIR, "leakdb.sqlite")
    try:
        with sqlite3.connect(db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS scada_live_historian (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    step_index INTEGER,
                    node_readings TEXT,
                    status TEXT,
                    top_leak_node TEXT,
                    leak_probability REAL,
                    diameter_mm REAL,
                    flow_lph REAL,
                    financial_loss_inr REAL,
                    is_fault_injected INTEGER
                )
            """)
            conn.commit()
    except Exception as e:
        print(f"[HISTORIAN] DB Init error: {e}")

init_historian_db()

def log_live_historian(packet: dict):
    db_path = os.path.join(settings.BASE_DIR, "leakdb.sqlite")
    try:
        inf = packet.get("inference", {}) or {}
        localization = inf.get("localization") or []
        top_node = localization[0].get("node_id") if localization else None
        top_prob = localization[0].get("probability", 0.0) if localization else 0.0
        loss = inf.get("loss") or {}
        with sqlite3.connect(db_path) as conn:
            conn.execute("""
                INSERT INTO scada_live_historian 
                (timestamp, step_index, node_readings, status, top_leak_node, leak_probability, diameter_mm, flow_lph, financial_loss_inr, is_fault_injected)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                packet.get("timestamp"),
                packet.get("step_index", 0),
                json.dumps(packet.get("readings", {})),
                inf.get("status", "NOMINAL"),
                top_node,
                top_prob,
                inf.get("diameter_mm", 0.0),
                loss.get("liters_per_hour", 0.0),
                loss.get("financial_loss_inr_per_hour", 0.0),
                1 if packet.get("fault_injection", {}).get("active") else 0
            ))
            conn.commit()
    except Exception:
        pass

@router.websocket("/ws/scada-stream")
async def scada_stream(websocket: WebSocket):
    """
    Dual-Mode SCADA Engine:
    1. LIVE SCADA: Continuous real-time EPANET nominal baseline streamer with diurnal cycle,
       micro-sensor jitter, dynamic Torricelli fault injection, and SQLite Historian logging.
    2. SCENARIO LAB: Historical benchmark incident replay with timeline seeking and speed controls.
    """
    await websocket.accept()
    from app.services.inference import engine
    
    if not engine.models_loaded:
        engine.load_models()
        
    baselines = {
        '9': 54.0, '10': 54.2, '11': 53.8, '12': 52.1, '13': 51.9,
        '2': 56.0, '21': 51.2, '22': 53.5, '23': 54.1, '31': 55.0,
        '32': 54.7, '33': 53.9
    }

    # Net1 physical pipe adjacency mapping
    ADJACENCY = {
        '9': ['10'],
        '10': ['9', '11'],
        '11': ['10', '12', '21'],
        '12': ['11', '13', '2', '22'],
        '13': ['12', '23'],
        '2': ['12'],
        '21': ['11', '22', '31'],
        '22': ['12', '21', '23', '32'],
        '23': ['13', '22', '33'],
        '31': ['21', '32'],
        '32': ['22', '31', '33'],
        '33': ['23', '32']
    }

    mode = "live"
    active_scenario_id = None
    is_paused = False
    speed = 1.0

    # Live generator state
    live_step = 0
    live_start_time = datetime.now()

    # Historical scenario state
    parsed_rows: List[tuple] = []
    total_steps = 120
    leak_steps: List[int] = []
    current_step = 0

    # Fault injection state
    active_fault = None  # dict: {node_id, leak_type, diameter_mm, step_count}

    def generate_live_readings(step: int) -> tuple[str, dict]:
        # 48 steps = 24-hr diurnal cycle (Net1 benchmark demand curve)
        diurnal = 0.45 * math.sin(2 * math.pi * (step % 48) / 48)
        ts = (live_start_time + timedelta(seconds=step)).strftime("%Y-%m-%d %H:%M:%S")
        readings = {}
        for n, b in baselines.items():
            jitter = random.uniform(-0.10, 0.10)
            readings[n] = round(b + diurnal + jitter, 2)
        return ts, readings

    def load_scenario_dataset(scenario_id: str):
        nonlocal parsed_rows, total_steps, leak_steps, current_step, active_scenario_id, active_fault, mode
        try:
            from app.services.scenario_manager import scenario_manager
            csv_path = scenario_manager.ensure_scenario_csv(scenario_id)
            with open(csv_path, 'r', encoding='utf-8') as f:
                new_reader = list(csv.DictReader(f))
            if new_reader:
                active_scenario_id = scenario_id
                mode = "historical"
                total_steps = len(new_reader)
                new_leak_steps = []
                new_parsed = []
                for idx, row in enumerate(new_reader):
                    reading = {k.replace('node_', ''): float(v) for k, v in row.items() if k != 'timestamp'}
                    new_parsed.append((row['timestamp'], reading))
                    max_drop = max([baselines.get(n, 50.0) - reading.get(n, 50.0) for n in baselines], default=0.0)
                    if max_drop > 4.0:
                        new_leak_steps.append(idx)
                parsed_rows = new_parsed
                leak_steps = new_leak_steps
                current_step = 0
                active_fault = None
        except Exception as e:
            print(f"Error loading scenario {scenario_id}: {e}")

    def apply_fault_overlay(reading: dict) -> dict:
        """Apply physics-based pressure drop overlay for injected fault onto current readings."""
        if not active_fault:
            return reading
        result = dict(reading)
        fault_node = str(active_fault["node_id"])
        diameter_mm = float(active_fault["diameter_mm"])

        # Net1 benchmark calibration:
        d_ref_mm = 95.7
        drop_ref_m = 28.0
        ratio = max(0.01, diameter_mm / d_ref_mm)
        pressure_drop = min(drop_ref_m * 1.5, drop_ref_m * (ratio ** 1.6))

        curr_pressure = result.get(fault_node, baselines.get(fault_node, 50.0))
        result[fault_node] = max(5.0, curr_pressure - pressure_drop)

        # Secondary hydraulic attenuation: direct topological pipe neighbors receive headloss
        direct_neighbors = ADJACENCY.get(fault_node, [])
        for neighbor in direct_neighbors:
            if neighbor in result:
                secondary_drop = pressure_drop * 0.16
                result[neighbor] = max(10.0, result[neighbor] - secondary_drop)
        return result

    async def send_telemetry_packet(step_idx: int):
        fault_info = {
            "active": active_fault is not None,
            "node_id": active_fault["node_id"] if active_fault else None,
            "leak_type": active_fault["leak_type"] if active_fault else None,
            "diameter_mm": active_fault["diameter_mm"] if active_fault else None,
        } if active_fault else {"active": False}

        if active_scenario_id is None:
            # LIVE SCADA stream
            ts, raw_reading = generate_live_readings(step_idx)
            reading = apply_fault_overlay(raw_reading)
            inf = engine.predict(readings=reading, fault_context=active_fault)
            packet = {
                "scenario_id": None,
                "timestamp": ts,
                "step_index": step_idx,
                "total_steps": 120,
                "readings": reading,
                "inference": inf,
                "is_paused": is_paused,
                "speed": speed,
                "mode": "live",
                "leak_steps": [],
                "repair_step": None,
                "fault_injection": fault_info,
            }
            await websocket.send_json(packet)
            log_live_historian(packet)
        else:
            # SCENARIO LAB replay
            if not parsed_rows:
                return
            idx = step_idx % len(parsed_rows)
            ts, raw_reading = parsed_rows[idx]
            reading = apply_fault_overlay(raw_reading)
            inf = engine.predict(readings=reading, fault_context=active_fault)
            packet = {
                "scenario_id": active_scenario_id,
                "timestamp": ts,
                "step_index": idx,
                "total_steps": total_steps,
                "readings": reading,
                "inference": inf,
                "is_paused": is_paused,
                "speed": speed,
                "mode": "historical",
                "leak_steps": leak_steps,
                "repair_step": (max(leak_steps) + 1) if leak_steps else None,
                "fault_injection": fault_info,
            }
            await websocket.send_json(packet)

    cmd_queue = asyncio.Queue()

    async def receive_cmds():
        try:
            while True:
                data = await websocket.receive_json()
                await cmd_queue.put(data)
        except Exception:
            await cmd_queue.put({"action": "disconnect"})

    def process_cmd(cmd: dict):
        nonlocal current_step, live_step, live_start_time, is_paused, speed, mode, active_fault, active_scenario_id
        action = cmd.get("action", "").lower()
        if action == "play":
            is_paused = False
        elif action == "pause":
            is_paused = True
        elif action == "step":
            is_paused = True
            if active_scenario_id is None:
                live_step += 1
            else:
                current_step = (current_step + 1) % total_steps
        elif action == "seek":
            target = int(cmd.get("step", current_step if active_scenario_id else live_step))
            if active_scenario_id is not None:
                current_step = max(0, min(total_steps - 1, target))
            else:
                live_step = target
        elif action == "set_speed":
            speed = float(cmd.get("speed", 1.0))
        elif action == "set_mode":
            target_mode = cmd.get("mode", "live")
            if target_mode == "live":
                mode = "live"
                active_scenario_id = None
                is_paused = False
            else:
                mode = "historical"
                is_paused = True
            engine.reset_state()
        elif action == "reset":
            if active_scenario_id is None:
                live_step = 0
                live_start_time = datetime.now()
            else:
                current_step = 0
            engine.reset_state()
        elif action == "load_scenario":
            target_scen = cmd.get("scenario_id", "Scenario-111")
            load_scenario_dataset(target_scen)
            is_paused = True
            engine.reset_state()
        elif action == "inject_fault":
            active_fault = {
                "node_id": str(cmd.get("node_id", "21")),
                "leak_type": cmd.get("leak_type", "abrupt"),
                "diameter_mm": float(cmd.get("diameter_mm", 25.0)),
                "step_count": 0,
            }
            print(f"[FAULT INJECTION] Node {active_fault['node_id']} | {active_fault['leak_type']} | Ø {active_fault['diameter_mm']}mm")
        elif action == "clear_fault":
            print(f"[FAULT CLEAR] Fault cleared — hydraulic recovery in progress")
            active_fault = None
            engine.reset_state()

    recv_task = asyncio.create_task(receive_cmds())

    try:
        # Send initial packet
        initial_step = live_step if active_scenario_id is None else current_step
        await send_telemetry_packet(initial_step)

        while True:
            # Drain queue of all immediate commands
            while not cmd_queue.empty():
                cmd = cmd_queue.get_nowait()
                if cmd.get("action") == "disconnect":
                    return
                process_cmd(cmd)

            if is_paused:
                # Wait indefinitely until next command
                cmd = await cmd_queue.get()
                if cmd.get("action") == "disconnect":
                    return
                process_cmd(cmd)
                step_to_send = live_step if active_scenario_id is None else current_step
                await send_telemetry_packet(step_to_send)
            else:
                # Advancing stream according to speed multiplier
                delay = max(0.01, 1.0 / speed)
                try:
                    cmd = await asyncio.wait_for(cmd_queue.get(), timeout=delay)
                    if cmd.get("action") == "disconnect":
                        return
                    process_cmd(cmd)
                    step_to_send = live_step if active_scenario_id is None else current_step
                    await send_telemetry_packet(step_to_send)
                except asyncio.TimeoutError:
                    if active_scenario_id is None:
                        live_step += 1
                        await send_telemetry_packet(live_step)
                    else:
                        current_step = (current_step + 1) % total_steps
                        await send_telemetry_packet(current_step)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"SCADA WebSocket Stream error: {e}")
    finally:
        if not recv_task.done():
            recv_task.cancel()

@router.post("/analyze")
def analyze_telemetry(readings: Dict[str, float]) -> Dict[str, Any]:
    """
    Run inference on any arbitrary 11-sensor readings.
    """
    from app.services.inference import engine
    
    if not engine.models_loaded:
        engine.load_models()
        
    # Convert readings dict to a feature list
    features = list(readings.values()) if len(readings) == 11 else []
    
    # Run prediction
    result = engine.predict(features=features)
    
    return result
