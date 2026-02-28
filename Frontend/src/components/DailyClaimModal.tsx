import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  getDailyClaimStatus,
  claimDailyReward,
  DAILY_CLAIM_POINTS,
  type DailyClaimStatus,
} from '../lib/api'

type Props = {
  open: boolean
  onClose: () => void
  onClaimSuccess?: () => void
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ready!'
  const h = Math.floor(ms / (60 * 60 * 1000))
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  const s = Math.floor((ms % (60 * 1000)) / 1000)
  return `${h}h ${m}m ${s}s`
}

export default function DailyClaimModal({ open, onClose, onClaimSuccess }: Props) {
  const { token, refreshUser } = useAuth()
  const [status, setStatus] = useState<DailyClaimStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdownMs, setCountdownMs] = useState<number>(0)

  const fetchStatus = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    const res = await getDailyClaimStatus(token)
    setLoading(false)
    if (res.success && res.data) setStatus(res.data)
    else setError(res.message ?? 'Failed to load')
  }, [token])

  useEffect(() => {
    if (open && token) fetchStatus()
  }, [open, token, fetchStatus])

  useEffect(() => {
    if (!open || !status?.nextClaimAt || status.canClaim) return
    const next = new Date(status.nextClaimAt).getTime()
    const tick = () => {
      const now = Date.now()
      setCountdownMs(Math.max(0, next - now))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [open, status?.nextClaimAt, status?.canClaim])

  const handleClaim = async () => {
    if (!token || !status?.canClaim) return
    setClaiming(true)
    setError(null)
    const res = await claimDailyReward(token)
    setClaiming(false)
    if (res.success && res.data) {
      await refreshUser()
      await fetchStatus()
      onClaimSuccess?.()
    } else setError(res.message ?? 'Claim failed')
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl overflow-hidden border border-amber-500/15 bg-[#1a1916] shadow-2xl shadow-black/50"
          style={{ boxShadow: '0 0 0 1px rgba(251,191,36,0.08), 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 80px -20px rgba(251,191,36,0.08)' }}
        >
          {/* Header with gradient accent */}
          <div className="relative border-b border-amber-500/10 bg-gradient-to-br from-amber-500/12 via-amber-900/5 to-transparent px-6 py-5 flex items-center justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.06),transparent_70%)] pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <span className="text-2xl" aria-hidden>🎁</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">Daily Rewards</h2>
                <p className="text-xs text-white/50 mt-0.5">Claim every 24 hours</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="relative p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6 bg-gradient-to-b from-[#1a1916] to-[#161513]">
            <p className="text-sm text-white/55 leading-relaxed">
              Consecutive days increase your reward. Miss a day and the streak resets to Day 1.
            </p>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
                <p className="text-sm text-white/50">Loading rewards…</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : status ? (
              <>
                {/* 7 days grid */}
                <div className="grid grid-cols-7 gap-2.5">
                  {DAILY_CLAIM_POINTS.map((points, i) => {
                    const day = i + 1
                    const claimed = status.currentStreak > day || (status.currentStreak === day && !status.canClaim)
                    const isNext = status.canClaim && status.nextDayNumber === day
                    const locked = day > (status.currentStreak + (status.canClaim ? 1 : 0))
                    return (
                      <motion.div
                        key={day}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 + i * 0.03 }}
                        className={`
                          relative rounded-xl border min-h-[72px] flex flex-col items-center justify-center p-2.5 text-center transition-all
                          ${claimed
                            ? 'border-amber-500/35 bg-gradient-to-br from-amber-500/20 to-amber-600/10 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)]'
                            : ''
                          }
                          ${isNext
                            ? 'border-amber-400/50 ring-2 ring-amber-400/35 bg-gradient-to-br from-amber-500/20 to-orange-500/15 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
                            : ''
                          }
                          ${locked ? 'border-white/5 bg-white/[0.04] opacity-55' : ''}
                        `}
                      >
                        <p className={`text-[11px] font-semibold uppercase tracking-widest mb-1 ${claimed ? 'text-amber-200/90' : isNext ? 'text-amber-300' : 'text-white/45'}`}>
                          Day {day}
                        </p>
                        <p className={`text-sm font-bold tabular-nums leading-tight ${isNext ? 'text-amber-200' : claimed ? 'text-amber-300/95' : 'text-white/40'}`}>
                          {points}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${claimed ? 'text-amber-400/70' : isNext ? 'text-amber-400/80' : 'text-white/35'}`}>pts</p>
                        {claimed && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-400/25 border border-amber-400/40 flex items-center justify-center text-amber-300 text-xs font-bold" aria-hidden>✓</span>
                        )}
                        {isNext && (
                          <span className="inline-block mt-2 text-[10px] font-bold text-amber-300 uppercase tracking-wider">Claim</span>
                        )}
                      </motion.div>
                    )
                  })}
                </div>

                {/* Claim / Countdown */}
                <div className="rounded-xl overflow-hidden border border-amber-500/10 bg-gradient-to-b from-amber-500/8 to-transparent">
                  {status.canClaim ? (
                    <div className="p-5 text-center space-y-4">
                      <p className="text-sm text-white/70">
                        Day <span className="font-semibold text-amber-400">{status.nextDayNumber}</span> — <span className="font-semibold text-amber-300">{status.pointsForNextClaim ?? 0}</span> points
                      </p>
                      <button
                        type="button"
                        onClick={handleClaim}
                        disabled={claiming}
                        className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-60 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                      >
                        {claiming ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Claiming…
                          </span>
                        ) : (
                          'Claim now'
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 text-center space-y-3">
                      <p className="text-xs text-amber-400/80 uppercase tracking-wider font-medium">Next claim in</p>
                      <p className="text-2xl font-bold text-amber-300 tabular-nums tracking-tight">
                        {formatCountdown(countdownMs)}
                      </p>
                      <p className="text-xs text-white/45">Come back after 24 hours to continue your streak</p>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
