import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  HardHat, 
  CheckCircle2, 
  MapPin, 
  ShieldAlert, 
  Wrench, 
  Square, 
  Printer, 
  X, 
  Radio, 
  Zap,
  Phone,
  User,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { useScadaStore } from '../../store/scadaStore';
import { incidentService, type IncidentItem, type WorkOrderData } from '../../services/incidentService';
import { executeFieldRepair } from '../../services/fieldDispatchService';

// Physical Net1 network isolation mapping
const NET1_ISOLATION_MAP: Record<string, { valves: string[]; pipes: string[]; zone: string; elevation: number }> = {
  '9':  { valves: ['V-PUMP9'], pipes: ['PUMP-9'], zone: 'Zone 1 - Main Pumping Station', elevation: 0.0 },
  '10': { valves: ['V-PUMP9', 'V-PIPE10'], pipes: ['PUMP-9', 'PIPE-10'], zone: 'Zone 1 - Pumping Transmission Main', elevation: 216.4 },
  '11': { valves: ['V-PIPE10', 'V-PIPE11', 'V-PIPE111'], pipes: ['PIPE-10', 'PIPE-11', 'PIPE-111'], zone: 'Zone 2 - Primary Distribution Trunk', elevation: 216.4 },
  '12': { valves: ['V-PIPE11', 'V-PIPE12', 'V-PIPE110', 'V-PIPE112'], pipes: ['PIPE-11', 'PIPE-12', 'PIPE-110', 'PIPE-112'], zone: 'Zone 2 - Central Network Hub', elevation: 213.4 },
  '13': { valves: ['V-PIPE12', 'V-PIPE113'], pipes: ['PIPE-12', 'PIPE-113'], zone: 'Zone 3 - East Sub-Grid Main', elevation: 211.8 },
  '2':  { valves: ['V-PIPE110'], pipes: ['PIPE-110'], zone: 'Zone 2 - Elevated Balancing Reservoir', elevation: 259.1 },
  '21': { valves: ['V-PIPE111', 'V-PIPE21', 'V-PIPE121'], pipes: ['PIPE-111', 'PIPE-21', 'PIPE-121'], zone: 'Zone 4 - South-West Feeder Grid', elevation: 213.4 },
  '22': { valves: ['V-PIPE112', 'V-PIPE21', 'V-PIPE22', 'V-PIPE122'], pipes: ['PIPE-112', 'PIPE-21', 'PIPE-22', 'PIPE-122'], zone: 'Zone 4 - South Central Sector', elevation: 211.8 },
  '23': { valves: ['V-PIPE113', 'V-PIPE22', 'V-PIPE23'], pipes: ['PIPE-113', 'PIPE-22', 'PIPE-23'], zone: 'Zone 4 - South-East Commercial District', elevation: 210.3 },
  '31': { valves: ['V-PIPE121', 'V-PIPE31'], pipes: ['PIPE-121', 'PIPE-31'], zone: 'Zone 5 - West Residential Sector', elevation: 213.4 },
  '32': { valves: ['V-PIPE122', 'V-PIPE31', 'V-PIPE32'], pipes: ['PIPE-122', 'PIPE-31', 'PIPE-32'], zone: 'Zone 5 - Central Residential Sector', elevation: 210.3 },
  '33': { valves: ['V-PIPE23', 'V-PIPE32'], pipes: ['PIPE-23', 'PIPE-32'], zone: 'Zone 5 - East Residential Terminal', elevation: 208.8 },
};

