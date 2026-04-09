// FlowSidebar.jsx - draggable node palette
import React from 'react';

const NODE_PALETTE = [
  { type: 'trigger', icon: '⚡', label: 'Trigger', desc: 'Start the flow', color: '#6366F1' },
  { type: 'message', icon: '💬', label: 'Send Message', desc: 'Text, image, buttons', color: '#22C55E' },
  { type: 'condition', icon: '◈', label: 'Condition', desc: 'Branch on tag/field', color: '#F59E0B' },
  { type: 'action', icon: '⚙', label: 'Action', desc: 'Tag, set field, webhook', color: '#A855F7' },
  { type: 'input', icon: '✎', label: 'User Input', desc: 'Wait & save reply', color: '#3B82F6' },
  { type: 'delay', icon: '⏱', label: 'Delay', desc: 'Wait before next step', color: '#94A3B8' },
  { type: 'end', icon: '■', label: 'End', desc: 'Finish the flow', color: '#F43F5E' },
];

export default function FlowSidebar() {
  const onDragStart = (e, type) => {
    e.dataTransfer.setData('nodeType', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{ width: 200, background: '#fff', borderRight: '1px solid #E2E8F0', padding: 12, overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Nodes
      </div>
      {NODE_PALETTE.map(n => (
        <div key={n.type}
          draggable
          onDragStart={e => onDragStart(e, n.type)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 8, marginBottom: 4,
            border: '1px solid #E2E8F0', cursor: 'grab', background: '#fff',
            transition: 'all 0.12s',
            userSelect: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F8F9FC'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          <span style={{ fontSize: 16 }}>{n.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{n.label}</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{n.desc}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20, padding: '10px', background: '#F8F9FC', borderRadius: 8, fontSize: 11, color: '#94A3B8', lineHeight: 1.5 }}>
        💡 Drag nodes onto the canvas. Connect them by dragging from the circle handles.
      </div>
    </div>
  );
}
