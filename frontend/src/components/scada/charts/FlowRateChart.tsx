import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { TelemetryHistoryPoint } from '../../../store/scadaStore';

interface FlowRateChartProps {
  data: TelemetryHistoryPoint[];
  currentStep: number;
  repairStep?: number | null;
}

export function FlowRateChart({
  data,
  currentStep,
  repairStep,
}: FlowRateChartProps) {
  const chartData = useMemo(() => {
    return data.map((pt) => {
      const flowLph = pt.flowLph || 0;
      const flowM3h = Number((flowLph / 1000.0).toFixed(2));
      const timeStr = pt.timestamp ? pt.timestamp.split(' ')[1]?.slice(0, 5) || `T+${pt.step}` : `S${pt.step}`;

      return {
        step: pt.step,
        time: timeStr,
        flowLph: Math.round(flowLph),
        flowM3h,
        financialLph: Number((flowLph * 0.025).toFixed(0)),
        isLeak: pt.isLeak,
      };
    });
  }, [data]);

  const activePt = chartData.find((d) => d.step === currentStep) || chartData[chartData.length - 1];
  const isActivelyLeaking = activePt && activePt.flowLph > 0;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header status strip */}
      <div className="flex items-center justify-between pb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-200">
            Real-Time Discharge Flow Rate
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider ${
              isActivelyLeaking
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                : 'bg-slate-700/40 text-slate-400 border border-slate-600/40'
            }`}
          >
            {isActivelyLeaking ? 'DISCHARGING' : 'NOMINAL ZERO'}
          </span>
        </div>
        {activePt && (
          <div className="text-xs font-mono text-slate-400">
            Rate: <span className="text-amber-400 font-bold">{activePt.flowLph.toLocaleString()} L/h</span>
            {' '}(<span className="text-cyan-400">{activePt.flowM3h} m³/h</span>)
          </div>
        )}
      </div>

      <div className="flex-1 w-full min-h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="flowLossGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>

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
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-lg shadow-2xl backdrop-blur-md text-xs font-mono space-y-1">
                    <div className="text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1 flex justify-between">
                      <span>Step {d.step}</span>
                      <span className="text-slate-400">{d.time}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-amber-400 font-semibold">Discharge Rate:</span>
                      <span className="font-bold text-slate-100">{d.flowLph.toLocaleString()} L/h</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-cyan-400 font-semibold">Volumetric Flow:</span>
                      <span>{d.flowM3h} m³/h</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-1 border-t border-slate-800/80">
                      <span className="text-rose-400">Financial Burn:</span>
                      <span className="font-bold text-rose-400">₹{d.financialLph.toLocaleString()}/hr</span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Current step needle */}
            <ReferenceLine
              x={currentStep}
              stroke="#38bdf8"
              strokeWidth={1.8}
              strokeDasharray="3 3"
            />

            {/* Repair completed marker */}
            {repairStep !== undefined && repairStep !== null && (
              <ReferenceLine
                x={repairStep}
                stroke="#14b8a6"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                label={{
                  value: 'REPAIRED (0 L/h)',
                  position: 'insideTopRight',
                  fill: '#14b8a6',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="flowLph"
              name="Flow Rate (L/h)"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#flowLossGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
