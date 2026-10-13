import { useState, useEffect } from 'react';
import { useScadaStore } from '../../store/scadaStore';
import { useScadaStream } from '../../hooks/useScadaStream';

const ALL_NODES = ['2','9','10','11','12','13','21','22','23','31','32','33'];

const NODE_LABELS: Record<string, string> = {
  '2':  'J-2  (Central Dist.)',
  '9':  'J-9  (Reservoir Outlet)',
  '10': 'J-10 (Northern Loop)',
  '11': 'J-11 (Northern Spur)',
  '12': 'J-12 (Tank Feed)',
  '13': 'J-13 (Eastern Branch)',
  '21': 'J-21 (Industrial Sec.)',
  '22': 'J-22 (Southern Ring)',
  '23': 'J-23 (Southern Tail)',
  '31': 'J-31 (Western Arc)',
  '32': 'J-32 (Western Loop)',
  '33': 'J-33 (Dead End)',
};

const SEVERITY_PRESETS = [
  { label: 'Pinhole',  diameter: 5   },
  { label: 'Minor',    diameter: 15  },
  { label: 'Moderate', diameter: 35  },
  { label: 'Major',    diameter: 60  },
  { label: 'Severe',   diameter: 100 },
];

export function FaultInjectionPanel() {
  const isOpen = useScadaStore((s) => s.isFaultInjectionPanelOpen);
  const setIsOpen = useScadaStore((s) => s.setIsFaultInjectionPanelOpen);
  const activeFault = useScadaStore((s) => s.activeFault);
  const latestInference = useScadaStore((s) => s.latestInference);

  const { sendInjectFault, sendClearFault } = useScadaStream();

  const [selectedNode, setSelectedNode] = useState('21');
  const [leakType, setLeakType] = useState<'abrupt' | 'incipient'>('abrupt');
  const [diameterMm, setDiameterMm] = useState(25);
  const [injected, setInjected] = useState(false);

  useEffect(() => {
    setInjected(activeFault !== null);
  }, [activeFault]);

  if (!isOpen) return null;

  const handleInject = () => {
    sendInjectFault(selectedNode, leakType, diameterMm);
    setInjected(true);
  };

  const handleClear = () => {
    sendClearFault();
    setInjected(false);
  };

  const isDetected = latestInference?.status === 'LEAK_DETECTED';
  const topNode = latestInference?.localization?.[0];
  const detectionMatches = isDetected && topNode?.node_id === selectedNode;

  // Torricelli estimate for display
  const Cd = 0.65, g = 9.81, H = 52;
  const r = (diameterMm / 1000) / 2;
  const area = Math.PI * r * r;
  const q_m3s = Cd * area * Math.sqrt(2 * g * H);
  const lph = q_m3s * 1000 * 3600;
  const inrPerHour = lph * 0.025;

  const accentColor = injected ? '#f87171' : '#06b6d4';
  const accentBg   = injected ? 'rgba(239,68,68,0.15)' : 'rgba(6,182,212,0.12)';

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={() => setIsOpen(false)}
      />

      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, width: '100%', maxWidth: 780, padding: '0 16px 16px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(10,18,40,0.98) 0%, rgba(15,25,50,0.98) 100%)',
          border: `1px solid ${injected ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.25)'}`,
          boxShadow: `0 -8px 60px ${injected ? 'rgba(239,68,68,0.12)' : 'rgba(6,182,212,0.10)'}`,
          backdropFilter: 'blur(24px)',
          borderRadius: '16px 16px 10px 10px',
          overflow: 'hidden',
          transition: 'border-color 0.4s, box-shadow 0.4s',
        }}>
          {/* Glow strip */}
          <div style={{
            height: 2,
            background: injected
              ? 'linear-gradient(90deg, transparent, #ef4444, #f87171, #ef4444, transparent)'
              : 'linear-gradient(90deg, transparent, #06b6d4, #3b82f6, #06b6d4, transparent)',
          }} />

          <div style={{ padding: '18px 20px' }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: accentBg,
                  border: `1px solid ${accentColor}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  {injected ? '🔴' : '🧪'}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: injected ? '#f87171' : '#e2e8f0', letterSpacing: '0.04em' }}>
                    {injected ? '⚠ FAULT ACTIVE — MONITORING' : 'Fault Injection Lab'}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    Physics-based pressure overlay → Real ML pipeline
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#64748b', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            {/* ── 3-column grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

              {/* Column 1: Node + Type */}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
                  Injection Node
                </div>
                <select
                  value={selectedNode}
                  onChange={(e) => setSelectedNode(e.target.value)}
                  disabled={injected}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(99,179,237,0.2)',
                    borderRadius: 8, color: '#e2e8f0',
                    fontSize: 12, padding: '8px 10px', outline: 'none',
                    opacity: injected ? 0.55 : 1,
                    cursor: injected ? 'not-allowed' : 'pointer',
                  }}
                >
                  {ALL_NODES.map((n) => (
                    <option key={n} value={n} style={{ background: '#0f172a' }}>
                      {NODE_LABELS[n] || `Node ${n}`}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: 14, marginBottom: 6 }}>
                  Leak Type
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['abrupt', 'incipient'] as const).map((t) => {
                    const active = leakType === t;
                    const col = t === 'abrupt' ? '#f87171' : '#fbbf24';
                    return (
                      <button
                        key={t}
                        onClick={() => !injected && setLeakType(t)}
                        disabled={injected}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: 8,
                          fontSize: 11, fontWeight: 600, cursor: injected ? 'not-allowed' : 'pointer',
                          border: active ? `1px solid ${col}` : '1px solid rgba(255,255,255,0.1)',
                          background: active ? `${col}22` : 'rgba(255,255,255,0.04)',
                          color: active ? col : '#64748b',
                          opacity: injected ? 0.55 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        {t === 'abrupt' ? '⚡ Abrupt' : '🌊 Incipient'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: Diameter */}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
                  Diameter — <span style={{ color: '#06b6d4', fontFamily: 'monospace' }}>{diameterMm} mm</span>
                </div>
                <input
                  type="range" min={5} max={120} value={diameterMm}
                  onChange={(e) => !injected && setDiameterMm(Number(e.target.value))}
                  disabled={injected}
                  style={{ width: '100%', accentColor: '#06b6d4', opacity: injected ? 0.5 : 1, cursor: injected ? 'not-allowed' : 'pointer', marginBottom: 4 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginBottom: 10 }}>
                  <span>5mm</span><span>120mm</span>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {SEVERITY_PRESETS.map((p) => {
                    const sel = diameterMm === p.diameter;
                    return (
                      <button
                        key={p.label}
                        onClick={() => !injected && setDiameterMm(p.diameter)}
                        disabled={injected}
                        style={{
                          padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                          border: sel ? '1px solid rgba(6,182,212,0.6)' : '1px solid rgba(255,255,255,0.1)',
                          background: sel ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.04)',
                          color: sel ? '#06b6d4' : '#64748b',
                          cursor: injected ? 'not-allowed' : 'pointer',
                          opacity: injected ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column 3: Physics + Button */}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
                  Estimated Loss (Torricelli)
                </div>
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, padding: '10px 12px', marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Flow rate</span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#06b6d4', fontWeight: 700 }}>
                      {lph.toFixed(0)} L/h
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Financial loss</span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#f59e0b', fontWeight: 700 }}>
                      ₹{inrPerHour.toFixed(0)}/hr
                    </span>
                  </div>
                </div>

                {!injected ? (
                  <button onClick={handleInject} style={{
                    width: '100%', padding: '11px', borderRadius: 10,
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                    background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
                  }}>
                    ⚡ INJECT FAULT
                  </button>
                ) : (
                  <button onClick={handleClear} style={{
                    width: '100%', padding: '11px', borderRadius: 10,
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
                  }}>
                    ✅ CLEAR FAULT
                  </button>
                )}
              </div>
            </div>

            {/* ── AI Detection Result Banner ── */}
            {injected && (
              <div style={{
                marginTop: 14, borderRadius: 10, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                background: isDetected ? 'rgba(239,68,68,0.10)' : 'rgba(99,179,237,0.05)',
                border: isDetected ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,179,237,0.15)',
                transition: 'all 0.5s',
              }}>
                <span style={{ fontSize: 22 }}>{isDetected ? '🚨' : '🔄'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isDetected ? '#f87171' : '#94a3b8' }}>
                    {isDetected ? 'LEAK DETECTED BY AI ENGINE' : 'Awaiting AI Detection…'}
                  </div>
                  {isDetected && topNode && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Top candidate:{' '}
                      <span style={{ color: '#06b6d4', fontWeight: 700 }}>Node {topNode.node_id}</span>
                      {' '}— {(topNode.probability * 100).toFixed(1)}% confidence
                      {detectionMatches && (
                        <span style={{ marginLeft: 8, color: '#4ade80', fontWeight: 700 }}>
                          ✓ Correct node matched!
                        </span>
                      )}
                    </div>
                  )}
                  {isDetected && latestInference?.diameter_mm !== undefined && (
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      Est. diameter:{' '}
                      <span style={{ color: '#fbbf24' }}>{latestInference.diameter_mm}mm</span>
                      {' '}· Water loss:{' '}
                      <span style={{ color: '#06b6d4' }}>{latestInference.loss?.liters_per_hour.toFixed(0)} L/h</span>
                      {' '}· ₹{latestInference.loss?.financial_loss_inr_per_hour.toFixed(0)}/hr
                    </div>
                  )}
                </div>
                <div style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.08em',
                  background: isDetected ? 'rgba(239,68,68,0.2)' : 'rgba(99,179,237,0.1)',
                  color: isDetected ? '#f87171' : '#93c5fd',
                  border: isDetected ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,179,237,0.2)',
                }}>
                  {isDetected ? (latestInference?.dynamics || 'LEAK') : 'ANALYZING'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
