const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Channel, Contact, Flow } = require('../models');
const { processMessage } = require('../services/flowEngine');

// ─── LINE Webhook ─────────────────────────────────────────────
router.post('/line/:channelId', async (req, res) => {
  // Immediately return 200 to LINE
  res.status(200).json({ status: 'ok' });

  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel || channel.platform !== 'line') return;

    // Verify signature
    const sig = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);
    const hmac = crypto
      .createHmac('sha256', channel.credentials.channelSecret)
      .update(body)
      .digest('base64');
    if (sig !== hmac) return;

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

  // Find matching active flow
  const flows = await Flow.find({ channel: channel._id, isActive: true });
  for (const flow of flows) {
    const triggerNode = flow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) continue;

    const t = triggerNode.data.trigger;
    let matches = false;

    if (t.type === 'follow' && triggerType === 'follow') matches = true;
    else if (t.type === 'unfollow' && triggerType === 'unfollow') matches = true;
    else if (t.type === 'postback' && triggerType === 'postback' && t.postbackPayload === postbackPayload) matches = true;
    else if (t.type === 'keyword' && triggerType === 'keyword') {
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

  // If contact is in mid-flow, continue it
  if (contact.currentFlowState?.waitingForInput && text) {
    const flow = await Flow.findById(contact.currentFlowState.flowId);
    if (flow) {
      await processMessage({ contact, flow, channel, text, isResuming: true });
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

  const flows = await Flow.find({ channel: channel._id, isActive: true });
  for (const flow of flows) {
    const triggerNode = flow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) continue;
    const t = triggerNode.data.trigger;
    let matches = false;

    if (t.type === 'postback' && triggerType === 'postback' && t.postbackPayload === postbackPayload) matches = true;
    else if (t.type === 'keyword' && text) {
      matches = t.keywords?.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
    }

    if (matches) {
      await processMessage({ contact, flow, channel, text, postbackPayload });
      break;
    }
  }
}

// ─── Channels CRUD ────────────────────────────────────────────
module.exports = router;
