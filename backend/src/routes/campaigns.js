const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const auth = require('../middleware/auth');
const { Campaign, Channel } = require('../models');

const BASE_URL = process.env.FRONTEND_URL || 'https://bot.ek21.com';

function generateCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// GET /api/campaigns
router.get('/', auth, async (req, res) => {
  try {
    const { channelId } = req.query;
    const query = { ownedBy: req.user._id };
    if (channelId) query.channel = channelId;
    const campaigns = await Campaign.find(query).sort('-createdAt');
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns
router.post('/', auth, async (req, res) => {
  try {
    const { channelId, name, description, keyword, lineId } = req.body;
    if (!name || !channelId) return res.status(400).json({ error: '名稱與頻道為必填' });

    const channel = await Channel.findOne({ _id: channelId, ownedBy: req.user._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    // 確保 code 唯一
    let code;
    for (let i = 0; i < 10; i++) {
      code = generateCode();
      const exists = await Campaign.findOne({ code });
      if (!exists) break;
    }

    const campaign = await Campaign.create({
      name, description, keyword, lineId,
      channel: channelId,
      ownedBy: req.user._id,
      code,
    });
    res.status(201).json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/campaigns/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, description, keyword, lineId } = req.body;
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, ownedBy: req.user._id },
      { name, description, keyword, lineId },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: '找不到此活動' });
    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: req.params.id, ownedBy: req.user._id });
    if (!campaign) return res.status(404).json({ error: '找不到此活動' });
    res.json({ message: '已刪除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/qr  — 回傳 QR Code (base64 data URL)
router.get('/:id/qr', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, ownedBy: req.user._id });
    if (!campaign) return res.status(404).json({ error: '找不到此活動' });
    const url = `${BASE_URL}/c/${campaign.code}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: '#0F172A', light: '#ffffff' } });
    res.json({ qr: dataUrl, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
