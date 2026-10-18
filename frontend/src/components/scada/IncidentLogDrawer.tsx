import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Search, 
  ShieldAlert, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  CheckCircle2, 
  RotateCcw, 
  MapPin, 
  Eye, 
  Check, 
  Trash2,
  Clock,
  IndianRupee,
  Truck,
  HardHat,
  Wrench,
  FileText
} from 'lucide-react';
import { useScadaStore } from '../../store/scadaStore';
import { incidentService, type IncidentItem } from '../../services/incidentService';
import { executeFieldRepair } from '../../services/fieldDispatchService';

export function IncidentLogDrawer() {
  const isIncidentDrawerOpen = useScadaStore((state) => state.isIncidentDrawerOpen);
  const setIsIncidentDrawerOpen = useScadaStore((state) => state.setIsIncidentDrawerOpen);
  const incidentRefreshTrigger = useScadaStore((state) => state.incidentRefreshTrigger);
  const setSelectedNodeId = useScadaStore((state) => state.setSelectedNodeId);
  const setActiveIncidentCount = useScadaStore((state) => state.setActiveIncidentCount);
  const setCriticalIncidentCount = useScadaStore((state) => state.setCriticalIncidentCount);
  const activeFault = useScadaStore((state) => state.activeFault);
  const latestInference = useScadaStore((state) => state.latestInference);
  const nodeData = useScadaStore((state) => state.nodeData);
  const openDispatchModal = useScadaStore((state) => state.openDispatchModal);
  const openAuditModal = useScadaStore((state) => state.openAuditModal);
  const activeDispatches = useScadaStore((state) => state.activeDispatches);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'Acknowledged' | 'Resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'Critical' | 'Warning' | 'Info'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'live_telemetry' | 'benchmark_scenario'>('all');
  
  // Data State
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, critical: 0, resolved: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null);

  const loadIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await incidentService.fetchIncidents({
        status: statusTab,
        severity: severityFilter,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        limit: 100,
      });
      setIncidents(data.incidents || []);
      setStats({
        total: data.total_count,
        active: data.active_count,
        critical: data.critical_count,
        resolved: data.resolved_count,
      });
      setActiveIncidentCount(data.active_count);
      setCriticalIncidentCount(data.critical_count);
    } catch (err) {
      console.error('[INCIDENTS] Error loading incidents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusTab, severityFilter, sourceFilter, setActiveIncidentCount, setCriticalIncidentCount]);

  // Initial load, trigger/tab change, and periodic sync while drawer is open
  useEffect(() => {
    if (!isIncidentDrawerOpen) return;
    loadIncidents();
    const interval = setInterval(() => {
      loadIncidents();
    }, 2000);
    return () => clearInterval(interval);
  }, [isIncidentDrawerOpen, incidentRefreshTrigger, loadIncidents]);

  // Filter by search query (client-side for instant snappy response)
  const filteredIncidents = incidents.filter((inc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.incident_code.toLowerCase().includes(q) ||
      inc.node_id.toLowerCase().includes(q) ||
      inc.leak_type.toLowerCase().includes(q) ||
      (inc.notes && inc.notes.toLowerCase().includes(q))
    );
  });

  const handleAcknowledge = async (id: number) => {
    setActionInProgressId(id);
    try {
      const updated = await incidentService.acknowledgeIncident(id);
      setIncidents((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setStats((prev) => ({
        ...prev,
        active: prev.active > 0 ? prev.active : 0,
      }));
    } catch (err) {
      console.error('[INCIDENTS] Acknowledge error:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleResolve = async (id: number, nodeId: string) => {
    // Flaw 1 Guard: Verify hydraulic pressure normalization before allowing resolution
    const isActivelyLeaking = 
      (activeFault !== null && String(activeFault.node_id) === String(nodeId)) ||
      (latestInference?.status === 'LEAK_DETECTED' && latestInference.localization?.[0]?.node_id === String(nodeId)) ||
      (nodeData[nodeId]?.isLeak === true);

    if (isActivelyLeaking) {
      alert(`⚠️ Hydraulic Pressure Deficit Active at Junction ${nodeId}\n\nSCADA safety protocol prevents resolving an incident while pipe efflux is active.\nPlease clear the fault injection in the Fault Lab or isolate the valve before resolving.`);
      return;
    }

    setActionInProgressId(id);
    try {
      const updated = await incidentService.resolveIncident(id);
      setIncidents((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setStats((prev) => ({
        ...prev,
        active: Math.max(0, prev.active - 1),
        resolved: prev.resolved + 1,
      }));
    } catch (err) {
      console.error('[INCIDENTS] Resolve error:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleSpotlight = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const mainContainer = document.getElementById('scada-main-container');
    if (mainContainer) {
      mainContainer.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  const handleClearDemoAlarms = async () => {
    if (!window.confirm('Are you sure you want to clear all demo alarm records?')) return;
    try {
      await incidentService.clearAllIncidents();
      await loadIncidents();
    } catch (err) {
      console.error('[INCIDENTS] Clear error:', err);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const diffMs = Date.now() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return d.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  if (!isIncidentDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={() => setIsIncidentDrawerOpen(false)}
      />

      {/* Drawer Panel */}
      <div className="relative w-full sm:w-[580px] md:w-[680px] bg-scada-panel/95 backdrop-blur-xl border-l border-scada-border/80 shadow-2xl h-full flex flex-col z-10 transition-transform duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-scada-border/60 bg-scada-bg/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.25)]">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-100 tracking-tight">SCADA Alarm Center</h3>
                {stats.active > 0 ? (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                    {stats.active} Active
                  </span>
                ) : (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    All Nominal
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Chronological AI Leak Alarms & Jal Shakti Operations Log</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadIncidents}
              title="Refresh Alarms"
              className="p-2 rounded-lg bg-scada-bg hover:bg-slate-800 text-slate-400 hover:text-white border border-scada-border transition-all"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-scada-accent' : ''}`} />
            </button>
            <button 
              onClick={() => setIsIncidentDrawerOpen(false)}
              className="p-2 rounded-lg bg-scada-bg hover:bg-slate-800 text-slate-400 hover:text-white border border-scada-border transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Operational Stats Bar */}
        <div className="grid grid-cols-4 gap-2 px-5 py-3 border-b border-scada-border/40 bg-slate-900/40 text-xs">
          <div className="bg-scada-bg/70 border border-scada-border/60 rounded-lg p-2 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Logged</span>
            <span className="text-base font-bold text-slate-200 font-mono">{stats.total}</span>
          </div>
          <div className="bg-scada-bg/70 border border-red-500/20 rounded-lg p-2 text-center">
            <span className="text-[10px] uppercase font-semibold text-red-400 block">Active Alerts</span>
            <span className="text-base font-bold text-red-400 font-mono">{stats.active}</span>
          </div>
          <div className="bg-scada-bg/70 border border-amber-500/20 rounded-lg p-2 text-center">
            <span className="text-[10px] uppercase font-semibold text-amber-400 block">Critical</span>
            <span className="text-base font-bold text-amber-400 font-mono">{stats.critical}</span>
          </div>
          <div className="bg-scada-bg/70 border border-emerald-500/20 rounded-lg p-2 text-center">
            <span className="text-[10px] uppercase font-semibold text-emerald-400 block">Resolved</span>
            <span className="text-base font-bold text-emerald-400 font-mono">{stats.resolved}</span>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="p-4 border-b border-scada-border/40 bg-scada-panel/40 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Status Tabs */}
            <div className="flex bg-scada-bg rounded-lg p-1 border border-scada-border text-xs font-medium">
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active / New' },
                { id: 'Acknowledged', label: 'Acknowledged' },
                { id: 'Resolved', label: 'Resolved' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusTab(tab.id as any)}
                  className={`px-3 py-1 rounded-md transition-all ${
                    statusTab === tab.id
                      ? 'bg-scada-accent text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              {/* Source Origin Filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="bg-scada-bg border border-scada-border text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-scada-accent font-mono"
              >
                <option value="all">All Sources</option>
                <option value="live_telemetry">Live SCADA</option>
                <option value="benchmark_scenario">Historical Benchmarks</option>
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="bg-scada-bg border border-scada-border text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-scada-accent font-mono"
              >
                <option value="all">All Severities</option>
                <option value="Critical">Critical (≥50mm)</option>
                <option value="Warning">Warning (15-50mm)</option>
                <option value="Info">Info (&lt;15mm)</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by Incident Code (e.g. INC-2026-0001) or Node ID..."
              className="w-full bg-scada-bg/90 border border-scada-border rounded-lg pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-scada-accent focus:ring-1 focus:ring-scada-accent font-medium font-mono"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Incident List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {isLoading && incidents.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-scada-bg/60 border border-scada-border animate-pulse p-4" />
              ))}
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-scada-border/60 rounded-xl bg-scada-bg/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-80" />
              <h4 className="text-sm font-bold text-slate-200 mb-1">No Incidents in This View</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                No leak incidents match the current filters. All nodes in Net1 are currently operating within nominal baseline parameters.
              </p>
              {(searchQuery || statusTab !== 'all' || severityFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusTab('all');
                    setSeverityFilter('all');
                  }}
                  className="text-xs text-scada-accent hover:underline flex items-center justify-center space-x-1 mx-auto"
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Clear Filter Criteria
                </button>
              )}
            </div>
          ) : (
            filteredIncidents.map((incident) => {
              const isCritical = incident.severity === 'Critical';
              const isWarning = incident.severity === 'Warning';
              const isNew = incident.status === 'New';
              const isAcknowledged = incident.status === 'Acknowledged';
              const isDispatched = incident.status === 'Dispatched';
              const isResolved = incident.status === 'Resolved';

              // Flaw 1 Guard: Verify if this specific node is under an active pressure deficit or injected fault
              const isNodeActivelyLeaking = 
                (activeFault !== null && String(activeFault.node_id) === String(incident.node_id)) ||
                (latestInference?.status === 'LEAK_DETECTED' && latestInference.localization?.[0]?.node_id === String(incident.node_id)) ||
                (nodeData[incident.node_id]?.isLeak === true);

              return (
                <div
                  key={incident.id}
                  className={`relative p-4 rounded-xl border transition-all duration-200 ${
                    isNew 
                      ? 'bg-red-950/20 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30'
                      : isAcknowledged
                      ? 'bg-blue-950/15 border-blue-500/30'
                      : isDispatched
                      ? 'bg-amber-950/15 border-amber-500/30'
                      : 'bg-scada-bg/50 border-scada-border/70 opacity-90'
                  }`}
                >
                  {/* Top Bar: Code, Severity, Status, Source Tag, Timestamp */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-100 bg-scada-panel px-2 py-0.5 rounded border border-scada-border">
                        {incident.incident_code}
                      </span>

                      {/* Source Origin Tag */}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${
                        incident.source === 'benchmark_scenario'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}>
                        {incident.source === 'benchmark_scenario' ? 'Benchmark' : 'Live SCADA'}
                      </span>

                      {/* Severity Badge */}
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isCritical 
                          ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                          : isWarning
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      }`}>
                        {isCritical && <AlertOctagon className="w-3 h-3 mr-1 text-red-400" />}
                        {isWarning && <AlertTriangle className="w-3 h-3 mr-1 text-amber-400" />}
                        {!isCritical && !isWarning && <Info className="w-3 h-3 mr-1 text-blue-400" />}
                        {incident.severity}
                      </span>

                      {/* Status Tag */}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        isNew
                          ? 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse'
                          : isAcknowledged
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : isDispatched
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}>
                        {incident.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(incident.timestamp)}</span>
                    </div>
                  </div>

                  {/* Node & Characteristics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 px-3 bg-scada-panel/60 rounded-lg border border-scada-border/40 text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Location</span>
                      <button
                        onClick={() => handleSpotlight(incident.node_id)}
                        className="font-bold text-scada-accent hover:underline flex items-center space-x-1"
                        title="Spotlight on Digital Twin Map"
                      >
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>Junction {incident.node_id}</span>
                      </button>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Dynamics</span>
                      <span className="font-semibold text-slate-200">{incident.leak_type}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Orifice Size</span>
                      <span className="font-mono font-bold text-slate-100">{incident.diameter_mm} mm</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Efflux Rate</span>
                      <span className="font-mono font-bold text-red-400">
                        {incident.water_loss_liters_per_hour.toLocaleString()} L/h
                      </span>
                    </div>
                  </div>

                  {/* Financial & Loss Accounting Strip */}
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1 font-mono">
                    <div className="flex items-center space-x-1 text-slate-300">
                      <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
                      <span>Rate: ₹{incident.financial_loss_inr_per_hour.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/hr</span>
                    </div>
                    {incident.total_volume_lost_m3 > 0 && (
                      <div className={`flex items-center space-x-3 ${isResolved ? 'text-emerald-400' : 'text-amber-300/90'}`}>
                        <span>{isResolved ? 'Total Volume' : 'Acc. Vol'}: {incident.total_volume_lost_m3.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m³</span>
                        <span>{isResolved ? 'Total Cost' : 'Acc. Cost'}: ₹{Math.round(incident.total_cost_inr).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t border-scada-border/40">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleSpotlight(incident.node_id)}
                        className="text-xs text-slate-400 hover:text-scada-accent flex items-center space-x-1 font-medium transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Focus on Map</span>
                      </button>

                      <button
                        onClick={() => openAuditModal(incident.id)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-medium transition-colors"
                        title="View Official Jal Shakti Water Balance & Audit Certificate"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Audit Certificate</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isNew && (
                        <button
                          disabled={actionInProgressId === incident.id}
                          onClick={() => handleAcknowledge(incident.id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(59,130,246,0.3)] disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Acknowledge</span>
                        </button>
                      )}

                      {!isResolved && (
                        isDispatched ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openDispatchModal(incident)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs flex items-center space-x-1.5 transition-all"
                              title="View official work order and isolation boundary"
                            >
                              <HardHat className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                {activeDispatches.find(d => d.incidentId === incident.id)?.phase === 'en_route'
                                  ? `En Route (${activeDispatches.find(d => d.incidentId === incident.id)?.remainingSeconds}s)`
                                  : activeDispatches.find(d => d.incidentId === incident.id)?.phase === 'on_site'
                                  ? `Clamping (${activeDispatches.find(d => d.incidentId === incident.id)?.remainingSeconds}s)`
                                  : incident.dispatch_team || 'Crew Dispatched'}
                              </span>
                            </button>

                            <button
                              disabled={actionInProgressId === incident.id}
                              onClick={async () => {
                                setActionInProgressId(incident.id);
                                try {
                                  await executeFieldRepair(incident.id, incident.node_id);
                                  await loadIncidents();
                                } finally {
                                  setActionInProgressId(null);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:opacity-50"
                              title="Simulate completed field repair and restore hydraulic baseline"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Complete Repair</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openDispatchModal(incident)}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                            title="Open Jal Shakti 1-Click Field Crew Work Order & Dispatch Modal"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Dispatch Crew</span>
                          </button>
                        )
                      )}

                      {!isResolved && !isDispatched && (
                        isNodeActivelyLeaking ? (
                          <div 
                            className="flex items-center space-x-1" 
                            title={`Cannot resolve: Active leak/pressure deficit detected at Junction ${incident.node_id}. Please dispatch crew or normalize pressure before resolving.`}
                          >
                            <button
                              disabled={true}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center space-x-1.5 cursor-not-allowed opacity-90 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                              <span>Leak Active • Dispatch Crew</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={actionInProgressId === incident.id}
                            onClick={() => handleResolve(incident.id, incident.node_id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Resolved</span>
                          </button>
                        )
                      )}

                      {isResolved && (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Incident Closed</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-scada-border/60 bg-scada-bg/60 flex items-center justify-between shrink-0 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Jal Shakti SCADA Historian • Auto-Latch Active</span>
          </div>

          <button
            onClick={handleClearDemoAlarms}
            className="text-xs text-red-400/80 hover:text-red-300 hover:underline flex items-center space-x-1 transition-all"
            title="Clear all demo/test incident entries"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Demo Alarms</span>
          </button>
        </div>

      </div>
    </div>
  );
}
