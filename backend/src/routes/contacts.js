// routes/contacts.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Contact, Channel, Flow } = require('../models');
const { sendLineMessage, sendMessengerMessage } = require('../services');
const { processMessage } = require('../services/flowEngine');

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

// GET /api/contacts/debug/all — 列出所有聯絡人（debug 用，部署後可刪）
router.get('/debug/all', auth, async (req, res) => {
  try {
    const contacts = await Contact.find({})
      .select('platformId platform displayName customFields channel')
      .limit(50);
    res.json(contacts.map(c => ({
      _id: c._id,
      platformId: c.platformId,
      platform: c.platform,
      displayName: c.displayName,
      channel: c.channel,
      customFields: c.customFields ? Object.fromEntries(c.customFields) : {},
    })));
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
    // 將 Mongoose Map 明確轉為純物件，避免前端收到空 {}
    const obj = contact.toObject();
    if (obj.customFields instanceof Map) {
      obj.customFields = Object.fromEntries(obj.customFields);
    } else if (obj.customFields && !(obj.customFields.constructor === Object)) {
      obj.customFields = Object.fromEntries(Object.entries(obj.customFields));
    }
    res.json({ contact: obj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/contacts/:id/fields — 手動設定 customFields（支援 MongoDB _id 或 LINE platformId）
router.patch('/:id/fields', auth, async (req, res) => {
  try {
    const { fields } = req.body;
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'fields 必須是物件' });
    }
    const setOps = {};
    for (const [k, v] of Object.entries(fields)) {
      setOps[`customFields.${k}`] = v;
    }
    // 支援 MongoDB ObjectId 或 platformId 兩種查詢方式
    const isObjectId = /^[a-f\d]{24}$/i.test(req.params.id);
    const query = isObjectId ? { _id: req.params.id } : { platformId: req.params.id };
    const contact = await Contact.findOneAndUpdate(
      query,
      { $set: setOps },
      { new: true }
    );
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });
    const customFields = {};
    if (contact.customFields) contact.customFields.forEach((v, k) => { customFields[k] = v; });
    res.json({ ok: true, customFields });
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

// POST /api/contacts/:id/send — 後台直接傳訊息給聯絡人
router.post('/:id/send', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: '訊息不可空白' });

    const contact = await Contact.findById(req.params.id).populate('channel');
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });

    const channel = contact.channel;
    const msg = { type: 'text', text: text.trim() };

    if (channel.platform === 'line') {
      await sendLineMessage(channel, contact.platformId, msg);
    } else if (channel.platform === 'messenger' || channel.platform === 'instagram') {
      await sendMessengerMessage(channel, contact.platformId, msg);
    } else {
      return res.status(400).json({ error: `不支援的平台：${channel.platform}` });
    }

    // 存入對話紀錄
    await Contact.updateOne(
      { _id: contact._id },
      {
        $push: {
          conversationHistory: {
            $each: [{ role: 'bot', content: text.trim(), messageType: 'text', timestamp: new Date() }],
            $slice: -100,
          },
        },
      }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[傳訊息]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// POST /api/contacts/:id/trigger-flow — 後台觸發腳本給聯絡人
router.post('/:id/trigger-flow', auth, async (req, res) => {
  try {
    const { flowId } = req.body;
    if (!flowId) return res.status(400).json({ error: '缺少 flowId' });

    const contact = await Contact.findById(req.params.id).populate('channel');
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });

    const flow = await Flow.findOne({ _id: flowId, ownedBy: req.user._id });
    if (!flow) return res.status(404).json({ error: '找不到此流程' });

    await processMessage({ contact, flow, channel: contact.channel, text: '' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[觸發腳本]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
