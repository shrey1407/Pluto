import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getLandingStats, type LandingStats } from '../../lib/api'

const statConfig: { key: keyof LandingStats; label: string; suffix?: string }[] = [
  { key: 'userCount', label: 'Players' },
  { key: 'campaignCount', label: 'Campaigns' },
  { key: 'questCount', label: 'Quests' },
  { key: 'completionCount', label: 'Quests completed' },
  { key: 'totalPoints', label: 'Loyalty points earned', suffix: ' pts' },
]

export default function StatsSection() {
  const [stats, setStats] = useState<LandingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLandingStats()
      .then((res) => {
        if (res.success && res.data) setStats(res.data)
        else setError(res.message ?? 'Failed to load')
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section
      id="stats"
      className="relative py-20 sm:py-24 px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #080810 0%, #0a0a12 50%, #080810 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(99, 102, 241, 0.15), transparent 55%)',
        }}
      />
      <div className="relative max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center"
        >
          Platform stats
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-slate-400 text-center mb-12"
        >
          What the community has achieved so far
        </motion.p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-slate-500 py-8">{error}</p>
        ) : stats ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4"
          >
            {statConfig.map(({ key, label, suffix }) => (
              <motion.div
                key={key}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-6 text-center hover:border-white/20 transition-colors"
              >
                <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                  {typeof stats[key] === 'number' ? (stats[key] as number).toLocaleString() : '—'}
                  {suffix ?? ''}
                </p>
                <p className="text-slate-400 text-sm mt-1">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        ) : null}
      </div>
    </section>
  )
}
