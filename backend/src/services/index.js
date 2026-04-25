// ============================================================
// services/lineService.js
// ============================================================
const axios = require('axios');

const LINE_API = 'https://api.line.me/v2/bot';

// 快取 LINE OA basicId，1 小時更新一次
const _basicIdCache = new Map();
async function getLineBasicId(channel) {
  const key = channel._id.toString();
  const cached = _basicIdCache.get(key);
  if (cached && Date.now() - cached.ts < 3600000) return cached.basicId;
  const resp = await axios.get(`${LINE_API}/info`, {
    headers: { Authorization: `Bearer ${channel.credentials.accessToken}` },
  });
  const basicId = resp.data.basicId;
  _basicIdCache.set(key, { basicId, ts: Date.now() });
  return basicId;
}

// 將訊息中的 shareOA 按鈕解析為真實 URI
async function resolveShareButtons(message, channel) {
  if (message.type !== 'buttons' && message.type !== 'carousel') return message;
  const needsResolve = (btns) => (btns || []).some(b => b.type === 'shareOA');
  const hasShare = message.type === 'buttons'
    ? needsResolve(message.template?.buttons)
    : (message.template?.columns || []).some(col => needsResolve(col.buttons));
  if (!hasShare) return message;

  const basicId = await getLineBasicId(channel);
  const shareUri = `line://nv/recommendOA/${basicId}`;
  const resolveBtn = (b) => b.type === 'shareOA' ? { ...b, type: 'uri', url: shareUri } : b;

  if (message.type === 'buttons') {
    return { ...message, template: { ...message.template, buttons: (message.template?.buttons || []).map(resolveBtn) } };
  }
  return {
    ...message,
    template: {
      ...message.template,
      columns: (message.template?.columns || []).map(col => ({ ...col, buttons: (col.buttons || []).map(resolveBtn) })),
    },
  };
}

