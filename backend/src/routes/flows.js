const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const workspaceAuth = require('../middleware/workspaceAuth');
const { Flow, Channel } = require('../models');

// GET /api/flows/templates
router.get('/templates', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const templates = await Flow.find({ workspace: req.workspace._id, isTemplate: true })
      .select('name description nodes edges createdAt')
      .sort('-createdAt');
    res.json({ templates: templates.map(t => ({
      id: t._id,
      name: t.name,
      description: t.description,
      nodeCount: t.nodes.length,
    })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows/templates/:id/import
router.post('/templates/:id/import', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const { channelId } = req.body;
    const tpl = await Flow.findOne({ _id: req.params.id, workspace: req.workspace._id, isTemplate: true });
    if (!tpl) return res.status(404).json({ error: '找不到此範本' });

    const channel = await Channel.findOne({ _id: channelId, workspace: req.workspace._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    const flow = await Flow.create({
      name: tpl.name,
      description: tpl.description,
      channel: channelId,
      workspace: req.workspace._id,
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

// GET /api/flows
router.get('/', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const { channelId } = req.query;
    const query = { workspace: req.workspace._id };
    if (channelId) query.channel = channelId;

    const flows = await Flow.find(query)
      .select('name description isActive isTemplate stats createdAt updatedAt channel')
      .populate('channel', 'name platform')
      .sort('-updatedAt');

    res.json({ flows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flows/:id
router.get('/:id', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const flow = await Flow.findOne({ _id: req.params.id, workspace: req.workspace._id })
      .populate('channel', 'name platform');
    if (!flow) return res.status(404).json({ error: '找不到此流程' });
    res.json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows
router.post('/', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const { name, description, channelId, nodes, edges } = req.body;
    if (!name || !channelId)
      return res.status(400).json({ error: '名稱與頻道 ID 為必填' });

    const channel = await Channel.findOne({ _id: channelId, workspace: req.workspace._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    const flow = await Flow.create({
      name, description,
      channel: channelId,
      workspace: req.workspace._id,
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
router.put('/:id', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const { name, description, nodes, edges, isActive } = req.body;
    const flow = await Flow.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
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
router.patch('/:id/toggle', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const flow = await Flow.findOne({ _id: req.params.id, workspace: req.workspace._id });
    if (!flow) return res.status(404).json({ error: '找不到此流程' });
    flow.isActive = !flow.isActive;
    await flow.save();
    res.json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/flows/:id
router.delete('/:id', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const flow = await Flow.findOneAndDelete({ _id: req.params.id, workspace: req.workspace._id });
    if (!flow) return res.status(404).json({ error: '找不到此流程' });
    res.json({ message: '流程已刪除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows/:id/duplicate
router.post('/:id/duplicate', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const original = await Flow.findOne({ _id: req.params.id, workspace: req.workspace._id });
    if (!original) return res.status(404).json({ error: '找不到此流程' });

    const copy = await Flow.create({
      name: `${original.name} (複製)`,
      description: original.description,
      channel: original.channel,
      workspace: req.workspace._id,
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

// PATCH /api/flows/:id/set-template
router.patch('/:id/set-template', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const { isTemplate } = req.body;
    const flow = await Flow.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
      { isTemplate: !!isTemplate },
      { new: true }
    );
    if (!flow) return res.status(404).json({ error: '找不到此流程' });
    res.json({ flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
