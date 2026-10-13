import requests

def test_endpoints():
    print("Testing /api/network/net1...")
    res = requests.get("http://127.0.0.1:8000/api/network/net1")
    print(f"Status: {res.status_code}, Response length: {len(res.json().get('nodes', []))} nodes")
    
    print("\nTesting /api/scenarios...")
    res = requests.get("http://127.0.0.1:8000/api/scenarios/")
    print(f"Status: {res.status_code}, Scenarios found: {len(res.json())}")

    print("\nTesting /api/scenarios/historical-audit...")
    payload = {"scenario_id": "Scenario-111", "start_date": "", "end_date": ""}
    res = requests.post("http://127.0.0.1:8000/api/scenarios/historical-audit", json=payload)
    print(f"Status: {res.status_code}, Data: {res.json()}")

if __name__ == '__main__':
    test_endpoints()
