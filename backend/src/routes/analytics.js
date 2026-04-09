// routes/analytics.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Contact, Flow, Broadcast } = require('../models');

// GET /api/analytics/overview?channelId=xxx
router.get('/overview', auth, async (req, res) => {
  try {
    const { channelId } = req.query;
    if (!channelId) return res.status(400).json({ error: 'channelId required' });

    const [totalContacts, newContactsToday, activeFlows, totalBroadcasts] = await Promise.all([
      Contact.countDocuments({ channel: channelId, isFollowing: true }),
      Contact.countDocuments({
        channel: channelId,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      Flow.countDocuments({ channel: channelId, isActive: true }),
      Broadcast.countDocuments({ channel: channelId, status: 'sent' }),
    ]);

    // Growth over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const growth = await Contact.aggregate([
      { $match: { channel: require('mongoose').Types.ObjectId(channelId), createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Top tags
    const topTags = await Contact.aggregate([
      { $match: { channel: require('mongoose').Types.ObjectId(channelId) } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({ totalContacts, newContactsToday, activeFlows, totalBroadcasts, growth, topTags });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
