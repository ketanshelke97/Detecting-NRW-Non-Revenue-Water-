import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { TelemetryHistoryPoint } from '../../../store/scadaStore';

interface PressureEnvelopeChartProps {
  activeNodeId: string;
  data: TelemetryHistoryPoint[];
  currentStep: number;
  leakSteps?: number[];
  repairStep?: number | null;
}

export function PressureEnvelopeChart({
  activeNodeId,
  data,
  currentStep,
  leakSteps = [],
  repairStep,
}: PressureEnvelopeChartProps) {
  const chartData = useMemo(() => {
    return data.map((pt) => {
      const liveP = pt.pressures[activeNodeId] ?? pt.baselines[activeNodeId] ?? 50.0;
      const baseP = pt.baselines[activeNodeId] ?? 50.0;
      const lowerBand = Number((baseP - 1.5).toFixed(2));
      const upperBand = Number((baseP + 1.5).toFixed(2));
      const bandHeight = Number((upperBand - lowerBand).toFixed(2));
      const isIncidentStep = leakSteps.includes(pt.step);

      // Short timestamp display (HH:mm)
      const timeStr = pt.timestamp ? pt.timestamp.split(' ')[1]?.slice(0, 5) || `T+${pt.step}` : `S${pt.step}`;

      return {
        step: pt.step,
        time: timeStr,
        timestamp: pt.timestamp,
        livePressure: Number(liveP.toFixed(2)),
        baseline: Number(baseP.toFixed(2)),
        lowerBand,
        bandHeight,
        upperBand,
        isLeak: pt.isLeak || isIncidentStep,
      };
    });
  }, [data, activeNodeId, leakSteps]);

  const activeReading = chartData.find((d) => d.step === currentStep) || chartData[chartData.length - 1];
  const isDepressurized = activeReading && activeReading.livePressure < (activeReading.lowerBand ?? 40);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header telemetry status strip */}
      <div className="flex items-center justify-between pb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-200">
            Node {activeNodeId} Hydraulic Pressure
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider ${
              isDepressurized
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isDepressurized ? 'DEPRESSURIZED' : 'IN TOLERANCE'}
          </span>
        </div>
        {activeReading && (
          <div className="text-xs font-mono text-slate-400">
            Live: <span className="text-cyan-400 font-bold">{activeReading.livePressure} mH</span>
            {' '}| Base: <span className="text-slate-400">{activeReading.baseline} mH</span>
          </div>
        )}
      </div>

      <div className="flex-1 w-full min-h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="envelopeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
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
              domain={['auto', 'auto']}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                const diff = (d.livePressure - d.baseline).toFixed(2);
                return (
                  <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-lg shadow-2xl backdrop-blur-md text-xs font-mono space-y-1">
                    <div className="text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1 flex justify-between">
                      <span>Step {d.step}</span>
                      <span className="text-slate-400">{d.time}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-cyan-400">Live Pressure:</span>
                      <span className="font-bold text-slate-100">{d.livePressure} mH</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400">Normal Baseline:</span>
                      <span>{d.baseline} mH</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-emerald-400">Tolerance Band:</span>
                      <span>{d.lowerBand} – {d.upperBand} mH</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-1 border-t border-slate-800/80">
                      <span className={Number(diff) < -2 ? 'text-red-400' : 'text-slate-300'}>Delta ΔP:</span>
                      <span className={`font-bold ${Number(diff) < -2 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {Number(diff) > 0 ? `+${diff}` : diff} mH
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Shaded Normal Tolerance Corridor Area (Stack lowerBand base + height) */}
            <Area
              type="monotone"
              dataKey="lowerBand"
              stackId="band"
              stroke="transparent"
              fill="transparent"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="bandHeight"
              stackId="band"
              stroke="rgba(16,185,129,0.3)"
              strokeDasharray="2 2"
              fill="url(#envelopeGrad)"
              isAnimationActive={false}
              name="Safe Tolerance Band"
            />

            {/* Historical Normal Baseline (Dashed Line) */}
            <Line
              type="monotone"
              dataKey="baseline"
              stroke="#64748b"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              name="Baseline"
            />

            {/* Live Pressure Curve (Cyan/Red) */}
            <Line
              type="monotone"
              dataKey="livePressure"
              stroke={isDepressurized ? '#ef4444' : '#06b6d4'}
              strokeWidth={2.2}
              dot={{ r: 1.5, fill: '#06b6d4' }}
              activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1.5 }}
              isAnimationActive={false}
              name="Live Pressure"
            />

            {/* Vertical needle tracking current simulation playback step */}
            <ReferenceLine
              x={currentStep}
              stroke="#38bdf8"
              strokeWidth={1.8}
              strokeDasharray="3 3"
              label={{
                value: 'NOW',
                position: 'top',
                fill: '#38bdf8',
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 700,
              }}
            />

            {/* Repair completed marker if applicable */}
            {repairStep !== undefined && repairStep !== null && (
              <ReferenceLine
                x={repairStep}
                stroke="#14b8a6"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                label={{
                  value: 'REPAIR',
                  position: 'insideTopRight',
                  fill: '#14b8a6',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
