import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { QUEST_COMPLETION_REWARD_POINTS } from '../../lib/api'
import type { CampaignQuest } from '../../lib/api'

const TWITTER_NOT_LINKED = 'User has not linked Twitter'

type Props = {
  open: boolean
  onClose: () => void
  quest: CampaignQuest | null
  onVerify: (tweetUrl?: string) => Promise<void>
  loading: boolean
  error: string | null
}

export default function VerifyQuestModal({ open, onClose, quest, onVerify, loading, error }: Props) {
  const [tweetUrl, setTweetUrl] = useState('')

  const needsTweetUrl = quest?.type === 'tweet_tag'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (needsTweetUrl && !tweetUrl.trim()) return
    await onVerify(needsTweetUrl ? tweetUrl.trim() : undefined)
    setTweetUrl('')
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1916] shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(251,191,36,0.08)' }}
        >
          <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between bg-white/[0.02]">
            <span className="text-sm font-semibold text-white">Verify quest</span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5 space-y-4">
            {quest && (
              <>
                <h3 className="text-white font-medium">{quest.title}</h3>
                <p className="text-white/60 text-sm">{quest.description}</p>
                <p className="text-xs text-amber-400/90">
                  Reward: <span className="font-semibold">{QUEST_COMPLETION_REWARD_POINTS} loyalty points</span>
                </p>
              </>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    <p className="text-sm text-red-400">{error}</p>
                    {error === TWITTER_NOT_LINKED && (
                      <Link
                        to="/profile"
                        onClick={onClose}
                        className="inline-flex items-center gap-2 text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        Connect Twitter in Profile →
                      </Link>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {needsTweetUrl && (
                <div>
                  <label htmlFor="verify-tweet-url" className="block text-xs text-white/60 uppercase tracking-wider mb-1.5">
                    Your tweet URL
                  </label>
                  <input
                    id="verify-tweet-url"
                    type="url"
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    placeholder="https://x.com/you/status/..."
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    required={needsTweetUrl}
                  />
                  <p className="text-xs text-white/45 mt-1">Paste the link to the tweet where you tagged the required handle.</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl font-medium text-white/80 bg-white/10 hover:bg-white/15 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (needsTweetUrl && !tweetUrl.trim())}
                  className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:pointer-events-none transition-all"
                >
                  {loading ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
