# Deploying Pluto

This guide walks you through deploying the Pluto app (Frontend + Backend + MongoDB) to production.

---

## Overview

| Part       | Stack              | Deploy as                    |
| ---------- | ------------------- | ---------------------------- |
| **Backend**  | Node.js, Express, MongoDB, Socket.IO | Node server (e.g. Render, Railway, Fly.io) |
| **Frontend** | React, Vite         | Static site (e.g. Vercel, Netlify) or same server |
| **Database** | MongoDB             | MongoDB Atlas (recommended) or self-hosted |

You need:

1. **MongoDB** – e.g. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier).
2. **Backend** – A Node.js host that runs 24/7 (for Socket.IO and scheduled-email cron).
3. **Frontend** – Any static host; build output is in `Frontend/dist`.

---

## 1. MongoDB (Atlas)

1. Create an account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a cluster (e.g. M0 free tier).
3. Under **Database Access** → Add user (username + password). Note the password.
4. Under **Network Access** → Add IP: `0.0.0/0` (allow from anywhere) or your backend host IPs.
5. In **Databases** → Connect → **Drivers** → copy the connection string. It looks like:
   ```text
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/plutodb?retryWrites=true&w=majority
   ```
6. Replace `USER` and `PASSWORD` with your DB user and password. Use this as `MONGO_URI` for the backend.

---

## 2. Backend deployment

The backend must run continuously (Socket.IO, scheduled-email cron). Example: **Render** or **Railway**.

### Option A: Render (Node backend)

