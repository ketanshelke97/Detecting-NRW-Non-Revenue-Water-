import { useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SensorNode } from './SensorNode';
import { useScadaStore } from '../../store/scadaStore';

const nodeTypes = {
  sensorNode: SensorNode,
};

interface TopologyNode {
  id: string;
  type: string;
  label?: string;
  x: number;
  y: number;
}

interface TopologyLink {
  source: string;
  target: string;
  type?: string;
  id?: string;
  label?: string;
}

interface TopologyData {
  nodes: TopologyNode[];
  links: TopologyLink[];
}

interface DigitalTwinMapProps {
  data: TopologyData;
}

export function DigitalTwinMap({ data }: DigitalTwinMapProps) {
  const isolatedZoneNodes = useScadaStore((state) => state.isolatedZoneNodes);

  // Map nodes with positions and labels
  const nodes: Node[] = useMemo(() => {
    return data.nodes.map((n) => {
      let label = `Node ${n.id}`;
      if (n.type === 'reservoir' || n.id === '9') label = 'Reservoir 9';
      else if (n.type === 'tank' || n.id === '2') label = 'Tank 2';
      else if (n.label) label = n.label;

      return {
        id: n.id,
        type: 'sensorNode',
        position: { x: (n.x + 30) * 2.4, y: (n.y + 30) * 2.2 },
        data: { 
          label,
          nodeType: n.type,
          isSensor: n.type === 'sensor' || n.type === 'tank' || n.type === 'reservoir',
        },
      };
    });
  }, [data]);

  // Map edges with dynamic orthogonal connection handles and specialized styles
  const edges: Edge[] = useMemo(() => {
    return data.links.map((link, idx) => {
      const isPump = link.type === 'pump' || (link.source === '9' && link.target === '10');
      const isTankTrunk = (link.source === '2' && link.target === '12') || link.id === 'PIPE-110';

      // Determine if edge is part of isolated zone
      const isIsolated = isolatedZoneNodes.length > 0 && 
                         isolatedZoneNodes.includes(link.source) && 
                         isolatedZoneNodes.includes(link.target);
      
      const isDimmed = isolatedZoneNodes.length > 0 && !isIsolated;

      // Color scheme: Pump = Violet, Tank = Cyan, Isolated = Amber, Default = Scada Blue
      const strokeColor = isIsolated ? '#f59e0b' : isDimmed ? '#334155' : isPump ? '#a855f7' : isTankTrunk ? '#06b6d4' : '#0ea5e9';
      const strokeWidth = isIsolated ? 5 : isDimmed ? 1 : isPump ? 4 : 3;

      // Dynamically select best handles for straight orthogonal lines
      const sourceNode = data.nodes.find((n) => n.id === link.source);
      const targetNode = data.nodes.find((n) => n.id === link.target);

      let sourceHandle = 'bottom-source';
      let targetHandle = 'top-target';

      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;

        if (Math.abs(dx) >= Math.abs(dy)) {
          // Horizontal flow
          if (dx >= 0) {
            sourceHandle = 'right-source';
            targetHandle = 'left-target';
          } else {
            sourceHandle = 'left-source';
            targetHandle = 'right-target';
          }
        } else {
          // Vertical flow
          if (dy >= 0) {
            sourceHandle = 'bottom-source';
            targetHandle = 'top-target';
          } else {
            sourceHandle = 'top-source';
            targetHandle = 'bottom-target';
          }
        }
      }

      const edgeLabel = isPump ? '⚡ Pump 9' : isTankTrunk ? 'Pipe 110 (Tank Feed)' : undefined;

      return {
        id: `e-${link.source}-${link.target}-${idx}`,
        source: link.source,
        target: link.target,
        sourceHandle,
        targetHandle,
        animated: !isDimmed,
        label: edgeLabel,
        labelStyle: { 
          fill: isPump ? '#e9d5ff' : '#a5f3fc', 
          fontSize: 10, 
          fontFamily: 'monospace', 
          fontWeight: 700 
        },
        labelBgStyle: { 
          fill: '#0f172a', 
          fillOpacity: 0.9, 
          rx: 4, 
          ry: 4 
        },
        style: { stroke: strokeColor, strokeWidth },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
      };
    });
  }, [data, isolatedZoneNodes]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow 
        nodes={nodes} 
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        attributionPosition="bottom-left"
        minZoom={0.2}
        maxZoom={4}
      >
        <Background color="#1e293b" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
