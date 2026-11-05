"""
Database Showcase & Inspection Script
Run this script to show the evaluator the SQLite database tables and data directly in the terminal.

Usage:
    python backend/scripts/show_database.py
"""
import os
import sys
import sqlite3
import pandas as pd

# Ensure UTF-8 output on Windows terminal
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

pd.set_option('display.max_columns', None)
pd.set_option('display.width', 1000)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "leakdb.sqlite")

def main():
    print("=" * 80)
    print("  WATER LEAK DETECTION & NRW SYSTEM - DATABASE INSPECTION")
    print("=" * 80)
    print(f" Database File: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database file not found at {DB_PATH}")
        return

    file_size_mb = os.path.getsize(DB_PATH) / (1024 * 1024)
    print(f" File Size:     {file_size_mb:.2f} MB")
    print("-" * 80)

    conn = sqlite3.connect(DB_PATH)

    # 1. Summary of Tables
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [row[0] for row in cursor.fetchall()]
    
    print("\n[+] DATABASE TABLES OVERVIEW:")
    for tbl in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {tbl};")
        count = cursor.fetchone()[0]
        print(f"   * Table: {tbl:<22} -> Total Records: {count:,}")

    # 2. Latest Incidents Table
    if "incidents" in tables:
        print("\n" + "=" * 80)
        print("[!] LATEST LEAK INCIDENTS (Table: incidents)")
        print("=" * 80)
        df_incidents = pd.read_sql_query("""
            SELECT id, incident_code, node_id, leak_type, diameter_mm, 
                   water_loss_liters_per_hour, severity, status, 
                   technician_name, dispatch_team
            FROM incidents 
            ORDER BY id DESC 
            LIMIT 8;
        """, conn)
        print(df_incidents.to_string(index=False))

    # 3. SCADA Live Historian Sample
    if "scada_live_historian" in tables:
        print("\n" + "=" * 80)
        print("[*] SCADA LIVE HISTORIAN / SENSOR TELEMETRY (Table: scada_live_historian)")
        print("=" * 80)
        df_historian = pd.read_sql_query("""
            SELECT id, timestamp, status, top_leak_node, leak_probability, 
                   diameter_mm, flow_lph, financial_loss_inr, is_fault_injected
            FROM scada_live_historian 
            ORDER BY id DESC 
            LIMIT 5;
        """, conn)
        print(df_historian.to_string(index=False))

    conn.close()
    print("\n" + "=" * 80)
    print("[SUCCESS] Database connection active and verified.")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
