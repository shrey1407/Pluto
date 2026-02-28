import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COST_CAMPAIGN_CREATE } from '../../lib/api'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (body: { name: string; description: string; expiryDays?: number }) => Promise<void>
  loading: boolean
  error: string | null
}

export default function CreateCampaignModal({ open, onClose, onSubmit, loading, error }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [expiryDays, setExpiryDays] = useState<string>('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !description.trim()) return
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      expiryDays: expiryDays === '' ? undefined : Math.max(1, parseInt(expiryDays, 10) || 0),
    })
    setName('')
    setDescription('')
    setExpiryDays('')
  }

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
          className="w-full max-w-lg rounded-2xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.95) 100%)',
            boxShadow:
              '0 0 0 1px rgba(251,191,36,0.15), 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 60px -12px rgba(251,191,36,0.12)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Header */}
          <div className="relative border-b border-white/10 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.15))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px -4px rgba(251,191,36,0.3)',
                }}
              >
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create campaign</h2>
                <p className="text-xs text-white/50 mt-0.5">Set name, description & expiry</p>
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
              <span>{COST_CAMPAIGN_CREATE} loyalty points</span>
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
              <label htmlFor="campaign-name" className="block text-sm font-medium text-white/80 mb-2">
                Campaign name
              </label>
              <input
                id="campaign-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Quest 2025"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/25 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="campaign-desc" className="block text-sm font-medium text-white/80 mb-2">
                Description
              </label>
              <textarea
                id="campaign-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this campaign about?"
                rows={3}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/25 resize-none transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="campaign-expiry" className="block text-sm font-medium text-white/80 mb-2">
                Expiry <span className="text-white/40 font-normal">(days, optional)</span>
              </label>
              <input
                id="campaign-expiry"
                type="number"
                min={1}
                max={365}
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                placeholder="Leave empty for no expiry"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/25 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
              />
            </div>

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
                disabled={loading || !name.trim() || !description.trim()}
                className="flex-1 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/30"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : (
                  'Create campaign'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
