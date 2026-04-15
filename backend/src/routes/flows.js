const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Flow, Channel } = require('../models');
const NAMI_TEMPLATES = require('../seeds/namiFlowTemplates');

// GET /api/flows/templates - 取得娜米流程範本列表（需在 /:id 之前）
router.get('/templates', auth, (req, res) => {
  const list = NAMI_TEMPLATES.map((t, i) => ({
    id: i,
    name: t.name,
    description: t.description,
    platform: t.platform,
    nodeCount: t.nodes.length,
  }));
  res.json({ templates: list });
});

// POST /api/flows/templates/:id/import - 匯入範本為新流程（需在 /:id 之前）
router.post('/templates/:id/import', auth, async (req, res) => {
  try {
    const { channelId } = req.body;
    const tpl = NAMI_TEMPLATES[parseInt(req.params.id)];
    if (!tpl) return res.status(404).json({ error: '找不到此範本' });

    const channel = await Channel.findOne({ _id: channelId, ownedBy: req.user._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    const flow = await Flow.create({
      name: tpl.name,
      description: tpl.description,
      channel: channelId,
      ownedBy: req.user._id,
      nodes: tpl.nodes,
      edges: tpl.edges,
      isActive: false,
    });
    res.status(201).json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    if (!flow) return res.status(404).json({ error: '找不到此流程' });
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
      return res.status(400).json({ error: '名稱與頻道 ID 為必填' });

    const channel = await Channel.findOne({ _id: channelId, ownedBy: req.user._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

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
    if (!flow) return res.status(404).json({ error: '找不到此流程' });
    res.json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/flows/:id/toggle
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    const flow = await Flow.findOne({ _id: req.params.id, ownedBy: req.user._id });
    if (!flow) return res.status(404).json({ error: '找不到此流程' });
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
    if (!flow) return res.status(404).json({ error: '找不到此流程' });
    res.json({ message: '流程已刪除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows/:id/duplicate
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const original = await Flow.findOne({ _id: req.params.id, ownedBy: req.user._id });
    if (!original) return res.status(404).json({ error: '找不到此流程' });

    const copy = await Flow.create({
      name: `${original.name} (複製)`,
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
