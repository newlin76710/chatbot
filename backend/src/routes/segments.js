const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Segment, Contact } = require('../models');

// GET /api/segments
router.get('/', auth, async (req, res) => {
  try {
    const { channelId } = req.query;
    const query = { ownedBy: req.user._id };
    if (channelId) query.channel = channelId;

    const segments = await Segment.find(query).sort('-createdAt');
    res.json({ segments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/segments/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const segment = await Segment.findOne({ _id: req.params.id, ownedBy: req.user._id });
    if (!segment) return res.status(404).json({ error: 'Segment not found' });
    res.json({ segment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/segments
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, channelId, type, rules, rulesMode, color } = req.body;
    const segment = await Segment.create({
      name, description, color,
      channel: channelId,
      ownedBy: req.user._id,
      type: type || 'dynamic',
      rules: rules || [],
      rulesMode: rulesMode || 'and',
    });

    // Calculate initial member count for dynamic segment
    if (type === 'dynamic' && rules?.length) {
      const count = await calculateDynamicSegmentCount(segment, channelId);
      segment.memberCount = count;
      await segment.save();
    }

    res.status(201).json({ segment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/segments/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, rules, rulesMode, color } = req.body;
    const segment = await Segment.findOneAndUpdate(
      { _id: req.params.id, ownedBy: req.user._id },
      { name, description, rules, rulesMode, color },
      { new: true }
    );
    if (!segment) return res.status(404).json({ error: 'Segment not found' });
    res.json({ segment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/segments/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const segment = await Segment.findOneAndDelete({ _id: req.params.id, ownedBy: req.user._id });
    if (!segment) return res.status(404).json({ error: 'Segment not found' });
    // Remove segment from contacts
    await Contact.updateMany({ segments: segment._id }, { $pull: { segments: segment._id } });
    res.json({ message: 'Segment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/segments/:id/contacts
router.get('/:id/contacts', auth, async (req, res) => {
  try {
    const segment = await Segment.findOne({ _id: req.params.id, ownedBy: req.user._id });
    if (!segment) return res.status(404).json({ error: 'Segment not found' });

    let contacts;
    if (segment.type === 'static') {
      contacts = await Contact.find({ _id: { $in: segment.contacts } })
        .select('displayName pictureUrl tags platformId platform lastInteractedAt');
    } else {
      const mongoQuery = buildContactQuery(segment.rules, segment.rulesMode, segment.channel);
      contacts = await Contact.find(mongoQuery)
        .select('displayName pictureUrl tags platformId platform lastInteractedAt')
        .limit(500);
    }
    res.json({ contacts, total: contacts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: convert segment rules to MongoDB query
function buildContactQuery(rules, mode, channelId) {
  const conditions = rules.map(rule => {
    const { field, operator, value } = rule;
    let fieldPath = field;
    if (field.startsWith('customField.')) {
      fieldPath = `customFields.${field.split('.')[1]}`;
    }
    switch (operator) {
      case 'equals': return { [fieldPath]: value };
      case 'notEquals': return { [fieldPath]: { $ne: value } };
      case 'contains': return { [fieldPath]: { $in: Array.isArray(value) ? value : [value] } };
      case 'notContains': return { [fieldPath]: { $nin: Array.isArray(value) ? value : [value] } };
      case 'exists': return { [fieldPath]: { $exists: true, $ne: null } };
      case 'greaterThan': return { [fieldPath]: { $gt: value } };
      case 'lessThan': return { [fieldPath]: { $lt: value } };
      default: return {};
    }
  });

  const query = { channel: channelId, isFollowing: true };
  if (conditions.length) {
    query[mode === 'or' ? '$or' : '$and'] = conditions;
  }
  return query;
}

async function calculateDynamicSegmentCount(segment, channelId) {
  const query = buildContactQuery(segment.rules, segment.rulesMode, channelId);
  return Contact.countDocuments(query);
}

module.exports = router;
