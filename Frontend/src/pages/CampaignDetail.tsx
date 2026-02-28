import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import AddQuestModal from '../components/campaigns/AddQuestModal'
import VerifyQuestModal from '../components/campaigns/VerifyQuestModal'
import Campquest3DScene from '../components/campaigns/Campquest3DScene'
import { useAuth } from '../context/AuthContext'
import { usePointsDeduction, PointsDeductionBadge } from '../hooks/usePointsDeduction'
import {
  getCampaign,
  updateCampaign,
  deleteCampaign,
  addQuestToCampaign,
  updateQuest,
  deleteQuest,
  verifyQuest,
  type CampaignDetail as CampaignDetailType,
  type CampaignQuest,
  QUEST_TYPES,
  QUEST_COMPLETION_REWARD_POINTS,
  COST_QUEST_ADD,
} from '../lib/api'

const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.08 } } }
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

function statusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    case 'expired': return 'bg-red-500/20 text-red-400 border-red-500/40'
    case 'draft': return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    default: return 'bg-white/10 text-white/70 border-white/20'
  }
}

function questTypeLabel(type: string) {
  return QUEST_TYPES.find((t) => t.value === type)?.label ?? type
}

const AGORA_CAST_QUEST_TYPES = ['agora_like_post', 'agora_comment', 'agora_bookmark_post']
/** MongoDB ObjectId is 24 hex chars. */
function looksLikeObjectId(s: string) {
  return /^[a-f0-9]{24}$/i.test(String(s).trim())
}

/** Resolve display link for a quest so users can open the right user/cast in Agora. */
function getQuestDisplayLink(
  quest: CampaignQuest,
  campaignOwnerId: string | undefined
): { internal: true; to: string; label: string } | { internal: false; href: string; label: string } {
  const link = (quest.requiredLink || '').trim()
  const isAgoraFollowCreator = quest.type === 'agora_follow' && (link === '' || link === 'campaign_creator')
  const isAgoraCastQuest = AGORA_CAST_QUEST_TYPES.includes(quest.type)

  if (isAgoraFollowCreator && campaignOwnerId) {
    return { internal: true, to: `/agora/user/${campaignOwnerId}`, label: "Campaign creator's profile" }
  }
  if (isAgoraCastQuest && link && looksLikeObjectId(link)) {
    return { internal: true, to: `/agora/thread/${link}`, label: 'View cast' }
  }
  if (link.startsWith('http://') || link.startsWith('https://')) {
    return { internal: false, href: link, label: link.length > 50 ? link.slice(0, 47) + '…' : link }
  }
  return { internal: false, href: link || '#', label: link || '—' }
}

