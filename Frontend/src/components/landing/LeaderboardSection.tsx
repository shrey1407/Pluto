import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getLeaderboard, type LeaderboardEntry } from '../../lib/api'

export default function LeaderboardSection() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLeaderboard()
      .then((res) => {
        if (res.success && res.data?.leaderboard) setLeaderboard(res.data.leaderboard)
        else setError(res.message ?? 'Failed to load')
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section
      id="leaderboard"
      className="relative py-20 sm:py-24 px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #050508 0%, #0a0a12 30%, #080810 70%, #050508 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(251,191,36,0.12), transparent 60%)',
        }}
      />
      <div className="relative max-w-3xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center"
        >
          Top players
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-slate-400 text-center mb-10"
        >
          Users with the most loyalty points
        </motion.p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-slate-500 py-8">{error}</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No players yet. Be the first!</p>
        ) : (
          <motion.ul
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-sm overflow-hidden p-2"
          >
            {leaderboard.map((entry) => (
              <motion.li
                key={`${entry.rank}-${entry.username}`}
                variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
                className="flex items-center gap-4 rounded-xl px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    entry.rank === 1
                      ? 'bg-amber-500/30 text-amber-400'
                      : entry.rank === 2
                        ? 'bg-slate-400/30 text-slate-300'
                        : entry.rank === 3
                          ? 'bg-amber-700/40 text-amber-200'
                          : 'bg-white/10 text-white/70'
                  }`}
                >
                  {entry.rank}
                </span>
                {entry.profilePicture ? (
                  <img
                    src={entry.profilePicture}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-white/60 text-sm font-medium">
                    {(entry.username[0] ?? '?').toUpperCase()}
                  </div>
                )}
                <span className="flex-1 font-medium text-white truncate">{entry.username}</span>
                <span className="flex-shrink-0 text-amber-400 font-semibold tabular-nums">
                  {entry.loyaltyPoints.toLocaleString()} pts
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </section>
  )
}
