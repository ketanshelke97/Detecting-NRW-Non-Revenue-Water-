import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Waves, Database, Radio } from 'lucide-react';
import { useScadaStore } from '../../store/scadaStore';

export function SensorNode({ id, data }: NodeProps) {
  const telemetry = useScadaStore((state) => state.nodeData[id]);
  const isSelected = useScadaStore((state) => state.selectedNodeId === id);
  const setSelectedNodeId = useScadaStore((state) => state.setSelectedNodeId);
  const isolatedZoneNodes = useScadaStore((state) => state.isolatedZoneNodes);
  const activeFault = useScadaStore((state) => state.activeFault);
  const isFaultInjected = activeFault?.node_id === id;

  const isDimmed = isolatedZoneNodes.length > 0 && !isolatedZoneNodes.includes(id);

  const nodeType = (data.nodeType as string) || (id === '9' ? 'reservoir' : id === '2' ? 'tank' : 'sensor');
  const isReservoir = nodeType === 'reservoir' || id === '9';
  const isTank = nodeType === 'tank' || id === '2';

  // Styling based on telemetry and node element type
  let bgColor = '#475569'; // default slate
  let borderColor = '#334155';
  let isPulsing = false;
  
  if (isReservoir) {
    bgColor = '#0369a1'; // Deep Oceanic Blue for Reservoir Water Source
    borderColor = '#38bdf8';
  } else if (isTank) {
    bgColor = '#0f766e'; // Teal for Elevated Storage Tank
    borderColor = '#2dd4bf';
  } else if (data.isSensor) {
    bgColor = '#0ea5e9'; // default blue
    borderColor = '#0284c7';
  }

  if (isFaultInjected) {
    bgColor = '#dc2626'; // Vivid red for injected fault node
    borderColor = '#fca5a5';
    isPulsing = true;
  } else if (telemetry) {
    if (telemetry.isLeak) {
      bgColor = '#ef4444'; // Red for leak
      borderColor = '#b91c1c';
      isPulsing = true;
    } else if (telemetry.pressure < 35 && !isReservoir) { // Low threshold warning
      bgColor = '#f59e0b'; // Amber for warning
      borderColor = '#d97706';
    } else {
      bgColor = isReservoir ? '#0284c7' : isTank ? '#0d9488' : '#10b981'; // Green for normal
      borderColor = isReservoir ? '#38bdf8' : isTank ? '#2dd4bf' : '#059669';
    }
  }

  return (
    <div 
      className={`relative rounded-lg shadow-lg cursor-pointer transition-all duration-300 ${isSelected ? 'ring-4 ring-scada-accent shadow-[0_0_20px_rgba(14,165,233,0.5)] z-10' : ''} ${isDimmed ? 'opacity-30 grayscale' : 'opacity-100'}`}
      onClick={() => setSelectedNodeId(id)}
      style={{
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        color: '#f8fafc',
        width: 86,
        textAlign: 'center',
      }}
    >
      {/* 4 Multi-directional handles for clean orthogonal connectivity */}
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />
      
      {/* Pulsating Radar Beacon */}
      {isPulsing && (
        <span className="absolute -inset-2 flex items-center justify-center -z-10 pointer-events-none">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60"></span>
          <span className="animate-ping absolute inline-flex h-3/4 w-3/4 rounded-full bg-red-400 opacity-40" style={{ animationDelay: '0.3s' }}></span>
        </span>
      )}

      <div className="py-1 px-1.5">
        <div className="text-[11px] font-bold truncate flex items-center justify-center space-x-1">
          {isReservoir && <Waves className="w-3 h-3 text-cyan-200" />}
          {isTank && <Database className="w-3 h-3 text-teal-200" />}
          {!isReservoir && !isTank && <Radio className="w-2.5 h-2.5 opacity-70" />}
          <span>{data.label as string}</span>
        </div>
        <div className="text-[9px] uppercase tracking-wider font-mono">
          {isFaultInjected ? (
            <span className="text-amber-300 font-extrabold animate-pulse">⚡ INJECTED</span>
          ) : (
            <span className="opacity-75">{isReservoir ? 'Source' : isTank ? 'Tank' : 'Sensor'}</span>
          )}
        </div>
        {telemetry && (
          <div className="text-[10px] font-mono mt-0.5 opacity-90 border-t border-white/20 pt-0.5">
            {telemetry.pressure.toFixed(1)} <span className="opacity-75">mH</span>
          </div>
        )}
      </div>
    </div>
  );
}
