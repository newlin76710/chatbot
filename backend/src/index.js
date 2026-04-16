require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const flowRoutes = require('./routes/flows');
const broadcastRoutes = require('./routes/broadcasts');
const segmentRoutes = require('./routes/segments');
const contactRoutes = require('./routes/contacts');
const channelRoutes = require('./routes/channels');
const webhookRoutes = require('./routes/webhooks');
const analyticsRoutes = require('./routes/analytics');
const campaignRoutes = require('./routes/campaigns');
const uploadRoutes = require('./routes/upload');

const { setupSocketHandlers } = require('./services/socketService');
const { startScheduler } = require('./services/schedulerService');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:2202', credentials: true }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:2202', credentials: true }));
app.use(morgan('combined'));
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Trust proxy (needed in Docker / behind reverse proxy)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// Make io accessible
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/upload', uploadRoutes);
// 提供上傳檔案的靜態存取（LINE/Messenger 需要公開 HTTPS URL）
app.use('/uploads', require('express').static('/app/uploads'));
app.use('/webhook', webhookRoutes);

// 導流短連結 /c/:code — 記錄點擊後跳轉 LINE
app.get('/c/:code', async (req, res) => {
  try {
    const { Campaign } = require('./models');
    const campaign = await Campaign.findOneAndUpdate(
      { code: req.params.code },
      { $inc: { 'stats.clicks': 1 } },
      { new: true }
    );
    if (!campaign) return res.status(404).send('連結不存在或已失效');

    let target = 'https://line.me/';
    if (campaign.platform === 'messenger') {
      const pageId = campaign.messengerPageId;
      if (pageId) {
        const ref = campaign.keyword ? `?ref=${encodeURIComponent(campaign.keyword)}` : '';
        target = `https://m.me/${pageId}${ref}`;
      }
    } else {
      const lineId = (campaign.lineId || '').replace(/^@/, '');
      const kw = campaign.keyword ? encodeURIComponent(campaign.keyword) : '';
      if (lineId && kw) target = `https://line.me/R/ti/p/@${lineId}?oaMessageText=${kw}`;
      else if (lineId) target = `https://line.me/R/ti/p/@${lineId}`;
    }
    res.redirect(302, target);
  } catch (err) {
    console.error('[導流] redirect error:', err);
    res.status(500).send('伺服器錯誤');
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use(errorHandler);

// Setup socket
setupSocketHandlers(io);

// Connect DB & start
const PORT = process.env.PORT || 4000;
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot-platform')
  .then(() => {
    console.log('✅ MongoDB connected');
    startScheduler();
    httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => { console.error('❌ DB connection failed:', err); process.exit(1); });

module.exports = { app, io };
