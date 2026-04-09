const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Flow, Channel } = require('../models');

// GET /api/flows - list all flows for a channel
router.get('/', auth, async (req, res) => {
  try {
    const { channelId } = req.query;
    const query = { ownedBy: req.user._id };
    if (channelId) query.channel = channelId;

    const flows = await Flow.find(query)
      .select('name description isActive stats createdAt updatedAt channel')
      .populate('channel', 'name platform')
      .sort('-updatedAt');

    res.json({ flows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flows/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const flow = await Flow.findOne({ _id: req.params.id, ownedBy: req.user._id })
      .populate('channel', 'name platform');
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    res.json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, channelId, nodes, edges } = req.body;
    if (!name || !channelId)
      return res.status(400).json({ error: 'Name and channelId are required' });

    const channel = await Channel.findOne({ _id: channelId, ownedBy: req.user._id });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const flow = await Flow.create({
      name, description,
      channel: channelId,
      ownedBy: req.user._id,
      nodes: nodes || [],
      edges: edges || [],
    });

    res.status(201).json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/flows/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, nodes, edges, isActive } = req.body;
    const flow = await Flow.findOneAndUpdate(
      { _id: req.params.id, ownedBy: req.user._id },
      { name, description, nodes, edges, isActive, $inc: { version: 1 } },
      { new: true, runValidators: true }
    );
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    res.json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/flows/:id/toggle
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    const flow = await Flow.findOne({ _id: req.params.id, ownedBy: req.user._id });
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    flow.isActive = !flow.isActive;
    await flow.save();
    res.json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/flows/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const flow = await Flow.findOneAndDelete({ _id: req.params.id, ownedBy: req.user._id });
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    res.json({ message: 'Flow deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows/:id/duplicate
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const original = await Flow.findOne({ _id: req.params.id, ownedBy: req.user._id });
    if (!original) return res.status(404).json({ error: 'Flow not found' });

    const copy = await Flow.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      channel: original.channel,
      ownedBy: req.user._id,
      nodes: original.nodes,
      edges: original.edges,
      isActive: false,
    });
    res.status(201).json({ flow: copy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
