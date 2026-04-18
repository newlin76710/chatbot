import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChannelStore } from '../store/channelStore';
import { useWorkspaceStore } from '../store/workspaceStore';

const NAV = [
  { to: '/dashboard', icon: '▦', label: '儀表板' },
  { to: '/flows', icon: '⬡', label: '流程編輯' },
  { to: '/broadcasts', icon: '⊕', label: '廣播訊息' },
  { to: '/segments', icon: '◈', label: '受眾分群' },
  { to: '/contacts', icon: '◉', label: '聯絡人' },
  { to: '/campaigns', icon: '🔗', label: '導流工具' },
  { to: '/channels', icon: '⊞', label: '頻道管理' },
  { to: '/workspace-settings', icon: '⚙', label: '工作區設定', adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { channels, fetchChannels, setActiveChannel, activeChannelId } = useChannelStore();
  const { workspaces, activeWorkspaceId, setActiveWorkspace, fetchWorkspaces, myRole } = useWorkspaceStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchWorkspaces().then(() => {
      fetchChannels();
    });
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) fetchChannels();
  }, [activeWorkspaceId]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleWorkspaceChange = (id) => {
    setActiveWorkspace(id);
  };

  const role = myRole();

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', 'Noto Sans TC', sans-serif", background: '#F8F9FC' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 220,
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1E293B' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0,
          }}>B</div>
          {!collapsed && <span style={{ color: '#fff', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>BotDog</span>}
        </div>

        {/* Workspace Selector */}
        {!collapsed && workspaces.length > 0 && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #1E293B' }}>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              工作區
            </div>
            <select
              value={activeWorkspaceId || ''}
              onChange={e => handleWorkspaceChange(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 8,
                background: '#1E293B', color: '#E2E8F0',
                border: '1px solid #334155', fontSize: 12, cursor: 'pointer',
              }}
            >
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Channel Selector */}
        {!collapsed && (
          <div style={{ padding: '12px 12px 0' }}>
            <select
              value={activeChannelId || ''}
              onChange={e => setActiveChannel(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 8,
                background: '#1E293B', color: '#CBD5E1',
                border: '1px solid #334155', fontSize: 12, cursor: 'pointer',
              }}
            >
              <option value="" disabled>— 選擇頻道 —</option>
              {channels.map(c => (
                <option key={c._id} value={c._id}>
                  {c.platform === 'line' ? '🟢' : '🔵'} {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {NAV.map(item => {
            if (item.adminOnly && role !== 'admin') return null;
            return (
              <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, marginBottom: 2,
                textDecoration: 'none',
                background: isActive ? '#6366F1' : 'transparent',
                color: isActive ? '#fff' : '#94A3B8',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              })}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #1E293B', padding: '12px 8px' }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 10px', borderRadius: 8, background: 'none', border: 'none',
              color: '#64748B', cursor: 'pointer', fontSize: 13 }}
          >
            <span style={{ fontSize: 16 }}>{collapsed ? '→' : '←'}</span>
            {!collapsed && '收合選單'}
          </button>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginTop: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366F1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 700 }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#E2E8F0', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <button onClick={handleLogout}
                  style={{ color: '#64748B', fontSize: 11, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  登出
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}
