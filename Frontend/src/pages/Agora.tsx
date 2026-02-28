import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  getAgoraPosts,
  getAgoraHomeFeed,
  getAgoraTrendingFeed,
  getAgoraMostTippedUsers,
  createAgoraCast,
  type AgoraCast,
  type AgoraMostTippedUser,
} from '../lib/api'
import CastCard from '../components/agora/CastCard'

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
}
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

export default function Agora() {
  const { isLoggedIn, user, token } = useAuth()
  const navigate = useNavigate()
  const [feed, setFeed] = useState<'forYou' | 'following' | 'trending'>('forYou')
  const [casts, setCasts] = useState<AgoraCast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [castContent, setCastContent] = useState('')
  const [castImages, setCastImages] = useState<string[]>([])
  const castFileInputRef = useRef<HTMLInputElement>(null)
  const [castLoading, setCastLoading] = useState(false)
  const [castError, setCastError] = useState<string | null>(null)

  const MAX_CAST_IMAGES = 4
  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('Failed to read image'))
      r.readAsDataURL(file)
    })
  }
  async function handleCastFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const toAdd = Math.min(files.length, MAX_CAST_IMAGES - castImages.length)
    if (toAdd <= 0) return
    setCastError(null)
    try {
      const dataUrls: string[] = []
      for (let i = 0; i < toAdd && i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        dataUrls.push(await fileToDataUrl(file))
      }
      setCastImages((prev) => [...prev, ...dataUrls].slice(0, MAX_CAST_IMAGES))
    } catch {
      setCastError('Failed to add image')
    }
    e.target.value = ''
  }
  function removeCastImage(index: number) {
    setCastImages((prev) => prev.filter((_, i) => i !== index))
  }

  const [mostTipped, setMostTipped] = useState<AgoraMostTippedUser[]>([])
  const [mostTippedLoading, setMostTippedLoading] = useState(false)

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
    if (!isLoggedIn) return
    setMostTippedLoading(true)
    getAgoraMostTippedUsers({ page: 1, limit: 10 }, token)
      .then((res) => {
        if (res.success && res.data?.users) setMostTipped(res.data.users)
      })
      .finally(() => setMostTippedLoading(false))
  }, [isLoggedIn, token])

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

  async function handleCast() {
    const content = castContent.trim()
    if ((!content && castImages.length === 0) || !token) return
    setCastError(null)
    setCastLoading(true)
    const res = await createAgoraCast(token, {
      content: content || '',
      ...(castImages.length ? { images: castImages } : {}),
    })
    setCastLoading(false)
    if (res.success && res.data?.post) {
      setCastContent('')
      setCastImages([])
      setCasts((prev) => [res.data!.post!, ...prev])
    } else {
      setCastError(res.message ?? 'Failed to cast')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden overflow-y-auto">
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% -30%, rgba(99, 102, 241, 0.15), transparent 50%),' +
            'radial-gradient(ellipse 80% 60% at 90% 50%, rgba(6, 182, 212, 0.08), transparent 45%),' +
            'linear-gradient(180deg, #0a0a0f 0%, #050508 100%)',
        }}
      />
      <Navbar />
      <div className="pt-24 pb-16 px-4 relative z-10">
        <motion.div
          className="relative max-w-2xl mx-auto"
          initial="visible"
          animate="visible"
          variants={container}
        >
          {/* Header */}
          <motion.div variants={item} className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-1 bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Agora
            </h1>
            <p className="text-white/60 text-sm">
              Cast your thoughts. Share updates in short posts called Casts.
            </p>
            {isLoggedIn && (
              <div className="flex items-center gap-4 mt-3">
                <Link
                  to="/agora/bookmarks"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Bookmarks
                </Link>
                <Link
                  to="/agora/tips"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tips
                </Link>
                <Link
                  to="/agora/messages"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Messages
                </Link>
              </div>
            )}
          </motion.div>

          {/* Cast composer */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 mb-6"
          >
            <textarea
              value={castContent}
              onChange={(e) => setCastContent(e.target.value)}
              placeholder="What's on your mind? Cast it..."
              rows={3}
              maxLength={500}
              className="w-full bg-transparent border-none text-white placeholder-white/40 resize-none focus:outline-none focus:ring-0 text-base"
              disabled={castLoading}
            />
            {castImages.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 max-w-xs">
                {castImages.map((src, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 aspect-square group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeCastImage(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/80 text-xs"
                      aria-label="Remove image"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <input
                  ref={castFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleCastFileChange}
                />
                <button
                  type="button"
                  onClick={() => castFileInputRef.current?.click()}
                  disabled={castLoading || castImages.length >= MAX_CAST_IMAGES}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Add image"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                  </svg>
                </button>
                <span className="text-white/40 text-sm">
                  {castContent.length}/500
                  {castImages.length > 0 && ` · ${castImages.length}/${MAX_CAST_IMAGES} images`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCast}
                disabled={(!castContent.trim() && castImages.length === 0) || castLoading}
                className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {castLoading ? 'Casting...' : 'Cast'}
              </button>
            </div>
            {castError && (
              <p className="mt-2 text-sm text-rose-400">{castError}</p>
            )}
          </motion.div>

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

          {/* Most Tipped Creators */}
          {mostTipped.length > 0 && (
            <motion.div variants={item} className="mb-6">
              <h3 className="text-sm font-semibold text-white/80 mb-3">Most Tipped Creators</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 scrollbar-thin">
                {mostTipped.map(({ user: u, totalTipsReceived }) => (
                  <Link
                    key={u.id}
                    to={`/agora/user/${u.id}`}
                    className="flex-shrink-0 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-amber-500/30 hover:bg-white/10 transition-colors min-w-0"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-gradient-to-br from-amber-500/30 to-indigo-500/30 border border-white/10 overflow-hidden">
                      {u.profilePicture ? (
                        <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (u.username ?? u.email ?? '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{u.username ?? u.email ?? 'Anonymous'}</p>
                      <p className="text-amber-400 text-xs font-medium">{totalTipsReceived.toLocaleString()} pts received</p>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {mostTippedLoading && mostTipped.length === 0 && (
            <motion.div variants={item} className="mb-6">
              <div className="h-16 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
            </motion.div>
          )}

          {/* Feed */}
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
              <p className="text-white/60 mb-2">
                {feed === 'following'
                  ? 'Follow users to see their casts here.'
                  : feed === 'trending'
                    ? 'No trending casts yet. Like some casts to see them here!'
                    : 'No casts yet. Be the first to cast!'}
              </p>
              {feed === 'forYou' && (
                <button
                  type="button"
                  onClick={handleCast}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                >
                  Cast something
                </button>
              )}
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
      </div>
    </div>
  )
}
