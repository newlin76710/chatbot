// ============================================================
// services/lineService.js
// ============================================================
const axios = require('axios');

const LINE_API = 'https://api.line.me/v2/bot';

async function sendLineMessage(channel, userId, message) {
  const messages = convertToLineFormat([message]);
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
  const lineMessages = convertToLineFormat(messages);
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

  console.log(`[廣播] LINE 用戶: ${lineIds.length}，Messenger 用戶: ${messengerIds.length}`);

  if (lineIds.length > 0 && channel.platform === 'line') {
    try {
      await sendLineMulticast(channel, lineIds, broadcast.messages);
      sent += lineIds.length;
      console.log(`[廣播] LINE multicast 成功，送出: ${lineIds.length}`);
    } catch (e) {
      console.error('[廣播] LINE multicast 失敗:', e.response?.data || e.message);
      // multicast 失敗時改用逐一 push
      console.log('[廣播] 改用逐一 push...');
      for (const userId of lineIds) {
        try {
          for (const msg of broadcast.messages) {
            await sendLineMessage(channel, userId, msg);
          }
          sent++;
        } catch (e2) {
          console.error(`[廣播] push 失敗 (${userId}):`, e2.response?.data || e2.message);
          failed++;
        }
      }
    }
  }

  if (messengerIds.length > 0 && channel.platform === 'messenger') {
    for (const id of messengerIds) {
      try {
        for (const msg of broadcast.messages) {
          await sendMessengerMessage(channel, id, msg);
        }
        sent++;
      } catch (e) {
        failed++;
      }
    }
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
  // On startup, reschedule any pending broadcasts
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
}

// ============================================================
// services/socketService.js
// ============================================================
function setupSocketHandlers(io) {
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
};
