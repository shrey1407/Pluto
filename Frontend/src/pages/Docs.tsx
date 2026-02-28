import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const SIDEBAR_SECTIONS = [
  {
    title: 'Introduction',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'what-is-pluto', label: 'What is Pluto?' },
      { id: 'who-is-it-for', label: 'Who is it for?' },
      { id: 'core-concepts', label: 'Core Concepts' },
      { id: 'novelty-scope', label: 'Novelty & Scope' },
    ],
  },
  {
    title: 'Accessing Pluto',
    items: [
      { id: 'web-routes', label: 'Web Routes' },
      { id: 'logging-in', label: 'Logging In' },
    ],
  },
  {
    title: 'User Roles',
    items: [
      { id: 'user-roles', label: 'Logged-in, Guest, Admin' },
    ],
  },
  {
    title: 'Loyalty & Points',
    items: [
      { id: 'loyalty-overview', label: 'Loyalty Points' },
      { id: 'loyalty-earn-spend', label: 'Earn & Spend Table' },
      { id: 'loyalty-daily-claim', label: 'Daily Claim' },
      { id: 'loyalty-referrals', label: 'Referral Rewards' },
      { id: 'loyalty-buy', label: 'Buy Loyalty' },
    ],
  },
  {
    title: 'Landing Page',
    items: [
      { id: 'landing-page', label: 'Hero, Leaderboard, FAQ' },
    ],
  },
  {
    title: 'Authentication',
    items: [
      { id: 'auth-signup-login', label: 'Sign Up & Login' },
      { id: 'auth-google', label: 'Google OAuth' },
      { id: 'auth-profile', label: 'Profile & Settings' },
    ],
  },
  {
    title: 'Campaigns & Quests',
    items: [
      { id: 'campaigns-overview', label: 'Campaigns Overview' },
      { id: 'campaigns-create', label: 'Creating Campaigns' },
      { id: 'quests-types', label: 'Quest Types' },
      { id: 'quests-twitter', label: 'Twitter Quests' },
      { id: 'quests-agora', label: 'Agora Quests' },
      { id: 'quests-verify', label: 'Verifying Quests' },
    ],
  },
  {
    title: 'Agora (Social Feed)',
    items: [
      { id: 'agora-overview', label: 'Overview' },
      { id: 'agora-feeds', label: 'Feeds' },
      { id: 'agora-casts', label: 'Casts & Replies' },
      { id: 'agora-tips', label: 'Tips' },
      { id: 'agora-follow', label: 'Follow & Profile' },
      { id: 'agora-bookmarks', label: 'Bookmarks' },
      { id: 'agora-messages', label: 'Direct Messages' },
      { id: 'agora-notifications', label: 'Notifications' },
      { id: 'agora-reports', label: 'Reports & Moderation' },
    ],
  },
  {
    title: 'ChainLens',
    items: [
      { id: 'chainlens-overview', label: 'Wallet Intelligence' },
    ],
  },
  {
    title: 'Trendcraft',
    items: [
      { id: 'trendcraft-overview', label: 'Trends Feed' },
      { id: 'trendcraft-generate', label: 'Content Generation' },
    ],
  },
  {
    title: 'PulseBot',
    items: [
      { id: 'pulsebot-overview', label: 'Overview' },
      { id: 'pulsebot-link', label: 'Linking Telegram' },
      { id: 'pulsebot-features', label: 'Summaries & Q&A' },
      { id: 'pulsebot-gmail', label: 'Gmail & Scheduled Emails' },
    ],
  },
  {
    title: 'Responsive & Mobile UI',
    items: [
      { id: 'responsive-navbar', label: 'Navbar & Mobile Menu' },
      { id: 'responsive-agora', label: 'Agora Mobile' },
      { id: 'responsive-notifications', label: 'Notifications Panel' },
      { id: 'responsive-landing-docs', label: 'Landing & Docs' },
    ],
  },
  {
    title: 'Wallet',
    items: [
      { id: 'wallet', label: 'Buy Loyalty (Mock)' },
    ],
  },
  {
    title: 'Daily Rewards',
    items: [
      { id: 'daily-rewards', label: 'Streak & Claim' },
    ],
  },
  {
    title: 'Privacy, Terms & Feedback',
    items: [
      { id: 'privacy-terms', label: 'Privacy & Terms' },
      { id: 'feedback', label: 'Feedback Form' },
    ],
  },
  {
    title: 'User Flows',
    items: [
      { id: 'user-flows', label: 'Common Flows' },
    ],
  },
  {
    title: 'Technical Overview',
    items: [
      { id: 'technical', label: 'Frontend, Backend, API' },
    ],
  },
  {
    title: 'Glossary',
    items: [
      { id: 'glossary', label: 'Key Terms' },
    ],
  },
  {
    title: 'Environment',
    items: [
      { id: 'env-variables', label: 'Environment Variables' },
    ],
  },
]

function DocSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 pt-10 pb-8 first:pt-0 border-t border-white/5 first:border-t-0"
    >
      <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
      <div className="prose prose-invert prose-slate max-w-none text-slate-300 space-y-4">{children}</div>
    </section>
  )
}

function DocSubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export default function Docs() {
  const [activeId, setActiveId] = useState('overview')

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.slice(1)
      if (hash) {
        const el = document.getElementById(hash)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' })
          setActiveId(hash)
        }
      }
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const sections = SIDEBAR_SECTIONS.flatMap((s) => s.items)
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]!.id)
        if (el && el.getBoundingClientRect().top < 150) {
          setActiveId(sections[i]!.id)
          break
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setActiveId(id)
    window.history.replaceState(null, '', `#${id}`)
  }

  return (
    <div
      className="min-h-screen text-white overflow-x-hidden w-full"
      style={{
        background: 'linear-gradient(180deg, #050508 0%, #0a0a12 25%, #080810 75%, #050508 100%)',
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 100% 60% at 50% -20%, rgba(99, 102, 241, 0.2), transparent 50%),' +
            'radial-gradient(ellipse 60% 80% at 90% 50%, rgba(6, 182, 212, 0.08), transparent 45%),' +
            'radial-gradient(ellipse 60% 80% at 10% 80%, rgba(139, 92, 246, 0.08), transparent 45%)',
        }}
      />
      <Navbar />

      <div className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 w-full min-w-0">
        <div className="max-w-7xl mx-auto flex gap-12 w-full min-w-0">
          {/* Sidebar — only on lg+, constrained so it never overflows viewport */}
          <aside className="hidden lg:block w-64 min-w-0 max-w-[min(16rem,calc(100vw-2rem))] shrink-0">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <nav className="space-y-6">
                {SIDEBAR_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      {section.title}
                    </h3>
                    <ul className="space-y-1">
                      {section.items.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => scrollTo(item.id)}
                            className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              activeId === item.id
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* Mobile dropdown — constrained to viewport */}
          <div className="lg:hidden fixed top-20 left-4 right-4 z-20 w-[calc(100vw-2rem)] max-w-full">
            <select
              value={activeId}
              onChange={(e) => scrollTo(e.target.value)}
              className="w-full max-w-full px-4 py-2 rounded-xl bg-slate-900/95 border border-white/10 text-white text-sm min-w-0"
            >
              {SIDEBAR_SECTIONS.map((section) => (
                <optgroup key={section.title} label={section.title}>
                  {section.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-hidden lg:pt-0 pt-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl w-full min-w-0"
            >
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to home
              </Link>

              <h1 className="text-4xl font-bold text-white mb-2">Pluto Documentation</h1>
              <p className="text-slate-400 mb-12">
                Complete guide to using Pluto — gamified loyalty, campaigns, quests, Agora social feed, and more.
              </p>

              {/* Introduction */}
              <DocSection id="overview" title="Overview">
                <p>
                  Pluto is a gamified loyalty and rewards platform that connects creators, communities, and brands
                  through quest-based campaigns. Users earn loyalty points through daily claims, referrals, quest
                  completions, and engagement. Points can be spent on creating campaigns, ChainLens (wallet
                  intelligence), Trendcraft (content generation), PulseBot (Telegram summaries), and tipping creators
                  on Agora.
                </p>
                <p>Key features include:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Authentication (email/password, Google OAuth)</li>
                  <li>Loyalty points with daily claim streaks</li>
                  <li>Campaigns and quests (Twitter/X and Agora)</li>
                  <li>Agora — social feed with casts, tips, DMs, bookmarks</li>
                  <li>ChainLens — wallet intelligence via Moralis</li>
                  <li>Trendcraft — aggregated trends and AI content</li>
                  <li>PulseBot — Telegram bot for summaries and Q&A</li>
                </ul>
              </DocSection>

              <DocSection id="what-is-pluto" title="What is Pluto?">
                <p>
                  Pluto is a Web3-native loyalty platform that rewards users for completing tasks (quests) and
                  engaging with content. It bridges social media engagement (Twitter/X, Agora) with a points economy.
                  Creators and brands run campaigns with quests; users complete them to earn loyalty points, which
                  they can spend on premium features or tip creators.
                </p>
              </DocSection>

              <DocSection id="who-is-it-for" title="Who is it for?">
                <p>Pluto serves three audiences:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Creators & brands</strong> — Run campaigns, add quests, grow community and engagement</li>
                  <li><strong>Users</strong> — Complete quests, earn points, explore Agora, use ChainLens and Trendcraft</li>
                  <li><strong>Admins</strong> — Manage users, campaigns, and moderation via the admin panel</li>
                </ul>
              </DocSection>

              <DocSection id="core-concepts" title="Core Concepts">
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Loyalty points</strong> — In-app currency earned and spent across the platform</li>
                  <li><strong>Campaigns</strong> — Collections of quests created by creators/brands</li>
                  <li><strong>Quests</strong> — Tasks (follow, retweet, like cast, etc.) that users complete for rewards</li>
                  <li><strong>Agora</strong> — Pluto&apos;s social feed (casts, likes, tips, DMs)</li>
                  <li><strong>Casts</strong> — Short posts in Agora (like tweets)</li>
                </ul>
              </DocSection>

              <DocSection id="novelty-scope" title="Novelty & Scope">
                <p>
                  Pluto combines gamification, Web3, and social engagement in one place. Novel aspects include:
                  Twitter and Agora quest verification, cast picker for campaign creators, follow-the-creator for
                  Agora follow quests, and integration of ChainLens, Trendcraft, and PulseBot. Scope covers the
                  full flow from signup → quest completion → spending points, plus Agora social features.
                </p>
              </DocSection>

              {/* Accessing Pluto */}
              <DocSection id="web-routes" title="Web Routes">
                <p>Main routes:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/</code> — Landing page</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/login</code>, <code className="bg-white/10 px-1.5 py-0.5 rounded">/signup</code> — Auth</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/dashboard</code> — Dashboard (logged-in)</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/profile</code> — Profile & settings</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/campaigns</code> — Campaigns list</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/campaigns/:id</code> — Campaign detail & quests</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/agora</code> — Agora social feed</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/chainlens</code> — ChainLens</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/trendcraft</code> — Trendcraft</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/pulsebot</code> — PulseBot</li>
                  <li><code className="bg-white/10 px-1.5 py-0.5 rounded">/docs</code> — Documentation (this page)</li>
                </ul>
              </DocSection>

              <DocSection id="logging-in" title="Logging In">
                <p>
                  Use Sign Up or Login. JWT is stored (localStorage or memory) and sent on API requests. Ensure
                  backend is running and <code className="bg-white/10 px-1 rounded">VITE_API_BASE_URL</code> points
                  to the correct server (e.g. <code className="bg-white/10 px-1 rounded">http://localhost:5000</code>).
                  Logout clears the token and redirects to the landing page.
                </p>
              </DocSection>

              {/* User Roles */}
              <DocSection id="user-roles" title="User Roles">
                <DocSubSection title="Logged-in user">
                  <p>Full access: dashboard, campaigns, quests, Agora (casts, tips, DMs), ChainLens, Trendcraft,
                    PulseBot, profile, wallet. Can create campaigns, complete quests, tip, and use paid features.</p>
                </DocSubSection>
                <DocSubSection title="Guest">
                  <p>Can view landing page, docs, login/signup. Protected routes redirect to login. No access to
                    dashboard, campaigns, or other authenticated features.</p>
                </DocSubSection>
                <DocSubSection title="Administrator">
                  <p>Same as logged-in, plus admin panel at <code className="bg-white/10 px-1 rounded">/admin</code>:
                    manage users, review campaigns, handle moderation reports (hide content, take action on users).</p>
                </DocSubSection>
              </DocSection>

              {/* Authentication */}
              <DocSection id="auth-signup-login" title="Sign Up & Login">
                <p>
                  <strong>Email/password:</strong> Sign up with email, username, and password. Passwords are hashed
                  with bcrypt before storage. On success, the backend returns a JWT; the frontend stores it and sends
                  <code className="bg-white/10 px-1 rounded ml-1">Authorization: Bearer &lt;token&gt;</code> on requests.
                  Login validates credentials and returns a new JWT.
                </p>
                <p>
                  <strong>Flow:</strong> Signup → JWT stored → user redirected to dashboard. Protected routes check
                  for token; missing/invalid token redirects to login.
                </p>
              </DocSection>

              <DocSection id="auth-google" title="Google OAuth">
                <p>
                  Sign in with Google uses the Google Identity Services library. Frontend triggers the OAuth flow;
                  backend receives the ID token, verifies it with Google, finds or creates the user, and returns a
                  JWT. Configure <code className="bg-white/10 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> (frontend)
                  and <code className="bg-white/10 px-1 rounded ml-1">GOOGLE_CLIENT_ID</code> (backend). Add your
                  frontend URL to Authorized JavaScript origins and redirect URIs in Google Cloud Console.
                </p>
              </DocSection>

              <DocSection id="auth-profile" title="Profile & Settings">
                <p>
                  <strong>Editable:</strong> Username, profile picture (upload or URL), Twitter/X link (for quest
                  verification), wallet address (for ChainLens). Twitter linking stores your Twitter ID via OAuth or
                  manual flow.
                </p>
                <p>
                  <strong>Displayed:</strong> Referral code, loyalty points, daily claim streak, campaign stats
                  (created, participated). Profile is required for quest verification (Twitter) and ChainLens (wallet).
                </p>
              </DocSection>

              {/* Loyalty */}
              <DocSection id="loyalty-overview" title="Loyalty Points">
                <p>
                  <strong>What it is:</strong> Loyalty points are Pluto&apos;s in-app currency. They power the entire
                  economy: earning through engagement, spending on features and tipping.
                </p>
                <p>
                  <strong>How it works:</strong> Points are stored per user. Every earn (daily claim, quest, referral,
                  buy) and spend (campaign, quest, ChainLens, Trendcraft, PulseBot, tips) is recorded as a loyalty
                  transaction with balance-after for auditability. Insufficient balance blocks paid actions.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Creates a closed loop: users earn by engaging, spend on
                  premium features or tipping creators, which incentivizes more engagement and content creation.
                </p>
              </DocSection>

              <DocSection id="loyalty-earn-spend" title="Earn & Spend Table">
                <p><strong>Earning:</strong></p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>Daily claim — 10–70 pts (day 1–7 streak)</li>
                  <li>Quest completion — 25 pts per quest</li>
                  <li>Referral — 500 pts referrer + bonus for new user</li>
                  <li>Buy loyalty — 10–10,000 pts (mock purchase)</li>
                </ul>
                <p className="mt-4"><strong>Spending:</strong></p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>Create campaign — 100 pts</li>
                  <li>Add quest — 50 pts each</li>
                  <li>ChainLens insight — 10 pts</li>
                  <li>Trendcraft feed/gen/suggestions — 3 pts each</li>
                  <li>PulseBot summary/ask — 10 pts, stats — 2 pts</li>
                  <li>Tip on Agora — 1–1,000,000 pts</li>
                </ul>
              </DocSection>

              <DocSection id="loyalty-daily-claim" title="Daily Claim">
                <p>
                  <strong>What it does:</strong> Claim loyalty points once every 24 hours. Consecutive claims build a
                  streak (days 1–7); each day grants more points.
                </p>
                <p>
                  <strong>How it works:</strong> Day 1 = 10 pts, Day 2 = 20 pts, Day 3 = 30 pts, …, Day 7 = 70 pts.
                  You must claim within 24 hours of your last claim to advance the streak. If you wait 48+ hours
                  after your last claim, the streak resets to day 1. The modal shows current streak, points for the
                  next claim, and when you can claim again.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Encourages daily engagement and rewards consistency with
                  escalating rewards.
                </p>
              </DocSection>

              <DocSection id="loyalty-referrals" title="Referral Rewards">
                <p>
                  <strong>What it does:</strong> Both the referrer and the new user receive loyalty points when someone
                  signs up with your referral code.
                </p>
                <p>
                  <strong>How it works:</strong> Copy your referral code from Profile. New users enter it during signup
                  or when using Google OAuth. The backend credits 500 pts to the referrer and a bonus to the new user.
                  Each referral can only be used once.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Incentivizes sharing and grows the user base organically.
                </p>
              </DocSection>

              <DocSection id="loyalty-buy" title="Buy Loyalty">
                <p>
                  <strong>What it does:</strong> A mock purchase flow adds loyalty points via simulated crypto payment.
                </p>
                <p>
                  <strong>How it works:</strong> Connect your wallet (RainbowKit). Choose an amount between 10 and
                  10,000 points (default 100). The backend credits your account without a real payment. In production,
                  this could integrate with payment providers or on-chain purchases.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Lets users top up points for testing or to spend on features
                  without earning through quests or daily claims.
                </p>
              </DocSection>

              {/* Landing Page */}
              <DocSection id="landing-page" title="Landing Page">
                <p>
                  <strong>Hero:</strong> Headline and value proposition for Pluto. Call-to-action buttons for Sign up
                  and Login.
                </p>
                <p>
                  <strong>Leaderboard:</strong> Top users by loyalty points. Fetched from the backend; encourages
                  competition and showcases engaged users.
                </p>
                <p>
                  <strong>Feature cards:</strong> Highlights of Campquest, Agora, ChainLens, Trendcraft, PulseBot,
                  Wallet, and Daily Rewards. Each card has a visible &quot;Try …&quot; link (e.g. Try Agora, Try Campquest)
                  styled as a tappable button; cards grow with content so links are never clipped on mobile.
                </p>
                <p>
                  <strong>FAQ:</strong> Common questions and answers about the platform.
                </p>
                <p>
                  <strong>Footer:</strong> Links to Docs, Privacy, Terms, Feedback. Accessible at <code className="bg-white/10 px-1 rounded">/</code>.
                </p>
              </DocSection>

              {/* Campaigns & Quests */}
              <DocSection id="campaigns-overview" title="Campaigns Overview">
                <p>
                  <strong>What it is:</strong> Campaigns are collections of quests created by users (creators/brands).
                  Other users complete quests to earn loyalty points and participate in the campaign.
                </p>
                <p>
                  <strong>How it works:</strong> Each campaign has a name, description, expiry date, and status
                  (draft, active, expired). Only the owner can add quests (50 pts each), update, or delete. Users
                  see active campaigns, open them, and verify quest completion. Each quest is completable once per user.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Creators use campaigns to drive engagement (follows, retweets,
                  casts); users earn points for actions they might already do. Win-win.
                </p>
              </DocSection>

              <DocSection id="campaigns-create" title="Creating Campaigns">
                <p>
                  Creating a campaign costs 100 loyalty points. From the campaigns list, click Create, fill name,
                  description, and expiry date. Status starts as draft; you can publish to active. On the campaign
                  detail page, Add Quest opens a modal: choose quest type, set required link (or leave empty for
                  follow-creator), use Cast Picker for Agora cast quests. Each quest costs 50 pts. Only the owner
                  sees edit/delete controls.
                </p>
              </DocSection>

              <DocSection id="quests-types" title="Quest Types">
                <p>Pluto supports eight quest types:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Follow on Twitter/X</strong> — User must follow a Twitter account</li>
                  <li><strong>Retweet</strong> — User must retweet a specific tweet</li>
                  <li><strong>Tag in a tweet</strong> — User must mention a handle in a tweet (verify with tweet URL)</li>
                  <li><strong>Comment on a tweet</strong> — User must comment on a specific tweet</li>
                  <li><strong>Follow on Agora</strong> — User must follow a user (default: campaign creator)</li>
                  <li><strong>Like a cast</strong> — User must like a specific Agora cast</li>
                  <li><strong>Reply to a cast</strong> — User must reply to a specific cast</li>
                  <li><strong>Bookmark a cast</strong> — User must bookmark a specific cast</li>
                </ul>
              </DocSection>

              <DocSection id="quests-twitter" title="Twitter Quests">
                <p>
                  Twitter quests (<code className="bg-white/10 px-1 rounded">follow_twitter</code>, <code className="bg-white/10 px-1 rounded">retweet_tweet</code>, <code className="bg-white/10 px-1 rounded">tweet_tag</code>, <code className="bg-white/10 px-1 rounded">tweet_comment</code>)
                  require the user to link their Twitter account in Profile. Verification uses the RapidAPI
                  twitter241 endpoints (including the comments endpoint for tweet_comment). Set <code className="bg-white/10 px-1.5 py-0.5 rounded">RAPIDAPI_KEY</code> in the backend.
                </p>
                <p>
                  For <strong>tweet_tag</strong>, users must provide their tweet URL when verifying. For
                  <strong>tweet_comment</strong>, verification checks that the user commented on the target tweet.
                  For follow and retweet, verification is automatic based on linked Twitter ID.
                </p>
              </DocSection>

              <DocSection id="quests-agora" title="Agora Quests">
                <p>
                  Agora quests (<code className="bg-white/10 px-1 rounded">agora_follow</code>, <code className="bg-white/10 px-1 rounded">agora_like_post</code>, <code className="bg-white/10 px-1 rounded">agora_comment</code>, <code className="bg-white/10 px-1 rounded">agora_bookmark_post</code>)
                  verify against the database — no external API.
                </p>
                <p>
                  For <strong>Follow on Agora</strong>, leave the required link empty to use the campaign creator as
                  the target. For like, comment, and bookmark quests, use the <strong>Cast Picker</strong> in the Add
                  Quest modal: it loads your casts and lets you select one from a dropdown instead of pasting IDs.
                </p>
                <p>
                  The required link field accepts text (not just URLs), so ObjectIds and paths are valid.
                </p>
              </DocSection>

              <DocSection id="quests-verify" title="Verifying Quests">
                <p>
                  Users click Verify on a quest from the campaign page. For tweet_tag, a modal asks for the user&apos;s
                  tweet URL (the tweet where they mentioned the handle). For other types, no extra input. Backend
                  verifies: Twitter quests use RapidAPI (followings, tweet, comments); Agora quests check the database.
                  On success: 25 loyalty points awarded, quest marked complete, transaction recorded. Each quest is
                  one-time per user.
                </p>
              </DocSection>

              {/* Agora */}
              <DocSection id="agora-overview" title="Agora Overview">
                <p>
                  <strong>What it is:</strong> Agora is Pluto&apos;s built-in social feed. Post short &quot;casts&quot;
                  (like tweets), engage with others, and monetize through tips.
                </p>
                <p>
                  <strong>How it works:</strong> Casts support text (up to 500 chars) and up to 4 images (base64).
                  You can like, reply, bookmark, and follow users. Tips use loyalty points: deducted from sender,
                  added to recipient. DMs use Socket.IO for real-time delivery. Access at <code className="bg-white/10 px-1 rounded">/agora</code>.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Keeps engagement inside Pluto, drives quest completion
                  (follow/like/comment/bookmark), and lets creators earn tips without leaving the platform.
                </p>
              </DocSection>

              <DocSection id="agora-feeds" title="Feeds">
                <p>
                  <strong>Home:</strong> Casts from users you follow, reverse chronological. Empty if you follow no one.
                </p>
                <p>
                  <strong>Explore:</strong> Trending and discovery — popular casts and users to follow.
                </p>
                <p>
                  <strong>Most Tipped Creators:</strong> Leaderboard of users who received the most tips. Helps discover
                  valued creators.
                </p>
                <p>Switch feeds via the sidebar. Pagination applies (50 casts per page).</p>
              </DocSection>

              <DocSection id="agora-casts" title="Casts & Replies">
                <p>
                  Create a cast from the feed or thread view. Text plus optional images. Replies nest under the parent
                  cast; clicking a cast opens its thread. Like and bookmark buttons record engagement; bookmarks are
                  private. All stored in MongoDB; real-time updates via Socket.IO for new casts, likes, and replies.
                </p>
              </DocSection>

              <DocSection id="agora-tips" title="Tips">
                <p>
                  Tip from a cast (to author) or from a user profile. Enter amount (min 1, max 1,000,000 loyalty pts).
                  Backend deducts from your balance, credits theirs, creates loyalty transactions, and emits a
                  notification. Tips section lists sent and received with timestamps.
                </p>
              </DocSection>

              <DocSection id="agora-follow" title="Follow & Profile">
                <p>
                  Follow/unfollow from profiles or cast headers. Home feed shows casts from followed users.
                  Profiles display: casts, follower/following counts, tip button. Explore surfaces users to discover.
                </p>
              </DocSection>

              <DocSection id="agora-bookmarks" title="Bookmarks">
                <p>
                  Bookmark casts to save for later. Bookmarks list in sidebar shows all saved casts. Bookmarked casts
                  display a bookmark icon. Unbookmark from the cast or bookmark list.
                </p>
              </DocSection>

              <DocSection id="agora-messages" title="Direct Messages">
                <p>
                  Start a conversation from a user profile. Messages (up to 2000 chars) are sent via REST and
                  delivered in real-time via Socket.IO. Conversations list shows threads; each thread shows the
                  latest message and unread state.
                </p>
              </DocSection>

              <DocSection id="agora-notifications" title="Notifications">
                <p>
                  Notifications are created for: likes on your casts, replies to your casts, tips received, new
                  followers, and new DMs. Stored in MongoDB, fetched via API. Navbar bell shows unread count;
                  notification center lists recent items with links to the relevant cast/user.
                </p>
                <p>
                  <strong>Responsive:</strong> On small screens the notification panel is narrower and shorter (e.g.
                  max 260px width, 50vh height) so it stays within the viewport and doesn&apos;t overflow; text wraps
                  with <code className="bg-white/10 px-1 rounded">break-words</code>.
                </p>
              </DocSection>

              <DocSection id="agora-reports" title="Reports & Moderation">
                <p>
                  Users can report casts or users for violating guidelines. Reports are stored and visible to admins.
                  Admin panel allows reviewing reports, hiding content, or taking action on users. Moderation
                  protects the community while keeping workflows in-app.
                </p>
              </DocSection>

              {/* ChainLens */}
              <DocSection id="chainlens-overview" title="Wallet Intelligence">
                <p>
                  <strong>What it does:</strong> ChainLens provides on-chain wallet intelligence for any Ethereum-style
                  address. You enter a wallet address (yours or another) and receive a detailed report: portfolio value,
                  token holdings, NFTs, recent transactions, activity timeline, and a &quot;Degen Score&quot; label.
                </p>
                <p>
                  <strong>How it works:</strong> The backend uses the Moralis API to fetch (in parallel): native + ERC20
                  token balances with USD prices, native transactions, ERC20 transfers, native balance, and NFTs. Data
                  is aggregated into: net worth in USD, top holdings by value, portfolio allocation (pie chart data),
                  activity-by-day (last 30 days), a transaction timeline (sends/receives, buys/sells), and NFT listings
                  with floor prices. The Degen Score is computed from transaction count and unique token count:
                  &quot;Paper Hands&quot; (low activity), &quot;Diamond Hands&quot; (steady), or &quot;DeFi Scientist&quot; (high activity).
                  Supported chains: Ethereum, Polygon, BSC, Avalanche, Arbitrum, Optimism, Base. Results are cached;
                  repeat lookups for the same address+chain return cached data and cost 0 loyalty points.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Research wallets before engaging (e.g. tips, partnerships),
                  track your own portfolio, or quickly assess whale activity. Requires linking a wallet in Profile and
                  spending 10 loyalty points per fresh insight. Set <code className="bg-white/10 px-1 rounded">MORALIS_API_KEY</code> in the backend.
                </p>
              </DocSection>

              {/* Trendcraft */}
              <DocSection id="trendcraft-overview" title="Trends Feed">
                <p>
                  <strong>What it does:</strong> Trendcraft aggregates trending content from multiple sources into one
                  feed. You can browse a combined feed or filter by source (YouTube, Reddit, Hacker News, News).
                </p>
                <p>
                  <strong>How it works:</strong> The backend fetches in parallel from: YouTube (trending/popular videos,
                  search by query, order by viewCount/relevance/date), Reddit (hot posts from any subreddit, default
                  r/all), Hacker News (top/best/new stories), and NewsAPI (headlines by country, category, keyword).
                  Results are merged, sorted by publish date, and cached. The feed supports query params:
                  <code className="bg-white/10 px-1 rounded ml-1">sources</code>, <code className="bg-white/10 px-1 rounded">limit</code>,
                  <code className="bg-white/10 px-1 rounded ml-1">subreddit</code>, <code className="bg-white/10 px-1 rounded ml-1">country</code>,
                  <code className="bg-white/10 px-1 rounded ml-1">category</code>. Auth-based feed loading can deduct 3 loyalty points.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Discover what&apos;s trending across platforms in one place,
                  use it as input for content ideas, or stay informed without switching apps. Requires YouTube, News,
                  and Reddit API keys (or User-Agent) in the backend.
                </p>
              </DocSection>

              <DocSection id="trendcraft-generate" title="Content Generation">
                <p>
                  <strong>What it does:</strong> Generate short, trend-aware content for Agora casts. You provide a
                  keyword or content idea; the system returns AI-generated copy that leverages current trends.
                </p>
                <p>
                  <strong>How it works:</strong> The backend fetches a trending summary (titles/headlines from YouTube,
                  Reddit, Hacker News, News), then sends a prompt to Google Gemini with that summary and your input.
                  Gemini generates content under 500 characters, optimized for social sharing. A second feature,
                  <strong>Content Suggestions</strong>, returns 5 actionable post ideas (one sentence each) based on
                  trending data. Both features cost 3 loyalty points per use and require <code className="bg-white/10 px-1 rounded">GEMINI_API_KEY</code>.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Create engaging Agora posts without manually researching
                  trends. The AI ties your topic to what&apos;s hot, improving reach and relevance.
                </p>
              </DocSection>

              {/* PulseBot */}
              <DocSection id="pulsebot-overview" title="PulseBot Overview">
                <p>
                  <strong>What it does:</strong> PulseBot is a Telegram bot that links to your Pluto account. Add the
                  bot to your Telegram groups; it captures chat context. From the Pluto app, you can request AI
                  summaries of your group chats, ask questions about them, or get activity stats.
                </p>
                <p>
                  <strong>How it works:</strong> Telegram sends updates to a webhook on your backend. When the bot is
                  in a group, it stores messages (group ID, title, sender, text, timestamp) in the database. When you
                  request a summary or Q&A, the backend pulls the last 12 hours of chat from groups you participate in,
                  sends it to Google Gemini, and returns the result. Stats show message counts per group and per user.
                  Requires <code className="bg-white/10 px-1 rounded">TELEGRAM_BOT_TOKEN</code> and
                  <code className="bg-white/10 px-1 rounded ml-1">PULSEBOT_WEBHOOK_BASE_URL</code> for production.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Catch up on busy group chats without reading every message.
                  Ask &quot;What did we decide about X?&quot; and get answers grounded in your chat history. Use stats to
                  see who&apos;s most active. Costs: Summary 10 pts, Ask 10 pts, Stats 2 pts.
                </p>
              </DocSection>

              <DocSection id="pulsebot-link" title="Linking Telegram">
                <p>
                  In the Pluto PulseBot page, click &quot;Link Telegram&quot; to generate a 6-digit code valid for 10 minutes.
                  In Telegram, send <code className="bg-white/10 px-1 rounded">/link YOUR_CODE</code> to @Pluto_PulseBot.
                  The bot links your Telegram user to your Pluto account. Add the bot to your groups as a member;
                  it will capture messages only when it has access. For local development, expose your backend via
                  ngrok and call <code className="bg-white/10 px-1 rounded">GET /api/pulsebot/set-webhook</code> once.
                </p>
              </DocSection>

              <DocSection id="pulsebot-features" title="Summaries & Q&A">
                <p>
                  <strong>Summary:</strong> Generates a concise summary of your group chats in the last 12 hours (main
                  topics, decisions, notable points) using Gemini. Costs 10 loyalty points.
                </p>
                <p>
                  <strong>Ask:</strong> Ask a question; the AI answers based only on the chat transcript. If the answer
                  isn&apos;t in the context, it says so. Results are cached per question+context hash to avoid duplicate
                  charges. Costs 10 loyalty points per new query.
                </p>
                <p>
                  <strong>Stats:</strong> Returns message counts per group and top participants (last 12 hours). No AI;
                  costs 2 loyalty points.
                </p>
              </DocSection>

              <DocSection id="pulsebot-gmail" title="Gmail & Scheduled Emails">
                <p>
                  <strong>What it does:</strong> On the PulseBot page, after connecting Gmail (OAuth), you can sync your
                  inbox, see AI-generated &quot;email tasks&quot; (e.g. replies needed), get a Gmail digest (unread count,
                  threads, top senders), and schedule emails to be sent later.
                </p>
                <p>
                  <strong>Email tasks:</strong> The backend lists emails that may need a reply; each task can be opened
                  to view the email and get an AI-suggested reply (costs loyalty). You can edit and send the reply from
                  the app. The list-tasks result is cached by user and email IDs (e.g. 1 hour TTL) so repeated views
                  don&apos;t trigger extra AI calls.
                </p>
                <p>
                  <strong>Scheduled emails:</strong> Compose an email (to, subject, body), pick a date/time, and submit.
                  The backend stores it; a cron job (e.g. every minute) sends scheduled emails when the time is due.
                  You can list pending and recently sent items (sent items are only shown for 24 hours), and edit or
                  delete pending ones.
                </p>
                <p>
                  <strong>API:</strong> Under <code className="bg-white/10 px-1 rounded">/api/email-integration</code>:
                  status, Gmail OAuth, sync, tasks, digest, scheduled CRUD, suggest-reply, send-reply.
                </p>
              </DocSection>

              {/* Responsive & Mobile UI */}
              <DocSection id="responsive-navbar" title="Navbar & Mobile Menu">
                <p>
                  On small screens (below the <code className="bg-white/10 px-1 rounded">sm</code> breakpoint), the main
                  nav links (Campquest, Agora, ChainLens, Trendcraft, PulseBot) are hidden. A hamburger button opens a
                  full-width overlay menu with those links and Log out. The notifications bell and profile avatar remain
                  in the header. Safe-area insets and touch-friendly targets (min 44px) are used for notched devices
                  and tap accuracy.
                </p>
              </DocSection>

              <DocSection id="responsive-agora" title="Agora Mobile">
                <p>
                  On viewports below <code className="bg-white/10 px-1 rounded">lg</code>, the Agora sidebar is hidden.
                  A fixed bottom navigation bar appears with Feed, Alerts, Notifications, Messages, Tips, Create Cast,
                  and Profile so users can navigate Agora on mobile without the sidebar. The main content area is
                  full-width and scrollable.
                </p>
              </DocSection>

              <DocSection id="responsive-notifications" title="Notifications Panel">
                <p>
                  The notification dropdown (navbar bell) is responsive: on mobile it uses a smaller max width (e.g.
                  260px) and max height (50vh) so it doesn&apos;t overflow or cross the left edge of the screen. Text
                  wraps with <code className="bg-white/10 px-1 rounded">break-words</code>; the panel is constrained to
                  the viewport with <code className="bg-white/10 px-1 rounded">min-w-0</code> and overflow handling.
                </p>
              </DocSection>

              <DocSection id="responsive-landing-docs" title="Landing & Docs">
                <p>
                  <strong>Landing:</strong> Feature cards grow with content so &quot;Try Agora&quot;, &quot;Try Campquest&quot;, etc.
                  are always visible; CTA links are styled as clear, tappable buttons. The page uses
                  <code className="bg-white/10 px-1 rounded ml-1">overflow-x-hidden</code> to avoid horizontal scroll.
                </p>
                <p>
                  <strong>Docs:</strong> The documentation page uses <code className="bg-white/10 px-1 rounded">overflow-x-hidden</code> and
                  constrains the sidebar width on large screens. On mobile, the sidebar is hidden and a dropdown at the
                  top lets you jump to any section. The main content area has <code className="bg-white/10 px-1 rounded">min-w-0</code> and
                  overflow handling so long code blocks don&apos;t cause horizontal overflow.
                </p>
              </DocSection>

              {/* Wallet */}
              <DocSection id="wallet" title="Wallet">
                <p>
                  <strong>What it does:</strong> Displays your loyalty balance and transaction history (earns and spends).
                </p>
                <p>
                  <strong>How it works:</strong> Fetches loyalty transactions from the backend, grouped by type
                  (daily_claim, quest_completion, referral, feature_use, tip_sent, tip_received, etc.). The Buy
                  Loyalty button triggers the mock purchase flow: connect wallet via RainbowKit, pick amount
                  (10–10,000 pts), backend credits your account.
                </p>
                <p>
                  <strong>Why it&apos;s useful:</strong> Transparency: see exactly how you earned and spent points.
                  Mock buy enables testing without grinding quests.
                </p>
              </DocSection>

              {/* Daily Rewards */}
              <DocSection id="daily-rewards" title="Daily Rewards">
                <p>
                  Same as Daily Claim. Points scale by streak: Day 1 = 10, Day 2 = 20, …, Day 7 = 70. Claim within
                  24h to advance; wait 48h+ and the streak resets to 1. The modal displays streak, next claim time,
                  and points for the next claim.
                </p>
              </DocSection>

              {/* Privacy, Terms & Feedback */}
              <DocSection id="privacy-terms" title="Privacy & Terms">
                <p>
                  <strong>Privacy Policy</strong> describes what data Pluto collects (account, profile, engagement,
                  wallet/Twitter if linked) and how it is used and stored. Linked from the footer.
                </p>
                <p>
                  <strong>Terms of Service</strong> define user obligations, acceptable use, and platform rules.
                  Accessible from the footer.
                </p>
              </DocSection>

              <DocSection id="feedback" title="Feedback Form">
                <p>
                  Users submit feedback (text) via a form on the landing page or dedicated section. The backend
                  stores it; admins can review feedback for product improvements and support.
                </p>
              </DocSection>

              {/* User Flows */}
              <DocSection id="user-flows" title="User Flows">
                <DocSubSection title="New user signup">
                  <p>Sign up → verify email (if applicable) → claim daily → explore campaigns → complete quests.</p>
                </DocSubSection>
                <DocSubSection title="Quest completion">
                  <p>Open campaign → pick quest → perform action (follow, retweet, like cast, etc.) → click Verify → receive points.</p>
                </DocSubSection>
                <DocSubSection title="Campaign creation">
                  <p>Create campaign (100 pts) → add quests (50 pts each) → publish → users complete quests.</p>
                </DocSubSection>
                <DocSubSection title="Agora engagement">
                  <p>Post cast → get likes/replies → receive tips → chat via DMs.</p>
                </DocSubSection>
              </DocSection>

              {/* Technical Overview */}
              <DocSection id="technical" title="Technical Overview">
                <DocSubSection title="Frontend">
                  <p>React + Vite, Tailwind CSS, React Router, Framer Motion. State: AuthContext, local state. Socket.IO for real-time.</p>
                </DocSubSection>
                <DocSubSection title="Backend">
                  <p>Node.js + Express, MongoDB, Mongoose. JWT auth. REST API + Socket.IO. RapidAPI for Twitter verification.</p>
                </DocSubSection>
                <DocSubSection title="API">
                  <p>REST endpoints for auth, users, campaigns, quests, Agora (casts, likes, tips, DMs), ChainLens, Trendcraft, PulseBot.</p>
                </DocSubSection>
              </DocSection>

              {/* Glossary */}
              <DocSection id="glossary" title="Glossary">
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><strong>Cast</strong> — A short post in Agora (like a tweet)</li>
                  <li><strong>Campaign</strong> — Collection of quests created by a creator</li>
                  <li><strong>Quest</strong> — Task to complete for loyalty points (follow, retweet, like cast, etc.)</li>
                  <li><strong>Loyalty points</strong> — In-app currency</li>
                  <li><strong>Agora</strong> — Pluto&apos;s social feed</li>
                  <li><strong>ChainLens</strong> — Wallet intelligence via Moralis</li>
                  <li><strong>Trendcraft</strong> — Trends feed and AI content generation</li>
                  <li><strong>PulseBot</strong> — Telegram bot for summaries and Q&A</li>
                  <li><strong>Cast Picker</strong> — Dropdown to select an Agora cast when adding like/comment/bookmark quests</li>
                  <li><strong>Required link</strong> — Field for Twitter handle, tweet URL, or Agora cast ID; empty = follow campaign creator</li>
                </ul>
              </DocSection>

              {/* Environment */}
              <DocSection id="env-variables" title="Environment Variables">
                <p><strong>Frontend (.env):</strong></p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><code className="bg-white/10 px-1 rounded">VITE_API_BASE_URL</code> — Backend URL (e.g. http://localhost:5000)</li>
                  <li><code className="bg-white/10 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> — Google OAuth client ID</li>
                  <li><code className="bg-white/10 px-1 rounded">VITE_WALLETCONNECT_PROJECT_ID</code> — WalletConnect for RainbowKit</li>
                </ul>
                <p className="mt-4"><strong>Backend (.env):</strong></p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><code className="bg-white/10 px-1 rounded">MONGO_URI</code>, <code className="bg-white/10 px-1 rounded">JWT_SECRET</code> — Required</li>
                  <li><code className="bg-white/10 px-1 rounded">RAPIDAPI_KEY</code> — Twitter quest verification</li>
                  <li><code className="bg-white/10 px-1 rounded">MORALIS_API_KEY</code> — ChainLens</li>
                  <li><code className="bg-white/10 px-1 rounded">GEMINI_API_KEY</code>, <code className="bg-white/10 px-1 rounded">YOUTUBE_API_KEY</code>, <code className="bg-white/10 px-1 rounded">NEWS_API_KEY</code> — Trendcraft</li>
                  <li><code className="bg-white/10 px-1 rounded">TELEGRAM_BOT_TOKEN</code>, <code className="bg-white/10 px-1 rounded">PULSEBOT_WEBHOOK_BASE_URL</code> — PulseBot</li>
                  <li>Gmail (email integration) — Google OAuth; use <code className="bg-white/10 px-1 rounded">GOOGLE_CLIENT_ID</code> with Gmail scopes and redirect URI for <code className="bg-white/10 px-1 rounded">/api/email-integration/gmail/callback</code></li>
                </ul>
              </DocSection>

              <div className="mt-16 pt-8 border-t border-white/10">
                <p className="text-slate-500 text-sm">
                  Need help? Use the Feedback section on the landing page or reach out through the contact details
                  in our Terms of Service.
                </p>
              </div>
            </motion.div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}
