# BotFlow — BotBonnie-like Chatbot Platform

A full-stack chatbot management platform with visual flow builder, multi-channel messaging, audience segmentation, and broadcast capabilities.

## Features

| Feature | Description |
|---|---|
| **Flow Builder** | Visual drag-and-drop conversation flow designer (ReactFlow) |
| **Multi-Platform** | LINE Messaging API + Facebook Messenger webhook handling |
| **Audience Segments** | Dynamic (rule-based) & static contact groups |
| **Broadcast** | Schedule or send-now messages to any audience |
| **Contacts & Tags** | Full contact management with tagging |
| **Analytics** | Subscriber growth, flow stats, tag distribution |
| **Real-time** | Socket.io for live dashboard updates |

---

## Tech Stack

**Backend**: Node.js · Express · MongoDB (Mongoose) · Redis · Socket.io · Bull  
**Frontend**: React 18 · ReactFlow · Zustand · Recharts · React Router v6

---

## Quick Start (Docker)

```bash
# 1. Clone and enter the project
cd chatbot-platform

# 2. Copy env and fill in your LINE / Messenger credentials
cp backend/.env.example backend/.env

# 3. Start everything
docker-compose up --build

# Frontend → http://localhost:3000
# Backend  → http://localhost:4000
```

---

## Manual Setup

### Prerequisites
- Node.js 18+
- MongoDB 6+
- Redis 6+ (optional, for scheduled broadcasts)

### Backend

```bash
cd backend
npm install
cp .env.example .env        # Edit with your credentials
npm run dev                 # Starts on port 4000
```

### Frontend

```bash
cd frontend
npm install
npm start                   # Starts on port 3000
```

---

## Project Structure

```
chatbot-platform/
├── backend/
│   ├── src/
│   │   ├── index.js               # Express + Socket.io server
│   │   ├── models/
│   │   │   └── index.js           # User, Channel, Contact, Flow, Segment, Broadcast
│   │   ├── routes/
│   │   │   ├── auth.js            # Login / Register / Me
│   │   │   ├── flows.js           # Flow CRUD + toggle + duplicate
│   │   │   ├── broadcasts.js      # Broadcast CRUD + send + schedule
│   │   │   ├── segments.js        # Segment CRUD + contact listing
│   │   │   ├── contacts.js        # Contact list + tag management
│   │   │   ├── channels.js        # Channel CRUD
│   │   │   ├── analytics.js       # Dashboard stats
│   │   │   └── webhooks.js        # LINE + Messenger webhook handlers
│   │   ├── services/
│   │   │   ├── flowEngine.js      # Core flow execution engine
│   │   │   └── index.js           # LINE, Messenger, broadcast, socket, scheduler
│   │   └── middleware/
│   │       ├── auth.js            # JWT middleware
│   │       └── errorHandler.js
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── index.jsx
    │   ├── utils/api.js           # Axios instance with auth
    │   ├── store/
    │   │   ├── authStore.js       # Zustand auth state
    │   │   └── channelStore.js    # Active channel state
    │   ├── components/
    │   │   ├── Layout.jsx         # Sidebar + routing shell
    │   │   └── FlowBuilder/
    │   │       ├── CustomNodes.jsx    # ReactFlow node components
    │   │       ├── FlowSidebar.jsx    # Draggable node palette
    │   │       └── NodeConfigPanel.jsx # Right-panel node editor
    │   └── pages/
    │       ├── AuthPages.jsx      # Login + Register
    │       ├── DashboardPage.jsx  # Analytics overview
    │       ├── FlowBuilderPage.jsx # Visual flow editor
    │       ├── BroadcastPage.jsx  # Broadcast management
    │       ├── SegmentsPage.jsx   # Segment builder
    │       └── ContactsChannelsPages.jsx
    ├── Dockerfile
    └── package.json
```

---

## LINE Webhook Setup

1. Go to [LINE Developers Console](https://developers.line.biz)
2. Create a Messaging API channel
3. Set webhook URL to: `https://your-domain.com/webhook/line/{channelId}`
4. Enable webhooks, disable auto-reply
5. Copy **Channel Access Token** and **Channel Secret** into Channel settings

## Facebook Messenger Setup

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a Facebook App → Add Messenger product
3. Set webhook URL: `https://your-domain.com/webhook/messenger/{channelId}`
4. Use the **Verify Token** shown in Channel settings
5. Subscribe to `messages` and `messaging_postbacks` events

---

## Flow Node Types

| Node | Description |
|---|---|
| **Trigger** | Entry point — keyword match, follow/unfollow, postback, referral |
| **Message** | Send text, image, video, buttons, carousel |
| **Condition** | Branch on tags, custom fields, or variables (true/false paths) |
| **Action** | Add/remove tag, set custom field, trigger another flow, call webhook |
| **Input** | Wait for user reply, save to variable |
| **Delay** | Wait before proceeding (seconds to days) |
| **End** | Mark flow as complete |

### Template Variables in Messages

```
{{contact.name}}        → Contact display name
{{contact.platform}}   → line / messenger
{{var.fieldName}}      → Variable set by Input node
{{customField.name}}   → Custom field value
```

---

## API Reference

### Auth
```
POST /api/auth/register   { name, email, password }
POST /api/auth/login      { email, password }
GET  /api/auth/me
```

### Flows
```
GET    /api/flows?channelId=
POST   /api/flows
PUT    /api/flows/:id
DELETE /api/flows/:id
PATCH  /api/flows/:id/toggle
POST   /api/flows/:id/duplicate
```

### Broadcasts
```
GET  /api/broadcasts?channelId=&status=
POST /api/broadcasts
PUT  /api/broadcasts/:id
POST /api/broadcasts/:id/send
POST /api/broadcasts/:id/cancel
```

### Segments
```
GET  /api/segments?channelId=
POST /api/segments
PUT  /api/segments/:id
GET  /api/segments/:id/contacts
```

### Contacts
```
GET   /api/contacts?channelId=&tag=&search=&page=&limit=
PATCH /api/contacts/:id/tags    { add: [], remove: [] }
GET   /api/contacts/tags/list?channelId=
```

### Webhooks
```
POST /webhook/line/:channelId
GET  /webhook/messenger/:channelId   (verification)
POST /webhook/messenger/:channelId
```

---

## Environment Variables

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/chatbot-platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000

# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

# Facebook Messenger
FB_PAGE_ACCESS_TOKEN=
FB_APP_SECRET=
FB_VERIFY_TOKEN=
```

---

## Roadmap / Extensions

- [ ] Instagram DM support
- [ ] Telegram bot support
- [ ] A/B test broadcasts
- [ ] Rich Flow analytics per node
- [ ] Team collaboration / multi-user
- [ ] Custom chatbot domain (white label)
- [ ] LIFF (LINE Frontend Framework) integration
- [ ] OpenAI GPT fallback node
