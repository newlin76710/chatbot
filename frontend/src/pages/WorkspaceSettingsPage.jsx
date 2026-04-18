import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const ROLE_LABELS = { admin: '管理員', editor: '編輯者', viewer: '檢視者' };
const cardStyle = {
  background: '#fff', borderRadius: 12, padding: '24px 28px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24,
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const btnStyle = (variant = 'primary') => ({
  padding: '9px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13,
  cursor: 'pointer', border: 'none',
  background: variant === 'primary' ? '#6366F1' : variant === 'danger' ? '#EF4444' : '#F1F5F9',
  color: variant === 'ghost' ? '#475569' : '#fff',
});

export default function WorkspaceSettingsPage() {
  const { activeWorkspace, fetchActiveWorkspace, renameWorkspace, inviteMember, updateMemberRole, removeMember, deleteWorkspace, workspaces, activeWorkspaceId } = useWorkspaceStore();
  const { user } = useAuthStore();

  const [wsName, setWsName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteLink, setInviteLink] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [loading, setLoading] = useState({});

  useEffect(() => {
    fetchActiveWorkspace();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (activeWorkspace) setWsName(activeWorkspace.name || '');
  }, [activeWorkspace]);

  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }));

  const handleRename = async () => {
    if (!wsName.trim()) return;
    setLoad('rename', true);
    try {
      await renameWorkspace(wsName.trim());
      toast.success('工作區名稱已更新');
    } catch (e) { toast.error(e.response?.data?.error || '更新失敗'); }
    setLoad('rename', false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setLoad('invite', true);
    try {
      const result = await inviteMember(inviteEmail.trim(), inviteRole);
      setInviteLink(result.inviteLink);
      setInviteEmail('');
      toast.success('邀請連結已產生');
    } catch (e) { toast.error(e.response?.data?.error || '邀請失敗'); }
    setLoad('invite', false);
  };

  const handleRoleChange = async (userId, role) => {
    setLoad(`role_${userId}`, true);
    try {
      await updateMemberRole(userId, role);
      toast.success('角色已更新');
    } catch (e) { toast.error(e.response?.data?.error || '更新失敗'); }
    setLoad(`role_${userId}`, false);
  };

  const handleRemove = async (userId, name) => {
    if (!window.confirm(`確定要移除成員「${name}」嗎？`)) return;
    setLoad(`remove_${userId}`, true);
    try {
      await removeMember(userId);
      toast.success('成員已移除');
    } catch (e) { toast.error(e.response?.data?.error || '移除失敗'); }
    setLoad(`remove_${userId}`, false);
  };

  const handleDelete = async () => {
    if (deleteConfirm !== activeWorkspace?.name) {
      toast.error('工作區名稱輸入錯誤');
      return;
    }
    setLoad('delete', true);
    try {
      await deleteWorkspace();
      toast.success('工作區已刪除');
      window.location.href = '/dashboard';
    } catch (e) { toast.error(e.response?.data?.error || '刪除失敗'); }
    setLoad('delete', false);
  };

  const currentWorkspaceInfo = workspaces.find(w => w.id === activeWorkspaceId);
  const isOwner = activeWorkspace?.owner?._id === user?._id || activeWorkspace?.owner?.equals?.(user?._id);

  if (!activeWorkspace) {
    return <div style={{ padding: 40, color: '#64748B' }}>載入中...</div>;
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>工作區設定</h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0' }}>管理工作區成員與偏好設定</p>
      </div>

      {/* 一般設定 */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', margin: '0 0 16px' }}>一般設定</h2>
        <label style={labelStyle}>工作區名稱</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={wsName} onChange={e => setWsName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={handleRename} disabled={loading.rename} style={btnStyle('primary')}>
            {loading.rename ? '儲存中...' : '儲存'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '8px 0 0' }}>工作區 ID：{activeWorkspaceId}</p>
      </div>

      {/* 成員管理 */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', margin: '0 0 16px' }}>成員管理</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              {['成員', '電子信箱', '角色', '操作'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#64748B', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeWorkspace.members?.map(m => {
              const isThisOwner = activeWorkspace.owner?._id?.toString() === m.user?._id?.toString()
                || activeWorkspace.owner?.toString() === m.user?._id?.toString();
              const isSelf = m.user?._id?.toString() === user?._id;
              return (
                <tr key={m.user?._id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '12px 12px', fontSize: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                        {m.user?.name?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500, color: '#0F172A' }}>{m.user?.name}</span>
                      {isThisOwner && <span style={{ fontSize: 10, background: '#EEF2FF', color: '#6366F1', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>擁有者</span>}
                      {isSelf && <span style={{ fontSize: 10, background: '#F0FDF4', color: '#16A34A', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>我</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: 13, color: '#64748B' }}>{m.user?.email}</td>
                  <td style={{ padding: '12px 12px' }}>
                    {isThisOwner ? (
                      <span style={{ fontSize: 13, color: '#475569' }}>管理員</span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.user._id, e.target.value)}
                        disabled={loading[`role_${m.user._id}`]}
                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, background: '#fff' }}
                      >
                        {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    {!isThisOwner && !isSelf && (
                      <button
                        onClick={() => handleRemove(m.user._id, m.user?.name)}
                        disabled={loading[`remove_${m.user._id}`]}
                        style={{ ...btnStyle('ghost'), padding: '5px 12px', fontSize: 12, background: '#FEF2F2', color: '#EF4444' }}
                      >
                        移除
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 邀請成員 */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', margin: '0 0 16px' }}>邀請成員</h2>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>電子信箱</label>
            <input
              type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="name@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>角色</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}>
              <option value="admin">管理員</option>
              <option value="editor">編輯者</option>
              <option value="viewer">檢視者</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={handleInvite} disabled={loading.invite} style={btnStyle('primary')}>
              {loading.invite ? '處理中...' : '產生邀請連結'}
            </button>
          </div>
        </div>
        {inviteLink && (
          <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 16px', marginTop: 8 }}>
            <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 6px', fontWeight: 600 }}>邀請連結（有效期 7 天）</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={inviteLink} style={{ ...inputStyle, flex: 1, background: '#fff', fontSize: 12 }} />
              <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('已複製'); }}
                style={btnStyle('ghost')}>複製</button>
            </div>
          </div>
        )}
      </div>

      {/* 危險區域 */}
      {isOwner && (
        <div style={{ ...cardStyle, border: '1px solid #FECACA' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#EF4444', margin: '0 0 8px' }}>危險區域</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}>
            刪除工作區將永久移除所有頻道、流程、廣播與聯絡人資料，此操作無法復原。
          </p>
          <label style={{ ...labelStyle, color: '#EF4444' }}>請輸入工作區名稱「{activeWorkspace?.name}」以確認</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={activeWorkspace?.name}
              style={{ ...inputStyle, flex: 1, borderColor: '#FECACA' }}
            />
            <button onClick={handleDelete} disabled={loading.delete || deleteConfirm !== activeWorkspace?.name}
              style={{ ...btnStyle('danger'), opacity: deleteConfirm !== activeWorkspace?.name ? 0.5 : 1 }}>
              {loading.delete ? '刪除中...' : '刪除工作區'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
