// CustomNodes.jsx
import React from 'react';
import { Handle, Position } from 'reactflow';

const NODE_COLORS = {
  trigger:   { bg: '#EEF2FF', border: '#6366F1', icon: '⚡', color: '#4338CA' },
  message:   { bg: '#F0FDF4', border: '#22C55E', icon: '💬', color: '#15803D' },
  condition: { bg: '#FFFBEB', border: '#F59E0B', icon: '◈', color: '#B45309' },
  action:    { bg: '#FDF4FF', border: '#A855F7', icon: '⚙', color: '#7E22CE' },
  input:     { bg: '#EFF6FF', border: '#3B82F6', icon: '✎', color: '#1D4ED8' },
  delay:     { bg: '#F8FAFC', border: '#94A3B8', icon: '⏱', color: '#475569' },
  end:       { bg: '#FFF1F2', border: '#F43F5E', icon: '■', color: '#BE123C' },
};

const ACTION_LABELS = {
  addTag: '新增標籤',
  removeTag: '移除標籤',
  setField: '設定欄位',
  unsubscribe: '取消訂閱',
  triggerFlow: '觸發流程',
  webhookCall: 'Webhook',
};

const TRIGGER_LABELS = {
  any: '任意訊息',
  keyword: '關鍵字',
  follow: '加入好友',
  unfollow: '封鎖',
  postback: '按鈕回傳',
};

function BaseNode({ data, type, selected, children }) {
  const c = NODE_COLORS[type] || NODE_COLORS.message;
  return (
    <div style={{
      background: c.bg,
      border: `2px solid ${selected ? c.border : c.border + '80'}`,
      borderRadius: 10,
      minWidth: 180,
      maxWidth: 240,
      boxShadow: selected ? `0 0 0 3px ${c.border}30` : '0 2px 8px rgba(0,0,0,0.08)',
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderBottom: `1px solid ${c.border}30` }}>
        <span style={{ fontSize: 14 }}>{c.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: c.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label || type}
        </span>
      </div>
      <div style={{ padding: '8px 12px', fontSize: 11, color: '#64748B' }}>{children}</div>
    </div>
  );
}

export const TriggerNode = ({ data, selected }) => {
  const t = data.trigger || {};
  const typeLabel = TRIGGER_LABELS[t.type] || t.type || '—';
  const keywords = t.keywords?.length ? t.keywords.slice(0, 2).join('、') + (t.keywords.length > 2 ? '...' : '') : '';
  return (
    <BaseNode data={data} type="trigger" selected={selected}>
      <Handle type="source" position={Position.Bottom} style={{ background: '#6366F1' }} />
      <div style={{ fontWeight: 500, color: '#4338CA' }}>{typeLabel}</div>
      {keywords && <div style={{ marginTop: 2, color: '#94A3B8', fontSize: 10 }}>"{keywords}"</div>}
    </BaseNode>
  );
};

export const MessageNode = ({ data, selected }) => {
  const msgs = data.messages || [];
  const first = msgs[0];
  const qrCount = first?.quickReplies?.length || 0;
  const preview = first?.type === 'text' ? first.text : first?.type ? `[${first.type}]` : '—';
  return (
    <BaseNode data={data} type="message" selected={selected}>
      <Handle type="target" position={Position.Top} style={{ background: '#22C55E' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#22C55E' }} />
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
        {preview}
      </div>
      <div style={{ marginTop: 3, display: 'flex', gap: 8, color: '#94A3B8', fontSize: 10 }}>
        {msgs.length > 1 && <span>+{msgs.length - 1} 則訊息</span>}
        {qrCount > 0 && <span>{qrCount} 個快速回覆</span>}
      </div>
    </BaseNode>
  );
};

export const ConditionNode = ({ data, selected }) => {
  const conds = data.conditions || [];
  const mode = data.conditionMode === 'or' ? 'OR' : 'AND';
  const preview = conds[0]
    ? `${conds[0].field} ${conds[0].operator} "${conds[0].value || ''}"`
    : '尚未設定條件';
  return (
    <BaseNode data={data} type="condition" selected={selected}>
      <Handle type="target" position={Position.Top} style={{ background: '#F59E0B' }} />
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%', background: '#22C55E' }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%', background: '#F43F5E' }} />
      <div style={{ fontSize: 10, color: '#B45309', marginBottom: 3 }}>
        {conds.length} 個條件（{mode}）
      </div>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, fontSize: 10 }}>
        {preview}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        <span style={{ color: '#22C55E', fontSize: 10, fontWeight: 500 }}>✓ 符合</span>
        <span style={{ color: '#F43F5E', fontSize: 10, fontWeight: 500 }}>✗ 不符合</span>
      </div>
    </BaseNode>
  );
};

export const ActionNode = ({ data, selected }) => {
  const actions = data.actions || [];
  const labels = actions.map(a => ACTION_LABELS[a.type] || a.type);
  return (
    <BaseNode data={data} type="action" selected={selected}>
      <Handle type="target" position={Position.Top} style={{ background: '#A855F7' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#A855F7' }} />
      {labels.length === 0
        ? <div>尚未設定動作</div>
        : labels.map((l, i) => <div key={i} style={{ fontSize: 10, color: '#7E22CE' }}>• {l}</div>)
      }
    </BaseNode>
  );
};

export const InputNode = ({ data, selected }) => (
  <BaseNode data={data} type="input" selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: '#3B82F6' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#3B82F6' }} />
    <div>存入：<strong style={{ color: '#1D4ED8' }}>{data.inputField || 'userInput'}</strong></div>
  </BaseNode>
);

export const DelayNode = ({ data, selected }) => {
  const UNIT_LABELS = { seconds: '秒', minutes: '分鐘', hours: '小時', days: '天' };
  return (
    <BaseNode data={data} type="delay" selected={selected}>
      <Handle type="target" position={Position.Top} style={{ background: '#94A3B8' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#94A3B8' }} />
      <div>{data.delay?.value || 1} {UNIT_LABELS[data.delay?.unit] || '秒'}</div>
    </BaseNode>
  );
};

export const EndNode = ({ data, selected }) => (
  <BaseNode data={data} type="end" selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: '#F43F5E' }} />
    <div style={{ color: '#BE123C', fontWeight: 600 }}>流程結束</div>
  </BaseNode>
);

export const CUSTOM_NODE_TYPES = {
  trigger: TriggerNode,
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode,
  input: InputNode,
  delay: DelayNode,
  end: EndNode,
};
