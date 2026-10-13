
import { Droplets, Activity } from 'lucide-react';

export function Header() {
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
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Network Status</span>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-scada-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-scada-success"></span>
            </span>
            <span className="text-sm font-semibold text-scada-success">NOMINAL</span>
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
