import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  getAgoraNotifications,
  markAgoraNotificationRead,
  markAllAgoraNotificationsRead,
  type AgoraNotification,
} from '../../lib/api'

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

type NotificationPanelProps = {
  isOpen: boolean
  onClose: () => void
  token: string
  anchorRef: React.RefObject<HTMLElement | null>
  onUnreadChange?: () => void
}

export default function NotificationPanel({ isOpen, onClose, token, anchorRef, onUnreadChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<AgoraNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markAllLoading, setMarkAllLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async (pageNum: number, append: boolean) => {
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
  }

  useEffect(() => {
    if (isOpen && token) {
      setPage(1)
      fetchNotifications(1, false)
    }
  }, [isOpen, token])

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [isOpen, onClose, anchorRef])

  async function handleMarkRead(n: AgoraNotification) {
    if (n.read) return
    const res = await markAgoraNotificationRead(token, n.id)
    if (res.success) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      onUnreadChange?.()
    }
  }

  async function handleMarkAllRead() {
    setMarkAllLoading(true)
    const res = await markAllAgoraNotificationsRead(token)
    setMarkAllLoading(false)
    if (res.success) {
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
      onUnreadChange?.()
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 flex flex-col rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-xl overflow-hidden z-[60] min-w-0 w-[min(260px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] max-h-[50vh] sm:w-[min(320px,calc(100vw-1.5rem))] sm:max-w-[calc(100vw-1.5rem)] sm:max-h-[60vh] md:w-[min(380px,calc(100vw-1.5rem))] md:max-w-[calc(100vw-1.5rem)] md:max-h-[480px]"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 min-w-0 shrink-0">
        <h3 className="text-base font-semibold text-white truncate">Notifications</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markAllLoading}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50 shrink-0"
          >
            {markAllLoading ? '...' : 'Mark all read'}
          </button>
        )}
      </div>
      <div className="overflow-y-auto overflow-x-hidden flex-1 min-w-0">
        {loading ? (
          <div className="py-12 text-center text-white/50 text-sm">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-white/50 text-sm">No notifications yet.</div>
        ) : (
          <div className="divide-y divide-white/5 min-w-0">
            {notifications.map((n) => {
              const link = getNotificationLink(n)
              const displayName = n.fromUser?.username ?? n.fromUser?.email ?? 'Someone'
              return (
                <Link
                  key={n.id}
                  to={link}
                  onClick={() => {
                    handleMarkRead(n)
                    onClose()
                  }}
                  className={`flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors min-w-0 ${!n.read ? 'bg-indigo-500/5' : ''}`}
                >
                  <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-white/10 text-white overflow-hidden">
                    {n.fromUser?.profilePicture ? (
                      <img src={n.fromUser.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm text-white/90 leading-snug break-words">{getNotificationMessage(n)}</p>
                    <time className="text-xs text-white/40 mt-0.5 block" dateTime={n.createdAt}>
                      {formatTimeAgo(n.createdAt)}
                    </time>
                  </div>
                  {!n.read && (
                    <div className="shrink-0 w-2 h-2 rounded-full bg-indigo-400 mt-2" aria-hidden />
                  )}
                </Link>
              )
            })}
          </div>
        )}
        {hasMore && !loading && (
          <div className="p-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                const next = page + 1
                setPage(next)
                fetchNotifications(next, true)
              }}
              disabled={loadingMore}
              className="w-full py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
