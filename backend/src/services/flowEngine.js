/**
 * Flow Engine
 * Traverses a Flow graph from trigger → end, executing each node in order.
 * Supports: message, condition, action, input (wait), delay, jump, end
 */

const { Contact, Flow } = require('../models');
const { sendLineMessage } = require('./lineService');
const { sendMessengerMessage } = require('./messengerService');

// Entry point
async function processMessage({ contact, flow, channel, text, postbackPayload, isResuming = false }) {
  try {
    let startNodeId;

    if (isResuming && contact.currentFlowState?.waitingForInput) {
      // 儲存使用者輸入的值
      const inputNodeId = contact.currentFlowState.nodeId;
      if (contact.currentFlowState.inputField && text) {
        contact.currentFlowState.variables = contact.currentFlowState.variables || new Map();
        contact.currentFlowState.variables.set(contact.currentFlowState.inputField, text);
        // 永久儲存到 customFields，讓聯絡人資料保留每筆收集的欄位
        if (!contact.customFields) contact.customFields = new Map();
        contact.customFields.set(contact.currentFlowState.inputField, text);
        contact.markModified('customFields');
      }
      contact.currentFlowState.waitingForInput = false;

      // 跳過 input 節點，直接從下一個節點繼續
      const nextEdge = flow.edges.find(e =>
        e.source === inputNodeId && (!e.sourceHandle || e.sourceHandle === 'output')
      );
      if (!nextEdge) return; // 沒有下一節點，結束流程
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

    const context = {
      contact,
      flow,
      channel,
      text,
      postbackPayload,
      variables: contact.currentFlowState?.variables || new Map(),
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

  // Move to next node via edge（sourceHandle 為 null/undefined/'output' 均視為預設出口）
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
    } else if (channel.platform === 'messenger') {
      await sendMessengerMessage(channel, contact.platformId, rendered);
    }
    // Small delay between messages
    if (messages.length > 1) await sleep(500);
  }

  // Track in conversation history
  contact.conversationHistory.push({
    role: 'bot',
    content: messages.map(m => m.text || '[media]').join(' | '),
    messageType: messages[0]?.type || 'text',
  });
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

  // true → sourceHandle 'true', false → 'false'
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
    actual = contact.customFields?.get(field.split('.')[1]);
  } else if (field.startsWith('var.')) {
    actual = context.variables?.get(field.split('.')[1]);
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
      case 'setField':
        if (!contact.customFields) contact.customFields = new Map();
        contact.customFields.set(action.field, resolveValue(action.value, context));
        break;
      case 'unsubscribe':
        contact.isFollowing = false;
        break;
      case 'triggerFlow':
        if (action.flowId) {
          const { Flow } = require('../models');
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
}

async function executeInputNode(node, context) {
  const { contact } = context;
  // Send prompt message if any
  if (node.data.messages?.length) {
    await executeMessageNode(node, context);
  }
  // Wait for user input
  contact.currentFlowState.waitingForInput = true;
  contact.currentFlowState.inputField = node.data.inputField;
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
  // For short delays, we can wait inline (up to 5s)
  if (ms <= 5000) await sleep(ms);
  // Longer delays should be handled by a job queue (not implemented here for brevity)
}

// Template helpers
function renderTemplate(msg, context) {
  // Convert Mongoose Document to plain object to ensure all fields (including quickReplies) are preserved
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
    .replace(/\{\{var\.(\w+)\}\}/g, (_, k) => {
      // 先查 flow 執行期間的暫時變數，若無則 fallback 到永久儲存的 customFields
      const fromVars = context.variables?.get(k);
      const fromCustom = context.contact.customFields?.get(k);
      return fromVars ?? fromCustom ?? '';
    })
    .replace(/\{\{customField\.(\w+)\}\}/g, (_, k) => context.contact.customFields?.get(k) ?? '');
}

function resolveValue(value, context) {
  if (typeof value === 'string') return renderTemplateString(value, context);
  return value;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { processMessage };
