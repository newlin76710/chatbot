import React, { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

const BASE_URL = 'https://bot.ek21.com';

function CopyButton({ text, label = '複製' }) {
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
      background: copied ? '#F0FDF4' : '#F8F9FC',
      color: copied ? '#15803D' : '#64748B',
      cursor: 'pointer', fontSize: 11, fontWeight: 500, flexShrink: 0,
    }}>{copied ? '已複製' : label}</button>
  );
}

const PLATFORM_OPTIONS = [
  { value: 'line', label: 'LINE', color: '#22C55E', bg: '#F0FDF4' },
  { value: 'messenger', label: 'FB Messenger', color: '#3B82F6', bg: '#EFF6FF' },
];

function PlatformBadge({ platform }) {
  const p = PLATFORM_OPTIONS.find(x => x.value === platform) || PLATFORM_OPTIONS[0];
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: p.bg, color: p.color, fontWeight: 600 }}>
      {p.label}
    </span>
  );
}

export default function CampaignsPage() {
  const { activeChannelId, channelsReady, channels } = useChannelStore();
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', keyword: '', lineId: '', messengerPageId: '', platform: 'line' });
  const [saving, setSaving] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [jsonModal, setJsonModal] = useState(null);
  const [loadingQr, setLoadingQr] = useState(null);
  const [loadingJson, setLoadingJson] = useState(null);

  // 自動偵測目前頻道平台
  useEffect(() => {
    if (!activeChannelId || !channels?.length) return;
    const ch = channels.find(c => c._id === activeChannelId);
    if (ch) setForm(f => ({ ...f, platform: ch.platform || 'line' }));
  }, [activeChannelId, channels]);

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
      setForm(f => ({ ...f, name: '', description: '', keyword: '', lineId: '', messengerPageId: '' }));
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
    } catch { toast.error('刪除失敗'); }
  };

  const handleShowQr = async (campaign) => {
    setLoadingQr(campaign._id);
    try {
      const { data } = await api.get(`/campaigns/${campaign._id}/qr`);
      setQrModal({ campaign, qr: data.qr, url: data.url, directUrl: data.directUrl });
    } catch { toast.error('QR Code 產生失敗'); }
    setLoadingQr(null);
  };

  const handleShowJson = async (campaign) => {
    setLoadingJson(campaign._id);
    try {
      const { data } = await api.get(`/campaigns/${campaign._id}/json`);
      setJsonModal({ campaign, json: data });
    } catch { toast.error('JSON 取得失敗'); }
    setLoadingJson(null);
  };

  const downloadQr = () => {
    if (!qrModal) return;
    const a = document.createElement('a');
    a.href = qrModal.qr;
    a.download = `${qrModal.campaign.name}-qrcode.png`;
    a.click();
  };

  const trackingUrl = (code) => `${BASE_URL}/c/${code}`;

  const directUrl = (c) => {
    if (c.platform === 'messenger') {
      if (!c.messengerPageId) return null;
      const ref = c.keyword ? `?ref=${encodeURIComponent(c.keyword)}` : '';
      return `https://m.me/${c.messengerPageId}${ref}`;
    }
    const lineId = (c.lineId || '').replace(/^@/, '');
    if (!lineId) return null;
    const kw = c.keyword ? `?oaMessageText=${encodeURIComponent(c.keyword)}` : '';
    return `https://line.me/R/ti/p/@${lineId}${kw}`;
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>導流工具</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>LINE & FB Messenger 追蹤連結、QR Code、廣告 JSON</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding: '9px 20px', borderRadius: 8, background: '#6366F1',
          color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}>+ 新增導流活動</button>
      </div>

      {/* 說明 */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 18px', marginBottom: 28, fontSize: 13, color: '#1E40AF', lineHeight: 1.7 }}>
        <strong>使用流程：</strong>建立活動 → 複製追蹤連結 / QR Code / JSON → 投放廣告或貼文。<br />
        點擊後自動跳轉 LINE 或 Messenger，系統同步記錄點擊與加入數。
      </div>

      {/* 列表 */}
      {campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>尚未建立任何導流活動</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {campaigns.map(c => (
            <div key={c._id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                {/* 左側 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{c.name}</span>
                    <PlatformBadge platform={c.platform} />
                  </div>
                  {c.description && <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>{c.description}</div>}

                  {/* 追蹤連結 */}
                  <UrlRow label="追蹤連結（含點擊追蹤）" url={trackingUrl(c.code)} />

                  {/* 直連 */}
                  {directUrl(c) && (
                    <div style={{ marginTop: 6 }}>
                      <UrlRow label={c.platform === 'messenger' ? 'Messenger 直連（m.me）' : 'LINE 直連'} url={directUrl(c)} accent />
                    </div>
                  )}

                  {/* 關鍵字 / ID */}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                    {c.keyword && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#94A3B8' }}>{c.platform === 'messenger' ? 'ref_param' : '關鍵字'}：</span>
                        <span style={{ fontWeight: 600, color: '#0F172A', background: '#EFF6FF', borderRadius: 4, padding: '1px 6px', marginLeft: 4 }}>{c.keyword}</span>
                      </div>
                    )}
                    {c.platform === 'line' && c.lineId && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#94A3B8' }}>LINE ID：</span>
                        <span style={{ fontWeight: 500, marginLeft: 4 }}>{c.lineId}</span>
                      </div>
                    )}
                    {c.platform === 'messenger' && c.messengerPageId && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#94A3B8' }}>粉專 ID：</span>
                        <span style={{ fontWeight: 500, marginLeft: 4 }}>{c.messengerPageId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 右側統計 + 按鈕 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <StatBox value={c.stats?.clicks || 0} label="點擊" color="#6366F1" />
                    <StatBox value={c.stats?.joins || 0} label="加入" color="#10B981" />
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleShowQr(c)} disabled={loadingQr === c._id}
                      style={btnSt}>{loadingQr === c._id ? '…' : '📷 QR'}</button>
                    <button onClick={() => handleShowJson(c)} disabled={loadingJson === c._id}
                      style={btnSt}>{loadingJson === c._id ? '…' : '{ } JSON'}</button>
                    <button onClick={() => handleDelete(c)}
                      style={{ ...btnSt, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626' }}>刪除</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增 Modal */}
      {showForm && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>新增導流活動</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94A3B8' }}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <Field label="活動名稱 *">
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="例：IG 廣告 2025Q2" />
              </Field>
              <Field label="備註說明">
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inp} placeholder="選填" />
              </Field>
              <Field label="平台">
                <div style={{ display: 'flex', gap: 10 }}>
                  {PLATFORM_OPTIONS.map(p => (
                    <label key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8, border: `2px solid ${form.platform === p.value ? p.color : '#E2E8F0'}`, background: form.platform === p.value ? p.bg : '#fff', fontSize: 13, fontWeight: 500, color: form.platform === p.value ? p.color : '#374151' }}>
                      <input type="radio" value={p.value} checked={form.platform === p.value} onChange={() => setForm(f => ({ ...f, platform: p.value }))} style={{ display: 'none' }} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </Field>
              {form.platform === 'line' && (
                <Field label="LINE Bot @ID" hint="例：@abc1234d（在 LINE 官方帳號後台查詢）">
                  <input value={form.lineId} onChange={e => setForm(f => ({ ...f, lineId: e.target.value }))} style={inp} placeholder="@abc1234d" />
                </Field>
              )}
              {form.platform === 'messenger' && (
                <Field label="FB 粉專 ID" hint="在 粉專 → 關於 → 粉絲專頁 ID">
                  <input value={form.messengerPageId} onChange={e => setForm(f => ({ ...f, messengerPageId: e.target.value }))} style={inp} placeholder="123456789012345" />
                </Field>
              )}
              <Field label={form.platform === 'messenger' ? 'ref 參數（可選）' : '觸發關鍵字（可選）'} hint={form.platform === 'messenger' ? '用戶開啟 Messenger 後可識別來源' : '點連結後自動發送此關鍵字觸發流程'}>
                <input value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} style={inp} placeholder={form.platform === 'messenger' ? 'ig_ad_2025' : 'join_ad1'} />
              </Field>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 22px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {saving ? '建立中…' : '建立活動'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div style={overlay}>
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
              {qrModal.directUrl && <CopyButton text={qrModal.directUrl} label="複製直連" />}
              <button onClick={downloadQr} style={{ padding: '5px 16px', borderRadius: 7, border: 'none', background: '#6366F1', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>下載 PNG</button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Modal */}
      {jsonModal && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>JSON 匯出 — {jsonModal.campaign.name}</h2>
              <button onClick={() => setJsonModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
              可貼入廣告系統、Zapier、或自動化工具使用。
            </div>
            <pre style={{ flex: 1, overflowY: 'auto', background: '#0F172A', color: '#E2E8F0', borderRadius: 10, padding: '14px 16px', fontSize: 11, lineHeight: 1.6, margin: 0, fontFamily: 'monospace' }}>
              {JSON.stringify(jsonModal.json, null, 2)}
            </pre>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <CopyButton text={JSON.stringify(jsonModal.json, null, 2)} label="複製 JSON" />
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(jsonModal.json, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${jsonModal.campaign.name}.json`;
                a.click();
              }} style={{ padding: '5px 16px', borderRadius: 7, border: 'none', background: '#6366F1', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>下載 .json</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────
function UrlRow({ label, url, accent }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 11, fontFamily: 'monospace', borderRadius: 6, padding: '3px 8px', flex: 1,
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          background: accent ? '#EEF2FF' : '#F1F5F9', color: accent ? '#6366F1' : '#475569',
        }}>{url}</span>
        <CopyButton text={url} />
      </div>
    </div>
  );
}

function StatBox({ value, label, color }) {
  return (
    <div style={{ textAlign: 'center', background: '#F8F9FC', borderRadius: 10, padding: '8px 14px', minWidth: 60 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{label}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: 4 }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };
const btnSt = { padding: '5px 11px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8F9FC', color: '#374151', cursor: 'pointer', fontSize: 11, fontWeight: 500 };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
