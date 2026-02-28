import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'

type Feature = {
  id: string
  title: string
  description: string
  iconName: keyof typeof FeatureIcons
  gradient: string
  glowColor: string
  iconBg: string
  linkTo?: string
  linkLabel?: string
  layout: 'left' | 'right'
}

/** Unified outline-style SVG icons */
const FeatureIcons = {
  campquest: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <path d="M8 21h8M12 17v4M7 4l2 4h6l2-4M9 8v5a3 3 0 0 0 6 0V8" />
      <path d="M6 12a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2z" />
      <path d="M12 2v2M9 5l1 1M14 5l1-1" />
    </svg>
  ),
  chainlens: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  agora: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  pulsebot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <path d="M9 9h6M9 13h4M9 17h2" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" />
    </svg>
  ),
  trendcraft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M16 14h.01" />
    </svg>
  ),
  daily: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
}

const features: Feature[] = [
  {
    id: 'campquest',
    title: 'Campquest',
    description: 'Campaigns and quests in one. Join limited-time campaigns, complete quests, earn rewards, and compete on leaderboards.',
    iconName: 'campquest',
    gradient: 'from-violet-500 via-fuchsia-500 to-cyan-500',
    glowColor: 'rgba(139, 92, 246, 0.35)',
    iconBg: 'from-violet-500 via-fuchsia-500 to-cyan-500',
    linkTo: '/campaigns',
    linkLabel: 'Try Campquest',
    layout: 'left',
  },
  {
    id: 'pulsebot',
    title: 'PulseBot',
    description: 'Your AI companion for insights and automation. Link once, use everywhere.',
    iconName: 'pulsebot',
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
    glowColor: 'rgba(236, 72, 153, 0.3)',
    iconBg: 'from-rose-500 via-pink-500 to-fuchsia-500',
    linkTo: '/pulsebot',
    linkLabel: 'Try PulseBot',
    layout: 'right',
  },
  {
    id: 'chainlens',
    title: 'ChainLens',
    description: 'On-chain visibility and analytics. Track wallet activity, portfolio allocation, and degen score.',
    iconName: 'chainlens',
    gradient: 'from-indigo-500 via-blue-500 to-cyan-500',
    glowColor: 'rgba(99, 102, 241, 0.35)',
    iconBg: 'from-indigo-500 via-blue-500 to-cyan-500',
    linkTo: '/chainlens',
    linkLabel: 'Try ChainLens',
    layout: 'left',
  },
  {
    id: 'agora',
    title: 'Agora',
    description: 'Share, react, and connect. Post updates, tip creators, and join the conversation.',
    iconName: 'agora',
    gradient: 'from-cyan-500 to-teal-500',
    glowColor: 'rgba(6, 182, 212, 0.3)',
    iconBg: 'from-cyan-500 to-teal-500',
    linkTo: '/agora',
    linkLabel: 'Try Agora',
    layout: 'right',
  },
  {
    id: 'trendcraft',
    title: 'Trendcraft',
    description: "Discover what's trending across news, Reddit, and YouTube. AI-powered summaries in one place.",
    iconName: 'trendcraft',
    gradient: 'from-emerald-500 to-cyan-500',
    glowColor: 'rgba(16, 185, 129, 0.3)',
    iconBg: 'from-emerald-500 to-cyan-500',
    linkTo: '/trendcraft',
    linkLabel: 'Try Trendcraft',
    layout: 'left',
  },
  {
    id: 'wallet',
    title: 'Wallet',
    description: 'Buy loyalty points with your wallet. Connect once and top up your balance from your profile.',
    iconName: 'wallet',
    gradient: 'from-lime-500 to-emerald-500',
    glowColor: 'rgba(132, 204, 22, 0.3)',
    iconBg: 'from-lime-500 to-emerald-500',
    linkTo: '/profile',
    linkLabel: 'Go to profile',
    layout: 'right',
  },
  {
    id: 'daily',
    title: 'Daily Rewards',
    description: 'Claim your daily bonus and build streaks. Consistency pays—come back every day for bigger rewards.',
    iconName: 'daily',
    gradient: 'from-amber-500 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    iconBg: 'from-amber-500 to-orange-500',
    linkTo: '/profile',
    linkLabel: 'Go to profile',
    layout: 'left',
  },
]

