import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { TelemetryHistoryPoint } from '../../../store/scadaStore';

interface HydraulicGradientChartProps {
  activeNodeId: string;
  data: TelemetryHistoryPoint[];
  currentStep: number;
}

const NEIGHBOR_MAP: Record<string, { neighbor: string; reference: string }> = {
  '21': { neighbor: '22', reference: '10' },
  '22': { neighbor: '23', reference: '12' },
  '23': { neighbor: '33', reference: '13' },
  '12': { neighbor: '11', reference: '2' },
  '11': { neighbor: '10', reference: '9' },
  '10': { neighbor: '11', reference: '9' },
  '31': { neighbor: '32', reference: '21' },
  '32': { neighbor: '33', reference: '22' },
  '33': { neighbor: '32', reference: '23' },
  '13': { neighbor: '12', reference: '9' },
  '2':  { neighbor: '12', reference: '10' },
  '9':  { neighbor: '10', reference: '2' },
};

export function HydraulicGradientChart({
  activeNodeId,
  data,
  currentStep,
}: HydraulicGradientChartProps) {
  const { neighbor, reference } = NEIGHBOR_MAP[activeNodeId] || { neighbor: '22', reference: '10' };

  const chartData = useMemo(() => {
    return data.map((pt) => {
      const deltaActive = pt.deltas[activeNodeId] ?? 0.0;
      const deltaNeighbor = pt.deltas[neighbor] ?? 0.0;
      const deltaRef = pt.deltas[reference] ?? 0.0;

      return {
        step: pt.step,
        deltaActive: Number(deltaActive.toFixed(2)),
        deltaNeighbor: Number(deltaNeighbor.toFixed(2)),
        deltaRef: Number(deltaRef.toFixed(2)),
      };
    });
  }, [data, activeNodeId, neighbor, reference]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header telemetry info */}
      <div className="flex items-center justify-between pb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-200">
            Hydraulic Gradient Delta (ΔP)
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
            MULTI-JUNCTION
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Comparing: <span className="text-rose-400 font-bold">J-{activeNodeId}</span> vs{' '}
          <span className="text-amber-400 font-bold">J-{neighbor}</span> vs{' '}
          <span className="text-cyan-400 font-bold">J-{reference}</span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

            <XAxis
              dataKey="step"
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(step) => `S${step}`}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) => `${v}m`}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-lg shadow-2xl backdrop-blur-md text-xs font-mono space-y-1">
                    <div className="text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1 flex justify-between">
                      <span>Step {d.step}</span>
                      <span className="text-slate-400">Headloss Drop ΔP</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-rose-400 font-semibold">Target Node {activeNodeId}:</span>
                      <span className="font-bold text-slate-100">{d.deltaActive} mH</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-amber-400 font-semibold">Adjacent Node {neighbor}:</span>
                      <span>{d.deltaNeighbor} mH</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-cyan-400 font-semibold">Reference Node {reference}:</span>
                      <span>{d.deltaRef} mH</span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Nominal zero baseline */}
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" strokeWidth={1} />

            {/* Vertical needle tracking current step */}
            <ReferenceLine
              x={currentStep}
              stroke="#38bdf8"
              strokeWidth={1.8}
              strokeDasharray="3 3"
            />

            {/* Primary active node curve (Rose Red) */}
            <Line
              type="monotone"
              dataKey="deltaActive"
              name={`Node ${activeNodeId}`}
              stroke="#f43f5e"
              strokeWidth={2.2}
              dot={{ r: 1.5, fill: '#f43f5e' }}
              activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1.5 }}
              isAnimationActive={false}
            />

            {/* Adjacent pipe neighbor curve (Amber) */}
            <Line
              type="monotone"
              dataKey="deltaNeighbor"
              name={`Neighbor ${neighbor}`}
              stroke="#f59e0b"
              strokeWidth={1.8}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
            />

            {/* Reference trunk curve (Cyan) */}
            <Line
              type="monotone"
              dataKey="deltaRef"
              name={`Ref ${reference}`}
              stroke="#06b6d4"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />

            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingTop: 6 }}
              iconSize={8}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
