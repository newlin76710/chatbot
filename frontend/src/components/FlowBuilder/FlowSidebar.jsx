// FlowSidebar.jsx - 可拖曳節點面板
import React from 'react';

const NODE_PALETTE = [
  { type: 'trigger', icon: '⚡', label: '觸發器', desc: '開始流程', color: '#6366F1' },
  { type: 'message', icon: '💬', label: '發送訊息', desc: '文字、圖片、按鈕', color: '#22C55E' },
  { type: 'condition', icon: '◈', label: '條件判斷', desc: '依標籤或欄位分流', color: '#F59E0B' },
  { type: 'action', icon: '⚙', label: '動作', desc: '標籤、設定欄位、Webhook', color: '#A855F7' },
  { type: 'input', icon: '✎', label: '等待回覆', desc: '等待並儲存回覆', color: '#3B82F6' },
  { type: 'delay', icon: '⏱', label: '延遲', desc: '等待後繼續執行', color: '#94A3B8' },
  { type: 'end', icon: '■', label: '結束', desc: '結束流程', color: '#F43F5E' },
];

export default function FlowSidebar() {
  const onDragStart = (e, type) => {
    e.dataTransfer.setData('nodeType', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{ width: 200, background: '#fff', borderRight: '1px solid #E2E8F0', padding: 12, overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        節點
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
        💡 將節點拖曳至畫布，透過拖曳圓形控制點連接節點。
      </div>
    </div>
  );
}
