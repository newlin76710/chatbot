const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Channel, Contact, Flow, Campaign } = require('../models');
const { processMessage } = require('../services/flowEngine');

// ─── LINE Webhook ─────────────────────────────────────────────
router.post('/line/:channelId', async (req, res) => {
  // Immediately return 200 to LINE
  res.status(200).json({ status: 'ok' });

  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel || channel.platform !== 'line') return;

    // Verify signature（用原始 rawBody，確保位元組一致）
    const sig = req.headers['x-line-signature'];
    const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
    const hmac = crypto
      .createHmac('sha256', channel.credentials.channelSecret)
      .update(rawBody)
      .digest('base64');
    if (sig !== hmac) {
      console.warn('[LINE] 簽章驗證失敗，channelId:', req.params.channelId);
      return;
    }

    const { events } = req.body;
    for (const event of events) {
      await handleLineEvent(event, channel);
    }
  } catch (err) {
    console.error('LINE webhook error:', err);
  }
});

async function handleLineEvent(event, channel) {
  const { type, source, message, postback } = event;
  const platformId = source.userId || source.groupId;
  if (!platformId) return;

  // Upsert contact
  let contact = await Contact.findOneAndUpdate(
    { platformId, channel: channel._id, platform: 'line' },
    {
      lastInteractedAt: new Date(),
      isFollowing: type !== 'unfollow',
    },
    { upsert: true, new: true }
  );

  // Fetch LINE profile if new
  if (!contact.displayName) {
    try {
      const axios = require('axios');
      const profile = await axios.get(`https://api.line.me/v2/bot/profile/${platformId}`, {
        headers: { Authorization: `Bearer ${channel.credentials.accessToken}` }
      });
      contact.displayName = profile.data.displayName;
      contact.pictureUrl = profile.data.pictureUrl;
      contact.language = profile.data.language;
      await contact.save();
    } catch (_) {}
  }

  // Determine trigger context
  let triggerType = type;
  let text = '';
  let postbackPayload = '';

  if (type === 'message' && message?.type === 'text') {
    text = message.text;
    triggerType = 'keyword';
  } else if (type === 'postback') {
    postbackPayload = postback.data;
    triggerType = 'postback';
  } else if (type === 'follow') {
    triggerType = 'follow';
  } else if (type === 'unfollow') {
    triggerType = 'unfollow';
  }

  // 優先：若聯絡人在流程中等待輸入，繼續該流程
  if (contact.currentFlowState?.waitingForInput && text) {
    const resumeFlow = await Flow.findById(contact.currentFlowState.flowId);
    if (resumeFlow) {
      console.log('[LINE] 繼續等待輸入的流程:', resumeFlow.name);
      await processMessage({ contact, flow: resumeFlow, channel, text, isResuming: true });
      return;
    }
  }

  // 尋找符合觸發條件的流程
  const flows = await Flow.find({ channel: channel._id, isActive: true });
  console.log('[LINE] 活躍流程數量:', flows.length, '| 觸發類型:', triggerType, '| 文字:', text);

  for (const flow of flows) {
    const triggerNode = flow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) continue;

    const t = triggerNode.data?.trigger || triggerNode.data || {};
    let matches = false;

    if (t.type === 'any') matches = true;
    else if (t.type === 'follow' && triggerType === 'follow') matches = true;
    else if (t.type === 'unfollow' && triggerType === 'unfollow') matches = true;
    else if (t.type === 'postback' && triggerType === 'postback' && t.postbackPayload === postbackPayload) matches = true;
    else if (t.type === 'keyword' && triggerType === 'keyword') {
      matches = t.keywords?.some(kw => {
        if (t.matchMode === 'exact') return text.toLowerCase() === kw.toLowerCase();
        if (t.matchMode === 'startsWith') return text.toLowerCase().startsWith(kw.toLowerCase());
        return text.toLowerCase().includes(kw.toLowerCase());
      });
    }

    console.log('[LINE] 流程:', flow.name, '| trigger type:', t.type, '| 關鍵字:', t.keywords, '| 匹配:', matches);

    if (matches) {
      await processMessage({ contact, flow, channel, text, postbackPayload });
      // 若關鍵字符合某導流活動，記錄加入數
      if (triggerType === 'keyword' && text) {
        Campaign.updateOne(
          { channel: channel._id, keyword: text },
          { $inc: { 'stats.joins': 1 } }
        ).catch(() => {});
      }
      break;
    }
  }
}

// ─── Facebook Messenger Webhook ───────────────────────────────
// Verify challenge
router.get('/messenger/:channelId', async (req, res) => {
  const channel = await Channel.findById(req.params.channelId);
  if (!channel) return res.sendStatus(404);

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === channel.credentials.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/messenger/:channelId', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel || channel.platform !== 'messenger') return;

    // Verify app secret
    const sig = req.headers['x-hub-signature-256'];
    if (sig) {
      const expected = 'sha256=' + crypto
        .createHmac('sha256', channel.credentials.channelSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (sig !== expected) return;
    }

    const { entry } = req.body;
    for (const e of entry) {
      for (const messaging of (e.messaging || [])) {
        await handleMessengerEvent(messaging, channel);
      }
    }
  } catch (err) {
    console.error('Messenger webhook error:', err);
  }
});

