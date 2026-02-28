import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QUEST_TYPES, COST_QUEST_ADD, getAgoraPosts, type AgoraCast } from '../../lib/api'

const AGORA_CAST_QUEST_TYPES = ['agora_like_post', 'agora_comment', 'agora_bookmark_post']

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (body: { title: string; description: string; requiredLink: string; type: string }) => Promise<void>
  loading: boolean
  error: string | null
  campaignOwnerId?: string
  token?: string | null
}

export default function AddQuestModal({ open, onClose, onSubmit, loading, error, campaignOwnerId, token }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requiredLink, setRequiredLink] = useState('')
  const [type, setType] = useState<string>(QUEST_TYPES[0].value)
  const [casts, setCasts] = useState<AgoraCast[]>([])
  const [castsLoading, setCastsLoading] = useState(false)
  const [selectedCastId, setSelectedCastId] = useState('')

  const isAgoraFollow = type === 'agora_follow'
  const isCastQuest = AGORA_CAST_QUEST_TYPES.includes(type)

  useEffect(() => {
    if (!open || !isCastQuest || !campaignOwnerId || !token) {
      setCasts([])
      setSelectedCastId('')
      return
    }
    setCastsLoading(true)
    getAgoraPosts({ author: campaignOwnerId, parentPost: null, limit: 50 }, token)
      .then((res) => {
        setCasts(res.success && res.data?.posts ? res.data.posts : [])
        setSelectedCastId('')
      })
      .finally(() => setCastsLoading(false))
  }, [open, isCastQuest, campaignOwnerId, token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !type) return
    const link = isAgoraFollow ? '' : isCastQuest ? selectedCastId : requiredLink.trim()
    if (!isAgoraFollow && !link) return
    await onSubmit({ title: title.trim(), description: description.trim(), requiredLink: link, type })
    setTitle('')
    setDescription('')
    setRequiredLink('')
    setSelectedCastId('')
    setType(QUEST_TYPES[0].value)
  }

  const selectedHint = QUEST_TYPES.find((t) => t.value === type)?.hint ?? ''
  const needsLinkInput = !isAgoraFollow && !isCastQuest
  const canSubmit =
    !!title.trim() &&
    !!description.trim() &&
    !!type &&
    (isAgoraFollow || (isCastQuest ? !!selectedCastId : !!requiredLink.trim()))

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto"
          style={{
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.95) 100%)',
            boxShadow:
              '0 0 0 1px rgba(251,191,36,0.15), 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 60px -12px rgba(251,191,36,0.12)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Top gradient accent */}
          <div
            className="absolute left-0 right-0 top-0 h-1 z-20"
            style={{
              background: 'linear-gradient(90deg, #f59e0b, #06b6d4, #8b5cf6, #ec4899)',
            }}
          />

          {/* Header */}
          <div className="relative border-b border-white/10 px-6 py-5 flex items-center justify-between sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.15))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px -4px rgba(251,191,36,0.3)',
                }}
              >
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Add quest</h2>
                <p className="text-xs text-white/50 mt-0.5">Title, type & required link</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Cost badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.1))',
                border: '1px solid rgba(251,191,36,0.3)',
                color: '#fbbf24',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{COST_QUEST_ADD} loyalty points</span>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
                >
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label htmlFor="quest-title" className="block text-sm font-medium text-white/80 mb-2">
                Quest title
              </label>
              <input
                id="quest-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Follow us on X"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/25 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="quest-desc" className="block text-sm font-medium text-white/80 mb-2">
                Description
              </label>
              <textarea
                id="quest-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What should the user do?"
                rows={2}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/25 resize-none transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="quest-type" className="block text-sm font-medium text-white/80 mb-2">
                Quest type
              </label>
              <select
                id="quest-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/25 transition-colors [&>option]:bg-slate-900 [&>option]:text-white"
              >
                {QUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {isAgoraFollow && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-sm text-emerald-300">
                  Users will follow the campaign creator. No link needed.
                </p>
              </div>
            )}

            {isCastQuest && (
              <div>
                <label htmlFor="quest-cast" className="block text-sm font-medium text-white/80 mb-2">
                  Select a cast
                </label>
                {castsLoading ? (
                  <div className="flex items-center gap-2 py-3 text-white/60 text-sm">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading your casts…
                  </div>
                ) : casts.length === 0 ? (
                  <p className="text-sm text-amber-400/90 py-3">
                    You have no casts yet. Post a cast in Agora first, then add this quest.
                  </p>
                ) : (
                  <select
                    id="quest-cast"
                    value={selectedCastId}
                    onChange={(e) => setSelectedCastId(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/25 transition-colors [&>option]:bg-slate-900 [&>option]:text-white"
                    required={isCastQuest}
                  >
                    <option value="">Choose a cast…</option>
                    {casts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.content.slice(0, 60)}{c.content.length > 60 ? '…' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {needsLinkInput && (
              <div>
                <label htmlFor="quest-link" className="block text-sm font-medium text-white/80 mb-2">
                  Required link / handle
                </label>
                <input
                  id="quest-link"
                  type="text"
                  value={requiredLink}
                  onChange={(e) => setRequiredLink(e.target.value)}
                  placeholder={selectedHint}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/25 transition-colors"
                  required={needsLinkInput}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 rounded-xl font-semibold text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="flex-1 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/30"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Adding…
                  </span>
                ) : (
                  'Add quest'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
