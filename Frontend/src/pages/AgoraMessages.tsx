import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import {
  getAgoraConversations,
  getOrCreateAgoraConversation,
  getAgoraMessages,
  updateAgoraMessage,
  deleteAgoraMessage,
  listAgoraUsers,
  type AgoraConversation,
  type AgoraMessage,
  type AgoraListedUser,
} from '../lib/api'

const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const item = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }

function DeleteMessageModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-2">Delete message?</h3>
        <p className="text-white/70 text-sm mb-6">This cannot be undone.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => !loading && onCancel()}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-400 disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

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

export default function AgoraMessages() {
  const { id: conversationId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const withUserId = searchParams.get('with')
  const navigate = useNavigate()
  const creatingForUserIdRef = useRef<string | null>(null)
  const { isLoggedIn, user, token } = useAuth()
  const socket = useSocket(token)

  const [conversations, setConversations] = useState<AgoraConversation[]>([])
  const [openingUserId, setOpeningUserId] = useState<string | null>(null)
  const [openConversationError, setOpenConversationError] = useState<string | null>(null)
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [messages, setMessages] = useState<AgoraMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<AgoraListedUser[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const currentConv = conversations.find((c) => c.id === conversationId)
  const otherUser = currentConv?.otherUser
  const otherName = otherUser?.username ?? otherUser?.email ?? 'Unknown'

  const fetchConversations = useCallback(async () => {
    if (!token) return
    setConversationsLoading(true)
    const res = await getAgoraConversations(token, { page: 1, limit: 50 })
    setConversationsLoading(false)
    if (res.success && res.data?.conversations) {
      setConversations(res.data.conversations)
    }
  }, [token])

  const fetchMessages = useCallback(
    async (convId: string) => {
      if (!token) return
      setMessagesLoading(true)
      const res = await getAgoraMessages(token, convId, { page: 1, limit: 50 })
      setMessagesLoading(false)
      if (res.success && res.data?.messages) {
        setMessages(res.data.messages)
      } else {
        setMessages([])
      }
    },
    [token]
  )

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    fetchConversations()
  }, [isLoggedIn, fetchConversations])

  const openConversationWithUser = useCallback(
    async (otherUserId: string) => {
      if (!token) return
      setOpeningUserId(otherUserId)
      setOpenConversationError(null)
      setNewMessageOpen(false)
      try {
        const res = await getOrCreateAgoraConversation(token, otherUserId)
        if (res.success && res.data?.conversation) {
          const conv = res.data.conversation
          const convId = typeof conv.id === 'string' ? conv.id : String(conv.id)
          setConversations((prev) => {
            const exists = prev.some((c) => (c.id === convId || c.id === conv.id))
            if (exists) return prev.map((c) => (c.id === convId || c.id === conv.id ? { ...conv, id: convId } : c))
            return [{ ...conv, id: convId }, ...prev]
          })
          navigate(`/agora/messages/${convId}`, { replace: true })
        } else {
          setOpenConversationError(res.message ?? 'Could not open conversation')
        }
      } catch {
        setOpenConversationError('Could not open conversation')
      } finally {
        setOpeningUserId(null)
      }
    },
    [token, navigate]
  )

  useEffect(() => {
    if (!withUserId || !token) return
    if (creatingForUserIdRef.current === withUserId) return
    creatingForUserIdRef.current = withUserId
    openConversationWithUser(withUserId).finally(() => {
      creatingForUserIdRef.current = null
    })
  }, [withUserId, token, openConversationWithUser])

  const searchUsers = useCallback(
    async (q: string) => {
      if (!token || !q.trim()) {
        setUserSearchResults([])
        return
      }
      setUserSearchLoading(true)
      const res = await listAgoraUsers({ page: 1, limit: 20, q: q.trim() }, token)
      setUserSearchLoading(false)
      if (res.success && res.data?.users) {
        const excludeSelf = res.data.users.filter((u) => u.id !== user?.id)
        setUserSearchResults(excludeSelf)
      } else {
        setUserSearchResults([])
      }
    },
    [token, user?.id]
  )

  useEffect(() => {
    if (!newMessageOpen) return
    const t = setTimeout(() => searchUsers(userSearch), 300)
    return () => clearTimeout(t)
  }, [newMessageOpen, userSearch, searchUsers])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    fetchMessages(conversationId)
  }, [conversationId, fetchMessages])

  useEffect(() => {
    if (!conversationId) return
    socket.joinConversation(conversationId).catch(() => {})
    const cid = conversationId
    return (): void => {
      socket.leaveConversation(cid)
    }
  }, [conversationId, socket.joinConversation, socket.leaveConversation])

  useEffect(() => {
    const s = socket.socket
    if (!s) return
    const handler = (msg: { id: string; conversationId: string; sender: { _id: string }; content: string; createdAt: string }) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg.id)) return prev
          return [...prev, { _id: msg.id, conversation: msg.conversationId, sender: msg.sender, content: msg.content, createdAt: msg.createdAt }]
        })
      }
    }
    const onEdited = (msg: { id: string; conversationId: string; content: string; editedAt?: string }) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === msg.id ? { ...m, content: msg.content, editedAt: msg.editedAt } : m))
        )
      }
    }
    const onDeleted = (payload: { conversationId: string; messageId: string }) => {
      if (payload.conversationId === conversationId) {
        setMessages((prev) => prev.filter((m) => m._id !== payload.messageId))
      }
    }
    s.on('new_message', handler)
    s.on('message_edited', onEdited)
    s.on('message_deleted', onDeleted)
    return () => {
      s.off('new_message', handler)
      s.off('message_edited', onEdited)
      s.off('message_deleted', onDeleted)
    }
  }, [socket.socket, conversationId])

  useEffect(() => {
    const s = socket.socket
    if (!s) return
    const onTyping = (p: { conversationId: string; username?: string }) => {
      if (p.conversationId === conversationId) setTypingUser(p.username ?? 'Someone')
    }
    const onStop = (p: { conversationId: string }) => {
      if (p.conversationId === conversationId) setTypingUser(null)
    }
    s.on('user_typing', onTyping)
    s.on('user_stopped_typing', onStop)
    return () => {
      s.off('user_typing', onTyping)
      s.off('user_stopped_typing', onStop)
      setTypingUser(null)
    }
  }, [socket.socket, conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const content = input.trim()
    if (!content || !conversationId || !token) return
    setSending(true)
    try {
      const msg = await socket.sendMessage(conversationId, content)
      setInput('')
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg.id)) return prev
        return [...prev, { _id: msg.id, conversation: msg.conversationId, sender: msg.sender, content: msg.content, createdAt: msg.createdAt }]
      })
    } catch {
      // Error - could show toast
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleEdit(msg: AgoraMessage) {
    const content = editContent.trim()
    if (!content || !conversationId || !token) return
    setEditLoading(true)
    const res = await updateAgoraMessage(token, conversationId, msg._id, content)
    setEditLoading(false)
    if (res.success && res.data?.message) {
      setMessages((prev) =>
        prev.map((m) => (m._id === msg._id ? { ...m, ...res.data!.message } : m))
      )
      setEditingId(null)
      setEditContent('')
    }
  }

  async function handleDelete(msgId: string) {
    if (!conversationId || !token) return
    setDeleteLoading(true)
    const res = await deleteAgoraMessage(token, conversationId, msgId)
    setDeleteLoading(false)
    setDeleteConfirmId(null)
    if (res.success) {
      setMessages((prev) => prev.filter((m) => m._id !== msgId))
    }
  }

  const isOwn = (senderId: string) => user?.id === senderId || (senderId && user?.id === senderId)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden overflow-y-auto">
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
      <div className="pt-24 pb-6 px-4 relative z-10 h-screen">
        <motion.div
          className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4 h-full max-h-[calc(100vh-8rem)]"
          initial="visible"
          animate="visible"
          variants={container}
        >
          {/* Sidebar - conversations list */}
          <motion.div
            variants={item}
            className={`w-full sm:w-80 shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-xl ${
              conversationId ? 'hidden sm:block' : ''
            }`}
          >
            <div className="p-4 border-b border-white/10 bg-white/5">
              <Link
                to="/agora"
                className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium mb-3 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Agora
              </Link>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-white/10 shrink-0">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-white">Messages</h2>
                    <p className="text-white/50 text-xs">Your conversations</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setNewMessageOpen(true); setOpenConversationError(null) }}
                  className="shrink-0 p-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 transition-colors"
                  title="New message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {conversationsLoading ? (
                <div className="p-8 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-white/10 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 rounded bg-white/10 w-1/2" />
                        <div className="h-3 rounded bg-white/5 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/5 border border-white/10">
                    <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-white/50 text-sm">No conversations yet</p>
                  <p className="text-white/40 text-xs mt-1">Message someone from their profile</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const name = conv.otherUser?.username ?? conv.otherUser?.email ?? 'Unknown'
                  const pic = conv.otherUser?.profilePicture
                  const isActive = conv.id === conversationId
                  return (
                    <Link
                      key={conv.id}
                      to={`/agora/messages/${conv.id}`}
                      className={`block p-4 mx-2 my-1.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-indigo-500/15 border border-indigo-500/30 shadow-lg shadow-indigo-500/5'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border-2 border-white/10 text-white overflow-hidden">
                            {pic ? (
                              <img src={pic} alt="" className="w-full h-full object-cover" />
                            ) : (
                              name.charAt(0).toUpperCase()
                            )}
                          </div>
                          {conv.lastMessage && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a0a0f]" title="Active" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white truncate">{name}</p>
                          <p className="text-white/50 text-sm truncate">
                            {conv.lastMessage?.content ?? 'No messages yet'}
                          </p>
                        </div>
                        {conv.lastMessage && (
                          <span className="text-white/40 text-xs shrink-0">
                            {formatTimeAgo(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </motion.div>

          {/* New message modal */}
          {newMessageOpen &&
            createPortal(
              <div
                className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={() => setNewMessageOpen(false)}
              >
                <div
                  className="rounded-2xl border border-white/10 bg-[#0a0a0f] w-full max-w-md shadow-xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">New message</h3>
                    <button
                      type="button"
                      onClick={() => setNewMessageOpen(false)}
                      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-3 border-b border-white/10">
                    <input
                      type="text"
                      placeholder="Search by username or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {userSearchLoading ? (
                      <div className="p-8 text-center text-white/50 text-sm">Searching...</div>
                    ) : !userSearch.trim() ? (
                      <div className="p-8 text-center text-white/50 text-sm">Type a name to find someone to message</div>
                    ) : userSearchResults.length === 0 ? (
                      <div className="p-8 text-center text-white/50 text-sm">No users found</div>
                    ) : (
                      userSearchResults.map((u) => {
                        const name = u.username ?? u.email ?? 'Unknown'
                        const isOpening = openingUserId === u.id
                        return (
                          <button
                            key={u.id}
                            type="button"
                            disabled={!!openingUserId}
                            onClick={() => openConversationWithUser(u.id)}
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors disabled:opacity-60"
                          >
                            <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border-2 border-white/10 text-white overflow-hidden shrink-0">
                              {u.profilePicture ? (
                                <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                              ) : (
                                name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white truncate">{name}</p>
                              {u.email && u.username && (
                                <p className="text-white/50 text-sm truncate">{u.email}</p>
                              )}
                            </div>
                            {isOpening && (
                              <span className="text-indigo-400 text-xs shrink-0">Opening...</span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>,
              document.body
            )}

          {/* Main - conversation thread or empty state */}
          <motion.div
            variants={item}
            className="flex-1 min-w-0 min-h-0 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden flex flex-col shadow-xl"
          >
            {!conversationId ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center max-w-sm">
                  {openingUserId && (
                    <p className="text-indigo-400 text-sm mb-4">Opening conversation...</p>
                  )}
                  {openConversationError && (
                    <p className="text-rose-400 text-sm mb-4">{openConversationError}</p>
                  )}
                  <div className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-white/10">
                    <svg className="w-12 h-12 text-indigo-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Your messages</h3>
                  <p className="text-white/50 text-sm mb-6">Select a conversation or message someone from their profile.</p>
                  <Link
                    to="/agora"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
                  >
                    Browse Agora
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3">
                  <Link
                    to="/agora"
                    className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                    aria-label="Back to Agora"
                    title="Back to Agora"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>
                  <Link
                    to={otherUser?._id ? `/agora/user/${otherUser._id}` : '/agora/messages'}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold shrink-0 bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border-2 border-white/10 text-white overflow-hidden ring-2 ring-white/5">
                      {otherUser?.profilePicture ? (
                        <img src={otherUser.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        otherName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{otherName}</p>
                      {typingUser && (
                        <p className="text-indigo-400 text-xs flex items-center gap-1.5">
                          <span className="inline-flex gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                          {typingUser} typing...
                        </p>
                      )}
                    </div>
                  </Link>
                </div>

                <div
                  ref={messagesContainerRef}
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 bg-gradient-to-b from-white/[0.02] to-transparent"
                >
                  {messagesLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <p className="text-white/50 text-sm">Loading messages...</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => {
                        const own = isOwn(typeof msg.sender === 'object' ? msg.sender?._id : '')
                        const isEditing = editingId === msg._id
                        const showMenu = menuOpenId === msg._id
                        return (
                          <div
                            key={msg._id}
                            className={`flex ${own ? 'justify-end' : 'justify-start'} group`}
                          >
                            <div
                              className={`relative max-w-[80%] rounded-2xl px-4 py-3 shadow-lg ${
                                own
                                  ? 'bg-gradient-to-br from-indigo-500/40 to-indigo-600/30 text-white rounded-br-md border border-indigo-400/20'
                                  : 'bg-white/10 text-white/90 rounded-bl-md border border-white/10'
                              }`}
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    rows={3}
                                    maxLength={2000}
                                    disabled={editLoading}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(msg)}
                                      disabled={editLoading || !editContent.trim()}
                                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50"
                                    >
                                      {editLoading ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingId(null)
                                        setEditContent('')
                                      }}
                                      disabled={editLoading}
                                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/80 hover:text-white"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-start gap-1">
                                    <p className="whitespace-pre-wrap break-words flex-1 min-w-0">
                                      {msg.content}
                                    </p>
                                    {own && (
                                      <div className="relative shrink-0">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            if (showMenu) {
                                              setMenuOpenId(null)
                                            } else {
                                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                              setMenuPosition({ top: rect.bottom + 4, left: rect.right - 120 })
                                              setMenuOpenId(msg._id)
                                            }
                                          }}
                                          className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                                          aria-label="Message options"
                                        >
                                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                          </svg>
                                        </button>
                                        {showMenu && menuPosition &&
                                          createPortal(
                                            <>
                                              <div
                                                className="fixed inset-0 z-[9998]"
                                                onClick={() => { setMenuOpenId(null); setMenuPosition(null) }}
                                                aria-hidden
                                              />
                                              <div
                                                className="fixed z-[9999] py-1 rounded-lg bg-[#1a1a24] border border-white/10 shadow-xl min-w-[120px]"
                                                style={{
                                                  top: menuPosition.top,
                                                  left: Math.max(16, Math.min(menuPosition.left, window.innerWidth - 136)),
                                                }}
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditingId(msg._id)
                                                    setEditContent(msg.content)
                                                    setMenuOpenId(null)
                                                  }}
                                                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10"
                                                >
                                                  Edit
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setDeleteConfirmId(msg._id)
                                                    setMenuOpenId(null)
                                                  }}
                                                  className="w-full px-4 py-2 text-left text-sm text-rose-400 hover:bg-white/10"
                                                >
                                                  Delete
                                                </button>
                                              </div>
                                            </>,
                                            document.body
                                          )}
                                      </div>
                                    )}
                                  </div>
                                  <p className={`text-xs mt-1 flex items-center gap-2 ${own ? 'text-indigo-200/80' : 'text-white/50'}`}>
                                    {msg.editedAt && (
                                      <span className="italic">edited</span>
                                    )}
                                    {formatTimeAgo(msg.createdAt)}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                <div className="p-4 border-t border-white/10 bg-white/5">
                  <div className="flex gap-3 items-center">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => socket.typingStart(conversationId)}
                      onBlur={() => socket.typingStop(conversationId)}
                      placeholder="Type a message..."
                      rows={2}
                      maxLength={2000}
                      disabled={sending}
                      className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 disabled:opacity-50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="h-12 min-w-[100px] px-5 rounded-2xl font-semibold bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                      <span>{sending ? 'Sending...' : 'Send'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
        {deleteConfirmId && (
          <DeleteMessageModal
            onConfirm={() => handleDelete(deleteConfirmId)}
            onCancel={() => setDeleteConfirmId(null)}
            loading={deleteLoading}
          />
        )}
      </div>
    </div>
  )
}

