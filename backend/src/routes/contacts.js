// routes/contacts.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const workspaceAuth = require('../middleware/workspaceAuth');
const { Contact, Channel, Flow } = require('../models');
const { sendLineMessage, sendMessengerMessage } = require('../services');
const { processMessage } = require('../services/flowEngine');

// GET /api/contacts
router.get('/', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const { channelId, tag, search, page = 1, limit = 50, dateField, dateFrom, dateTo, sortBy = 'lastInteractedAt', sortDir = 'desc' } = req.query;
    const channel = await Channel.findOne({ _id: channelId, workspace: req.workspace._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    const query = { channel: channelId };
    if (tag) query.tags = tag;
    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { platformId: { $regex: search, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      const field = dateField === 'createdAt' ? 'createdAt' : 'lastInteractedAt';
      query[field] = {};
      if (dateFrom) query[field].$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query[field].$lte = end;
      }
    }

    const allowedSortFields = { displayName: 1, platform: 1, createdAt: 1, lastInteractedAt: 1 };
    const sortField = allowedSortFields[sortBy] !== undefined ? sortBy : 'lastInteractedAt';
    const sortOrder = sortDir === 'asc' ? 1 : -1;

    const total = await Contact.countDocuments(query);
    const contacts = await Contact.find(query)
      .select('-conversationHistory -currentFlowState')
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ contacts, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/debug/all
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

// GET /api/contacts/export — 匯出 CSV
router.get('/export', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const { channelId, tag, search, dateField, dateFrom, dateTo, sortBy = 'lastInteractedAt', sortDir = 'desc' } = req.query;
    const channel = await Channel.findOne({ _id: channelId, workspace: req.workspace._id });
    if (!channel) return res.status(404).json({ error: '找不到此頻道' });

    const query = { channel: channelId };
    if (tag) query.tags = tag;
    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { platformId: { $regex: search, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      const field = dateField === 'createdAt' ? 'createdAt' : 'lastInteractedAt';
      query[field] = {};
      if (dateFrom) query[field].$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query[field].$lte = end;
      }
    }

    const allowedSortFields = { displayName: 1, platform: 1, createdAt: 1, lastInteractedAt: 1 };
    const sortField = allowedSortFields[sortBy] !== undefined ? sortBy : 'lastInteractedAt';
    const sortOrder = sortDir === 'asc' ? 1 : -1;

    const contacts = await Contact.find(query)
      .select('-conversationHistory -currentFlowState')
      .sort({ [sortField]: sortOrder })
      .limit(10000);

    // 收集所有 customField 欄位名稱
    const cfKeySet = new Set();
    contacts.forEach(c => {
      if (c.customFields) c.customFields.forEach((_, k) => cfKeySet.add(k));
    });
    const cfKeys = [...cfKeySet];

    const FIELD_LABELS = {
      maritalStatus: '感情狀態', city: '居住地區', birthYear: '出生年份',
      education: '學歷', heightWeight: '身高體重', occupation: '職業',
      phoneNumber: '手機號碼', name: '姓名', email: '電子郵件',
      gender: '性別', age: '年齡', address: '地址', note: '備註',
    };

    const headers = ['姓名', '帳號ID', '平台', '標籤', '加入日期', '最後對話時間',
      ...cfKeys.map(k => FIELD_LABELS[k] || k)];

    const fmtDate = d => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '';
    const escape = v => {
      const s = String(v ?? '');
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = contacts.map(c => {
      const cf = c.customFields ? Object.fromEntries(c.customFields) : {};
      return [
        c.displayName || '',
        c.platformId || '',
        c.platform || '',
        (c.tags || []).join('、'),
        fmtDate(c.createdAt),
        fmtDate(c.lastInteractedAt),
        ...cfKeys.map(k => cf[k] ?? ''),
      ].map(escape).join(',');
    });

    const csv = '﻿' + [headers.map(escape).join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contacts_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/tags/list
router.get('/tags/list', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const { channelId } = req.query;
    const tags = await Contact.distinct('tags', { channel: channelId });
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', auth, workspaceAuth('viewer'), async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('segments', 'name color')
      .populate('channel');
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });

    if (!contact.channel?.workspace?.equals(req.workspace._id))
      return res.status(403).json({ error: 'Forbidden' });

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

// PATCH /api/contacts/:id/fields
router.patch('/:id/fields', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const { fields } = req.body;
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'fields 必須是物件' });
    }
    const setOps = {};
    for (const [k, v] of Object.entries(fields)) {
      setOps[`customFields.${k}`] = v;
    }
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
router.patch('/:id/tags', auth, workspaceAuth('editor'), async (req, res) => {
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

// POST /api/contacts/:id/send
router.post('/:id/send', auth, workspaceAuth('editor'), async (req, res) => {
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

// DELETE /api/contacts/:id — 刪除聯絡人
router.delete('/:id', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).populate('channel');
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });
    if (!contact.channel?.workspace?.equals(req.workspace._id))
      return res.status(403).json({ error: 'Forbidden' });
    await Contact.deleteOne({ _id: contact._id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id/history — 清除對話紀錄與流程狀態
router.delete('/:id/history', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).populate('channel');
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });
    if (!contact.channel?.workspace?.equals(req.workspace._id))
      return res.status(403).json({ error: 'Forbidden' });
    await Contact.updateOne(
      { _id: contact._id },
      { $set: { conversationHistory: [], currentFlowState: null } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/:id/trigger-flow
router.post('/:id/trigger-flow', auth, workspaceAuth('editor'), async (req, res) => {
  try {
    const { flowId } = req.body;
    if (!flowId) return res.status(400).json({ error: '缺少 flowId' });

    const contact = await Contact.findById(req.params.id).populate('channel');
    if (!contact) return res.status(404).json({ error: '找不到此聯絡人' });

    const flow = await Flow.findOne({ _id: flowId, workspace: req.workspace._id });
    if (!flow) return res.status(404).json({ error: '找不到此流程' });

    await processMessage({ contact, flow, channel: contact.channel, text: '' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[觸發腳本]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
