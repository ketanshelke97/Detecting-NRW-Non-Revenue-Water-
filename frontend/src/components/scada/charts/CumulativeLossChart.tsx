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

interface CumulativeLossChartProps {
  data: TelemetryHistoryPoint[];
  currentStep: number;
  repairStep?: number | null;
}

export function CumulativeLossChart({
  data,
  currentStep,
  repairStep,
}: CumulativeLossChartProps) {
  const chartData = useMemo(() => {
    return data.map((pt) => {
      const cumM3 = pt.cumulativeLossM3 || 0;
      const cumInr = Math.round(cumM3 * 1000 * 0.025);
      const timeStr = pt.timestamp ? pt.timestamp.split(' ')[1]?.slice(0, 5) || `T+${pt.step}` : `S${pt.step}`;

      return {
        step: pt.step,
        time: timeStr,
        cumulativeLossM3: Number(cumM3.toFixed(2)),
        cumulativeInr: cumInr,
      };
    });
  }, [data]);

  const activePt = chartData.find((d) => d.step === currentStep) || chartData[chartData.length - 1];
  const totalM3 = activePt?.cumulativeLossM3 || 0;
  const totalInr = activePt?.cumulativeInr || 0;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header status strip */}
      <div className="flex items-center justify-between pb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-200">
            Cumulative Water Loss Volume
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
            ACCUMULATIVE
          </span>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total: <span className="text-purple-300 font-bold">{totalM3.toFixed(1)} m³</span>
          {' '}| <span className="text-rose-400 font-bold">₹{totalInr.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="cumLossGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ec4899" stopOpacity={0.03} />
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
              tickFormatter={(v) => `${v}m³`}
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
                      <span className="text-purple-300 font-semibold">Total Water Lost:</span>
                      <span className="font-bold text-slate-100">{d.cumulativeLossM3} m³</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-1 border-t border-slate-800/80">
                      <span className="text-rose-400">Total Financial Toll:</span>
                      <span className="font-bold text-rose-400">₹{d.cumulativeInr.toLocaleString()}</span>
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

            {/* Repair completed marker (Plateau begins) */}
            {repairStep !== undefined && repairStep !== null && (
              <ReferenceLine
                x={repairStep}
                stroke="#14b8a6"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                label={{
                  value: 'PLATEAU (REPAIRED)',
                  position: 'insideTopRight',
                  fill: '#14b8a6',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="cumulativeLossM3"
              name="Cumulative Loss (m³)"
              stroke="#a855f7"
              strokeWidth={2}
              fill="url(#cumLossGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
