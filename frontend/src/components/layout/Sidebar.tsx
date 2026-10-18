import { useState } from 'react';
import { Network, Database, Settings, ShieldAlert, BarChart3, BellRing } from 'lucide-react';
import { useScadaStore } from '../../store/scadaStore';

export function Sidebar() {
  const isScenarioCatalogOpen = useScadaStore((state) => state.isScenarioCatalogOpen);
  const setIsScenarioCatalogOpen = useScadaStore((state) => state.setIsScenarioCatalogOpen);
  const isIncidentDrawerOpen = useScadaStore((state) => state.isIncidentDrawerOpen);
  const setIsIncidentDrawerOpen = useScadaStore((state) => state.setIsIncidentDrawerOpen);
  const activeIncidentCount = useScadaStore((state) => state.activeIncidentCount);
  const isAuditModalOpen = useScadaStore((state) => state.isAuditModalOpen);
  const openAuditModal = useScadaStore((state) => state.openAuditModal);

  const [activeTab, setActiveTab] = useState<'twin' | 'diagnostics'>('twin');

  const handleDigitalTwinClick = () => {
    setActiveTab('twin');
    setIsScenarioCatalogOpen(false);
    setIsIncidentDrawerOpen(false);
    const mainContainer = document.getElementById('scada-main-container');
    if (mainContainer) {
      mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDiagnosticsClick = () => {
    setActiveTab('diagnostics');
    setIsScenarioCatalogOpen(false);
    setIsIncidentDrawerOpen(false);
    const el = document.getElementById('ai-diagnostics-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-cyan-500', 'shadow-[0_0_35px_rgba(14,165,233,0.35)]');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-cyan-500', 'shadow-[0_0_35px_rgba(14,165,233,0.35)]');
      }, 1800);
    }
  };

  const handleCatalogClick = () => {
    setIsIncidentDrawerOpen(false);
    setIsScenarioCatalogOpen(true);
  };

  const handleAlarmCenterClick = () => {
    setIsScenarioCatalogOpen(false);
    setIsIncidentDrawerOpen(true);
  };

  const handleAuditClick = () => {
    setIsScenarioCatalogOpen(false);
    setIsIncidentDrawerOpen(false);
    openAuditModal();
  };

  const isTwinActive = !isScenarioCatalogOpen && !isIncidentDrawerOpen && !isAuditModalOpen && activeTab === 'twin';
  const isDiagnosticsActive = !isScenarioCatalogOpen && !isIncidentDrawerOpen && !isAuditModalOpen && activeTab === 'diagnostics';
  const isCatalogActive = isScenarioCatalogOpen;
  const isAlarmsActive = isIncidentDrawerOpen;
  const isAuditActive = isAuditModalOpen;

  const navItems = [
    { icon: Network, label: 'Digital Twin', active: isTwinActive, onClick: handleDigitalTwinClick },
    { icon: ShieldAlert, label: 'Diagnostics', active: isDiagnosticsActive, onClick: handleDiagnosticsClick },
    { 
      icon: BellRing, 
      label: 'Alarm Center', 
      active: isAlarmsActive, 
      badge: activeIncidentCount > 0 ? activeIncidentCount : undefined,
      onClick: handleAlarmCenterClick 
    },
    { icon: BarChart3, label: 'Historical Audit', active: isAuditActive, onClick: handleAuditClick },
    { icon: Database, label: 'Scenario Catalog', active: isCatalogActive, onClick: handleCatalogClick },
    { icon: Settings, label: 'Settings', active: false, onClick: () => {} },
  ];

  return (
    <aside className="w-64 bg-scada-panel border-r border-scada-border flex flex-col shrink-0 h-full">
      <div className="flex-1 py-6 flex flex-col gap-2 px-3">
        <h2 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Modules</h2>
        
        {navItems.map((item, idx) => (
          <button
            key={idx}
            onClick={item.onClick}
            className={`flex items-center justify-between w-full px-3 py-2.5 rounded-md transition-colors ${
              item.active 
                ? 'bg-scada-accent/10 text-scada-accent border border-scada-accent/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-red-500 text-slate-950 animate-pulse">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-scada-border bg-slate-900/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
            OP
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium text-slate-200">Operator 01</span>
            <span className="text-xs text-slate-500">Net1 Facility</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
