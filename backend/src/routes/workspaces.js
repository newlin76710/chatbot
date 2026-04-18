const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const workspaceAuth = require('../middleware/workspaceAuth');
const { Workspace, User } = require('../models');

// GET /api/workspaces — 列出使用者所在的工作區
router.get('/', auth, async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.user': req.user._id, isActive: true })
      .populate('members.user', 'name email');
    const list = workspaces.map(ws => {
      const member = ws.members.find(m => m.user._id.equals(req.user._id));
      return {
        id: ws._id,
        name: ws.name,
        owner: ws.owner,
        role: member?.role,
        memberCount: ws.members.length,
        createdAt: ws.createdAt,
      };
    });
    res.json({ workspaces: list });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/workspaces — 建立新工作區
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '工作區名稱為必填' });

    const workspace = await Workspace.create({
      name: name.trim(),
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
    });
    res.status(201).json({
      workspace: { id: workspace._id, name: workspace.name, role: 'admin' },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/workspaces/:id — 取得工作區詳情（含成員）
router.get('/:id', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspace._id)
      .populate('members.user', 'name email')
      .populate('owner', 'name email');
    res.json({ workspace });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/workspaces/:id — 修改工作區名稱
router.put('/:id', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名稱不可空白' });
    req.workspace.name = name.trim();
    await req.workspace.save();
    res.json({ workspace: req.workspace });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/workspaces/:id — 刪除工作區（僅 owner）
router.delete('/:id', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    if (!req.workspace.owner.equals(req.user._id))
      return res.status(403).json({ error: '只有工作區擁有者可以刪除工作區' });
    req.workspace.isActive = false;
    await req.workspace.save();
    res.json({ message: '工作區已刪除' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/workspaces/:id/members — 列出成員
router.get('/:id/members', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspace._id)
      .populate('members.user', 'name email');
    res.json({ members: workspace.members });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/workspaces/:id/invites — 邀請成員（產生 token 連結）
router.post('/:id/invites', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const { email, role = 'editor' } = req.body;
    if (!email) return res.status(400).json({ error: '請輸入電子信箱' });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const alreadyMember = req.workspace.members.some(m => m.user.equals(existingUser._id));
      if (alreadyMember) return res.status(409).json({ error: '此使用者已是工作區成員' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    req.workspace.invites.push({ email: email.toLowerCase(), role, token, expiresAt, invitedBy: req.user._id });
    await req.workspace.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:2202';
    const inviteLink = `${frontendUrl}/join-workspace?token=${token}`;

    res.json({ inviteLink, expiresAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/workspaces/:id/members/:uid — 修改成員角色
router.put('/:id/members/:uid', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'editor', 'viewer'].includes(role))
      return res.status(400).json({ error: '無效的角色' });

    const memberEntry = req.workspace.members.find(m => m.user.equals(req.params.uid));
    if (!memberEntry) return res.status(404).json({ error: '找不到此成員' });

    if (req.workspace.owner.equals(req.params.uid) && role !== 'admin')
      return res.status(400).json({ error: '工作區擁有者必須為 admin' });

    memberEntry.role = role;
    await req.workspace.save();
    res.json({ message: '角色已更新' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/workspaces/:id/members/:uid — 移除成員
router.delete('/:id/members/:uid', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    if (req.workspace.owner.equals(req.params.uid))
      return res.status(400).json({ error: '無法移除工作區擁有者' });

    req.workspace.members = req.workspace.members.filter(m => !m.user.equals(req.params.uid));
    await req.workspace.save();
    res.json({ message: '成員已移除' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/workspaces/join/:token — 使用邀請 token 加入工作區
router.post('/join/:token', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      'invites.token': req.params.token,
      'invites.expiresAt': { $gt: new Date() },
      isActive: true,
    });
    if (!workspace) return res.status(404).json({ error: '邀請連結無效或已過期' });

    const invite = workspace.invites.find(i => i.token === req.params.token);
    if (invite.email && invite.email !== req.user.email.toLowerCase())
      return res.status(403).json({ error: '此邀請連結不適用於您的帳號' });

    const alreadyMember = workspace.members.some(m => m.user.equals(req.user._id));
    if (alreadyMember) return res.status(409).json({ error: '您已是此工作區的成員' });

    workspace.members.push({ user: req.user._id, role: invite.role });
    workspace.invites = workspace.invites.filter(i => i.token !== req.params.token);
    await workspace.save();

    res.json({
      message: `已成功加入工作區：${workspace.name}`,
      workspace: { id: workspace._id, name: workspace.name, role: invite.role },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
