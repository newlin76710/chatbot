/**
 * Flow Engine
 * Traverses a Flow graph from trigger → end, executing each node in order.
 * Supports: message, condition, action, input (wait), delay, jump, end
 */

const { Contact, Flow } = require('../models');
const { sendLineMessage } = require('./lineService');
const { sendMessengerMessage } = require('./messengerService');
const { emitContactMessage, emitContactUpdate } = require('./index');

// Entry point
async function processMessage({ contact, flow, channel, text, postbackPayload, isResuming = false }) {
  try {
    let startNodeId;

    if (isResuming && contact.currentFlowState?.waitingForInput) {
      const inputNodeId = contact.currentFlowState.nodeId;
      const field = contact.currentFlowState.inputField;

      if (field && text) {
        // 直接寫入 MongoDB，確保資料不依賴 Mongoose Map change-tracking
        await Contact.updateOne(
          { _id: contact._id },
          { $set: { [`customFields.${field}`]: text } }
        );
        console.log(`[FlowEngine] 已寫入 customFields.${field} = "${text}" for contact ${contact._id}`);
        // 同步更新記憶體中的值，供本次執行後續節點使用
        if (!contact.customFields) contact.customFields = new Map();
        contact.customFields.set(field, text);
        // 即時推送自訂欄位變更到前端
        const cfPlain = {};
        contact.customFields.forEach((v, k) => { cfPlain[k] = v; });
        emitContactUpdate(channel._id, contact._id, { customFields: cfPlain });
      } else if (!field) {
        console.warn(`[FlowEngine] ⚠️ input 節點缺少 inputField 設定，回覆未儲存！nodeId: ${inputNodeId}`);
      }
      contact.currentFlowState.waitingForInput = false;

      const nextEdge = flow.edges.find(e =>
        e.source === inputNodeId && (!e.sourceHandle || e.sourceHandle === 'output')
      );
      if (!nextEdge) return;
      startNodeId = nextEdge.target;
    } else {
      // Start from trigger's first connected node
      const triggerNode = flow.nodes.find(n => n.type === 'trigger');
      if (!triggerNode) return;
      const firstEdge = flow.edges.find(e => e.source === triggerNode.id);
      if (!firstEdge) return;
      startNodeId = firstEdge.target;

      // Reset flow state
      contact.currentFlowState = {
        flowId: flow._id,
        nodeId: startNodeId,
        waitingForInput: false,
        variables: new Map(),
      };
    }

    // Update stats
    await Flow.updateOne({ _id: flow._id }, { $inc: { 'stats.triggered': 1 } });

    // 從 customFields（Mongoose Map）建立純 JS 物件，讓模板替換不依賴 .get()
    const customFieldsPlain = {};
    if (contact.customFields) {
      contact.customFields.forEach((v, k) => { customFieldsPlain[k] = v; });
    }
    console.log(`[FlowEngine] customFieldsPlain 內容:`, JSON.stringify(customFieldsPlain));

    const context = {
      contact,
      flow,
      channel,
      text,
      postbackPayload,
      customFieldsPlain,
    };

    await executeNode(startNodeId, context);
    await contact.save();
  } catch (err) {
    console.error('[FlowEngine] Error:', err);
  }
}

async function executeNode(nodeId, context, depth = 0) {
  if (depth > 100) {
    console.error('[FlowEngine] Max depth reached, possible loop');
    return;
  }

  const { flow, contact } = context;
  const node = flow.nodes.find(n => n.id === nodeId);
  if (!node) return;

  contact.currentFlowState.nodeId = nodeId;

  switch (node.type) {
    case 'message':
      await executeMessageNode(node, context);
      break;
    case 'condition':
      return await executeConditionNode(node, context, depth);
    case 'action':
      await executeActionNode(node, context);
      break;
    case 'input':
      await executeInputNode(node, context);
      return; // Stop execution, wait for next message
    case 'delay':
      await executeDelayNode(node, context);
      break;
    case 'jump':
      if (node.data.jumpToNodeId) {
        return await executeNode(node.data.jumpToNodeId, context, depth + 1);
      }
      return;
    case 'end':
      await Flow.updateOne({ _id: flow._id }, { $inc: { 'stats.completed': 1 } });
      contact.currentFlowState = null;
      return;
    default:
      break;
  }

  // Move to next node via edge
  const nextEdge = flow.edges.find(e =>
    e.source === nodeId && (!e.sourceHandle || e.sourceHandle === 'output')
  );
  if (nextEdge) {
    await executeNode(nextEdge.target, context, depth + 1);
  }
}

async function executeMessageNode(node, context) {
  const { channel, contact } = context;
  const { messages } = node.data;
  if (!messages?.length) return;

  for (const msg of messages) {
    const rendered = renderTemplate(msg, context);
    if (channel.platform === 'line') {
      await sendLineMessage(channel, contact.platformId, rendered);
    } else if (channel.platform === 'messenger' || channel.platform === 'instagram') {
      await sendMessengerMessage(channel, contact.platformId, rendered);
    }
    if (messages.length > 1) await sleep(500);

    const content = rendered.text || rendered.imageUrl || rendered.videoUrl || '[media]';
    const botMsg = {
      role: 'bot',
      content,
      messageType: rendered.type || 'text',
      timestamp: new Date(),
    };
    contact.conversationHistory.push(botMsg);
    emitContactMessage(channel._id, contact._id, botMsg);
  }
  if (contact.conversationHistory.length > 100) {
    contact.conversationHistory = contact.conversationHistory.slice(-50);
  }
}

