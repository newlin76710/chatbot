// routes/analytics.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const workspaceAuth = require('../middleware/workspaceAuth');
const { Contact, Flow, Broadcast, Channel } = require('../models');

// GET /api/analytics/overview?channelId=xxx
router.get('/overview', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const { channelId } = req.query;
    if (!channelId) return res.status(400).json({ error: 'channelId required' });

    const channel = await Channel.findOne({ _id: channelId, $or: [{ workspaces: req.workspace._id }, { workspace: req.workspace._id }] });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    const [totalContacts, newContactsToday, activeFlows, totalBroadcasts] = await Promise.all([
      Contact.countDocuments({ channel: channelId, isFollowing: true }),
      Contact.countDocuments({
        channel: channelId,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      Flow.countDocuments({ channel: channelId, isActive: true }),
      Broadcast.countDocuments({ channel: channelId, status: 'sent' }),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const growth = await Contact.aggregate([
      { $match: { channel: new mongoose.Types.ObjectId(channelId), createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const topTags = await Contact.aggregate([
      { $match: { channel: new mongoose.Types.ObjectId(channelId) } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({ totalContacts, newContactsToday, activeFlows, totalBroadcasts, growth, topTags });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
