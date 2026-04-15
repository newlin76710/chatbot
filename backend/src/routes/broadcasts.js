const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Broadcast, Contact, Segment } = require('../models');
const { addBroadcastJob } = require('../services/broadcastService');

// GET /api/broadcasts
router.get('/', auth, async (req, res) => {
  try {
    const { channelId, status } = req.query;
    const query = { ownedBy: req.user._id };
    if (channelId) query.channel = channelId;
    if (status) query.status = status;

    const broadcasts = await Broadcast.find(query)
      .populate('channel', 'name platform')
      .sort('-createdAt');
    res.json({ broadcasts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/broadcasts/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const broadcast = await Broadcast.findOne({ _id: req.params.id, ownedBy: req.user._id })
      .populate('channel', 'name platform credentials')
      .populate('audience.segments', 'name');
    if (!broadcast) return res.status(404).json({ error: '找不到此廣播' });
    res.json({ broadcast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/broadcasts - create draft
router.post('/', auth, async (req, res) => {
  try {
    const { name, channelId, audience, messages, scheduledAt } = req.body;
    const broadcast = await Broadcast.create({
      name, messages,
      channel: channelId,
      ownedBy: req.user._id,
      audience: audience || { type: 'all' },
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'scheduled' : 'draft',
    });

    if (scheduledAt) {
      await addBroadcastJob(broadcast._id.toString(), new Date(scheduledAt));
    }

    res.status(201).json({ broadcast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/broadcasts/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, audience, messages, scheduledAt } = req.body;
    const broadcast = await Broadcast.findOneAndUpdate(
      { _id: req.params.id, ownedBy: req.user._id, status: { $in: ['draft', 'scheduled'] } },
      { name, audience, messages, scheduledAt, status: scheduledAt ? 'scheduled' : 'draft' },
      { new: true }
    );
    if (!broadcast) return res.status(404).json({ error: '找不到此廣播或無法編輯' });
    res.json({ broadcast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/broadcasts/:id/send - send immediately
router.post('/:id/send', auth, async (req, res) => {
  try {
    const broadcast = await Broadcast.findOne({
      _id: req.params.id,
      ownedBy: req.user._id,
      status: { $in: ['draft', 'scheduled'] }
    }).populate('channel');
    if (!broadcast) return res.status(404).json({ error: '找不到此廣播' });

    broadcast.status = 'sending';
    await broadcast.save();

    // Resolve audience
    const contacts = await resolveAudience(broadcast);
    broadcast.stats.total = contacts.length;
    await broadcast.save();

    // Enqueue sending (async, non-blocking)
    const { sendBroadcastNow } = require('../services/broadcastService');
    sendBroadcastNow(broadcast, contacts).catch(console.error);

    res.json({ broadcast, audienceCount: contacts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/broadcasts/:id/cancel
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const broadcast = await Broadcast.findOneAndUpdate(
      { _id: req.params.id, ownedBy: req.user._id, status: { $in: ['scheduled', 'sending'] } },
      { status: 'cancelled' },
      { new: true }
    );
    if (!broadcast) return res.status(404).json({ error: '找不到此廣播' });
    res.json({ broadcast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/broadcasts/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Broadcast.findOneAndDelete({ _id: req.params.id, ownedBy: req.user._id, status: 'draft' });
    res.json({ message: '廣播已刪除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper
async function resolveAudience(broadcast) {
  const { type, segments, tags, contacts: contactIds } = broadcast.audience;
  const baseQuery = { channel: broadcast.channel._id, isFollowing: true, isBlocked: { $ne: true } };

  switch (type) {
    case 'all':
      return Contact.find(baseQuery).select('_id platformId platform');
    case 'segments': {
      const segs = await Segment.find({ _id: { $in: segments } });
      const contactSets = await Promise.all(segs.map(s =>
        Contact.find({ ...baseQuery, ...(s.type === 'static' ? { _id: { $in: s.contacts } } : buildDynQuery(s)) })
          .select('_id platformId platform')
      ));
      const unique = new Map();
      contactSets.flat().forEach(c => unique.set(c._id.toString(), c));
      return [...unique.values()];
    }
    case 'tags':
      return Contact.find({ ...baseQuery, tags: { $in: tags } }).select('_id platformId platform');
    case 'contacts':
      return Contact.find({ ...baseQuery, _id: { $in: contactIds } }).select('_id platformId platform');
    default:
      return [];
  }
}

function buildDynQuery(segment) {
  const conds = (segment.rules || []).map(r => {
    if (r.field === 'tags') return { tags: { $in: [r.value] } };
    return { [r.field]: r.value };
  });
  return conds.length ? { [segment.rulesMode === 'or' ? '$or' : '$and']: conds } : {};
}

module.exports = router;
