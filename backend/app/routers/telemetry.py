from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any, List, Optional

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
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        with conn:
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
    except Exception as e:
        print(f"[HISTORIAN] DB Init error: {e}")
    finally:
        if conn:
            conn.close()

init_historian_db()

def log_live_historian(packet: dict):
    db_path = os.path.join(settings.BASE_DIR, "leakdb.sqlite")
    conn = None
    try:
        inf = packet.get("inference", {}) or {}
        localization = inf.get("localization") or []
        top_node = localization[0].get("node_id") if localization else None
        top_prob = localization[0].get("probability", 0.0) if localization else 0.0
        loss = inf.get("loss") or {}
        conn = sqlite3.connect(db_path)
        with conn:
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
    except Exception:
        pass
    finally:
        if conn:
            conn.close()

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
    # Fault injection state
    active_fault = None  # dict: {node_id, leak_type, diameter_mm, step_count}
    # Multi-node latched incidents map: node_id -> incident_id
    active_latched_incidents: Dict[str, Optional[int]] = {}
    active_incident_stats: Dict[str, Dict[str, Any]] = {}
    active_scenario_incident_id: Optional[int] = None
    last_processed_step: Optional[int] = None

    def latch_or_update_incident(inf: dict, ts_str: str, step_idx: int) -> Optional[dict]:
        nonlocal active_latched_incidents, active_incident_stats, last_processed_step, active_scenario_incident_id
        is_leak = bool(inf and inf.get("status") == "LEAK_DETECTED")

        if not is_leak:
            # If scenario was actively leaking and returned to nominal, physical repair occurred -> auto-resolve
            if active_scenario_id is not None and active_scenario_incident_id is not None:
                conn = None
                try:
                    db_path = os.path.join(settings.BASE_DIR, "leakdb.sqlite")
                    conn = sqlite3.connect(db_path)
                    with conn:
                        cursor = conn.cursor()
                        cursor.execute("""
                            UPDATE incidents
                            SET status = 'Resolved',
                                resolved_at = coalesce(resolved_at, ?)
                            WHERE id = ? AND status != 'Resolved'
                        """, (ts_str, active_scenario_incident_id))
                except Exception as e:
                    print(f"[SCENARIO AUTO-RESOLVE] Error: {e}")
                finally:
                    if conn:
                        conn.close()
            elif active_scenario_id is None and not active_fault:
                active_latched_incidents.clear()
                active_incident_stats.clear()
            return None

        localization = inf.get("localization") or []
        top_node = localization[0].get("node_id") if localization else "21"
        dynamics = inf.get("dynamics", "Abrupt Rupture")
        instant_diameter_mm = float(inf.get("diameter_mm", 50.0))
        loss = inf.get("loss") or {}
        lph = float(loss.get("liters_per_hour", 0.0))
        inr_per_hour = float(loss.get("financial_loss_inr_per_hour", 0.0))

        if active_scenario_id is not None:
            source = "benchmark_scenario"
            scenario_note = f"EPANET Benchmark {active_scenario_id}"
        else:
            source = "live_telemetry"
            scenario_note = None

        node_key = str(top_node)
        
        # In live SCADA mode, prune nodes that have returned to nominal pressure
        if active_scenario_id is None:
            active_leak_nodes = {str(l.get("node_id")) for l in localization if l.get("probability", 0) >= 0.35}
            if not active_leak_nodes and top_node:
                active_leak_nodes = {node_key}
            for n in list(active_latched_incidents.keys()):
                if n not in active_leak_nodes and (not active_fault or str(active_fault.get("node_id")) != n):
                    active_latched_incidents.pop(n, None)
                    active_incident_stats.pop(n, None)

        # Simulation hydraulic timestep: 30 minutes (0.5 hours) for benchmark scenarios,
        # and 1 second (1 / 3600 hours) for live SCADA telemetry streaming
        dt_hours = 0.5 if active_scenario_id is not None else (1.0 / 3600.0)
        step_vol_m3 = (lph * dt_hours) / 1000.0
        step_cost_inr = inr_per_hour * dt_hours

        # Only accumulate if this is a newly advanced simulation step (avoids re-accumulation during paused seeks/inspects)
        is_step_advanced = (step_idx != last_processed_step)
        if is_step_advanced:
            last_processed_step = step_idx

        # Update running average diameter statistics across all incident timestamps
        stat_key = f"scen_{active_scenario_id}" if active_scenario_id is not None else node_key
        if stat_key not in active_incident_stats:
            active_incident_stats[stat_key] = {
                "count": 1,
                "sum_diameter": instant_diameter_mm
            }
        elif is_step_advanced:
            active_incident_stats[stat_key]["count"] += 1
            active_incident_stats[stat_key]["sum_diameter"] += instant_diameter_mm

        stat = active_incident_stats[stat_key]
        avg_diameter = stat["sum_diameter"] / max(1, stat["count"])

        # Determine severity based on running average diameter and efflux rate
        if avg_diameter >= 50.0 or lph >= 5000:
            sev = "Critical"
        elif avg_diameter >= 15.0 or lph >= 1000:
            sev = "Warning"
        else:
            sev = "Info"

        db_path = os.path.join(settings.BASE_DIR, "leakdb.sqlite")
        conn = None
        try:
            conn = sqlite3.connect(db_path)
            with conn:
                cursor = conn.cursor()
                latched_id = None

                # 1. SCENARIO MODE: A benchmark scenario has EXACTLY ONE single incident ticket
                if active_scenario_id is not None:
                    if active_scenario_incident_id is not None:
                        latched_id = active_scenario_incident_id
                    else:
                        # Check if this scenario was already recorded in DB
                        cursor.execute("""
                            SELECT id FROM incidents 
                            WHERE source = 'benchmark_scenario' AND (notes = ? OR notes LIKE ?)
                            ORDER BY id DESC LIMIT 1
                        """, (scenario_note, f"%{active_scenario_id}%"))
                        scen_row = cursor.fetchone()
                        if scen_row:
                            latched_id = scen_row[0]
                            active_scenario_incident_id = latched_id
                    
                    active_latched_incidents[node_key] = latched_id

                # 2. LIVE SCADA MODE: Check in-memory map or active unresolved DB row
                else:
                    latched_id = active_latched_incidents.get(node_key)
                    if latched_id is None:
                        cursor.execute("""
                            SELECT id FROM incidents 
                            WHERE node_id = ? AND status IN ('New', 'Acknowledged', 'Dispatched') AND source = 'live_telemetry'
                            ORDER BY id DESC LIMIT 1
                        """, (node_key,))
                        live_row = cursor.fetchone()
                        if live_row:
                            latched_id = live_row[0]
                            active_latched_incidents[node_key] = latched_id

                # If no existing incident found in memory OR database, INSERT ONE
                if latched_id is None:
                    cursor.execute("""
                        INSERT INTO incidents (
                            timestamp, node_id, leak_type, diameter_mm, water_loss_liters_per_hour,
                            financial_loss_inr_per_hour, severity, source, total_volume_lost_m3, total_cost_inr, status, notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        ts_str,
                        node_key,
                        dynamics,
                        round(avg_diameter, 1),
                        lph,
                        inr_per_hour,
                        sev,
                        source,
                        round(step_vol_m3, 3),
                        round(step_cost_inr, 2),
                        "New",
                        scenario_note
                    ))
                    new_id = cursor.lastrowid
                    code = f"INC-2026-{new_id:04d}"
                    cursor.execute("UPDATE incidents SET incident_code = ? WHERE id = ?", (code, new_id))
                    active_latched_incidents[node_key] = new_id
                    if active_scenario_id is not None:
                        active_scenario_incident_id = new_id
                    return {
                        "id": new_id,
                        "incident_code": code,
                        "status": "New",
                        "severity": sev,
                        "source": source,
                        "node_id": node_key,
                        "diameter_mm": round(avg_diameter, 1),
                        "total_volume_lost_m3": round(step_vol_m3, 3),
                        "total_cost_inr": round(step_cost_inr, 2),
                        "is_newly_latched": True
                    }
                else:
                    # Update existing incident
                    inc_vol = round(step_vol_m3, 4) if is_step_advanced else 0.0
                    inc_cost = round(step_cost_inr, 2) if is_step_advanced else 0.0

                    cursor.execute("""
                        UPDATE incidents
                        SET total_volume_lost_m3 = total_volume_lost_m3 + ?,
                            total_cost_inr = total_cost_inr + ?,
                            water_loss_liters_per_hour = ?,
                            financial_loss_inr_per_hour = ?,
                            diameter_mm = ?,
                            severity = ?,
                            node_id = ?,
                            status = CASE WHEN status = 'Resolved' THEN 'New' ELSE status END
                        WHERE id = ?
                    """, (
                        inc_vol,
                        inc_cost,
                        lph,
                        inr_per_hour,
                        round(avg_diameter, 1),
                        sev,
                        node_key,
                        latched_id
                    ))
                    cursor.execute("SELECT total_volume_lost_m3, total_cost_inr, status, incident_code FROM incidents WHERE id = ?", (latched_id,))
                    row = cursor.fetchone()
                    if not row:
                        active_latched_incidents.pop(node_key, None)
                        active_incident_stats.pop(stat_key, None)
                        if active_scenario_incident_id == latched_id:
                            active_scenario_incident_id = None
                        return None

                    curr_vol = row[0]
                    curr_cost = row[1]
                    status = row[2]
                    inc_code = row[3] or f"INC-2026-{latched_id:04d}"

                    return {
                        "id": latched_id,
                        "incident_code": inc_code,
                        "status": status,
                        "severity": sev,
                        "source": source,
                        "node_id": node_key,
                        "diameter_mm": round(avg_diameter, 1),
                        "total_volume_lost_m3": round(curr_vol, 3),
                        "total_cost_inr": round(curr_cost, 2),
                        "is_newly_latched": False
                    }
        except Exception as e:
            print(f"[INCIDENT LATCH] Error: {e}")
            return None
        finally:
            if conn:
                conn.close()

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
        nonlocal parsed_rows, total_steps, leak_steps, current_step, active_scenario_id, active_fault, mode, active_scenario_incident_id, active_latched_incidents, active_incident_stats, last_processed_step
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
                
                # Also include metadata start_step to end_step if available within slice bounds
                meta = scenario_manager.get_scenario(scenario_id)
                if meta and meta.get("end_step", 999999) < total_steps:
                    meta_steps = list(range(meta.get("start_step", 15), meta.get("end_step", 28) + 1))
                    leak_steps = sorted(list(set(new_leak_steps + meta_steps)))
                else:
                    leak_steps = new_leak_steps

                parsed_rows = new_parsed
                current_step = 0
                active_fault = None
                active_scenario_incident_id = None
                active_latched_incidents.clear()
                active_incident_stats.clear()
                last_processed_step = None
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
            latched_inc = latch_or_update_incident(inf, ts, step_idx)
            packet = {
                "scenario_id": None,
                "timestamp": ts,
                "step_index": step_idx,
                "total_steps": 120,
                "readings": reading,
                "inference": inf,
                "active_incident": latched_inc,
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
            latched_inc = latch_or_update_incident(inf, ts, idx)
            packet = {
                "scenario_id": active_scenario_id,
                "timestamp": ts,
                "step_index": idx,
                "total_steps": total_steps,
                "readings": reading,
                "inference": inf,
                "active_incident": latched_inc,
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
        nonlocal current_step, live_step, live_start_time, is_paused, speed, mode, active_fault, active_scenario_id, last_processed_step, active_scenario_incident_id
        action = cmd.get("action", "").lower()
        if action == "play":
            if active_scenario_id is not None and current_step >= total_steps - 1:
                current_step = 0
                last_processed_step = None
            is_paused = False
        elif action == "pause":
            is_paused = True
        elif action == "step":
            is_paused = True
            if active_scenario_id is None:
                live_step += 1
            else:
                current_step = min(total_steps - 1, current_step + 1)
        elif action == "seek":
            target = int(cmd.get("step", current_step if active_scenario_id else live_step))
            if active_scenario_id is not None:
                current_step = max(0, min(total_steps - 1, target))
            else:
                live_step = target
            active_latched_incidents.clear()
            active_incident_stats.clear()
            last_processed_step = None
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
            active_latched_incidents.clear()
            active_incident_stats.clear()
            active_scenario_incident_id = None
            last_processed_step = None
            engine.reset_state()
        elif action == "reset":
            if active_scenario_id is None:
                live_step = 0
                live_start_time = datetime.now()
            else:
                current_step = 0
            active_latched_incidents.clear()
            active_incident_stats.clear()
            active_scenario_incident_id = None
            last_processed_step = None
            engine.reset_state()
        elif action == "load_scenario":
            target_scen = cmd.get("scenario_id", "Scenario-111")
            load_scenario_dataset(target_scen)
            is_paused = True
            active_latched_incidents.clear()
            active_incident_stats.clear()
            active_scenario_incident_id = None
            last_processed_step = None
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
            active_latched_incidents.clear()
            active_incident_stats.clear()
            last_processed_step = None
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
                        if current_step + 1 >= total_steps:
                            current_step = total_steps - 1
                            is_paused = True
                        else:
                            current_step += 1
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
        
    # Run prediction directly with the readings dictionary
    result = engine.predict(readings=readings)
    
    return result
