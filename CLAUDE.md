# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BotFlow is a full-stack chatbot management platform with a visual flow builder, multi-channel messaging (LINE, Facebook Messenger), contact management, audience segmentation, and broadcast messaging.

## Development Commands

### Using Docker (recommended)
```bash
docker-compose up --build   # Start all services (MongoDB, Redis, backend, frontend)
docker-compose down         # Stop services
```

### Manual Setup
```bash
# Backend (port 4000)
cd backend && cp .env.example .env   # Configure env vars first
npm install
npm run dev        # Development with nodemon
npm start          # Production

# Frontend (port 3000, proxies /api/* to localhost:4000)
cd frontend
npm install
npm start          # Development server
npm run build      # Production build
```

### Database Migration
```bash
cd backend && npm run migrate
```

## Architecture

### Monorepo Structure
```
chatbot/
├── backend/src/
│   ├── index.js          # Express + Socket.io server entry
│   ├── models/index.js   # All Mongoose schemas
│   ├── routes/           # REST API routes
│   └── services/         # Business logic
├── frontend/src/
│   ├── App.jsx           # React Router setup
│   ├── pages/            # Page components
│   ├── components/       # Shared + FlowBuilder components
│   └── store/            # Zustand state (authStore.js)
└── docker-compose.yml
```

### Backend Services
- `flowEngine.js` — Core flow graph traversal and node execution. Handles all node types (message, condition, action, input, delay, jump, end).
- `lineService.js` / `messengerService.js` — Platform-specific messaging API integrations.
- `broadcastService.js` — Bulk message sending with Bull job queues.
- `schedulerService.js` — Cron-based scheduled flow triggers.
- `socketService.js` — Real-time dashboard updates via Socket.io.

### Data Flow
1. Webhooks from LINE/Messenger hit `/api/webhooks/:platform/:channelId`
2. Flow engine resolves the contact's current state and executes the matching flow
3. Nodes are traversed as a directed graph; state is persisted on the `Contact.currentFlowState` field
4. Broadcasts use Bull queues (Redis-backed) for rate-limited bulk sends

### Key Data Models (all in `backend/src/models/index.js`)
- **Channel** — Platform credentials (LINE/Messenger) scoped to a user
- **Contact** — Per-channel user with tags, custom fields, and `currentFlowState`
- **Flow** — ReactFlow graph: `nodes[]` + `edges[]`, platform-agnostic
- **Segment** — Dynamic (rule-based) or static contact groups
- **Broadcast** — Bulk message job targeting segments/tags

### Frontend State
- Auth state lives in Zustand (`store/authStore.js`) and syncs with `localStorage`
- Flow editor state is managed locally in `FlowBuilderPage.jsx` using ReactFlow hooks
- API calls go through `src/api/` (axios instance with JWT interceptor)

## Environment Variables

Backend requires `backend/.env` (see `backend/.env.example`):
- `MONGODB_URI`, `REDIS_URL` — database connections
- `JWT_SECRET` — must be changed in production
- `LINE_CHANNEL_*`, `FB_PAGE_ACCESS_TOKEN`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN` — per-channel credentials (can also be stored per-Channel document in DB)
- `FRONTEND_URL` — used for CORS

## Flow Node Types

Flows are directed graphs. Each node has a `type` and `data` payload:
- `trigger` — Entry point (keyword match, follow/unfollow event, schedule, API call)
- `message` — Send text, image, buttons, carousel, or flex template
- `condition` — AND/OR branch logic on contact fields/tags
- `action` — Modify tags/fields, call webhook, trigger sub-flow
- `input` — Wait for user reply and save to `{{var.fieldName}}`
- `delay` — Pause execution (seconds → days)
- `jump` — Redirect to another node in the same flow
- `end` — Terminate flow and clear `currentFlowState`

Template variables: `{{contact.name}}`, `{{contact.platform}}`, `{{var.fieldName}}`, `{{customField.name}}`