1. Go to [render.com](https://render.com) and sign in (e.g. GitHub).
2. **New** → **Web Service**.
3. Connect your repo (e.g. `Pluto`). Set:
   - **Root Directory:** `Backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance type:** Free (or paid for always-on)
4. **Environment** → Add variables (see [Backend env](#backend-environment-variables) below).
5. Deploy. Note the URL (e.g. `https://pluto-backend.onrender.com`).

Render free tier spins down after inactivity; first request after idle may be slow. For always-on, use a paid instance or Railway.

### Option B: Railway

1. Go to [railway.app](https://railway.app) and sign in.
2. **New Project** → **Deploy from GitHub** → select your repo.
3. Set **Root Directory** to `Backend`.
4. Railway usually detects Node; set:
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
5. **Variables** → add all [Backend env](#backend-environment-variables).
6. Deploy. Note the public URL (e.g. `https://pluto-backend-production.up.railway.app`).

### Backend environment variables

Set these in your backend host’s dashboard (Render, Railway, etc.):

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `MONGO_URI` | Yes | MongoDB connection string (Atlas or other) |
| `JWT_SECRET` | Yes | Strong random string (e.g. `openssl rand -hex 32`) |
| `PORT` | No | Default `5000`; host often sets this |
| `NODE_ENV` | Yes (prod) | Set to `production` |
| `CORS_ORIGIN` | Yes (prod) | Frontend URL, e.g. `https://yourapp.vercel.app` (or comma-separated list) |
| `GOOGLE_CLIENT_ID` | If using Google login | Same as frontend `VITE_GOOGLE_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET` | If using Google login | From Google Cloud Console |
| `PULSEBOT_WEBHOOK_BASE_URL` | If using PulseBot | Your backend public URL, e.g. `https://pluto-backend.onrender.com` |
| `BACKEND_PUBLIC_URL` | If using Gmail | Same as backend public URL (for Gmail OAuth callback) |
| `FRONTEND_ORIGIN` | Optional | Frontend URL (for redirects after Gmail connect) |

Optional (features): `RAPIDAPI_KEY`, `MORALIS_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `YOUTUBE_API_KEY`, `NEWS_API_KEY`, `REDIS_URL`, etc. See `Backend/.env.example`.

---

## 3. Frontend deployment

Build the frontend with the **production API URL**, then deploy the built files.

### Build locally (recommended)

```bash
cd Frontend
cp .env.example .env
# Edit .env: set VITE_API_BASE_URL=https://your-backend-url.com
npm install
npm run build
```

Output is in `Frontend/dist/`. Upload this folder to any static host.

### Option A: Vercel

1. Go to [vercel.com](https://vercel.com) and import your repo.
2. **Root Directory:** `Frontend`.
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. **Environment variables:**
   - `VITE_API_BASE_URL` = your backend URL (e.g. `https://pluto-backend.onrender.com`)
   - `VITE_GOOGLE_CLIENT_ID` = your Google OAuth client ID
   - `VITE_WALLETCONNECT_PROJECT_ID` = your WalletConnect project ID
6. Deploy. Vercel will serve the SPA (all routes → `index.html`).

### Option B: Netlify

1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**.
2. **Base directory:** `Frontend`
3. **Build command:** `npm run build`
4. **Publish directory:** `Frontend/dist`
5. **Environment variables:** same as above (`VITE_API_BASE_URL`, etc.).
6. **Redirects** (for SPA): add `/_redirects` in `Frontend/public/` with:
   ```text
   /*    /index.html   200
   ```
   Or in Netlify UI: **Site settings** → **Build & deploy** → **Post processing** → **Asset optimization**; under **Redirects** add the same rule.
7. Deploy.

### Option C: Same server as backend

You can serve the frontend from Express after building:

1. Build frontend: `cd Frontend && npm run build` (with `VITE_API_BASE_URL` set to your backend URL or relative `/api` if same origin).
2. In backend, serve `Frontend/dist` as static files and add a catch-all route that sends `index.html` for non-API routes. Then deploy the combined app to one Node host (Render, Railway, or a VPS).

### Frontend environment variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `VITE_API_BASE_URL` | Yes | Backend URL, e.g. `https://pluto-backend.onrender.com` (no trailing slash) |
| `VITE_GOOGLE_CLIENT_ID` | If using Google login | Same as backend `GOOGLE_CLIENT_ID` |
| `VITE_WALLETCONNECT_PROJECT_ID` | If using wallet | WalletConnect project ID |

---

## 4. Post-deploy checklist

### Google OAuth (login / sign-in with Google)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth 2.0 Client ID (Web application).
2. **Authorized JavaScript origins:** add your frontend URL (e.g. `https://yourapp.vercel.app`).
3. **Authorized redirect URIs:** add `https://yourapp.vercel.app/login/callback`.

### Gmail OAuth (PulseBot / email integration)

1. Same Google Cloud project (or a dedicated one) → create or use an OAuth client with Gmail scopes.
2. **Authorized redirect URIs:** add `https://your-backend-url.com/api/email-integration/gmail/callback`.
3. Backend: set `BACKEND_PUBLIC_URL` (and optionally `FRONTEND_ORIGIN`) as above.

### CORS

- Backend `CORS_ORIGIN` must include your frontend URL (e.g. `https://yourapp.vercel.app`). No trailing slash.
- For multiple origins use a comma-separated list.

### PulseBot (Telegram)

1. Set `PULSEBOT_WEBHOOK_BASE_URL` to your backend URL (e.g. `https://pluto-backend.onrender.com`).
2. Open in browser: `https://your-backend-url.com/api/pulsebot/set-webhook` (once) to register the webhook with Telegram.

### Socket.IO

- If frontend and backend are on different domains, the Socket.IO client will connect to `VITE_API_BASE_URL`; ensure that URL is correct and CORS allows the frontend origin.

---

## 5. Quick reference

| Step | Action |
| ---- | ------ |
| 1 | Create MongoDB Atlas cluster; get `MONGO_URI` |
| 2 | Deploy backend (Render/Railway); set `MONGO_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CORS_ORIGIN` (frontend URL) |
| 3 | Deploy frontend (Vercel/Netlify); set `VITE_API_BASE_URL` (backend URL) |
| 4 | Add production URLs to Google OAuth (frontend origin + `/login/callback`) and, if used, Gmail callback |
| 5 | If using PulseBot: set `PULSEBOT_WEBHOOK_BASE_URL` and hit `/api/pulsebot/set-webhook` once |

---

## 6. Optional: Docker (backend)

To run the backend in Docker (e.g. on a VPS or container host):

```dockerfile
# Backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

Build and run:

```bash
cd Backend
docker build -t pluto-backend .
docker run -p 5000:5000 --env-file .env pluto-backend
```

Use a real `.env` or pass env vars; never commit secrets.

---

## 7. Troubleshooting

- **CORS errors:** Ensure `CORS_ORIGIN` equals your frontend URL (no trailing slash) and that the frontend is using that exact URL.
- **Socket.IO not connecting:** Check `VITE_API_BASE_URL` and that the backend is reachable; ensure CORS and (if applicable) reverse proxy allow WebSocket.
- **Google login fails in prod:** Confirm authorized origins and redirect URIs in Google Console match the deployed frontend URL and path.
- **PulseBot /link not working:** Ensure `PULSEBOT_WEBHOOK_BASE_URL` is set and you’ve called `/api/pulsebot/set-webhook`; backend must be publicly reachable over HTTPS.
- **Scheduled emails not sending:** Backend must be running (cron runs every minute); check backend logs and MongoDB for `ScheduledEmail` documents.
