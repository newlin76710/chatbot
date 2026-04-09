// ContactsPage.jsx
import React, { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export function ContactsPage() {
  const { activeChannelId } = useChannelStore();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!activeChannelId) return;
    api.get(`/contacts/tags/list?channelId=${activeChannelId}`)
      .then(r => setAllTags(r.data.tags)).catch(() => {});
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId) return;
    const params = new URLSearchParams({ channelId: activeChannelId, page, limit: 50 });
    if (search) params.append('search', search);
    if (filterTag) params.append('tag', filterTag);
    api.get(`/contacts?${params}`).then(r => { setContacts(r.data.contacts); setTotal(r.data.total); });
  }, [activeChannelId, page, search, filterTag]);

  const handleTagAction = async (contactId, type, tag) => {
    try {
      const { data } = await api.patch(`/contacts/${contactId}/tags`, {
        [type === 'add' ? 'add' : 'remove']: [tag]
      });
      setContacts(cs => cs.map(c => c._id === contactId ? { ...c, tags: data.contact.tags } : c));
      if (selected?._id === contactId) setSelected(data.contact);
    } catch { toast.error('Failed'); }
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Contacts</h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>{total.toLocaleString()} subscribers</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input style={{ flex: 1, maxWidth: 280, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }}
          placeholder="Search by name or ID..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }}>
          <option value="">All tags</option>
          {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Table */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F9FC' }}>
                {['Contact','Platform','Tags','Last Active'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={c._id}
                  onClick={() => setSelected(c)}
                  style={{ borderTop: i === 0 ? 'none' : '1px solid #F1F5F9', cursor: 'pointer', background: selected?._id === c._id ? '#F8F9FF' : 'transparent' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF2FF', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#6366F1' }}>
                        {c.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{c.displayName || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.platformId?.slice(0, 12)}...</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20,
                      background: c.platform === 'line' ? '#F0FDF4' : '#EFF6FF',
                      color: c.platform === 'line' ? '#15803D' : '#1D4ED8', fontWeight: 500 }}>
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
                    {c.lastInteractedAt ? format(new Date(c.lastInteractedAt), 'MMM d') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ width: 280, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, flexShrink: 0, height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>Contact Details</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EEF2FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#6366F1', marginBottom: 8 }}>
                {selected.displayName?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#0F172A' }}>{selected.displayName}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{selected.platform}</div>
            </div>
            <div style={{ fontSize: 12, color: '#374151', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#94A3B8' }}>ID</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{selected.platformId?.slice(0, 16)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#94A3B8' }}>Language</span>
                <span>{selected.language || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                <span style={{ color: '#94A3B8' }}>Following</span>
                <span style={{ color: selected.isFollowing ? '#22C55E' : '#F43F5E' }}>
                  {selected.isFollowing ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {selected.tags?.map(t => (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F1F5F9', color: '#475569' }}>
                    #{t}
                    <button onClick={() => handleTagAction(selected._id, 'remove', t)}
                      style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input id="newTagInput" style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none' }}
                  placeholder="Add tag..." onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      handleTagAction(selected._id, 'add', e.target.value.trim());
                      e.target.value = '';
                    }
                  }} />
              </div>
            </div>
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
      toast.success('Channel created!');
      setShowForm(false);
      setForm({ name: '', platform: 'line', accessToken: '', channelSecret: '' });
    } catch { toast.error('Failed'); }
  };

  const PLATFORM_INFO = {
    line: { label: 'LINE', color: '#22C55E', bg: '#F0FDF4', docs: 'https://developers.line.biz' },
    messenger: { label: 'Messenger', color: '#3B82F6', bg: '#EFF6FF', docs: 'https://developers.facebook.com/docs/messenger-platform' },
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Channels</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>Connect LINE, Messenger, and more</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: '9px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          + Add Channel
        </button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 460 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Add Channel</h2>
            <form onSubmit={handleSubmit}>
              {[
                { key: 'name', label: 'Channel Name', placeholder: 'My LINE Bot' },
                { key: 'accessToken', label: 'Channel Access Token', placeholder: 'Long-lived access token' },
                { key: 'channelSecret', label: 'Channel Secret', placeholder: 'Channel secret / App secret' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>{label}</label>
                  <input style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} required />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Platform</label>
                <select style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                  <option value="line">LINE</option>
                  <option value="messenger">Facebook Messenger</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Create</button>
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
                  {ch.platform === 'line' ? '🟢' : '🔵'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#0F172A' }}>{ch.name}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>{pi.label}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', borderRadius: 20, background: ch.isActive ? '#F0FDF4' : '#F1F5F9', color: ch.isActive ? '#15803D' : '#94A3B8', fontWeight: 500 }}>
                  {ch.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ background: '#F8F9FC', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11, fontFamily: 'monospace', color: '#64748B', wordBreak: 'break-all' }}>
                Webhook: /webhook/{ch.platform}/{ch._id}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <a href={pi.docs} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#6366F1', textDecoration: 'none' }}>Docs ↗</a>
                <button onClick={() => { if (window.confirm('Delete channel?')) deleteChannel(ch._id); }}
                  style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>
                  Delete
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
