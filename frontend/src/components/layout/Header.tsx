import { Droplets, Activity, ShieldAlert, BellRing } from 'lucide-react';
import { useScadaStore } from '../../store/scadaStore';

export function Header() {
  const activeIncidentCount = useScadaStore((state) => state.activeIncidentCount);
  const criticalIncidentCount = useScadaStore((state) => state.criticalIncidentCount);
  const setIsIncidentDrawerOpen = useScadaStore((state) => state.setIsIncidentDrawerOpen);
  const latestInference = useScadaStore((state) => state.latestInference);

  const isLeak = latestInference?.status === 'LEAK_DETECTED';

  return (
    <header className="h-16 bg-scada-panel border-b border-scada-border flex items-center justify-between px-6 shrink-0 z-10 shadow-md">
      <div className="flex items-center space-x-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-scada-bg border border-scada-accent/30 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
          <Droplets className="w-5 h-5 text-scada-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center">
            Ministry of Jal Shakti
            <span className="ml-3 text-xs font-medium text-scada-accent uppercase tracking-widest border border-scada-accent/30 px-2 py-0.5 rounded bg-scada-accent/10">SCADA</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">Non-Revenue Water Digital Twin Platform</p>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        {/* Interactive Alarm Center Trigger */}
        <button
          onClick={() => setIsIncidentDrawerOpen(true)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            activeIncidentCount > 0
              ? 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
              : 'bg-scada-bg/80 border-scada-border text-slate-300 hover:bg-slate-800'
          }`}
          title={`Open SCADA Alarm Center (${activeIncidentCount} Active, ${criticalIncidentCount} Critical)`}
        >
          {activeIncidentCount > 0 ? (
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
          ) : (
            <BellRing className="w-4 h-4 text-slate-400" />
          )}
          <span>Alarm Center</span>
          <span className={`px-1.5 py-0.2 rounded-full font-mono text-[11px] ${
            activeIncidentCount > 0 
              ? 'bg-red-500 text-slate-950 font-bold' 
              : 'bg-slate-700 text-slate-300'
          }`}>
            {activeIncidentCount}
          </span>
        </button>

        <div className="h-8 w-px bg-scada-border"></div>

        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Network Status</span>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLeak ? 'bg-scada-danger' : 'bg-scada-success'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isLeak ? 'bg-scada-danger' : 'bg-scada-success'
              }`}></span>
            </span>
            <span className={`text-sm font-semibold ${
              isLeak ? 'text-red-400 animate-pulse' : 'text-scada-success'
            }`}>
              {isLeak ? 'LEAK ALERT' : 'NOMINAL'}
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-scada-border"></div>

        <div className="flex items-center space-x-3">
          <Activity className="w-4 h-4 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 uppercase">Live Connections</span>
            <span className="text-sm font-mono text-slate-200">1/1</span>
          </div>
        </div>
      </div>
    </header>
  );
}
