import { useEffect, useState, useCallback } from 'react';
import { useScadaStore, NET1_BASELINES } from '../store/scadaStore';
import type { NodeTelemetry } from '../store/scadaStore';

// Module-level Singleton WebSocket State
let sharedWs: WebSocket | null = null;
const subscribers = new Set<(connected: boolean) => void>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function notifySubscribers(connected: boolean) {
  subscribers.forEach((cb) => cb(connected));
}

function connectSharedWebSocket() {
  if (sharedWs && (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const ws = new WebSocket('ws://127.0.0.1:8000/api/ws/scada-stream');
  sharedWs = ws;

  ws.onopen = () => {
    console.log('[SCADA] Single WebSocket Connected');
    notifySubscribers(true);
    const state = useScadaStore.getState();
    ws.send(JSON.stringify({ action: 'set_speed', speed: state.playbackSpeed }));
    if (state.isPlaybackPaused) {
      ws.send(JSON.stringify({ action: 'pause' }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.readings) {
        const updates: Record<string, NodeTelemetry> = {};
        const isLeakDetected = data.inference?.status === 'LEAK_DETECTED';
        const localization = data.inference?.localization || [];

        for (const [nodeId, pressure] of Object.entries(data.readings)) {
          if (nodeId === 'timestamp') continue;
          const locData = localization.find((l: any) => l.node_id === String(nodeId));
          updates[nodeId] = {
            pressure: Number(pressure),
            isLeak: isLeakDetected && !!locData && locData.probability >= 0.35,
            leakProbability: locData ? locData.probability : 0,
          };
        }
        const store = useScadaStore.getState();
        if (!store.isLiveDvrMode) {
          store.bulkUpdateTelemetry(updates);
          if (data.step_index !== undefined) store.setCurrentStepIndex(data.step_index);
          if (data.timestamp) store.setCurrentTimestamp(data.timestamp);
          if (data.inference) store.setLatestInference(data.inference);
        }

        if (data.mode) store.setSimulationMode(data.mode);
        if (data.scenario_id !== undefined) store.setActiveScenarioId(data.scenario_id);
        if (data.total_steps !== undefined) store.setTotalStepCount(data.total_steps);
        if (data.leak_steps) store.setLeakStepIndices(data.leak_steps);
        if (data.repair_step !== undefined) store.setRepairStep(data.repair_step);
        if (data.is_paused !== undefined && !store.isLiveDvrMode) store.setPlaybackPaused(data.is_paused);
        if (data.active_incident !== undefined) {
          store.setActiveLatchedIncident(data.active_incident);
          if (data.active_incident?.is_newly_latched) {
            store.triggerIncidentRefresh();
          }
        }

        // Build synchronized time-series history point (Phase 3 Step 4)
        const pressures: Record<string, number> = {};
        const deltas: Record<string, number> = {};
        for (const [nId, p] of Object.entries(data.readings)) {
          if (nId === 'timestamp') continue;
          const pNum = Number(p);
          pressures[nId] = pNum;
          deltas[nId] = Number((pNum - (NET1_BASELINES[nId] ?? 50.0)).toFixed(2));
        }

        const flowLph = data.inference?.loss?.liters_per_hour || 0;
        const financialLossInr = data.inference?.loss?.financial_loss_inr_per_hour || Number((flowLph * 0.025).toFixed(2));

        const prevHist = store.telemetryHistory;
        const prevPt = prevHist.find((p) => p.step === ((data.step_index || 0) - 1));
        const prevLoss = (data.step_index === 0 || !prevPt) ? 0 : prevPt.cumulativeLossM3;

        // Option 2: 30 minutes (0.5 hr) in Scenario Lab, 1 second (1 / 3600 hr) in Live SCADA
        const isScenarioMode = Boolean(data.scenario_id) || data.mode === 'historical';
        const dtHours = isScenarioMode ? 0.5 : (1.0 / 3600.0);
        const stepLossM3 = (flowLph * dtHours) / 1000.0;
        let cumulativeLossM3 = Number((prevLoss + stepLossM3).toFixed(2));

        // When backend provides an actively latched incident, synchronize directly with verified database volume
        if (data.active_incident && typeof data.active_incident.total_volume_lost_m3 === 'number') {
          cumulativeLossM3 = Number(data.active_incident.total_volume_lost_m3.toFixed(2));
        }

        store.addTelemetryHistoryPoint({
          step: data.step_index ?? 0,
          timestamp: data.timestamp || '',
          pressures,
          baselines: NET1_BASELINES,
          deltas,
          flowLph,
          cumulativeLossM3,
          financialLossInr,
          isLeak: isLeakDetected,
          activeFaultNode: data.fault_injection?.active ? String(data.fault_injection.node_id) : null,
        });
      }
    } catch (err) {
      console.error('[SCADA] Message parsing error:', err);
    }
  };

  ws.onclose = () => {
    notifySubscribers(false);
    sharedWs = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (useScadaStore.getState().isLiveStreamActive) {
      reconnectTimer = setTimeout(() => {
        if (useScadaStore.getState().isLiveStreamActive) {
          connectSharedWebSocket();
        }
      }, 3000);
    }
  };

  ws.onerror = (err) => {
    console.error('[SCADA] WebSocket error:', err);
    notifySubscribers(false);
    ws.close();
  };
}

function disconnectSharedWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (sharedWs) {
    sharedWs.close();
    sharedWs = null;
  }
  notifySubscribers(false);
}

export function sendSharedCommand(cmd: Record<string, any>) {
  if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
    sharedWs.send(JSON.stringify(cmd));
  }
}

export function triggerClearFault() {
  useScadaStore.getState().setActiveFault(null);
  sendSharedCommand({ action: 'clear_fault' });
}

export function useScadaStream() {
  const [isConnected, setIsConnected] = useState(
    () => !!sharedWs && sharedWs.readyState === WebSocket.OPEN
  );

  const isLiveStreamActive = useScadaStore((state) => state.isLiveStreamActive);
  const setLiveStreamActive = useScadaStore((state) => state.setLiveStreamActive);
  const setPlaybackPaused = useScadaStore((state) => state.setPlaybackPaused);
  const setPlaybackSpeed = useScadaStore((state) => state.setPlaybackSpeed);
  const setSimulationMode = useScadaStore((state) => state.setSimulationMode);
  const setCurrentStepIndex = useScadaStore((state) => state.setCurrentStepIndex);

  useEffect(() => {
    subscribers.add(setIsConnected);
    return () => {
      subscribers.delete(setIsConnected);
    };
  }, []);

  useEffect(() => {
    if (isLiveStreamActive) {
      connectSharedWebSocket();
    } else {
      disconnectSharedWebSocket();
    }
  }, [isLiveStreamActive]);

  const sendPlay = useCallback(() => {
    if (!useScadaStore.getState().isLiveStreamActive) {
      setLiveStreamActive(true);
    }
    setPlaybackPaused(false);
    sendSharedCommand({ action: 'play' });
  }, [setLiveStreamActive, setPlaybackPaused]);

  const sendPause = useCallback(() => {
    setPlaybackPaused(true);
    sendSharedCommand({ action: 'pause' });
  }, [setPlaybackPaused]);

  const sendStep = useCallback(() => {
    if (!useScadaStore.getState().isLiveStreamActive) {
      setLiveStreamActive(true);
    }
    setPlaybackPaused(true);
    sendSharedCommand({ action: 'step' });
  }, [setLiveStreamActive, setPlaybackPaused]);

  const sendSeek = useCallback((step: number) => {
    setCurrentStepIndex(step);
    sendSharedCommand({ action: 'seek', step });
  }, [setCurrentStepIndex]);

  const sendSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    sendSharedCommand({ action: 'set_speed', speed });
  }, [setPlaybackSpeed]);

  const sendMode = useCallback((mode: 'live' | 'historical') => {
    setSimulationMode(mode);
    if (mode === 'live') {
      useScadaStore.getState().setActiveScenarioId(null);
      useScadaStore.getState().setActiveScenarioMetadata(null);
      useScadaStore.getState().setIsLiveDvrMode(false);
      useScadaStore.getState().setDvrScrubIndex(null);
      useScadaStore.getState().setPlaybackPaused(false);
    }
    sendSharedCommand({ action: 'set_mode', mode });
  }, [setSimulationMode]);

  const sendReset = useCallback(() => {
    setCurrentStepIndex(0);
    useScadaStore.getState().clearTelemetryHistory();
    useScadaStore.getState().setIsLiveDvrMode(false);
    sendSharedCommand({ action: 'reset' });
  }, [setCurrentStepIndex]);

  const loadScenario = useCallback((scenarioId: string) => {
    useScadaStore.getState().clearTelemetryHistory();
    useScadaStore.getState().setSimulationMode('historical');
    useScadaStore.getState().setIsLiveDvrMode(false);
    sendSharedCommand({ action: 'load_scenario', scenario_id: scenarioId });
    useScadaStore.getState().setActiveScenarioId(scenarioId);
  }, []);

  const sendInjectFault = useCallback(
    (nodeId: string, leakType: string, diameterMm: number) => {
      const fault = { node_id: nodeId, leak_type: leakType, diameter_mm: diameterMm };
      useScadaStore.getState().setActiveFault(fault);
      sendSharedCommand({ action: 'inject_fault', ...fault });
    },
    []
  );

  const sendClearFault = useCallback(() => {
    useScadaStore.getState().setActiveFault(null);
    sendSharedCommand({ action: 'clear_fault' });
  }, []);

  const scrubToDvrIndex = useCallback((index: number) => {
    const hist = useScadaStore.getState().telemetryHistory;
    if (index < 0 || index >= hist.length) return;
    const pt = hist[index];
    useScadaStore.getState().setIsLiveDvrMode(true);
    useScadaStore.getState().setDvrScrubIndex(index);
    useScadaStore.getState().setCurrentTimestamp(pt.timestamp);
    const updates: Record<string, NodeTelemetry> = {};
    for (const [nid, p] of Object.entries(pt.pressures)) {
      updates[nid] = {
        pressure: p,
        isLeak: pt.isLeak && (pt.activeFaultNode ? nid === pt.activeFaultNode : false),
        leakProbability: pt.isLeak ? 0.75 : 0
      };
    }
    useScadaStore.getState().bulkUpdateTelemetry(updates);
  }, []);

  const returnToLive = useCallback(() => {
    useScadaStore.getState().returnToLive();
    const hist = useScadaStore.getState().telemetryHistory;
    if (hist.length > 0) {
      const latest = hist[hist.length - 1];
      const updates: Record<string, NodeTelemetry> = {};
      for (const [nid, p] of Object.entries(latest.pressures)) {
        updates[nid] = {
          pressure: p,
          isLeak: latest.isLeak && (latest.activeFaultNode ? nid === latest.activeFaultNode : false),
          leakProbability: latest.isLeak ? 0.8 : 0
        };
      }
      useScadaStore.getState().bulkUpdateTelemetry(updates);
      useScadaStore.getState().setCurrentTimestamp(latest.timestamp);
    }
    sendSharedCommand({ action: 'play' });
  }, []);

  return {
    isConnected,
    sendPlay,
    sendPause,
    sendStep,
    sendSeek,
    sendSpeed,
    sendMode,
    sendReset,
    loadScenario,
    sendInjectFault,
    sendClearFault,
    scrubToDvrIndex,
    returnToLive,
  };
}
