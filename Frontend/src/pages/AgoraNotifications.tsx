import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  getAgoraNotifications,
  markAgoraNotificationRead,
  markAllAgoraNotificationsRead,
  type AgoraNotification,
} from '../lib/api'

function formatTimeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (sec < 60) return 'now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getNotificationMessage(n: AgoraNotification): string {
  const name = n.fromUser?.username ?? n.fromUser?.email ?? 'Someone'
  switch (n.type) {
    case 'like':
      return `${name} liked your cast`
    case 'follow':
      return `${name} followed you`
    case 'reply':
      return `${name} replied to your cast`
    case 'tip': {
      const amount = n.metadata?.amount
      const isUserTip = n.referenceType === 'User'
      if (isUserTip) {
        return amount != null ? `${name} tipped you ${amount} pts` : `${name} tipped you`
      }
      return amount != null ? `${name} tipped ${amount} pts on your cast` : `${name} tipped your cast`
    }
    default:
      return `${name} interacted with you`
  }
}

function NotificationTypeIcon({ type }: { type: string }) {
  const base = 'w-6 h-6 rounded-full flex items-center justify-center shrink-0'
  switch (type) {
    case 'like':
      return (
        <div className={`${base} bg-rose-500/20 text-rose-400`}>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      )
    case 'follow':
      return (
        <div className={`${base} bg-indigo-500/20 text-indigo-400`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )
    case 'reply':
      return (
        <div className={`${base} bg-cyan-500/20 text-cyan-400`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </div>
      )
    case 'tip':
      return (
        <div className={`${base} bg-amber-500/20 text-amber-400`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )
    default:
      return (
        <div className={`${base} bg-white/10 text-white/60`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
      )
  }
}

function getNotificationLink(n: AgoraNotification): string {
  if (n.type === 'follow' && n.fromUser?._id) {
    return `/agora/user/${n.fromUser._id}`
  }
  if (n.type === 'tip' && n.referenceType === 'User' && n.fromUser?._id) {
    return `/agora/user/${n.fromUser._id}`
  }
  const postId = n.metadata?.postId ?? (n.referenceType === 'Post' ? n.referenceId : undefined)
  if (postId) return `/agora/thread/${postId}`
  return '/agora'
}

const item = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }

export default function AgoraNotifications() {
  const { isLoggedIn, token } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AgoraNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markAllLoading, setMarkAllLoading] = useState(false)

  const fetchNotifications = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      const res = await getAgoraNotifications(token, { page: pageNum, limit: 20 })
      if (append) setLoadingMore(false)
      else setLoading(false)
      if (!res.success || !res.data) return
      const list = res.data.notifications ?? []
      const pag = res.data.pagination
      setHasMore(pag ? pag.page < pag.totalPages : false)
      if (append) {
        setNotifications((prev) => {
          const ids = new Set(prev.map((x) => x.id))
          return [...prev, ...list.filter((x) => !ids.has(x.id))]
        })
      } else {
        setNotifications(list)
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
    fetchNotifications(1, false)
  }, [isLoggedIn, fetchNotifications, navigate])

  async function handleMarkRead(n: AgoraNotification) {
    if (n.read || !token) return
    const res = await markAgoraNotificationRead(token, n.id)
    if (res.success) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    }
  }

  async function handleMarkAllRead() {
    if (!token) return
    setMarkAllLoading(true)
    const res = await markAllAgoraNotificationsRead(token)
    setMarkAllLoading(false)
    if (res.success) {
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
    }
  }

  function handleLoadMore() {
    const next = page + 1
    setPage(next)
    fetchNotifications(next, true)
  }

  return (
    <motion.div
      className="relative max-w-2xl w-full min-w-0"
      initial="visible"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/10">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-white/50 text-sm">Your latest activity and interactions</p>
          </div>
        </div>
        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markAllLoading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/15 border border-indigo-500/20 disabled:opacity-50 transition-all"
          >
            {markAllLoading ? '...' : 'Mark all read'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded bg-white/10 w-3/4" />
                <div className="h-3 rounded bg-white/5 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <motion.div
          variants={item}
          className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-16 text-center"
        >
          <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/5 border border-white/10">
            <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-white/60 font-medium mb-1">No notifications yet</p>
          <p className="text-white/40 text-sm">Likes, follows, replies and tips will appear here</p>
        </motion.div>
      ) : (
        <div className="space-y-3 overflow-hidden min-w-0">
          {notifications.map((n) => {
            const link = getNotificationLink(n)
            const displayName = n.fromUser?.username ?? n.fromUser?.email ?? 'Someone'
            return (
              <motion.div key={n.id} variants={item} className="min-w-0">
                <Link
                  to={link}
                  onClick={() => handleMarkRead(n)}
                  className={`flex gap-4 rounded-2xl border px-4 py-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-500/5 min-w-0 ${
                    !n.read
                      ? 'bg-indigo-500/10 border-indigo-500/30 shadow-sm shadow-indigo-500/5'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border-2 border-white/10 text-white overflow-hidden ring-2 ring-white/5">
                      {n.fromUser?.profilePicture ? (
                        <img src={n.fromUser.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      <NotificationTypeIcon type={n.type} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-[15px] text-white/95 leading-snug font-medium break-words">{getNotificationMessage(n)}</p>
                    <time className="text-xs text-white/40 mt-1.5 block" dateTime={n.createdAt}>
                      {formatTimeAgo(n.createdAt)}
                    </time>
                  </div>
                  {!n.read && (
                    <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-indigo-400 mt-2 ring-2 ring-indigo-400/30" aria-hidden />
                  )}
                </Link>
              </motion.div>
            )
          })}
          {hasMore && (
            <motion.div variants={item} className="flex justify-center pt-6">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-3 rounded-xl text-sm font-medium text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 hover:bg-indigo-500/10 disabled:opacity-50 transition-all"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  )
}