function formatDate(s: string | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn, user, token: authToken } = useAuth()
  const pointsDeductedHandled = useRef(false)
  const [campaign, setCampaign] = useState<CampaignDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addQuestOpen, setAddQuestOpen] = useState(false)
  const [addQuestLoading, setAddQuestLoading] = useState(false)
  const [addQuestError, setAddQuestError] = useState<string | null>(null)
  const [verifyQuestItem, setVerifyQuestItem] = useState<CampaignQuest | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [completedQuestIds, setCompletedQuestIds] = useState<string[]>([])
  const { displayedPoints, pointsDeduction, triggerDeduction } = usePointsDeduction()

  function refetch() {
    if (!id) return
    getCampaign(id, token).then((res) => {
      if (res.success && res.data?.campaign) {
        setCampaign(res.data.campaign)
        setCompletedQuestIds(res.data.completedQuestIds ?? [])
      }
      setLoading(false)
      if (!res.success) setError(res.message ?? 'Failed to load campaign')
    })
  }

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    if (!id) {
      navigate('/campaigns', { replace: true })
      return
    }
    refetch()
  }, [id, isLoggedIn, navigate])

  const state = location.state as { pointsDeducted?: { newBalance: number; amount: number } } | undefined
  useEffect(() => {
    if (state?.pointsDeducted && !pointsDeductedHandled.current) {
      pointsDeductedHandled.current = true
      triggerDeduction(state.pointsDeducted.newBalance, state.pointsDeducted.amount)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [state?.pointsDeducted, triggerDeduction, navigate, location.pathname])

  const token = authToken ?? null
  const isOwner = campaign && user?.id && (campaign.owner as { _id?: string })?._id === user.id

  async function handleAddQuest(body: { title: string; description: string; requiredLink: string; type: string }) {
    if (!token || !id) return
    setAddQuestError(null)
    setAddQuestLoading(true)
    const res = await addQuestToCampaign(token, id, body)
    setAddQuestLoading(false)
    if (res.success && res.data?.quest) {
      setAddQuestOpen(false)
      const newQuest = res.data.quest
      if (res.data.newBalance != null) triggerDeduction(res.data.newBalance, COST_QUEST_ADD)
      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              quests: [...(Array.isArray(prev.quests) ? prev.quests : []), newQuest],
            }
          : null
      )
      refetch()
    } else {
      setAddQuestError(res.message ?? 'Failed to add quest')
    }
  }

  async function handleVerify(tweetUrl?: string) {
    if (!token || !verifyQuestItem) return
    setVerifyError(null)
    setVerifyLoading(true)
    const res = await verifyQuest(token, verifyQuestItem._id, tweetUrl)
    setVerifyLoading(false)
    if (res.success) {
      setVerifyQuestItem(null)
      refetch()
    } else {
      setVerifyError(res.message ?? 'Verification failed')
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    if (!token || !id || !campaign) return
    const res = await updateCampaign(token, id, { status: newStatus as 'active' | 'expired' | 'draft' })
    if (res.success && res.data?.campaign) {
      setCampaign((prev) => (prev ? { ...prev, status: res.data!.campaign.status } : null))
      setEditStatus(null)
    }
  }

  async function handleDelete() {
    if (!token || !id) return
    setDeleteLoading(true)
    const res = await deleteCampaign(token, id)
    setDeleteLoading(false)
    if (res.success) {
      navigate('/campaigns', { replace: true })
    }
  }

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden overflow-y-auto">
        <div className="fixed inset-0 z-0">
          <Campquest3DScene background />
        </div>
        <div className="fixed inset-0 z-[1] pointer-events-none bg-[#0a0a0f]/80" />
        <Navbar />
        <div className="pt-24 pb-16 px-4 flex justify-center items-center min-h-[50vh] relative z-10">
          {error ? (
            <p className="text-red-400">{error}</p>
          ) : (
            <div className="w-10 h-10 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin" />
          )}
        </div>
      </div>
    )
  }

  const quests = campaign.quests ?? []
  const participants = Array.isArray(campaign.participants) ? campaign.participants : []
  const campaignOwnerId = campaign?.owner
    ? (typeof campaign.owner === 'object' && campaign.owner && '_id' in campaign.owner
        ? (campaign.owner as { _id: string })._id
        : String(campaign.owner))
    : undefined
  const owner = typeof campaign.owner === 'object' && campaign.owner ? campaign.owner : null

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden overflow-y-auto">
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
          className="relative max-w-4xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={container}
        >
          <motion.div variants={item} className="mb-6 flex flex-wrap items-center gap-3">
            <Link
              to="/campaigns"
              className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-amber-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to campaigns
            </Link>
            {isLoggedIn && (
              <PointsDeductionBadge displayedPoints={displayedPoints} pointsDeduction={pointsDeduction} />
            )}
          </motion.div>

          {/* Campaign header — gamified card with gradient border and glass */}
          <motion.div
            variants={item}
            className="group/card relative rounded-2xl mb-6 overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_40px_-8px_rgba(251,191,36,0.25)]"
          >
            <div
              className="absolute inset-0 rounded-2xl opacity-[0.35] group-hover/card:opacity-100 transition-opacity duration-500 group-hover/card:animate-[campquest-spin_2s_linear_infinite] z-0"
              style={{
                background: 'conic-gradient(from 0deg, #f59e0b, #06b6d4, #8b5cf6, #ec4899, #22c55e, #f59e0b)',
              }}
              aria-hidden
            />
            <div className="relative z-10 m-[2px] rounded-[14px] border border-white/15 bg-gradient-to-b from-[#0f172a] to-[#0a0f1a] backdrop-blur-xl p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-white via-amber-50 to-cyan-100 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(251,191,36,0.2)]">
                  {campaign.name}
                </h1>
                <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-2xl">{campaign.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider border shadow-sm ${statusColor(campaign.status)}`}>
                  {campaign.status}
                </span>
                {isOwner && (
                  <>
                    {editStatus === null ? (
                      <button
                        type="button"
                        onClick={() => setEditStatus(campaign.status)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium border border-white/25 text-white/80 hover:bg-white/10 hover:border-white/30 transition-all"
                      >
                        Edit status
                      </button>
                    ) : (
                      <div className="flex gap-1">
                        {(['active', 'draft', 'expired'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleUpdateStatus(s)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium ${editStatus === s ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0f172a]' : ''} ${statusColor(s)}`}
                          >
                            {s}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditStatus(null)}
                          className="px-2 py-1 rounded-lg text-xs text-white/60 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm pt-4 border-t border-white/10">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90">
                <svg className="w-4 h-4 text-amber-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {quests.length} quest{quests.length !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300/90">
                <svg className="w-4 h-4 text-cyan-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
              {campaign.expiryDate && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Expires {formatDate(campaign.expiryDate)}
                </span>
              )}
              {owner && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/50">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500/30 to-cyan-500/30 flex items-center justify-center text-xs font-bold text-amber-200/90">
                    {(owner.username ?? owner.email ?? '?').charAt(0).toUpperCase()}
                  </span>
                  by {owner.username ?? owner.email ?? 'Unknown'}
                </span>
              )}
            </div>
            {isOwner && (
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAddQuestOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/35 transition-all duration-200 ring-2 ring-amber-400/20 hover:ring-amber-400/40"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add quest ({COST_QUEST_ADD} pts)
                </button>
                {!deleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="px-4 py-2.5 rounded-xl font-medium text-red-400/90 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                  >
                    Delete campaign
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">Delete this campaign?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {deleteLoading ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          </motion.div>

          {/* Quests */}
          <motion.div variants={item}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 bg-gradient-to-r from-amber-400 to-cyan-400 bg-clip-text text-transparent">
              <svg className="w-5 h-5 text-amber-500/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Quests
            </h2>
            {quests.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900/60 to-slate-900/40 p-10 text-center backdrop-blur-md shadow-inner ring-1 ring-white/5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-amber-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-white/60 font-medium mb-1">No quests yet.</p>
                <p className="text-white/45 text-sm mb-5">Add a quest to let users earn points when they complete it.</p>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setAddQuestOpen(true)}
                    className="text-amber-400 hover:text-amber-300 font-semibold px-4 py-2 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 transition-colors"
                  >
                    Add the first quest
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {quests.map((q) => (
                    <motion.div
                      key={q._id}
                      layout
                      variants={item}
                      className="group/quest relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_30px_-6px_rgba(6,182,212,0.2)]"
                    >
                      {/* Animated gradient border on hover */}
                      <div
                        className="absolute inset-0 rounded-2xl opacity-[0.3] group-hover/quest:opacity-100 transition-opacity duration-500 group-hover/quest:animate-[campquest-spin_2s_linear_infinite] z-0"
                        style={{
                          background: 'conic-gradient(from 0deg, #f59e0b, #06b6d4, #8b5cf6, #ec4899, #22c55e, #f59e0b)',
                        }}
                        aria-hidden
                      />
                      <div className="relative z-10 m-[2px] rounded-[14px] border border-white/15 bg-gradient-to-b from-[#0f172a] to-[#0c1220] backdrop-blur-md p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 group-hover/quest:border-cyan-500/20 transition-all duration-300 flex">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 flex-1 min-w-0">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-white mb-1.5 tracking-tight group-hover/quest:text-amber-50 transition-colors">{q.title}</h3>
                          <p className="text-white/60 text-sm mb-3 leading-relaxed">{q.description}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-cyan-500/20 text-amber-300 border border-amber-500/30 shadow-sm">
                              {questTypeLabel(q.type)}
                            </span>
                            {(() => {
                              const display = getQuestDisplayLink(q, campaignOwnerId)
                              const linkClass = 'inline-flex items-center gap-1.5 text-xs text-amber-400/80 hover:text-amber-400 truncate max-w-[220px]'
                              const arrowIcon = (
                                <svg className="w-3.5 h-3.5 shrink-0 text-amber-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                              )
                              return display.internal ? (
                                <Link
                                  to={display.to}
                                  className={linkClass}
                                  title="Opens in Agora"
                                >
                                  <span className="truncate">{display.label}</span>
                                  {arrowIcon}
                                </Link>
                              ) : (
                                <a
                                  href={display.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={linkClass}
                                  title="Opens in new tab"
                                >
                                  <span className="truncate">{display.label}</span>
                                  <svg className="w-3.5 h-3.5 shrink-0 text-amber-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )
                            })()}
                          </div>
                          <p className="inline-flex items-center gap-1.5 text-xs font-medium mt-2 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300/90">
                            <svg className="w-3.5 h-3.5 text-emerald-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            +{QUEST_COMPLETION_REWARD_POINTS} pts on completion
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {campaign.status === 'active' && (
                            (() => {
                              const isCompleted = completedQuestIds.includes(q._id)
                              const isVerifying = verifyLoading && verifyQuestItem?._id === q._id
                              if (isCompleted) {
                                return (
                                  <button
                                    type="button"
                                    disabled
                                    className="px-4 py-2.5 rounded-xl font-semibold text-emerald-300 bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border border-emerald-500/40 cursor-default inline-flex items-center gap-2 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/20"
                                  >
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Verified
                                  </button>
                                )
                              }
                              if (isVerifying) {
                                return (
                                  <button
                                    type="button"
                                    disabled
                                    className="px-4 py-2.5 rounded-xl font-medium text-white/80 bg-white/10 border border-white/20 cursor-wait inline-flex items-center gap-2"
                                  >
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Verifying…
                                  </button>
                                )
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={() => { setVerifyQuestItem(q); setVerifyError(null) }}
                                  className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 transition-all duration-200 ring-2 ring-emerald-400/25 hover:ring-emerald-400/50"
                                >
                                  Verify
                                </button>
                              )
                            })()
                          )}
                          {isOwner && (
                            <QuestActions token={token!} quest={q} onUpdated={refetch} />
                          )}
                        </div>
                      </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      <AddQuestModal
        open={addQuestOpen}
        onClose={() => { setAddQuestOpen(false); setAddQuestError(null) }}
        onSubmit={handleAddQuest}
        loading={addQuestLoading}
        error={addQuestError}
        campaignOwnerId={
          campaign?.owner
            ? (typeof campaign.owner === 'object' && campaign.owner && '_id' in campaign.owner
                ? (campaign.owner as { _id: string })._id
                : String(campaign.owner))
            : undefined
        }
        token={token}
      />

      <VerifyQuestModal
        open={!!verifyQuestItem}
        onClose={() => { setVerifyQuestItem(null); setVerifyError(null) }}
        quest={verifyQuestItem}
        onVerify={handleVerify}
        loading={verifyLoading}
        error={verifyError}
      />
    </div>
  )
}

function QuestActions({
  token,
  quest,
  onUpdated,
}: {
  token: string
  quest: CampaignQuest
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [title, setTitle] = useState(quest.title)
  const [description, setDescription] = useState(quest.description)
  const [requiredLink, setRequiredLink] = useState(quest.requiredLink)
  const [type, setType] = useState(quest.type)
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleSave() {
    setSaveLoading(true)
    const res = await updateQuest(token, quest._id, { title, description, requiredLink, type })
    setSaveLoading(false)
    if (res.success) {
      setEditing(false)
      onUpdated()
    }
  }

  async function handleDelete() {
    if (!confirm('Remove this quest from the campaign?')) return
    setDeleteLoading(true)
    const res = await deleteQuest(token, quest._id)
    setDeleteLoading(false)
    if (res.success) onUpdated()
    setDeleting(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 w-full sm:w-auto">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white w-full"
          placeholder="Title"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white w-full resize-none"
          placeholder="Description"
        />
        <input
          value={requiredLink}
          onChange={(e) => setRequiredLink(e.target.value)}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white w-full"
          placeholder="Required link"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white w-full"
        >
          {QUEST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex-1 py-2 rounded-lg text-sm text-white/70 bg-white/10 hover:bg-white/15"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveLoading}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-amber-500/80 hover:bg-amber-500 disabled:opacity-50"
          >
            {saveLoading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Edit quest"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      {!deleting ? (
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className="p-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          aria-label="Delete quest"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      ) : (
        <>
          <span className="text-xs text-white/50">Delete?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading}
            className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
          >
            {deleteLoading ? '…' : 'Yes'}
          </button>
          <button
            type="button"
            onClick={() => setDeleting(false)}
            className="px-2 py-1 rounded text-xs text-white/60 hover:text-white"
          >
            No
          </button>
        </>
      )}
    </div>
  )
}
