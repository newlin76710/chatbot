const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const workspaceAuth = require('../middleware/workspaceAuth');
const { Channel, Contact } = require('../models');
const crypto = require('crypto');
const axios = require('axios');

router.get('/', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const channels = await Channel.find({ $or: [{ workspaces: req.workspace._id }, { workspace: req.workspace._id }] })
      .select('-credentials.channelSecret')
      .sort('-createdAt');
    res.json({ channels });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const { name, platform, credentials } = req.body;
    const verifyToken = crypto.randomBytes(16).toString('hex');
    const channel = await Channel.create({
      name, platform,
      workspace: req.workspace._id,
      workspaces: [req.workspace._id],
      ownedBy: req.user._id,
      credentials: { ...credentials, verifyToken },
    });
    res.status(201).json({ channel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 加入現有頻道（管理者輸入頻道 ID 連結至目前工作區）
router.post('/:id/link', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: '找不到此頻道 ID，請確認後再試' });

    const alreadyLinked = channel.workspaces.some(w => String(w) === String(req.workspace._id));
    if (alreadyLinked) return res.status(400).json({ error: '此頻道已在工作區中' });

    await Channel.findByIdAndUpdate(req.params.id, { $addToSet: { workspaces: req.workspace._id } });
    const updated = await Channel.findById(req.params.id).select('-credentials.channelSecret');
    res.json({ channel: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const { name, credentials, isActive } = req.body;
    // 只有擁有者工作區可以編輯頻道設定
    const channel = await Channel.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
      { name, credentials, isActive },
      { new: true }
    );
    if (!channel) return res.status(404).json({ error: '頻道不存在或您沒有編輯權限（非擁有者工作區）' });
    res.json({ channel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const channel = await Channel.findOne({ _id: req.params.id, $or: [{ workspaces: req.workspace._id }, { workspace: req.workspace._id }] });
    if (!channel) return res.status(404).json({ error: '頻道不存在' });

    if (String(channel.workspace) === String(req.workspace._id)) {
      // 擁有者工作區：永久刪除頻道
      await channel.deleteOne();
      res.json({ message: '頻道已刪除', action: 'deleted' });
    } else {
      // 共享工作區：僅取消連結
      await Channel.findByIdAndUpdate(req.params.id, { $pull: { workspaces: req.workspace._id } });
      res.json({ message: '已從工作區移除頻道', action: 'unlinked' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/sync-line-followers', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const channel = await Channel.findOne({ _id: req.params.id, $or: [{ workspaces: req.workspace._id }, { workspace: req.workspace._id }] });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.platform !== 'line') return res.status(400).json({ error: 'Not a LINE channel' });

    const accessToken = channel.credentials && channel.credentials.accessToken;
    if (!accessToken) return res.status(400).json({ error: 'Channel has no access token configured' });

    const headers = { Authorization: `Bearer ${accessToken}` };

    let allUserIds = [];
    let next = null;
    do {
      const url = `https://api.line.me/v2/bot/followers/ids?limit=1000${next ? `&start=${next}` : ''}`;
      let lineResp;
      try {
        lineResp = await axios.get(url, { headers });
      } catch (lineErr) {
        const status = lineErr.response?.status;
        const msg = lineErr.response?.data?.message || lineErr.message;
        return res.status(422).json({ error: `LINE API error (${status}): ${msg}` });
      }
      allUserIds = allUserIds.concat(lineResp.data.userIds || []);
      next = lineResp.data.next || null;
    } while (next);

    const existing = await Contact.find(
      { channel: channel._id, platform: 'line', platformId: { $in: allUserIds } },
      { platformId: 1 }
    );
    const existingSet = new Set(existing.map(c => c.platformId));
    const newIds = allUserIds.filter(id => !existingSet.has(id));

    if (newIds.length > 0) {
      await Contact.bulkWrite(newIds.map(userId => ({
        updateOne: {
          filter: { platformId: userId, channel: channel._id, platform: 'line' },
          update: { $setOnInsert: { platformId: userId, channel: channel._id, platform: 'line', isFollowing: true } },
          upsert: true,
        }
      })));
    }

    res.json({ total: allUserIds.length, existing: existingSet.size, created: newIds.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
