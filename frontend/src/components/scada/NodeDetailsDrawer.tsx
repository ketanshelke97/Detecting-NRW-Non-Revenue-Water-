import { X, Activity, Droplets, AlertTriangle } from 'lucide-react';
import { useScadaStore } from '../../store/scadaStore';
import { Badge } from '../ui/Badge';
import { useNetworkTopology } from '../../hooks/useNetworkTopology';

export function NodeDetailsDrawer() {
  const selectedNodeId = useScadaStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useScadaStore((state) => state.setSelectedNodeId);
  const nodeData = useScadaStore((state) => state.nodeData);
  const isolatedZoneNodes = useScadaStore((state) => state.isolatedZoneNodes);
  const setIsolatedZoneNodes = useScadaStore((state) => state.setIsolatedZoneNodes);
  const { data: topology } = useNetworkTopology();

  if (!selectedNodeId) return null;

  const telemetry = nodeData[selectedNodeId];
  const nodeInfo = topology?.nodes.find((n: any) => n.id === selectedNodeId);

  // Determine connections (pipes connected to this node)
  const connections = topology?.links.filter(
    (l: any) => l.source === selectedNodeId || l.target === selectedNodeId
  );

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-scada-panel border-l border-scada-border shadow-2xl flex flex-col z-10 transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 border-b border-scada-border flex justify-between items-center bg-slate-800/50">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center">
            <Droplets className="w-5 h-5 mr-2 text-scada-accent" />
            {selectedNodeId === '9' ? 'Reservoir 9 (Source)' : selectedNodeId === '2' ? 'Elevated Tank 2' : `Node ${selectedNodeId}`}
          </h3>
          <p className="text-xs text-slate-400">
            {nodeInfo?.type === 'reservoir' || selectedNodeId === '9'
              ? 'Primary Municipal Water Supply Reservoir'
              : nodeInfo?.type === 'tank' || selectedNodeId === '2'
              ? 'Elevated Pressure Balancing Storage Tank'
              : `${nodeInfo?.type || 'Monitored'} Distribution Junction`}
          </p>
        </div>
        <button 
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Status Section */}
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Live Telemetry</h4>
          {telemetry ? (
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-400 flex items-center">
                    <Activity className="w-4 h-4 mr-1.5" /> Pressure
                  </span>
                  <span className="text-lg font-mono font-bold text-slate-100">
                    {telemetry.pressure.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-scada-accent" 
                    style={{ width: `${Math.min(100, Math.max(0, telemetry.pressure))}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50 flex justify-between items-center">
                <span className="text-sm text-slate-400">Status</span>
                {telemetry.isLeak ? (
                  <Badge variant="danger" className="animate-pulse flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Leak Detected
                  </Badge>
                ) : telemetry.pressure < 35 ? (
                  <Badge variant="warning">Warning</Badge>
                ) : (
                  <Badge variant="success">Nominal</Badge>
                )}
              </div>

              {telemetry.isLeak && (
                <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                  <span className="text-sm text-red-400 block mb-1">Leak Probability</span>
                  <span className="text-xl font-bold text-red-300">
                    {(telemetry.leakProbability * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic p-3 bg-slate-800/30 rounded border border-slate-800">
              Awaiting telemetry data...
            </div>
          )}
        </section>

        {/* Network Connections */}
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pipe Connections</h4>
          <div className="bg-slate-800/50 rounded border border-slate-700/50 divide-y divide-slate-700/50">
            {connections && connections.length > 0 ? (
              connections.map((conn: any, idx: number) => {
                const isPump = conn.type === 'pump' || conn.id === 'PUMP-9';
                const isTankFeed = conn.id === 'PIPE-110' || (conn.source === '2' || conn.target === '2');
                const targetId = conn.source === selectedNodeId ? conn.target : conn.source;
                const dir = conn.source === selectedNodeId ? 'Feeds \u2192' : '\u2190 Fed by';
                const label = conn.label || (isPump ? 'Pump 9' : isTankFeed ? 'Pipe 110 (Tank)' : `Pipe ${conn.id || ''}`);

                return (
                  <div key={idx} className="p-2 flex justify-between items-center text-xs">
                    <div>
                      <span className={`font-semibold mr-1.5 ${isPump ? 'text-purple-400' : isTankFeed ? 'text-cyan-400' : 'text-slate-300'}`}>
                        {isPump ? '\u26A1 ' : ''}{label}
                      </span>
                      <span className="text-slate-500">
                        {dir} Node {targetId}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-mono text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-2 text-sm text-slate-500">No pipe connections found.</div>
            )}
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-scada-border bg-slate-800/50">
        <button 
          onClick={() => {
            const connectedNodes = connections?.map((c: any) => c.source === selectedNodeId ? c.target : c.source) || [];
            setIsolatedZoneNodes([selectedNodeId, ...connectedNodes]);
          }}
          className="w-full py-2.5 bg-scada-warning/10 text-scada-warning hover:bg-scada-warning hover:text-slate-900 border border-scada-warning/50 rounded font-bold transition-colors flex justify-center items-center"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Isolate Zone
        </button>
        {isolatedZoneNodes.length > 0 && (
          <button 
            onClick={() => setIsolatedZoneNodes([])}
            className="w-full mt-2 py-2.5 bg-slate-700/50 text-slate-300 hover:bg-slate-700 rounded transition-colors text-sm"
          >
            Clear Isolation
          </button>
        )}
      </div>
    </div>
  );
}
