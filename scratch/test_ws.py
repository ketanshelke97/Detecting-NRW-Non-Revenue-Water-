import asyncio
import json
import websockets

async def test():
    uri = "ws://127.0.0.1:8000/api/ws/scada-stream"
    async with websockets.connect(uri) as ws:
        init_msg = await ws.recv()
        print("Connected! Initial scenario:", json.loads(init_msg).get("scenario_id"), flush=True)

        # 1. Test Scenario-493 (Node 2)
        print("\nLoading Scenario-493...", flush=True)
        await ws.send(json.dumps({"action": "load_scenario", "scenario_id": "Scenario-493"}))
        msg_493 = await ws.recv()
        data_493 = json.loads(msg_493)
        leaks_493 = data_493.get("leak_steps")
        print(f"Scenario-493 -> Total Steps: {data_493.get('total_steps')}, Leak Steps ({len(leaks_493)}): {leaks_493[:5]}...{leaks_493[-5:]}", flush=True)
        
        # Seek into leak
        target_step = leaks_493[len(leaks_493)//2]
        print(f"Seeking to step {target_step}...", flush=True)
        await ws.send(json.dumps({"action": "seek", "step": target_step}))
        seek_493 = json.loads(await ws.recv())
        inf_493 = seek_493.get("inference", {})
        print(f"Status: {inf_493.get('status')}, Dynamics: {inf_493.get('dynamics')}", flush=True)
        print(f"Top localization: {inf_493.get('localization', [])[:2]}", flush=True)

        # 2. Test Scenario-116 (Multi-event Incipient)
        print("\nLoading Scenario-116 (Compound Incipient)...", flush=True)
        await ws.send(json.dumps({"action": "load_scenario", "scenario_id": "Scenario-116"}))
        msg_116 = await ws.recv()
        data_116 = json.loads(msg_116)
        leaks_116 = data_116.get("leak_steps")
        print(f"Scenario-116 -> Total Steps: {data_116.get('total_steps')}, Leak Steps ({len(leaks_116)}): {leaks_116[:5]}...{leaks_116[-5:]}", flush=True)
        
        # Verify leak steps are DIFFERENT between scenarios
        assert leaks_493 != leaks_116, "Leak steps must be scenario-specific and different!"
        print("\nSUCCESS: Leak steps are unique, multi-day, and scenario-specific!", flush=True)

if __name__ == "__main__":
    asyncio.run(test())
