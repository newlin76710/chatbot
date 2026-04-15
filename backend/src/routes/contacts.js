// routes/contacts.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Contact, Channel } = require('../models');

// GET /api/contacts
router.get('/', auth, async (req, res) => {
  try {
    const { channelId, tag, search, page = 1, limit = 50 } = req.query;
    const channel = await Channel.findOne({ _id: channelId, ownedBy: req.user._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    const query = { channel: channelId };
    if (tag) query.tags = tag;
    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { platformId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Contact.countDocuments(query);
    const contacts = await Contact.find(query)
      .select('-conversationHistory -currentFlowState')
      .sort('-lastInteractedAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ contacts, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/tags/list - get all unique tags in a channel（需在 /:id 之前）
router.get('/tags/list', auth, async (req, res) => {
  try {
    const { channelId } = req.query;
    const tags = await Contact.distinct('tags', { channel: channelId });
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('segments', 'name color');
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });
    res.json({ contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/contacts/:id/tags
router.patch('/:id/tags', auth, async (req, res) => {
  try {
    const { add = [], remove = [] } = req.body;
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });

    if (add.length) contact.tags = [...new Set([...contact.tags, ...add])];
    if (remove.length) contact.tags = contact.tags.filter(t => !remove.includes(t));
    await contact.save();

    res.json({ contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
