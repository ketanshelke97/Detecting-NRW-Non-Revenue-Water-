
import { Layout } from './components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { useNetworkTopology } from './hooks/useNetworkTopology';
import { DigitalTwinMap } from './components/scada/DigitalTwinMap';
import { useScadaStream } from './hooks/useScadaStream';
import { useScadaStore } from './store/scadaStore';
import { NodeDetailsDrawer } from './components/scada/NodeDetailsDrawer';
import { SimulationToolbar } from './components/scada/SimulationToolbar';
import { ScenarioCatalogDrawer } from './components/scada/ScenarioCatalogDrawer';
import { FaultInjectionPanel } from './components/scada/FaultInjectionPanel';
import { TelemetryDeck } from './components/scada/TelemetryDeck';

function App() {
  const { data: topology, isLoading, error } = useNetworkTopology();
  const { isConnected: isWsConnected } = useScadaStream();
  const nodeData = useScadaStore((state) => state.nodeData);
  const latestInference = useScadaStore((state) => state.latestInference);
  const activeFault = useScadaStore((state) => state.activeFault);

  const isLeak = latestInference?.status === 'LEAK_DETECTED';
  
  // Calculate average network pressure and locate lowest pressure junction
  const nodeEntries = Object.entries(nodeData);
  const pressures = nodeEntries.map(([_, n]) => n.pressure).filter((p) => !isNaN(p));
  const avgPressure = pressures.length > 0 
    ? (pressures.reduce((a, b) => a + b, 0) / pressures.length).toFixed(1)
    : '53.4';

  let minPressure = 999;
  let minNodeId: string | null = null;
  for (const [id, data] of nodeEntries) {
    if (!isNaN(data.pressure) && data.pressure < minPressure) {
      minPressure = data.pressure;
      minNodeId = id;
    }
  }
  const hasSevereDeficit = minPressure < 35.0 || isLeak;
  const hasModerateDeficit = minPressure < 45.0 && !hasSevereDeficit;

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Operations Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time EPANET SCADA Digital Twin & AI Leak Diagnostic Engine</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={isWsConnected ? 'success' : 'default'}>
            SCADA WebSocket: {isWsConnected ? 'Connected' : 'Offline'}
          </Badge>
          {activeFault && (
            <Badge variant="danger">
              ⚡ FAULT: Node {activeFault.node_id} ({activeFault.diameter_mm}mm)
            </Badge>
          )}
          <Badge variant={isLeak ? 'danger' : 'success'}>
            Network: {isLeak ? 'LEAK DETECTED' : 'NOMINAL'}
          </Badge>
        </div>
      </div>

      {/* Real-time KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="border-slate-800 bg-scada-panel/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold">System Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className={`text-2xl font-bold tracking-tight ${isLeak ? 'text-red-400' : 'text-slate-100'}`}>
              {isLeak ? 'Incident Alert' : 'Operational'}
            </span>
            <Badge variant={isLeak ? 'danger' : 'success'}>
              {isLeak ? 'Action Required' : 'Online'}
            </Badge>
          </CardContent>
        </Card>
        
        <Card className="border-slate-800 bg-scada-panel/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Leaks</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className={`text-2xl font-bold tracking-tight ${isLeak ? 'text-red-400' : 'text-slate-100'}`}>
              {isLeak ? '1 Incident' : '0'}
            </span>
            <Badge variant={isLeak ? 'danger' : 'default'}>
              {isLeak ? latestInference?.dynamics || 'Abrupt Rupture' : 'Nominal'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-scada-panel/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Mean Hydraulic Head</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-slate-100 font-mono">
                {avgPressure} <span className="text-sm font-normal text-slate-400">mH2O</span>
              </span>
              {hasSevereDeficit && minNodeId && (
                <p className="text-[10px] text-red-400 font-mono mt-0.5">
                  Min: Node {minNodeId} ({minPressure.toFixed(1)}m)
                </p>
              )}
            </div>
            <Badge variant={hasSevereDeficit ? 'danger' : hasModerateDeficit ? 'warning' : 'success'}>
              {hasSevereDeficit && minNodeId
                ? `Deficit (N${minNodeId})`
                : hasModerateDeficit
                ? 'Pressure Warning'
                : 'Stable'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Simulation Control Toolbar (Phase 3 Step 1) */}
      <SimulationToolbar />

      {/* Main Net1 Digital Twin Map Canvas */}
      <Card className="h-[620px] flex flex-col shadow-2xl border-scada-border/80">
        <CardHeader className="py-3 px-5 border-b border-scada-border/60 bg-scada-panel/90 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Net1 Topological Digital Twin
          </CardTitle>
          <span className="text-xs font-mono text-slate-400">
            12 Network Elements (1 Reservoir, 1 Elevated Tank, 10 Distribution Junctions) &bull; Adjacency Active
          </span>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative bg-scada-bg/60 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-scada-bg/90 z-20">
              <p className="text-scada-accent animate-pulse font-semibold">Initializing Digital Twin Graph...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-scada-bg/90 z-20">
              <p className="text-scada-danger bg-scada-danger/10 px-4 py-2 rounded border border-scada-danger/30">
                Connection to SCADA Backend Lost.
              </p>
            </div>
          )}
          {topology && <DigitalTwinMap data={topology} />}
          <NodeDetailsDrawer />
        </CardContent>
      </Card>

      {/* Synchronized 4-Chart SCADA Telemetry Deck (Phase 3 Step 4) */}
      <TelemetryDeck />

      <ScenarioCatalogDrawer />
      <FaultInjectionPanel />
    </Layout>
  );
}

export default App;
