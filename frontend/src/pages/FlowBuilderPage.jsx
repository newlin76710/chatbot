import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, Panel,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useChannelStore } from '../store/channelStore';
import NodeConfigPanel from '../components/FlowBuilder/NodeConfigPanel';
import FlowSidebar from '../components/FlowBuilder/FlowSidebar';
import { CUSTOM_NODE_TYPES } from '../components/FlowBuilder/CustomNodes';

const DEFAULT_EDGE = {
  type: 'smoothstep',
  animated: true,
  style: { stroke: '#6366F1', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366F1' },
};

let nodeIdCounter = 1;
const newId = () => `node_${Date.now()}_${nodeIdCounter++}`;

export default function FlowBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeChannelId } = useChannelStore();
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [flowMeta, setFlowMeta] = useState({ name: 'Untitled Flow', isActive: false });
  const [saving, setSaving] = useState(false);
  const [flows, setFlows] = useState([]);
  const [showFlowList, setShowFlowList] = useState(!id);

  // Load flow list
  useEffect(() => {
    if (!activeChannelId) return;
    api.get(`/flows?channelId=${activeChannelId}`)
      .then(r => setFlows(r.data.flows))
      .catch(() => {});
  }, [activeChannelId]);

  // Load specific flow
  useEffect(() => {
    if (!id) return;
    api.get(`/flows/${id}`).then(r => {
      const flow = r.data.flow;
      setFlowMeta({ name: flow.name, isActive: flow.isActive, _id: flow._id });
      setNodes(flow.nodes.map(n => ({
        id: n.id, type: n.type, position: n.position || { x: 100, y: 100 }, data: n.data,
      })));
      setEdges(flow.edges.map(e => ({ ...e, ...DEFAULT_EDGE, label: e.label })));
      setShowFlowList(false);
    }).catch(() => toast.error('Failed to load flow'));
  }, [id]);

  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, ...DEFAULT_EDGE }, eds));
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('nodeType');
    if (!type || !reactFlowInstance) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const pos = reactFlowInstance.project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });

    const newNode = {
      id: newId(), type, position: pos,
      data: getDefaultNodeData(type),
    };
    setNodes(ns => [...ns, newNode]);
  }, [reactFlowInstance]);

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);

  const updateNodeData = useCallback((nodeId, data) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data } : n));
    setSelectedNode(s => s?.id === nodeId ? { ...s, data } : s);
  }, []);

  const deleteNode = useCallback((nodeId) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, []);

  const handleSave = async () => {
    if (!activeChannelId) return toast.error('Select a channel first');
    setSaving(true);
    try {
      const payload = {
        name: flowMeta.name,
        channelId: activeChannelId,
        nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, label: e.label })),
      };
      if (flowMeta._id) {
        await api.put(`/flows/${flowMeta._id}`, payload);
      } else {
        const { data } = await api.post('/flows', payload);
        setFlowMeta(m => ({ ...m, _id: data.flow._id }));
        navigate(`/flows/${data.flow._id}`, { replace: true });
      }
      toast.success('Flow saved!');
    } catch (err) {
      toast.error('Save failed');
    }
    setSaving(false);
  };

  const toggleActive = async () => {
    if (!flowMeta._id) return toast.error('Save the flow first');
    const { data } = await api.patch(`/flows/${flowMeta._id}/toggle`);
    setFlowMeta(m => ({ ...m, isActive: data.flow.isActive }));
    toast.success(data.flow.isActive ? '✅ Flow activated' : '⏸ Flow paused');
  };

  if (showFlowList) return (
    <FlowListView
      flows={flows}
      onCreate={() => { setShowFlowList(false); setNodes([]); setEdges([]); setFlowMeta({ name: 'Untitled Flow', isActive: false }); navigate('/flows'); }}
      onOpen={(f) => navigate(`/flows/${f._id}`)}
      onDelete={async (f) => { await api.delete(`/flows/${f._id}`); setFlows(fs => fs.filter(x => x._id !== f._id)); }}
    />
  );

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: '#fff', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
        <button onClick={() => setShowFlowList(true)}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13, color: '#64748B' }}>
          ← Flows
        </button>
        <input value={flowMeta.name}
          onChange={e => setFlowMeta(m => ({ ...m, name: e.target.value }))}
          style={{ flex: 1, maxWidth: 300, padding: '6px 12px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 14, fontWeight: 600 }} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: flowMeta.isActive ? '#10B981' : '#94A3B8', fontWeight: 500 }}>
            {flowMeta.isActive ? '● Live' : '○ Inactive'}
          </span>
          <button onClick={toggleActive} style={{
            padding: '6px 14px', borderRadius: 7, border: '1px solid',
            borderColor: flowMeta.isActive ? '#FCA5A5' : '#A7F3D0',
            background: flowMeta.isActive ? '#FEF2F2' : '#ECFDF5',
            color: flowMeta.isActive ? '#DC2626' : '#059669',
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
          }}>
            {flowMeta.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '7px 18px', borderRadius: 7, background: '#6366F1',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            {saving ? 'Saving...' : 'Save Flow'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Node Palette */}
        <FlowSidebar />

        {/* Canvas */}
        <div ref={reactFlowWrapper} style={{ flex: 1 }} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            nodeTypes={CUSTOM_NODE_TYPES}
            fitView
            style={{ background: '#F8F9FC' }}
          >
            <Background color="#E2E8F0" gap={20} />
            <Controls />
            <MiniMap nodeColor="#6366F1" maskColor="rgba(248,249,252,0.8)" />
          </ReactFlow>
        </div>

        {/* Config Panel */}
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

function FlowListView({ flows, onCreate, onOpen, onDelete }) {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Flow Builder</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>Design conversation flows visually</p>
        </div>
        <button onClick={onCreate} style={{
          padding: '9px 20px', borderRadius: 8, background: '#6366F1',
          color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}>+ New Flow</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }}>
        {flows.map(f => (
          <div key={f._id} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            onClick={() => onOpen(f)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{f.name}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                  {f.channel?.platform} • {new Date(f.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                background: f.isActive ? '#ECFDF5' : '#F1F5F9',
                color: f.isActive ? '#059669' : '#94A3B8',
              }}>{f.isActive ? 'Live' : 'Draft'}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748B', marginTop: 12 }}>
              <span>⚡ {f.stats?.triggered || 0} triggered</span>
              <span>✓ {f.stats?.completed || 0} completed</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(f); }}
              style={{ marginTop: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDefaultNodeData(type) {
  switch (type) {
    case 'trigger': return { label: 'Trigger', trigger: { type: 'keyword', keywords: [], matchMode: 'contains' } };
    case 'message': return { label: 'Send Message', messages: [{ type: 'text', text: '' }] };
    case 'condition': return { label: 'Condition', conditions: [{ field: 'tags', operator: 'contains', value: '' }], conditionMode: 'and' };
    case 'action': return { label: 'Action', actions: [{ type: 'addTag', tag: '' }] };
    case 'input': return { label: 'Wait for Input', messages: [{ type: 'text', text: 'Please reply:' }], inputField: 'userInput' };
    case 'delay': return { label: 'Delay', delay: { value: 1, unit: 'seconds' } };
    case 'end': return { label: 'End' };
    default: return { label: type };
  }
}
