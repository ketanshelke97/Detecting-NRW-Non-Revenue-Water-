import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useScadaStore } from '../../store/scadaStore';
import { 
  AlertOctagon, 
  CheckCircle, 
  Zap, 
  TrendingDown, 
  Gauge, 
  Crosshair, 
  ShieldCheck,
  Radio,
  Truck,
  HardHat,
  Wrench
} from 'lucide-react';
import { executeFieldRepair } from '../../services/fieldDispatchService';

export const AiDiagnosticPanel: React.FC = () => {
  const latestInference = useScadaStore((state) => state.latestInference);
  const selectedNodeId = useScadaStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useScadaStore((state) => state.setSelectedNodeId);
  const activeFault = useScadaStore((state) => state.activeFault);
  const openDispatchModal = useScadaStore((state) => state.openDispatchModal);
  const activeDispatches = useScadaStore((state) => state.activeDispatches);

  const isLeak = latestInference?.status === 'LEAK_DETECTED';
  const localization = isLeak ? (latestInference?.localization || []) : [];
  const topCandidate = localization[0];
  
  // Real-time confidence: uses dynamic physical noise margin from backend (breathes with 1 decimal point precision)
  const confidencePct = latestInference?.confidence !== undefined
    ? Number(latestInference.confidence).toFixed(1)
    : (isLeak 
        ? (topCandidate ? (topCandidate.probability * 100).toFixed(1) : '95.0') 
        : '98.5');

  // Calibrated diameter in mm
  const diameterMm = isLeak ? (latestInference?.diameter_mm || 0) : 0;
  
  // Dynamics classification
  const dynamics = latestInference?.dynamics || (isLeak ? 'Abrupt Rupture' : 'Nominal Flow');
  const isAbrupt = dynamics.toLowerCase().includes('abrupt');

  // Orifice classification
  const getOrificeClassification = (dMm: number) => {
    if (!isLeak || dMm < 1) return { label: 'Intact Pipe Conduit', level: 'nominal' };
    if (dMm < 15) return { label: 'Micro / Pin-Hole Puncture (<15mm)', level: 'minor' };
    if (dMm <= 50) return { label: 'Medium Split / Joint Slip (15-50mm)', level: 'moderate' };
    return { label: 'Major Mainline Rupture (>50mm)', level: 'critical' };
  };

  const orificeInfo = getOrificeClassification(diameterMm);

  return (
    <Card className="border-scada-border/80 bg-scada-panel/80 backdrop-blur-md shadow-2xl flex flex-col justify-between">
      {/* HUD Header */}
      <CardHeader className="py-3 px-4 border-b border-scada-border/60 bg-scada-panel/90 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-md ${
            isLeak 
              ? 'bg-red-500/20 text-red-400 animate-pulse ring-1 ring-red-500/40' 
              : 'bg-cyan-500/20 text-cyan-400'
          }`}>
            {isLeak ? <AlertOctagon className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
          </div>
          <div>
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-slate-200">
              AI Diagnostic HUD
            </CardTitle>
            <p className="text-[10px] text-slate-400">Random Forest Ensemble & Bayesian Spatial Localization</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeFault && (
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Lab Context: N{activeFault.node_id} ({activeFault.diameter_mm}mm)
            </span>
          )}
          <Badge variant={isLeak ? 'danger' : 'success'}>
            {isLeak ? 'CRITICAL LEAK' : 'NOMINAL'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Anomaly Status Banner */}
        <div className={`p-3.5 rounded-lg border transition-all duration-300 relative overflow-hidden ${
          isLeak 
            ? 'bg-gradient-to-r from-red-950/70 via-rose-950/40 to-slate-900/80 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]' 
            : 'bg-gradient-to-r from-emerald-950/50 via-cyan-950/30 to-slate-900/80 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div className={`p-2 rounded-lg ${
                isLeak ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {isLeak ? (
                  <AlertOctagon className="w-5 h-5 animate-bounce" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className={`text-sm font-bold tracking-tight uppercase ${
                    isLeak ? 'text-red-300' : 'text-emerald-300'
                  }`}>
                    {isLeak ? 'CRITICAL LEAK DETECTED' : 'SYSTEM NOMINAL • ALL NODES STABLE'}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isLeak && topCandidate
                    ? `Spatial Bayesian fusion isolates rupture epicenter at Junction ${topCandidate.node_id}`
                    : '11 DMA pressure sensors reporting within expected diurnal tolerances'}
                </p>
              </div>
            </div>

            {/* Confidence Meter Badge */}
            <div className="flex items-center space-x-2 sm:self-center bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Confidence</span>
              <span className={`text-base font-extrabold font-mono ${
                isLeak ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {confidencePct}%
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Diagnostic Breakdown: Top-3 Localization + Dynamics & Orifice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Column A: Top-3 Localization Ranking */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>Localized Candidates (Top-3)</span>
              </span>
              <span className="text-[9px] text-slate-500 font-mono">Prob. Weight</span>
            </div>

            <div className="space-y-2.5">
              {isLeak && localization.length > 0 ? (
                <>
                  {localization.slice(0, 3).map((item, idx) => {
                    const probPct = (item.probability * 100).toFixed(1);
                    const isTopRanked = idx === 0;
                    const isSelected = selectedNodeId === item.node_id;

                    return (
                      <div 
                        key={item.node_id}
                        onClick={() => setSelectedNodeId(item.node_id)}
                        className={`p-2 rounded cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-cyan-500/15 border border-cyan-500/50' 
                            : 'bg-slate-800/40 hover:bg-slate-800/80 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isTopRanked 
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40' 
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className={`font-mono font-bold ${
                              isTopRanked ? 'text-red-300' : 'text-slate-200'
                            }`}>
                              Junction {item.node_id}
                            </span>
                            {isTopRanked && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-semibold uppercase">
                                Primary Epicenter
                              </span>
                            )}
                          </div>
                          <span className={`font-mono font-bold ${
                            isTopRanked ? 'text-red-400' : 'text-slate-400'
                          }`}>
                            {probPct}%
                          </span>
                        </div>

                        {/* Probability Bar */}
                        <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isTopRanked
                                ? 'bg-gradient-to-r from-red-500 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                                : 'bg-cyan-500/60'
                            }`}
                            style={{ width: `${Math.max(4, parseFloat(probPct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[9px] text-slate-500 mt-2">
                    Tip: Click candidate node to spotlight pressure in the Digital Twin graph.
                  </p>
                </>
              ) : (
                <div className="py-6 px-3 rounded-lg bg-slate-900/40 border border-slate-800/70 flex flex-col items-center justify-center text-center">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">DMA Network Balanced</span>
                  <p className="text-[10px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                    All 11 distribution junctions operating within expected hydraulic tolerances (drop &lt; 0.20 mH₂O). Spatial localization engine on standby.
                  </p>
                  <div className="flex items-center space-x-2 mt-3 text-[9px] font-mono text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Diurnal Profile Steady • 0 Active Anomalies</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column B: Leak Dynamics & Pipe Orifice Calibrated Gauge */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between space-y-3">
            
            {/* Dynamics Classification */}
            <div>
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Leak Dynamics Class</span>
                </span>
                <span className="text-[9px] text-slate-500 font-mono">dP/dt Sensor Slope</span>
              </div>

              <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded ${
                    isLeak 
                      ? isAbrupt 
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {isLeak ? (
                      isAbrupt ? <Zap className="w-4 h-4 text-rose-400" /> : <TrendingDown className="w-4 h-4 text-amber-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <span className={`text-xs font-bold block ${
                      isLeak ? (isAbrupt ? 'text-rose-300' : 'text-amber-300') : 'text-slate-200'
                    }`}>
                      {dynamics}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isLeak 
                        ? (isAbrupt ? 'Immediate Transient Drop' : 'Gradual Pressure Decay')
                        : 'Quasi-Steady Diurnal State'}
                    </span>
                  </div>
                </div>

                <Badge variant={isLeak ? (isAbrupt ? 'danger' : 'warning') : 'success'}>
                  {isLeak ? (isAbrupt ? 'BURST' : 'INCIPIENT') : 'STABLE'}
                </Badge>
              </div>
            </div>

            {/* Calibrated Pipe Orifice Gauge */}
            <div>
              <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Calibrated Orifice Diameter</span>
                </span>
                <span className="text-[9px] text-slate-500 font-mono">RF Regressor</span>
              </div>

              <div className="bg-slate-800/40 p-2.5 rounded space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline space-x-1.5">
                    <span className={`text-xl font-extrabold font-mono tracking-tight ${
                      isLeak ? 'text-amber-300' : 'text-slate-300'
                    }`}>
                      {diameterMm.toFixed(1)}
                    </span>
                    <span className="text-xs font-mono text-slate-400">mm</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    orificeInfo.level === 'critical'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : orificeInfo.level === 'moderate'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : orificeInfo.level === 'minor'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-700/40 text-slate-400'
                  }`}>
                    {orificeInfo.label}
                  </span>
                </div>

                {/* Calibrated Scale Gauge Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLeak 
                          ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 shadow-[0_0_10px_rgba(244,63,94,0.8)]' 
                          : 'bg-slate-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(isLeak ? 6 : 0, (diameterMm / 100) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span>0 mm</span>
                    <span>25 mm</span>
                    <span>50 mm</span>
                    <span>75 mm</span>
                    <span>100+ mm</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Phase 4 Step 4: 1-Click Jal Shakti Dispatch Action Strip & Lifecycle */}
        {isLeak && (
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              <span className="text-[11px] font-medium text-slate-300">
                Containment Recommended: <span className="font-bold text-red-300">Junction {topCandidate?.node_id || '21'}</span>
              </span>
            </div>

            {(() => {
              const targetNode = topCandidate?.node_id || '21';
              const disp = activeDispatches.find((d) => d.nodeId === targetNode && d.phase !== 'repaired');
              if (disp) {
                return (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openDispatchModal({ node_id: targetNode, status: 'Dispatched', id: disp.incidentId })}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center space-x-1.5 animate-pulse"
                      title="View active work order ticket"
                    >
                      <HardHat className="w-3.5 h-3.5" />
                      <span>{disp.phase === 'en_route' ? `En Route (${disp.remainingSeconds}s)` : `Clamping (${disp.remainingSeconds}s)`}</span>
                    </button>

                    <button
                      onClick={() => executeFieldRepair(disp.incidentId, disp.nodeId)}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all"
                      title="Complete simulated field repair and normalize pressure immediately"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Complete Repair</span>
                    </button>
                  </div>
                );
              }

              return (
                <button
                  onClick={() => openDispatchModal({
                    node_id: targetNode,
                    leak_type: dynamics,
                    diameter_mm: diameterMm,
                    water_loss_liters_per_hour: latestInference?.loss?.liters_per_hour || 5000,
                    financial_loss_inr_per_hour: latestInference?.loss?.financial_loss_inr_per_hour || 125,
                    severity: diameterMm >= 50 ? 'Critical' : 'Warning'
                  })}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-[0_0_15px_rgba(6,182,212,0.35)] transition-all"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>⚡ 1-Click Crew Dispatch</span>
                </button>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
