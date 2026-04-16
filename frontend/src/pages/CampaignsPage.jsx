import React, { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

const BASE_URL = 'https://bot.ek21.com';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={handle} style={{
      padding: '3px 10px', borderRadius: 6, border: '1px solid #E2E8F0',
      background: copied ? '#F0FDF4' : '#F8F9FC', color: copied ? '#15803D' : '#64748B',
      cursor: 'pointer', fontSize: 11, fontWeight: 500, flexShrink: 0,
    }}>{copied ? '已複製' : '複製'}</button>
  );
}

export default function CampaignsPage() {
  const { activeChannelId, channelsReady } = useChannelStore();
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', keyword: '', lineId: '' });
  const [saving, setSaving] = useState(false);
  const [qrModal, setQrModal] = useState(null); // { campaign, qr, url }
  const [loadingQr, setLoadingQr] = useState(null);

  useEffect(() => {
    if (!channelsReady || !activeChannelId) return;
    api.get(`/campaigns?channelId=${activeChannelId}`)
      .then(r => setCampaigns(r.data.campaigns))
      .catch(() => {});
  }, [channelsReady, activeChannelId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!activeChannelId) return toast.error('請先選擇頻道');
    setSaving(true);
    try {
      const { data } = await api.post('/campaigns', { ...form, channelId: activeChannelId });
      setCampaigns(cs => [data.campaign, ...cs]);
      setForm({ name: '', description: '', keyword: '', lineId: '' });
      setShowForm(false);
      toast.success('導流活動已建立！');
    } catch (err) {
      toast.error(err.response?.data?.error || '建立失敗');
    }
    setSaving(false);
  };

  const handleDelete = async (campaign) => {
    if (!window.confirm(`確定刪除「${campaign.name}」？`)) return;
    try {
      await api.delete(`/campaigns/${campaign._id}`);
      setCampaigns(cs => cs.filter(c => c._id !== campaign._id));
      toast.success('已刪除');
    } catch {
      toast.error('刪除失敗');
    }
  };

  const handleShowQr = async (campaign) => {
    setLoadingQr(campaign._id);
    try {
      const { data } = await api.get(`/campaigns/${campaign._id}/qr`);
      setQrModal({ campaign, qr: data.qr, url: data.url });
    } catch {
      toast.error('QR Code 產生失敗');
    }
    setLoadingQr(null);
  };

  const downloadQr = () => {
    if (!qrModal) return;
    const a = document.createElement('a');
    a.href = qrModal.qr;
    a.download = `${qrModal.campaign.name}-qrcode.png`;
    a.click();
  };

  const trackingUrl = (code) => `${BASE_URL}/c/${code}`;

  const lineUrl = (campaign) => {
    const lineId = (campaign.lineId || '').replace(/^@/, '');
    const kw = campaign.keyword;
    if (lineId && kw) return `https://line.me/R/ti/p/@${lineId}?oaMessageText=${encodeURIComponent(kw)}`;
    if (lineId) return `https://line.me/R/ti/p/@${lineId}`;
    return null;
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>導流工具</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>建立追蹤連結與 QR Code，掌握每個來源的成效</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding: '9px 20px', borderRadius: 8, background: '#6366F1',
          color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}>+ 新增導流活動</button>
      </div>

      {/* 說明卡 */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 18px', marginBottom: 28, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20 }}>💡</span>
        <div style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.7 }}>
          <strong>使用方式：</strong>建立活動 → 複製「追蹤連結」或掃 QR Code → 貼到廣告、貼文或名片。<br />
          用戶點擊後自動跳轉 LINE 並發送關鍵字，觸發對應流程；系統同時記錄點擊次數。
        </div>
      </div>

      {/* 活動列表 */}
      {campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>尚未建立任何導流活動</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>點擊右上角「新增導流活動」開始</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {campaigns.map(c => (
            <div key={c._id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                {/* 左側資訊 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 2 }}>{c.name}</div>
                  {c.description && <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>{c.description}</div>}

                  {/* 追蹤連結 */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 3 }}>追蹤連結</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#475569', background: '#F1F5F9', borderRadius: 6, padding: '3px 8px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {trackingUrl(c.code)}
                      </span>
                      <CopyButton text={trackingUrl(c.code)} />
                    </div>
                  </div>

                  {/* 關鍵字 */}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {c.keyword && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#94A3B8' }}>關鍵字：</span>
                        <span style={{ fontWeight: 600, color: '#0F172A', marginLeft: 4, background: '#EFF6FF', borderRadius: 4, padding: '1px 6px' }}>{c.keyword}</span>
                      </div>
                    )}
                    {c.lineId && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#94A3B8' }}>LINE ID：</span>
                        <span style={{ fontWeight: 500, color: '#0F172A', marginLeft: 4 }}>{c.lineId}</span>
                      </div>
                    )}
                  </div>

                  {/* LINE 直連 */}
                  {lineUrl(c) && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 3 }}>LINE 加入連結（直連，無點擊追蹤）</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6366F1', background: '#EEF2FF', borderRadius: 6, padding: '3px 8px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lineUrl(c)}
                        </span>
                        <CopyButton text={lineUrl(c)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 右側統計 + 按鈕 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
                  {/* 統計 */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ textAlign: 'center', background: '#F8F9FC', borderRadius: 10, padding: '8px 14px', minWidth: 64 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#6366F1' }}>{c.stats?.clicks || 0}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>點擊</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#F8F9FC', borderRadius: 10, padding: '8px 14px', minWidth: 64 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>{c.stats?.joins || 0}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>加入</div>
                    </div>
                  </div>

                  {/* 按鈕 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleShowQr(c)}
                      disabled={loadingQr === c._id}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8F9FC', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                      {loadingQr === c._id ? '產生中…' : '📷 QR Code'}
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}>
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增活動 Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>新增導流活動</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94A3B8' }}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <Field label="活動名稱 *" hint="例如：IG 廣告 2025Q2">
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inp} placeholder="請輸入活動名稱" />
              </Field>
              <Field label="備註說明">
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={inp} placeholder="選填" />
              </Field>
              <Field label="LINE Bot ID" hint="你的 LINE 官方帳號 @ID（例：@abc1234）">
                <input value={form.lineId} onChange={e => setForm(f => ({ ...f, lineId: e.target.value }))}
                  style={inp} placeholder="@abc1234d" />
              </Field>
              <Field label="觸發關鍵字" hint="點擊連結後自動發送此關鍵字，用來觸發對應流程">
                <input value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                  style={inp} placeholder="例：join_ad1" />
              </Field>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
                <button type="submit" disabled={saving}
                  style={{ padding: '8px 22px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {saving ? '建立中…' : '建立活動'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{qrModal.campaign.name}</h2>
              <button onClick={() => setQrModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94A3B8' }}>×</button>
            </div>
            <img src={qrModal.qr} alt="QR Code" style={{ width: 260, height: 260, borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 14 }} />
            <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', marginBottom: 16, wordBreak: 'break-all', background: '#F8F9FC', borderRadius: 8, padding: '6px 10px' }}>
              {qrModal.url}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <CopyButton text={qrModal.url} />
              <button onClick={downloadQr} style={{
                padding: '5px 16px', borderRadius: 7, border: 'none', background: '#6366F1', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>下載 PNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0',
  fontSize: 13, boxSizing: 'border-box', outline: 'none',
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: 4 }}> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}
