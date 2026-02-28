import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  getAgoraMostTippedUsers,
  listAgoraUsers,
  type AgoraMostTippedUser,
  type AgoraListedUser,
} from '../lib/api'

const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

function UserCardMostTipped({ u, totalTipsReceived }: { u: AgoraMostTippedUser['user']; totalTipsReceived: number }) {
  return (
    <Link
      to={`/agora/user/${u.id}`}
      className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/10"
    >
      <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-white/10 overflow-hidden">
        {u.profilePicture ? (
          <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
        ) : (
          (u.username ?? u.email ?? '?').charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white truncate">{u.username ?? u.email ?? 'Anonymous'}</p>
        <p className="text-amber-400 text-sm font-semibold">{totalTipsReceived.toLocaleString()} pts received</p>
      </div>
      <span className="shrink-0 text-white/40 text-sm">→</span>
    </Link>
  )
}

function UserCardSearch({ u }: { u: AgoraListedUser }) {
  return (
    <Link
      to={`/agora/user/${u.id}`}
      className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/10"
    >
      <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-white/10 overflow-hidden">
        {u.profilePicture ? (
          <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
        ) : (
          (u.username ?? u.email ?? '?').charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white truncate">{u.username ?? u.email ?? 'Anonymous'}</p>
        {u.username && u.email && (
          <p className="text-white/50 text-sm truncate">{u.email}</p>
        )}
      </div>
      <span className="shrink-0 text-white/40 text-sm">→</span>
    </Link>
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

export default function AgoraExplore() {
  const { isLoggedIn, token } = useAuth()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput.trim(), 350)

  const [mode, setMode] = useState<'mostTipped' | 'search'>('mostTipped')
  const [mostTipped, setMostTipped] = useState<AgoraMostTippedUser[]>([])
  const [searchResults, setSearchResults] = useState<AgoraListedUser[]>([])

  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const loadMostTipped = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token) return
      setLoading(true)
      if (!append) setMostTipped([])
      const res = await getAgoraMostTippedUsers({ page: pageNum, limit: 24 }, token)
      if (res.success && res.data?.users) {
        setMostTipped((prev) => (append ? [...prev, ...res.data!.users] : res.data!.users))
        setTotalPages(res.data!.pagination.totalPages)
        setHasMore(pageNum < res.data!.pagination.totalPages)
      }
      setLoading(false)
    },
    [token]
  )

  const loadSearch = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token || !debouncedSearch) return
      setLoading(true)
      if (!append) setSearchResults([])
      const res = await listAgoraUsers({ page: pageNum, limit: 24, q: debouncedSearch }, token)
      if (res.success && res.data?.users) {
        setSearchResults((prev) => (append ? [...prev, ...res.data!.users] : res.data!.users))
        setTotalPages(res.data!.pagination.totalPages)
        setHasMore(pageNum < res.data!.pagination.totalPages)
      }
      setLoading(false)
    },
    [token, debouncedSearch]
  )

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
  }, [isLoggedIn, navigate])

  useEffect(() => {
    if (!token) return
    if (debouncedSearch) {
      setMode('search')
      setPage(1)
      loadSearch(1, false)
    } else {
      setMode('mostTipped')
      setPage(1)
      loadMostTipped(1, false)
    }
  }, [token, debouncedSearch])

  const loadMore = () => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    if (mode === 'mostTipped') loadMostTipped(nextPage, true)
    else loadSearch(nextPage, true)
  }

  const isLoadingInitial = mode === 'mostTipped' ? mostTipped.length === 0 && loading : searchResults.length === 0 && loading

  return (
    <motion.div
      className="relative max-w-2xl"
      initial="visible"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1 bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
          Explore
        </h1>
        <p className="text-white/60 text-sm">Discover creators</p>
      </div>

      {/* Search */}
      <motion.div variants={item} className="mb-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search users by username or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>

      {/* User list */}
      {isLoadingInitial ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : mode === 'mostTipped' ? (
        mostTipped.length === 0 ? (
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
          >
            <p className="text-white/60">No creators yet. Be the first to get tipped!</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {mostTipped.map(({ user, totalTipsReceived }) => (
              <motion.div key={user.id} variants={item}>
                <UserCardMostTipped u={user} totalTipsReceived={totalTipsReceived} />
              </motion.div>
            ))}
            {hasMore && (
              <motion.div variants={item} className="pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-white/80 font-medium hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              </motion.div>
            )}
          </div>
        )
      ) : searchResults.length === 0 ? (
        <motion.div
          variants={item}
          className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
        >
          <p className="text-white/60">No users found for &quot;{debouncedSearch}&quot;</p>
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
          >
            Clear search
          </button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {searchResults.map((u) => (
            <motion.div key={u.id} variants={item}>
              <UserCardSearch u={u} />
            </motion.div>
          ))}
          {hasMore && (
            <motion.div variants={item} className="pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-white/80 font-medium hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  )
}