async function executeConditionNode(node, context, depth) {
  const { conditions, conditionMode } = node.data;
  const { contact, flow } = context;

  let result;
  if (conditionMode === 'or') {
    result = conditions.some(c => evaluateCondition(c, contact, context));
  } else {
    result = conditions.every(c => evaluateCondition(c, contact, context));
  }

  const handle = result ? 'true' : 'false';
  const nextEdge = flow.edges.find(e => e.source === node.id && e.sourceHandle === handle);
  if (nextEdge) {
    await executeNode(nextEdge.target, context, depth + 1);
  }
}

function evaluateCondition(condition, contact, context) {
  const { field, operator, value } = condition;
  let actual;

  if (field === 'tags') actual = contact.tags;
  else if (field.startsWith('customField.')) {
    actual = context.customFieldsPlain?.[field.split('.')[1]];
  } else if (field.startsWith('var.')) {
    actual = context.customFieldsPlain?.[field.split('.')[1]];
  } else {
    actual = contact[field];
  }

  switch (operator) {
    case 'equals': return actual == value;
    case 'notEquals': return actual != value;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(value);
      return String(actual || '').includes(value);
    case 'notContains':
      if (Array.isArray(actual)) return !actual.includes(value);
      return !String(actual || '').includes(value);
    case 'exists': return actual !== undefined && actual !== null;
    case 'greaterThan': return Number(actual) > Number(value);
    case 'lessThan': return Number(actual) < Number(value);
    default: return false;
  }
}

async function executeActionNode(node, context) {
  const { actions } = node.data;
  const { contact } = context;
  if (!actions?.length) return;

  for (const action of actions) {
    switch (action.type) {
      case 'addTag':
        if (!contact.tags.includes(action.tag)) contact.tags.push(action.tag);
        break;
      case 'removeTag':
        contact.tags = contact.tags.filter(t => t !== action.tag);
        break;
      case 'setField': {
        const val = resolveValue(action.value, context);
        // 直接寫入 DB
        await Contact.updateOne(
          { _id: contact._id },
          { $set: { [`customFields.${action.field}`]: val } }
        );
        if (!contact.customFields) contact.customFields = new Map();
        contact.customFields.set(action.field, val);
        if (context.customFieldsPlain) context.customFieldsPlain[action.field] = val;
        break;
      }
      case 'unsubscribe':
        contact.isFollowing = false;
        emitContactUpdate(context.channel._id, contact._id, { isFollowing: false });
        break;
      case 'triggerFlow':
        if (action.flowId) {
          const targetFlow = await Flow.findById(action.flowId);
          if (targetFlow) {
            await processMessage({ contact: context.contact, flow: targetFlow, channel: context.channel, text: '' });
          }
        }
        break;
      case 'webhookCall':
        if (action.webhookUrl) {
          try {
            const axios = require('axios');
            const body = action.webhookBody ? JSON.parse(renderTemplateString(action.webhookBody, context)) : {};
            await axios({
              method: action.webhookMethod || 'POST',
              url: action.webhookUrl,
              headers: action.webhookHeaders || {},
              data: body,
            });
          } catch (e) {
            console.error('[FlowEngine] Webhook error:', e.message);
          }
        }
        break;
    }
  }

  // 一次性推送標籤與自訂欄位變更
  const customFieldsPlain = {};
  if (contact.customFields) contact.customFields.forEach((v, k) => { customFieldsPlain[k] = v; });
  emitContactUpdate(context.channel._id, contact._id, {
    tags: contact.tags,
    customFields: customFieldsPlain,
  });
}

async function executeInputNode(node, context) {
  const { contact } = context;
  console.log(`[FlowEngine] input node "${node.id}" → inputField: "${node.data.inputField}" | data keys: ${Object.keys(node.data || {}).join(', ')}`);
  if (node.data.messages?.length) {
    await executeMessageNode(node, context);
  }
  contact.currentFlowState.waitingForInput = true;
  contact.currentFlowState.inputField = node.data.inputField;

  const t = node.data.inputTimeout;
  if (t?.enabled && t?.value) {
    const ms = (t.unit === 'hours' ? t.value * 3600 : t.value * 60) * 1000;
    contact.currentFlowState.inputTimeoutAt = new Date(Date.now() + ms);
    contact.currentFlowState.reminderSent = false;
  } else {
    contact.currentFlowState.inputTimeoutAt = undefined;
    contact.currentFlowState.reminderSent = undefined;
  }

  await contact.save();
}

async function executeDelayNode(node, context) {
  const { delay } = node.data;
  if (!delay) return;
  const ms = {
    seconds: delay.value * 1000,
    minutes: delay.value * 60 * 1000,
    hours: delay.value * 3600 * 1000,
    days: delay.value * 86400 * 1000,
  }[delay.unit] || 0;
  if (ms <= 5000) await sleep(ms);
}

// Template helpers
function renderTemplate(msg, context) {
  // toObject() 確保 quickReplies 等所有欄位都被正確轉換
  const m = msg.toObject ? msg.toObject() : { ...msg };
  if (m.text) {
    return { ...m, text: renderTemplateString(m.text, context) };
  }
  return m;
}

function renderTemplateString(str, context) {
  if (!str) return str;
  return str
    .replace(/\{\{contact\.name\}\}/g, context.contact.displayName || '')
    .replace(/\{\{contact\.platform\}\}/g, context.contact.platform || '')
    .replace(/\{\{var\.(\w+)\}\}/g, (_, k) => String(context.customFieldsPlain?.[k] ?? ''))
    .replace(/\{\{customField\.(\w+)\}\}/g, (_, k) => String(context.customFieldsPlain?.[k] ?? ''));
}

function resolveValue(value, context) {
  if (typeof value === 'string') return renderTemplateString(value, context);
  return value;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { processMessage };
