import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useWorkspaceStore } from '../store/workspaceStore';
import toast from 'react-hot-toast';

export default function JoinWorkspacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchWorkspaces, setActiveWorkspace } = useWorkspaceStore();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setMessage('無效的邀請連結'); return; }

    api.post(`/workspaces/join/${token}`)
      .then(async ({ data }) => {
        setStatus('success');
        setMessage(data.message);
        const workspaces = await fetchWorkspaces();
        const joined = workspaces?.find(w => w.id === data.workspace.id);
        if (joined) setActiveWorkspace(joined.id);
        setTimeout(() => navigate('/dashboard'), 2000);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || '加入失敗');
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8F9FC', fontFamily: "'Inter', 'Noto Sans TC', sans-serif",
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '48px 56px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: 400 }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0F172A', margin: '0 0 8px' }}>處理邀請中...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0F172A', margin: '0 0 8px' }}>成功加入！</h2>
            <p style={{ color: '#64748B', fontSize: 14 }}>{message}</p>
            <p style={{ color: '#94A3B8', fontSize: 13 }}>即將跳轉至儀表板...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#EF4444', margin: '0 0 8px' }}>加入失敗</h2>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 20 }}>{message}</p>
            <button onClick={() => navigate('/dashboard')}
              style={{ padding: '10px 24px', background: '#6366F1', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              返回儀表板
            </button>
          </>
        )}
      </div>
    </div>
  );
}
