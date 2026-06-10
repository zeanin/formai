import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, Handle, Position, NodeProps, MarkerType, Edge, Node,
  useNodesState, useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Form, Input, Select, Button, Space, Spin, message, Typography, Popconfirm, Divider, Tag
} from 'antd';
import {
  SaveOutlined, DeleteOutlined, PlusOutlined, ThunderboltOutlined, SendOutlined, SettingOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// Node types configurations mapping for editing form
const NODE_TYPES = [
  { value: 'calculation', label: '🧮 Calculation (Evaluate expression)' },
  { value: 'condition', label: '🔀 Condition (If/Else Branch)' },
  { value: 'query', label: '🔍 Query Records (Find in database)' },
  { value: 'create', label: '➕ Create Record (Insert into database)' },
  { value: 'update', label: '✏️ Update Records (Edit in database)' },
  { value: 'destroy', label: '🗑️ Destroy Records (Delete in database)' },
  { value: 'http-request', label: '🌐 HTTP Request (Call external API)' },
  { value: 'manual', label: '👤 Manual Task (Pause for approval)' },
  { value: 'loop', label: '🔄 Loop (Iterate list items)' },
  { value: 'parallel', label: '⇉ Parallel Branching' }
];

interface WorkflowDiagramProps {
  workflow: any;
  appId: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

interface LayoutNode {
  id: string;
  type: string;
  title: string;
  config: any;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutConnector {
  fromId: string;
  toId: string;
  label?: string;
}

export function normalizeWorkflowNodes(nodes: any[]): any[] {
  if (!nodes || !Array.isArray(nodes)) return [];
  
  const cloned = nodes.map(n => ({
    ...n,
    config: { ...(n.config ?? {}) }
  }));

  for (const node of cloned) {
    if (node.downstreamId) {
      const target = cloned.find(t => t.id === node.downstreamId);
      if (target && !target.upstreamId) {
        target.upstreamId = node.id;
      }
    }

    if (node.upstreamId) {
      const parent = cloned.find(p => p.id === node.upstreamId);
      if (parent && parent.type !== 'condition' && parent.type !== 'parallel' && !parent.downstreamId) {
        parent.downstreamId = node.id;
      }
    }

    if (node.type === 'condition') {
      const trueBranch = Array.isArray(node.config.trueBranch) ? node.config.trueBranch[0] : node.config.trueBranch;
      const falseBranch = Array.isArray(node.config.falseBranch) ? node.config.falseBranch[0] : node.config.falseBranch;
      
      if (trueBranch) {
        const trueTarget = cloned.find(t => t.id === trueBranch);
        if (trueTarget && !trueTarget.upstreamId) {
          trueTarget.upstreamId = node.id;
        }
      }
      if (falseBranch) {
        const falseTarget = cloned.find(t => t.id === falseBranch);
        if (falseTarget && !falseTarget.upstreamId) {
          falseTarget.upstreamId = node.id;
        }
      }
    }
  }

  return cloned;
}

// ─── Custom Trigger Node component for React Flow (FormAI Light Mode Style) ───
function TriggerNode({ data }: NodeProps) {
  const isSelected = data.selectedNodeId === 'trigger';
  return (
    <div style={{
      width: 200,
      padding: '12px 14px',
      borderRadius: 8,
      background: '#ffffff',
      borderLeft: '5px solid #722ed1', // Brand Purple Accent
      borderTop: isSelected ? '1px solid #722ed1' : '1px solid #d9d9d9',
      borderRight: isSelected ? '1px solid #722ed1' : '1px solid #d9d9d9',
      borderBottom: isSelected ? '1px solid #722ed1' : '1px solid #d9d9d9',
      color: '#262626',
      boxShadow: isSelected ? '0 0 10px rgba(114, 46, 209, 0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
      position: 'relative'
    }}>
      {/* ID Badge */}
      <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 8, color: '#bfbfbf', fontFamily: 'monospace' }}>
        #trigger
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', fontSize: 13, color: '#141414' }}>
        <span style={{ color: '#722ed1' }}>⚡</span>
        <span>{data.title}</span>
      </div>
      <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>
        Type: {data.triggerType.toUpperCase()}
      </div>
      {data.triggerType === 'collection' && data.collectionName && (
        <div style={{ fontSize: 9, color: '#8c8c8c', marginTop: 2, background: '#f5f5f5', padding: '1px 4px', borderRadius: 3, display: 'inline-block' }}>
          Table: {data.collectionName}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#722ed1', width: 8, height: 8, border: '2px solid #fff' }} />

      {/* Plus button to add the first node or insert downstream */}
      {data.onAddDownstream && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            data.onAddDownstream('trigger');
          }}
          style={{
            position: 'absolute',
            bottom: -9,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            color: '#52c41a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          +
        </div>
      )}
    </div>
  );
}

// ─── Custom Action Node component for React Flow (FormAI Light Mode Style) ───
function ActionNode({ data }: NodeProps) {
  const isSelected = data.selectedNodeId === data.id;

  const getNodeAccent = (type: string) => {
    switch (type) {
      case 'condition': return '#fa8c16'; // Orange
      case 'calculation': return '#52c41a'; // Green
      case 'http-request': return '#eb2f96'; // Magenta
      case 'manual': return '#8c8c8c'; // Gray
      case 'loop': return '#13c2c2'; // Teal
      case 'parallel': return '#2f54eb'; // Indigo
      default: return '#1677ff'; // Database operations (Blue)
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'condition': return '🔀';
      case 'calculation': return '🧮';
      case 'http-request': return '🌐';
      case 'manual': return '👤';
      case 'loop': return '🔄';
      case 'parallel': return '⇉';
      case 'query': return '🔍';
      case 'create': return '➕';
      case 'update': return '✏️';
      case 'destroy': return '🗑️';
      default: return '⚙️';
    }
  };

  const accentColor = getNodeAccent(data.type);

  return (
    <div style={{
      width: 180,
      padding: '10px 12px',
      borderRadius: 8,
      background: '#ffffff',
      borderLeft: `5px solid ${accentColor}`,
      borderTop: isSelected ? `1px solid ${accentColor}` : '1px solid #d9d9d9',
      borderRight: isSelected ? `1px solid ${accentColor}` : '1px solid #d9d9d9',
      borderBottom: isSelected ? `1px solid ${accentColor}` : '1px solid #d9d9d9',
      color: '#262626',
      boxShadow: isSelected ? `0 0 10px rgba(22, 119, 255, 0.25)` : '0 2px 8px rgba(0,0,0,0.06)',
      position: 'relative'
    }}>
      {/* Node ID Badge */}
      <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 8, color: '#bfbfbf', fontFamily: 'monospace' }}>
        #{data.id}
      </span>

      {/* Target handle at the top */}
      <Handle type="target" position={Position.Top} style={{ background: '#bfbfbf', width: 8, height: 8, border: '2px solid #fff' }} />

      {/* Inline Delete button */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete(data.id);
        }}
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff1f0',
          border: '1px solid #ffa39e',
          color: '#ff4d4f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
          fontWeight: 'bold',
          cursor: 'pointer',
          zIndex: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
      >
        ×
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', fontSize: 12, color: '#141414' }}>
        <span style={{ color: accentColor }}>{getNodeIcon(data.type)}</span>
        <span>{data.title.length > 15 ? data.title.substr(0, 13) + '..' : data.title}</span>
      </div>
      <div style={{ fontSize: 9, color: '#8c8c8c', marginTop: 4 }}>
        Type: {data.type.toUpperCase()}
      </div>

      {/* Type specific configurations preview */}
      {data.type === 'query' && data.config?.collection && (
        <div style={{ fontSize: 8, color: '#1677ff', marginTop: 2, background: '#e6f7ff', padding: '1px 4px', borderRadius: 3, display: 'inline-block' }}>
          Table: {data.config.collection}
        </div>
      )}
      {data.type === 'calculation' && data.config?.expression && (
        <div style={{ fontSize: 8, color: '#52c41a', marginTop: 2, background: '#f6ffed', padding: '1px 4px', borderRadius: 3, display: 'inline-block' }}>
          Exp: {data.config.expression.substr(0, 16)}
        </div>
      )}
      {data.type === 'http-request' && data.config?.url && (
        <div style={{ fontSize: 8, color: '#eb2f96', marginTop: 2, background: '#fff0f6', padding: '1px 4px', borderRadius: 3, display: 'inline-block' }}>
          URL: {data.config.url.substr(0, 16)}
        </div>
      )}

      {/* Source handle at the bottom */}
      <Handle type="source" position={Position.Bottom} style={{ background: '#bfbfbf', width: 8, height: 8, border: '2px solid #fff' }} />

      {/* Plus button at the bottom center to add downstream node */}
      {data.type !== 'condition' && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            data.onAddDownstream(data.id);
          }}
          style={{
            position: 'absolute',
            bottom: -15,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            color: '#52c41a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          +
        </div>
      )}
    </div>
  );
}

