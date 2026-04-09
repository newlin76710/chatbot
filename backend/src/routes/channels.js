// ============================================================
// routes/channels.js
// ============================================================
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Channel } = require('../models');
const crypto = require('crypto');

router.get('/', auth, async (req, res) => {
  try {
    const channels = await Channel.find({ ownedBy: req.user._id })
      .select('-credentials.channelSecret')
      .sort('-createdAt');
    res.json({ channels });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, platform, credentials } = req.body;
    const verifyToken = crypto.randomBytes(16).toString('hex');
    const channel = await Channel.create({
      name, platform, ownedBy: req.user._id,
      credentials: { ...credentials, verifyToken },
    });
    res.status(201).json({ channel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, credentials, isActive } = req.body;
    const channel = await Channel.findOneAndUpdate(
      { _id: req.params.id, ownedBy: req.user._id },
      { name, credentials, isActive },
      { new: true }
    );
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Channel.findOneAndDelete({ _id: req.params.id, ownedBy: req.user._id });
    res.json({ message: 'Channel deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
