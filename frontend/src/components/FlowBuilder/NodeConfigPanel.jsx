import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

const inputSt = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none',
};
const labelSt = { fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 };
const sectionSt = { marginBottom: 16 };
const subLabelSt = { fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 4 };
const addBtnSt = {
  fontSize: 11, color: '#6366F1', background: 'none', border: 'none',
  cursor: 'pointer', padding: '4px 0', display: 'block',
};

const NODE_TYPE_LABELS = {
  trigger: '觸發器',
  message: '發送訊息',
  condition: '條件判斷',
  action: '動作',
  input: '等待回覆',
  delay: '延遲',
  end: '結束',
};

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
      {/* 標頭 */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>
          設定 {NODE_TYPE_LABELS[node.type] || node.type}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onDelete(node.id)}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>
            刪除
          </button>
          <button onClick={onClose}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>
            ×
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* 節點名稱 */}
        <div style={sectionSt}>
          <label style={labelSt}>節點名稱</label>
          <input style={inputSt} value={data.label || ''} onChange={e => save({ label: e.target.value })} placeholder="名稱..." />
        </div>

        {node.type === 'trigger' && <TriggerConfig data={data} save={save} />}
        {node.type === 'message' && <MessageConfig data={data} save={save} />}
        {node.type === 'condition' && <ConditionConfig data={data} save={save} />}
        {node.type === 'action' && <ActionConfig data={data} save={save} />}
        {node.type === 'input' && <InputConfig data={data} save={save} />}
        {node.type === 'delay' && (
          <div style={sectionSt}>
            <label style={labelSt}>延遲時間</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min={1} style={{ ...inputSt, width: 80 }}
                value={data.delay?.value || 1}
                onChange={e => save({ delay: { ...data.delay, value: Number(e.target.value) } })} />
              <select style={inputSt}
                value={data.delay?.unit || 'seconds'}
                onChange={e => save({ delay: { ...data.delay, unit: e.target.value } })}>
                <option value="seconds">秒</option>
                <option value="minutes">分鐘</option>
                <option value="hours">小時</option>
                <option value="days">天</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 觸發器 ───────────────────────────────────────────────────
function TriggerConfig({ data, save }) {
  const t = data.trigger || {};
  const set = (k, v) => save({ trigger: { ...t, [k]: v } });

  return (
    <>
      <div style={sectionSt}>
        <label style={labelSt}>觸發類型</label>
        <select style={inputSt} value={t.type || 'keyword'} onChange={e => set('type', e.target.value)}>
          <option value="any">任意訊息（所有訊息均觸發）</option>
          <option value="keyword">關鍵字</option>
          <option value="follow">加入好友</option>
          <option value="unfollow">封鎖／取消追蹤</option>
          <option value="postback">按鈕回傳</option>
        </select>
      </div>

      {t.type === 'keyword' && (
        <>
          <div style={sectionSt}>
            <label style={labelSt}>關鍵字（以逗號分隔）</label>
            <input style={inputSt}
              value={(t.keywords || []).join(', ')}
              onChange={e => set('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="你好, 嗨, 開始, 填寫問卷" />
          </div>
          <div style={sectionSt}>
            <label style={labelSt}>比對模式</label>
            <select style={inputSt} value={t.matchMode || 'contains'} onChange={e => set('matchMode', e.target.value)}>
              <option value="contains">包含關鍵字</option>
              <option value="exact">完全符合</option>
              <option value="startsWith">開頭符合</option>
            </select>
          </div>
        </>
      )}

      {t.type === 'postback' && (
        <div style={sectionSt}>
          <label style={labelSt}>按鈕回傳值（payload）</label>
          <input style={inputSt} value={t.postbackPayload || ''} onChange={e => set('postbackPayload', e.target.value)} placeholder="PAYLOAD_VALUE" />
        </div>
      )}

      {t.type === 'any' && (
        <div style={{ fontSize: 12, color: '#64748B', background: '#F8F9FC', borderRadius: 8, padding: '8px 12px' }}>
          任何使用者傳來的訊息都會觸發此流程（適合作為預設歡迎流程）
        </div>
      )}
    </>
  );
}

// ─── 發送訊息 ─────────────────────────────────────────────────
function MessageConfig({ data, save }) {
  const msgs = data.messages || [{ type: 'text', text: '' }];

  const updateMsg = (i, field, val) => {
    save({ messages: msgs.map((m, idx) => idx === i ? { ...m, [field]: val } : m) });
  };
  const addMsg = () => save({ messages: [...msgs, { type: 'text', text: '' }] });
  const removeMsg = (i) => save({ messages: msgs.filter((_, idx) => idx !== i) });

  const addQR = (i) => {
    const qrs = msgs[i].quickReplies || [];
    if (qrs.length >= 13) return;
    updateMsg(i, 'quickReplies', [...qrs, { label: '', text: '' }]);
  };
  const updateQR = (mi, qi, field, val) => {
    const qrs = (msgs[mi].quickReplies || []).map((qr, j) => j === qi ? { ...qr, [field]: val } : qr);
    updateMsg(mi, 'quickReplies', qrs);
  };
  const removeQR = (mi, qi) => {
    updateMsg(mi, 'quickReplies', (msgs[mi].quickReplies || []).filter((_, j) => j !== qi));
  };

  const addBtn = (i) => {
    const btns = msgs[i].template?.buttons || [];
    if (btns.length >= 3) return;
    updateMsg(i, 'template', { ...msgs[i].template, buttons: [...btns, { label: '', text: '' }] });
  };
  const updateBtn = (mi, bi, field, val) => {
    const btns = (msgs[mi].template?.buttons || []).map((b, j) => j === bi ? { ...b, [field]: val } : b);
    updateMsg(mi, 'template', { ...msgs[mi].template, buttons: btns });
  };
  const removeBtn = (mi, bi) => {
    updateMsg(mi, 'template', { ...msgs[mi].template, buttons: (msgs[mi].template?.buttons || []).filter((_, j) => j !== bi) });
  };

  const MSG_TYPES = [['text', '文字'], ['image', '圖片'], ['video', '影片'], ['buttons', '按鈕範本'], ['carousel', '輪播']];

  return (
    <>
      {msgs.map((msg, i) => (
        <div key={i} style={{ background: '#F8F9FC', borderRadius: 8, padding: 10, marginBottom: 10, border: '1px solid #E2E8F0' }}>
          {/* 類型選擇 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <select style={{ ...inputSt, width: 'auto', fontSize: 12 }} value={msg.type}
              onChange={e => updateMsg(i, 'type', e.target.value)}>
              {MSG_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {msgs.length > 1 && (
              <button onClick={() => removeMsg(i)} style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            )}
          </div>

          {/* 文字訊息 */}
          {msg.type === 'text' && (
            <>
              <textarea style={{ ...inputSt, minHeight: 80, resize: 'vertical' }}
                value={msg.text || ''} onChange={e => updateMsg(i, 'text', e.target.value)}
                placeholder={'訊息內容...\n可使用 {{contact.name}}、{{var.欄位名}} 個人化'} />

              {/* 快速回覆按鈕 */}
              <div style={{ marginTop: 8 }}>
                <div style={subLabelSt}>快速回覆按鈕（最多 13 個）</div>
                {(msg.quickReplies || []).map((qr, qi) => (
                  <div key={qi} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input style={{ ...inputSt, flex: 1, minWidth: 0, fontSize: 12 }} value={qr.label ?? ''}
                      onChange={e => updateQR(i, qi, 'label', e.target.value)} placeholder="按鈕文字" />
                    <input style={{ ...inputSt, flex: 1, minWidth: 0, fontSize: 12 }} value={qr.text ?? ''}
                      onChange={e => updateQR(i, qi, 'text', e.target.value)} placeholder="回傳值" />
                    <button onClick={() => removeQR(i, qi)} style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', flexShrink: 0 }}>×</button>
                  </div>
                ))}
                {(msg.quickReplies || []).length < 13 && (
                  <button onClick={() => addQR(i)} style={addBtnSt}>+ 新增快速回覆</button>
                )}
              </div>
            </>
          )}

          {/* 圖片 */}
          {msg.type === 'image' && (
            <MediaUpload
              label="圖片"
              accept="image/jpeg,image/png,image/gif,image/webp"
              url={msg.imageUrl || ''}
              onUrl={url => updateMsg(i, 'imageUrl', url)}
              preview="image"
            />
          )}

          {/* 影片 */}
          {msg.type === 'video' && (
            <>
              <MediaUpload
                label="影片（MP4）"
                accept="video/mp4,video/quicktime"
                url={msg.videoUrl || ''}
                onUrl={url => updateMsg(i, 'videoUrl', url)}
                preview="video"
              />
              <div style={{ marginTop: 8 }}>
                <MediaUpload
                  label="預覽縮圖（JPEG/PNG）"
                  accept="image/jpeg,image/png,image/webp"
                  url={msg.imageUrl || ''}
                  onUrl={url => updateMsg(i, 'imageUrl', url)}
                  preview="image"
                />
              </div>
            </>
          )}

          {/* 按鈕範本 */}
          {msg.type === 'buttons' && (
            <>
              <textarea style={{ ...inputSt, marginBottom: 8, minHeight: 60, resize: 'vertical' }}
                value={msg.text || ''} onChange={e => updateMsg(i, 'text', e.target.value)}
                placeholder="按鈕訊息文字..." />
              <div style={subLabelSt}>按鈕（最多 3 個）</div>
              {(msg.template?.buttons || []).map((btn, bi) => (
                <div key={bi} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input style={{ ...inputSt, flex: 1, fontSize: 12 }} value={btn.label || ''}
                    onChange={e => updateBtn(i, bi, 'label', e.target.value)} placeholder="按鈕文字" />
                  <input style={{ ...inputSt, flex: 1, fontSize: 12 }} value={btn.text || ''}
                    onChange={e => updateBtn(i, bi, 'text', e.target.value)} placeholder="回傳文字" />
                  <button onClick={() => removeBtn(i, bi)} style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', flexShrink: 0 }}>×</button>
                </div>
              ))}
              {(msg.template?.buttons || []).length < 3 && (
                <button onClick={() => addBtn(i)} style={addBtnSt}>+ 新增按鈕</button>
              )}
            </>
          )}
        </div>
      ))}
      <button onClick={addMsg} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
        + 新增訊息
      </button>
    </>
  );
}

// ─── 條件判斷 ─────────────────────────────────────────────────
function ConditionConfig({ data, save }) {
  const conds = data.conditions || [];

  const addCond = () => save({ conditions: [...conds, { field: 'tags', operator: 'contains', value: '' }] });
  const updateCond = (i, k, v) => save({ conditions: conds.map((c, idx) => idx === i ? { ...c, [k]: v } : c) });
  const removeCond = (i) => save({ conditions: conds.filter((_, idx) => idx !== i) });

  // 解析欄位類型和子名稱
  const getFieldType = (field) => {
    if (!field) return 'tags';
    if (field.startsWith('customField.')) return 'customField';
    if (field.startsWith('var.')) return 'var';
    return field;
  };
  const getFieldSub = (field) => {
    if (!field) return '';
    if (field.startsWith('customField.') || field.startsWith('var.')) return field.split('.').slice(1).join('.');
    return '';
  };

  const FIELD_OPTIONS = [
    ['tags', '標籤'],
    ['platform', '平台'],
    ['isFollowing', '已關注'],
    ['customField', '自訂欄位（customField）'],
    ['var', '流程變數（var）'],
  ];

  const OPERATOR_OPTIONS = [
    ['contains', '包含'],
    ['notContains', '不包含'],
    ['equals', '等於'],
    ['notEquals', '不等於'],
    ['exists', '已存在（不比較值）'],
    ['greaterThan', '大於'],
    ['lessThan', '小於'],
  ];

  return (
    <>
      <div style={sectionSt}>
        <label style={labelSt}>條件邏輯</label>
        <select style={inputSt} value={data.conditionMode || 'and'} onChange={e => save({ conditionMode: e.target.value })}>
          <option value="and">所有條件都符合（AND）</option>
          <option value="or">任一條件符合（OR）</option>
        </select>
      </div>

      {conds.length === 0 && (
        <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
          尚未設定條件，點下方新增
        </div>
      )}

      {conds.map((c, i) => {
        const ft = getFieldType(c.field);
        const fsub = getFieldSub(c.field);
        return (
          <div key={i} style={{ background: '#F8F9FC', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid #E2E8F0' }}>
            {/* 欄位類型 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={subLabelSt}>判斷欄位</div>
                <select style={inputSt} value={ft}
                  onChange={e => {
                    const newFt = e.target.value;
                    let newField = newFt;
                    if (newFt === 'customField') newField = 'customField.';
                    else if (newFt === 'var') newField = 'var.';
                    updateCond(i, 'field', newField);
                  }}>
                  {FIELD_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button onClick={() => removeCond(i)}
                style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', alignSelf: 'flex-end', paddingBottom: 6, flexShrink: 0 }}>
                ×
              </button>
            </div>

            {/* 子欄位名（自訂欄位或變數） */}
            {(ft === 'customField' || ft === 'var') && (
              <div style={{ marginBottom: 6 }}>
                <div style={subLabelSt}>{ft === 'customField' ? '欄位名稱' : '變數名稱'}</div>
                <input style={inputSt} value={fsub}
                  onChange={e => updateCond(i, 'field', `${ft}.${e.target.value}`)}
                  placeholder={ft === 'customField' ? '例如：city、maritalStatus' : '例如：answer、phone'} />
              </div>
            )}

            {/* 平台選項提示 */}
            {ft === 'platform' && (
              <div style={{ marginBottom: 6 }}>
                <div style={subLabelSt}>比較值提示：line / messenger</div>
              </div>
            )}

            {/* 運算子 */}
            <div style={{ marginBottom: 6 }}>
              <div style={subLabelSt}>運算子</div>
              <select style={inputSt} value={c.operator} onChange={e => updateCond(i, 'operator', e.target.value)}>
                {OPERATOR_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* 比較值 */}
            {c.operator !== 'exists' && (
              <div>
                <div style={subLabelSt}>比較值</div>
                <input style={inputSt} value={c.value || ''}
                  onChange={e => updateCond(i, 'value', e.target.value)}
                  placeholder={ft === 'tags' ? '標籤名稱' : '比較值...'} />
              </div>
            )}
          </div>
        );
      })}

      <button onClick={addCond} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
        + 新增條件
      </button>

      {/* 說明 */}
      <div style={{ marginTop: 12, padding: '8px 10px', background: '#F0F9FF', borderRadius: 8, fontSize: 11, color: '#0369A1', lineHeight: 1.5 }}>
        <strong>True 分支</strong>（綠色）：條件符合時走此路<br/>
        <strong>False 分支</strong>（紅色）：條件不符合時走此路<br/>
        變數使用 <code>var.欄位名</code>，例如 <code>var.maritalStatus</code>
      </div>
    </>
  );
}

// ─── 動作 ─────────────────────────────────────────────────────
function ActionConfig({ data, save }) {
  const actions = data.actions || [];
  const addAction = () => save({ actions: [...actions, { type: 'addTag', tag: '' }] });
  const updateAction = (i, k, v) => save({ actions: actions.map((a, idx) => idx === i ? { ...a, [k]: v } : a) });
  const removeAction = (i) => save({ actions: actions.filter((_, idx) => idx !== i) });

  const ACTION_TYPES = [
    ['addTag', '新增標籤'],
    ['removeTag', '移除標籤'],
    ['setField', '設定自訂欄位'],
    ['unsubscribe', '取消訂閱'],
    ['triggerFlow', '觸發另一個流程'],
    ['webhookCall', '呼叫 Webhook'],
  ];

  return (
    <>
      {actions.map((a, i) => (
        <div key={i} style={{ background: '#F8F9FC', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <select style={{ ...inputSt, flex: 1 }} value={a.type} onChange={e => updateAction(i, 'type', e.target.value)}>
              {ACTION_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={() => removeAction(i)} style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>

          {(a.type === 'addTag' || a.type === 'removeTag') && (
            <input style={inputSt} value={a.tag || ''} onChange={e => updateAction(i, 'tag', e.target.value)}
              placeholder="標籤名稱（例如：已填問卷）" />
          )}

          {a.type === 'setField' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input style={inputSt} value={a.field || ''} onChange={e => updateAction(i, 'field', e.target.value)}
                placeholder="欄位名稱（例如：city）" />
              <input style={inputSt} value={a.value || ''} onChange={e => updateAction(i, 'value', e.target.value)}
                placeholder="值（可使用 {{var.xxx}}）" />
            </div>
          )}

          {a.type === 'webhookCall' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input style={inputSt} value={a.webhookUrl || ''} onChange={e => updateAction(i, 'webhookUrl', e.target.value)}
                placeholder="https://..." />
              <select style={inputSt} value={a.webhookMethod || 'POST'} onChange={e => updateAction(i, 'webhookMethod', e.target.value)}>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
          )}
        </div>
      ))}
      <button onClick={addAction} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
        + 新增動作
      </button>
    </>
  );
}

// ─── 媒體上傳元件 ─────────────────────────────────────────────
function MediaUpload({ label, accept, url, onUrl, preview }) {
  const fileRef = useRef();
  const galleryFileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const mediaType = accept?.includes('video') && !accept?.includes('image') ? 'video' : 'image';

  const doUpload = async (file) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  };

  // 直接上傳（不開圖庫）
  const handleDirectUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const data = await doUpload(file);
      onUrl(data.url);
    } catch (err) {
      setError(err.response?.data?.error || '上傳失敗');
    }
    setUploading(false);
    e.target.value = '';
  };

  // 從圖庫上傳新圖片
  const handleGalleryUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await doUpload(file);
      setGallery(prev => [{ url: data.url, filename: data.filename, type: data.type }, ...prev]);
      onUrl(data.url);
      setShowGallery(false);
    } catch (err) {
      setError(err.response?.data?.error || '上傳失敗');
    }
    setUploading(false);
    e.target.value = '';
  };

  const openGallery = async () => {
    setShowGallery(true);
    setLoadingGallery(true);
    try {
      const { data } = await api.get(`/upload/list?type=${mediaType}`);
      setGallery(data.files);
    } catch (_) {}
    setLoadingGallery(false);
  };

  return (
    <div>
      <div style={subLabelSt}>{label}</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
        <input
          style={{ ...inputSt, flex: 1, fontSize: 12 }}
          value={url}
          onChange={e => onUrl(e.target.value)}
          placeholder="貼入 URL 或選擇 / 上傳"
        />
        <button onClick={openGallery} style={{
          flexShrink: 0, padding: '4px 9px', borderRadius: 6,
          border: '1px solid #6366F1', background: '#EEF2FF',
          cursor: 'pointer', fontSize: 11, color: '#6366F1', whiteSpace: 'nowrap',
        }}>圖庫</button>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
          flexShrink: 0, padding: '4px 9px', borderRadius: 6,
          border: '1px solid #E2E8F0', background: '#F8F9FC',
          cursor: 'pointer', fontSize: 11, color: '#374151', whiteSpace: 'nowrap',
        }}>{uploading ? '上傳中…' : '上傳'}</button>
        <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleDirectUpload} />
      </div>
      {error && <div style={{ fontSize: 11, color: '#DC2626', marginBottom: 4 }}>{error}</div>}
      {url && preview === 'image' && (
        <img src={url} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 6, border: '1px solid #E2E8F0' }}
          onError={e => { e.target.style.display = 'none'; }} onLoad={e => { e.target.style.display = 'block'; }} />
      )}
      {url && preview === 'video' && (
        <video src={url} controls style={{ width: '100%', maxHeight: 120, borderRadius: 6, border: '1px solid #E2E8F0' }} />
      )}

      {/* 圖庫 Modal */}
      {showGallery && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowGallery(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* 標頭 */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>選擇圖片</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => galleryFileRef.current?.click()} disabled={uploading} style={{
                  padding: '6px 14px', borderRadius: 7, background: '#6366F1', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>
                  {uploading ? '上傳中…' : '+ 上傳新圖片'}
                </button>
                <button onClick={() => setShowGallery(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94A3B8', lineHeight: 1 }}>×</button>
              </div>
              <input ref={galleryFileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleGalleryUpload} />
            </div>

            {/* 圖片格 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {loadingGallery ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#94A3B8', fontSize: 13 }}>載入中…</div>
              ) : gallery.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
                  <div style={{ fontSize: 13, color: '#94A3B8' }}>尚無上傳的圖片</div>
                  <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>點上方按鈕上傳第一張</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {gallery.map((f, i) => (
                    <div key={i}
                      onClick={() => { onUrl(f.url); setShowGallery(false); }}
                      title={f.filename}
                      style={{
                        aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#F1F5F9',
                        border: url === f.url ? '3px solid #6366F1' : '2px solid transparent',
                        boxSizing: 'border-box',
                      }}>
                      <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 等待回覆 ─────────────────────────────────────────────────
function InputConfig({ data, save }) {
  return (
    <>
      <div style={{ fontSize: 12, color: '#64748B', background: '#F0F9FF', borderRadius: 8, padding: '8px 12px', marginBottom: 12, lineHeight: 1.5 }}>
        先發送提示訊息，然後等待使用者回覆，並將回覆儲存為變數。
      </div>
      <MessageConfig data={data} save={save} />
      <div style={sectionSt}>
        <label style={labelSt}>儲存回覆至變數名稱</label>
        <input style={inputSt} value={data.inputField || ''}
          onChange={e => save({ inputField: e.target.value })}
          placeholder="例如：phone、city、answer" />
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
          之後可用 {'{{var.' + (data.inputField || '變數名') + '}}'} 引用此回覆
        </div>
      </div>
      <div style={sectionSt}>
        <label style={labelSt}>輸入類型</label>
        <select style={inputSt} value={data.inputType || 'text'} onChange={e => save({ inputType: e.target.value })}>
          <option value="text">任意文字</option>
          <option value="number">數字</option>
          <option value="email">電子信箱</option>
          <option value="phone">電話號碼</option>
          <option value="date">日期</option>
        </select>
      </div>
    </>
  );
}
