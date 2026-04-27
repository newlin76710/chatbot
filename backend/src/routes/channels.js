const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const workspaceAuth = require('../middleware/workspaceAuth');
const { Channel, Contact } = require('../models');
const crypto = require('crypto');
const axios = require('axios');

router.get('/', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const channels = await Channel.find({ workspace: req.workspace._id })
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
      ownedBy: req.user._id,
      credentials: { ...credentials, verifyToken },
    });
    res.status(201).json({ channel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const { name, credentials, isActive } = req.body;
    const channel = await Channel.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
      { name, credentials, isActive },
      { new: true }
    );
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    await Channel.findOneAndDelete({ _id: req.params.id, workspace: req.workspace._id });
    res.json({ message: 'Channel deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/sync-line-followers', auth, workspaceAuth('admin'), async (req, res) => {
  try {
    const channel = await Channel.findOne({ _id: req.params.id, workspace: req.workspace._id });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.platform !== 'line') return res.status(400).json({ error: 'Not a LINE channel' });

    const accessToken = channel.credentials && channel.credentials.accessToken;
    if (!accessToken) return res.status(400).json({ error: 'Channel has no access token configured' });

    const headers = { Authorization: `Bearer ${accessToken}` };

    // Paginate through all follower IDs from LINE API
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
        return res.status(502).json({ error: `LINE API error (${status}): ${msg}` });
      }
      allUserIds = allUserIds.concat(lineResp.data.userIds || []);
      next = lineResp.data.next || null;
    } while (next);

    // Find which IDs already exist
    const existing = await Contact.find(
      { channel: channel._id, platform: 'line', platformId: { $in: allUserIds } },
      { platformId: 1 }
    );
    const existingSet = new Set(existing.map(c => c.platformId));
    const newIds = allUserIds.filter(id => !existingSet.has(id));

    // Bulk upsert new contacts without profile data (profiles fetched lazily on first interaction)
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
