import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  likeAgoraCast,
  unlikeAgoraCast,
  updateAgoraCast,
  deleteAgoraCast,
  deleteAgoraReply,
  bookmarkAgoraCast,
  removeAgoraBookmark,
  tipAgoraPost,
  tipAgoraReply,
  reportAgoraPost,
  type AgoraCast,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import TipModal from './TipModal'
import ReportModal from './ReportModal'

export function formatTimeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (sec < 60) return 'now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type CastCardProps = {
  cast: AgoraCast
  token: string | null
  currentUserId?: string | null
  onLikeChange: (id: string, liked: boolean, likesCount: number) => void
  onBookmarkChange?: (id: string, bookmarked: boolean) => void
  onUpdate?: (cast: AgoraCast) => void
  onDelete?: () => void
  showAuthorLink?: boolean
  isReply?: boolean
  showThreadLink?: boolean
}

export default function CastCard({
  cast,
  token,
  currentUserId,
  onLikeChange,
  onBookmarkChange,
  onUpdate,
  onDelete,
  showAuthorLink = true,
  isReply = false,
  showThreadLink = true,
}: CastCardProps) {
  const [liking, setLiking] = useState(false)
  const [bookmarking, setBookmarking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(cast.content)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const { user, token: _authToken, refreshUser } = useAuth()

  const author = cast.user
  const displayName = author?.username ?? author?.email ?? 'Anonymous'
  const authorId = (author as { _id?: string })?._id
  const isOwn = !!currentUserId && authorId === currentUserId
  const canTip = !!token && !isOwn

  async function handleTip(amount: number) {
    if (!token) return { success: false, message: 'Not logged in' }
    const res = isReply
      ? await tipAgoraReply(token, cast._id, amount)
      : await tipAgoraPost(token, cast._id, amount)
    if (res.success && res.data) {
      await refreshUser()
    }
    return { success: res.success, message: res.message }
  }

  async function handleBookmark() {
    if (!token) return
    setBookmarking(true)
    const bookmarked = cast.bookmarkedByCurrentUser
    const res = bookmarked
      ? await removeAgoraBookmark(token, cast._id)
      : await bookmarkAgoraCast(token, cast._id)
    setBookmarking(false)
    if (res.success && res.data) {
      onBookmarkChange?.(cast._id, !bookmarked)
    }
  }

  async function handleLike() {
    if (!token) return
    setLiking(true)
    const liked = cast.likedByCurrentUser
    const res = liked
      ? await unlikeAgoraCast(token, cast._id)
      : await likeAgoraCast(token, cast._id)
    setLiking(false)
    if (res.success && res.data) {
      onLikeChange(cast._id, !liked, res.data.likesCount)
    }
  }

  async function handleSaveEdit() {
    const content = editContent.trim()
    if (!content || !token || content === cast.content) {
      setEditing(false)
      return
    }
    setEditError(null)
    setEditLoading(true)
    const res = await updateAgoraCast(token, cast._id, { content })
    setEditLoading(false)
    if (res.success && res.data?.post) {
      setEditing(false)
      onUpdate?.(res.data.post)
    } else {
      setEditError(res.message ?? 'Failed to update')
    }
  }

  async function handleDelete() {
    if (!token) return
    setDeleteLoading(true)
    const res = isReply
      ? await deleteAgoraReply(token, cast._id)
      : await deleteAgoraCast(token, cast._id)
    setDeleteLoading(false)
    setShowDeleteConfirm(false)
    if (res.success) {
      onDelete?.()
    }
  }

  const Avatar = (
    authorId && showAuthorLink ? (
      <Link
        to={`/agora/user/${authorId}`}
        className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-white/10 text-white hover:ring-2 hover:ring-indigo-400/50 transition-all overflow-hidden"
        aria-label={`View ${displayName}'s profile`}
      >
        {author?.profilePicture ? (
          <img src={author.profilePicture} alt="" className="w-full h-full object-cover" />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </Link>
    ) : (
      <div
        className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-white/10 text-white overflow-hidden"
        aria-hidden
      >
        {author?.profilePicture ? (
          <img src={author.profilePicture} alt="" className="w-full h-full object-cover" />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </div>
    )
  )

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-white/15 transition-colors">
      <div className="flex gap-4">
        {Avatar}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {authorId && showAuthorLink ? (
                <Link
                  to={`/agora/user/${authorId}`}
                  className="font-semibold text-white hover:text-indigo-400 transition-colors"
                >
                  {displayName}
                </Link>
              ) : (
                <span className="font-semibold text-white">{displayName}</span>
              )}
              <span className="text-white/50 text-sm">·</span>
              <time className="text-white/50 text-sm" dateTime={cast.createdAt}>
                {formatTimeAgo(cast.createdAt)}
              </time>
            </div>
            {isOwn && onUpdate && onDelete && (
              <div className="flex items-center gap-1">
                {!editing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditContent(cast.content)
                        setEditError(null)
                        setEditing(true)
                      }}
                      className="p-1.5 rounded-lg text-white/50 hover:text-indigo-400 hover:bg-white/5 transition-colors"
                      aria-label="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-1.5 rounded-lg text-white/50 hover:text-rose-400 hover:bg-white/5 transition-colors"
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
          {editing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                disabled={editLoading}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={editLoading || !editContent.trim() || editContent.trim() === cast.content}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
                >
                  {editLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setEditContent(cast.content)
                    setEditError(null)
                  }}
                  disabled={editLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                {editError && <span className="text-sm text-rose-400">{editError}</span>}
              </div>
            </div>
          ) : (
            <>
              <p className="text-white/90 whitespace-pre-wrap break-words leading-relaxed">
                {cast.content}
              </p>
              {cast.images && cast.images.length > 0 && (
                <div
                  className={`mt-3 rounded-xl overflow-hidden border border-white/10 ${
                    cast.images.length === 1
                      ? 'max-w-md'
                      : cast.images.length === 2
                        ? 'grid grid-cols-2 gap-1 max-w-md'
                        : 'grid grid-cols-2 gap-1 max-w-md'
                  }`}
                >
                  {cast.images.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                        cast.images!.length === 1 ? '' : 'aspect-square'
                      }`}
                    >
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-6 mt-4 flex-wrap">
                {showThreadLink && (
                  <Link
                    to={`/agora/thread/${cast._id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-indigo-400 transition-colors"
                    aria-label="View thread"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span>Thread</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLike}
                  disabled={!token || liking}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    cast.likedByCurrentUser
                      ? 'text-rose-400 hover:text-rose-300'
                      : 'text-white/60 hover:text-rose-400'
                  } disabled:opacity-50`}
                  aria-label={cast.likedByCurrentUser ? 'Unlike' : 'Like'}
                >
                  {cast.likedByCurrentUser ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  )}
                  <span>{cast.likesCount}</span>
                </button>
                {token && (
                  <button
                    type="button"
                    onClick={handleBookmark}
                    disabled={bookmarking}
                    className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                      cast.bookmarkedByCurrentUser
                        ? 'text-amber-400 hover:text-amber-300'
                        : 'text-white/60 hover:text-amber-400'
                    } disabled:opacity-50`}
                    aria-label={cast.bookmarkedByCurrentUser ? 'Remove bookmark' : 'Bookmark'}
                  >
                    <svg
                      className="w-5 h-5"
                      fill={cast.bookmarkedByCurrentUser ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    <span>{cast.bookmarkedByCurrentUser ? 'Saved' : 'Save'}</span>
                  </button>
                )}
                {canTip && (
                  <button
                    type="button"
                    onClick={() => setShowTipModal(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-amber-400 transition-colors"
                    aria-label="Tip"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Tip</span>
                  </button>
                )}
                {!isOwn && token && (
                  <button
                    type="button"
                    onClick={() => setShowReportModal(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-rose-400 transition-colors"
                    aria-label="Report"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2v4"
                      />
                    </svg>
                    <span>Report</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showTipModal && (
        <TipModal
          authorName={displayName}
          userBalance={user?.loyaltyPoints ?? 0}
          onConfirm={handleTip}
          onClose={() => setShowTipModal(false)}
        />
      )}

      {showReportModal && token && (
        <ReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          title={isReply ? 'Report this reply' : 'Report this cast'}
          onConfirm={async (reason) => {
            const res = await reportAgoraPost(token, cast._id, reason)
            return { success: res.success, message: res.message }
          }}
        />
      )}

      {showDeleteConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleteLoading && setShowDeleteConfirm(false)}
          >
            <div
              className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-2">Delete {isReply ? 'reply' : 'cast'}?</h3>
              <p className="text-white/70 text-sm mb-6">
                This cannot be undone.{!isReply && ' All replies will also be deleted.'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/20 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-400 disabled:opacity-50 transition-colors"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </article>
  )
}
