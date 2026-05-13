// ContactsPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { io as socketIO } from 'socket.io-client';

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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [dateField, setDateField] = useState('lastInteractedAt');
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('lastInteractedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [allTags, setAllTags] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 收集資料編輯狀態
  const [activeTab, setActiveTab] = useState('data');
  const [editingFields, setEditingFields] = useState(false);
  const [fieldDraft, setFieldDraft] = useState({});
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldVal, setNewFieldVal] = useState('');
  const [savingFields, setSavingFields] = useState(false);

  // 傳訊息 / 觸發腳本
  const [contactFlows, setContactFlows] = useState([]);
  const [sendText, setSendText] = useState('');
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [sending, setSending] = useState(false);
  const [newContactIds, setNewContactIds] = useState(new Set());
  const [unreadContactIds, setUnreadContactIds] = useState(new Set());
  const [showManual, setShowManual] = useState(false);
  const [manualRole, setManualRole] = useState('bot');
  const [manualText, setManualText] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const historyBottomRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  // Socket.io 即時更新對話紀錄
  useEffect(() => {
    if (!activeChannelId) return;
    // 不指定 URL 時 socket.io 會連到當前頁面的 host（由 nginx 代理 /socket.io → backend）
    // 本機開發可設定 REACT_APP_API_URL=http://localhost:4000
    const socketUrl = process.env.REACT_APP_API_URL || undefined;
    const socket = socketUrl
      ? socketIO(socketUrl, { withCredentials: true })
      : socketIO({ withCredentials: true });
    socket.on('connect', () => {
      socket.emit('join:channel', activeChannelId);
    });
    socket.on('contact:message', ({ contactId, message }) => {
      const cur = selectedRef.current;
      if (cur && String(cur._id) === String(contactId)) {
        setSelected(prev => ({
          ...prev,
          conversationHistory: [...(prev.conversationHistory || []), message],
        }));
      } else if (message.role === 'user') {
        // 使用者傳來訊息但管理員未在看此聯絡人 → 標記未讀
        setUnreadContactIds(prev => new Set([...prev, String(contactId)]));
      }
      // 更新聯絡人列表的最近互動時間
      setContacts(prev => prev.map(c =>
        String(c._id) === String(contactId)
          ? { ...c, lastInteractedAt: message.timestamp || new Date().toISOString() }
          : c
      ));
    });

    socket.on('contact:new', ({ contact: newContact }) => {
      setNewContactIds(prev => new Set([...prev, String(newContact._id)]));
      setContacts(prev => {
        const exists = prev.some(c => String(c._id) === String(newContact._id));
        return exists ? prev : [newContact, ...prev];
      });
    });

    socket.on('contact:update', ({ contactId, patch }) => {
      const cur = selectedRef.current;
      if (cur && String(cur._id) === String(contactId)) {
        setSelected(prev => ({ ...prev, ...patch }));
      }
      // 若標籤有更新，同步列表
      if (patch.tags) {
        setContacts(prev => prev.map(c =>
          String(c._id) === String(contactId) ? { ...c, tags: patch.tags } : c
        ));
      }
    });
    return () => {
      socket.emit('leave:channel', activeChannelId);
      socket.disconnect();
    };
  }, [activeChannelId]);

  // 切換聯絡人或有新訊息時，自動捲到最新訊息
  useEffect(() => {
    setTimeout(() => historyBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [selected?._id, selected?.conversationHistory?.length]);

  // 載入頻道流程供腳本選擇
  useEffect(() => {
    if (!activeChannelId) return;
    api.get(`/flows?channelId=${activeChannelId}`)
      .then(r => setContactFlows(r.data.flows || []))
      .catch(() => {});
  }, [activeChannelId]);

  const handleSendMessage = async () => {
    if (!sendText.trim() || !selected) return;
    setSending(true);
    try {
      await api.post(`/contacts/${selected._id}/send`, { text: sendText.trim() });
      setSendText('');
      if (activeTab !== 'history') setActiveTab('history');
    } catch (err) {
      toast.error(err.response?.data?.error || '傳送失敗');
    }
    setSending(false);
  };

  const handleSaveManual = async () => {
    if (!manualText.trim() || !selected) return;
    setSavingManual(true);
    try {
      const { data } = await api.post(`/contacts/${selected._id}/history`, {
        role: manualRole,
        content: manualText.trim(),
        timestamp: manualTime || undefined,
      });
      setSelected(prev => ({
        ...prev,
        conversationHistory: [...(prev.conversationHistory || []), data.message],
      }));
      setManualText('');
      setManualTime('');
      setShowManual(false);
      toast.success('補充紀錄已儲存');
    } catch (err) {
      toast.error(err.response?.data?.error || '儲存失敗');
    }
    setSavingManual(false);
  };

  const handleTriggerFlow = async () => {
    if (!selectedFlowId || !selected) return;
    setSending(true);
    try {
      await api.post(`/contacts/${selected._id}/trigger-flow`, { flowId: selectedFlowId });
      toast.success('腳本已觸發');
      setSelectedFlowId('');
    } catch (err) {
      toast.error(err.response?.data?.error || '觸發失敗');
    }
    setSending(false);
  };

  const handleToggleFlowDisabled = async () => {
    if (!selected) return;
    try {
      const { data } = await api.patch(`/contacts/${selected._id}/flow-disabled`);
      setSelected(prev => ({ ...prev, flowDisabled: data.flowDisabled }));
      toast.success(data.flowDisabled ? '已停用所有腳本' : '已恢復腳本');
    } catch (err) {
      toast.error(err.response?.data?.error || '操作失敗');
    }
  };

  const handleDeleteContact = async () => {
    if (!window.confirm(`確定要刪除「${selected.displayName || selected.platformId}」？此操作無法復原。`)) return;
    try {
      await api.delete(`/contacts/${selected._id}`);
      setContacts(prev => prev.filter(c => c._id !== selected._id));
      setSelected(null);
      toast.success('聯絡人已刪除');
    } catch (err) {
      toast.error(err.response?.data?.error || '刪除失敗');
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('確定要清除對話紀錄？流程狀態也會一併重置，下次互動將重新從頭執行流程。')) return;
    try {
      await api.delete(`/contacts/${selected._id}/history`);
      setSelected(prev => ({ ...prev, conversationHistory: [], currentFlowState: null }));
      toast.success('對話紀錄已清除');
    } catch (err) {
      toast.error(err.response?.data?.error || '清除失敗');
    }
  };

  const selectContact = async (c) => {
    setEditingFields(false);
    setActiveTab('data');
    setLoadingDetail(true);
    // 清除綠點與未讀標記，標記管理員已讀
    setNewContactIds(prev => { const s = new Set(prev); s.delete(String(c._id)); return s; });
    setUnreadContactIds(prev => { const s = new Set(prev); s.delete(String(c._id)); return s; });
    api.post(`/contacts/${c._id}/read`).catch(() => {});
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
    setSelected(null);
  }, [activeChannelId]);

  useEffect(() => {
    if (!channelsReady || !activeChannelId) return;
    const params = new URLSearchParams({ channelId: activeChannelId, page, limit: 50 });
    if (search) params.append('search', search);
    if (filterTag) params.append('tag', filterTag);
    if (dateFrom) { params.append('dateField', dateField); params.append('dateFrom', dateFrom); }
    if (dateTo) { params.append('dateField', dateField); params.append('dateTo', dateTo); }
    params.append('sortBy', sortBy);
    params.append('sortDir', sortDir);
    api.get(`/contacts?${params}`).then(r => { setContacts(r.data.contacts); setTotal(r.data.total); });
  }, [channelsReady, activeChannelId, page, search, filterTag, dateFrom, dateTo, dateField, sortBy, sortDir]);

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

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ channelId: activeChannelId });
      if (search) params.append('search', search);
      if (filterTag) params.append('tag', filterTag);
      if (dateFrom) { params.append('dateField', dateField); params.append('dateFrom', dateFrom); }
      if (dateTo) { params.append('dateField', dateField); params.append('dateTo', dateTo); }
      params.append('sortBy', sortBy);
      params.append('sortDir', sortDir);

      const res = await api.get(`/contacts/export?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('匯出失敗');
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>聯絡人</h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>{total.toLocaleString()} 位訂閱者</p>
      </div>

      {/* 篩選列 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {/* 第一行：姓名搜尋 + 標籤 */}
        <input style={{ flex: '1 1 200px', maxWidth: 280, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }}
          placeholder="搜尋姓名或 ID..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setDateFrom(dateFromInput); setDateTo(dateToInput); setPage(1); } }} />
        <select style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }}>
          <option value="">所有標籤</option>
          {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
        {/* 日期篩選 */}
        <select style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          value={dateField} onChange={e => setDateField(e.target.value)}>
          <option value="lastInteractedAt">最後對話時間</option>
          <option value="createdAt">加入日期</option>
        </select>
        <input type="date" style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }}
          value={dateFromInput} onChange={e => setDateFromInput(e.target.value)} />
        <span style={{ lineHeight: '36px', color: '#94A3B8', fontSize: 13 }}>—</span>
        <input type="date" style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }}
          value={dateToInput} onChange={e => setDateToInput(e.target.value)} />
        <button
          onClick={() => { setSearch(searchInput); setDateFrom(dateFromInput); setDateTo(dateToInput); setPage(1); }}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          搜尋
        </button>
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearchInput(''); setSearch(''); setDateFromInput(''); setDateFrom(''); setDateToInput(''); setDateTo(''); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
            清除
          </button>
        )}
        <button
          onClick={handleExportCSV}
          disabled={!activeChannelId}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #A7F3D0', background: '#F0FDF4', color: '#059669', fontSize: 13, fontWeight: 600, cursor: activeChannelId ? 'pointer' : 'not-allowed', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          ↓ 匯出 CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* 列表 */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F9FC' }}>
                {[
                  { label: '聯絡人', field: 'displayName' },
                  { label: '平台', field: 'platform' },
                  { label: '標籤', field: null },
                  { label: '加入日期', field: 'createdAt' },
                  { label: '最後對話時間', field: 'lastInteractedAt' },
                ].map(({ label, field }) => (
                  <th key={label}
                    onClick={() => {
                      if (!field) return;
                      if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortBy(field); setSortDir('desc'); }
                      setPage(1);
                    }}
                    style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: field ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    {label}
                    {field && sortBy === field && (
                      <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                    {field && sortBy !== field && (
                      <span style={{ marginLeft: 4, opacity: 0.3 }}>↕</span>
                    )}
                  </th>
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
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF2FF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#6366F1' }}>
                          {c.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        {newContactIds.has(String(c._id)) && (
                          <span title="新加入" style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#22C55E', border: '2px solid #fff' }} />
                        )}
                        {!newContactIds.has(String(c._id)) && unreadContactIds.has(String(c._id)) && (
                          <span title="未讀訊息" style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#F97316', border: '2px solid #fff' }} />
                        )}
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
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>
                    {c.createdAt ? format(new Date(c.createdAt), 'MM/dd') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>
                    {c.lastInteractedAt ? format(new Date(c.lastInteractedAt), 'MM/dd HH:mm') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 詳情面板：左資料 + 右對話紀錄 */}
        {selected && (
          <div style={{ width: 720, flexShrink: 0, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

            {/* 頂部標題列 */}
            <div style={{ flexShrink: 0, padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EEF2FF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#6366F1' }}>
                {selected.displayName?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{selected.displayName || '未知'}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {selected.platform}
                  {loadingDetail && <span style={{ marginLeft: 8 }}>載入中…</span>}
                </div>
              </div>
              <button onClick={handleClearHistory}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 11, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                清除紀錄
              </button>
              <button onClick={handleToggleFlowDisabled}
                style={{ padding: '4px 10px', borderRadius: 6, border: selected.flowDisabled ? '1px solid #FCD34D' : '1px solid #E2E8F0', background: selected.flowDisabled ? '#FFFBEB' : '#fff', color: selected.flowDisabled ? '#D97706' : '#64748B', fontSize: 11, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {selected.flowDisabled ? '已停用腳本' : '停用腳本'}
              </button>
              <button onClick={handleDeleteContact}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 11, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                刪除聯絡人
              </button>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>

            {/* 主體：左欄資料 + 右欄對話 */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

              {/* ── 左欄：基本資料 ── */}
              <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #E2E8F0', overflowY: 'auto', padding: '16px 16px' }}>

                {/* 基本欄位 */}
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 16 }}>
                  <div style={{ padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ color: '#94A3B8', fontSize: 10, marginBottom: 2 }}>帳號 ID</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{selected.platformId}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#94A3B8' }}>語言</span>
                    <span>{selected.language || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#94A3B8' }}>加入日期</span>
                    <span>{selected.createdAt ? format(new Date(selected.createdAt), 'yyyy/MM/dd') : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#94A3B8' }}>最後對話</span>
                    <span>{selected.lastInteractedAt ? format(new Date(selected.lastInteractedAt), 'MM/dd HH:mm') : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ color: '#94A3B8' }}>關注中</span>
                    <span style={{ color: selected.isFollowing ? '#22C55E' : '#F43F5E' }}>{selected.isFollowing ? '是' : '否'}</span>
                  </div>
                </div>

                {/* 問卷收集資料 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>問卷資料</div>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {Object.entries(selected.customFields).map(([key, value]) => (
                          <div key={key} style={{ background: '#F8F9FC', borderRadius: 7, padding: '6px 10px' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', marginBottom: 1 }}>
                              {fieldLabel(key)}{FIELD_LABELS[key] ? <span style={{ fontWeight: 400, marginLeft: 3, color: '#CBD5E1' }}>({key})</span> : null}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', wordBreak: 'break-word' }}>{String(value ?? '—')}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '14px 0', background: '#F8F9FC', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>尚未收集到任何資料</div>
                      </div>
                    )
                  ) : (
                    <div>
                      {Object.entries(fieldDraft).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 7 }}>
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
                        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>新增欄位</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input style={{ ...inputSt, flex: '0 0 80px' }} value={newFieldKey}
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
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>標籤</div>
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
              </div>

              {/* ── 右欄：對話紀錄 ── */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* 對話訊息（可捲動） */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(selected.conversationHistory || []).length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>尚無對話紀錄</div>
                      <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>透過此平台發送的訊息將自動記錄</div>
                    </div>
                  ) : (
                    <>
                      {selected.conversationHistory.map((msg, i) => {
                        const isUser = msg.role === 'user';
                        const isImage = msg.messageType === 'image';
                        const isVideo = msg.messageType === 'video';
                        const isMedia = isImage || isVideo;
                        const isLast = i === selected.conversationHistory.length - 1;
                        const adminHasRead = isUser && selected.adminReadAt && new Date(selected.adminReadAt) >= new Date(msg.timestamp);
                        const isManual = msg.isManual;
                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: isUser ? 'row' : 'row-reverse', gap: 6, alignItems: 'flex-end' }}>
                            <div style={{
                              maxWidth: '80%',
                              padding: isMedia ? 0 : '7px 11px',
                              borderRadius: isUser ? '14px 14px 14px 3px' : '14px 14px 3px 14px',
                              background: isMedia ? 'transparent' : (isUser ? '#F1F5F9' : '#6366F1'),
                              color: isUser ? '#0F172A' : '#fff',
                              fontSize: 12, lineHeight: 1.55, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                              overflow: 'hidden',
                            }}>
                              {isImage ? (
                                <img src={msg.content} alt="圖片" style={{ display: 'block', maxWidth: 200, maxHeight: 200, borderRadius: isUser ? '14px 14px 14px 3px' : '14px 14px 3px 14px', objectFit: 'cover' }} />
                              ) : isVideo ? (
                                <a href={msg.content} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 'inherit', background: isUser ? '#F1F5F9' : '#6366F1', color: isUser ? '#0F172A' : '#fff', textDecoration: 'none', fontSize: 12 }}>
                                  ▶ 影片
                                </a>
                              ) : (
                                msg.content
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: '#CBD5E1', flexShrink: 0, paddingBottom: 2, display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-start' : 'flex-end', gap: 2 }}>
                              <span>{msg.timestamp ? format(new Date(msg.timestamp), 'MM/dd HH:mm') : ''}</span>
                              {isManual && <span style={{ color: '#F59E0B' }}>補充紀錄</span>}
                              {!isUser && !isManual && isLast && <span style={{ color: '#A5B4FC' }}>已送出</span>}
                              {isUser && adminHasRead && isLast && <span style={{ color: '#94A3B8' }}>已讀</span>}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={historyBottomRef} />
                    </>
                  )}
                </div>

                {/* 固定底部：傳訊息 + 執行腳本 */}
                <div style={{ borderTop: '1px solid #E2E8F0', padding: '10px 14px', flexShrink: 0, background: '#FAFBFC', borderRadius: '0 0 12px 0' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
                    <input
                      value={sendText}
                      onChange={e => setSendText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { handleSendMessage(); e.preventDefault(); } }}
                      placeholder="輸入訊息後按 Enter 傳送..."
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', background: '#fff' }}
                    />
                    <button onClick={handleSendMessage} disabled={sending || !sendText.trim()} style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none',
                      cursor: sending || !sendText.trim() ? 'not-allowed' : 'pointer',
                      background: sending || !sendText.trim() ? '#E2E8F0' : '#6366F1',
                      color: '#fff', fontSize: 12, fontWeight: 600, flexShrink: 0,
                    }}>
                      {sending ? '…' : '發送'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: showManual ? 8 : 0 }}>
                    <select value={selectedFlowId} onChange={e => setSelectedFlowId(e.target.value)} style={{
                      flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid #E2E8F0',
                      fontSize: 11, outline: 'none', color: selectedFlowId ? '#0F172A' : '#94A3B8', background: '#fff',
                    }}>
                      <option value="">選擇腳本...</option>
                      {contactFlows.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                    </select>
                    <button onClick={handleTriggerFlow} disabled={sending || !selectedFlowId} style={{
                      padding: '6px 14px', borderRadius: 7, border: '1px solid',
                      cursor: !selectedFlowId ? 'not-allowed' : 'pointer',
                      background: selectedFlowId ? '#F0FDF4' : '#F8F9FC',
                      borderColor: selectedFlowId ? '#A7F3D0' : '#E2E8F0',
                      color: selectedFlowId ? '#059669' : '#94A3B8',
                      fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      執行腳本
                    </button>
                    <button onClick={() => { setShowManual(v => !v); setManualText(''); setManualTime(''); }} style={{
                      padding: '6px 10px', borderRadius: 7, border: '1px solid',
                      background: showManual ? '#EEF2FF' : '#F8F9FC',
                      borderColor: showManual ? '#A5B4FC' : '#E2E8F0',
                      color: showManual ? '#6366F1' : '#94A3B8',
                      fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
                    }}>
                      補充紀錄
                    </button>
                  </div>

                  {/* 補充紀錄展開區 */}
                  {showManual && (
                    <div style={{ background: '#F8F9FF', border: '1px solid #E0E7FF', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 600, marginBottom: 2 }}>補充對話紀錄（不會實際發訊）</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={manualRole} onChange={e => setManualRole(e.target.value)} style={{
                          padding: '5px 8px', borderRadius: 6, border: '1px solid #E0E7FF', fontSize: 11, outline: 'none', background: '#fff', color: '#374151', flexShrink: 0,
                        }}>
                          <option value="bot">管理員說</option>
                          <option value="user">對方說</option>
                        </select>
                        <input
                          type="datetime-local"
                          value={manualTime}
                          onChange={e => setManualTime(e.target.value)}
                          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #E0E7FF', fontSize: 11, outline: 'none', background: '#fff', color: '#374151', flex: 1 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={manualText}
                          onChange={e => setManualText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { handleSaveManual(); e.preventDefault(); } }}
                          placeholder="輸入訊息內容..."
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #E0E7FF', fontSize: 12, outline: 'none', background: '#fff' }}
                        />
                        <button onClick={handleSaveManual} disabled={savingManual || !manualText.trim()} style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: manualText.trim() ? '#6366F1' : '#E2E8F0',
                          color: '#fff', fontSize: 11, fontWeight: 600, cursor: manualText.trim() ? 'pointer' : 'not-allowed', flexShrink: 0,
                        }}>
                          {savingManual ? '…' : '儲存'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
  const { channels, fetchChannels, createChannel, deleteChannel, linkChannel } = useChannelStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [showForm, setShowForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkId, setLinkId] = useState('');
  const [linking, setLinking] = useState(false);
  const [form, setForm] = useState({ name: '', platform: 'line', accessToken: '', channelSecret: '' });
  const [syncingIds, setSyncingIds] = useState(new Set());

  // Facebook OAuth 連結狀態
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbPages, setFbPages] = useState([]);
  const [showFbPageSelect, setShowFbPageSelect] = useState(false);
  const [creatingFbChannel, setCreatingFbChannel] = useState(false);

  const connectFacebook = async () => {
    setFbConnecting(true);
    // 清除上次殘留結果
    localStorage.removeItem('_fb_oauth_result');
    try {
      const { data } = await api.get('/auth/facebook/url');
      window.open(data.url, 'fb_auth', 'width=620,height=680,left=300,top=80');

      let timer = null;
      let resolved = false;

      const handleResult = (oauthData) => {
        if (resolved) return;
        resolved = true;
        clearInterval(timer);
        window.removeEventListener('storage', storageHandler);
        window.removeEventListener('message', msgHandler);
        localStorage.removeItem('_fb_oauth_result');
        setFbConnecting(false);
        if (oauthData.type === 'fb_pages') {
          if (!oauthData.pages?.length) {
            toast.error('此帳號沒有可連結的粉絲專頁');
          } else {
            setFbPages(oauthData.pages);
            setShowFbPageSelect(true);
          }
        } else {
          toast.error(oauthData.error || 'Facebook 連結失敗');
        }
      };

      // 主要：localStorage storage event（最可靠，跨視窗同源）
      const storageHandler = (e) => {
        if (e.key !== '_fb_oauth_result' || !e.newValue) return;
        handleResult(JSON.parse(e.newValue));
      };
      window.addEventListener('storage', storageHandler);

      // 備用：postMessage
      const msgHandler = (e) => {
        if (!e.data?.type?.startsWith('fb_')) return;
        handleResult(e.data);
      };
      window.addEventListener('message', msgHandler);

      // 120 秒後逾時清理
      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('storage', storageHandler);
          window.removeEventListener('message', msgHandler);
          localStorage.removeItem('_fb_oauth_result');
          setFbConnecting(false);
        }
      }, 120000);
    } catch {
      toast.error('無法取得 Facebook 授權網址，請確認平台已設定 FB_APP_ID');
      setFbConnecting(false);
    }
  };

  const handleSelectFbPage = async (page) => {
    setCreatingFbChannel(true);
    try {
      await createChannel({
        name: page.name,
        platform: 'messenger',
        credentials: { accessToken: page.access_token, pageId: page.id },
      });
      toast.success(`已成功連結「${page.name}」！`);
      setShowFbPageSelect(false);
      setFbPages([]);
      setShowForm(false);
    } catch {
      toast.error('建立頻道失敗');
    }
    setCreatingFbChannel(false);
  };

  const syncLineFollowers = async (channelId) => {
    setSyncingIds(prev => new Set([...prev, channelId]));
    try {
      const { data } = await api.post(`/channels/${channelId}/sync-line-followers`);
      toast.success(`同步完成：新增 ${data.created} 位好友（共 ${data.total} 位）`);
    } catch (err) {
      toast.error(err.response?.data?.error || '同步失敗');
    } finally {
      setSyncingIds(prev => { const s = new Set(prev); s.delete(channelId); return s; });
    }
  };

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

  const handleLink = async (e) => {
    e.preventDefault();
    setLinking(true);
    try {
      await linkChannel(linkId.trim());
      toast.success('已成功加入頻道！');
      setShowLinkForm(false);
      setLinkId('');
    } catch (err) {
      toast.error(err.response?.data?.error || '加入失敗，請確認頻道 ID');
    } finally {
      setLinking(false);
    }
  };

  const handleDelete = async (ch) => {
    const isOwner = String(ch.workspace) === String(activeWorkspaceId);
    const msg = isOwner ? '確定要永久刪除此頻道？此操作無法復原。' : '確定要從此工作區移除此頻道？（頻道本身不會被刪除）';
    if (!window.confirm(msg)) return;
    try {
      await deleteChannel(ch._id);
      toast.success(isOwner ? '頻道已刪除' : '已從工作區移除頻道');
    } catch { toast.error('操作失敗'); }
  };

  const PLATFORM_INFO = {
    line: { label: 'LINE', color: '#22C55E', bg: '#F0FDF4', docs: 'https://developers.line.biz' },
    messenger: { label: 'Messenger', color: '#3B82F6', bg: '#EFF6FF', docs: 'https://developers.facebook.com/docs/messenger-platform' },
    instagram: { label: 'Instagram', color: '#E1306C', bg: '#FFF0F5', docs: 'https://developers.facebook.com/docs/messenger-platform/instagram' },
  };

  const modalStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
  const cardStyle = { background: '#fff', borderRadius: 16, padding: 32, width: 460 };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>頻道管理</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>連接 LINE、Messenger、Instagram 等平台</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowLinkForm(true)}
            style={{ padding: '9px 20px', borderRadius: 8, background: '#fff', color: '#6366F1', border: '1.5px solid #6366F1', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            加入現有頻道
          </button>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '9px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            + 新增頻道
          </button>
        </div>
      </div>

      {/* 加入現有頻道對話框 */}
      {showLinkForm && (
        <div style={modalStyle}>
          <div style={cardStyle}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>加入現有頻道</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748B' }}>
              輸入其他工作區管理者提供的頻道 ID，即可將該頻道加入到目前工作區。
            </p>
            <form onSubmit={handleLink}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>頻道 ID</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'monospace' }}
                  value={linkId} onChange={e => setLinkId(e.target.value)}
                  placeholder="貼上頻道 ID（例如：68210abc...）" required />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowLinkForm(false); setLinkId(''); }}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
                <button type="submit" disabled={linking}
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: linking ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: linking ? 0.7 : 1 }}>
                  {linking ? '加入中...' : '加入'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 新增頻道對話框 */}
      {showForm && (
        <div style={modalStyle}>
          <div style={cardStyle}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>新增頻道</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>平台</label>
              <select style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                <option value="line">LINE</option>
                <option value="messenger">Facebook Messenger</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>

            {/* LINE：手動填入 Token */}
            {form.platform === 'line' && (
              <form onSubmit={handleSubmit}>
                {[
                  { key: 'name', label: '頻道名稱', placeholder: '我的 LINE 機器人' },
                  { key: 'accessToken', label: '頻道存取金鑰', placeholder: 'Channel Access Token' },
                  { key: 'channelSecret', label: '頻道密鑰', placeholder: 'Channel Secret' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>{label}</label>
                    <input style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                      value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} required />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" onClick={() => setShowForm(false)}
                    style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
                  <button type="submit"
                    style={{ padding: '8px 18px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>建立</button>
                </div>
              </form>
            )}

            {/* Messenger / Instagram：Facebook OAuth 一鍵連結 */}
            {(form.platform === 'messenger' || form.platform === 'instagram') && (
              <div>
                <div style={{ background: '#F0F2FF', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                  點擊下方按鈕，透過 Facebook 帳號授權，系統會自動取得您管理的粉絲專頁並完成連結，無需手動複製 Token。
                </div>
                <button
                  onClick={connectFacebook}
                  disabled={fbConnecting}
                  style={{ width: '100%', padding: '11px 0', borderRadius: 9, border: 'none', background: fbConnecting ? '#94A3B8' : '#1877F2', color: '#fff', fontSize: 14, fontWeight: 700, cursor: fbConnecting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  {fbConnecting ? '連結中…' : '用 Facebook 帳號連結粉絲專頁'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button type="button" onClick={() => setShowForm(false)}
                    style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Facebook 粉絲專頁選擇 Modal */}
      {showFbPageSelect && (
        <div style={modalStyle}>
          <div style={{ ...cardStyle, width: 480 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>選擇要連結的粉絲專頁</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B' }}>請選擇要與此工作區連結的 Facebook 粉絲專頁：</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {fbPages.map(page => (
                <button
                  key={page.id}
                  onClick={() => handleSelectFbPage(page)}
                  disabled={creatingFbChannel}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', cursor: creatingFbChannel ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#6366F1'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                >
                  {page.picture?.data?.url
                    ? <img src={page.picture.data.url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0 }} />
                    : <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔵</div>
                  }
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{page.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>ID: {page.id}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 18, color: '#CBD5E1' }}>›</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setShowFbPageSelect(false); setFbPages([]); }}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 16 }}>
        {channels.map(ch => {
          const pi = PLATFORM_INFO[ch.platform] || PLATFORM_INFO.line;
          const isOwner = String(ch.workspace) === String(activeWorkspaceId);
          return (
            <div key={ch._id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${isOwner ? '#E2E8F0' : '#C7D2FE'}`, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: pi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {ch.platform === 'line' ? '🟢' : ch.platform === 'instagram' ? '📷' : '🔵'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#0F172A' }}>{ch.name}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>{pi.label}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {!isOwner && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#EEF2FF', color: '#6366F1', fontWeight: 600 }}>共享</span>
                  )}
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: ch.isActive ? '#F0FDF4' : '#F1F5F9', color: ch.isActive ? '#15803D' : '#94A3B8', fontWeight: 500 }}>
                    {ch.isActive ? '啟用中' : '未啟用'}
                  </span>
                </div>
              </div>

              <div style={{ background: '#F8F9FC', borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 11, fontFamily: 'monospace', color: '#64748B', wordBreak: 'break-all' }}>
                <span style={{ color: '#94A3B8' }}>Webhook：</span>/webhook/{ch.platform}/{ch._id}
              </div>

              {/* 頻道 ID（供共享給其他工作區使用） */}
              {isOwner && (
                <div style={{ background: '#F8F9FC', borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>頻道 ID：</span>
                  <span style={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch._id}</span>
                  <button onClick={() => { navigator.clipboard.writeText(ch._id); toast.success('頻道 ID 已複製'); }}
                    style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #CBD5E1', background: '#fff', color: '#64748B', cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap' }}>
                    複製
                  </button>
                </div>
              )}

              {(ch.platform === 'messenger' || ch.platform === 'instagram') && ch.credentials?.verifyToken && (
                <div style={{ background: '#FFF7ED', borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 11, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Verify Token：</span>
                  <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{ch.credentials.verifyToken}</span>
                  <button onClick={() => { navigator.clipboard.writeText(ch.credentials.verifyToken); toast.success('已複製'); }}
                    style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #FCD34D', background: '#FFFBEB', color: '#92400E', cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap' }}>
                    複製
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href={pi.docs} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#6366F1', textDecoration: 'none' }}>文件 ↗</a>
                {ch.platform === 'line' && (
                  <button
                    onClick={() => syncLineFollowers(ch._id)}
                    disabled={syncingIds.has(ch._id)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #A7F3D0', background: '#F0FDF4', color: '#059669', cursor: syncingIds.has(ch._id) ? 'not-allowed' : 'pointer', fontSize: 11, opacity: syncingIds.has(ch._id) ? 0.6 : 1 }}>
                    {syncingIds.has(ch._id) ? '同步中...' : '同步好友'}
                  </button>
                )}
                <button onClick={() => handleDelete(ch)}
                  style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: `1px solid ${isOwner ? '#FCA5A5' : '#C7D2FE'}`, background: isOwner ? '#FEF2F2' : '#EEF2FF', color: isOwner ? '#DC2626' : '#6366F1', cursor: 'pointer', fontSize: 11 }}>
                  {isOwner ? '刪除' : '移除'}
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