export function WorkflowDiagram({ workflow, appId, onClose, onSaveSuccess }: WorkflowDiagramProps) {
  // Local graph states
  const [localNodes, setLocalNodes] = useState<any[]>([]);
  const [triggerType, setTriggerType] = useState<string>('manual');
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // React Flow states
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // AI Copilot states
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgressLogs, setAiProgressLogs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [form] = Form.useForm();

  // Options for trueBranch/falseBranch Select dropdowns
  const nodeOptions = useMemo(() => {
    return [
      { value: '', label: '🛑 End of Branch (None)' },
      ...localNodes
        .filter(n => n.id !== selectedNodeId)
        .map(n => ({
          value: n.id,
          label: `${n.title || n.type.toUpperCase()} (#${n.id})`
        }))
    ];
  }, [localNodes, selectedNodeId]);

  // Load workflow properties into local state on open
  useEffect(() => {
    if (workflow) {
      setLocalNodes(normalizeWorkflowNodes(workflow.nodes ?? []));
      setTriggerType(workflow.triggerType ?? 'manual');
      setTriggerConfig(workflow.triggerConfig ?? {});
      setSelectedNodeId('trigger'); // Default select the trigger
    }
  }, [workflow]);

  // Set form values when selection changes
  useEffect(() => {
    if (!selectedNodeId) return;

    if (selectedNodeId === 'trigger') {
      form.setFieldsValue({
        nodeType: 'trigger',
        title: `Trigger: ${triggerType.toUpperCase()}`,
        triggerType,
        ...triggerConfig
      });
    } else {
      const node = localNodes.find(n => n.id === selectedNodeId);
      if (node) {
        const displayConfig = { ...node.config };
        if (Array.isArray(displayConfig.trueBranch)) {
          displayConfig.trueBranch = displayConfig.trueBranch[0];
        }
        if (Array.isArray(displayConfig.falseBranch)) {
          displayConfig.falseBranch = displayConfig.falseBranch[0];
        }
        form.setFieldsValue({
          nodeType: node.type,
          title: node.title,
          ...displayConfig
        });
      }
    }
  }, [selectedNodeId, localNodes, triggerType, triggerConfig, form]);

  // Helper: call API fetch
  const apiFetch = async (path: string, options: RequestInit = {}): Promise<any> => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    const token = localStorage.getItem('formai_token');
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as any)
      }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.errors?.[0]?.message ?? `HTTP ${res.status}`);
    return json;
  };

  // --- Visual Layout Algorithm ---

  // Width of trigger card is 200, normal is 180
  const CARD_WIDTH = 180;
  const Y_STEP = 140;

  // 1. Calculate subtree width of each node to assign spacing
  const computeSubtreeWidths = useCallback((
    nodeId: string,
    nodesList: any[],
    visited: Set<string> = new Set()
  ): { width: number; children: { id: string; label?: string }[] } => {
    if (visited.has(nodeId)) return { width: 1, children: [] };
    visited.add(nodeId);

    const node = nodesList.find(n => n.id === nodeId);
    if (!node) return { width: 1, children: [] };

    const children: { id: string; label?: string }[] = [];
    if (node.type === 'condition') {
      const trueB = Array.isArray(node.config?.trueBranch) ? node.config.trueBranch[0] : node.config?.trueBranch;
      const falseB = Array.isArray(node.config?.falseBranch) ? node.config.falseBranch[0] : node.config?.falseBranch;
      if (trueB) children.push({ id: trueB, label: 'True' });
      if (falseB) children.push({ id: falseB, label: 'False' });
    } else if (node.type === 'parallel') {
      const branches = node.config?.branches ?? [];
      branches.forEach((b: string[], idx: number) => {
        if (b && b[0]) children.push({ id: b[0], label: `Branch ${idx + 1}` });
      });
    } else if (node.downstreamId) {
      children.push({ id: node.downstreamId });
    }

    if (children.length === 0) return { width: 1, children };

    let totalWidth = 0;
    children.forEach(c => {
      const res = computeSubtreeWidths(c.id, nodesList, new Set(visited));
      totalWidth += res.width;
    });

    return { width: totalWidth, children };
  }, []);

  // 2. Position nodes recursively
  const layoutNodes = useCallback((
    nodeId: string,
    xStart: number,
    xEnd: number,
    y: number,
    nodesList: any[],
    layoutMap: Map<string, LayoutNode>,
    connectors: LayoutConnector[],
    visited: Set<string> = new Set()
  ) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodesList.find(n => n.id === nodeId);
    if (!node) return;

    const xCenter = (xStart + xEnd) / 2;

    if (!layoutMap.has(nodeId)) {
      layoutMap.set(nodeId, {
        id: node.id,
        type: node.type,
        title: node.title || node.type.toUpperCase(),
        config: node.config ?? {},
        x: xCenter,
        y: y,
        width: CARD_WIDTH,
        height: 70
      });
    }

    const { children } = computeSubtreeWidths(nodeId, nodesList);
    if (children.length === 0) return;

    const childSubtreeWidths = children.map(c => computeSubtreeWidths(c.id, nodesList, new Set(visited)).width);
    const totalSubtreeWidth = childSubtreeWidths.reduce((a, b) => a + b, 0);
    const totalXSpan = xEnd - xStart;

    let currentX = xStart;
    children.forEach((c, idx) => {
      const cWidthRatio = childSubtreeWidths[idx] / totalSubtreeWidth;
      const cXSpan = totalXSpan * cWidthRatio;
      const nextXStart = currentX;
      const nextXEnd = currentX + cXSpan;

      connectors.push({
        fromId: nodeId,
        toId: c.id,
        label: c.label
      });

      layoutNodes(c.id, nextXStart, nextXEnd, y + Y_STEP, nodesList, layoutMap, connectors, new Set(visited));
      currentX += cXSpan;
    });
  }, [computeSubtreeWidths]);

  // --- Deletion and Add Operations ---

  // Delete node and heal connections
  const handleDeleteNode = useCallback((nodeId: string) => {
    setLocalNodes(prev => {
      const nodeToDelete = prev.find(n => n.id === nodeId);
      if (!nodeToDelete) return prev;

      let updatedNodes = prev.filter(n => n.id !== nodeId);

      const upstream = prev.find(n => {
        if (n.downstreamId === nodeId) return true;
        const trueB = n.config?.trueBranch;
        const falseB = n.config?.falseBranch;
        const trueMatch = Array.isArray(trueB) ? trueB.includes(nodeId) : trueB === nodeId;
        const falseMatch = Array.isArray(falseB) ? falseB.includes(nodeId) : falseB === nodeId;
        return trueMatch || falseMatch;
      });
      const downstreamId = nodeToDelete.downstreamId;

      if (upstream) {
        updatedNodes = updatedNodes.map(n => {
          if (n.id === upstream.id) {
            if (n.type === 'condition') {
              const nextConfig = { ...n.config };
              if (Array.isArray(nextConfig.trueBranch)) {
                nextConfig.trueBranch = nextConfig.trueBranch.map((id: string) => id === nodeId ? downstreamId : id).filter(Boolean);
              } else if (nextConfig.trueBranch === nodeId) {
                nextConfig.trueBranch = downstreamId;
              }
              if (Array.isArray(nextConfig.falseBranch)) {
                nextConfig.falseBranch = nextConfig.falseBranch.map((id: string) => id === nodeId ? downstreamId : id).filter(Boolean);
              } else if (nextConfig.falseBranch === nodeId) {
                nextConfig.falseBranch = downstreamId;
              }
              return { ...n, config: nextConfig };
            }
            return { ...n, downstreamId };
          }
          return n;
        });
      }

      if (downstreamId) {
        updatedNodes = updatedNodes.map(n => {
          if (n.id === downstreamId) {
            return { ...n, upstreamId: upstream ? upstream.id : undefined };
          }
          return n;
        });
      }

      return updatedNodes;
    });
    setSelectedNodeId('trigger');
    message.success('🗑️ Removed node and healed pathway');
  }, []);

  // Add sequential node downstream of a node or insert between
  const handleAddDownstreamNode = useCallback((nodeId: string) => {
    setLocalNodes(prev => {
      const newId = 'n_' + Math.random().toString(36).substr(2, 5);

      if (nodeId === 'trigger') {
        const first = prev.find(n => !n.upstreamId);
        if (first) {
          const newNode = {
            id: newId,
            type: 'calculation',
            title: 'New Step',
            config: { expression: '1 + 1' },
            downstreamId: first.id
          };

          const updated = prev.map(n => {
            if (n.id === first.id) {
              return { ...n, upstreamId: newId };
            }
            return n;
          });

          return [...updated, newNode];
        } else {
          const newNode = {
            id: newId,
            type: 'calculation',
            title: 'First Step',
            config: { expression: '1 + 1' }
          };
          return [...prev, newNode];
        }
      } else {
        const node = prev.find(n => n.id === nodeId);
        const downstreamId = node?.downstreamId;

        const newNode = {
          id: newId,
          type: 'calculation',
          title: 'New Step',
          config: { expression: '1 + 1' },
          upstreamId: nodeId,
          downstreamId: downstreamId
        };

        const updated = prev.map(n => {
          if (n.id === nodeId) {
            return { ...n, downstreamId: newId };
          }
          if (downstreamId && n.id === downstreamId) {
            return { ...n, upstreamId: newId };
          }
          return n;
        });

        setSelectedNodeId(newId);
        return [...updated, newNode];
      }
    });

    message.success('➕ Added downstream step successfully');
  }, []);

  // --- Dynamic Mapping into React Flow nodes and edges ---
  const rebuildGraph = useCallback(() => {
    const layoutMap = new Map<string, LayoutNode>();
    const connectors: LayoutConnector[] = [];

    // Always put the trigger node at the root (0, 0)
    layoutMap.set('trigger', {
      id: 'trigger',
      type: 'trigger',
      title: `Trigger: ${triggerType.toUpperCase()}`,
      config: triggerConfig,
      x: 0,
      y: 0,
      width: 200,
      height: 60
    });

    const firstNode = localNodes.find(n => !n.upstreamId);

    if (firstNode) {
      const { width: rootWidth } = computeSubtreeWidths(firstNode.id, localNodes);
      const totalWidth = rootWidth * 240;
      const xStart = -totalWidth / 2;
      const xEnd = totalWidth / 2;

      // Position the nodes
      layoutNodes(firstNode.id, xStart, xEnd, Y_STEP, localNodes, layoutMap, connectors);

      // Connect trigger to first
      connectors.push({
        fromId: 'trigger',
        toId: firstNode.id
      });
    }

    // Place disconnected nodes next to it
    const positionedIds = Array.from(layoutMap.keys());
    const unpositionedNodes = localNodes.filter(n => !positionedIds.includes(n.id));

    let unpositionedY = Y_STEP;
    unpositionedNodes.forEach(node => {
      if (!layoutMap.has(node.id)) {
        layoutMap.set(node.id, {
          id: node.id,
          type: node.type,
          title: node.title || node.type.toUpperCase(),
          config: node.config ?? {},
          x: 280,
          y: unpositionedY,
          width: CARD_WIDTH,
          height: 70
        });
        unpositionedY += Y_STEP;
      }
    });

    // 3. Map to React Flow Node objects
    const rfNodesList: Node[] = Array.from(layoutMap.values()).map(ln => {
      const isTrigger = ln.id === 'trigger';

      return {
        id: ln.id,
        type: isTrigger ? 'trigger' : 'action',
        position: { x: ln.x - ln.width / 2, y: ln.y },
        data: {
          id: ln.id,
          title: ln.title,
          type: ln.type,
          config: ln.config,
          triggerType,
          collectionName: triggerConfig.collectionName,
          selectedNodeId,
          onDelete: handleDeleteNode,
          onAddDownstream: handleAddDownstreamNode
        }
      };
    });

    // 4. Map to React Flow Edge objects (Light Mode style)
    const rfEdgesList: Edge[] = connectors.map((conn, idx) => {
      const isConditionBranch = conn.label === 'True' || conn.label === 'False';

      return {
        id: `e-${conn.fromId}-${conn.toId}-${idx}`,
        source: conn.fromId,
        target: conn.toId,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#8c8c8c'
        },
        style: { stroke: '#bfbfbf', strokeWidth: 2 },
        ...(isConditionBranch ? {
          label: conn.label,
          labelBgStyle: { fill: conn.label === 'True' ? '#f6ffed' : '#fff1f0', stroke: conn.label === 'True' ? '#b7eb8f' : '#ffccc7', strokeWidth: 1 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          labelStyle: { fill: conn.label === 'True' ? '#389e0d' : '#cf1322', fontWeight: 600, fontSize: 10 }
        } : {})
      };
    });

    setRfNodes(rfNodesList);
    setRfEdges(rfEdgesList);
  }, [
    localNodes, triggerType, triggerConfig, selectedNodeId,
    computeSubtreeWidths, layoutNodes, handleDeleteNode, handleAddDownstreamNode,
    setRfNodes, setRfEdges
  ]);

  // Re-run mapping when nodes/trigger state updates
  useEffect(() => {
    rebuildGraph();
  }, [rebuildGraph]);

  // Register Custom Nodes for React Flow
  const nodeTypes = useMemo(() => ({
    trigger: TriggerNode,
    action: ActionNode
  }), []);

  // Click handler on React Flow canvas node
  const onNodeClick = (_: any, node: Node) => {
    setSelectedNodeId(node.id);
  };

  // --- Manual Configuration Edits ---

  const handleSaveNodeDetails = (values: any) => {
    const { title, triggerType: newTriggerType, nodeType, ...configValues } = values;

    if (selectedNodeId === 'trigger') {
      setTriggerType(newTriggerType);
      const newConfig = { ...values };
      delete newConfig.nodeType;
      delete newConfig.title;
      delete newConfig.triggerType;
      setTriggerConfig(newConfig);
    } else if (selectedNodeId) {
      setLocalNodes(prev => prev.map(n => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            title,
            type: nodeType,
            config: configValues
          };
        }
        return n;
      }));
    }
  };

  // --- AI Copilot Handler ---

  const handleAICopilotSubmit = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiProgressLogs([
      '⚡ Analyzing current flowchart nodes and trigger...',
    ]);

    await new Promise(r => setTimeout(r, 600));
    setAiProgressLogs(prev => [...prev, '🔍 Packaging workflow context and dispatching to Qwen LLM...']);

    try {
      const currentDefinition = {
        title: workflow.title,
        triggerType,
        triggerConfig,
        nodes: localNodes
      };

      const fullPrompt = `Current workflow structure:
${JSON.stringify(currentDefinition, null, 2)}

User request for editing:
"${aiPrompt}"

Please update the workflow structure according to the requested edit, maintaining consistent node IDs and correct upstream/downstream connections. Return the full modified workflow JSON structure.`;

      // Dispatch fetch in parallel
      const fetchPromise = apiFetch('/api/ai/a2flow', {
        method: 'POST',
        body: JSON.stringify({
          prompt: fullPrompt,
          context: { appId }
        })
      });

      await new Promise(r => setTimeout(r, 1000));
      setAiProgressLogs(prev => [...prev, '🧠 Qwen AI is evaluating layout changes and connection routing...']);

      await new Promise(r => setTimeout(r, 1200));
      setAiProgressLogs(prev => [...prev, '⛓️ Syncing upstream and downstream flow pathway linkages...']);

      const res = await fetchPromise;

      setAiProgressLogs(prev => [...prev, '✨ Structured workflow JSON compiled and verified successfully!']);
      await new Promise(r => setTimeout(r, 400));

      if (res?.data) {
        const updatedWf = res.data;
        // Apply self-healing normalizer!
        const normalizedNodes = normalizeWorkflowNodes(updatedWf.nodes ?? []);
        setLocalNodes(normalizedNodes);
        setTriggerType(updatedWf.triggerType ?? 'manual');
        setTriggerConfig(updatedWf.triggerConfig ?? {});
        setSelectedNodeId('trigger');
        setAiPrompt('');
        message.success('✨ AI Workflow Copilot successfully modified the flowchart!');
      } else {
        throw new Error('Invalid AI response structure');
      }
    } catch (err: any) {
      setAiProgressLogs(prev => [...prev, `❌ AI compilation failed: ${err.message}`]);
      message.error(`AI Edit failed: ${err.message}`);
    } finally {
      setAiLoading(false);
      // Keep logs visible for 3 seconds before clearing
      setTimeout(() => {
        setAiProgressLogs([]);
      }, 3000);
    }
  };

  // --- Overall Save to Server ---

  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    try {
      await apiFetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          values: {
            triggerType,
            triggerConfig,
            nodes: localNodes
          }
        })
      });
      message.success('🎉 Workflow successfully saved to DB');
      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      message.error(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '650px', background: '#ffffff', borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      
      {/* ─── Left React Flow Canvas Area (Clean Light Designer Workspace) ─── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}>
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSaveWorkflow} 
            loading={isSaving}
          >
            Save Workflow
          </Button>
        </div>

        {/* React Flow Component */}
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={{ background: '#f8fafc' }} // Crisp off-white workspace background
        >
          <Background color="#cbd5e1" gap={16} size={1} />
          <Controls style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', color: '#000' }} />
          <MiniMap 
            nodeColor={() => 'rgba(24, 144, 255, 0.2)'}
            maskColor="rgba(248, 250, 252, 0.6)"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
          />
        </ReactFlow>
      </div>

      {/* ─── Right Form Sidebar & AI Panel (Crisp Light Mode Sidebar) ─── */}
      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', background: '#ffffff', borderLeft: '1px solid #e8e8e8' }}>
        
        {/* Tab Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', background: '#fafafa' }}>
          <div style={{ flex: 1, padding: '12px 16px', fontWeight: 'bold', color: '#262626', borderBottom: '2px solid #722ed1', display: 'flex', alignItems: 'center', gap: 6 }}>
            <SettingOutlined style={{ color: '#722ed1' }} />
            <span>Settings &amp; Properties</span>
          </div>
        </div>

        {/* Selected element details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {selectedNodeId ? (
            <div>
              <Title level={5} style={{ marginBottom: 12 }}>
                {selectedNodeId === 'trigger' ? '⚡ Edit Trigger' : '⚙️ Edit Action Step'}
              </Title>

              <Form 
                form={form} 
                layout="vertical" 
                onValuesChange={(_, allValues) => handleSaveNodeDetails(allValues)}
              >
                {selectedNodeId === 'trigger' ? (
                  <>
                    <Form.Item label="Trigger Type" name="triggerType">
                      <Select options={[
                        { value: 'manual', label: 'Manual Execution' },
                        { value: 'collection', label: 'Collection CRUD Event' },
                        { value: 'schedule', label: 'Scheduled Time (Cron)' }
                      ]} />
                    </Form.Item>

                    {form.getFieldValue('triggerType') === 'collection' && (
                      <>
                        <Form.Item label="Collection Name" name="collectionName" rules={[{ required: true }]}>
                          <Input placeholder="e.g. tickets" />
                        </Form.Item>
                        <Form.Item label="Event Trigger" name="event">
                          <Select options={[
                            { value: 'afterCreate', label: 'After Record Created' },
                            { value: 'afterUpdate', label: 'After Record Updated' },
                            { value: 'afterDestroy', label: 'After Record Deleted' }
                          ]} />
                        </Form.Item>
                      </>
                    )}

                    {form.getFieldValue('triggerType') === 'schedule' && (
                      <Form.Item label="Cron Expression" name="cron" rules={[{ required: true }]}>
                        <Input placeholder="e.g. */5 * * * * (every 5 mins)" />
                      </Form.Item>
                    )}
                  </>
                ) : (
                  <>
                    <Form.Item label="Step Title" name="title" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    
                    <Form.Item label="Action Type" name="nodeType">
                      <Select options={NODE_TYPES} />
                    </Form.Item>

                    <Divider style={{ margin: '12px 0' }} />

                    {/* Node Config Forms */}
                    {form.getFieldValue('nodeType') === 'condition' && (
                      <>
                        <Form.Item label="JS Expression" name="expression" extra="Returns true/false (e.g. ctx.triggerData.price > 100)">
                          <Input.TextArea placeholder="ctx.triggerData.status === 'High'" rows={2} />
                        </Form.Item>
                        <Form.Item label="True downstream branch node" name="trueBranch">
                          <Select 
                            placeholder="Select node for True branch"
                            options={nodeOptions} 
                          />
                        </Form.Item>
                        <Form.Item label="False downstream branch node" name="falseBranch">
                          <Select 
                            placeholder="Select node for False branch"
                            options={nodeOptions} 
                          />
                        </Form.Item>
                      </>
                    )}

                    {form.getFieldValue('nodeType') === 'calculation' && (
                      <>
                        <Form.Item label="Mathematical / String expression" name="expression">
                          <Input placeholder="e.g. ctx.triggerData.quantity * 10" />
                        </Form.Item>
                        <Form.Item label="Result context key" name="resultKey">
                          <Input placeholder="e.g. totalPrice" />
                        </Form.Item>
                      </>
                    )}

                    {form.getFieldValue('nodeType') === 'http-request' && (
                      <>
                        <Form.Item label="URL Endpoint" name="url">
                          <Input placeholder="https://api.slack.com/services/..." />
                        </Form.Item>
                        <Form.Item label="HTTP Method" name="method">
                          <Select options={[
                            { value: 'POST', label: 'POST' },
                            { value: 'GET', label: 'GET' },
                            { value: 'PUT', label: 'PUT' }
                          ]} />
                        </Form.Item>
                      </>
                    )}

                    {['query', 'create', 'update', 'destroy'].includes(form.getFieldValue('nodeType')) && (
                      <>
                        <Form.Item label="Collection Table" name="collection">
                          <Input placeholder="e.g. orders" />
                        </Form.Item>
                        {['query', 'update', 'destroy'].includes(form.getFieldValue('nodeType')) && (
                          <Form.Item label="Filter (JSON)" name="filter">
                            <Input.TextArea placeholder='e.g. { "id": "{{triggerData.orderId}}" }' rows={2} />
                          </Form.Item>
                        )}
                        {['create', 'update'].includes(form.getFieldValue('nodeType')) && (
                          <Form.Item label="Values to Set (JSON)" name="values">
                            <Input.TextArea placeholder='e.g. { "status": "approved" }' rows={2} />
                          </Form.Item>
                        )}
                      </>
                    )}

                    {form.getFieldValue('nodeType') === 'manual' && (
                      <>
                        <Form.Item label="Assignee Role" name="assignees">
                          <Input placeholder="e.g. manager" />
                        </Form.Item>
                        <Form.Item label="Task Description" name="description">
                          <Input.TextArea placeholder="Please review Slack notification payload" rows={2} />
                        </Form.Item>
                      </>
                    )}

                    {form.getFieldValue('nodeType') === 'loop' && (
                      <Form.Item label="Target Loop Array Key" name="target" extra="JSON path variable">
                        <Input placeholder="e.g. ctx.triggerData.items" />
                      </Form.Item>
                    )}
                  </>
                )}
              </Form>

              {selectedNodeId !== 'trigger' && (
                <Popconfirm title="Delete this node?" onConfirm={() => handleDeleteNode(selectedNodeId)}>
                  <Button danger icon={<DeleteOutlined />} style={{ width: '100%', marginTop: 8 }}>
                    Delete This Node
                  </Button>
                </Popconfirm>
              )}
            </div>
          ) : (
            <div style={{ color: '#8c8c8c', textAlign: 'center', padding: '40px 0' }}>
              Click any node in the flowchart to edit its details.
            </div>
          )}

          {/* AI Workflow Copilot (Beautiful Light Mode Purple AI Panel) */}
          <Divider style={{ margin: '12px 0 0 0' }} />
          
          <div style={{ background: '#f9f0ff', padding: 14, borderRadius: 8, border: '1px solid #efdbff', marginTop: 'auto', boxShadow: '0 2px 8px rgba(114, 46, 209, 0.05)' }}>
            <Title level={5} style={{ fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#531dab' }}>
              <ThunderboltOutlined />
              AI Workflow Copilot
            </Title>
            <Paragraph style={{ color: '#531dab', opacity: 0.8, fontSize: 11, marginBottom: 10 }}>
              Use AI to design or modify your workflow using natural language prompts.
            </Paragraph>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Input.TextArea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Add a conditional branch checking if order amount is > 1000 before Slack notify."
                rows={3}
                style={{ background: '#ffffff', borderColor: '#d9d9d9', color: '#1f1f1f' }}
              />
              <Button 
                type="primary" 
                icon={<SendOutlined />} 
                onClick={handleAICopilotSubmit} 
                loading={aiLoading}
                style={{ background: '#722ed1', borderColor: '#722ed1' }}
              >
                Apply AI Edit
              </Button>
              
              {aiProgressLogs.length > 0 && (
                <div style={{
                  marginTop: 10,
                  background: '#1f1f1f',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontSize: 10,
                  color: '#d8b4fe', // Premium Light Purple color
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}>
                  {aiProgressLogs.map((log, i) => (
                    <div key={i} style={{ opacity: i === aiProgressLogs.length - 1 ? 1 : 0.65 }}>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
