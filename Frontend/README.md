# Pluto Frontend

React + TypeScript + Vite frontend for **Pluto** — a gamified loyalty and rewards platform. Styled with Tailwind CSS and powered by Framer Motion, React Three Fiber, and RainbowKit.

---

## Stack

| Layer        | Technology |
| ------------ | ---------- |
| UI           | React 19 + TypeScript |
| Build        | Vite 7 |
| Styling      | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Routing      | React Router v7 |
| Animation    | Framer Motion |
| 3D           | React Three Fiber, Three.js, Drei |
| Auth         | JWT (context) + Google OAuth, RainbowKit (wallet) |
| Data         | TanStack Query, fetch via `src/lib/api.ts` |

---

## Setup

```bash
cd Frontend
npm install
```

## Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Description |
| -------- | ----------- |
| `VITE_API_BASE_URL` | Pluto backend base URL (e.g. `http://localhost:5000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID (same as Backend `GOOGLE_CLIENT_ID`). Add Authorized JavaScript origins and **Authorized redirect URIs** (e.g. `http://localhost:3000/login/callback`) in [Google Cloud Console](https://console.cloud.google.com/apis/credentials). |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID for RainbowKit ([cloud.walletconnect.com](https://cloud.walletconnect.com/)) |

---

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start dev server (default: http://localhost:5173) |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## Project structure

```
Frontend/
├── public/
├── src/
│   ├── App.tsx              # Routes
│   ├── main.tsx
│   ├── index.css            # Tailwind + base styles
│   ├── context/
│   │   └── AuthContext.tsx  # Auth state + JWT
│   ├── hooks/
│   │   └── usePointsDeduction.tsx
│   ├── lib/
│   │   ├── api.ts           # All API calls
│   │   └── wagmi.ts         # Wagmi/RainbowKit config
│   ├── components/
│   │   ├── Navbar.tsx       # Top nav; mobile hamburger menu (Campquest, Agora, ChainLens, Trendcraft, PulseBot, Log out)
│   │   ├── Footer.tsx
│   │   ├── landing/         # Hero, FeatureCards (with visible Try links), Leaderboard, Stats, FAQ, Feedback, SectionDivider
│   │   ├── campaigns/       # CreateCampaignModal, AddQuestModal (cast picker, follow campaign creator), VerifyQuestModal, Campquest3DScene
│   │   ├── pulsebot/        # PulseBot3DScene
│   │   ├── agora/           # AgoraSidebar, CastModal, NotificationPanel (responsive), etc.
│   │   ├── BuyLoyaltyModal.tsx
│   │   └── DailyClaimModal.tsx
│   └── pages/
│       ├── LandingPage.tsx
│       ├── Login.tsx / LoginCallback.tsx / Signup.tsx
│       ├── Profile.tsx
│       ├── Campaigns.tsx / CampaignDetail.tsx
│       ├── ChainLens.tsx
│       ├── Trendcraft.tsx
│       ├── PulseBot.tsx     # Telegram + Gmail (tasks, scheduled emails), responsive layout
│       ├── Docs.tsx         # Documentation; responsive sidebar/dropdown
│       ├── Privacy.tsx / Terms.tsx
│       └── ...
├── index.html
├── vite.config.ts
└── package.json
```

---

## Features

- **Landing:** Hero (3D), feature cards (Campquest, PulseBot, ChainLens, Agora, Trendcraft, Wallet, Daily Rewards) with visible “Try …” links; leaderboard (top users by loyalty points), platform stats, FAQ accordion, feedback form (stored via backend).
- **Auth:** Email/password login & signup, Google OAuth (redirect flow), JWT in context; optional wallet connect (RainbowKit).
- **Profile:** User info, loyalty points, daily claim, campaign/quest stats, buy loyalty (mock).
- **Campquest:** Campaigns list & detail, create campaign, add/verify quests; gamified UI with 3D background and colorful card borders.
  - **Add Quest modal:** Quest types include Twitter (follow, retweet, tweet_tag, tweet_comment) and Agora (follow, like cast, comment on cast, bookmark cast).
  - **Follow on Agora:** No link needed — users follow the campaign creator automatically.
  - **Cast quests (like/comment/bookmark):** Cast picker loads the campaign creator's casts; pick one from the dropdown instead of pasting IDs.
- **ChainLens:** Wallet intelligence (Moralis).
- **Trendcraft:** Aggregated trends, content generation (Gemini).
- **PulseBot:** Link Telegram, summaries, Q&A, stats; Gmail connect, email tasks (AI-suggested replies), scheduled email queue (compose and send later); 3D background.
- **Legal:** Privacy and Terms pages (linked from footer).

### Mobile & responsive

- **Navbar:** On small screens a hamburger menu shows Campquest, Agora, ChainLens, Trendcraft, PulseBot, and Log out; bell and profile stay in the header. Safe-area and touch-friendly targets (min 44px where appropriate).
- **Agora:** On viewports below `lg`, the sidebar is hidden and a fixed bottom nav shows Feed, Alerts, Messages, Tips, Create, and Profile so the app is usable on mobile.
- **Notification panel:** Responsive size (narrower and shorter on mobile, e.g. max 260px width and 50vh height) so it stays within the viewport and does not overflow.
- **Landing feature cards:** Cards grow with content so “Try Agora”, “Try Campquest”, etc. are always visible; CTA links are styled as clear, tappable buttons.
- **Docs:** Page uses `overflow-x-hidden`; sidebar is constrained on large screens; on mobile a dropdown replaces the sidebar for section navigation.
- **Global:** `viewport-fit=cover`, safe-area insets, `touch-manipulation`, and `overflow-x-hidden` on main page wrappers to avoid horizontal scroll on small screens.

Tailwind is configured in `vite.config.ts` via `@tailwindcss/vite`. No separate `tailwind.config.js` for standard usage.
