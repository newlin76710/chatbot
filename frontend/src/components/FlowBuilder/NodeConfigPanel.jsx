import React, { useState, useEffect } from 'react';

const inputSt = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none',
};
const labelSt = { fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 };
const sectionSt = { marginBottom: 16 };

export default function NodeConfigPanel({ node, onUpdate, onDelete, onClose }) {
  const [data, setData] = useState(node.data);

  useEffect(() => { setData(node.data); }, [node.id]);

  const save = (updates) => {
    const updated = { ...data, ...updates };
    setData(updated);
    onUpdate(node.id, updated);
  };

  return (
    <div style={{ width: 300, background: '#fff', borderLeft: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#0F172A', textTransform: 'capitalize' }}>
          Configure {node.type}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onDelete(node.id)}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>
            Delete
          </button>
          <button onClick={onClose}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>
            ×
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Label */}
        <div style={sectionSt}>
          <label style={labelSt}>Node Label</label>
          <input style={inputSt} value={data.label || ''} onChange={e => save({ label: e.target.value })} placeholder="Label..." />
        </div>

        {/* TRIGGER */}
        {node.type === 'trigger' && (
          <TriggerConfig data={data} save={save} />
        )}

        {/* MESSAGE */}
        {node.type === 'message' && (
          <MessageConfig data={data} save={save} />
        )}

        {/* CONDITION */}
        {node.type === 'condition' && (
          <ConditionConfig data={data} save={save} />
        )}

        {/* ACTION */}
        {node.type === 'action' && (
          <ActionConfig data={data} save={save} />
        )}

        {/* INPUT */}
        {node.type === 'input' && (
          <InputConfig data={data} save={save} />
        )}

        {/* DELAY */}
        {node.type === 'delay' && (
          <div style={sectionSt}>
            <label style={labelSt}>Delay</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min={1} style={{ ...inputSt, width: 80 }}
                value={data.delay?.value || 1}
                onChange={e => save({ delay: { ...data.delay, value: Number(e.target.value) } })} />
              <select style={inputSt}
                value={data.delay?.unit || 'seconds'}
                onChange={e => save({ delay: { ...data.delay, unit: e.target.value } })}>
                {['seconds','minutes','hours','days'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TriggerConfig({ data, save }) {
  const t = data.trigger || {};
  const set = (k, v) => save({ trigger: { ...t, [k]: v } });
  return (
    <>
      <div style={sectionSt}>
        <label style={labelSt}>Trigger Type</label>
        <select style={inputSt} value={t.type || 'keyword'} onChange={e => set('type', e.target.value)}>
          {['keyword','follow','unfollow','postback','referral'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      {t.type === 'keyword' && (
        <>
          <div style={sectionSt}>
            <label style={labelSt}>Keywords (comma separated)</label>
            <input style={inputSt} value={(t.keywords || []).join(', ')}
              onChange={e => set('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="hello, hi, start" />
          </div>
          <div style={sectionSt}>
            <label style={labelSt}>Match Mode</label>
            <select style={inputSt} value={t.matchMode || 'contains'} onChange={e => set('matchMode', e.target.value)}>
              {['contains','exact','startsWith'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </>
      )}
      {t.type === 'postback' && (
        <div style={sectionSt}>
          <label style={labelSt}>Postback Payload</label>
          <input style={inputSt} value={t.postbackPayload || ''} onChange={e => set('postbackPayload', e.target.value)} />
        </div>
      )}
    </>
  );
}

function MessageConfig({ data, save }) {
  const msgs = data.messages || [{ type: 'text', text: '' }];
  const update = (i, field, val) => {
    const next = msgs.map((m, idx) => idx === i ? { ...m, [field]: val } : m);
    save({ messages: next });
  };
  const add = () => save({ messages: [...msgs, { type: 'text', text: '' }] });
  const remove = (i) => save({ messages: msgs.filter((_, idx) => idx !== i) });

  return (
    <>
      {msgs.map((msg, i) => (
        <div key={i} style={{ background: '#F8F9FC', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <select style={{ ...inputSt, width: 'auto' }} value={msg.type}
              onChange={e => update(i, 'type', e.target.value)}>
              {['text','image','video','buttons','carousel'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            {msgs.length > 1 && (
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 16 }}>×</button>
            )}
          </div>
          {msg.type === 'text' && (
            <textarea style={{ ...inputSt, minHeight: 80, resize: 'vertical' }}
              value={msg.text || ''} onChange={e => update(i, 'text', e.target.value)}
              placeholder="Message text... Use {{contact.name}} for personalization" />
          )}
          {(msg.type === 'image' || msg.type === 'video') && (
            <input style={inputSt} value={msg.imageUrl || msg.videoUrl || ''}
              onChange={e => update(i, msg.type === 'image' ? 'imageUrl' : 'videoUrl', e.target.value)}
              placeholder={`${msg.type} URL...`} />
          )}
          {msg.type === 'buttons' && (
            <>
              <textarea style={{ ...inputSt, marginBottom: 6, minHeight: 60 }}
                value={msg.text || ''} onChange={e => update(i, 'text', e.target.value)}
                placeholder="Button message text..." />
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Button template (JSON): add to msg.template.buttons</div>
            </>
          )}
        </div>
      ))}
      <button onClick={add} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
        + Add Message
      </button>
    </>
  );
}

function ConditionConfig({ data, save }) {
  const conds = data.conditions || [];
  const addCond = () => save({ conditions: [...conds, { field: 'tags', operator: 'contains', value: '' }] });
  const updateCond = (i, k, v) => save({ conditions: conds.map((c, idx) => idx === i ? { ...c, [k]: v } : c) });
  const removeCond = (i) => save({ conditions: conds.filter((_, idx) => idx !== i) });

  return (
    <>
      <div style={sectionSt}>
        <label style={labelSt}>Match Mode</label>
        <select style={inputSt} value={data.conditionMode || 'and'} onChange={e => save({ conditionMode: e.target.value })}>
          <option value="and">All conditions (AND)</option>
          <option value="or">Any condition (OR)</option>
        </select>
      </div>
      {conds.map((c, i) => (
        <div key={i} style={{ background: '#F8F9FC', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <select style={{ ...inputSt, flex: 1 }} value={c.field} onChange={e => updateCond(i, 'field', e.target.value)}>
              <option value="tags">Tags</option>
              <option value="platform">Platform</option>
              <option value="isFollowing">Is Following</option>
              <option value="customField.name">Custom Field</option>
            </select>
            <button onClick={() => removeCond(i)} style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer' }}>×</button>
          </div>
          <select style={{ ...inputSt, marginBottom: 6 }} value={c.operator} onChange={e => updateCond(i, 'operator', e.target.value)}>
            {['contains','notContains','equals','notEquals','exists','greaterThan','lessThan'].map(v =>
              <option key={v} value={v}>{v}</option>)}
          </select>
          {c.operator !== 'exists' && (
            <input style={inputSt} value={c.value || ''} onChange={e => updateCond(i, 'value', e.target.value)} placeholder="Value..." />
          )}
        </div>
      ))}
      <button onClick={addCond} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
        + Add Condition
      </button>
    </>
  );
}

function ActionConfig({ data, save }) {
  const actions = data.actions || [];
  const addAction = () => save({ actions: [...actions, { type: 'addTag', tag: '' }] });
  const updateAction = (i, k, v) => save({ actions: actions.map((a, idx) => idx === i ? { ...a, [k]: v } : a) });
  const removeAction = (i) => save({ actions: actions.filter((_, idx) => idx !== i) });

  return (
    <>
      {actions.map((a, i) => (
        <div key={i} style={{ background: '#F8F9FC', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <select style={{ ...inputSt, flex: 1 }} value={a.type} onChange={e => updateAction(i, 'type', e.target.value)}>
              {['addTag','removeTag','setField','unsubscribe','triggerFlow','webhookCall'].map(v =>
                <option key={v} value={v}>{v}</option>)}
            </select>
            <button onClick={() => removeAction(i)} style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer' }}>×</button>
          </div>
          {(a.type === 'addTag' || a.type === 'removeTag') && (
            <input style={inputSt} value={a.tag || ''} onChange={e => updateAction(i, 'tag', e.target.value)} placeholder="Tag name..." />
          )}
          {a.type === 'setField' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...inputSt, flex: 1 }} value={a.field || ''} onChange={e => updateAction(i, 'field', e.target.value)} placeholder="Field name" />
              <input style={{ ...inputSt, flex: 1 }} value={a.value || ''} onChange={e => updateAction(i, 'value', e.target.value)} placeholder="Value" />
            </div>
          )}
          {a.type === 'webhookCall' && (
            <input style={inputSt} value={a.webhookUrl || ''} onChange={e => updateAction(i, 'webhookUrl', e.target.value)} placeholder="https://..." />
          )}
        </div>
      ))}
      <button onClick={addAction} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
        + Add Action
      </button>
    </>
  );
}

function InputConfig({ data, save }) {
  return (
    <>
      <MessageConfig data={data} save={save} />
      <div style={sectionSt}>
        <label style={labelSt}>Save reply to variable</label>
        <input style={inputSt} value={data.inputField || ''} onChange={e => save({ inputField: e.target.value })} placeholder="e.g. userName" />
      </div>
      <div style={sectionSt}>
        <label style={labelSt}>Input Type</label>
        <select style={inputSt} value={data.inputType || 'text'} onChange={e => save({ inputType: e.target.value })}>
          {['text','number','email','phone','date'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    </>
  );
}
