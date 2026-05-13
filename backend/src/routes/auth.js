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
    scope: 'pages_messaging,pages_read_engagement,pages_manage_metadata',
    response_type: 'code',
    state: Math.random().toString(36).slice(2),
  });
  res.json({ url: `https://www.facebook.com/v18.0/dialog/oauth?${params}` });
});

// GET /api/auth/facebook/callback — FB OAuth 回調，取得粉絲專頁清單後以 postMessage 傳回
router.get('/facebook/callback', async (req, res) => {
  const { code, error } = req.query;
  const { FB_APP_ID, FB_APP_SECRET, BACKEND_URL } = process.env;

  const sendToOpener = (data) => {
    // helmet 預設 CSP 會擋 inline script，此 callback 頁需明確允許
    res.setHeader('Content-Security-Policy', "script-src 'unsafe-inline';");
    const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    res.send(`<!DOCTYPE html><html><body><script>
      (function(){
        if(window.opener){ window.opener.postMessage(${json},'*'); }
        window.close();
      })();
    \x3c/script></body></html>`);
  };

  if (error || !code) return sendToOpener({ type: 'fb_error', error: '授權失敗或已取消' });

  try {
    const redirectUri = `${BACKEND_URL || 'http://localhost:4000'}/api/auth/facebook/callback`;

    // 以 code 換取用戶 Access Token
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: { client_id: FB_APP_ID, client_secret: FB_APP_SECRET, redirect_uri: redirectUri, code },
    });
    const userToken = tokenRes.data.access_token;

    // 取得此用戶管理的粉絲專頁清單（含各頁面的 Page Access Token）
    const pagesRes = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: { access_token: userToken, fields: 'id,name,access_token,picture' },
    });
    sendToOpener({ type: 'fb_pages', pages: pagesRes.data.data || [] });
  } catch (err) {
    const msg = err.response?.data?.error?.message || '取得粉絲專頁失敗';
    sendToOpener({ type: 'fb_error', error: msg });
  }
});

module.exports = router;