export const FieldDispatchModal: React.FC = () => {
  const isDispatchModalOpen = useScadaStore((state) => state.isDispatchModalOpen);
  const setIsDispatchModalOpen = useScadaStore((state) => state.setIsDispatchModalOpen);
  const dispatchIncidentTarget = useScadaStore((state) => state.dispatchIncidentTarget);
  const latestInference = useScadaStore((state) => state.latestInference);
  const activeFault = useScadaStore((state) => state.activeFault);
  const triggerIncidentRefresh = useScadaStore((state) => state.triggerIncidentRefresh);
  const setSelectedNodeId = useScadaStore((state) => state.setSelectedNodeId);
  const activeDispatches = useScadaStore((state) => state.activeDispatches);
  const addActiveDispatch = useScadaStore((state) => state.addActiveDispatch);

  // Form State
  const [teamName, setTeamName] = useState('Jal Shakti Rapid Response Unit 1');
  const [technicianName, setTechnicianName] = useState('Er. Rajesh Patil');
  const [contactNumber, setContactNumber] = useState('+91 98230 11223');
  const [priority, setPriority] = useState('P1 - Critical Emergency (ETA: 15-20 min)');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [autoRepairOnArrival, setAutoRepairOnArrival] = useState(true);
  
  // Interactive checklist states
  const [checkedValves, setCheckedValves] = useState<Record<string, boolean>>({});
  const [checkedEquipment, setCheckedEquipment] = useState<Record<string, boolean>>({});
  
  // Submission & Print State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispatchedResult, setDispatchedResult] = useState<any | null>(null);
  const [workOrderData, setWorkOrderData] = useState<WorkOrderData | null>(null);

  // Check if target is already dispatched or newly dispatched
  const isAlreadyDispatched = dispatchIncidentTarget?.status === 'Dispatched';
  const isLocked = Boolean(dispatchedResult || isAlreadyDispatched);

  // Derive target incident parameters
  const targetNodeId = String(
    dispatchIncidentTarget?.node_id || 
    (activeFault ? activeFault.node_id : null) || 
    (latestInference?.localization?.[0]?.node_id || '21')
  );

  const isolationData = NET1_ISOLATION_MAP[targetNodeId] || {
    valves: [`V-PIPE${targetNodeId}`],
    pipes: [`PIPE-${targetNodeId}`],
    zone: 'Zone Central DMA Distribution Grid',
    elevation: 212.0
  };

  const diameterMm = Number(
    dispatchIncidentTarget?.diameter_mm || 
    (activeFault ? activeFault.diameter_mm : null) || 
    (latestInference?.diameter_mm || 50.0)
  );

  const leakType = String(
    dispatchIncidentTarget?.leak_type || 
    (activeFault ? (activeFault.leak_type === 'abrupt' ? 'Abrupt Rupture' : 'Incipient Leak') : null) || 
    (latestInference?.dynamics || 'Abrupt Rupture')
  );

  const flowLph = Number(
    dispatchIncidentTarget?.water_loss_liters_per_hour || 
    (latestInference?.loss?.liters_per_hour || (diameterMm * diameterMm * 25))
  );

  const financialRatePerHour = Number(
    dispatchIncidentTarget?.financial_loss_inr_per_hour || 
    (latestInference?.loss?.financial_loss_inr_per_hour || (flowLph * 0.025))
  );

  const incidentCode = dispatchIncidentTarget?.incident_code || 'PENDING DISPATCH';
  const incidentId = dispatchIncidentTarget?.id;
  const targetIncidentId = dispatchedResult?.id || dispatchIncidentTarget?.id;
  const currentActiveDispatch = activeDispatches.find(
    (d) => d.incidentId === targetIncidentId || d.nodeId === targetNodeId
  );

  // Generate dynamic equipment recommendations based on diameter
  const defaultEquipment = React.useMemo(() => {
    const list = [
      'Digital Hydraulic Pressure Data-Logger',
      'Acoustic Leak Correlator & Ground Microphone',
      'Traffic Safety Cones & Perimeter Barricades'
    ];
    if (diameterMm >= 100) {
      list.unshift(`Heavy-Duty Full-Enclosure Split Collar Clamp (${Math.round(diameterMm * 1.1)}mm)`);
      list.push('High-Capacity Submersible Dewatering Trash Pump (10 HP)');
      list.push('Hydraulic Excavator & Trench Shoring Box');
      list.push('Replacement Ductile Iron Pipe Spool');
    } else if (diameterMm >= 30) {
      list.unshift(`Stainless Steel Repair Clamp (${Math.round(diameterMm * 1.15)}mm)`);
      list.push('Submersible Dewatering Pump (5.5 HP)');
      list.push('Pneumatic Pavement Breaker & Trench Shovel');
      list.push('Mechanical Pipe Coupling Set');
    } else {
      list.unshift(`Quick-Seal Band Clamp (${Math.max(15, Math.round(diameterMm * 1.2))}mm)`);
      list.push('Manual Trenching Tools & Dewatering Hand Siphon');
      list.push('Ultrasonic Pipe Wall Thickness Gauge');
    }
    return list;
  }, [diameterMm]);

  // Reset/Initialize state on open
  useEffect(() => {
    if (isDispatchModalOpen) {
      if (dispatchIncidentTarget?.status === 'Dispatched') {
        setDispatchedResult(dispatchIncidentTarget);
        if (dispatchIncidentTarget.dispatch_team) setTeamName(dispatchIncidentTarget.dispatch_team);
        if (dispatchIncidentTarget.technician_name) setTechnicianName(dispatchIncidentTarget.technician_name);
        if (dispatchIncidentTarget.contact_number) setContactNumber(dispatchIncidentTarget.contact_number);
        if (dispatchIncidentTarget.priority) setPriority(dispatchIncidentTarget.priority);
        if (dispatchIncidentTarget.notes) setDispatchNotes(dispatchIncidentTarget.notes);
        if (dispatchIncidentTarget.id) {
          incidentService.fetchWorkOrder(dispatchIncidentTarget.id)
            .then((wo) => setWorkOrderData(wo))
            .catch((err) => console.warn('Could not fetch work order preview:', err));
        }
      } else {
        setDispatchedResult(null);
        setWorkOrderData(null);
      }
      
      // Auto-check all isolation valves by default
      const valveInit: Record<string, boolean> = {};
      isolationData.valves.forEach((v) => { valveInit[v] = true; });
      setCheckedValves(valveInit);

      // Auto-check recommended equipment
      const equipInit: Record<string, boolean> = {};
      defaultEquipment.forEach((eq) => { equipInit[eq] = true; });
      setCheckedEquipment(equipInit);
    }
  }, [isDispatchModalOpen, dispatchIncidentTarget, isolationData.valves, defaultEquipment]);

  if (!isDispatchModalOpen) return null;

  const handleSpotlight = () => {
    setSelectedNodeId(targetNodeId);
    setIsDispatchModalOpen(false);
    const mainContainer = document.getElementById('scada-main-container');
    if (mainContainer) {
      mainContainer.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  const handleConfirmDispatch = async () => {
    setIsSubmitting(true);
    try {
      const activeValves = Object.keys(checkedValves).filter((k) => checkedValves[k]);
      const activeEquip = Object.keys(checkedEquipment).filter((k) => checkedEquipment[k]);

      let res: IncidentItem;

      if (incidentId) {
        // Dispatch existing latched incident
        res = await incidentService.dispatchIncident(incidentId, {
          team_name: teamName,
          technician_name: technicianName,
          contact_number: contactNumber,
          priority: priority.split(' ')[0],
          isolation_valves: activeValves,
          equipment_checklist: activeEquip,
          notes: dispatchNotes || undefined,
        });
      } else {
        // Direct 1-click dispatch from live HUD/Map
        res = await incidentService.dispatchDirectLeak({
          node_id: targetNodeId,
          leak_type: leakType,
          diameter_mm: diameterMm,
          water_loss_liters_per_hour: flowLph,
          financial_loss_inr_per_hour: financialRatePerHour,
          severity: diameterMm >= 50 ? 'Critical' : 'Warning',
          team_name: teamName,
          technician_name: technicianName,
          contact_number: contactNumber,
          priority: priority.split(' ')[0],
          isolation_valves: activeValves,
          equipment_checklist: activeEquip,
          notes: dispatchNotes || undefined,
        });
      }

      setDispatchedResult(res);
      triggerIncidentRefresh();

      // Register with active field dispatches for lifecycle progression
      const eta = priority.includes('P1') ? 30 : priority.includes('P2') ? 45 : 60;
      addActiveDispatch({
        incidentId: res.id,
        incidentCode: res.work_order_code || `WO-2026-${res.id}`,
        nodeId: targetNodeId,
        teamName: teamName,
        technicianName: technicianName,
        etaSeconds: eta,
        autoRepair: autoRepairOnArrival,
      });

      // Fetch complete printable work order
      try {
        const wo = await incidentService.fetchWorkOrder(res.id);
        setWorkOrderData(wo);
      } catch (err) {
        console.warn('Could not fetch work order preview:', err);
      }
    } catch (err: any) {
      alert(`Dispatch Error: ${err.message || 'Failed to dispatch crew'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImmediateRepair = async () => {
    if (!targetIncidentId) return;
    setIsSubmitting(true);
    try {
      await executeFieldRepair(targetIncidentId, targetNodeId);
      triggerIncidentRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={() => !isSubmitting && setIsDispatchModalOpen(false)}
      />

      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-4xl bg-scada-panel border border-scada-border/90 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]">
        
        {/* Top Gradient Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-scada-panel to-slate-900 border-b border-scada-border/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Truck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                  1-Click Jal Shakti Field Crew Dispatch
                </h3>
                {isLocked ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center space-x-1">
                    <Lock className="w-3 h-3 mr-1" />
                    <span>WORK ORDER COMMITTED & LOCKED</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                    EMERGENCY WORK ORDER
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Ministry of Jal Shakti • Urban Water Mission • Physical NRW Containment Protocol
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDispatchModalOpen(false)}
            className="p-2 rounded-lg bg-scada-bg hover:bg-slate-800 text-slate-400 hover:text-white border border-scada-border transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Success Banner if already dispatched or locked */}
          {isLocked && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-in fade-in zoom-in-95 duration-200 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
                      <span>Work Order Dispatched & Locked</span>
                      <span className="text-xs font-normal text-slate-400 font-mono">• {targetNodeId ? `Junction ${targetNodeId}` : ''}</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Work Order <span className="font-mono font-bold text-emerald-300">{workOrderData?.work_order_code || (dispatchedResult && dispatchedResult.work_order_code) || `WO-2026-${targetIncidentId || '0001'}`}</span> has been transmitted to <span className="font-semibold text-slate-100">{workOrderData?.field_crew?.team_name || (dispatchedResult && dispatchedResult.dispatch_team) || teamName}</span>.
                    </p>
                    {workOrderData?.isolation_protocol?.procedure_summary && (
                      <p className="text-xs text-emerald-400/90 mt-1 flex items-center space-x-1.5">
                        <span className="font-bold">Protocol:</span>
                        <span>{workOrderData.isolation_protocol.procedure_summary}</span>
                        <span className="text-slate-400">({workOrderData.isolation_protocol.estimated_affected_connections} affected connections)</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {currentActiveDispatch && (
                    <>
                      {currentActiveDispatch.phase === 'en_route' && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center space-x-1.5 animate-pulse">
                          <Truck className="w-3.5 h-3.5" />
                          <span>Crew En Route ({currentActiveDispatch.remainingSeconds}s)</span>
                        </span>
                      )}
                      {currentActiveDispatch.phase === 'on_site' && (
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center space-x-1.5 animate-pulse">
                          <Wrench className="w-3.5 h-3.5" />
                          <span>On-Site Clamping ({currentActiveDispatch.remainingSeconds}s)</span>
                        </span>
                      )}
                      {currentActiveDispatch.phase === 'repaired' && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Physical Repair Complete</span>
                        </span>
                      )}
                    </>
                  )}
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Work Order</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Geo-Spatial & Incident Intelligence Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Geo-Location Card */}
            <div className="p-4 rounded-xl bg-scada-bg/70 border border-scada-border/70 space-y-3">
              <div className="flex items-center justify-between border-b border-scada-border/40 pb-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-scada-accent" />
                  <span>Target Geocoding & Network Hub</span>
                </div>
                <button
                  onClick={handleSpotlight}
                  className="text-xs text-scada-accent hover:underline flex items-center space-x-1 font-mono"
                  title="Spotlight on Digital Twin Map"
                >
                  <span>Locate Node</span>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-400">Localized Node:</span>
                  <span className="font-mono font-bold text-slate-100 text-sm">
                    Junction {targetNodeId}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-400">Distribution DMA:</span>
                  <span className="font-semibold text-slate-200">
                    {isolationData.zone}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-400">Ground Elevation:</span>
                  <span className="font-mono text-slate-300">
                    {isolationData.elevation} m MSL
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-400">Incident Code:</span>
                  <span className="font-mono font-bold text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                    {incidentCode}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Hydraulic Telemetry Card */}
            <div className="p-4 rounded-xl bg-scada-bg/70 border border-scada-border/70 space-y-3">
              <div className="flex items-center justify-between border-b border-scada-border/40 pb-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Hydraulic Efflux Audit</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                  {diameterMm >= 50 ? 'CRITICAL MAINLINE BURST' : 'MEDIUM PIPE SPLIT'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-scada-panel/60 border border-scada-border/40">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Orifice Size</span>
                  <span className="text-lg font-mono font-bold text-slate-100">{diameterMm.toFixed(1)} mm</span>
                  <span className="text-[10px] text-slate-500 block">{leakType}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-scada-panel/60 border border-scada-border/40">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Efflux Rate</span>
                  <span className="text-lg font-mono font-bold text-red-400">
                    {Math.round(flowLph).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {(flowLph / 1000.0).toFixed(1)} m³/hr
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-scada-panel/60 border border-scada-border/40 col-span-2 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Compounding Financial Loss Rate</span>
                    <span className="text-sm font-mono font-bold text-amber-300">
                      ₹{Math.round(financialRatePerHour).toLocaleString('en-IN')}/hr
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">₹25/m³ Jal Shakti Tariff</span>
                </div>
              </div>
            </div>

          </div>

          {/* Section 2: Pipe Isolation Protocol & Valve Shutoff Boundary */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-scada-border/80 space-y-3">
            <div className="flex items-center justify-between border-b border-scada-border/40 pb-2">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <span>Hydraulic Isolation Protocol & Upstream/Downstream Valves</span>
                  {isLocked && (
                    <span className="text-[10px] text-amber-400 font-mono flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>(Locked)</span>
                    </span>
                  )}
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Isolation Boundary: {isolationData.valves.length} Valves Required
              </span>
            </div>

            <p className="text-xs text-slate-300">
              To halt active pressurized efflux at <span className="font-semibold text-slate-100">Junction {targetNodeId}</span>, the field team must isolate the following control valves prior to clamp installation:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {isolationData.valves.map((valveId) => {
                const isChecked = checkedValves[valveId] ?? true;
                return (
                  <div
                    key={valveId}
                    onClick={() => !isLocked && setCheckedValves((prev) => ({ ...prev, [valveId]: !isChecked }))}
                    className={`p-3 rounded-lg border transition-all flex items-center justify-between ${
                      isLocked ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      isChecked 
                        ? 'bg-amber-950/30 border-amber-500/50 text-slate-100 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                        : 'bg-scada-bg/50 border-scada-border/60 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-md ${isChecked ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Radio className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-xs block">{valveId}</span>
                        <span className="text-[10px] text-slate-400">Control Valve</span>
                      </div>
                    </div>
                    {isChecked ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 bg-scada-bg/50 p-2.5 rounded-lg border border-scada-border/40 flex items-center justify-between">
              <span>⚠️ Estimated Affected Zone: <span className="text-slate-200 font-semibold">{isolationData.zone}</span> (~1,140 Domestic Meters)</span>
              <span className="text-emerald-400 font-medium">Bypass lines remain active</span>
            </div>
          </div>

          {/* Section 3: Smart Equipment & Material Checklist */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-scada-border/80 space-y-3">
            <div className="flex items-center justify-between border-b border-scada-border/40 pb-2">
              <div className="flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <span>Required Crew Equipment Checklist (Auto-Sized for Ø {diameterMm.toFixed(0)} mm)</span>
                  {isLocked && (
                    <span className="text-[10px] text-cyan-400 font-mono flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>(Locked)</span>
                    </span>
                  )}
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {Object.values(checkedEquipment).filter(Boolean).length} of {defaultEquipment.length} Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {defaultEquipment.map((item, idx) => {
                const isChecked = checkedEquipment[item] ?? true;
                return (
                  <label
                    key={idx}
                    className={`flex items-center space-x-2.5 p-2 rounded-lg border text-xs transition-colors ${
                      isLocked ? 'cursor-default opacity-85' : 'cursor-pointer'
                    } ${
                      isChecked 
                        ? 'bg-cyan-950/20 border-cyan-500/30 text-slate-200' 
                        : 'bg-scada-bg/40 border-scada-border/40 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLocked}
                      onChange={(e) => !isLocked && setCheckedEquipment((prev) => ({ ...prev, [item]: e.target.checked }))}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20 bg-slate-800 disabled:opacity-80"
                    />
                    <span className="select-none font-medium">{item}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 4: Rapid Response Crew Assignment & Work Order Details */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-scada-border/80 space-y-4">
            <div className="flex items-center justify-between border-b border-scada-border/40 pb-2">
              <div className="flex items-center space-x-2">
                <HardHat className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <span>Field Response Crew Assignment & Priority</span>
                  {isLocked && (
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>(Locked)</span>
                    </span>
                  )}
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 inline" />
                <span>Authorized Dispatch</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* Crew Selection */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Assigned Rapid Response Unit</label>
                <select
                  disabled={isLocked}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-scada-bg border border-scada-border rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-scada-accent disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-900/60 disabled:border-slate-700/60"
                >
                  <option value="Jal Shakti Rapid Response Unit 1">Jal Shakti Rapid Response Unit 1 (Zone Central)</option>
                  <option value="Jal Shakti Rapid Response Unit 2">Jal Shakti Rapid Response Unit 2 (North Sector)</option>
                  <option value="Emergency Line Maintenance Team 4">Emergency Line Maintenance Team 4 (Heavy Ruptures)</option>
                  <option value="Contractor Quick-Repair Unit (L&T Infra)">Contractor Quick-Repair Unit (L&T Infra)</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Dispatch Priority Level</label>
                <select
                  disabled={isLocked}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-scada-bg border border-scada-border rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-scada-accent font-semibold disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-900/60 disabled:border-slate-700/60"
                >
                  <option value="P1 - Critical Emergency (ETA: 15-20 min)">P1 - Critical Emergency (ETA: 15-20 min)</option>
                  <option value="P2 - High Priority Split (ETA: 45 min)">P2 - High Priority Split (ETA: 45 min)</option>
                  <option value="P3 - Standard Scheduled Repair (ETA: 2 hr)">P3 - Standard Scheduled Repair (ETA: 2 hr)</option>
                </select>
              </div>

              {/* Lead Technician */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 flex items-center space-x-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Lead Technician</span>
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full bg-scada-bg border border-scada-border rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-scada-accent disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-900/60 disabled:border-slate-700/60"
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 flex items-center space-x-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>Direct Emergency Contact</span>
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full bg-scada-bg border border-scada-border rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-scada-accent disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-900/60 disabled:border-slate-700/60"
                />
              </div>

              {/* Dispatch Notes / Advisory */}
              <div className="sm:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Hazard Advisory / Special Field Instructions</label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="e.g., Traffic diversion required on Main Sector Road; soil liquefaction risk around Junction 21..."
                  className="w-full bg-scada-bg border border-scada-border rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-scada-accent resize-none disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-900/60 disabled:border-slate-700/60"
                />
              </div>

              {/* Auto-Repair Toggle */}
              <div className="sm:col-span-2 pt-2 border-t border-scada-border/40 flex items-center justify-between">
                <label className={`flex items-center space-x-2 text-xs select-none ${isLocked ? 'cursor-default opacity-85' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={autoRepairOnArrival}
                    onChange={(e) => !isLocked && setAutoRepairOnArrival(e.target.checked)}
                    disabled={isLocked}
                    className="w-4 h-4 rounded text-cyan-500 bg-scada-bg border-scada-border focus:ring-cyan-500 disabled:opacity-80"
                  />
                  <span className="font-semibold text-slate-200">⚡ Auto-execute physical repair upon crew arrival</span>
                  <span className="text-[11px] text-slate-400 font-mono">(~30-60s simulation ETA)</span>
                </label>
              </div>

            </div>
          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="p-5 border-t border-scada-border/80 bg-scada-bg/80 flex items-center justify-between shrink-0">
          <button
            disabled={isSubmitting}
            onClick={() => setIsDispatchModalOpen(false)}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            {isLocked ? 'Close Window' : 'Cancel'}
          </button>

          <div className="flex items-center space-x-3">
            {isLocked ? (
              <>
                {currentActiveDispatch && currentActiveDispatch.phase !== 'repaired' && (
                  <button
                    disabled={isSubmitting}
                    onClick={handleImmediateRepair}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>🛠️ Complete Field Repair Now</span>
                  </button>
                )}

                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Official Work Order</span>
                </button>
              </>
            ) : (
              <button
                disabled={isSubmitting}
                onClick={handleConfirmDispatch}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center space-x-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50"
              >
                <Truck className={`w-4 h-4 ${isSubmitting ? 'animate-bounce' : ''}`} />
                <span>{isSubmitting ? 'Dispatching Work Order...' : 'Confirm & Dispatch Field Crew 🚀'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
