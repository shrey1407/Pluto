import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { getAgoraMostTippedUsers, type AgoraMostTippedUser } from '../lib/api'

const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950 font-bold text-lg shadow-lg shadow-amber-500/30">
        {rank}
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 font-bold text-lg shadow-lg shadow-slate-400/30">
        {rank}
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 font-bold text-lg shadow-lg shadow-amber-700/30">
        {rank}
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 border border-white/20 text-white/80 font-bold text-sm">
      {rank}
    </div>
  )
}

export default function AgoraMostTipped() {
  const { isLoggedIn, token } = useAuth()
  const navigate = useNavigate()
  const [mostTipped, setMostTipped] = useState<AgoraMostTippedUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    setLoading(true)
    getAgoraMostTippedUsers({ page: 1, limit: 10 }, token)
      .then((res) => {
        if (res.success && res.data?.users) setMostTipped(res.data.users)
      })
      .finally(() => setLoading(false))
  }, [isLoggedIn, token, navigate])

  return (
    <motion.div
      className="relative max-w-2xl"
      initial="visible"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
          Leaderboard
        </h1>
        <p className="text-white/60 text-sm">Top 10 most tipped creators on Agora</p>
      </div>

      {/* Podium-style header for top 3 */}
      {!loading && mostTipped.length >= 3 && (
        <motion.div
          variants={item}
          className="mb-8 flex justify-center items-end gap-4 px-4 py-6 rounded-2xl border border-white/10 bg-gradient-to-b from-amber-500/10 to-transparent"
        >
          {/* 2nd place */}
          <Link
            to={`/agora/user/${mostTipped[1].user.id}`}
            className="flex flex-col items-center gap-2 order-1 flex-1 max-w-[100px] group"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold bg-gradient-to-br from-slate-300 to-slate-500 border-2 border-slate-400/50 overflow-hidden group-hover:scale-105 transition-transform">
              {mostTipped[1].user.profilePicture ? (
                <img src={mostTipped[1].user.profilePicture} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-slate-900">
                  {(mostTipped[1].user.username ?? mostTipped[1].user.email ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-white font-medium truncate w-full text-center text-sm">
              {mostTipped[1].user.username ?? mostTipped[1].user.email ?? 'Anonymous'}
            </p>
            <div className="w-12 h-16 rounded-t-lg flex items-center justify-center bg-gradient-to-t from-slate-500/40 to-slate-400/30 border border-slate-400/30">
              <span className="text-slate-200 font-bold text-lg">2</span>
            </div>
            <p className="text-amber-400 font-semibold text-sm">
              {mostTipped[1].totalTipsReceived.toLocaleString()} pts
            </p>
          </Link>

          {/* 1st place - tallest */}
          <Link
            to={`/agora/user/${mostTipped[0].user.id}`}
            className="flex flex-col items-center gap-2 order-2 flex-1 max-w-[120px] group"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-400/50 overflow-hidden group-hover:scale-105 transition-transform shadow-lg shadow-amber-500/30">
              {mostTipped[0].user.profilePicture ? (
                <img src={mostTipped[0].user.profilePicture} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-amber-950">
                  {(mostTipped[0].user.username ?? mostTipped[0].user.email ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-white font-semibold truncate w-full text-center">
              {mostTipped[0].user.username ?? mostTipped[0].user.email ?? 'Anonymous'}
            </p>
            <div className="w-14 h-20 rounded-t-lg flex items-center justify-center bg-gradient-to-t from-amber-500/50 to-amber-400/30 border border-amber-400/40 shadow-lg shadow-amber-500/20">
              <span className="text-amber-100 font-bold text-xl">1</span>
            </div>
            <p className="text-amber-300 font-bold">
              {mostTipped[0].totalTipsReceived.toLocaleString()} pts
            </p>
          </Link>

          {/* 3rd place */}
          <Link
            to={`/agora/user/${mostTipped[2].user.id}`}
            className="flex flex-col items-center gap-2 order-3 flex-1 max-w-[100px] group"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold bg-gradient-to-br from-amber-600 to-amber-800 border-2 border-amber-600/50 overflow-hidden group-hover:scale-105 transition-transform">
              {mostTipped[2].user.profilePicture ? (
                <img src={mostTipped[2].user.profilePicture} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-amber-100">
                  {(mostTipped[2].user.username ?? mostTipped[2].user.email ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-white font-medium truncate w-full text-center text-sm">
              {mostTipped[2].user.username ?? mostTipped[2].user.email ?? 'Anonymous'}
            </p>
            <div className="w-12 h-14 rounded-t-lg flex items-center justify-center bg-gradient-to-t from-amber-700/40 to-amber-600/30 border border-amber-600/30">
              <span className="text-amber-200 font-bold text-lg">3</span>
            </div>
            <p className="text-amber-400 font-semibold text-sm">
              {mostTipped[2].totalTipsReceived.toLocaleString()} pts
            </p>
          </Link>
        </motion.div>
      )}

      {/* Full leaderboard list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-16 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : mostTipped.length === 0 ? (
        <motion.div
          variants={item}
          className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
        >
          <p className="text-white/60">No tipped creators yet. Start tipping to see them here!</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {mostTipped.length > 3 && (
            <motion.p variants={item} className="text-white/50 text-sm font-medium px-2 mb-2">
              #4 – #10
            </motion.p>
          )}
          {mostTipped.map(({ user: u, totalTipsReceived }, index) => {
            const rank = index + 1
            const showInPodium = rank <= 3 && mostTipped.length >= 3
            if (showInPodium) return null
            return (
              <motion.div key={u.id} variants={item}>
                <Link
                  to={`/agora/user/${u.id}`}
                  className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
                    rank <= 3
                      ? 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30 hover:bg-amber-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="shrink-0">
                    <RankBadge rank={rank} />
                  </div>
                  <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold bg-gradient-to-br from-amber-500/30 to-indigo-500/30 border border-white/10 overflow-hidden">
                    {u.profilePicture ? (
                      <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (u.username ?? u.email ?? '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">{u.username ?? u.email ?? 'Anonymous'}</p>
                    <p className="text-amber-400 text-sm font-semibold">{totalTipsReceived.toLocaleString()} pts</p>
                  </div>
                  <div className="shrink-0 text-white/40 text-sm font-mono">#{rank}</div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
