import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useScadaStore } from '../../store/scadaStore';
import { 
  Droplets, 
  IndianRupee, 
  Activity, 
  CheckCircle2, 
  Flame, 
  ShieldCheck, 
  TrendingUp 
} from 'lucide-react';

export const NrwLossTicker: React.FC = () => {
  const latestInference = useScadaStore((state) => state.latestInference);
  const telemetryHistory = useScadaStore((state) => state.telemetryHistory);
  const currentStepIndex = useScadaStore((state) => state.currentStepIndex);
  const repairStep = useScadaStore((state) => state.repairStep);
  const activeFault = useScadaStore((state) => state.activeFault);

  const isLeak = latestInference?.status === 'LEAK_DETECTED';

  // Instantaneous flow rates from latest inference
  const flowLph = latestInference?.loss?.liters_per_hour || 0;
  const flowLpm = flowLph / 60.0;
  const flowM3h = flowLph / 1000.0;
  const financialRatePerHour = latestInference?.loss?.financial_loss_inr_per_hour || (flowLph * 0.025);

  // Cumulative water & financial loss from current telemetry history
  const currentHistoryPoint = telemetryHistory.find((p) => p.step === currentStepIndex) 
    || telemetryHistory[telemetryHistory.length - 1];
  
  const cumulativeM3 = currentHistoryPoint?.cumulativeLossM3 || 0;
  const cumulativeLiters = cumulativeM3 * 1000;
  const cumulativeInr = cumulativeM3 * 25.0; // ₹25/m³ benchmark Jal Shakti municipal tariff

  // Determine repair / plateau status
  const isPostRepair = (repairStep !== null && currentStepIndex >= repairStep) ||
    (!isLeak && !activeFault && cumulativeM3 > 0.01);
  
  const isActivelyLeaking = isLeak && flowLph > 0;

  // Format currency with Indian grouping
  const formatInr = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Format volume
  const formatNumber = (val: number, decimals = 1) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(val);
  };

  return (
    <Card className="border-scada-border/80 bg-scada-panel/80 backdrop-blur-md shadow-2xl flex flex-col justify-between">
      <CardHeader className="py-3 px-4 border-b border-scada-border/60 bg-scada-panel/90 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-md ${
            isActivelyLeaking 
              ? 'bg-red-500/20 text-red-400 animate-pulse ring-1 ring-red-500/40' 
              : isPostRepair
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-cyan-500/20 text-cyan-400'
          }`}>
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-slate-200">
              NRW Loss Accounting Ticker
            </CardTitle>
            <p className="text-[10px] text-slate-400">Torricelli Physical Efflux & Financial Burn Audit</p>
          </div>
        </div>

        <div>
          {isActivelyLeaking ? (
            <Badge variant="danger" className="animate-pulse flex items-center space-x-1.5 bg-red-950/80 text-red-300 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
              <span>ACTIVE DISCHARGE</span>
            </Badge>
          ) : isPostRepair ? (
            <Badge variant="success" className="flex items-center space-x-1.5 bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>LOSS PLATEAUED • REPAIRED</span>
            </Badge>
          ) : (
            <Badge variant="default" className="flex items-center space-x-1 bg-slate-800/80 text-slate-400 border-slate-700">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>NOMINAL FLOW</span>
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Metric Row 1: Instantaneous Flow Rate */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Instantaneous Discharge</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Q = Cd · A · √(2gH)
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline space-x-2">
              <span className={`text-2xl font-bold font-mono tracking-tight transition-colors duration-300 ${
                isActivelyLeaking ? 'text-red-400 font-extrabold' : 'text-slate-200'
              }`}>
                {formatNumber(flowLpm, 1)}
              </span>
              <span className="text-xs text-slate-400 font-medium">L/min</span>
            </div>

            <div className="text-right">
              <span className="text-sm font-semibold font-mono text-cyan-300">
                {formatNumber(flowM3h, 2)}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">m³/hr</span>
            </div>
          </div>

          {/* Micro Visual Flow Indicator Bar */}
          <div className="w-full bg-slate-800/90 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isActivelyLeaking 
                  ? 'bg-gradient-to-r from-amber-500 via-red-500 to-rose-600 shadow-[0_0_8px_rgba(244,63,94,0.6)]' 
                  : isPostRepair
                  ? 'bg-emerald-500/50'
                  : 'bg-slate-700/40'
              }`}
              style={{ width: `${Math.min(100, Math.max(isActivelyLeaking ? 5 : 0, (flowLpm / 1500) * 100))}%` }}
            />
          </div>
        </div>

        {/* Metric Row 2: Compounding Financial Loss & Burn Rate */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <Flame className={`w-3 h-3 ${isActivelyLeaking ? 'text-rose-400 animate-bounce' : 'text-slate-500'}`} />
                <span>Burn Rate</span>
              </span>
              <span className="text-[9px] text-slate-500 font-mono">₹25/m³</span>
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs text-slate-400 font-mono">₹</span>
                <span className={`text-lg font-bold font-mono tracking-tight ${
                  isActivelyLeaking ? 'text-rose-400' : 'text-slate-200'
                }`}>
                  {formatInr(financialRatePerHour)}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5">INR per operating hour</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <IndianRupee className="w-3 h-3 text-amber-400" />
                <span>Compounded Toll</span>
              </span>
              {isPostRepair && (
                <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-tight">Frozen</span>
              )}
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs text-slate-400 font-mono">₹</span>
                <span className={`text-lg font-bold font-mono tracking-tight ${
                  cumulativeInr > 0 ? 'text-amber-300' : 'text-slate-200'
                }`}>
                  {formatInr(cumulativeInr)}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5">
                {isPostRepair ? 'Final repair bill' : 'Accumulated loss'}
              </p>
            </div>
          </div>
        </div>

        {/* Metric Row 3: Cumulative Physical Volume Loss */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <TrendingUp className="w-3 h-3 text-cyan-400" />
              <span>Cumulative Volume Lost</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400">
              {formatNumber(cumulativeLiters, 0)} L
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold font-mono text-slate-100">
                {formatNumber(cumulativeM3, 2)}
              </span>
              <span className="text-xs text-slate-400 font-mono">m³</span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              isPostRepair 
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : isActivelyLeaking
                ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {isPostRepair 
                ? 'Incident Total' 
                : isActivelyLeaking 
                ? 'Accumulating' 
                : 'Zero Deficit'}
            </span>
          </div>
        </div>

        {/* Footer Audit Callout */}
        <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/60">
          <span className="font-mono">Audit Step: #{currentStepIndex}</span>
          <span className="font-mono">Jal Shakti Standard: 2026/CPHEEO</span>
        </div>
      </CardContent>
    </Card>
  );
};
