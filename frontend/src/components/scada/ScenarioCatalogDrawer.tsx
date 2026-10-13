import { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  RotateCcw, 
  Play, 
  Activity, 
  MapPin, 
  Gauge, 
  Flame, 
  Droplet,
  Layers
} from 'lucide-react';
import { useScadaStore } from '../../store/scadaStore';
import { useScadaStream } from '../../hooks/useScadaStream';
import { fetchScenarios, selectScenarioApi, type ScenarioItem } from '../../services/api';

export function ScenarioCatalogDrawer() {
  const isScenarioCatalogOpen = useScadaStore((state) => state.isScenarioCatalogOpen);
  const setIsScenarioCatalogOpen = useScadaStore((state) => state.setIsScenarioCatalogOpen);
  const activeScenarioId = useScadaStore((state) => state.activeScenarioId);
  const setActiveScenarioMetadata = useScadaStore((state) => state.setActiveScenarioMetadata);
  const setSimulationMode = useScadaStore((state) => state.setSimulationMode);
  
  const { loadScenario } = useScadaStream();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [limit, setLimit] = useState(40);
  
  // Data State
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [synonymMatch, setSynonymMatch] = useState<string | null>(null);
  const [availableNodes, setAvailableNodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingScenarioId, setLoadingScenarioId] = useState<string | null>(null);

  // Load scenarios from backend
  const loadCatalogData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchScenarios({
        q: searchQuery || undefined,
        leak_type: selectedType !== 'all' ? selectedType : undefined,
        node_id: selectedNode !== 'all' ? selectedNode : undefined,
        severity: selectedSeverity !== 'all' ? selectedSeverity : undefined,
        limit,
        offset: 0,
      });

      setScenarios(data.scenarios);
      setTotalCount(data.total);
      setSynonymMatch(data.synonym_matched || null);
      if (data.nodes_available && data.nodes_available.length > 0) {
        setAvailableNodes(data.nodes_available);
      }
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isScenarioCatalogOpen) {
      const timeout = setTimeout(() => {
        loadCatalogData();
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [isScenarioCatalogOpen, searchQuery, selectedType, selectedNode, selectedSeverity, limit]);

  // Handle Scenario Selection
  const handleSelectScenario = async (scen: ScenarioItem) => {
    setLoadingScenarioId(scen.id);
    try {
      // 1. Prepare on backend
      await selectScenarioApi(scen.id);
      
      // 2. Load into WebSocket stream
      loadScenario(scen.id);
      
      // 3. Update store
      setActiveScenarioMetadata(scen);
      setSimulationMode('historical');
      
      // 4. Close drawer after short moment
      setTimeout(() => {
        setLoadingScenarioId(null);
        setIsScenarioCatalogOpen(false);
      }, 350);
    } catch (err) {
      console.error('Failed to select scenario:', err);
      setLoadingScenarioId(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedNode('all');
    setSelectedSeverity('all');
    setLimit(40);
  };

  const synonymSuggestions = [
    { label: '💥 Pipe Burst', query: 'pipe burst' },
    { label: '💧 Slow Leak', query: 'slow leak' },
    { label: '📍 Node 12 Burst', query: 'pipe burst node 12' },
    { label: '📍 Node 31 Leak', query: 'slow leak node 31' },
    { label: '🔥 Severe Rupture', query: 'severe' },
  ];

  if (!isScenarioCatalogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={() => setIsScenarioCatalogOpen(false)}
      />

      {/* Drawer Panel */}
      <div className="relative w-full sm:w-[560px] md:w-[650px] bg-scada-panel/95 backdrop-blur-xl border-l border-scada-border/80 shadow-2xl h-full flex flex-col z-10 transition-transform duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-scada-border/60 bg-scada-bg/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-scada-accent/10 border border-scada-accent/30 flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.25)]">
              <Database className="w-5 h-5 text-scada-accent" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-100 tracking-tight">Scenario Lab Catalog</h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-scada-accent/20 text-scada-accent border border-scada-accent/40">
                  {totalCount} Benchmarks
                </span>
              </div>
              <p className="text-xs text-slate-400">Search & load LeakDB simulation incidents into the Digital Twin</p>
            </div>
          </div>

          <button 
            onClick={() => setIsScenarioCatalogOpen(false)}
            className="p-2 rounded-lg bg-scada-bg hover:bg-slate-800 text-slate-400 hover:text-white border border-scada-border transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Synonym Bar */}
        <div className="p-5 border-b border-scada-border/40 bg-scada-panel/40 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by keywords e.g. 'pipe burst', 'slow leak', 'node 12'..."
              className="w-full bg-scada-bg/90 border border-scada-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-scada-accent focus:ring-1 focus:ring-scada-accent transition-all font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Synonym Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center">
              <Sparkles className="w-3 h-3 mr-1 text-scada-accent" /> Quick:
            </span>
            {synonymSuggestions.map((item) => (
              <button
                key={item.label}
                onClick={() => setSearchQuery(item.query)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                  searchQuery === item.query
                    ? 'bg-scada-accent text-slate-900 font-bold shadow-[0_0_8px_rgba(14,165,233,0.5)]'
                    : 'bg-scada-bg text-slate-300 hover:text-white hover:bg-slate-800 border border-scada-border'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Synonym match alert */}
          {synonymMatch && (
            <div className="flex items-center space-x-2 text-xs font-mono text-scada-accent bg-scada-accent/10 border border-scada-accent/30 rounded-lg px-3 py-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Smart Semantic Mapping: <strong className="text-white">{synonymMatch}</strong></span>
            </div>
          )}
        </div>

        {/* Multi-Attribute Filter Deck */}
        <div className="px-5 py-3 border-b border-scada-border/40 bg-scada-bg/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Type Filter */}
          <div className="flex items-center space-x-1 bg-scada-panel p-1 rounded-lg border border-scada-border">
            {[
              { id: 'all', label: 'All' },
              { id: 'abrupt', label: '💥 Abrupt' },
              { id: 'incipient', label: '💧 Incipient' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all ${
                  selectedType === t.id
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Target Node Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Node:</span>
            <select
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              className="bg-scada-bg border border-scada-border text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-scada-accent font-mono"
            >
              <option value="all">All Monitored Nodes</option>
              {availableNodes.map((n) => (
                <option key={n} value={n}>Node {n}</option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Severity:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-scada-bg border border-scada-border text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-scada-accent font-mono"
            >
              <option value="all">All Severities</option>
              <option value="Severe">Severe (&gt;60mm)</option>
              <option value="Moderate">Moderate (30-60mm)</option>
              <option value="Minor">Minor (&lt;30mm)</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(searchQuery || selectedType !== 'all' || selectedNode !== 'all' || selectedSeverity !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 underline ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Results Counter */}
        <div className="px-5 py-2 text-xs text-slate-400 font-mono flex items-center justify-between border-b border-scada-border/20 bg-scada-panel/20">
          <span>Displaying {scenarios.length} of {totalCount} matching scenarios</span>
          {activeScenarioId && (
            <span className="text-emerald-400 font-semibold flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active: {activeScenarioId}
            </span>
          )}
        </div>

        {/* Scenario List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {isLoading && scenarios.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-scada-bg/60 border border-scada-border animate-pulse p-4" />
              ))}
            </div>
          ) : scenarios.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-scada-border/60 rounded-xl bg-scada-bg/20">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-200 mb-1">No Matching Scenarios Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                No incidents match your current search and filter criteria. Try clearing search keywords or resetting node filters.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-lg bg-scada-accent/10 border border-scada-accent/30 text-scada-accent text-xs font-semibold hover:bg-scada-accent/20 transition-all"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            scenarios.map((scen) => {
              const isCurrentlyActive = activeScenarioId === scen.id;
              const isAbrupt = scen.type === 'abrupt';
              const isLoadingThis = loadingScenarioId === scen.id;

              return (
                <div
                  key={scen.id}
                  className={`relative rounded-xl border p-4 transition-all duration-200 ${
                    isCurrentlyActive
                      ? 'bg-slate-900/90 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
                      : 'bg-scada-bg/70 hover:bg-scada-bg border-scada-border hover:border-slate-700 shadow-md'
                  }`}
                >
                  {/* Top Row: Name, Type Badge, Active Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-slate-100 font-mono tracking-tight">{scen.name}</h4>
                      {scen.is_default && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          BENCHMARK
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {isCurrentlyActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> LOADED
                        </span>
                      ) : null}

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          scen.type_label === 'Compound Incident'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : isAbrupt
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {scen.type_label === 'Compound Incident' ? (
                          <Layers className="w-3 h-3 mr-1" />
                        ) : isAbrupt ? (
                          <Flame className="w-3 h-3 mr-1" />
                        ) : (
                          <Droplet className="w-3 h-3 mr-1" />
                        )}
                        {scen.type_label}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Metrics chips */}
                  <div className="grid grid-cols-3 gap-2 my-2.5 text-xs font-mono">
                    <div className="bg-scada-panel/80 p-2 rounded-lg border border-scada-border/60 flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-scada-accent shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-sans">
                          {scen.nodes && scen.nodes.length > 1 ? 'Junctions' : 'Junction'}
                        </div>
                        <div className="font-bold text-slate-200">
                          {scen.nodes && scen.nodes.length > 1 ? `Nodes ${scen.nodes.join(', ')}` : `Node ${scen.node_id}`}
                        </div>
                      </div>
                    </div>

                    <div className="bg-scada-panel/80 p-2 rounded-lg border border-scada-border/60 flex items-center space-x-1.5">
                      <Gauge className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-sans">Diameter</div>
                        <div className="font-bold text-slate-200">{scen.diameter_mm} mm</div>
                      </div>
                    </div>

                    <div className="bg-scada-panel/80 p-2 rounded-lg border border-scada-border/60 flex items-center space-x-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-sans">Severity</div>
                        <div className="font-bold text-slate-200">{scen.severity}</div>
                      </div>
                    </div>
                  </div>

                  {/* Description & Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-scada-border/40 mt-3">
                    <p className="text-xs text-slate-400 truncate max-w-[340px]">
                      {scen.description}
                    </p>

                    <button
                      onClick={() => handleSelectScenario(scen)}
                      disabled={isCurrentlyActive || isLoadingThis}
                      className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${
                        isCurrentlyActive
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : isLoadingThis
                          ? 'bg-scada-accent/20 text-scada-accent border border-scada-accent animate-pulse cursor-wait'
                          : 'bg-scada-accent hover:bg-sky-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                      }`}
                    >
                      {isCurrentlyActive ? (
                        <>Active in Twin</>
                      ) : isLoadingThis ? (
                        <>Loading...</>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                          Load Scenario
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Load More Button */}
          {scenarios.length < totalCount && (
            <div className="text-center pt-3 pb-2">
              <button
                onClick={() => setLimit((prev) => prev + 40)}
                className="px-5 py-2 rounded-lg bg-scada-bg hover:bg-slate-800 text-slate-300 hover:text-white border border-scada-border text-xs font-mono font-semibold transition-all shadow-sm"
              >
                Load More Scenarios ({totalCount - scenarios.length} remaining)
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-scada-border/60 bg-scada-bg/80 flex items-center justify-between text-xs font-mono text-slate-400 shrink-0">
          <span>LeakDB EPANET Benchmark Suite</span>
          <button
            onClick={() => setIsScenarioCatalogOpen(false)}
            className="text-slate-300 hover:text-white font-semibold underline text-xs"
          >
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
}