const cardVariants = {
  hidden: { opacity: 0, x: 0, y: 24 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function getHiddenVariant(layout: Feature['layout']) {
  return {
    opacity: 0,
    x: layout === 'left' ? -40 : 40,
    y: 20,
  }
}

const CARD_MIN_HEIGHT = 200
const CARD_MAX_WIDTH = 640

function FeatureCard({ feature }: { feature: Feature }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const Icon = FeatureIcons[feature.iconName]
  const isLeft = feature.layout === 'left'

  return (
    <motion.div
      ref={ref}
      variants={cardVariants}
      initial={getHiddenVariant(feature.layout)}
      animate={isInView ? cardVariants.visible : getHiddenVariant(feature.layout)}
      className={`flex w-full max-w-5xl mx-auto ${isLeft ? 'justify-start' : 'justify-end'}`}
    >
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="group relative w-full rounded-2xl overflow-hidden"
        style={{
          maxWidth: CARD_MAX_WIDTH,
        }}
      >
        {/* Rotating gradient border — visible on hover */}
        <div
          className="absolute -left-1/2 -top-1/2 w-[200%] h-[200%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:animate-[spin_3s_linear_infinite]"
          style={{
            background: 'conic-gradient(from 0deg, #06b6d4, #8b5cf6, #ec4899, #22c55e, #06b6d4)',
          }}
          aria-hidden
        />
        {/* Inner card: glass panel — relative so height grows with content and links are visible */}
        <div
          className={`relative m-[3px] rounded-[13px] flex flex-col sm:flex-row items-center gap-6 sm:gap-8 p-6 sm:p-8 z-10 min-h-[200px] ${isLeft ? '' : 'sm:flex-row-reverse'}`}
          style={{
            backgroundColor: 'rgba(8, 8, 18, 0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.45), 0 0 50px -12px ${feature.glowColor}`,
          }}
        >
          {/* Top reflection line */}
          <div
            className="absolute left-0 right-0 top-0 h-px rounded-t-[13px] pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
            }}
          />
          {/* Gradient tint */}
          <div
            className={`absolute inset-0 rounded-[13px] bg-gradient-to-br ${feature.gradient} opacity-[0.08] pointer-events-none`}
            style={{ zIndex: 0 }}
          />
          {/* Icon */}
          <div
            className={`relative z-10 flex-shrink-0 w-[5.5rem] h-[5.5rem] rounded-2xl flex items-center justify-center text-white bg-gradient-to-br ${feature.iconBg} ring-2 ring-white/20`}
            style={{
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 24px -8px rgba(0,0,0,0.35), 0 0 24px -8px ${feature.glowColor}`,
            }}
          >
            {Icon}
          </div>
          {/* Content */}
          <div className={`relative z-10 flex-1 min-w-0 flex flex-col justify-center py-5 sm:py-0 ${isLeft ? 'sm:pr-2' : 'sm:pl-2'}`}>
            <h3
              className={`text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}
            >
              {feature.title}
            </h3>
            <p className="text-slate-300 leading-relaxed text-[15px] sm:text-base">{feature.description}</p>
            {feature.linkTo && feature.linkLabel && (
              <Link
                to={feature.linkTo}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors group/link w-fit min-h-[44px] px-4 py-2.5 -mx-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 items-center touch-manipulation relative z-20"
              >
                <span className="group-hover/link:border-cyan-300 transition-colors">
                  {feature.linkLabel}
                </span>
                <span className="group-hover/link:translate-x-0.5 transition-transform">→</span>
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function FeatureCards() {
  return (
    <section
      id="features"
      className="relative pt-20 pb-24 sm:pt-24 sm:pb-28 px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #050508 0%, #0a0a12 25%, #070710 50%, #080812 75%, #050508 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99, 102, 241, 0.18), transparent 55%)',
        }}
      />
      <div className="absolute top-1/4 left-0 w-[32rem] h-[32rem] bg-cyan-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-0 w-[28rem] h-[28rem] bg-violet-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto mb-20 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 tracking-tight"
        >
          Built for{' '}
          <span
            className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400"
            style={{ textShadow: '0 0 60px rgba(99, 102, 241, 0.35)' }}
          >
            players
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto"
        >
          Campquest, ChainLens, Agora, and more—each with its own vibe.
        </motion.p>
      </div>

      <div className="relative space-y-14">
        {features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>
    </section>
  )
}
