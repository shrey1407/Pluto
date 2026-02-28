import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { usePointsDeduction } from '../hooks/usePointsDeduction'
import {
  getEmailIntegrationStatus,
  getGmailConnectUrl,
  disconnectGmail,
  syncGmail,
  listEmailTasks,
  getEmailByMessageId,
  suggestEmailReply,
  sendEmailReply,
  type EmailIntegrationStatus,
  type EmailTaskItem,
  COST_EMAIL_TASKS,
  COST_EMAIL_SUGGEST_REPLY,
} from '../lib/api'

export default function Integrations() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isLoggedIn, token } = useAuth()
  const { triggerDeduction } = usePointsDeduction()
  const [status, setStatus] = useState<EmailIntegrationStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [syncLoading, setSyncLoading] = useState(false)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasks, setTasks] = useState<EmailTaskItem[]>([])
  const [selectedTask, setSelectedTask] = useState<EmailTaskItem | null>(null)
  const [emailDetail, setEmailDetail] = useState<{
    email: { subject: string; from: string; bodyPlain?: string; snippet: string; date: string }
    task: { _id: string; suggestedReply?: string; replySentAt?: string }
  } | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [userMessage, setUserMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
  }, [isLoggedIn, navigate])

  function refetchStatus() {
    if (!token) return
    setStatusLoading(true)
    getEmailIntegrationStatus(token)
      .then((res) => {
        if (res.success && res.data) setStatus(res.data)
        else setStatus(null)
      })
      .finally(() => setStatusLoading(false))
  }

  useEffect(() => {
    if (!token) {
      setStatus(null)
      setStatusLoading(false)
      return
    }
    refetchStatus()
  }, [token])

  useEffect(() => {
    const gmail = searchParams.get('gmail')
    const err = searchParams.get('error')
    if (gmail === 'connected') setSuccess('Gmail connected successfully.')
    if (err) setError(err === 'exchange_failed' ? 'Could not connect Gmail. Try again.' : `Error: ${err}`)
  }, [searchParams])

  async function handleConnectGmail() {
    if (!token) return
    setError(null)
    const res = await getGmailConnectUrl(token)
    if (res.success && res.data?.url) {
      window.location.href = res.data.url
    } else {
      setError(res.message ?? 'Could not get connect URL. Set GOOGLE_CLIENT_SECRET on the server.')
    }
  }

  async function handleDisconnectGmail() {
    if (!token) return
    if (!confirm('Disconnect Gmail? Synced emails and tasks will be removed.')) return
    setError(null)
    const res = await disconnectGmail(token)
    if (res.success) {
      setStatus(null)
      setTasks([])
      setSelectedTask(null)
      setEmailDetail(null)
      setSuccess('Gmail disconnected.')
    } else setError(res.message ?? 'Failed to disconnect')
  }

  async function handleSync() {
    if (!token) return
    setError(null)
    setSyncLoading(true)
    const res = await syncGmail(token)
    setSyncLoading(false)
    if (res.success) {
      refetchStatus()
      setSuccess(res.data ? `Synced ${res.data.synced} emails.` : 'Sync complete.')
    } else setError(res.message ?? 'Sync failed')
  }

  async function handleListTasks() {
    if (!token) return
    setError(null)
    setTasksLoading(true)
    const res = await listEmailTasks(token)
    setTasksLoading(false)
    if (res.success && res.data) {
      setTasks(res.data.tasks ?? [])
      if (res.data.newBalance != null) triggerDeduction(res.data.newBalance, COST_EMAIL_TASKS)
      setSuccess(res.data.tasks?.length ? `Found ${res.data.tasks.length} tasks.` : 'No tasks need action. Sync first.')
    } else setError(res.message ?? 'Failed to list tasks')
  }

  async function openTask(task: EmailTaskItem) {
    if (!token) return
    setSelectedTask(task)
    setEmailDetail(null)
    setReplyDraft('')
    setUserMessage('')
    setError(null)
    const res = await getEmailByMessageId(token, task.syncedEmail.messageId)
    if (res.success && res.data) {
      setEmailDetail({
        email: res.data.email,
        task: res.data.task ?? { _id: task._id, suggestedReply: undefined, replySentAt: undefined },
      })
      setReplyDraft(res.data.task?.suggestedReply ?? '')
    } else setError(res.message ?? 'Could not load email')
  }

  async function handleSuggestReply() {
    if (!token || !selectedTask) return
    setError(null)
    setSuggestLoading(true)
    const res = await suggestEmailReply(token, selectedTask._id, { userMessage: userMessage || undefined })
    setSuggestLoading(false)
    if (res.success && res.data) {
      setReplyDraft(res.data.suggestedReply ?? '')
      if (res.data.newBalance != null) triggerDeduction(res.data.newBalance, COST_EMAIL_SUGGEST_REPLY)
    } else setError(res.message ?? 'Failed to suggest reply')
  }

  async function handleSendReply() {
    if (!token || !selectedTask || !replyDraft.trim()) return
    if (!confirm('Send this reply via Gmail?')) return
    setError(null)
    setSendLoading(true)
    const taskId = selectedTask._id
    const res = await sendEmailReply(token, taskId, { confirmedReply: replyDraft.trim() })
    setSendLoading(false)
    if (res.success) {
      setSuccess('Reply sent.')
      setSelectedTask(null)
      setEmailDetail(null)
      setTasks((prev) => prev.filter((t) => t._id !== taskId))
    } else setError(res.message ?? 'Failed to send')
  }

  if (!isLoggedIn) return null

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />
      <div className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Integrations</h1>
        <p className="text-white/60 text-sm mb-6">
          Connect Gmail to sync emails, get AI-generated tasks (replies needed, follow-ups), and send replies with one click.
        </p>

        <AnimatePresence mode="wait">
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm"
            >
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gmail */}
        <section className="rounded-2xl border border-white/15 bg-white/[0.06] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-xl">📧</span> Gmail
          </h2>
          {statusLoading ? (
            <p className="text-white/50 text-sm">Loading…</p>
          ) : status?.gmail?.connected ? (
            <div>
              <p className="text-white/80 text-sm mb-2">{status.gmail.email}</p>
              <p className="text-white/50 text-xs mb-4">
                Last synced: {status.gmail.lastSyncedAt ? new Date(status.gmail.lastSyncedAt).toLocaleString() : 'Never'} · {status.gmail.syncedCount ?? 0} emails stored
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-500/80 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {syncLoading ? 'Syncing…' : 'Sync emails'}
                </button>
                <button
                  type="button"
                  onClick={handleListTasks}
                  disabled={tasksLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500/80 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {tasksLoading ? 'Analyzing…' : `List tasks (${COST_EMAIL_TASKS} pts)`}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectGmail}
                  className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 text-sm"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-white/60 text-sm mb-4">Connect Gmail to sync inbox and get AI-suggested replies.</p>
              <button
                type="button"
                onClick={handleConnectGmail}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-600 text-white font-medium"
              >
                Connect Gmail
              </button>
            </div>
          )}
        </section>

        {/* Task list */}
        {status?.gmail?.connected && tasks.length > 0 && (
          <section className="rounded-2xl border border-white/15 bg-white/[0.06] p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Email tasks</h2>
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t._id}>
                  <button
                    type="button"
                    onClick={() => openTask(t)}
                    className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                  >
                    <p className="font-medium text-white text-sm">{t.title}</p>
                    <p className="text-white/50 text-xs truncate">{t.syncedEmail.subject} · {t.syncedEmail.from}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Task detail modal */}
        <AnimatePresence>
          {selectedTask && emailDetail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              onClick={() => !sendLoading && setSelectedTask(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0f172a] p-6 max-h-[90vh] overflow-y-auto"
              >
                <h3 className="font-semibold text-white mb-2">{emailDetail.email.subject}</h3>
                <p className="text-white/50 text-xs mb-2">From: {emailDetail.email.from}</p>
                <div className="text-white/70 text-sm mb-4 whitespace-pre-wrap border-b border-white/10 pb-4">
                  {emailDetail.email.bodyPlain || emailDetail.email.snippet}
                </div>
                {emailDetail.task.replySentAt ? (
                  <p className="text-emerald-400 text-sm">Reply sent.</p>
                ) : (
                  <>
                    <label className="block text-sm text-white/70 mb-1">Your reply (edit if needed)</label>
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      rows={6}
                      className="w-full rounded-xl bg-white/5 border border-white/15 p-3 text-white text-sm resize-none mb-2"
                      placeholder="Reply text…"
                    />
                    <input
                      type="text"
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      placeholder="Optional: e.g. Make it shorter, more formal"
                      className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white text-sm mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSuggestReply}
                        disabled={suggestLoading}
                        className="px-4 py-2 rounded-xl bg-amber-500/80 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
                      >
                        {suggestLoading ? '…' : `Suggest reply (${COST_EMAIL_SUGGEST_REPLY} pts)`}
                      </button>
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendLoading || !replyDraft.trim()}
                        className="px-4 py-2 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                      >
                        {sendLoading ? 'Sending…' : 'Send reply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTask(null)}
                        className="px-4 py-2 rounded-xl border border-white/20 text-white/70"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
