import React, { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

const SEGMENT_COLORS = ['#6366F1','#22C55E','#F59E0B','#F43F5E','#3B82F6','#A855F7','#14B8A6','#F97316'];
const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };

export default function SegmentsPage() {
  const { activeChannelId, channelsReady } = useChannelStore();
  const [segments, setSegments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [selectedSeg, setSelectedSeg] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  function defaultForm() {
    return { name: '', description: '', type: 'dynamic', rules: [{ field: 'tags', operator: 'contains', value: '' }], rulesMode: 'and', color: '#6366F1' };
  }

  useEffect(() => {
    if (!channelsReady || !activeChannelId) return;
    fetchSegments();
  }, [channelsReady, activeChannelId]);

  const fetchSegments = () =>
    api.get(`/segments?channelId=${activeChannelId}`).then(r => setSegments(r.data.segments));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, channelId: activeChannelId };
      if (editId) {
        await api.put(`/segments/${editId}`, payload);
        toast.success('分群已更新');
      } else {
        await api.post('/segments', payload);
        toast.success('分群已建立');
      }
      setShowForm(false); setEditId(null); setForm(defaultForm());
      fetchSegments();
    } catch (err) {
      toast.error(err.response?.data?.error || '操作失敗');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定刪除此分群？')) return;
    await api.delete(`/segments/${id}`);
    setSegments(s => s.filter(x => x._id !== id));
    if (selectedSeg?._id === id) setSelectedSeg(null);
    toast.success('已刪除');
  };

  const openEdit = (seg) => {
    setEditId(seg._id);
    setForm({ name: seg.name, description: seg.description || '', type: seg.type, rules: seg.rules || [], rulesMode: seg.rulesMode || 'and', color: seg.color });
    setShowForm(true);
  };

  const viewContacts = async (seg) => {
    setSelectedSeg(seg);
    setLoadingContacts(true);
    const { data } = await api.get(`/segments/${seg._id}/contacts`);
    setContacts(data.contacts);
    setLoadingContacts(false);
  };

  const addRule = () => setForm(f => ({ ...f, rules: [...f.rules, { field: 'tags', operator: 'contains', value: '' }] }));
  const updateRule = (i, k, v) => setForm(f => ({ ...f, rules: f.rules.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const removeRule = (i) => setForm(f => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }));

  return (
    <div style={{ padding: 32, display: 'flex', gap: 24 }}>
      {/* 左側：分群列表 */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>受眾分群</h1>
            <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>依行為與屬性分組聯絡人</p>
          </div>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(defaultForm()); }}
            style={{ padding: '9px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            + 新增分群
          </button>
        </div>

        {/* 表單 Modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>{editId ? '編輯' : '新增'}分群</h2>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>名稱</label>
                    <input style={inputSt} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>顏色</label>
                    <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                      {SEGMENT_COLORS.map(c => (
                        <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                          style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                            border: form.color === c ? '3px solid #0F172A' : '2px solid transparent' }} />
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>類型</label>
                  <select style={inputSt} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="dynamic">動態（自動依規則更新）</option>
                    <option value="static">靜態（手動管理）</option>
                  </select>
                </div>

                {form.type === 'dynamic' && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>篩選規則</label>
                      <select style={{ ...inputSt, width: 'auto', fontSize: 11 }} value={form.rulesMode}
                        onChange={e => setForm(f => ({ ...f, rulesMode: e.target.value }))}>
                        <option value="and">符合所有規則（AND）</option>
                        <option value="or">符合任一規則（OR）</option>
                      </select>
                    </div>
                    {form.rules.map((rule, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <select style={{ ...inputSt, flex: 1 }} value={rule.field} onChange={e => updateRule(i, 'field', e.target.value)}>
                          <option value="tags">標籤</option>
                          <option value="platform">平台</option>
                          <option value="isFollowing">已關注</option>
                          <option value="language">語言</option>
                        </select>
                        <select style={{ ...inputSt, flex: 1 }} value={rule.operator} onChange={e => updateRule(i, 'operator', e.target.value)}>
                          <option value="contains">包含</option>
                          <option value="notContains">不包含</option>
                          <option value="equals">等於</option>
                          <option value="notEquals">不等於</option>
                          <option value="exists">存在</option>
                        </select>
                        {rule.operator !== 'exists' && (
                          <input style={{ ...inputSt, flex: 1 }} value={rule.value || ''} onChange={e => updateRule(i, 'value', e.target.value)} placeholder="數值..." />
                        )}
                        <button type="button" onClick={() => removeRule(i)}
                          style={{ padding: '0 8px', border: 'none', background: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 18 }}>×</button>
                      </div>
                    ))}
                    <button type="button" onClick={addRule}
                      style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
                      + 新增規則
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" onClick={() => setShowForm(false)}
                    style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
                  <button type="submit"
                    style={{ padding: '8px 18px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>儲存</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 分群卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px,1fr))', gap: 14 }}>
          {segments.map(seg => (
            <div key={seg._id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => viewContacts(seg)}>
              <div style={{ height: 4, background: seg.color }} />
              <div style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{seg.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                      {seg.type === 'dynamic' ? '動態' : '靜態'} • {seg.rules?.length || 0} 條規則
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: seg.color }}>{seg.memberCount}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(seg); }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 11 }}>編輯</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(seg._id); }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>刪除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右側：聯絡人面板 */}
      {selectedSeg && (
        <div style={{ width: 320, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, flexShrink: 0, height: 'fit-content', position: 'sticky', top: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{selectedSeg.name}</div>
            <button onClick={() => setSelectedSeg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8' }}>×</button>
          </div>
          {loadingContacts ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>載入中...</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{contacts.length} 位聯絡人</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {contacts.map(c => (
                  <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#6366F1', flexShrink: 0 }}>
                      {c.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{c.displayName || c.platformId}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.tags?.slice(0, 2).map(t => `#${t}`).join(' ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
