import React, { useRef, useState } from 'react';
import api from '../utils/api';

const subLabelSt = { fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 4 };
const inputSt = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };

export default function MediaUpload({ label, accept, url, onUrl, preview }) {
  const fileRef = useRef();
  const galleryFileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const mediaType = accept?.includes('video') && !accept?.includes('image') ? 'video' : 'image';

  const doUpload = async (file) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  };

  const handleDirectUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const data = await doUpload(file);
      onUrl(data.url);
    } catch (err) {
      setError(err.response?.data?.error || '上傳失敗');
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleGalleryUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await doUpload(file);
      setGallery(prev => [{ url: data.url, filename: data.filename, type: data.type }, ...prev]);
      onUrl(data.url);
      setShowGallery(false);
    } catch (err) {
      setError(err.response?.data?.error || '上傳失敗');
    }
    setUploading(false);
    e.target.value = '';
  };

  const openGallery = async () => {
    setShowGallery(true);
    setLoadingGallery(true);
    try {
      const { data } = await api.get(`/upload/list?type=${mediaType}`);
      setGallery(data.files);
    } catch (_) {}
    setLoadingGallery(false);
  };

  return (
    <div>
      {label && <div style={subLabelSt}>{label}</div>}
      <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
        <input
          style={{ ...inputSt, flex: 1, fontSize: 12 }}
          value={url}
          onChange={e => onUrl(e.target.value)}
          placeholder="貼入 URL 或選擇 / 上傳"
        />
        <button type="button" onClick={openGallery} style={{
          flexShrink: 0, padding: '4px 9px', borderRadius: 6,
          border: '1px solid #6366F1', background: '#EEF2FF',
          cursor: 'pointer', fontSize: 11, color: '#6366F1', whiteSpace: 'nowrap',
        }}>圖庫</button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{
          flexShrink: 0, padding: '4px 9px', borderRadius: 6,
          border: '1px solid #E2E8F0', background: '#F8F9FC',
          cursor: 'pointer', fontSize: 11, color: '#374151', whiteSpace: 'nowrap',
        }}>{uploading ? '上傳中…' : '上傳'}</button>
        <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleDirectUpload} />
      </div>
      {error && <div style={{ fontSize: 11, color: '#DC2626', marginBottom: 4 }}>{error}</div>}
      {url && preview === 'image' && (
        <img src={url} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 6, border: '1px solid #E2E8F0' }}
          onError={e => { e.target.style.display = 'none'; }} onLoad={e => { e.target.style.display = 'block'; }} />
      )}
      {url && preview === 'video' && (
        <video src={url} controls style={{ width: '100%', maxHeight: 120, borderRadius: 6, border: '1px solid #E2E8F0' }} />
      )}

      {/* 圖庫 Modal */}
      {showGallery && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowGallery(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>選擇圖片</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" onClick={() => galleryFileRef.current?.click()} disabled={uploading} style={{
                  padding: '6px 14px', borderRadius: 7, background: '#6366F1', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>
                  {uploading ? '上傳中…' : '+ 上傳新圖片'}
                </button>
                <button type="button" onClick={() => setShowGallery(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94A3B8', lineHeight: 1 }}>×</button>
              </div>
              <input ref={galleryFileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleGalleryUpload} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {loadingGallery ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#94A3B8', fontSize: 13 }}>載入中…</div>
              ) : gallery.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
                  <div style={{ fontSize: 13, color: '#94A3B8' }}>尚無上傳的圖片</div>
                  <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>點上方按鈕上傳第一張</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {gallery.map((f, i) => (
                    <div key={i}
                      onClick={() => { onUrl(f.url); setShowGallery(false); }}
                      title={f.filename}
                      style={{
                        aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#F1F5F9',
                        border: url === f.url ? '3px solid #6366F1' : '2px solid transparent',
                        boxSizing: 'border-box',
                      }}>
                      <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
