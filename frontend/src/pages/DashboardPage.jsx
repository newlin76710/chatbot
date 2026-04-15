import React, { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';

const StatCard = ({ label, value, sub, color = '#6366F1' }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
    <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 32, fontWeight: 700, color: '#0F172A', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>{sub}</div>}
    <div style={{ height: 3, width: 40, borderRadius: 2, background: color, marginTop: 16 }} />
  </div>
);

export default function DashboardPage() {
  const { activeChannelId, channels, channelsReady } = useChannelStore();
  const [stats, setStats] = useState(null);
  const activeChannel = channels.find(c => c._id === activeChannelId);

  useEffect(() => {
    if (!channelsReady || !activeChannelId) return;
    api.get(`/analytics/overview?channelId=${activeChannelId}`)
      .then(r => setStats(r.data))
      .catch(() => {});
  }, [channelsReady, activeChannelId]);

  if (!channelsReady || !activeChannelId) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#94A3B8' }}>
      <span style={{ fontSize: 48 }}>⊞</span>
      <p style={{ fontSize: 16, margin: 0 }}>請選擇或建立一個頻道以開始使用</p>
    </div>
  );

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>儀表板</h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
          {activeChannel?.platform === 'line' ? '🟢' : '🔵'} {activeChannel?.name}
        </p>
      </div>

      {/* 數據卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="總聯絡人" value={stats?.totalContacts ?? '—'} sub="目前關注中" color="#6366F1" />
        <StatCard label="今日新增" value={stats?.newContactsToday ?? '—'} sub="新訂閱者" color="#10B981" />
        <StatCard label="啟用中流程" value={stats?.activeFlows ?? '—'} sub="運行中流程" color="#F59E0B" />
        <StatCard label="已發送廣播" value={stats?.totalBroadcasts ?? '—'} sub="累計至今" color="#8B5CF6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* 成長趨勢圖 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#0F172A' }}>訂閱者成長（近 30 天）</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats?.growth || []}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} fill="url(#grad)" name="新訂閱者" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 熱門標籤 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#0F172A' }}>熱門標籤</h3>
          {stats?.topTags?.length
            ? stats.topTags.map((tag, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{tag._id}
                  </span>
                  <div style={{ width: 120, height: 6, borderRadius: 3, background: '#F1F5F9', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, background: '#6366F1',
                      width: `${Math.round((tag.count / (stats.topTags[0]?.count || 1)) * 100)}%`
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#94A3B8', minWidth: 28, textAlign: 'right' }}>{tag.count}</span>
                </div>
              ))
            : <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>尚無標籤</p>
          }
        </div>
      </div>
    </div>
  );
}
