import React, { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

const SEGMENT_COLORS = ['#6366F1','#22C55E','#F59E0B','#F43F5E','#3B82F6','#A855F7','#14B8A6','#F97316'];
const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };

export default function SegmentsPage() {
  const { activeChannelId } = useChannelStore();
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
    if (!activeChannelId) return;
    fetchSegments();
  }, [activeChannelId]);

  const fetchSegments = () =>
    api.get(`/segments?channelId=${activeChannelId}`).then(r => setSegments(r.data.segments));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, channelId: activeChannelId };
      if (editId) {
        await api.put(`/segments/${editId}`, payload);
        toast.success('Segment updated');
      } else {
        await api.post('/segments', payload);
        toast.success('Segment created');
      }
      setShowForm(false); setEditId(null); setForm(defaultForm());
      fetchSegments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this segment?')) return;
    await api.delete(`/segments/${id}`);
    setSegments(s => s.filter(x => x._id !== id));
    if (selectedSeg?._id === id) setSelectedSeg(null);
    toast.success('Deleted');
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
      {/* Left: segment list */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Segments</h1>
            <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>Group contacts by behavior & attributes</p>
          </div>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(defaultForm()); }}
            style={{ padding: '9px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            + New Segment
          </button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>{editId ? 'Edit' : 'New'} Segment</h2>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Name</label>
                    <input style={inputSt} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Color</label>
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
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Type</label>
                  <select style={inputSt} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="dynamic">Dynamic (auto-updates based on rules)</option>
                    <option value="static">Static (manually managed)</option>
                  </select>
                </div>

                {form.type === 'dynamic' && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Rules</label>
                      <select style={{ ...inputSt, width: 'auto', fontSize: 11 }} value={form.rulesMode}
                        onChange={e => setForm(f => ({ ...f, rulesMode: e.target.value }))}>
                        <option value="and">ALL rules match (AND)</option>
                        <option value="or">ANY rule matches (OR)</option>
                      </select>
                    </div>
                    {form.rules.map((rule, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <select style={{ ...inputSt, flex: 1 }} value={rule.field} onChange={e => updateRule(i, 'field', e.target.value)}>
                          <option value="tags">Tags</option>
                          <option value="platform">Platform</option>
                          <option value="isFollowing">Is Following</option>
                          <option value="language">Language</option>
                        </select>
                        <select style={{ ...inputSt, flex: 1 }} value={rule.operator} onChange={e => updateRule(i, 'operator', e.target.value)}>
                          {['contains','notContains','equals','notEquals','exists'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        {rule.operator !== 'exists' && (
                          <input style={{ ...inputSt, flex: 1 }} value={rule.value || ''} onChange={e => updateRule(i, 'value', e.target.value)} placeholder="value..." />
                        )}
                        <button type="button" onClick={() => removeRule(i)}
                          style={{ padding: '0 8px', border: 'none', background: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 18 }}>×</button>
                      </div>
                    ))}
                    <button type="button" onClick={addRule}
                      style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
                      + Add Rule
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" onClick={() => setShowForm(false)}
                    style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                  <button type="submit"
                    style={{ padding: '8px 18px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Segment Cards */}
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
                      {seg.type} • {seg.rules?.length || 0} rule{seg.rules?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: seg.color }}>{seg.memberCount}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(seg); }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(seg._id); }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: contacts panel */}
      {selectedSeg && (
        <div style={{ width: 320, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, flexShrink: 0, height: 'fit-content', position: 'sticky', top: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{selectedSeg.name}</div>
            <button onClick={() => setSelectedSeg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8' }}>×</button>
          </div>
          {loadingContacts ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>Loading...</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{contacts.length} contacts</div>
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
