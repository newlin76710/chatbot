// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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

module.exports = router;
