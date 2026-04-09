import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChannelStore } from '../store/channelStore';

const NAV = [
  { to: '/dashboard', icon: '▦', label: 'Dashboard' },
  { to: '/flows', icon: '⬡', label: 'Flow Builder' },
  { to: '/broadcasts', icon: '⊕', label: 'Broadcast' },
  { to: '/segments', icon: '◈', label: 'Segments' },
  { to: '/contacts', icon: '◉', label: 'Contacts' },
  { to: '/channels', icon: '⊞', label: 'Channels' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { channels, activeChannelId, fetchChannels, setActiveChannel } = useChannelStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { fetchChannels(); }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif", background: '#F8F9FC' }}>
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
          {!collapsed && <span style={{ color: '#fff', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>BotFlow</span>}
        </div>

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
              <option value="" disabled>— Select Channel —</option>
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
          {NAV.map(item => (
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
          ))}
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
            {!collapsed && 'Collapse'}
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
                  Logout
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
