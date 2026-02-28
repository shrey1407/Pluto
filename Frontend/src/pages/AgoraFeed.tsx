import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  getAgoraPosts,
  getAgoraHomeFeed,
  getAgoraTrendingFeed,
  type AgoraCast,
} from '../lib/api'
import CastCard from '../components/agora/CastCard'

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
}
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

export default function AgoraFeed() {
  const { isLoggedIn, user, token } = useAuth()
  const navigate = useNavigate()
  const { addCastRef } = (useOutletContext() as { addCastRef?: React.MutableRefObject<((cast: AgoraCast) => void) | null> }) ?? {}
  const [feed, setFeed] = useState<'forYou' | 'following' | 'trending'>('forYou')
  const [casts, setCasts] = useState<AgoraCast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchFeed = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!isLoggedIn && (feed === 'following' || feed === 'trending')) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      const params = { page: pageNum, limit: 20 }
      let res
      if (feed === 'trending') {
        res = await getAgoraTrendingFeed(params, token)
      } else if (feed === 'following' && token) {
        res = await getAgoraHomeFeed(token, params)
      } else {
        res = await getAgoraPosts({ ...params, parentPost: null }, token)
      }

      if (append) setLoadingMore(false)
      else setLoading(false)

      if (!res.success) {
        setError(res.message ?? 'Failed to load feed')
        if (!append) setCasts([])
        return
      }
      const list = res.data?.posts ?? []
      const pagination = res.data?.pagination
      setHasMore(pagination ? pagination.page < pagination.totalPages : false)
      if (append) {
        setCasts((prev) => {
          const ids = new Set(prev.map((c) => c._id))
          const newOnes = list.filter((c) => !ids.has(c._id))
          return [...prev, ...newOnes]
        })
      } else {
        setCasts(list)
      }
    },
    [feed, isLoggedIn, token]
  )

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    setPage(1)
    fetchFeed(1, false)
  }, [isLoggedIn, feed])

  useEffect(() => {
    if (!addCastRef) return
    addCastRef.current = (cast: AgoraCast) => {
      setCasts((prev) => {
        if (prev.some((c) => c._id === cast._id)) return prev
        return [cast, ...prev]
      })
    }
    return () => {
      addCastRef.current = null
    }
  }, [addCastRef])

  function handleLoadMore() {
    const next = page + 1
    setPage(next)
    fetchFeed(next, true)
  }

  function handleLikeChange(id: string, liked: boolean, likesCount: number) {
    setCasts((prev) =>
      prev.map((c) =>
        c._id === id ? { ...c, likedByCurrentUser: liked, likesCount } : c
      )
    )
  }

  return (
    <motion.div
      className="relative max-w-2xl"
      initial="visible"
      animate="visible"
      variants={container}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Feed</h1>
        <p className="text-white/60 text-sm">Cast your thoughts. Share updates in short posts.</p>
      </div>

      {/* Feed tabs */}
      <motion.div
        variants={item}
        className="flex rounded-xl border border-white/10 bg-white/5 p-1 mb-6"
      >
        <button
          type="button"
          onClick={() => setFeed('forYou')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            feed === 'forYou'
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-white/60 hover:text-white'
          }`}
        >
          For You
        </button>
        <button
          type="button"
          onClick={() => setFeed('following')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            feed === 'following'
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Following
        </button>
        <button
          type="button"
          onClick={() => setFeed('trending')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            feed === 'trending'
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Trending
        </button>
      </motion.div>

      {loading ? (
        <motion.div
          variants={item}
          className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
        >
          <p className="text-white/60">Loading casts...</p>
        </motion.div>
      ) : error ? (
        <motion.div
          variants={item}
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center"
        >
          <p className="text-red-400 mb-2">{error}</p>
          <button
            type="button"
            onClick={() => fetchFeed(1, false)}
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
          <p className="text-white/60">
            {feed === 'following'
              ? 'Follow users to see their casts here.'
              : feed === 'trending'
                ? 'No trending casts yet. Like some casts to see them here!'
                : 'No casts yet. Be the first to cast!'}
          </p>
          <p className="text-white/40 text-sm mt-2">Use &quot;Create Cast&quot; in the sidebar to post.</p>
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
                  onBookmarkChange={(id, bookmarked) =>
                    setCasts((prev) =>
                      prev.map((c) => (c._id === id ? { ...c, bookmarkedByCurrentUser: bookmarked } : c))
                    )
                  }
                  onUpdate={(updated) =>
                    setCasts((prev) =>
                      prev.map((c) => (c._id === updated._id ? updated : c))
                    )
                  }
                  onDelete={() =>
                    setCasts((prev) => prev.filter((c) => c._id !== cast._id))
                  }
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
