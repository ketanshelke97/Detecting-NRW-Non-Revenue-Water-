export interface IncidentItem {
  id: number;
  incident_code: string;
  timestamp: string;
  node_id: string;
  leak_type: string;
  diameter_mm: number;
  water_loss_liters_per_hour: number;
  financial_loss_inr_per_hour: number;
  severity: 'Critical' | 'Warning' | 'Info';
  source?: 'simulation_drill' | 'live_telemetry' | 'benchmark_scenario' | string;
  total_volume_lost_m3: number;
  total_cost_inr: number;
  status: 'New' | 'Acknowledged' | 'Dispatched' | 'Resolved';
  acknowledged_at?: string | null;
  dispatched_at?: string | null;
  resolved_at?: string | null;
  dispatch_team?: string | null;
  technician_name?: string | null;
  contact_number?: string | null;
  priority?: string | null;
  work_order_code?: string | null;
  isolation_valves?: string | null;
  equipment_checklist?: string | null;
  notes?: string | null;
}

export interface DispatchPayload {
  team_name?: string;
  technician_name?: string;
  contact_number?: string;
  priority?: string;
  estimated_arrival_minutes?: number;
  isolation_valves?: string[];
  equipment_checklist?: string[];
  notes?: string;
}

export interface DirectDispatchPayload extends DispatchPayload {
  node_id: string;
  leak_type?: string;
  diameter_mm?: number;
  water_loss_liters_per_hour?: number;
  financial_loss_inr_per_hour?: number;
  severity?: string;
  source?: string;
}

export interface WorkOrderData {
  work_order_code: string;
  incident_code: string;
  incident_id: number;
  status: string;
  priority: string;
  created_at: string;
  dispatched_at?: string | null;
  resolved_at?: string | null;
  location: {
    node_id: string;
    label: string;
    zone: string;
    elevation_m: number;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  hydraulics: {
    leak_type: string;
    diameter_mm: number;
    efflux_liters_per_hour: number;
    efflux_m3_per_hour: number;
    burn_rate_inr_per_hour: number;
    total_volume_lost_m3: number;
    total_cost_inr: number;
    severity: string;
  };
  isolation_protocol: {
    target_valves: string[];
    affected_pipes: string[];
    procedure_summary: string;
    estimated_affected_connections: number;
  };
  equipment_checklist: string[];
  field_crew: {
    team_name: string;
    technician_name: string;
    contact_number: string;
  };
  authority: {
    department: string;
    system: string;
    sign_off_title: string;
  };
  notes?: string | null;
}

export interface IncidentsResponse {
  status: string;
  total_count: number;
  active_count: number;
  critical_count: number;
  resolved_count: number;
  incidents: IncidentItem[];
}

const BASE_URL = 'http://127.0.0.1:8000/api/incidents';

export const incidentService = {
  async fetchIncidents(params?: { status?: string; severity?: string; source?: string; limit?: number }): Promise<IncidentsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status && params.status !== 'all') {
      searchParams.append('status', params.status);
    }
    if (params?.severity && params.severity !== 'all') {
      searchParams.append('severity', params.severity);
    }
    if (params?.source && params.source !== 'all') {
      searchParams.append('source', params.source);
    }
    if (params?.limit) {
      searchParams.append('limit', String(params.limit));
    }

    const url = `${BASE_URL}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch incidents: ${res.statusText}`);
    }
    return res.json();
  },

  async acknowledgeIncident(id: number): Promise<IncidentItem> {
    const res = await fetch(`${BASE_URL}/${id}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to acknowledge incident: ${res.statusText}`);
    }
    return res.json();
  },

  async dispatchIncident(id: number, payload: DispatchPayload): Promise<IncidentItem> {
    const res = await fetch(`${BASE_URL}/${id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to dispatch crew for incident ${id}: ${res.statusText}`);
    }
    return res.json();
  },

  async dispatchDirectLeak(payload: DirectDispatchPayload): Promise<IncidentItem> {
    const res = await fetch(`${BASE_URL}/dispatch-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to dispatch direct leak: ${res.statusText}`);
    }
    return res.json();
  },

  async fetchWorkOrder(id: number): Promise<WorkOrderData> {
    const res = await fetch(`${BASE_URL}/${id}/work-order`);
    if (!res.ok) {
      throw new Error(`Failed to fetch work order for incident ${id}: ${res.statusText}`);
    }
    return res.json();
  },

  async updateIncidentStatus(id: number, status: string, notes?: string): Promise<IncidentItem> {
    const res = await fetch(`${BASE_URL}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update incident status: ${res.statusText}`);
    }
    return res.json();
  },

  async resolveIncident(id: number): Promise<IncidentItem> {
    const res = await fetch(`${BASE_URL}/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to resolve incident: ${res.statusText}`);
    }
    return res.json();
  },

  async clearAllIncidents(): Promise<{ status: string; deleted_count: number }> {
    const res = await fetch(`${BASE_URL}/clear`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(`Failed to clear incidents: ${res.statusText}`);
    }
    return res.json();
  },
};
