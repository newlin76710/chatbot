// CustomNodes.jsx
import React from 'react';
import { Handle, Position } from 'reactflow';

const NODE_COLORS = {
  trigger: { bg: '#EEF2FF', border: '#6366F1', icon: '⚡', color: '#4338CA' },
  message: { bg: '#F0FDF4', border: '#22C55E', icon: '💬', color: '#15803D' },
  condition: { bg: '#FFFBEB', border: '#F59E0B', icon: '◈', color: '#B45309' },
  action: { bg: '#FDF4FF', border: '#A855F7', icon: '⚙', color: '#7E22CE' },
  input: { bg: '#EFF6FF', border: '#3B82F6', icon: '✎', color: '#1D4ED8' },
  delay: { bg: '#F8FAFC', border: '#94A3B8', icon: '⏱', color: '#475569' },
  end: { bg: '#FFF1F2', border: '#F43F5E', icon: '■', color: '#BE123C' },
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
        <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{data.label || type}</span>
      </div>
      <div style={{ padding: '8px 12px', fontSize: 11, color: '#64748B' }}>{children}</div>
    </div>
  );
}

export const TriggerNode = ({ data, selected }) => (
  <BaseNode data={data} type="trigger" selected={selected}>
    <Handle type="source" position={Position.Bottom} style={{ background: '#6366F1' }} />
    <div>{data.trigger?.type === 'keyword'
      ? `Keywords: ${data.trigger?.keywords?.join(', ') || '—'}`
      : data.trigger?.type || '—'}</div>
  </BaseNode>
);

export const MessageNode = ({ data, selected }) => (
  <BaseNode data={data} type="message" selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: '#22C55E' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#22C55E' }} />
    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
      {data.messages?.[0]?.text || `[${data.messages?.[0]?.type || 'message'}]`}
    </div>
    {data.messages?.length > 1 && <div style={{ color: '#94A3B8', marginTop: 2 }}>+{data.messages.length - 1} more</div>}
  </BaseNode>
);

export const ConditionNode = ({ data, selected }) => (
  <BaseNode data={data} type="condition" selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: '#F59E0B' }} />
    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%', background: '#22C55E' }} />
    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%', background: '#F43F5E' }} />
    <div>{data.conditions?.length} condition{data.conditions?.length !== 1 ? 's' : ''} ({data.conditionMode})</div>
    <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
      <span style={{ color: '#22C55E', fontSize: 10 }}>✓ true</span>
      <span style={{ color: '#F43F5E', fontSize: 10 }}>✗ false</span>
    </div>
  </BaseNode>
);

export const ActionNode = ({ data, selected }) => (
  <BaseNode data={data} type="action" selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: '#A855F7' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#A855F7' }} />
    <div>{data.actions?.map(a => a.type).join(', ') || '—'}</div>
  </BaseNode>
);

export const InputNode = ({ data, selected }) => (
  <BaseNode data={data} type="input" selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: '#3B82F6' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#3B82F6' }} />
    <div>Save to: <strong>{data.inputField || 'userInput'}</strong></div>
  </BaseNode>
);

export const DelayNode = ({ data, selected }) => (
  <BaseNode data={data} type="delay" selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: '#94A3B8' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#94A3B8' }} />
    <div>{data.delay?.value} {data.delay?.unit}</div>
  </BaseNode>
);

export const EndNode = ({ data, selected }) => (
  <BaseNode data={data} type="end" selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: '#F43F5E' }} />
    <div style={{ color: '#BE123C', fontWeight: 600 }}>Flow ends here</div>
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
