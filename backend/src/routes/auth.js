// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { User, Workspace } = require('../models');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

async function getUserWorkspaces(userId) {
  const workspaces = await Workspace.find({ 'members.user': userId, isActive: true });
  return workspaces.map(ws => {
    const member = ws.members.find(m => m.user.equals(userId));
    return { id: ws._id, name: ws.name, role: member?.role };
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: '請填寫所有必填欄位' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: '此電子信箱已被註冊' });

    const user = await User.create({ name, email, password });
    const workspace = await Workspace.create({
      name: `${user.name}的工作區`,
      owner: user._id,
      members: [{ user: user._id, role: 'admin' }],
    });

    const token = signToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      workspaces: [{ id: workspace._id, name: workspace.name, role: 'admin' }],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: '請輸入電子信箱與密碼' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: '電子信箱或密碼錯誤' });

    const token = signToken(user._id);
    const workspaces = await getUserWorkspaces(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      workspaces,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  const workspaces = await getUserWorkspaces(req.user._id);
  res.json({ user: req.user, workspaces });
});

// ─── Facebook OAuth 一鍵連結 ──────────────────────────────────

// GET /api/auth/facebook/url — 回傳 Facebook OAuth 授權網址
router.get('/facebook/url', (req, res) => {
  const { FB_APP_ID, BACKEND_URL } = process.env;
  if (!FB_APP_ID) return res.status(500).json({ error: '平台尚未設定 Facebook App ID，請聯繫管理員' });

  const redirectUri = `${BACKEND_URL || 'http://localhost:4000'}/api/auth/facebook/callback`;
  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: redirectUri,
    scope: 'pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata',
    response_type: 'code',
    auth_type: 'rerequest',   // 強制重新詢問所有權限（包含新增的 pages_show_list）
    state: Math.random().toString(36).slice(2),
  });
  res.json({ url: `https://www.facebook.com/v18.0/dialog/oauth?${params}` });
});

// GET /api/auth/facebook/callback — FB OAuth 回調，取得粉絲專頁清單後以 postMessage 傳回
router.get('/facebook/callback', async (req, res) => {
  const { code, error } = req.query;
  const { FB_APP_ID, FB_APP_SECRET, BACKEND_URL } = process.env;

  const sendToOpener = (data) => {
    res.setHeader('Content-Security-Policy', "script-src 'unsafe-inline'; style-src 'unsafe-inline';");
    const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    const isError = data.type === 'fb_error';
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fc;">
<div style="text-align:center;padding:32px;">
  <div style="font-size:40px;margin-bottom:12px;">${isError ? '❌' : '✅'}</div>
  <div style="font-size:16px;color:#374151;margin-bottom:8px;">${isError ? '連結失敗' : '授權成功，正在返回...'}</div>
  <div style="font-size:13px;color:#94a3b8;" id="msg">此視窗將自動關閉</div>
</div>
<script>
  (function(){
    var data = ${json};
    // 主要方式：localStorage storage event（跨視窗同源最可靠）
    try { localStorage.setItem('_fb_oauth_result', JSON.stringify(data)); } catch(e){}
    // 備用：postMessage
    try { if(window.opener){ window.opener.postMessage(data, '*'); } } catch(e){}
    setTimeout(function(){ window.close(); }, 400);
    setTimeout(function(){ document.getElementById('msg').textContent='若視窗未關閉，請手動關閉此分頁'; }, 2000);
  })();
\x3c/script></body></html>`);
  };

  if (error || !code) return sendToOpener({ type: 'fb_error', error: '授權失敗或已取消' });

  try {
    const redirectUri = `${BACKEND_URL || 'http://localhost:4000'}/api/auth/facebook/callback`;
    console.log('[FB OAuth] 開始 token exchange | redirectUri:', redirectUri, '| FB_APP_ID:', FB_APP_ID ? FB_APP_ID.slice(0,6)+'...' : 'MISSING');

    // 以 code 換取用戶 Access Token
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: { client_id: FB_APP_ID, client_secret: FB_APP_SECRET, redirect_uri: redirectUri, code },
    });
    console.log('[FB OAuth] token exchange 回應 keys:', Object.keys(tokenRes.data));

    const userToken = tokenRes.data.access_token;
    if (!userToken) {
      console.error('[FB OAuth] access_token 為空！完整回應:', JSON.stringify(tokenRes.data));
      return sendToOpener({ type: 'fb_error', error: `Token 交換失敗，回應格式異常: ${JSON.stringify(tokenRes.data)}` });
    }
    console.log('[FB OAuth] token 取得成功:', userToken.slice(0, 15) + '...');

    let pages = [];

    // 方式 1：me/accounts（傳統方式）
    try {
      const pagesRes = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
        params: { access_token: userToken, fields: 'id,name,access_token', limit: 100 },
      });
      pages = pagesRes.data.data || [];
      console.log('[FB OAuth] me/accounts 頁面數:', pages.length);
    } catch (e) {
      console.log('[FB OAuth] me/accounts 失敗:', e.response?.data?.error?.message);
    }

    // 方式 2：透過 debug_token 找出 token 被授權的具體頁面 ID（Facebook 新版權限機制）
    if (pages.length === 0) {
      console.log('[FB OAuth] 改用 debug_token 方式取得授權頁面...');
      try {
        const debugRes = await axios.get('https://graph.facebook.com/debug_token', {
          params: {
            input_token: userToken,
            access_token: `${FB_APP_ID}|${FB_APP_SECRET}`,
          },
        });
        console.log('[FB OAuth] debug_token granular_scopes:', JSON.stringify(debugRes.data.data?.granular_scopes));

        // 從 granular_scopes 中找到 pages_show_list 對應的 target_ids
        const scopes = debugRes.data.data?.granular_scopes || [];
        const pageIds = new Set();
        for (const s of scopes) {
          if (s.target_ids?.length) {
            s.target_ids.forEach(id => pageIds.add(id));
          }
        }
        console.log('[FB OAuth] debug_token 找到頁面 IDs:', [...pageIds]);

        // 用 user token 逐一取得每個頁面的資料與 page access token
        for (const pageId of pageIds) {
          try {
            const pageRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
              params: { access_token: userToken, fields: 'id,name,access_token' },
            });
            if (pageRes.data.access_token) pages.push(pageRes.data);
          } catch (pe) {
            console.log('[FB OAuth] 取得頁面', pageId, '失敗:', pe.response?.data?.error?.message);
          }
        }
        console.log('[FB OAuth] debug_token 方式最終頁面數:', pages.length);
      } catch (dbgErr) {
        console.log('[FB OAuth] debug_token 失敗:', dbgErr.response?.data?.error?.message);
      }
    }

    if (pages.length === 0) {
      return sendToOpener({ type: 'fb_error', error: '未找到可連結的粉絲專頁，請確認授權時已勾選所有權限並選擇粉絲專頁。' });
    }
    sendToOpener({ type: 'fb_pages', pages });
  } catch (err) {
    const fbErr = err.response?.data?.error;
    const msg = fbErr ? `Facebook 錯誤 ${fbErr.code}: ${fbErr.message}` : (err.message || '未知錯誤');
    console.error('[FB OAuth] 發生錯誤:', err.response?.data || err.message);
    sendToOpener({ type: 'fb_error', error: msg });
  }
});

module.exports = router;
