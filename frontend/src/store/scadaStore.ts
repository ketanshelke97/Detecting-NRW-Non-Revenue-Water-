import { create } from 'zustand';

export interface NodeTelemetry {
  pressure: number;
  isLeak: boolean;
  leakProbability: number;
}

export interface InferenceData {
  status: string;
  confidence?: number;
  localization?: Array<{ node_id: string; probability: number }>;
  dynamics?: string;
  diameter_mm?: number;
  loss?: {
    liters_per_hour: number;
    financial_loss_inr_per_hour: number;
  };
}

export const NET1_BASELINES: Record<string, number> = {
  '2': 56.0, '9': 54.0, '10': 54.2, '11': 53.8, '12': 52.1,
  '13': 51.9, '21': 51.2, '22': 53.5, '23': 54.1, '31': 55.0,
  '32': 54.7, '33': 53.9,
};

export interface TelemetryHistoryPoint {
  step: number;
  timestamp: string;
  pressures: Record<string, number>;
  baselines: Record<string, number>;
  deltas: Record<string, number>;
  flowLph: number;
  cumulativeLossM3: number;
  financialLossInr: number;
  isLeak: boolean;
  activeFaultNode?: string | null;
}

interface ScadaState {
  selectedNodeId: string | null;
  activeScenarioId: string | null;
  isLiveStreamActive: boolean;
  nodeData: Record<string, NodeTelemetry>;
  isolatedZoneNodes: string[];
  
  // Phase 3 Playback & Simulation State
  isPlaybackPaused: boolean;
  playbackSpeed: number;
  simulationMode: 'live' | 'historical';
  currentStepIndex: number;
  totalStepCount: number;
  currentTimestamp: string;
  leakStepIndices: number[];
  repairStep: number | null;
  latestInference: InferenceData | null;
  
  // Phase 3 Step 2 Scenario Catalog State
  isScenarioCatalogOpen: boolean;
  activeScenarioMetadata: any;

  // Phase 3 Step 3: Fault Injection State
  isFaultInjectionPanelOpen: boolean;
  activeFault: { node_id: string; leak_type: string; diameter_mm: number } | null;

  // Phase 3 Step 4: Time-Series Telemetry History Buffer
  telemetryHistory: TelemetryHistoryPoint[];

  // Live SCADA DVR Time-Machine State
  isLiveDvrMode: boolean;
  dvrScrubIndex: number | null;

  // Phase 4 Step 3: Incident Management & Alarm Log State
  isIncidentDrawerOpen: boolean;
  activeLatchedIncident: any | null;
  incidentRefreshTrigger: number;
  activeIncidentCount: number;
  criticalIncidentCount: number;

  // Phase 4 Step 4: Field Crew Dispatch Modal State
  isDispatchModalOpen: boolean;
  dispatchIncidentTarget: any | null;

  setSelectedNodeId: (id: string | null) => void;
  setActiveScenarioId: (id: string | null) => void;
  setLiveStreamActive: (active: boolean) => void;
  updateNodeTelemetry: (nodeId: string, telemetry: NodeTelemetry) => void;
  bulkUpdateTelemetry: (data: Record<string, NodeTelemetry>) => void;
  setIsolatedZoneNodes: (nodes: string[]) => void;
  
