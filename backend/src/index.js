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

const { setupSocketHandlers } = require('./services/socketService');
const { startScheduler } = require('./services/schedulerService');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('combined'));
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

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
app.use('/webhook', webhookRoutes);

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
