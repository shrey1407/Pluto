import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  getAgoraPost,
  createAgoraReply,
  tipAgoraPost,
  type AgoraCast,
} from '../lib/api'
import CastCard from '../components/agora/CastCard'

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
}
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

export default function AgoraThread() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoggedIn, user, token, refreshUser } = useAuth()
  const [post, setPost] = useState<AgoraCast | null>(null)
  const [replies, setReplies] = useState<AgoraCast[]>([])
  const [repliesPage, setRepliesPage] = useState(1)
  const [repliesTotal, setRepliesTotal] = useState(0)
  const [repliesTotalPages, setRepliesTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const [replyContent, setReplyContent] = useState('')
  const [replyImages, setReplyImages] = useState<string[]>([])
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  const [replyTipAmount, setReplyTipAmount] = useState(0)
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  const MAX_REPLY_IMAGES = 4
  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('Failed to read image'))
      r.readAsDataURL(file)
    })
  }
  async function handleReplyFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const toAdd = Math.min(files.length, MAX_REPLY_IMAGES - replyImages.length)
    if (toAdd <= 0) return
    setReplyError(null)
    try {
      const dataUrls: string[] = []
      for (let i = 0; i < toAdd && i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        dataUrls.push(await fileToDataUrl(file))
      }
      setReplyImages((prev) => [...prev, ...dataUrls].slice(0, MAX_REPLY_IMAGES))
    } catch {
      setReplyError('Failed to add image')
    }
    e.target.value = ''
  }
  function removeReplyImage(index: number) {
    setReplyImages((prev) => prev.filter((_, i) => i !== index))
  }

  const REPLY_TIP_PRESETS = [0, 10, 50, 100]
  const castAuthorId = post?.user && typeof post.user === 'object' && '_id' in post.user
    ? (post.user as { _id: string })._id
    : null
  const canTipWithReply = !!token && !!castAuthorId && user?.id !== castAuthorId

  const fetchThread = useCallback(
    async (page = 1, append = false) => {
      if (!id) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      const res = await getAgoraPost(
        id,
        { replyPage: page, replyLimit: 20 },
        token
      )

      if (append) setLoadingMore(false)
      else setLoading(false)

      if (!res.success) {
        setError(res.message ?? 'Failed to load thread')
        if (!append) {
          setPost(null)
          setReplies([])
        }
        return
      }

      const data = res.data
      if (!append) {
        setPost(data?.post ?? null)
      }
      const list = data?.replies ?? []
      const pagination = data?.repliesPagination
      setRepliesTotal(pagination?.total ?? 0)
      setRepliesTotalPages(pagination?.totalPages ?? 0)

      if (append) {
        setReplies((prev) => {
          const ids = new Set(prev.map((c) => c._id))
          const newOnes = list.filter((c) => !ids.has(c._id))
          return [...prev, ...newOnes]
        })
      } else {
        setReplies(list)
      }
    },
    [id, token]
  )

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    if (!id) return
    setRepliesPage(1)
    fetchThread(1, false)
  }, [isLoggedIn, id])

  async function handleReply() {
    const content = replyContent.trim()
    if ((!content && replyImages.length === 0) || !token || !id) return
    setReplyError(null)
    setReplyLoading(true)
    const res = await createAgoraReply(token, id, content || '', replyImages.length ? replyImages : undefined)
    if (!res.success || !res.data?.post) {
      setReplyLoading(false)
      setReplyError(res.message ?? 'Failed to reply')
      return
    }
    const newReply = res.data.post
    setReplyContent('')
    setReplyImages([])
    setReplyTipAmount(0)
    setReplies((prev) => [...prev, newReply])
    setRepliesTotal((t) => t + 1)
    if (replyTipAmount > 0 && canTipWithReply) {
      const tipRes = await tipAgoraPost(token, id, replyTipAmount)
      if (tipRes.success) {
        refreshUser?.()
      } else {
        setReplyError(tipRes.message ?? 'Reply posted but tip failed')
      }
    }
    setReplyLoading(false)
  }

  function handleLikeChange(castId: string, liked: boolean, likesCount: number) {
    if (post?._id === castId) {
      setPost((p) => (p ? { ...p, likedByCurrentUser: liked, likesCount } : null))
    } else {
      setReplies((prev) =>
        prev.map((c) =>
          c._id === castId ? { ...c, likedByCurrentUser: liked, likesCount } : c
        )
      )
    }
  }

  function handleLoadMore() {
    const next = repliesPage + 1
    setRepliesPage(next)
    fetchThread(next, true)
  }

  const hasMoreReplies = repliesPage < repliesTotalPages

  return (
    <motion.div
      className="relative max-w-2xl"
      initial="visible"
      animate="visible"
      variants={container}
    >

          {loading ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
            >
              <p className="text-white/60">Loading thread...</p>
            </motion.div>
          ) : error || !post ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center"
            >
              <p className="text-red-400 mb-2">{error ?? 'Cast not found'}</p>
              <Link to="/agora" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                Back to Agora
              </Link>
            </motion.div>
          ) : (
            <>
              <motion.div variants={item} className="mb-4">
                <span className="text-white/50 text-sm font-medium uppercase tracking-wider">Thread</span>
              </motion.div>

              {/* Main cast */}
              <motion.div variants={item} className="mb-6">
                <CastCard
                  cast={post}
                  token={token}
                  currentUserId={user?.id}
                  onLikeChange={handleLikeChange}
                  onBookmarkChange={(_, bookmarked) => setPost((p) => (p ? { ...p, bookmarkedByCurrentUser: bookmarked } : null))}
                  onUpdate={(updated) => setPost(updated)}
                  onDelete={() => navigate('/agora', { replace: true })}
                  showAuthorLink
                  showThreadLink={false}
                />
              </motion.div>

              {/* Reply composer */}
              <motion.div
                variants={item}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 mb-6"
              >
                <h3 className="text-sm font-semibold text-white/80 mb-3">Reply to this cast</h3>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Post your reply..."
                  rows={3}
                  maxLength={500}
                  className="w-full bg-transparent border-none text-white placeholder-white/40 resize-none focus:outline-none focus:ring-0 text-base"
                  disabled={replyLoading}
                />
                {replyImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 max-w-xs">
                    {replyImages.map((src, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 aspect-square group">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeReplyImage(i)}
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
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={replyFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleReplyFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => replyFileInputRef.current?.click()}
                    disabled={replyLoading || replyImages.length >= MAX_REPLY_IMAGES}
                    className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    aria-label="Add image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                  </button>
                  {replyImages.length > 0 && (
                    <span className="text-white/40 text-sm">{replyImages.length}/{MAX_REPLY_IMAGES} images</span>
                  )}
                </div>
                {canTipWithReply && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs font-medium text-white/60 mb-2">Tip with reply (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {REPLY_TIP_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setReplyTipAmount(preset)}
                          disabled={replyLoading}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            replyTipAmount === preset
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'text-white/60 hover:text-white border border-white/10 hover:border-white/20 disabled:opacity-50'
                          }`}
                        >
                          {preset === 0 ? 'None' : `${preset} pts`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-white/40 text-sm">
                    {replyContent.length}/500
                    {replyTipAmount > 0 && (
                      <span className="ml-2 text-amber-400/80">+ {replyTipAmount} pts tip</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleReply}
                    disabled={(!replyContent.trim() && replyImages.length === 0) || replyLoading}
                    className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {replyLoading ? 'Posting...' : 'Reply'}
                  </button>
                </div>
                {replyError && <p className="mt-2 text-sm text-rose-400">{replyError}</p>}
              </motion.div>

              {/* Replies */}
              <motion.div variants={item}>
                <h3 className="text-lg font-semibold text-white mb-4">
                  Replies ({repliesTotal})
                </h3>
                {replies.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                    <p className="text-white/60">No replies yet. Be the first to reply.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {replies.map((reply) => (
                        <motion.div key={reply._id} variants={item}>
                          <CastCard
                            cast={reply}
                            token={token}
                            currentUserId={user?.id}
                            onLikeChange={handleLikeChange}
                            onBookmarkChange={(id, bookmarked) =>
                              setReplies((prev) =>
                                prev.map((c) => (c._id === id ? { ...c, bookmarkedByCurrentUser: bookmarked } : c))
                              )
                            }
                            onUpdate={(updated) => setReplies((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))}
                            onDelete={() => setReplies((prev) => prev.filter((c) => c._id !== reply._id))}
                            showAuthorLink
                            isReply
                            showThreadLink={false}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {hasMoreReplies && (
                      <div className="flex justify-center pt-4">
                        <button
                          type="button"
                          onClick={handleLoadMore}
                          disabled={loadingMore}
                          className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/30 disabled:opacity-50 transition-colors"
                        >
                          {loadingMore ? 'Loading...' : 'Load more replies'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </motion.div>
  )
}
