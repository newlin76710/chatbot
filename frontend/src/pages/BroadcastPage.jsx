import React, { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_COLORS = {
  draft: { bg: '#F1F5F9', text: '#475569' },
  scheduled: { bg: '#EFF6FF', text: '#1D4ED8' },
  sending: { bg: '#FFFBEB', text: '#B45309' },
  sent: { bg: '#F0FDF4', text: '#15803D' },
  failed: { bg: '#FFF1F2', text: '#BE123C' },
  cancelled: { bg: '#F8F9FC', text: '#94A3B8' },
};

const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };

export default function BroadcastPage() {
  const { activeChannelId } = useChannelStore();
  const [broadcasts, setBroadcasts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [segments, setSegments] = useState([]);
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return { name: '', audienceType: 'all', audienceSegments: [], audienceTags: '', messages: [{ type: 'text', text: '' }], scheduledAt: '' };
  }

  useEffect(() => {
    if (!activeChannelId) return;
    fetchBroadcasts();
    api.get(`/segments?channelId=${activeChannelId}`).then(r => setSegments(r.data.segments)).catch(() => {});
  }, [activeChannelId]);

  const fetchBroadcasts = () =>
    api.get(`/broadcasts?channelId=${activeChannelId}`).then(r => setBroadcasts(r.data.broadcasts));

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        channelId: activeChannelId,
        audience: {
          type: form.audienceType,
          segments: form.audienceSegments,
          tags: form.audienceTags.split(',').map(t => t.trim()).filter(Boolean),
        },
        messages: form.messages.filter(m => m.text || m.imageUrl),
        scheduledAt: form.scheduledAt || null,
      };
      if (editId) {
        await api.put(`/broadcasts/${editId}`, payload);
        toast.success('Broadcast updated');
      } else {
        await api.post('/broadcasts', payload);
        toast.success('Broadcast created');
      }
      setShowForm(false);
      setEditId(null);
      setForm(defaultForm());
      fetchBroadcasts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const handleSend = async (id) => {
    if (!window.confirm('Send this broadcast now?')) return;
    try {
      const { data } = await api.post(`/broadcasts/${id}/send`);
      toast.success(`Sending to ${data.audienceCount} contacts...`);
      fetchBroadcasts();
    } catch (err) {
      toast.error('Failed to send');
    }
  };

  const handleCancel = async (id) => {
    await api.post(`/broadcasts/${id}/cancel`);
    fetchBroadcasts();
  };

  const handleDelete = async (id) => {
    await api.delete(`/broadcasts/${id}`);
    setBroadcasts(b => b.filter(x => x._id !== id));
    toast.success('Deleted');
  };

  const openEdit = (b) => {
    setEditId(b._id);
    setForm({
      name: b.name,
      audienceType: b.audience.type,
      audienceSegments: b.audience.segments?.map(s => s._id || s) || [],
      audienceTags: b.audience.tags?.join(', ') || '',
      messages: b.messages,
      scheduledAt: b.scheduledAt ? b.scheduledAt.slice(0, 16) : '',
    });
    setShowForm(true);
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Broadcast</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>Push messages to your audience</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(defaultForm()); }}
          style={{ padding: '9px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          + New Broadcast
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
              {editId ? 'Edit Broadcast' : 'New Broadcast'}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Name</label>
                <input style={inputSt} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Weekend Promo" />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Audience</label>
                <select style={inputSt} value={form.audienceType} onChange={e => setForm(f => ({ ...f, audienceType: e.target.value }))}>
                  <option value="all">All subscribers</option>
                  <option value="segments">By segment</option>
                  <option value="tags">By tag</option>
                </select>
              </div>

              {form.audienceType === 'segments' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Segments</label>
                  <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 8, padding: 10, maxHeight: 140, overflowY: 'auto' }}>
                    {segments.map(s => (
                      <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={form.audienceSegments.includes(s._id)}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...form.audienceSegments, s._id]
                              : form.audienceSegments.filter(x => x !== s._id);
                            setForm(f => ({ ...f, audienceSegments: next }));
                          }} />
                        <span style={{ fontSize: 13 }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>({s.memberCount})</span>
                      </label>
                    ))}
                    {segments.length === 0 && <span style={{ fontSize: 12, color: '#94A3B8' }}>No segments yet</span>}
                  </div>
                </div>
              )}

              {form.audienceType === 'tags' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Tags (comma separated)</label>
                  <input style={inputSt} value={form.audienceTags}
                    onChange={e => setForm(f => ({ ...f, audienceTags: e.target.value }))} placeholder="vip, member, active" />
                </div>
              )}

              {/* Messages */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Messages</label>
                {form.messages.map((msg, i) => (
                  <div key={i} style={{ background: '#F8F9FC', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <select style={{ ...inputSt, width: 'auto' }} value={msg.type}
                        onChange={e => {
                          const next = form.messages.map((m, idx) => idx === i ? { ...m, type: e.target.value } : m);
                          setForm(f => ({ ...f, messages: next }));
                        }}>
                        {['text','image','video'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      {form.messages.length > 1 && (
                        <button type="button" onClick={() => setForm(f => ({ ...f, messages: f.messages.filter((_, idx) => idx !== i) }))}
                          style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontWeight: 600 }}>×</button>
                      )}
                    </div>
                    {msg.type === 'text' && (
                      <textarea style={{ ...inputSt, minHeight: 80 }}
                        value={msg.text || ''}
                        onChange={e => {
                          const next = form.messages.map((m, idx) => idx === i ? { ...m, text: e.target.value } : m);
                          setForm(f => ({ ...f, messages: next }));
                        }}
                        placeholder="Your message... Use {{contact.name}} for personalization" />
                    )}
                    {(msg.type === 'image' || msg.type === 'video') && (
                      <input style={inputSt} value={msg.imageUrl || msg.videoUrl || ''}
                        onChange={e => {
                          const key = msg.type === 'image' ? 'imageUrl' : 'videoUrl';
                          const next = form.messages.map((m, idx) => idx === i ? { ...m, [key]: e.target.value } : m);
                          setForm(f => ({ ...f, messages: next }));
                        }} placeholder={`${msg.type} URL...`} />
                    )}
                  </div>
                ))}
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, messages: [...f.messages, { type: 'text', text: '' }] }))}
                  style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1.5px dashed #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
                  + Add Message
                </button>
              </div>

              {/* Schedule */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
                  Schedule (optional — leave blank to save as draft)
                </label>
                <input type="datetime-local" style={inputSt} value={form.scheduledAt}
                  onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {broadcasts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 15 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⊕</div>
            No broadcasts yet
          </div>
        )}
        {broadcasts.map(b => {
          const sc = STATUS_COLORS[b.status] || STATUS_COLORS.draft;
          return (
            <div key={b._id} style={{ background: '#fff', borderRadius: 12, padding: '18px 22px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{b.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.text }}>
                    {b.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {b.audience?.type === 'all' ? 'All subscribers' : b.audience?.type}
                  {b.scheduledAt && ` • Scheduled: ${format(new Date(b.scheduledAt), 'MMM d, yyyy HH:mm')}`}
                  {b.sentAt && ` • Sent: ${format(new Date(b.sentAt), 'MMM d, yyyy HH:mm')}`}
                </div>
                {b.status === 'sent' && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12 }}>
                    <span>📤 {b.stats?.sent || 0} sent</span>
                    <span>✓ {b.stats?.delivered || 0} delivered</span>
                    <span style={{ color: '#F43F5E' }}>✗ {b.stats?.failed || 0} failed</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(b.status === 'draft' || b.status === 'scheduled') && (
                  <>
                    <button onClick={() => handleSend(b._id)}
                      style={{ padding: '6px 14px', borderRadius: 7, background: '#F0FDF4', border: '1px solid #A7F3D0', color: '#059669', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                      Send Now
                    </button>
                    <button onClick={() => openEdit(b)}
                      style={{ padding: '6px 14px', borderRadius: 7, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#374151', cursor: 'pointer', fontSize: 12 }}>
                      Edit
                    </button>
                  </>
                )}
                {b.status === 'sending' && (
                  <button onClick={() => handleCancel(b._id)}
                    style={{ padding: '6px 14px', borderRadius: 7, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}>
                    Cancel
                  </button>
                )}
                {b.status === 'draft' && (
                  <button onClick={() => handleDelete(b._id)}
                    style={{ padding: '6px 14px', borderRadius: 7, background: 'none', border: '1px solid #FCA5A5', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
