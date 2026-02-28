import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  getAgoraSentTips,
  getAgoraReceivedTips,
  type AgoraTipEntry,
} from '../lib/api'

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
}
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

function formatTimeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (sec < 60) return 'now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function TipRowSent({ tip }: { tip: AgoraTipEntry }) {
  const name = tip.recipient?.username ?? tip.recipient?.email ?? 'Someone'
  return (
    <motion.div
      variants={item}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-white/15 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">
            Tipped {name} <span className="text-amber-400">{tip.amount} pts</span>
          </p>
          <p className="text-white/60 text-sm mt-0.5">
            {tip.referenceType === 'Post' && tip.postPreview
              ? `on cast: "${tip.postPreview}${tip.postPreview.length >= 80 ? '...' : ''}"`
              : tip.referenceType === 'User'
                ? 'on profile'
                : 'on cast'}
          </p>
          <time className="text-white/40 text-xs mt-1 block" dateTime={tip.createdAt}>
            {formatTimeAgo(tip.createdAt)}
          </time>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {tip.referenceType === 'Post' && tip.postId && (
            <Link
              to={`/agora/thread/${tip.postId}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 transition-colors"
            >
              View cast
            </Link>
          )}
          {tip.recipientId && (
            <Link
              to={`/agora/user/${tip.recipientId}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/30 transition-colors"
            >
              Profile
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function TipRowReceived({ tip }: { tip: AgoraTipEntry }) {
  const name = tip.fromUser?.username ?? tip.fromUser?.email ?? 'Someone'
  return (
    <motion.div
      variants={item}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-white/15 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">
            {name} tipped you <span className="text-amber-400">{tip.amount} pts</span>
          </p>
          <p className="text-white/60 text-sm mt-0.5">
            {tip.referenceType === 'Post' && tip.postPreview
              ? `on cast: "${tip.postPreview}${tip.postPreview.length >= 80 ? '...' : ''}"`
              : tip.referenceType === 'User'
                ? 'on your profile'
                : 'on your cast'}
          </p>
          <time className="text-white/40 text-xs mt-1 block" dateTime={tip.createdAt}>
            {formatTimeAgo(tip.createdAt)}
          </time>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {tip.referenceType === 'Post' && tip.postId && (
            <Link
              to={`/agora/thread/${tip.postId}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 transition-colors"
            >
              View cast
            </Link>
          )}
          {tip.fromUserId && (
            <Link
              to={`/agora/user/${tip.fromUserId}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/30 transition-colors"
            >
              Profile
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function AgoraTips() {
  const navigate = useNavigate()
  const { isLoggedIn, token } = useAuth()
  const [tab, setTab] = useState<'sent' | 'received'>('sent')
  const [tips, setTips] = useState<AgoraTipEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [, setTotal] = useState(0)

  const fetchTips = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      const fn = tab === 'sent' ? getAgoraSentTips : getAgoraReceivedTips
      const res = await fn(token, { page: pageNum, limit: 20 })
      if (append) setLoadingMore(false)
      else setLoading(false)
      if (!res.success) {
        setError(res.message ?? 'Failed to load tips')
        if (!append) setTips([])
        return
      }
      const list = res.data?.tips ?? []
      const pagination = res.data?.pagination
      setTotal(pagination?.total ?? 0)
      setHasMore(pagination ? pagination.page < pagination.totalPages : false)
      if (append) {
        setTips((prev) => {
          const ids = new Set(prev.map((t) => t.id))
          return [...prev, ...list.filter((t) => !ids.has(t.id))]
        })
      } else {
        setTips(list)
      }
    },
    [token, tab]
  )

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    setPage(1)
    fetchTips(1, false)
  }, [isLoggedIn, tab, fetchTips])

  function handleLoadMore() {
    const next = page + 1
    setPage(next)
    fetchTips(next, true)
  }

  return (
    <motion.div
      className="relative max-w-2xl"
      initial="visible"
      animate="visible"
      variants={container}
    >
      <motion.div variants={item} className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold mb-1 bg-gradient-to-r from-amber-400 via-indigo-400 to-amber-400 bg-clip-text text-transparent">
              Tips
            </h1>
            <p className="text-white/60 text-sm">Your sent and received tips.</p>
          </motion.div>

          <motion.div variants={item} className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setTab('sent')}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                tab === 'sent'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-white/60 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              Sent
            </button>
            <button
              type="button"
              onClick={() => setTab('received')}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                tab === 'received'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-white/60 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              Received
            </button>
          </motion.div>

          {loading ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
            >
              <p className="text-white/60">Loading tips...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center"
            >
              <p className="text-red-400 mb-2">{error}</p>
              <button
                type="button"
                onClick={() => fetchTips(1, false)}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                Try again
              </button>
            </motion.div>
          ) : tips.length === 0 ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
            >
              <p className="text-white/60 mb-2">
                {tab === 'sent' ? 'No tips sent yet.' : 'No tips received yet.'}
              </p>
              <p className="text-white/40 text-sm mb-4">
                {tab === 'sent'
                  ? 'Tip casts and profiles from Agora to support creators.'
                  : 'Tips from others will appear here.'}
              </p>
              <Link
                to="/agora"
                className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                Browse Agora
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          ) : (
            <motion.div className="space-y-4" variants={container}>
              <AnimatePresence mode="popLayout">
                {tips.map((tip) =>
                  tab === 'sent' ? (
                    <TipRowSent key={tip.id} tip={tip} />
                  ) : (
                    <TipRowReceived key={tip.id} tip={tip} />
                  )
                )}
              </AnimatePresence>
              {hasMore && (
                <motion.div variants={item} className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/30 disabled:opacity-50 transition-colors"
                  >
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
    </motion.div>
  )
}
