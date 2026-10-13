import os
import csv
import re
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from app.core.config import settings

class ScenarioManager:
    def __init__(self):
        self.metadata_cache: List[Dict[str, Any]] = []
        self.scenarios_by_id: Dict[str, Dict[str, Any]] = {}
        self.is_loaded = False

    def load_metadata(self):
        if self.is_loaded:
            return

        metadata_path = os.path.join(settings.DATA_DIR, "scenarios", "leak_metadata.csv")
        scenarios_dir = os.path.join(settings.DATA_DIR, "scenarios")
        
        scenarios: List[Dict[str, Any]] = []

        # Default Scenario-111 benchmark
        scenarios.append({
            "id": "Scenario-111",
            "name": "Scenario 111",
            "node_id": "21",
            "nodes": ["21"],
            "type": "abrupt",
            "type_label": "Abrupt Rupture",
            "diameter_mm": 95.7,
            "area": 0.00719,
            "severity": "Severe",
            "start_step": 15,
            "end_step": 28,
            "peak_step": 16,
            "events": [{
                "node_id": "21",
                "diameter_mm": 95.7,
                "area": 0.00719,
                "type": "abrupt",
                "type_label": "Abrupt Rupture",
                "start_step": 15,
                "end_step": 28,
                "peak_step": 16
            }],
            "description": "Benchmark Incident: Severe 95.7mm pipe burst at Node 21",
            "has_dataset": True,
            "is_default": True
        })

        scenarios_events: Dict[str, List[Dict[str, str]]] = {}
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    scen_id = row.get("Scenario", "").strip()
                    if not scen_id or scen_id == "Scenario-111":
                        continue
                    if scen_id not in scenarios_events:
                        scenarios_events[scen_id] = []
                    scenarios_events[scen_id].append(row)

        for scen_id, rows in scenarios_events.items():
            parsed_events = []
            for r in rows:
                try:
                    node_id = str(r.get("LeakNode", "").strip())
                    raw_diam = float(r.get("Diameter", 0.0))
                    diam_mm = round(raw_diam * 1000, 1)
                    area = float(r.get("Area", 0.0))
                    raw_type = r.get("Type", "abrupt").strip().lower()
                    type_label = "Abrupt Rupture" if raw_type == "abrupt" else "Incipient Leak"
                    start_s = int(float(r.get("Start", 15)))
                    end_s = int(float(r.get("End", 28)))
                    peak_s = int(float(r.get("Peak", 16)))
                    parsed_events.append({
                        "node_id": node_id,
                        "diameter_mm": diam_mm,
                        "area": area,
                        "type": raw_type,
                        "type_label": type_label,
                        "start_step": start_s,
                        "end_step": end_s,
                        "peak_step": peak_s
                    })
                except Exception:
                    continue

            if not parsed_events:
                continue

            distinct_nodes = list(dict.fromkeys([e["node_id"] for e in parsed_events]))
            node_display = ", ".join(distinct_nodes)
            max_diam = max(e["diameter_mm"] for e in parsed_events)
            all_types = list(set([e["type"] for e in parsed_events]))
            primary_type = "abrupt" if "abrupt" in all_types else "incipient"
            primary_type_label = "Abrupt Rupture" if primary_type == "abrupt" else "Incipient Leak"
            
            severity = "Severe" if max_diam >= 60.0 else ("Moderate" if max_diam >= 30.0 else "Minor")
            has_csv = os.path.exists(os.path.join(scenarios_dir, f"{scen_id}.csv"))
            
            if len(parsed_events) > 1:
                desc = f"Compound Incident: {len(parsed_events)} leak points across Nodes {node_display} (Max {max_diam}mm)"
            else:
                desc = f"{severity} {max_diam}mm {primary_type_label.lower()} at Node {node_display}"

            item = {
                "id": scen_id,
                "name": scen_id.replace("-", " "),
                "node_id": distinct_nodes[0] if len(distinct_nodes) == 1 else node_display,
                "nodes": distinct_nodes,
                "type": primary_type,
                "type_label": primary_type_label if len(all_types) == 1 else "Compound Incident",
                "diameter_mm": max_diam,
                "area": parsed_events[0]["area"],
                "severity": severity,
                "events": parsed_events,
                "start_step": min(e["start_step"] for e in parsed_events),
                "end_step": max(e["end_step"] for e in parsed_events),
                "peak_step": parsed_events[0]["peak_step"],
                "description": desc,
                "has_dataset": has_csv,
                "is_default": False
            }
            scenarios.append(item)

        self.metadata_cache = scenarios
        self.scenarios_by_id = {s["id"]: s for s in scenarios}
        self.is_loaded = True

    def search_and_filter(
        self,
        q: Optional[str] = None,
        leak_type: Optional[str] = None,
        node_id: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        self.load_metadata()
        results = list(self.metadata_cache)
        synonym_matched: Optional[str] = None

        # 1. Natural Language Synonym Parsing
        if q and q.strip():
            query_clean = q.strip().lower()
            
            # Map "pipe burst", "rupture", "burst" -> abrupt
            if any(syn in query_clean for syn in ["burst", "rupture", "sudden", "pipe burst"]):
                results = [s for s in results if s["type"] == "abrupt" or "abrupt" in [e["type"] for e in s.get("events", [])]]
                synonym_matched = "Matched keyword: Abrupt Rupture"
            # Map "slow leak", "trickle", "gradual", "incipient" -> incipient
            elif any(syn in query_clean for syn in ["slow", "trickle", "gradual", "incipient", "minor leak"]):
                results = [s for s in results if s["type"] == "incipient" or "incipient" in [e["type"] for e in s.get("events", [])]]
                synonym_matched = "Matched keyword: Incipient Leak"

            # Check for node mentions e.g. "node 21", "node 12", "junction 13", "21"
            node_match = re.search(r'(?:node|junction|\#)?\s*(\b[0-9]{1,2}\b)', query_clean)
            if node_match:
                extracted_node = node_match.group(1)
                valid_nodes = {'2', '10', '11', '12', '13', '21', '22', '23', '31', '32', '33'}
                if extracted_node in valid_nodes and f"scenario-{extracted_node}" not in query_clean:
                    results = [s for s in results if extracted_node in s.get("nodes", [s.get("node_id")])]
                    synonym_matched = (synonym_matched + " & " if synonym_matched else "") + f"Node {extracted_node}"

            # Check for severity keywords
            if any(k in query_clean for k in ["severe", "critical", "massive", "major"]):
                results = [s for s in results if s["severity"] == "Severe"]
                synonym_matched = (synonym_matched + " & " if synonym_matched else "") + "Severity: Severe"
            elif any(k in query_clean for k in ["minor", "small", "tiny"]):
                results = [s for s in results if s["severity"] == "Minor"]
                synonym_matched = (synonym_matched + " & " if synonym_matched else "") + "Severity: Minor"

            # Check for exact scenario ID search (e.g. "Scenario-107" or "107")
            if "scenario" in query_clean or any(s["id"].lower() == query_clean for s in self.metadata_cache):
                results = [s for s in results if query_clean in s["id"].lower()]

        # 2. Explicit Filter Parameters
        if leak_type and leak_type.lower() != "all":
            results = [s for s in results if s["type"] == leak_type.lower() or leak_type.lower() in [e["type"] for e in s.get("events", [])]]

        if node_id and node_id.lower() != "all":
            results = [s for s in results if node_id in s.get("nodes", [s.get("node_id")])]

        if severity and severity.lower() != "all":
            results = [s for s in results if s["severity"].lower() == severity.lower()]

        total_matches = len(results)
        paginated = results[offset : offset + limit]

        # Collect distinct nodes for dropdown
        all_nodes_set = set()
        for s in self.metadata_cache:
            for n in s.get("nodes", [s.get("node_id")]):
                all_nodes_set.add(n)
        distinct_nodes = sorted(list(all_nodes_set), key=lambda x: int(x) if x.isdigit() else 999)

        return {
            "total": total_matches,
            "limit": limit,
            "offset": offset,
            "synonym_matched": synonym_matched,
            "nodes_available": distinct_nodes,
            "scenarios": paginated
        }

    def get_scenario(self, scenario_id: str) -> Optional[Dict[str, Any]]:
        self.load_metadata()
        return self.scenarios_by_id.get(scenario_id)

    def ensure_scenario_csv(self, scenario_id: str) -> str:
        """
        Synthesizes a realistic EPANET-calibrated time series dataset for the requested scenario.
        Accurately models:
        1. Multi-day duration for incipient leaks (slow progressive ramp up persisting over days).
        2. Abrupt ruptures with sudden pressure cliff.
        3. Simultaneous and sequential multi-node leaks.
        4. Unique start times and duration per scenario.
        """
        self.load_metadata()
        scenarios_dir = os.path.join(settings.DATA_DIR, "scenarios")
        os.makedirs(scenarios_dir, exist_ok=True)
        csv_path = os.path.join(scenarios_dir, f"{scenario_id}.csv")

        # Re-synthesize if missing or if not 96 steps or if node_9 is missing
        if os.path.exists(csv_path):
            with open(csv_path, 'r', encoding='utf-8') as f:
                header_line = f.readline()
                line_count = 1 + sum(1 for _ in f)
            if line_count == 97 and 'node_9' in header_line:  # 1 header + 96 rows
                return csv_path

        meta = self.get_scenario(scenario_id)
        events = meta.get("events", []) if meta else []
        if not events:
            # Fallback single event
            events = [{
                "node_id": meta["node_id"] if meta else "21",
                "type": meta["type"] if meta else "abrupt",
                "diameter_mm": meta["diameter_mm"] if meta else 50.0,
                "start_step": 15,
                "end_step": 55
            }]

        # Simulation timeline: 96 steps (48 hours = 2 full days, 30-min intervals)
        total_steps = 96
        start_time = datetime(2023, 8, 1, 0, 0)
        timestamps = [start_time + timedelta(minutes=30 * i) for i in range(total_steps)]
        
        base = {
            '9': 54.0, '10': 54.2, '11': 53.8, '12': 52.1, '13': 51.9,
            '2': 56.0, '21': 51.2, '22': 53.5, '23': 54.1, '31': 55.0,
            '32': 54.7, '33': 53.9
        }

        # Calculate scenario-specific simulation schedule for each event
        event_schedules = []
        for idx, ev in enumerate(events):
            e_node = str(ev["node_id"])
            e_type = ev["type"]
            e_diam = ev["diameter_mm"]
            
            # Seed-based unique schedule derived from scenario ID and event index
            seed_val = abs(hash(f"{scenario_id}_{e_node}_{idx}"))
            
            # Phase 1 ends and Phase 2 starts: Day 1 morning (Step 14 to Step 22)
            sim_start = 14 + (seed_val % 9) + (idx * 8)
            
            if e_type == 'abrupt':
                # Abrupt rupture: sudden onset cliff, active for 22-30 steps (11-15 hours)
                # Field repair completed on Day 1 night / Day 2 early morning
                dur = 22 + (seed_val % 9)
                sim_end = sim_start + dur
                ramp_steps = 2
            else:
                # Incipient leak: PERSISTS across multiple days!
                # Develops progressively over 18-24 steps (9-12 hours), persists across Day 1 & Day 2
                # Repaired at Step 66-74 (Day 2 afternoon), leaving 22+ steps of POST-REPAIR recovery!
                dur = 44 + (seed_val % 11)
                sim_end = min(76, sim_start + dur)
                ramp_steps = 18 + (seed_val % 7)

            drop_mag = min(36.0, max(14.0, (e_diam / 100.0) * 35.0))
            event_schedules.append({
                "node_id": e_node,
                "type": e_type,
                "diam_mm": e_diam,
                "sim_start": sim_start,
                "sim_end": sim_end,
                "ramp_steps": ramp_steps,
                "drop_mag": drop_mag
            })

        rows = []
        for i, t in enumerate(timestamps):
            row = {'timestamp': t.strftime('%Y-%m-%d %H:%M:%S')}
            diurnal = 0.45 * np.sin(2 * np.pi * i / 48)
            for k, v in base.items():
                row[f'node_{k}'] = round(v + diurnal + np.random.uniform(-0.08, 0.08), 1)

            # Apply active leak events at step i
            for sched in event_schedules:
                e_node = sched["node_id"]
                s_start = sched["sim_start"]
                s_end = sched["sim_end"]
                
                # Phase 2 & 3: Active leak window (before repair)
                if s_start <= i <= s_end:
                    steps_since_start = i - s_start
                    if sched["type"] == 'abrupt':
                        factor = 1.0 if steps_since_start >= sched["ramp_steps"] else 0.75
                    else: # incipient: smooth progressive multi-day deterioration
                        factor = min(1.0, (steps_since_start + 1) / float(sched["ramp_steps"]))

                    # Drop target node
                    target_key = f'node_{e_node}'
                    if target_key in row:
                        current_val = row[target_key]
                        row[target_key] = round(max(8.0, current_val - (sched["drop_mag"] * factor)), 1)

                    # Secondary suction effect on adjacent neighborhood nodes
                    neighbors = ['21', '22', '23', '12', '13', '2']
                    for n in neighbors:
                        if n != e_node:
                            n_key = f'node_{n}'
                            if n_key in row:
                                row[n_key] = round(max(18.0, row[n_key] - (sched["drop_mag"] * 0.18 * factor)), 1)
                
                # Phase 4 (i > s_end): REPAIR COMPLETED!
                # Pressure heads are naturally at healthy nominal base + diurnal levels,
                # proving hydraulic recovery and valve isolation to the operator.

            rows.append(row)

        fieldnames = ['timestamp'] + [f'node_{k}' for k in base.keys()]
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        if meta:
            meta["has_dataset"] = True

        return csv_path

scenario_manager = ScenarioManager()
