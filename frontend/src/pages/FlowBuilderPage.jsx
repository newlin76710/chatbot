import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, Panel,
  MarkerType, getSmoothStepPath, EdgeLabelRenderer, BaseEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useChannelStore } from '../store/channelStore';
import NodeConfigPanel from '../components/FlowBuilder/NodeConfigPanel';
import FlowSidebar from '../components/FlowBuilder/FlowSidebar';
import { CUSTOM_NODE_TYPES } from '../components/FlowBuilder/CustomNodes';

function DeleteEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [hovered, setHovered] = useState(false);
  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* 透明寬邊方便 hover */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />
      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
          className="nodrag nopan"
        >
          <button
            onClick={() => {
              // 透過 ReactFlow 的 onEdgesChange 刪除
              window.__rfDeleteEdge?.(id);
            }}
            style={{
              width: 20, height: 20, borderRadius: '50%', border: 'none',
              background: '#EF4444', color: '#fff', cursor: 'pointer',
              fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
          >×</button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const EDGE_TYPES = { deleteEdge: DeleteEdge };

const DEFAULT_EDGE = {
  type: 'deleteEdge',
  animated: true,
  style: { stroke: '#6366F1', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366F1' },
};

let nodeIdCounter = 1;
const newId = () => `node_${Date.now()}_${nodeIdCounter++}`;

export default function FlowBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeChannelId, channelsReady } = useChannelStore();
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [flowMeta, setFlowMeta] = useState({ name: '未命名流程', isActive: false });
  const [saving, setSaving] = useState(false);
  const [flows, setFlows] = useState([]);
  const [showFlowList, setShowFlowList] = useState(!id);

  // URL 的 id 改變時同步顯示狀態（例如 navigate('/flows') 後）
  useEffect(() => {
    setShowFlowList(!id);
  }, [id]);

  // 載入流程列表
  useEffect(() => {
    if (!channelsReady || !activeChannelId) return;
    api.get(`/flows?channelId=${activeChannelId}`)
      .then(r => setFlows(r.data.flows))
      .catch(() => {});
  }, [channelsReady, activeChannelId]);

  // 載入指定流程
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
    }).catch(() => toast.error('載入流程失敗'));
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

  const deleteEdge = useCallback((edgeId) => {
    setEdges(es => es.filter(e => e.id !== edgeId));
  }, []);

  useEffect(() => {
    window.__rfDeleteEdge = deleteEdge;
    return () => { delete window.__rfDeleteEdge; };
  }, [deleteEdge]);

  const handleSave = async () => {
    if (!activeChannelId) return toast.error('請先選擇一個頻道');
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
      toast.success('流程已儲存！');
    } catch (err) {
      toast.error('儲存失敗');
    }
    setSaving(false);
  };

  const toggleActive = async () => {
    if (!flowMeta._id) return toast.error('請先儲存流程');
    const { data } = await api.patch(`/flows/${flowMeta._id}/toggle`);
    setFlowMeta(m => ({ ...m, isActive: data.flow.isActive }));
    toast.success(data.flow.isActive ? '✅ 流程已啟用' : '⏸ 流程已暫停');
  };

  if (showFlowList) return (
    <FlowListView
      flows={flows}
      onCreate={() => { setShowFlowList(false); setNodes([]); setEdges([]); setFlowMeta({ name: '未命名流程', isActive: false }); navigate('/flows'); }}
      onOpen={(f) => navigate(`/flows/${f._id}`)}
      onDelete={async (f) => { await api.delete(`/flows/${f._id}`); setFlows(fs => fs.filter(x => x._id !== f._id)); }}
      onSetTemplate={async (f) => {
        const next = !f.isTemplate;
        await api.patch(`/flows/${f._id}/set-template`, { isTemplate: next });
        setFlows(fs => fs.map(x => x._id === f._id ? { ...x, isTemplate: next } : x));
        toast.success(next ? `「${f.name}」已設為範本` : `「${f.name}」已取消範本`);
      }}
    />
  );

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* 工具列 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: '#fff', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
        <button onClick={() => navigate('/flows')}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13, color: '#64748B' }}>
          ← 流程列表
        </button>
        <input value={flowMeta.name}
          onChange={e => setFlowMeta(m => ({ ...m, name: e.target.value }))}
          style={{ flex: 1, maxWidth: 300, padding: '6px 12px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 14, fontWeight: 600 }} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: flowMeta.isActive ? '#10B981' : '#94A3B8', fontWeight: 500 }}>
            {flowMeta.isActive ? '● 啟用中' : '○ 未啟用'}
          </span>
          <button onClick={toggleActive} style={{
            padding: '6px 14px', borderRadius: 7, border: '1px solid',
            borderColor: flowMeta.isActive ? '#FCA5A5' : '#A7F3D0',
            background: flowMeta.isActive ? '#FEF2F2' : '#ECFDF5',
            color: flowMeta.isActive ? '#DC2626' : '#059669',
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
          }}>
            {flowMeta.isActive ? '停用' : '啟用'}
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '7px 18px', borderRadius: 7, background: '#6366F1',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            {saving ? '儲存中...' : '儲存流程'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 節點面板 */}
        <FlowSidebar />

        {/* 畫布 */}
        <div ref={reactFlowWrapper} style={{ flex: 1 }} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            nodeTypes={CUSTOM_NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            fitView
            style={{ background: '#F8F9FC' }}
          >
            <Background color="#E2E8F0" gap={20} />
            <Controls />
            <MiniMap nodeColor="#6366F1" maskColor="rgba(248,249,252,0.8)" />
          </ReactFlow>
        </div>

        {/* 設定面板 */}
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

function FlowListView({ flows, onCreate, onOpen, onDelete, onSetTemplate }) {
  const { activeChannelId } = useChannelStore();
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [importing, setImporting] = useState(null);

  const loadTemplates = () => {
    api.get('/flows/templates').then(r => setTemplates(r.data.templates)).catch(() => {});
  };
  useEffect(() => { loadTemplates(); }, []);

  const handleImport = async (tpl) => {
    if (!activeChannelId) return toast.error('請先選擇一個頻道');
    setImporting(tpl.id);
    try {
      await api.post(`/flows/templates/${tpl.id}/import`, { channelId: activeChannelId });
      toast.success(`「${tpl.name}」匯入成功！`);
      setShowTemplates(false);
      window.location.reload();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '未知錯誤';
      toast.error(`匯入失敗：${msg}`);
      console.error('[匯入範本]', err.response?.data || err);
    }
    setImporting(null);
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>流程編輯</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>視覺化設計對話流程</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowTemplates(true)} style={{
            padding: '9px 20px', borderRadius: 8, background: '#F1F5F9',
            color: '#374151', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>📋 匯入範本</button>
          <button onClick={onCreate} style={{
            padding: '9px 20px', borderRadius: 8, background: '#6366F1',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>+ 新增流程</button>
        </div>
      </div>

      {/* 範本匯入 Modal */}
      {showTemplates && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 580, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>娜米機器人腳本範本</h2>
              <button onClick={() => setShowTemplates(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8' }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 0, marginBottom: 20 }}>選擇範本即可自動建立完整流程，包含所有問卷節點與分支邏輯。</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {templates.map(tpl => (
                <div key={tpl.id} style={{ background: '#F8F9FC', borderRadius: 12, padding: 16, border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A', marginBottom: 4 }}>{tpl.name}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>{tpl.description}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 500 }}>
                          {tpl.platform === 'messenger' ? 'FB Messenger' : 'LINE'}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F0FDF4', color: '#15803D', fontWeight: 500 }}>
                          {tpl.nodeCount} 個節點
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleImport(tpl)}
                      disabled={importing === tpl.id}
                      style={{ marginLeft: 16, padding: '7px 16px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {importing === tpl.id ? '匯入中...' : '匯入'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }}>
        {flows.map(f => (
          <div key={f._id} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            onClick={() => onOpen(f)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{f.name}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                  {f.channel?.platform} • {new Date(f.updatedAt).toLocaleDateString('zh-TW')}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                background: f.isActive ? '#ECFDF5' : '#F1F5F9',
                color: f.isActive ? '#059669' : '#94A3B8',
              }}>{f.isActive ? '啟用中' : '草稿'}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748B', marginTop: 12 }}>
              <span>⚡ {f.stats?.triggered || 0} 次觸發</span>
              <span>✓ {f.stats?.completed || 0} 次完成</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={(e) => { e.stopPropagation(); onSetTemplate(f); }}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${f.isTemplate ? '#A5B4FC' : '#E2E8F0'}`, background: f.isTemplate ? '#EEF2FF' : '#F8F9FC', color: f.isTemplate ? '#4F46E5' : '#64748B', cursor: 'pointer', fontSize: 11, fontWeight: f.isTemplate ? 600 : 400 }}>
                {f.isTemplate ? '★ 範本' : '☆ 設為範本'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(f); }}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDefaultNodeData(type) {
  switch (type) {
    case 'trigger': return { label: '觸發器', trigger: { type: 'keyword', keywords: [], matchMode: 'contains' } };
    case 'message': return { label: '發送訊息', messages: [{ type: 'text', text: '' }] };
    case 'condition': return { label: '條件判斷', conditions: [{ field: 'tags', operator: 'contains', value: '' }], conditionMode: 'and' };
    case 'action': return { label: '動作', actions: [{ type: 'addTag', tag: '' }] };
    case 'input': return { label: '等待回覆', messages: [{ type: 'text', text: '請輸入回覆：' }], inputField: 'userInput' };
    case 'delay': return { label: '延遲', delay: { value: 1, unit: 'seconds' } };
    case 'end': return { label: '結束' };
    default: return { label: type };
  }
}
