import axios from 'axios';

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return 'http://127.0.0.1:8000';
    }
    return window.location.origin;
  }
  return 'http://127.0.0.1:8000';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getNetworkTopology = async () => {
  const response = await apiClient.get('/api/network/net1');
  return response.data;
};

export interface ScenarioItem {
  id: string;
  name: string;
  node_id: string;
  type: 'abrupt' | 'incipient';
  type_label: string;
  diameter_mm: number;
  area: number;
  severity: 'Minor' | 'Moderate' | 'Severe';
  start_step: number;
  end_step: number;
  peak_step: number;
  description: string;
  has_dataset: boolean;
  is_default?: boolean;
  nodes?: string[];
  events?: any[];
}

export interface ScenariosResponse {
  total: number;
  count: number;
  offset: number;
  limit: number;
  synonym_matched?: string | null;
  nodes_available: string[];
  scenarios: ScenarioItem[];
}

export const fetchScenarios = async (params: {
  q?: string;
  leak_type?: string;
  node_id?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<ScenariosResponse> => {
  const response = await apiClient.get<ScenariosResponse>('/api/scenarios/', { params });
  return response.data;
};

export const selectScenarioApi = async (scenarioId: string) => {
  const response = await apiClient.post('/api/scenarios/select', { scenario_id: scenarioId });
  return response.data;
};

