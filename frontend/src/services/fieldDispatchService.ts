import { useScadaStore } from '../store/scadaStore';
import { triggerClearFault } from '../hooks/useScadaStream';
import { incidentService } from './incidentService';

export async function executeFieldRepair(incidentId: number, _nodeId?: string): Promise<boolean> {
  try {
    // 1. Physically clear the active fault in SCADA simulation (resets EPANET pressure & engine)
    triggerClearFault();

    // 2. Mark the incident resolved on backend
    await incidentService.resolveIncident(incidentId);

    // 3. Mark in store as repaired
    useScadaStore.getState().markDispatchRepaired(incidentId);
    useScadaStore.getState().triggerIncidentRefresh();

    // 4. Update incident counters
    try {
      const countData = await incidentService.fetchIncidents({ limit: 1 });
      useScadaStore.getState().setActiveIncidentCount(countData.active_count);
      useScadaStore.getState().setCriticalIncidentCount(countData.critical_count);
    } catch {
      // ignore count refresh error
    }

    return true;
  } catch (err) {
    console.error('[FIELD REPAIR] Error completing field repair:', err);
    return false;
  }
}
