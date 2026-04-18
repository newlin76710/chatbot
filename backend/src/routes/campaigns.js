const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const auth = require('../middleware/auth');
const workspaceAuth = require('../middleware/workspaceAuth');
const { Campaign, Channel } = require('../models');

const BASE_URL = process.env.FRONTEND_URL || 'https://bot.ek21.com';

function generateCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function buildDirectUrl(campaign) {
  if (campaign.platform === 'messenger') {
    const pageId = campaign.messengerPageId;
    if (!pageId) return null;
    const ref = campaign.keyword ? `?ref=${encodeURIComponent(campaign.keyword)}` : '';
    return `https://m.me/${pageId}${ref}`;
  }
  const lineId = (campaign.lineId || '').replace(/^@/, '');
  if (!lineId) return null;
  const kw = campaign.keyword ? `?oaMessageText=${encodeURIComponent(campaign.keyword)}` : '';
  return `https://line.me/R/ti/p/@${lineId}${kw}`;
}

// GET /api/campaigns
router.get('/', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const { channelId } = req.query;
    const query = { workspace: req.workspace._id };
    if (channelId) query.channel = channelId;
    const campaigns = await Campaign.find(query).sort('-createdAt');
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns
router.post('/', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const { channelId, name, description, keyword, lineId, messengerPageId, platform } = req.body;
    if (!name || !channelId) return res.status(400).json({ error: '名稱與頻道為必填' });

    const channel = await Channel.findOne({ _id: channelId, workspace: req.workspace._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    let code;
    for (let i = 0; i < 10; i++) {
      code = generateCode();
      if (!(await Campaign.findOne({ code }))) break;
    }

    const campaign = await Campaign.create({
      name, description, keyword, lineId, messengerPageId,
      platform: platform || channel.platform || 'line',
      channel: channelId,
      workspace: req.workspace._id,
      ownedBy: req.user._id,
      code,
    });
    res.status(201).json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/campaigns/:id
router.patch('/:id', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const { name, description, keyword, lineId, messengerPageId, platform } = req.body;
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
      { name, description, keyword, lineId, messengerPageId, platform },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: '找不到此活動' });
    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: req.params.id, workspace: req.workspace._id });
    if (!campaign) return res.status(404).json({ error: '找不到此活動' });
    res.json({ message: '已刪除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/qr
router.get('/:id/qr', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, workspace: req.workspace._id });
    if (!campaign) return res.status(404).json({ error: '找不到此活動' });
    const trackUrl = `${BASE_URL}/c/${campaign.code}`;
    const dataUrl = await QRCode.toDataURL(trackUrl, {
      width: 400, margin: 2, color: { dark: '#0F172A', light: '#ffffff' },
    });
    res.json({ qr: dataUrl, url: trackUrl, directUrl: buildDirectUrl(campaign) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/json
router.get('/:id/json', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, workspace: req.workspace._id });
    if (!campaign) return res.status(404).json({ error: '找不到此活動' });
    const trackUrl = `${BASE_URL}/c/${campaign.code}`;
    const directUrl = buildDirectUrl(campaign);
    const payload = {
      campaign: {
        id: campaign._id,
        name: campaign.name,
        description: campaign.description || '',
        platform: campaign.platform,
        keyword: campaign.keyword || '',
        code: campaign.code,
        trackingUrl: trackUrl,
        directUrl: directUrl || '',
        stats: campaign.stats,
        createdAt: campaign.createdAt,
      },
      ...(campaign.platform === 'messenger' && campaign.messengerPageId ? {
        messenger_json: {
          type: 'OPEN_THREAD',
          payload: {
            page_id: campaign.messengerPageId,
            ref: campaign.keyword || campaign.code,
          }
        }
      } : {}),
      ...(campaign.platform === 'line' && campaign.lineId ? {
        line_json: {
          type: 'uri',
          label: campaign.name,
          uri: directUrl || trackUrl,
        }
      } : {}),
    };
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
