import { useMemo } from 'react';
import { useScadaStore, NET1_BASELINES } from '../../store/scadaStore';
import type { TelemetryHistoryPoint } from '../../store/scadaStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { PressureEnvelopeChart } from './charts/PressureEnvelopeChart';
import { HydraulicGradientChart } from './charts/HydraulicGradientChart';
import { FlowRateChart } from './charts/FlowRateChart';
import { CumulativeLossChart } from './charts/CumulativeLossChart';
import { Activity, Radio } from 'lucide-react';

const SELECTABLE_NODES = ['21', '22', '23', '12', '11', '10', '31', '32', '33', '13', '2'];

export function TelemetryDeck() {
  const selectedNodeId = useScadaStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useScadaStore((s) => s.setSelectedNodeId);
  const telemetryHistory = useScadaStore((s) => s.telemetryHistory);
  const currentStepIndex = useScadaStore((s) => s.currentStepIndex);
  const leakSteps = useScadaStore((s) => s.leakStepIndices);
  const activeScenarioMetadata = useScadaStore((s) => s.activeScenarioMetadata);
  const activeFault = useScadaStore((s) => s.activeFault);
  const isLiveDvrMode = useScadaStore((s) => s.isLiveDvrMode);
  const dvrScrubIndex = useScadaStore((s) => s.dvrScrubIndex);

  // Active node to plot: selected node or active fault node or scenario target or default '21'
  const activeNode = selectedNodeId || activeFault?.node_id || activeScenarioMetadata?.node_id || '21';

  // Resolved currentStep for charts: reflects scrubbed step in DVR mode
  const currentStep = useMemo(() => {
    if (isLiveDvrMode && dvrScrubIndex !== null && telemetryHistory[dvrScrubIndex]) {
      return telemetryHistory[dvrScrubIndex].step;
    }
    return currentStepIndex;
  }, [isLiveDvrMode, dvrScrubIndex, telemetryHistory, currentStepIndex]);

  const repairStep = useMemo(() => {
    return leakSteps.length > 0 ? Math.max(...leakSteps) + 1 : null;
  }, [leakSteps]);

  // Dynamic live history points with 3-point initial nominal seed
  const effectiveData: TelemetryHistoryPoint[] = useMemo(() => {
    if (telemetryHistory.length > 0) {
      return telemetryHistory;
    }
    const synthetic: TelemetryHistoryPoint[] = [];
    const now = new Date();
    for (let s = 0; s < 3; s++) {
      const pressures: Record<string, number> = {};
      const deltas: Record<string, number> = {};
      for (const [nid, baseP] of Object.entries(NET1_BASELINES)) {
        pressures[nid] = baseP;
        deltas[nid] = 0;
      }
      const timeStr = new Date(now.getTime() - (2 - s) * 1000).toTimeString().split(' ')[0];
      synthetic.push({
        step: s,
        timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
        pressures,
        baselines: NET1_BASELINES,
        deltas,
        flowLph: 0,
        cumulativeLossM3: 0,
        financialLossInr: 0,
        isLeak: false,
      });
    }
    return synthetic;
  }, [telemetryHistory]);

  return (
    <Card className="mt-6 border-slate-800/90 bg-scada-panel/80 shadow-2xl backdrop-blur-xl">
      <CardHeader className="py-3 px-5 border-b border-scada-border/60 bg-scada-panel/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
                Telemetry Analytics Deck
              </CardTitle>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                LIVE SYNC &bull; 4-GRAPH SUITE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Synchronized Multi-Sensor Pressure Dynamics, Diurnal Tolerance Corridor & Water Loss Trajectory
            </p>
          </div>
        </div>

        {/* Node Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400 text-[11px]">Sensor Node:</span>
          <select
            value={activeNode}
            onChange={(e) => setSelectedNodeId(e.target.value)}
            className="bg-transparent text-cyan-300 font-bold outline-none cursor-pointer text-xs"
          >
            {SELECTABLE_NODES.map((nid) => (
              <option key={nid} value={nid} className="bg-slate-900 text-slate-200">
                Junction {nid} {nid === '21' ? '(Industrial Sec.)' : nid === '12' ? '(Tank Feed)' : ''}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="p-4 bg-scada-bg/40">
        {/* ── Permanent 2x2 Grid View ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Box 1: Pressure vs Diurnal Envelope */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 shadow-lg min-h-[250px]">
            <PressureEnvelopeChart
              activeNodeId={activeNode}
              data={effectiveData}
              currentStep={currentStep}
              leakSteps={leakSteps}
              repairStep={repairStep}
            />
          </div>

          {/* Box 2: Multi-Node Hydraulic Gradient */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 shadow-lg min-h-[250px]">
            <HydraulicGradientChart
              activeNodeId={activeNode}
              data={effectiveData}
              currentStep={currentStep}
            />
          </div>

          {/* Box 3: Real-Time Flow Discharge Rate */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 shadow-lg min-h-[250px]">
            <FlowRateChart
              data={effectiveData}
              currentStep={currentStep}
              repairStep={repairStep}
            />
          </div>

          {/* Box 4: Cumulative Water Loss Volume */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 shadow-lg min-h-[250px]">
            <CumulativeLossChart
              data={effectiveData}
              currentStep={currentStep}
              repairStep={repairStep}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

