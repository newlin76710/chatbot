// ContactsPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const inputSt = { width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', boxSizing: 'border-box' };

// 欄位名稱 → 中文標籤對應表（可依需求自行新增）
const FIELD_LABELS = {
  maritalStatus: '感情狀態',
  city: '居住地區',
  birthYear: '出生年份',
  education: '學歷',
  heightWeight: '身高體重',
  occupation: '職業',
  phoneNumber: '手機號碼',
  name: '姓名',
  email: '電子郵件',
  gender: '性別',
  age: '年齡',
  address: '地址',
  note: '備註',
};

function fieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

export function ContactsPage() {
  const { activeChannelId, channelsReady } = useChannelStore();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 收集資料編輯狀態
  const [activeTab, setActiveTab] = useState('data');
  const [editingFields, setEditingFields] = useState(false);

  const historyBottomRef = useRef(null);

  // 切到對話紀錄 tab 或切換聯絡人時，自動捲到最新訊息
  useEffect(() => {
    if (activeTab === 'history') {
      setTimeout(() => historyBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [activeTab, selected?._id]);
  const [fieldDraft, setFieldDraft] = useState({}); // { key: value }
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldVal, setNewFieldVal] = useState('');
  const [savingFields, setSavingFields] = useState(false);

  const selectContact = async (c) => {
    setEditingFields(false);
    setActiveTab('data');
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/contacts/${c._id}`);
      setSelected(data.contact);
      setFieldDraft(data.contact.customFields || {});
    } catch {
      setSelected(c);
      setFieldDraft(c.customFields || {});
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!channelsReady || !activeChannelId) return;
    api.get(`/contacts/tags/list?channelId=${activeChannelId}`)
      .then(r => setAllTags(r.data.tags)).catch(() => {});
  }, [channelsReady, activeChannelId]);

  useEffect(() => {
    if (!channelsReady || !activeChannelId) return;
    const params = new URLSearchParams({ channelId: activeChannelId, page, limit: 50 });
    if (search) params.append('search', search);
    if (filterTag) params.append('tag', filterTag);
    api.get(`/contacts?${params}`).then(r => { setContacts(r.data.contacts); setTotal(r.data.total); });
  }, [channelsReady, activeChannelId, page, search, filterTag]);

  const handleTagAction = async (contactId, type, tag) => {
    try {
      const { data } = await api.patch(`/contacts/${contactId}/tags`, {
        [type === 'add' ? 'add' : 'remove']: [tag]
      });
      setContacts(cs => cs.map(c => c._id === contactId ? { ...c, tags: data.contact.tags } : c));
      if (selected?._id === contactId) setSelected(prev => ({ ...prev, tags: data.contact.tags }));
    } catch { toast.error('操作失敗'); }
  };

  const handleSaveFields = async () => {
    setSavingFields(true);
    try {
      // 若有新欄位待加入
      const allFields = { ...fieldDraft };
      if (newFieldKey.trim()) allFields[newFieldKey.trim()] = newFieldVal;

      const { data } = await api.patch(`/contacts/${selected._id}/fields`, { fields: allFields });
      setSelected(prev => ({ ...prev, customFields: data.customFields }));
      setFieldDraft(data.customFields);
      setNewFieldKey('');
      setNewFieldVal('');
      setEditingFields(false);
      toast.success('已儲存');
    } catch { toast.error('儲存失敗'); }
    finally { setSavingFields(false); }
  };

  const handleDeleteField = (key) => {
    setFieldDraft(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>聯絡人</h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>{total.toLocaleString()} 位訂閱者</p>
      </div>

      {/* 篩選列 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input style={{ flex: 1, maxWidth: 280, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }}
          placeholder="搜尋姓名或 ID..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }}>
          <option value="">所有標籤</option>
          {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* 列表 */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F9FC' }}>
                {['聯絡人','平台','標籤','最近互動'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={c._id}
                  onClick={() => selectContact(c)}
                  style={{ borderTop: i === 0 ? 'none' : '1px solid #F1F5F9', cursor: 'pointer', background: selected?._id === c._id ? '#F8F9FF' : 'transparent' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF2FF', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#6366F1' }}>
                        {c.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{c.displayName || '未知'}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', wordBreak: 'break-all' }}>{c.platformId}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500,
                      background: c.platform === 'line' ? '#F0FDF4' : c.platform === 'instagram' ? '#FFF0F5' : '#EFF6FF',
                      color: c.platform === 'line' ? '#15803D' : c.platform === 'instagram' ? '#E1306C' : '#1D4ED8' }}>
                      {c.platform}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.tags?.slice(0, 3).map(t => (
                        <span key={t} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#F1F5F9', color: '#475569' }}>#{t}</span>
                      ))}
                      {c.tags?.length > 3 && <span style={{ fontSize: 10, color: '#94A3B8' }}>+{c.tags.length - 3}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B' }}>
                    {c.lastInteractedAt ? format(new Date(c.lastInteractedAt), 'MM/dd') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 詳情面板 */}
        {selected && (
          <div style={{ width: 320, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, flexShrink: 0, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>
                聯絡人詳情{loadingDetail && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>載入中…</span>}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8' }}>×</button>
            </div>

            {/* 基本資料 */}
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EEF2FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#6366F1', marginBottom: 8 }}>
                {selected.displayName?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#0F172A' }}>{selected.displayName}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{selected.platform}</div>
            </div>

            {/* 分頁切換 */}
            <div style={{ display: 'flex', marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              {[{ key: 'data', label: '資料' }, { key: 'history', label: '對話紀錄' }].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: activeTab === tab.key ? '#6366F1' : '#fff',
                  color: activeTab === tab.key ? '#fff' : '#64748B',
                }}>{tab.label}</button>
              ))}
            </div>
            {/* 資料分頁 */}
            {activeTab === 'data' && (
              <>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 16 }}>
                  <div style={{ padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ color: '#94A3B8', marginBottom: 2 }}>帳號 ID</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{selected.platformId}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#94A3B8' }}>語言</span>
                    <span>{selected.language || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ color: '#94A3B8' }}>關注中</span>
                    <span style={{ color: selected.isFollowing ? '#22C55E' : '#F43F5E' }}>
                      {selected.isFollowing ? '是' : '否'}
                    </span>
                  </div>
                </div>

                {/* 問卷收集資料 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>問卷收集資料</div>
                    {!editingFields
                      ? <button onClick={() => { setEditingFields(true); setFieldDraft(selected.customFields || {}); }}
                          style={{ fontSize: 11, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>編輯</button>
                      : <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditingFields(false)}
                            style={{ fontSize: 11, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>取消</button>
                          <button onClick={handleSaveFields} disabled={savingFields}
                            style={{ fontSize: 11, color: '#fff', background: '#6366F1', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 8px' }}>
                            {savingFields ? '儲存中…' : '儲存'}
                          </button>
                        </div>
                    }
                  </div>

                  {!editingFields ? (
                    Object.keys(selected.customFields || {}).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(selected.customFields).map(([key, value]) => (
                          <div key={key} style={{ background: '#F8F9FC', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                              {fieldLabel(key)}
                              {FIELD_LABELS[key] ? <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 4, color: '#CBD5E1' }}>({key})</span> : null}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', wordBreak: 'break-word' }}>{String(value ?? '—')}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '18px 0', background: '#F8F9FC', borderRadius: 8 }}>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>📋</div>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>尚未收集到任何資料</div>
                        <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>流程執行後資料將顯示於此</div>
                      </div>
                    )
                  ) : (
                    <div>
                      {Object.entries(fieldDraft).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{fieldLabel(key)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input style={{ ...inputSt, flex: 1 }} value={value ?? ''}
                              onChange={e => setFieldDraft(prev => ({ ...prev, [key]: e.target.value }))} />
                            <button onClick={() => handleDeleteField(key)}
                              style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 16, flexShrink: 0, lineHeight: 1 }}>×</button>
                          </div>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: 8, marginTop: 4 }}>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>新增欄位</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input style={{ ...inputSt, flex: '0 0 90px' }} value={newFieldKey}
                            onChange={e => setNewFieldKey(e.target.value)} placeholder="欄位名稱" />
                          <input style={{ ...inputSt, flex: 1 }} value={newFieldVal}
                            onChange={e => setNewFieldVal(e.target.value)} placeholder="值" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 標籤 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>標籤</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {selected.tags?.map(t => (
                      <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F1F5F9', color: '#475569' }}>
                        #{t}
                        <button onClick={() => handleTagAction(selected._id, 'remove', t)}
                          style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <input style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    placeholder="輸入標籤後按 Enter 新增..."
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        handleTagAction(selected._id, 'add', e.target.value.trim());
                        e.target.value = '';
                      }
                    }} />
                </div>
              </>
            )}

            {/* 對話紀錄分頁 */}
            {activeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(selected.conversationHistory || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>尚無對話紀錄</div>
                    <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>使用者傳訊後將自動記錄</div>
                  </div>
                ) : (
                  <>
                    {(selected.conversationHistory).map((msg, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row' : 'row-reverse', gap: 6, alignItems: 'flex-end' }}>
                        <div style={{
                          maxWidth: '78%',
                          padding: '7px 11px',
                          borderRadius: msg.role === 'user' ? '14px 14px 14px 3px' : '14px 14px 3px 14px',
                          background: msg.role === 'user' ? '#F1F5F9' : '#6366F1',
                          color: msg.role === 'user' ? '#0F172A' : '#fff',
                          fontSize: 12,
                          lineHeight: 1.55,
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {msg.content}
                        </div>
                        <div style={{ fontSize: 10, color: '#CBD5E1', flexShrink: 0, paddingBottom: 2 }}>
                          {msg.timestamp ? format(new Date(msg.timestamp), 'MM/dd HH:mm') : ''}
                        </div>
                      </div>
                    ))}
                    <div ref={historyBottomRef} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ChannelsPage.jsx
// ============================================================
export function ChannelsPage() {
  const { channels, fetchChannels, createChannel, deleteChannel } = useChannelStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', platform: 'line', accessToken: '', channelSecret: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createChannel({
        name: form.name, platform: form.platform,
        credentials: { accessToken: form.accessToken, channelSecret: form.channelSecret },
      });
      toast.success('頻道建立成功！');
      setShowForm(false);
      setForm({ name: '', platform: 'line', accessToken: '', channelSecret: '' });
    } catch { toast.error('操作失敗'); }
  };

  const PLATFORM_INFO = {
    line: { label: 'LINE', color: '#22C55E', bg: '#F0FDF4', docs: 'https://developers.line.biz' },
    messenger: { label: 'Messenger', color: '#3B82F6', bg: '#EFF6FF', docs: 'https://developers.facebook.com/docs/messenger-platform' },
    instagram: { label: 'Instagram', color: '#E1306C', bg: '#FFF0F5', docs: 'https://developers.facebook.com/docs/messenger-platform/instagram' },
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>頻道管理</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>連接 LINE、Messenger、Instagram 等平台</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: '9px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          + 新增頻道
        </button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 460 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>新增頻道</h2>
            <form onSubmit={handleSubmit}>
              {[
                { key: 'name', label: '頻道名稱', placeholder: '我的 LINE 機器人' },
                { key: 'accessToken', label: '頻道存取金鑰', placeholder: '長效存取金鑰' },
                { key: 'channelSecret', label: '頻道密鑰', placeholder: '頻道密鑰 / App 密鑰' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>{label}</label>
                  <input style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} required />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>平台</label>
                <select style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                  <option value="line">LINE</option>
                  <option value="messenger">Facebook Messenger</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
                <button type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>建立</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 16 }}>
        {channels.map(ch => {
          const pi = PLATFORM_INFO[ch.platform] || PLATFORM_INFO.line;
          return (
            <div key={ch._id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: pi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {ch.platform === 'line' ? '🟢' : ch.platform === 'instagram' ? '📷' : '🔵'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#0F172A' }}>{ch.name}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>{pi.label}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', borderRadius: 20, background: ch.isActive ? '#F0FDF4' : '#F1F5F9', color: ch.isActive ? '#15803D' : '#94A3B8', fontWeight: 500 }}>
                  {ch.isActive ? '啟用中' : '未啟用'}
                </span>
              </div>

              <div style={{ background: '#F8F9FC', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11, fontFamily: 'monospace', color: '#64748B', wordBreak: 'break-all' }}>
                Webhook: /webhook/{ch.platform}/{ch._id}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <a href={pi.docs} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#6366F1', textDecoration: 'none' }}>文件 ↗</a>
                <button onClick={() => { if (window.confirm('確定刪除此頻道？')) deleteChannel(ch._id); }}
                  style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>
                  刪除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ContactsPage;
