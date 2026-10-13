import React from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  RotateCcw, 
  Radio, 
  History, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Gauge,
  Database,
  FolderOpen,
  Zap
} from 'lucide-react';
import { useScadaStore } from '../../store/scadaStore';
import { useScadaStream } from '../../hooks/useScadaStream';

export function SimulationToolbar() {
  const { 
    sendPlay, 
    sendPause, 
    sendStep, 
    sendSeek, 
    sendSpeed, 
    sendMode, 
    sendReset,
    scrubToDvrIndex,
    returnToLive,
    isConnected
  } = useScadaStream();

  const isLiveStreamActive = useScadaStore((state) => state.isLiveStreamActive);
  const isPlaybackPaused = useScadaStore((state) => state.isPlaybackPaused);
  const playbackSpeed = useScadaStore((state) => state.playbackSpeed);
  const simulationMode = useScadaStore((state) => state.simulationMode);
  const currentStepIndex = useScadaStore((state) => state.currentStepIndex);
  const totalStepCount = useScadaStore((state) => state.totalStepCount);
  const currentTimestamp = useScadaStore((state) => state.currentTimestamp);
  const leakStepIndices = useScadaStore((state) => state.leakStepIndices);
  const latestInference = useScadaStore((state) => state.latestInference);
  
  const activeScenarioId = useScadaStore((state) => state.activeScenarioId);
  const activeScenarioMetadata = useScadaStore((state) => state.activeScenarioMetadata);
  const setIsScenarioCatalogOpen = useScadaStore((state) => state.setIsScenarioCatalogOpen);
  const isFaultInjectionPanelOpen = useScadaStore((state) => state.isFaultInjectionPanelOpen);
  const setIsFaultInjectionPanelOpen = useScadaStore((state) => state.setIsFaultInjectionPanelOpen);
  const activeFault = useScadaStore((state) => state.activeFault);

  // Live DVR state
  const telemetryHistory = useScadaStore((state) => state.telemetryHistory);
  const isLiveDvrMode = useScadaStore((state) => state.isLiveDvrMode);
  const dvrScrubIndex = useScadaStore((state) => state.dvrScrubIndex);

  const isLeakCurrentlyDetected = latestInference?.status === 'LEAK_DETECTED';
  const maxLeakStep = leakStepIndices.length > 0 ? Math.max(...leakStepIndices) : -1;
  const minLeakStep = leakStepIndices.length > 0 ? Math.min(...leakStepIndices) : -1;
  const isPostRepair = maxLeakStep >= 0 && currentStepIndex > maxLeakStep;
  const isPreIncident = minLeakStep >= 0 && currentStepIndex < minLeakStep;
  const repairStepIndex = maxLeakStep >= 0 ? maxLeakStep + 1 : -1;
  const speedOptions = [1, 5, 20, 100];

  const handlePlayPause = () => {
    if (isLiveDvrMode) {
      returnToLive();
      return;
    }
    if (!isLiveStreamActive) {
      sendPlay();
    } else if (isPlaybackPaused) {
      sendPlay();
    } else {
      sendPause();
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (simulationMode === 'live') {
      if (val >= telemetryHistory.length - 1) {
        returnToLive();
      } else {
        scrubToDvrIndex(val);
      }
    } else {
      sendSeek(val);
    }
  };

  const handleModeChange = (mode: 'live' | 'historical') => {
    sendMode(mode);
    if (mode === 'historical') {
      setIsScenarioCatalogOpen(true);
    }
  };

  // Compute percentage progress for timeline slider styling
  const liveMax = Math.max(1, telemetryHistory.length - 1);
  const currentLivePos = isLiveDvrMode ? (dvrScrubIndex ?? liveMax) : liveMax;
  const progressPercent = simulationMode === 'live'
    ? (currentLivePos / liveMax) * 100
    : totalStepCount > 1 
      ? (currentStepIndex / (totalStepCount - 1)) * 100 
      : 0;

  return (
    <div className="bg-scada-panel/90 backdrop-blur-md border border-scada-border/80 rounded-xl p-4 shadow-2xl mb-5 transition-all">
      {/* Top Deck: Modes, Media Controls, and Speed Multipliers */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-scada-border/40">
        
        {/* Left: Dual Mode Switcher & Active Scenario */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-scada-bg/80 p-1 rounded-lg border border-scada-border">
            <button
              onClick={() => handleModeChange('live')}
              className={`flex items-center px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all ${
                simulationMode === 'live'
                  ? 'bg-scada-accent/20 border border-scada-accent text-scada-accent shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 mr-1.5 animate-pulse text-scada-accent" />
              LIVE SCADA
            </button>
            <button
              onClick={() => handleModeChange('historical')}
              className={`flex items-center px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all ${
                simulationMode === 'historical'
                  ? 'bg-purple-500/20 border border-purple-500 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              SCENARIO LAB
            </button>
          </div>

          {/* Active Status Indicator */}
          {simulationMode === 'live' ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono text-emerald-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-bold tracking-wide">
                {activeFault ? `⚡ FAULT OVERLAY (N${activeFault.node_id})` : '🟢 LIVE NOMINAL GRID'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setIsScenarioCatalogOpen(true)}
              title="Browse Scenario Catalog"
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-scada-bg/90 hover:bg-slate-800 border border-scada-border hover:border-purple-500/50 text-xs font-mono text-slate-200 transition-all shadow-sm group"
            >
              <Database className="w-3.5 h-3.5 text-purple-400 group-hover:text-scada-accent transition-colors" />
              <span className="text-slate-400 font-sans hidden sm:inline">Incident:</span>
              <span className="font-bold text-white group-hover:text-scada-accent transition-colors">
                {activeScenarioMetadata?.id || activeScenarioId || 'Catalog'}
              </span>
              {activeScenarioMetadata?.node_id && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  Node {activeScenarioMetadata.node_id}
                </span>
              )}
              <FolderOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors ml-1" />
            </button>
          )}
        </div>

        {/* Center: Primary Playback Controls */}
        <div className="flex items-center space-x-3">
          {/* Rewind / Reset */}
          <button
            onClick={sendReset}
            title="Reset to Beginning (Step 0)"
            className="p-2 rounded-lg bg-scada-bg hover:bg-slate-800 border border-scada-border text-slate-300 hover:text-white transition-all shadow-sm active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Main Play / Pause Button */}
          <button
            onClick={handlePlayPause}
            className={`flex items-center px-5 py-2 rounded-lg font-bold text-sm tracking-wide transition-all shadow-lg active:scale-95 ${
              !isLiveStreamActive || isPlaybackPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.35)]'
            }`}
          >
            {!isLiveStreamActive || isPlaybackPaused ? (
              <>
                <Play className="w-4 h-4 mr-2 fill-current" />
                PLAY
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2 fill-current" />
                PAUSE
              </>
            )}
          </button>

          {/* Step Next (+1) Button */}
          <button
            onClick={sendStep}
            title="Step Forward (+1 Timestep)"
            className="flex items-center px-3 py-2 rounded-lg bg-scada-bg hover:bg-slate-800 border border-scada-border text-slate-200 hover:text-white transition-all shadow-sm active:scale-95 text-xs font-semibold"
          >
            <SkipForward className="w-4 h-4 mr-1.5 text-scada-accent" />
            STEP +1
          </button>
        </div>

        {/* Right: Speed Multipliers */}
        <div className="flex items-center space-x-1.5 bg-scada-bg/80 p-1 rounded-lg border border-scada-border">
          <div className="flex items-center px-2 py-1 text-slate-400">
            <Gauge className="w-3.5 h-3.5 mr-1" />
            <span className="text-[11px] font-mono uppercase tracking-wider">Speed</span>
          </div>
          {speedOptions.map((spd) => (
            <button
              key={spd}
              onClick={() => sendSpeed(spd)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                playbackSpeed === spd
                  ? 'bg-scada-accent text-slate-900 shadow-[0_0_10px_rgba(14,165,233,0.5)]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Fault Lab Trigger Button */}
        <button
          onClick={() => setIsFaultInjectionPanelOpen(!isFaultInjectionPanelOpen)}
          title="Open Fault Injection Lab"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider transition-all shadow-sm active:scale-95 border"
          style={{
            background: activeFault
              ? 'rgba(239,68,68,0.18)'
              : isFaultInjectionPanelOpen
              ? 'rgba(239,68,68,0.12)'
              : 'rgba(255,255,255,0.04)',
            border: activeFault
              ? '1px solid rgba(239,68,68,0.5)'
              : isFaultInjectionPanelOpen
              ? '1px solid rgba(239,68,68,0.35)'
              : '1px solid rgba(99,179,237,0.25)',
            color: activeFault ? '#f87171' : isFaultInjectionPanelOpen ? '#fca5a5' : '#94a3b8',
            boxShadow: activeFault ? '0 0 12px rgba(239,68,68,0.25)' : 'none',
          }}
        >
          <Zap className="w-3.5 h-3.5" style={{ fill: activeFault ? '#f87171' : 'none' }} />
          <span>{activeFault ? `FAULT: N${activeFault.node_id}` : 'FAULT LAB'}</span>
        </button>

      </div>

      {/* Bottom Deck: Timeline Scrubber with Leak Event Marker Annotations */}
      <div className="pt-3">
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          {/* Timestamp Indicator */}
          <div className="flex items-center space-x-2 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-scada-accent" />
            <span className="text-slate-400">Timestamp:</span>
            <span className="font-semibold text-slate-100 bg-scada-bg px-2 py-0.5 rounded border border-scada-border">
              {currentTimestamp || '2023-08-01 00:00:00'}
            </span>
          </div>

          {/* Center: Live Diagnostic Indicator or DVR return button */}
          <div className="flex items-center space-x-2">
            {simulationMode === 'live' && isLiveDvrMode ? (
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-amber-400 animate-pulse" />
                  TIME MACHINE (REWOUND)
                </span>
                <button
                  onClick={returnToLive}
                  className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400 text-[11px] font-bold flex items-center gap-1 hover:bg-cyan-500 hover:text-slate-900 transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)] animate-bounce"
                >
                  <Radio className="w-3 h-3 text-cyan-300 animate-pulse" />
                  RETURN TO LIVE 🔴
                </button>
              </div>
            ) : isLeakCurrentlyDetected ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                <AlertTriangle className="w-3 h-3 mr-1 text-red-400" />
                ANOMALY ACTIVE: {latestInference?.localization?.[0]?.node_id ? `NODE ${latestInference.localization[0].node_id}` : 'HYDRAULIC DROP'}
              </span>
            ) : isPostRepair ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-[0_0_10px_rgba(20,184,166,0.25)]">
                <CheckCircle2 className="w-3 h-3 mr-1 text-teal-400" />
                REPAIR COMPLETED: HYDRAULIC RECOVERY (VALVES SECURED)
              </span>
            ) : isPreIncident ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                PRE-INCIDENT NOMINAL BASELINE
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                {simulationMode === 'live' ? 'LIVE EPANET STREAM: NOMINAL' : 'PRESSURE BASELINE NOMINAL'}
              </span>
            )}
          </div>

          {/* Step / Sliding Window Counter */}
          <div className="text-slate-400">
            {simulationMode === 'live' ? (
              <span>
                Sliding Window: <span className="text-scada-accent font-bold">{telemetryHistory.length}</span> / 120 steps
              </span>
            ) : (
              <span>
                Step <span className="text-scada-accent font-bold">{currentStepIndex + 1}</span> of{' '}
                <span className="text-slate-200">{totalStepCount}</span>
              </span>
            )}
          </div>
        </div>

        {/* Scrubber Bar Container */}
        <div className="relative flex items-center group py-1">
          {/* Background Track with Leak Annotations */}
          <div className="absolute w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 pointer-events-none">
            {/* Active Playback Progress fill */}
            <div 
              className="h-full bg-gradient-to-r from-scada-accent to-blue-500 transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Leak Markers overlay on track (historical mode) */}
            {simulationMode === 'historical' && leakStepIndices.map((leakIdx) => {
              const markerPos = (leakIdx / (totalStepCount - 1)) * 100;
              return (
                <div
                  key={leakIdx}
                  title={`Leak Active at Step ${leakIdx + 1}`}
                  className="absolute top-0 bottom-0 w-1.5 bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.9)]"
                  style={{ left: `${markerPos}%` }}
                />
              );
            })}
            {/* Repair Completed & Hydraulic Recovery Marker */}
            {simulationMode === 'historical' && repairStepIndex >= 0 && repairStepIndex < totalStepCount && (
              <div
                key="repair-marker"
                title={`Repair Completed & Hydrological Recovery begins at Step ${repairStepIndex + 1}`}
                className="absolute top-0 bottom-0 w-2 bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,1)] z-[1]"
                style={{ left: `${(repairStepIndex / (totalStepCount - 1)) * 100}%` }}
              />
            )}
          </div>

          {/* Interactive Range Input Slider */}
          <input
            type="range"
            min={0}
            max={simulationMode === 'live' ? Math.max(1, telemetryHistory.length - 1) : Math.max(0, totalStepCount - 1)}
            value={simulationMode === 'live' ? (isLiveDvrMode ? (dvrScrubIndex ?? (telemetryHistory.length - 1)) : (telemetryHistory.length - 1)) : currentStepIndex}
            onChange={handleSliderChange}
            aria-label="Simulation Timeline Scrubber"
            className="relative w-full h-2.5 bg-transparent appearance-none cursor-pointer focus:outline-none z-10
              [&::-webkit-slider-thumb]:appearance-none 
              [&::-webkit-slider-thumb]:w-4 
              [&::-webkit-slider-thumb]:h-4 
              [&::-webkit-slider-thumb]:rounded-full 
              [&::-webkit-slider-thumb]:bg-white 
              [&::-webkit-slider-thumb]:border-2 
              [&::-webkit-slider-thumb]:border-scada-accent 
              [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(14,165,233,0.8)]
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-125
              [&::-webkit-slider-thumb]:active:scale-110"
          />
        </div>

        {/* Legend under scrubber */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
          <div className="flex items-center space-x-3">
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-scada-accent mr-1 inline-block"></span>
              Timeline Progress
            </span>
            {leakStepIndices.length > 0 && (
              <span className="flex items-center text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-1 inline-block shadow-[0_0_4px_rgba(239,68,68,0.8)]"></span>
                Incident Window (Steps {minLeakStep + 1}–{maxLeakStep + 1})
              </span>
            )}
            {repairStepIndex >= 0 && (
              <span className="flex items-center text-teal-400">
                <span className="w-2 h-2 rounded-full bg-teal-400 mr-1 inline-block shadow-[0_0_4px_rgba(20,184,166,0.8)]"></span>
                Repaired & Recovered (Step {repairStepIndex + 1}+)
              </span>
            )}
          </div>
          <div>
            WebSocket: <span className={isConnected ? "text-emerald-400" : "text-amber-400"}>{isConnected ? "Connected" : "Reconnecting..."}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
