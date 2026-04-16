// ============================================================
// models/User.js
// ============================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'editor' },
  channels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Channel' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);

// ============================================================
// models/Channel.js
// ============================================================
const channelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  platform: { type: String, enum: ['line', 'messenger', 'instagram', 'telegram'], required: true },
  credentials: {
    accessToken: String,
    channelSecret: String,
    pageId: String,
    verifyToken: String,
  },
  ownedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  webhookUrl: String,
  profilePicture: String,
}, { timestamps: true });

const Channel = mongoose.model('Channel', channelSchema);

// ============================================================
// models/Contact.js
// ============================================================
const contactSchema = new mongoose.Schema({
  platformId: { type: String, required: true },
  platform: { type: String, enum: ['line', 'messenger', 'instagram', 'telegram'], required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  displayName: String,
  pictureUrl: String,
  language: String,
  tags: [{ type: String }],
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed },
  segments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Segment' }],
  isBlocked: { type: Boolean, default: false },
  isFollowing: { type: Boolean, default: true },
  lastInteractedAt: Date,
  conversationHistory: [{
    role: { type: String, enum: ['user', 'bot'] },
    content: String,
    timestamp: { type: Date, default: Date.now },
    messageType: { type: String, default: 'text' },
  }],
  currentFlowState: {
    flowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flow' },
    nodeId: String,
    waitingForInput: Boolean,
    inputField: String,
    variables: { type: Map, of: mongoose.Schema.Types.Mixed },
  },
}, { timestamps: true });

contactSchema.index({ platformId: 1, platform: 1, channel: 1 }, { unique: true });
contactSchema.index({ tags: 1 });

const Contact = mongoose.model('Contact', contactSchema);

// ============================================================
// models/Flow.js
// ============================================================
const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['trigger', 'message', 'condition', 'action', 'input', 'delay', 'jump', 'end'],
    required: true
  },
  position: { x: Number, y: Number },
  data: {
    label: String,
    // For message nodes
    messages: [{
      type: { type: String, enum: ['text', 'image', 'video', 'audio', 'file', 'sticker', 'flex', 'carousel', 'buttons', 'quickReply'] },
      text: String,
      imageUrl: String,
      videoUrl: String,
      fileUrl: String,
      stickerId: String,
      altText: String,
      // Flex / Carousel / Buttons
      template: mongoose.Schema.Types.Mixed,
      quickReplies: [{
        label: String,
        text: String,
        action: String,
        payload: String,
      }],
    }],
    // For condition nodes
    conditions: [{
      field: String,       // e.g. "tags", "customField.name", "lastMessage"
      operator: String,    // "contains", "equals", "notEquals", "exists"
      value: mongoose.Schema.Types.Mixed,
    }],
    conditionMode: { type: String, enum: ['and', 'or'], default: 'and' },
    // For action nodes
    actions: [{
      type: { type: String, enum: ['addTag', 'removeTag', 'setField', 'assignSegment', 'removeSegment', 'unsubscribe', 'triggerFlow', 'webhookCall'] },
      tag: String,
      field: String,
      value: mongoose.Schema.Types.Mixed,
      segmentId: String,
      flowId: String,
      webhookUrl: String,
      webhookMethod: String,
      webhookHeaders: mongoose.Schema.Types.Mixed,
      webhookBody: String,
    }],
    // For trigger nodes
    trigger: {
      type: { type: String, enum: ['any', 'keyword', 'follow', 'unfollow', 'postback', 'referral', 'schedule', 'apiTrigger'] },
      keywords: [String],
      matchMode: { type: String, enum: ['exact', 'contains', 'startsWith'], default: 'contains' },
      postbackPayload: String,
      schedule: String, // cron expression
    },
    // For delay node
    delay: { value: Number, unit: { type: String, enum: ['seconds', 'minutes', 'hours', 'days'] } },
    // For input node
    inputField: String,
    inputType: { type: String, enum: ['text', 'number', 'email', 'phone', 'date'] },
    inputValidation: String,
    // For jump node
    jumpToNodeId: String,
  }
}, { _id: false });

const edgeSchema = new mongoose.Schema({
  id: String,
  source: String,
  target: String,
  sourceHandle: String,
  label: String,
}, { _id: false });

const flowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  ownedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nodes: [nodeSchema],
  edges: [edgeSchema],
  isActive: { type: Boolean, default: false },
  stats: {
    triggered: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    dropped: { type: Number, default: 0 },
  },
  version: { type: Number, default: 1 },
}, { timestamps: true });

const Flow = mongoose.model('Flow', flowSchema);

// ============================================================
// models/Segment.js
// ============================================================
const segmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  ownedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['static', 'dynamic'], default: 'dynamic' },
  // Dynamic segment rules
  rules: [{
    field: String,
    operator: String,
    value: mongoose.Schema.Types.Mixed,
  }],
  rulesMode: { type: String, enum: ['and', 'or'], default: 'and' },
  // Static segment: manually added contacts
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
  memberCount: { type: Number, default: 0 },
  color: { type: String, default: '#4F46E5' },
}, { timestamps: true });

const Segment = mongoose.model('Segment', segmentSchema);

// ============================================================
// models/Broadcast.js
// ============================================================
const broadcastSchema = new mongoose.Schema({
  name: { type: String, required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  ownedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'], default: 'draft' },
  audience: {
    type: { type: String, enum: ['all', 'segments', 'tags', 'contacts'], default: 'all' },
    segments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Segment' }],
    tags: [String],
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
  },
  messages: [{
    type: { type: String, enum: ['text', 'image', 'video', 'flex', 'buttons', 'carousel'] },
    text: String,
    imageUrl: String,
    videoUrl: String,
    template: mongoose.Schema.Types.Mixed,
    quickReplies: mongoose.Schema.Types.Mixed,
  }],
  scheduledAt: Date,
  sentAt: Date,
  stats: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
  },
}, { timestamps: true });

const Broadcast = mongoose.model('Broadcast', broadcastSchema);

// ============================================================
// models/Campaign.js  (導流工具)
// ============================================================
const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  ownedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['line', 'messenger'], default: 'line' },
  code: { type: String, required: true, unique: true },   // 短碼，用於 /c/:code
  keyword: String,   // 點擊後自動發送的關鍵字（LINE & Messenger ref_param）
  lineId: String,    // LINE Bot 的 @ID（例如 @abc1234）
  messengerPageId: String, // FB 粉專 ID（用於 m.me 連結）
  stats: {
    clicks: { type: Number, default: 0 },
    joins:  { type: Number, default: 0 },
  },
}, { timestamps: true });

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = { User, Channel, Contact, Flow, Segment, Broadcast, Campaign };
