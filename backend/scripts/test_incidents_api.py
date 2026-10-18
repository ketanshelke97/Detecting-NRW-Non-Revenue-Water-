import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api/incidents"

def test_incident_api():
    print("Testing Incident REST API...")
    
    # 1. Fetch existing list
    res = requests.get(BASE_URL)
    assert res.status_code == 200, f"GET failed: {res.text}"
    data = res.json()
    print(f"GET /api/incidents -> Status {data['status']}, Total: {data['total_count']}, Active: {data['active_count']}")
    
    # 2. Create test incident
    payload = {
        "node_id": "21",
        "leak_type": "Abrupt Rupture",
        "diameter_mm": 92.5,
        "water_loss_liters_per_hour": 14200.0,
        "notes": "Automated verification burst test"
    }
    res_post = requests.post(BASE_URL, json=payload)
    assert res_post.status_code == 200, f"POST failed: {res_post.text}"
    new_inc = res_post.json()
    inc_id = new_inc["id"]
    print(f"POST /api/incidents -> Created {new_inc['incident_code']} (ID: {inc_id}), Severity: {new_inc['severity']}, Status: {new_inc['status']}")
    assert new_inc["severity"] == "Critical"
    assert new_inc["status"] == "New"
    
    # 3. Acknowledge incident
    res_ack = requests.post(f"{BASE_URL}/{inc_id}/acknowledge")
    assert res_ack.status_code == 200, f"Acknowledge failed: {res_ack.text}"
    ack_inc = res_ack.json()
    print(f"POST /api/incidents/{inc_id}/acknowledge -> Status: {ack_inc['status']}, AckAt: {ack_inc['acknowledged_at']}")
    assert ack_inc["status"] == "Acknowledged"
    assert ack_inc["acknowledged_at"] is not None

    # 4. Dispatch incident with crew and isolation valves
    disp_payload = {
        "team_name": "Jal Shakti Rapid Response Unit 1",
        "technician_name": "Er. Rajesh Patil",
        "contact_number": "+91 98230 11223",
        "priority": "P1 - Critical",
        "isolation_valves": ["V-PIPE111", "V-PIPE21", "V-PIPE121"],
        "notes": "Emergency valve shutoff in progress"
    }
    res_disp = requests.post(f"{BASE_URL}/{inc_id}/dispatch", json=disp_payload)
    assert res_disp.status_code == 200, f"Dispatch failed: {res_disp.text}"
    disp_inc = res_disp.json()
    print(f"POST /api/incidents/{inc_id}/dispatch -> Status: {disp_inc['status']}, Team: {disp_inc['dispatch_team']}, WO: {disp_inc['work_order_code']}")
    assert disp_inc["status"] == "Dispatched"
    assert disp_inc["work_order_code"] is not None

    # 5. Fetch generated work order
    res_wo = requests.get(f"{BASE_URL}/{inc_id}/work-order")
    assert res_wo.status_code == 200, f"Work order fetch failed: {res_wo.text}"
    wo = res_wo.json()
    print(f"GET /api/incidents/{inc_id}/work-order -> WO Code: {wo['work_order_code']}, Target Valves: {wo['isolation_protocol']['target_valves']}")
    assert len(wo["isolation_protocol"]["target_valves"]) >= 1
    assert len(wo["equipment_checklist"]) >= 3

    # 6. Resolve incident
    res_res = requests.post(f"{BASE_URL}/{inc_id}/resolve")
    assert res_res.status_code == 200, f"Resolve failed: {res_res.text}"
    resolved_inc = res_res.json()
    print(f"POST /api/incidents/{inc_id}/resolve -> Status: {resolved_inc['status']}, ResolvedAt: {resolved_inc['resolved_at']}")
    assert resolved_inc["status"] == "Resolved"
    assert resolved_inc["resolved_at"] is not None

    print("\n[PASS] All Incident REST & Field Crew Dispatch API tests passed successfully!")

if __name__ == "__main__":
    try:
        test_incident_api()
    except Exception as e:
        print(f"[FAIL] Test failed: {e}")
        sys.exit(1)