  // Simulation Control Actions
  setPlaybackPaused: (paused: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setSimulationMode: (mode: 'live' | 'historical') => void;
  setCurrentStepIndex: (step: number) => void;
  setTotalStepCount: (total: number) => void;
  setCurrentTimestamp: (ts: string) => void;
  setLeakStepIndices: (steps: number[]) => void;
  setRepairStep: (step: number | null) => void;
  setLatestInference: (inf: InferenceData | null) => void;
  setIsScenarioCatalogOpen: (open: boolean) => void;
  setActiveScenarioMetadata: (meta: any) => void;

  // Fault injection actions
  setIsFaultInjectionPanelOpen: (open: boolean) => void;
  setActiveFault: (fault: { node_id: string; leak_type: string; diameter_mm: number } | null) => void;

  // Telemetry History actions
  addTelemetryHistoryPoint: (point: TelemetryHistoryPoint) => void;
  setTelemetryHistory: (points: TelemetryHistoryPoint[]) => void;
  clearTelemetryHistory: () => void;

  // Live DVR actions
  setIsLiveDvrMode: (active: boolean) => void;
  setDvrScrubIndex: (index: number | null) => void;
  returnToLive: () => void;

  // Incident Management actions
  setIsIncidentDrawerOpen: (open: boolean) => void;
  setActiveLatchedIncident: (incident: any | null) => void;
  triggerIncidentRefresh: () => void;
  setActiveIncidentCount: (count: number) => void;
  setCriticalIncidentCount: (count: number) => void;

  // Field Crew Dispatch actions
  setIsDispatchModalOpen: (open: boolean) => void;
  setDispatchIncidentTarget: (incident: any | null) => void;
  openDispatchModal: (incident?: any) => void;

  // Active Field Dispatches & Lifecycle
  activeDispatches: ActiveDispatch[];
  addActiveDispatch: (dispatch: {
    incidentId: number;
    incidentCode: string;
    nodeId: string;
    teamName: string;
    technicianName?: string;
    etaSeconds: number;
    autoRepair: boolean;
  }) => void;
  tickDispatchCountdown: () => void;
  removeActiveDispatch: (incidentId: number) => void;
  markDispatchRepaired: (incidentId: number) => void;
}

export interface ActiveDispatch {
  incidentId: number;
  incidentCode: string;
  nodeId: string;
  teamName: string;
  technicianName?: string;
  etaSeconds: number;
  remainingSeconds: number;
  autoRepair: boolean;
  phase: 'en_route' | 'on_site' | 'repaired';
  dispatchedAt: number;
  isExecuted?: boolean;
}

export const useScadaStore = create<ScadaState>((set) => ({
  selectedNodeId: null,
  activeScenarioId: null,
  isLiveStreamActive: true,
  nodeData: {},
  isolatedZoneNodes: [],
  
  isPlaybackPaused: false,
  playbackSpeed: 1,
  simulationMode: 'live',
  currentStepIndex: 0,
  totalStepCount: 120,
  currentTimestamp: new Date().toLocaleTimeString(),
  leakStepIndices: [],
  repairStep: null,
  latestInference: null,
  
  isScenarioCatalogOpen: false,
  activeScenarioMetadata: null,

  // Fault injection defaults
  isFaultInjectionPanelOpen: false,
  activeFault: null,

  // Telemetry History & DVR defaults
  telemetryHistory: [],
  isLiveDvrMode: false,
  dvrScrubIndex: null,

  // Incident defaults
  isIncidentDrawerOpen: false,
  activeLatchedIncident: null,
  incidentRefreshTrigger: 0,
  activeIncidentCount: 0,
  criticalIncidentCount: 0,

  // Dispatch modal defaults
  isDispatchModalOpen: false,
  dispatchIncidentTarget: null,
  activeDispatches: [],
  
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setActiveScenarioId: (id) => set({ activeScenarioId: id }),
  setLiveStreamActive: (active) => set({ isLiveStreamActive: active }),
  updateNodeTelemetry: (nodeId, telemetry) => 
    set((state) => ({
      nodeData: { ...state.nodeData, [nodeId]: telemetry }
    })),
  bulkUpdateTelemetry: (data) =>
    set((state) => ({
      nodeData: { ...state.nodeData, ...data }
    })),
  setIsolatedZoneNodes: (nodes) => set({ isolatedZoneNodes: nodes }),
  
  setPlaybackPaused: (paused) => set({ isPlaybackPaused: paused }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setSimulationMode: (mode) => set({ simulationMode: mode }),
  setCurrentStepIndex: (step) => set({ currentStepIndex: step }),
  setTotalStepCount: (total) => set({ totalStepCount: total }),
  setCurrentTimestamp: (ts) => set({ currentTimestamp: ts }),
  setLeakStepIndices: (steps) => set({ leakStepIndices: steps }),
  setRepairStep: (step) => set({ repairStep: step }),
  setLatestInference: (inf) => set({ latestInference: inf }),
  setIsScenarioCatalogOpen: (open) => set({ isScenarioCatalogOpen: open }),
  setActiveScenarioMetadata: (meta) => set({ activeScenarioMetadata: meta }),

  setIsFaultInjectionPanelOpen: (open) => set({ isFaultInjectionPanelOpen: open }),
  setActiveFault: (fault) => set({ activeFault: fault }),

  addTelemetryHistoryPoint: (point) =>
    set((state) => {
      const idx = state.telemetryHistory.findIndex((p) => p.step === point.step);
      let updated: TelemetryHistoryPoint[];
      if (idx >= 0) {
        updated = [...state.telemetryHistory];
        updated[idx] = point;
      } else {
        updated = [...state.telemetryHistory, point].sort((a, b) => a.step - b.step);
      }
      if (updated.length > 120) {
        updated = updated.slice(updated.length - 120);
      }
      return { telemetryHistory: updated };
    }),
  setTelemetryHistory: (points) => set({ telemetryHistory: points }),
  clearTelemetryHistory: () => set({ telemetryHistory: [] }),
  setIsLiveDvrMode: (active) => set({ isLiveDvrMode: active }),
  setDvrScrubIndex: (index) => set({ dvrScrubIndex: index }),
  returnToLive: () => set({ isLiveDvrMode: false, dvrScrubIndex: null, isPlaybackPaused: false }),

  // Incident actions
  setIsIncidentDrawerOpen: (open) => set({ isIncidentDrawerOpen: open }),
  setActiveLatchedIncident: (incident) => set({ activeLatchedIncident: incident }),
  triggerIncidentRefresh: () => set((s) => ({ incidentRefreshTrigger: s.incidentRefreshTrigger + 1 })),
  setActiveIncidentCount: (count) => set({ activeIncidentCount: count }),
  setCriticalIncidentCount: (count) => set({ criticalIncidentCount: count }),

  // Field Crew Dispatch actions
  setIsDispatchModalOpen: (open) => set({ isDispatchModalOpen: open }),
  setDispatchIncidentTarget: (incident) => set({ dispatchIncidentTarget: incident }),
  openDispatchModal: (incident) => set({ 
    dispatchIncidentTarget: incident || null, 
    isDispatchModalOpen: true 
  }),

  // Active Field Dispatches & Lifecycle
  addActiveDispatch: (dispatch) => set((state) => {
    const filtered = state.activeDispatches.filter((d) => d.incidentId !== dispatch.incidentId);
    return {
      activeDispatches: [
        ...filtered,
        {
          ...dispatch,
          remainingSeconds: dispatch.etaSeconds,
          phase: 'en_route',
          dispatchedAt: Date.now(),
          isExecuted: false,
        }
      ]
    };
  }),

  tickDispatchCountdown: () => set((state) => {
    if (state.activeDispatches.length === 0) return state;
    const updated = state.activeDispatches.map((d) => {
      if (d.phase === 'repaired') return d;
      const nextRemaining = Math.max(0, d.remainingSeconds - 1);
      const nextPhase: 'en_route' | 'on_site' | 'repaired' = 
        nextRemaining <= 0 ? 'repaired' : (nextRemaining <= 15 ? 'on_site' : 'en_route');
      return {
        ...d,
        remainingSeconds: nextRemaining,
        phase: nextPhase,
      };
    });
    return { activeDispatches: updated };
  }),

  removeActiveDispatch: (incidentId) => set((state) => ({
    activeDispatches: state.activeDispatches.filter((d) => d.incidentId !== incidentId)
  })),

  markDispatchRepaired: (incidentId) => set((state) => ({
    activeDispatches: state.activeDispatches.map((d) => 
      d.incidentId === incidentId ? { ...d, phase: 'repaired', remainingSeconds: 0, isExecuted: true } : d
    )
  })),
}));