async function handleMessengerEvent(event, channel) {
  const { sender, message, postback } = event;
  if (!sender?.id) return;

  let contact = await Contact.findOneAndUpdate(
    { platformId: sender.id, channel: channel._id, platform: 'messenger' },
    { lastInteractedAt: new Date() },
    { upsert: true, new: true }
  );

  if (!contact.displayName) {
    try {
      const axios = require('axios');
      const profile = await axios.get(
        `https://graph.facebook.com/${sender.id}?fields=name,profile_pic&access_token=${channel.credentials.accessToken}`
      );
      contact.displayName = profile.data.name;
      contact.pictureUrl = profile.data.profile_pic;
      await contact.save();
    } catch (_) {}
  }

  const text = message?.text || '';
  const postbackPayload = postback?.payload || '';
  const triggerType = postback ? 'postback' : 'keyword';

  // If contact is in mid-flow waiting for input, resume it first
  if (contact.currentFlowState?.waitingForInput && text) {
    const flow = await Flow.findById(contact.currentFlowState.flowId);
    if (flow) {
      await processMessage({ contact, flow, channel, text, isResuming: true });
      return;
    }
  }

  const flows = await Flow.find({ channel: channel._id, isActive: true });
  console.log('[Messenger] 活躍流程數量:', flows.length, '| 文字:', text);

  for (const flow of flows) {
    const triggerNode = flow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) continue;
    const t = triggerNode.data?.trigger || triggerNode.data || {};
    let matches = false;

    if (t.type === 'any') matches = true;
    else if (t.type === 'follow') matches = triggerType === 'keyword'; // Messenger 沒有 follow 事件，忽略
    else if (t.type === 'postback' && triggerType === 'postback' && t.postbackPayload === postbackPayload) matches = true;
    else if (t.type === 'keyword' && text) {
      matches = t.keywords?.some(kw => {
        if (t.matchMode === 'exact') return text.toLowerCase() === kw.toLowerCase();
        if (t.matchMode === 'startsWith') return text.toLowerCase().startsWith(kw.toLowerCase());
        return text.toLowerCase().includes(kw.toLowerCase());
      });
    }

    if (matches) {
      await processMessage({ contact, flow, channel, text, postbackPayload });
      break;
    }
  }
}

// ─── Instagram Webhook ───────────────────────────────────────
// Verify challenge（與 Messenger 相同機制）
router.get('/instagram/:channelId', async (req, res) => {
  const channel = await Channel.findById(req.params.channelId);
  if (!channel) return res.sendStatus(404);

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === channel.credentials.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/instagram/:channelId', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel || channel.platform !== 'instagram') return;

    // 驗證 App Secret 簽章
    const sig = req.headers['x-hub-signature-256'];
    if (sig) {
      const expected = 'sha256=' + crypto
        .createHmac('sha256', channel.credentials.channelSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (sig !== expected) return;
    }

    const { entry } = req.body;
    for (const e of entry) {
      for (const messaging of (e.messaging || [])) {
        await handleInstagramEvent(messaging, channel);
      }
    }
  } catch (err) {
    console.error('Instagram webhook error:', err);
  }
});

async function handleInstagramEvent(event, channel) {
  const { sender, message, postback } = event;
  if (!sender?.id) return;

  let contact = await Contact.findOneAndUpdate(
    { platformId: sender.id, channel: channel._id, platform: 'instagram' },
    { lastInteractedAt: new Date() },
    { upsert: true, new: true }
  );

  // 取得 Instagram 使用者資料
  if (!contact.displayName) {
    try {
      const axios = require('axios');
      const profile = await axios.get(
        `https://graph.facebook.com/${sender.id}?fields=name,profile_pic&access_token=${channel.credentials.accessToken}`
      );
      contact.displayName = profile.data.name;
      contact.pictureUrl = profile.data.profile_pic;
      await contact.save();
    } catch (_) {}
  }

  const text = message?.text || '';
  const postbackPayload = postback?.payload || '';
  const triggerType = postback ? 'postback' : 'keyword';

  // 若聯絡人在流程中等待輸入，繼續該流程
  if (contact.currentFlowState?.waitingForInput && text) {
    const flow = await Flow.findById(contact.currentFlowState.flowId);
    if (flow) {
      await processMessage({ contact, flow, channel, text, isResuming: true });
      return;
    }
  }

  const flows = await Flow.find({ channel: channel._id, isActive: true });
  console.log('[Instagram] 活躍流程數量:', flows.length, '| 文字:', text);

  for (const flow of flows) {
    const triggerNode = flow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) continue;
    const t = triggerNode.data?.trigger || triggerNode.data || {};
    let matches = false;

    if (t.type === 'any') matches = true;
    else if (t.type === 'postback' && triggerType === 'postback' && t.postbackPayload === postbackPayload) matches = true;
    else if (t.type === 'keyword' && text) {
      matches = t.keywords?.some(kw => {
        if (t.matchMode === 'exact') return text.toLowerCase() === kw.toLowerCase();
        if (t.matchMode === 'startsWith') return text.toLowerCase().startsWith(kw.toLowerCase());
        return text.toLowerCase().includes(kw.toLowerCase());
      });
    }

    if (matches) {
      await processMessage({ contact, flow, channel, text, postbackPayload });
      break;
    }
  }
}

// ─── Channels CRUD ────────────────────────────────────────────
module.exports = router;
