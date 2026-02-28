import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { getAgoraBookmarks, type AgoraCast } from '../lib/api'
import CastCard from '../components/agora/CastCard'

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
}
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

export default function AgoraBookmarks() {
  const navigate = useNavigate()
  const { isLoggedIn, user, token } = useAuth()
  const [casts, setCasts] = useState<AgoraCast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchBookmarks = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      const res = await getAgoraBookmarks(token, { page: pageNum, limit: 20 })
      if (append) setLoadingMore(false)
      else setLoading(false)
      if (!res.success) {
        setError(res.message ?? 'Failed to load bookmarks')
        if (!append) setCasts([])
        return
      }
      const list = res.data?.posts ?? []
      const pagination = res.data?.pagination
      setHasMore(pagination ? pagination.page < pagination.totalPages : false)
      if (append) {
        setCasts((prev) => {
          const ids = new Set(prev.map((c) => c._id))
          return [...prev, ...list.filter((c) => !ids.has(c._id))]
        })
      } else {
        setCasts(list)
      }
    },
    [token]
  )

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    setPage(1)
    fetchBookmarks(1, false)
  }, [isLoggedIn, fetchBookmarks])

  function handleLikeChange(id: string, liked: boolean, likesCount: number) {
    setCasts((prev) =>
      prev.map((c) => (c._id === id ? { ...c, likedByCurrentUser: liked, likesCount } : c))
    )
  }

  function handleBookmarkChange(id: string, bookmarked: boolean) {
    if (!bookmarked) {
      setCasts((prev) => prev.filter((c) => c._id !== id))
    } else {
      setCasts((prev) =>
        prev.map((c) => (c._id === id ? { ...c, bookmarkedByCurrentUser: bookmarked } : c))
      )
    }
  }

  function handleLoadMore() {
    const next = page + 1
    setPage(next)
    fetchBookmarks(next, true)
  }

  return (
    <motion.div
      className="relative max-w-2xl"
      initial="visible"
      animate="visible"
      variants={container}
    >
      <motion.div variants={item} className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold mb-1 bg-gradient-to-r from-indigo-400 via-amber-400 to-indigo-400 bg-clip-text text-transparent">
              Bookmarks
            </h1>
            <p className="text-white/60 text-sm">Your saved casts for later.</p>
          </motion.div>

          {loading ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
            >
              <p className="text-white/60">Loading bookmarks...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center"
            >
              <p className="text-red-400 mb-2">{error}</p>
              <button
                type="button"
                onClick={() => fetchBookmarks(1, false)}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                Try again
              </button>
            </motion.div>
          ) : casts.length === 0 ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
            >
              <p className="text-white/60 mb-2">No bookmarks yet.</p>
              <p className="text-white/40 text-sm mb-4">
                Save casts from the feed to read them later.
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
                {casts.map((cast) => (
                  <motion.div key={cast._id} variants={item}>
                    <CastCard
                      cast={cast}
                      token={token}
                      currentUserId={user?.id}
                      onLikeChange={handleLikeChange}
                      onBookmarkChange={handleBookmarkChange}
                      showAuthorLink
                      showThreadLink
                    />
                  </motion.div>
                ))}
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
