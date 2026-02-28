# Pluto Backend

REST API backend for **Pluto**, built with Node.js, Express, TypeScript, and MongoDB. Provides authentication, loyalty rewards, campaigns & quests, Agora (social), ChainLens (wallet intelligence), TrendCraft (aggregated trends + Gemini), PulseBot (Telegram), real-time messaging (Socket.IO), and public landing APIs (leaderboard, stats, feedback).

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Server](#running-the-server)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Authentication](#authentication)
- [Features](#features)
- [Socket.IO](#socketio)
- [License](#license)

---

## Tech Stack

| Layer     | Technology                |
| --------- | ------------------------- |
| Runtime   | Node.js                   |
| Framework | Express                   |
| Language  | TypeScript                |
| Database  | MongoDB (Mongoose)        |
| Auth      | JWT, bcrypt, Google OAuth |
| Real-time | Socket.IO                 |
| Security  | Helmet, CORS             |

---

## Prerequisites

- **Node.js** (v18+ recommended)
- **MongoDB** (local or Atlas connection string)
- **npm** or **yarn**

---

## Installation

1. **Navigate to the Backend folder:**

   ```bash
   cd Backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least `MONGO_URI` and `JWT_SECRET`. See [Environment Variables](#environment-variables) for all options.

4. **Build** (optional, for production):

   ```bash
   npm run build
   ```

---

## Environment Variables

Create a `.env` file in the Backend root. Supported variables:

### Core

| Variable     | Description               | Default |
| ------------ | ------------------------- | ------- |
| `MONGO_URI`  | MongoDB connection string | —       |
| `PORT`       | Server port               | `5000`  |
| `NODE_ENV`   | `development` or `production` | —   |
| `CORS_ORIGIN`| Allowed CORS origin(s)    | `*`     |

### Authentication

| Variable           | Description                     |
| ------------------ | ------------------------------- |
| `JWT_SECRET`       | Secret for signing/verifying JWT |
| `JWT_EXPIRES_IN`   | JWT expiry (e.g. `7d`)          |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID  |

### Optional Integrations

| Variable               | Description                              |
| ---------------------- | ---------------------------------------- |
| `TWITTER_BEARER_TOKEN` | Twitter API v2 bearer (quest verification) |
| `RAPIDAPI_KEY`         | RapidAPI key (Twitter quest verification: follow, retweet, tweet_tag, tweet_comment) |
| `MORALIS_API_KEY`      | Moralis API key (ChainLens)              |
| `YOUTUBE_API_KEY`      | YouTube Data API (TrendCraft)            |
| `NEWS_API_KEY`         | NewsAPI (TrendCraft)                     |
| `REDDIT_USER_AGENT`    | Reddit User-Agent (TrendCraft)           |
| `GEMINI_API_KEY`       | Google Gemini (TrendCraft)               |
| `TELEGRAM_BOT_TOKEN`   | Telegram bot token (PulseBot)            |
| `PULSEBOT_WEBHOOK_BASE_URL` | Public backend URL for PulseBot webhook (e.g. ngrok URL) |

**Production:** Set `NODE_ENV=production` (disables `x-user-id` auth bypass). Restrict `CORS_ORIGIN` to your frontend (e.g. `https://yourapp.com`).

---

## Running the Server

| Command      | Description                            |
| ------------ | -------------------------------------- |
| `npm run dev`  | Start with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/`        |
| `npm start`    | Run compiled app (`node dist/server.js`) |

**Development:**

```bash
npm run dev
```

Server runs at `http://localhost:5000` (or your `PORT`). Without `MONGO_URI`, the app starts but logs a warning and runs without the database.

**Production:**

```bash
npm run build
npm start
```

---

## Project Structure

```
Backend/
├── src/
│   ├── server.ts              # App entry, Express + MongoDB + Socket.IO
│   ├── routes/
│   │   ├── index.ts           # Mounts all /api routes
│   │   ├── auth.routes.ts     # Auth (register, login, Google, me)
│   │   ├── dailyClaim.routes.ts
│   │   ├── campaign.routes.ts
│   │   ├── quest.routes.ts
│   │   ├── wallet.routes.ts
│   │   ├── chainlens.routes.ts
│   │   ├── pulsebot.routes.ts
│   │   ├── emailIntegration.routes.ts  # Gmail, tasks, scheduled emails
│   │   ├── landing.routes.ts  # Leaderboard, stats, feedback (public)
│   │   └── hello.routes.ts
│   ├── controllers/           # Request handlers (incl. landing.controller.ts)
│   ├── models/                # Mongoose models (User, Campaign, Quest, Feedback, etc.)
│   ├── middleware/
│   │   └── auth.middleware.ts # JWT requireAuth / optionalAuth
│   ├── utils/                 # Helpers (auth.utils, constants, referralCode, etc.)
│   ├── services/              # External APIs (Moralis, Telegram)
│   ├── socket/                # Socket.IO setup
│   ├── agora/                 # Social: posts, feed, tips, follow, DMs, etc.
│   └── trendcraft/            # Trends (YouTube, Reddit, HN, News, Gemini)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## API Overview

All API routes are prefixed with **`/api`**.

| Base Path            | Description                                    |
| -------------------- | ---------------------------------------------- |
| `/api/hello`         | Health / hello                                 |
| `/api/auth`          | Register, login, Google, get/update me         |
| `/api/daily-claim`   | Daily loyalty claim status & claim             |
| `/api/campaigns`     | Campaigns CRUD, add quest to campaign           |
| `/api/quests`        | Quests CRUD, verify quest                      |
| `/api/wallet`        | Mock buy loyalty                               |
| `/api/agora`         | Posts, feed, tips, follow, DMs, etc.           |
| `/api/chainlens`     | Wallet insights (Moralis)                      |
| `/api/trendcraft`    | Trends feed, YouTube/Reddit/HN/News, Gemini    |
| `/api/pulsebot`      | Link code, summary, ask, webhook, stats        |
| `/api/email-integration` | Gmail connect, sync, tasks, digest, scheduled emails, suggest/send reply |
| `/api/landing`       | **Leaderboard, stats, feedback** (public)      |

### Landing (`/api/landing`) — Public

| Method | Path           | Auth | Description                          |
| ------ | -------------- | ---- | ------------------------------------ |
| GET    | `/leaderboard` | No   | Top users by loyalty points (rank, username, points) |
| GET    | `/stats`       | No   | Platform stats (userCount, campaignCount, questCount, completionCount, totalPoints) |
| POST   | `/feedback`    | No   | Submit feedback (message required; name, email optional). Stored in MongoDB. |

### Auth (`/api/auth`)

| Method | Path        | Auth | Description              |
| ------ | ----------- | ---- | ------------------------- |
| POST   | `/register` | No   | Email/password signup     |
| POST   | `/login`    | No   | Email/password login      |
| POST   | `/google`   | No   | Google OAuth login        |
| GET    | `/me`       | Yes  | Current user + stats      |
| PATCH  | `/me`       | Yes  | Update username, profile picture |

### Daily Claim (`/api/daily-claim`)

| Method | Path      | Auth | Description                     |
| ------ | --------- | ---- | ------------------------------- |
| GET    | `/status` | Yes  | canClaim, streak, nextClaimAt   |
| POST   | `/`       | Yes  | Claim daily points (24h cooldown) |

### Campaigns (`/api/campaigns`)

| Method | Path                   | Auth | Description           |
| ------ | ---------------------- | ---- | --------------------- |
| POST   | `/`                    | Yes  | Create campaign       |
| GET    | `/`                    | No   | List campaigns        |
| GET    | `/:id`                 | No   | Get campaign          |
| PATCH  | `/:id`                 | Yes  | Update campaign       |
| DELETE | `/:id`                 | Yes  | Delete campaign       |
| POST   | `/:campaignId/quests`  | Yes  | Add quest (costs loyalty) |

### Quests (`/api/quests`)

| Method | Path          | Auth | Description |
| ------ | ------------- | ---- | ----------- |
| GET    | `/`           | No   | List quests  |
| GET    | `/:id`        | No   | Get quest    |
| PATCH  | `/:id`        | Yes  | Update quest |
| DELETE | `/:id`        | Yes  | Delete quest |
| POST   | `/:id/verify` | Yes  | Verify quest |

**Quest types:**

| Type | Description | requiredLink | Verification |
|------|-------------|--------------|--------------|
| `follow_twitter` | Follow on Twitter/X | Twitter profile URL | RapidAPI followings endpoint |
| `retweet_tweet` | Retweet a tweet | Tweet URL | RapidAPI retweets endpoint |
| `tweet_tag` | Tag someone in a tweet | Handle or profile URL | RapidAPI tweet endpoint; user provides `tweetUrl` on verify |
| `tweet_comment` | Comment on a tweet | Tweet URL | RapidAPI comments endpoint |
| `agora_follow` | Follow on Agora | Optional; leave empty for **campaign creator** | MongoDB `Follow` model |
| `agora_like_post` | Like a cast | Cast ID | MongoDB `PostLike` model |
| `agora_comment` | Reply to a cast | Cast ID | MongoDB `Post` (replies) |
| `agora_bookmark_post` | Bookmark a cast | Cast ID | MongoDB `PostBookmark` model |

Twitter quests require `RAPIDAPI_KEY` and user-linked Twitter. Agora quests verify against the database; no external API.

### Wallet (`/api/wallet`)

| Method | Path           | Auth | Description        |
| ------ | -------------- | ---- | ------------------ |
| POST   | `/buy-loyalty` | Yes  | Mock buy loyalty   |

### Agora (`/api/agora`)

Social layer: posts, likes, replies, tips, follow/followers, bookmarks, DMs (conversations/messages), notifications, reports, admin hide post, trending feed, user feed. See `src/agora/routes.ts` for full route list.

### ChainLens (`/api/chainlens`)

| Method | Path | Auth | Description             |
| ------ | ---- | ---- | ----------------------- |
| POST   | `/`  | Yes  | Wallet insights (Moralis) |

### TrendCraft (`/api/trendcraft`)

| Method | Path                  | Auth | Description              |
| ------ | --------------------- | ---- | ------------------------ |
| GET    | `/feed`               | No   | Aggregated trends        |
| GET    | `/youtube`            | No   | YouTube trends           |
| GET    | `/reddit`             | No   | Reddit trends            |
| GET    | `/hackernews`        | No   | HN trends                |
| GET    | `/news`               | No   | NewsAPI trends           |
| POST   | `/generate-content`   | Yes  | Generate content (Gemini) |
| GET    | `/content-suggestions` | Yes  | Content suggestions      |

### PulseBot (`/api/pulsebot`)

| Method | Path         | Auth | Description      |
| ------ | ------------ | ---- | ---------------- |
| POST   | `/webhook`   | No   | Telegram webhook |
| POST   | `/link-code` | Yes  | Create link code |
| GET    | `/me`        | Yes  | Linked bot info  |
| POST   | `/summary`   | Yes  | Generate summary |
| POST   | `/ask`       | Yes  | Ask question     |
| GET    | `/stats`     | Yes  | Stats            |

### Email integration (`/api/email-integration`)

Gmail OAuth, sync, AI tasks (replies needed), digest, and scheduled emails.

| Method | Path                    | Auth | Description                          |
| ------ | ----------------------- | ---- | ------------------------------------ |
| GET    | `/status`               | Yes  | Gmail connect status, last sync      |
| GET    | `/gmail/auth-url`       | Yes  | Gmail OAuth URL                      |
| GET    | `/gmail/callback`       | No   | OAuth callback (query code)          |
| POST   | `/gmail/disconnect`     | Yes  | Disconnect Gmail                     |
| POST   | `/gmail/sync`           | Yes  | Sync inbox (store emails)            |
| GET    | `/tasks`                | Yes  | List email tasks (AI-suggested replies; cached by user + email IDs) |
| GET    | `/gmail/digest`         | Yes  | Gmail insights (unread, threads, top senders) |
| GET    | `/emails/:messageId`    | Yes  | Get email body by message ID         |
| POST   | `/tasks/:taskId/suggest-reply` | Yes | AI-suggest reply (costs loyalty) |
| POST   | `/tasks/:taskId/send`   | Yes  | Send reply                           |
| POST   | `/scheduled`            | Yes  | Schedule email (to, subject, body, scheduledFor) |
| GET    | `/scheduled`            | Yes  | List scheduled emails (pending + sent in last 24h) |
| GET    | `/scheduled/:id`        | Yes  | Get scheduled email                  |
| PATCH  | `/scheduled/:id`        | Yes  | Update scheduled email (pending only) |
| DELETE | `/scheduled/:id`        | Yes  | Delete scheduled email               |

A cron job (e.g. every minute) sends scheduled emails when `scheduledFor` is due. Sent items are only returned in the list for 24 hours after send.

---

## Authentication

- **JWT:** Send `Authorization: Bearer <token>` on protected routes.
- **Token:** Returned on login/register/Google auth; use `JWT_EXPIRES_IN` for expiry (default `7d`).
- **Optional auth:** Some routes use `optionalAuth`: if a valid JWT is present, `req.user` is set; otherwise the request still proceeds (e.g. public feed).
- **Development:** When `NODE_ENV !== 'production'`, the server may allow an `x-user-id` header for testing without a token (see `auth.middleware.ts`). Do not rely on this in production.

---

## Features

- **Auth:** Email/password and Google OAuth; JWT; referral codes; profile (username, profile picture).
- **Loyalty:** Loyalty points; daily claim (7-day streak, 24h cooldown); referral rewards; wallet mock buy; loyalty spent on quests, campaigns, ChainLens, TrendCraft, PulseBot, Agora tips.
- **Landing (public):** Leaderboard (top users by points), platform stats, feedback form (stored in `Feedback` model).
- **Agora:** Posts, likes, replies, tips (loyalty), follow/followers, bookmarks, DMs (conversations/messages), notifications, reports, admin hide, trending and user feeds.
- **Quests & Campaigns:** Quests with verification; campaigns that can include quests (costs loyalty). Supported types:
  - **Twitter:** follow_twitter, retweet_tweet, tweet_tag, tweet_comment (via RapidAPI; requires `RAPIDAPI_KEY` and linked Twitter).
  - **Agora:** agora_follow (optional link → uses campaign creator), agora_like_post, agora_comment, agora_bookmark_post (verified via MongoDB).
- **ChainLens:** Wallet intelligence via Moralis (requires `MORALIS_API_KEY`).
- **TrendCraft:** Aggregated trends from YouTube, Reddit, Hacker News, NewsAPI; Gemini for content generation and suggestions (respective API keys required).
- **PulseBot:** Telegram bot link, summaries, Q&A, webhook; uses loyalty for AI features.
- **Email integration:** Gmail OAuth, sync inbox, AI email tasks (replies needed; list-tasks result cached by user + email IDs), Gmail digest (unread, threads, top senders), scheduled emails (compose and send later; cron sends at scheduled time; sent items shown for 24h only), suggest/send reply (loyalty cost).
- **Socket.IO:** Real-time messaging (see `src/socket/index.ts`). Configure `CORS_ORIGIN` for Socket.IO if needed.

---

## Socket.IO

The server attaches Socket.IO to the same HTTP server as Express. Use it for real-time messaging or other events. Connection options (e.g. CORS) are set in `src/socket/index.ts` (e.g. `CORS_ORIGIN` from env).

---

## License

ISC.