async function sendLineMessage(channel, userId, message) {
  const resolved = await resolveShareButtons(message, channel);
  const messages = convertToLineFormat([resolved]);
  await axios.post(
    `${LINE_API}/message/push`,
    { to: userId, messages },
    {
      headers: {
        Authorization: `Bearer ${channel.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

async function sendLineMulticast(channel, userIds, messages) {
  const resolved = await Promise.all(messages.map(m => resolveShareButtons(m, channel)));
  const lineMessages = convertToLineFormat(resolved);
  // LINE multicast supports up to 500 recipients per call
  const chunks = chunkArray(userIds, 500);
  for (const chunk of chunks) {
    await axios.post(
      `${LINE_API}/message/multicast`,
      { to: chunk, messages: lineMessages },
      { headers: { Authorization: `Bearer ${channel.credentials.accessToken}` } }
    );
  }
}

function convertToLineFormat(messages) {
  return messages.map(msg => {
    switch (msg.type) {
      case 'text':
        return {
          type: 'text',
          text: msg.text,
          quickReply: msg.quickReplies?.length ? {
            items: msg.quickReplies.map(qr => ({
              type: 'action',
              action: { type: 'message', label: qr.label, text: qr.text },
            }))
          } : undefined,
        };
      case 'image':
        return { type: 'image', originalContentUrl: msg.imageUrl, previewImageUrl: msg.imageUrl };
      case 'video':
        return { type: 'video', originalContentUrl: msg.videoUrl, previewImageUrl: msg.imageUrl };
      case 'sticker':
        return { type: 'sticker', packageId: '1', stickerId: msg.stickerId || '1' };
      case 'flex':
        return { type: 'flex', altText: msg.altText || 'Message', contents: msg.template };
      case 'buttons':
        return {
          type: 'template',
          altText: msg.altText || 'Buttons',
          template: {
            type: 'buttons',
            text: msg.text,
            actions: (msg.template?.buttons || []).map(b => ({
              type: b.type || 'message',
              label: b.label,
              text: b.text,
              data: b.payload,
              uri: b.url,
            }))
          }
        };
      case 'carousel':
        return {
          type: 'template',
          altText: msg.altText || 'Carousel',
          template: {
            type: 'carousel',
            columns: (msg.template?.columns || []).map(col => ({
              thumbnailImageUrl: col.imageUrl,
              title: col.title,
              text: col.text,
              actions: (col.buttons || []).map(b => ({
                type: b.type || 'message',
                label: b.label,
                text: b.text,
              }))
            }))
          }
        };
      default:
        return { type: 'text', text: msg.text || '' };
    }
  });
}

// ============================================================
// services/messengerService.js
// ============================================================
const GRAPH_API = 'https://graph.facebook.com/v18.0';

async function sendMessengerMessage(channel, recipientId, message) {
  const body = {
    recipient: { id: recipientId },
    message: convertToMessengerFormat(message),
  };
  await axios.post(
    `${GRAPH_API}/me/messages?access_token=${channel.credentials.accessToken}`,
    body
  );
}

async function sendMessengerBroadcast(channel, recipientIds, messages) {
  // Messenger requires individual sends (no native multicast)
  for (const id of recipientIds) {
    for (const msg of messages) {
      try {
        await sendMessengerMessage(channel, id, msg);
      } catch (e) {
        console.error(`Failed to send to ${id}:`, e.message);
      }
    }
  }
}

function convertToMessengerFormat(msg) {
  switch (msg.type) {
    case 'text':
      return {
        text: msg.text,
        quick_replies: msg.quickReplies?.map(qr => ({
          content_type: 'text',
          title: qr.label,
          payload: qr.payload || qr.text,
        })),
      };
    case 'image':
      return { attachment: { type: 'image', payload: { url: msg.imageUrl } } };
    case 'video':
      return { attachment: { type: 'video', payload: { url: msg.videoUrl } } };
    case 'buttons':
      return {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: msg.text,
            buttons: (msg.template?.buttons || []).map(b => ({
              type: b.url ? 'web_url' : 'postback',
              title: b.label,
              url: b.url,
              payload: b.payload,
            }))
          }
        }
      };
    case 'carousel':
      return {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: (msg.template?.columns || []).map(col => ({
              title: col.title,
              subtitle: col.text,
              image_url: col.imageUrl,
              buttons: (col.buttons || []).map(b => ({
                type: b.url ? 'web_url' : 'postback',
                title: b.label,
                url: b.url,
                payload: b.payload,
              }))
            }))
          }
        }
      };
    default:
      return { text: msg.text || '' };
  }
}

// ============================================================
// services/broadcastService.js
// ============================================================
const { Broadcast, Contact } = require('../models');

async function sendBroadcastNow(broadcast, contacts, channelArg) {
  // 優先使用明確傳入的 channel，其次才從 broadcast 取（可能已 depopulate）
  let channel = channelArg || broadcast.channel;
  if (!channel?.platform) {
    const { Channel } = require('../models');
    const channelId = channel?._id || channel;
    channel = await Channel.findById(channelId);
    if (!channel) {
      console.error('[廣播] 找不到頻道，廣播中止');
      return;
    }
  }

  let sent = 0;
  let failed = 0;

  console.log(`[廣播] 開始發送 "${broadcast.name}"，頻道: ${channel.name}（${channel.platform}），受眾: ${contacts.length} 人`);

  const lineIds = contacts.filter(c => c.platform === 'line').map(c => c.platformId);
  const messengerIds = contacts.filter(c => c.platform === 'messenger').map(c => c.platformId);
  const instagramIds = contacts.filter(c => c.platform === 'instagram').map(c => c.platformId);

  console.log(`[廣播] LINE 用戶: ${lineIds.length}，Messenger 用戶: ${messengerIds.length}，Instagram 用戶: ${instagramIds.length}`);

  // 將廣播訊息轉為 conversationHistory 格式
  const broadcastHistoryEntries = broadcast.messages.map(msg => ({
    role: 'bot',
    content: msg.text || `[${msg.type}]`,
    messageType: msg.type === 'text' ? 'text' : (msg.imageUrl ? 'image' : msg.type),
    timestamp: new Date(),
  }));

  const saveBroadcastHistory = async (platformIds) => {
    if (!platformIds.length) return;
    try {
      await Contact.updateMany(
        { channel: channel._id, platformId: { $in: platformIds } },
        { $push: { conversationHistory: { $each: broadcastHistoryEntries, $slice: -100 } } }
      );
    } catch (e) {
      console.error('[廣播] 寫入對話紀錄失敗:', e.message);
    }
  };

  if (lineIds.length > 0 && channel.platform === 'line') {
    try {
      await sendLineMulticast(channel, lineIds, broadcast.messages);
      sent += lineIds.length;
      console.log(`[廣播] LINE multicast 成功，送出: ${lineIds.length}`);
      await saveBroadcastHistory(lineIds);
    } catch (e) {
      console.error('[廣播] LINE multicast 失敗:', e.response?.data || e.message);
      // multicast 失敗時改用逐一 push
      console.log('[廣播] 改用逐一 push...');
      const successIds = [];
      for (const userId of lineIds) {
        try {
          for (const msg of broadcast.messages) {
            await sendLineMessage(channel, userId, msg);
          }
          sent++;
          successIds.push(userId);
        } catch (e2) {
          console.error(`[廣播] push 失敗 (${userId}):`, e2.response?.data || e2.message);
          failed++;
        }
      }
      await saveBroadcastHistory(successIds);
    }
  }

  if (messengerIds.length > 0 && channel.platform === 'messenger') {
    const successIds = [];
    for (const id of messengerIds) {
      try {
        for (const msg of broadcast.messages) {
          await sendMessengerMessage(channel, id, msg);
        }
        sent++;
        successIds.push(id);
      } catch (e) {
        failed++;
      }
    }
    await saveBroadcastHistory(successIds);
  }

  if (instagramIds.length > 0 && channel.platform === 'instagram') {
    const successIds = [];
    for (const id of instagramIds) {
      try {
        for (const msg of broadcast.messages) {
          await sendMessengerMessage(channel, id, msg);
        }
        sent++;
        successIds.push(id);
      } catch (e) {
        console.error(`[廣播] Instagram 發送失敗 (${id}):`, e.response?.data || e.message);
        failed++;
      }
    }
    await saveBroadcastHistory(successIds);
  }

  console.log(`[廣播] 更新 stats — sent:${sent} failed:${failed} total:${contacts.length} id:${broadcast._id}`);
  try {
    const updated = await Broadcast.findByIdAndUpdate(
      broadcast._id,
      { $set: {
        status: 'sent',
        sentAt: new Date(),
        'stats.sent': sent,
        'stats.delivered': sent,   // LINE/Messenger API 接受即視為送達
        'stats.failed': failed,
        'stats.total': contacts.length,
      }},
      { new: true }
    );
    console.log('[廣播] DB 更新結果:', updated?.stats);
  } catch (e) {
    console.error('[廣播] DB 更新失敗:', e.message);
  }
}

async function addBroadcastJob(broadcastId, scheduledAt) {
  // Uses node-cron for simple scheduling (in production use Bull queue with Redis)
  const cron = require('node-cron');
  const delay = scheduledAt.getTime() - Date.now();
  if (delay > 0) {
    setTimeout(async () => {
      try {
        const broadcast = await Broadcast.findById(broadcastId).populate('channel');
        if (!broadcast || broadcast.status !== 'scheduled') return;
        // Re-resolve audience at send time
        const contacts = await Contact.find({ channel: broadcast.channel._id, isFollowing: true })
          .select('_id platformId platform');
        broadcast.status = 'sending';
        await broadcast.save();
        await sendBroadcastNow(broadcast, contacts);
      } catch (e) {
        console.error('Scheduled broadcast error:', e);
        await Broadcast.findByIdAndUpdate(broadcastId, { status: 'failed' });
      }
    }, delay);
  }
}

// ============================================================
// services/schedulerService.js
// ============================================================
async function startScheduler() {
  console.log('⏰ Scheduler started');
  try {
    const { Broadcast } = require('../models');
    const pending = await Broadcast.find({ status: 'scheduled', scheduledAt: { $gt: new Date() } });
    for (const b of pending) {
      await addBroadcastJob(b._id.toString(), b.scheduledAt);
    }
    console.log(`⏰ Re-queued ${pending.length} scheduled broadcasts`);
  } catch (e) {
    console.error('Scheduler error:', e);
  }

  // 每分鐘檢查等待回覆逾時的聯絡人並發送提醒
  setInterval(checkInputTimeouts, 60 * 1000);
}

async function checkInputTimeouts() {
  const { Contact, Flow } = require('../models');
  const { sendLineMessage } = require('./lineService');
  const { sendMessengerMessage } = require('./messengerService');
  const { processMessage } = require('./flowEngine');

  try {
    const now = new Date();

    // ── 第一輪：發送提醒 ──
    const pendingReminder = await Contact.find({
      'currentFlowState.waitingForInput': true,
      'currentFlowState.inputTimeoutAt': { $lte: now },
      'currentFlowState.reminderSent': { $ne: true },
    }).populate('channel');

    for (const contact of pendingReminder) {
      try {
        const flow = await Flow.findById(contact.currentFlowState.flowId);
        if (!flow) continue;
        const node = flow.nodes.find(n => n.id === contact.currentFlowState.nodeId);
        const t = node?.data?.inputTimeout;
        if (!t) continue;

        const afterReminderAction = t.afterReminderAction || 'wait';

        // 沒有提醒訊息且後續動作為「持續等待」→ 什麼都不做，跳過
        if (!t.reminderText && afterReminderAction === 'wait') continue;

        // 有設定提醒訊息才發送
        if (t.reminderText) {
          const channel = contact.channel;
          const msg = { type: 'text', text: t.reminderText };
          if (channel.platform === 'line') {
            await sendLineMessage(channel, contact.platformId, msg);
          } else if (channel.platform === 'messenger' || channel.platform === 'instagram') {
            await sendMessengerMessage(channel, contact.platformId, msg);
          }
        }

        const updateOps = {
          'currentFlowState.reminderSent': true,
          'currentFlowState.afterReminderAction': afterReminderAction,
        };
        if (afterReminderAction !== 'wait') {
          // 與第一次相同的等待時間後，執行後續動作
          const ms = (t.unit === 'hours' ? t.value * 3600 : t.value * 60) * 1000;
          updateOps['currentFlowState.skipTimeoutAt'] = new Date(Date.now() + ms);
        }

        await Contact.updateOne({ _id: contact._id }, { $set: updateOps });
        console.log(`[Scheduler] 已處理逾時提醒 ${contact.displayName || contact.platformId}，後續動作：${afterReminderAction}`);
      } catch (e) {
        console.error(`[Scheduler] 提醒失敗 contact ${contact._id}:`, e.message);
      }
    }

    // ── 第二輪：處理提醒後仍未回覆的聯絡人 ──
    const pendingAction = await Contact.find({
      'currentFlowState.waitingForInput': true,
      'currentFlowState.reminderSent': true,
      'currentFlowState.skipTimeoutAt': { $lte: now },
      'currentFlowState.afterReminderAction': { $in: ['end', 'skip'] },
    }).populate('channel');

    for (const contact of pendingAction) {
      try {
        const action = contact.currentFlowState.afterReminderAction;
        if (action === 'end') {
          await Contact.updateOne({ _id: contact._id }, { $set: { currentFlowState: null } });
          console.log(`[Scheduler] 已自動結束流程 contact ${contact.displayName || contact.platformId}`);
        } else if (action === 'skip') {
          const flow = await Flow.findById(contact.currentFlowState.flowId);
          if (!flow) {
            await Contact.updateOne({ _id: contact._id }, { $set: { currentFlowState: null } });
            continue;
          }
          // 以空字串繼續，變數欄位留空，流程從 input 的下一個節點繼續
          await processMessage({ contact, flow, channel: contact.channel, text: '', isResuming: true });
          console.log(`[Scheduler] 已自動跳過等待回覆 contact ${contact.displayName || contact.platformId}`);
        }
      } catch (e) {
        console.error(`[Scheduler] 後續動作失敗 contact ${contact._id}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[Scheduler] checkInputTimeouts error:', e);
  }
}

// ============================================================
// services/socketService.js
// ============================================================
let _io = null;

function setupSocketHandlers(io) {
  _io = io;
  io.on('connection', (socket) => {
    socket.on('join:channel', (channelId) => {
      socket.join(`channel:${channelId}`);
    });
    socket.on('leave:channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });
    socket.on('disconnect', () => {});
  });
}

function emitContactMessage(channelId, contactId, message) {
  if (_io) {
    _io.to(`channel:${channelId}`).emit('contact:message', { contactId: String(contactId), message });
  }
}

function emitContactUpdate(channelId, contactId, patch) {
  if (_io) {
    _io.to(`channel:${channelId}`).emit('contact:update', { contactId: String(contactId), patch });
  }
}

function emitContactNew(channelId, contact) {
  if (_io) {
    _io.to(`channel:${channelId}`).emit('contact:new', { contact });
  }
}

// ============================================================
// Helper
// ============================================================
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

module.exports = {
  sendLineMessage, sendLineMulticast,
  sendMessengerMessage, sendMessengerBroadcast,
  sendBroadcastNow, addBroadcastJob,
  startScheduler,
  setupSocketHandlers,
  emitContactMessage,
  emitContactUpdate,
  emitContactNew,
};
