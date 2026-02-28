import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import CreateCampaignModal from '../components/campaigns/CreateCampaignModal'
import Campquest3DScene from '../components/campaigns/Campquest3DScene'
import { useAuth } from '../context/AuthContext'
import { usePointsDeduction, PointsDeductionBadge } from '../hooks/usePointsDeduction'
import {
  listCampaigns,
  createCampaign,
  type CampaignListItem,
  COST_CAMPAIGN_CREATE,
} from '../lib/api'

const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

function statusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    case 'expired':
      return 'bg-red-500/20 text-red-400 border-red-500/40'
    case 'draft':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    default:
      return 'bg-white/10 text-white/70 border-white/20'
  }
}

function formatDate(s: string | undefined) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Campaigns() {
  const { isLoggedIn, user, token } = useAuth()
  const navigate = useNavigate()
  const { displayedPoints, pointsDeduction } = usePointsDeduction()
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    let cancelled = false
    setListError(null)
    setLoading(true)
    const ownerId = filter === 'mine' && user?.id ? user.id : undefined
    listCampaigns(ownerId)
      .then((res) => {
        if (cancelled) return
        if (res.success && Array.isArray(res.data?.campaigns)) {
          setCampaigns(res.data.campaigns)
          setListError(null)
        } else {
          setCampaigns([])
          setListError(res.message ?? 'Could not load campaigns')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setCampaigns([])
        setListError(err?.message ?? 'Could not load campaigns')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [isLoggedIn, filter, user?.id])

  async function handleCreate(body: { name: string; description: string; expiryDays?: number }) {
    if (!token) return
    setCreateError(null)
    setCreateLoading(true)
    const res = await createCampaign(token, body)
    setCreateLoading(false)
    if (res.success && res.data?.campaign) {
      setCreateOpen(false)
      setCampaigns((prev) => [res.data!.campaign, ...prev])
      const newBalance = res.data.newBalance
      navigate(`/campaigns/${res.data.campaign._id}`, {
        state: newBalance != null ? { pointsDeducted: { newBalance, amount: COST_CAMPAIGN_CREATE } } : undefined,
      })
    } else {
      setCreateError(res.message ?? 'Failed to create campaign')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden overflow-y-auto">
      {/* 3D gamezone background */}
      <div className="fixed inset-0 z-0">
        <Campquest3DScene background />
      </div>
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,10,15,0.88) 0%, rgba(10,10,15,0.75) 40%, rgba(10,10,15,0.85) 100%)',
        }}
      />
      <Navbar />
      <div className="pt-24 pb-16 px-4 relative z-10">

        <motion.div
          className="relative max-w-5xl mx-auto z-10"
          initial="visible"
          animate="visible"
          variants={container}
        >
          <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-1 bg-gradient-to-r from-amber-400 via-orange-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                Campaigns & Quests
              </h1>
              <p className="text-white/60 text-sm flex items-center gap-2 flex-wrap">
                Create campaigns, add quests, and earn loyalty points when you complete them.
                {isLoggedIn && (
                  <span className="inline-flex items-center gap-1.5">
                    <PointsDeductionBadge displayedPoints={displayedPoints} pointsDeduction={pointsDeduction} />
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'all' ? 'bg-amber-500/20 text-amber-400' : 'text-white/60 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('mine')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'mine' ? 'bg-amber-500/20 text-amber-400' : 'text-white/60 hover:text-white'
                  }`}
                >
                  My campaigns
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create campaign
              </button>
            </div>
          </motion.div>

          {listError && !loading && (
            <motion.div
              variants={item}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center"
            >
              <p className="text-red-400 mb-2">{listError}</p>
              <p className="text-white/60 text-sm mb-4">
                Ensure the backend is running and <code className="text-amber-400/90">VITE_API_BASE_URL</code> is set (e.g. http://localhost:5000).
              </p>
              <button
                type="button"
                onClick={() => {
                  setListError(null)
                  setLoading(true)
                  const ownerId = filter === 'mine' && user?.id ? user.id : undefined
                  listCampaigns(ownerId)
                    .then((res) => {
                      if (res.success && Array.isArray(res.data?.campaigns)) {
                        setCampaigns(res.data.campaigns)
                        setListError(null)
                      } else {
                        setCampaigns([])
                        setListError(res.message ?? 'Could not load campaigns')
                      }
                    })
                    .catch((err) => {
                      setCampaigns([])
                      setListError(err?.message ?? 'Could not load campaigns')
                    })
                    .finally(() => setLoading(false))
                }}
                className="px-4 py-2 rounded-xl font-medium text-white bg-amber-500/80 hover:bg-amber-500 transition-colors"
              >
                Retry
              </button>
            </motion.div>
          )}

          {loading ? (
            <motion.div variants={item} className="flex justify-center py-16">
              <div className="w-10 h-10 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin" />
            </motion.div>
          ) : !listError && campaigns.length === 0 ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900/60 to-slate-900/40 backdrop-blur-md p-12 text-center shadow-inner ring-1 ring-white/5"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/25 flex items-center justify-center mx-auto mb-5 shadow-lg">
                <svg className="w-10 h-10 text-amber-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-white/70 font-medium mb-1">
                {filter === 'mine' ? "You haven't created any campaigns yet." : 'No campaigns yet.'}
              </p>
              <p className="text-white/50 text-sm mb-5">
                {filter === 'mine'
                  ? 'Create a campaign to get started, then add quests for your community.'
                  : 'Create a campaign to get started and add quests for users to complete.'}
              </p>
              {filter === 'mine' && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/15 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create your first campaign ({COST_CAMPAIGN_CREATE} pts)
                </button>
              )}
            </motion.div>
          ) : !listError ? (
            <motion.div
              variants={container}
              initial="visible"
              animate="visible"
              className="grid gap-4 sm:grid-cols-2 relative z-10"
            >
              <AnimatePresence mode="popLayout">
                {campaigns.map((c) => {
                  const questCount = Array.isArray(c.quests) ? c.quests.length : 0
                  const participantCount = Array.isArray(c.participants) ? c.participants.length : 0
                  const owner = typeof c.owner === 'object' && c.owner ? c.owner : null
                  return (
                    <motion.div
                      key={c._id}
                      layout
                      variants={item}
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group/card h-full"
                    >
                      <Link
                        to={`/campaigns/${c._id}`}
                        className="block h-full relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_-8px_rgba(251,191,36,0.2)] active:scale-[0.99]"
                      >
                        {/* Animated gradient border — subtle by default, full on hover */}
                        <div
                          className="absolute inset-0 rounded-2xl opacity-[0.4] group-hover/card:opacity-100 transition-opacity duration-500 group-hover/card:animate-[campquest-spin_2s_linear_infinite] z-0"
                          style={{
                            background: 'conic-gradient(from 0deg, #f59e0b, #06b6d4, #8b5cf6, #ec4899, #22c55e, #f59e0b)',
                          }}
                          aria-hidden
                        />
                        <div className="relative z-10 h-full flex flex-col m-[2px] rounded-[14px] bg-gradient-to-b from-[#0f172a] to-[#0a0f1a] border border-white/15 group-hover/card:border-amber-500/25 backdrop-blur-md p-5 shadow-xl shadow-black/25 ring-1 ring-white/5 transition-all duration-300">
                          <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <h2 className="text-lg font-bold text-white group-hover/card:text-transparent group-hover/card:bg-gradient-to-r group-hover/card:from-amber-100 group-hover/card:to-cyan-100 group-hover/card:bg-clip-text transition-all duration-300 line-clamp-1">
                                {c.name}
                              </h2>
                              <span
                                className={`shrink-0 px-2.5 py-1 rounded-xl text-xs font-semibold uppercase tracking-wider border shadow-sm ${statusColor(c.status)}`}
                              >
                                {c.status}
                              </span>
                            </div>
                            <p className="text-white/60 text-sm line-clamp-2 min-h-[2.5rem] mb-4 leading-relaxed">{c.description}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs mt-auto">
                              <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300/90">
                                <svg className="w-4 h-4 text-amber-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                {questCount} quest{questCount !== 1 ? 's' : ''}
                              </span>
                              <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-300/90">
                                <svg className="w-4 h-4 text-cyan-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {participantCount} participant{participantCount !== 1 ? 's' : ''}
                              </span>
                              {c.expiryDate && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Expires {formatDate(c.expiryDate)}
                                </span>
                              )}
                            </div>
                            {owner && (
                              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/30 to-cyan-500/30 flex items-center justify-center text-xs font-bold text-amber-200/90 shrink-0">
                                  {(owner.username ?? owner.email ?? '?').charAt(0).toUpperCase()}
                                </span>
                                <span className="text-xs text-white/45 truncate">by {owner.username ?? owner.email ?? 'Unknown'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </motion.div>
      </div>

      <CreateCampaignModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateError(null) }}
        onSubmit={handleCreate}
        loading={createLoading}
        error={createError}
      />
    </div>
  )
}
