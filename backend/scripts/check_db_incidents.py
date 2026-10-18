import sqlite3
import json

conn = sqlite3.connect('leakdb.sqlite')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("""
    SELECT id, incident_code, timestamp, node_id, leak_type, diameter_mm, 
           water_loss_liters_per_hour, financial_loss_inr_per_hour, severity, 
           total_volume_lost_m3, total_cost_inr, status, acknowledged_at, resolved_at 
    FROM incidents 
    ORDER BY id DESC 
    LIMIT 5
""")
rows = [dict(r) for r in cur.fetchall()]
print(json.dumps(rows, indent=2))
