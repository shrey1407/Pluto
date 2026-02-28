import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { usePointsDeduction, PointsDeductionBadge } from '../hooks/usePointsDeduction'
import PulseBot3DScene from '../components/pulsebot/PulseBot3DScene'
import {
  apiUrl,
  getPulseBotMe,
  createPulseBotLinkCode,
  generatePulseBotSummary,
  pulsebotAsk,
  getGmailDigest,
  getTelegramDigest,
  COST_PULSEBOT_SUMMARY,
  COST_PULSEBOT_ASK,
  type PulseBotMe,
  type GmailDigest,
  type TelegramDigest,
} from '../lib/api'
import {
  getEmailIntegrationStatus,
  getGmailConnectUrl,
  disconnectGmail,
  syncGmail,
  listEmailTasks,
  scheduleEmail,
  listScheduledEmails,
  getScheduledEmail,
  updateScheduledEmail,
  deleteScheduledEmail,
  getEmailByMessageId,
  suggestEmailReply,
  sendEmailReply,
  type EmailIntegrationStatus,
  type EmailTaskItem,
  type ScheduledEmailItem,
  COST_EMAIL_TASKS,
  COST_EMAIL_SUGGEST_REPLY,
} from '../lib/api'

const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }
const item = {
  hidden: { opacity: 0, y: 24, rotateX: -8 },
  visible: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring' as const, damping: 24, stiffness: 200 } },
}

const cardHover = { rotateY: 1.5, rotateX: -1, scale: 1.008, transition: { type: 'spring' as const, damping: 20 } }
const cardTap = { scale: 0.99 }

/** If Gmail last sync is older than this, we auto-sync before loading insights so DB stays updated without manual "Sync emails". */
const AUTO_SYNC_THROTTLE_MS = 5 * 60 * 1000 // 5 minutes

export default function PulseBot() {
  const { isLoggedIn, token } = useAuth()
  const { displayedPoints, pointsDeduction, triggerDeduction } = usePointsDeduction()
  const [me, setMe] = useState<PulseBotMe | null>(null)
  const [meLoading, setMeLoading] = useState(true)
  const [linkCode, setLinkCode] = useState<{
    code: string
    botUrl: string
    instructions: string
    expiresInMinutes: number
  } | null>(null)
  const [linkCodeLoading, setLinkCodeLoading] = useState(false)
  const [linkCodeError, setLinkCodeError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [gmailDigest, setGmailDigest] = useState<GmailDigest | null>(null)
  const [telegramDigest, setTelegramDigest] = useState<TelegramDigest | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)

  // Email (Gmail) integration state
  const [searchParams] = useSearchParams()
  const [emailStatus, setEmailStatus] = useState<EmailIntegrationStatus | null>(null)
  const [emailStatusLoading, setEmailStatusLoading] = useState(true)
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
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)

  const [scheduledTo, setScheduledTo] = useState('')
  const [scheduledSubject, setScheduledSubject] = useState('')
  const [scheduledBody, setScheduledBody] = useState('')
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day}T${h}:${min}`
  })
  const [scheduledList, setScheduledList] = useState<ScheduledEmailItem[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [editingScheduledId, setEditingScheduledId] = useState<string | null>(null)

  function refetchMe() {
    if (!token) return
    setMeLoading(true)
    getPulseBotMe(token)
      .then((res) => {
        if (res.success && res.data) setMe(res.data)
        else setMe(null)
      })
      .finally(() => setMeLoading(false))
  }

  useEffect(() => {
    if (!token) {
      setMe(null)
      setMeLoading(false)
      return
    }
    refetchMe()
  }, [token])

  function refetchEmailStatus() {
    if (!token) return
    setEmailStatusLoading(true)
    getEmailIntegrationStatus(token)
      .then((res) => {
        if (res.success && res.data) setEmailStatus(res.data)
        else setEmailStatus(null)
      })
      .finally(() => setEmailStatusLoading(false))
  }

  useEffect(() => {
    if (!token) {
      setEmailStatus(null)
      setEmailStatusLoading(false)
      return
    }
    refetchEmailStatus()
  }, [token])

  useEffect(() => {
    if (!token) {
      setGmailDigest(null)
      setTelegramDigest(null)
      return
    }
    if (!me?.linked && !emailStatus?.gmail?.connected) {
      setGmailDigest(null)
      setTelegramDigest(null)
      return
    }
    loadDigest()
  }, [token, me?.linked, emailStatus?.gmail?.connected, emailStatusLoading])

  useEffect(() => {
    const gmail = searchParams.get('gmail')
    const err = searchParams.get('error')
    if (gmail === 'connected') setEmailSuccess('Gmail connected successfully.')
    if (err) setEmailError(err === 'exchange_failed' ? 'Could not connect Gmail. Try again.' : `Error: ${err}`)
  }, [searchParams])

  async function handleConnectGmail() {
    if (!token) return
    setEmailError(null)
    const res = await getGmailConnectUrl(token)
    if (res.success && res.data?.url) {
      window.location.href = res.data.url
    } else {
      setEmailError(res.message ?? 'Could not get connect URL.')
    }
  }

  async function handleDisconnectGmail() {
    if (!token) return
    if (!confirm('Disconnect Gmail? Synced emails and tasks will be removed.')) return
    setEmailError(null)
    const res = await disconnectGmail(token)
    if (res.success) {
      setEmailStatus(null)
      setTasks([])
      setSelectedTask(null)
      setEmailDetail(null)
      setEmailSuccess('Gmail disconnected.')
    } else setEmailError(res.message ?? 'Failed to disconnect')
  }

  async function handleSync() {
    if (!token) return
    setEmailError(null)
    setSyncLoading(true)
    const res = await syncGmail(token)
    setSyncLoading(false)
    if (res.success) {
      refetchEmailStatus()
      setEmailSuccess(res.data ? (res.data as { message?: string }).message ?? `Synced ${res.data.synced} of ${res.data.total} emails` : 'Sync complete.')
    } else setEmailError(res.message ?? 'Sync failed')
  }

  async function handleListTasks() {
    if (!token) return
    setEmailError(null)
    setTasksLoading(true)
    const res = await listEmailTasks(token)
    setTasksLoading(false)
    if (res.success && res.data) {
      const taskList = Array.isArray(res.data.tasks) ? res.data.tasks : []
      setTasks(taskList)
      if (res.data.newBalance != null) triggerDeduction(res.data.newBalance, COST_EMAIL_TASKS)
      setEmailSuccess(taskList.length ? '' : 'No tasks need action. Sync first.')
    } else setEmailError(res.message ?? 'Failed to list tasks')
  }

  async function openTask(task: EmailTaskItem) {
    if (!token) return
    setSelectedTask(task)
    setEmailDetail(null)
    setReplyDraft('')
    setUserMessage('')
    setEmailError(null)
    const res = await getEmailByMessageId(token, task.syncedEmail.messageId)
    if (res.success && res.data) {
      setEmailDetail({
        email: res.data.email,
        task: res.data.task ?? { _id: task._id, suggestedReply: undefined, replySentAt: undefined },
      })
      setReplyDraft(res.data.task?.suggestedReply ?? '')
    } else setEmailError(res.message ?? 'Could not load email')
  }

  async function handleSuggestReply() {
    if (!token || !selectedTask) return
    setEmailError(null)
    setSuggestLoading(true)
    const res = await suggestEmailReply(token, selectedTask._id, { userMessage: userMessage || undefined })
    setSuggestLoading(false)
    if (res.success && res.data) {
      setReplyDraft(res.data.suggestedReply ?? '')
      if (res.data.newBalance != null) triggerDeduction(res.data.newBalance, COST_EMAIL_SUGGEST_REPLY)
    } else setEmailError(res.message ?? 'Failed to suggest reply')
  }

  async function handleSendReply() {
    if (!token || !selectedTask || !replyDraft.trim()) return
    if (!confirm('Send this reply via Gmail?')) return
    setEmailError(null)
    setSendLoading(true)
    const taskId = selectedTask._id
    const res = await sendEmailReply(token, taskId, { confirmedReply: replyDraft.trim() })
    setSendLoading(false)
    if (res.success) {
      setEmailSuccess('Reply sent.')
      setSelectedTask(null)
      setEmailDetail(null)
      setTasks((prev) => prev.filter((t) => t._id !== taskId))
    } else setEmailError(res.message ?? 'Failed to send')
  }

  async function handleCreateLinkCode() {
    if (!token) return
    setLinkCodeError(null)
    setLinkCode(null)
    setLinkCodeLoading(true)
    const res = await createPulseBotLinkCode(token)
    setLinkCodeLoading(false)
    if (res.success && res.data) {
      setLinkCode({
        code: res.data.code,
        botUrl: res.data.botUrl,
        instructions: res.data.instructions,
        expiresInMinutes: res.data.expiresInMinutes,
      })
    } else {
      setLinkCodeError(res.message ?? 'Failed to create link code')
    }
  }

  async function handleSummary() {
    if (!token || !me?.linked) return
    setSummaryError(null)
    setSummary(null)
    setSummaryLoading(true)
    const res = await generatePulseBotSummary(token)
    setSummaryLoading(false)
    if (res.success && res.data) {
      setSummary(res.data.summary)
      if (res.data.newBalance != null) triggerDeduction(res.data.newBalance, COST_PULSEBOT_SUMMARY)
    } else {
      setSummaryError(res.message ?? 'Failed to generate summary')
    }
  }

  async function handleAsk() {
    const q = question.trim()
    if (!token || !me?.linked || !q) return
    setAskError(null)
    setAnswer(null)
    setAskLoading(true)
    const res = await pulsebotAsk(token, { question: q })
    setAskLoading(false)
    if (res.success && res.data) {
      setAnswer(res.data.answer)
      if (res.data.newBalance != null) triggerDeduction(res.data.newBalance, COST_PULSEBOT_ASK)
    } else {
      setAskError(res.message ?? 'Failed to get answer')
    }
  }

  async function loadScheduledList() {
    if (!token || !emailStatus?.gmail?.connected) return
    const res = await listScheduledEmails(token)
    if (res.success && Array.isArray(res.data)) setScheduledList(res.data)
  }

  useEffect(() => {
    if (token && emailStatus?.gmail?.connected) loadScheduledList()
  }, [token, emailStatus?.gmail?.connected])

  async function startEditScheduled(id: string) {
    if (!token) return
    setEmailError(null)
    const res = await getScheduledEmail(token, id)
    if (!res.success || !res.data) {
      setEmailError(res.message ?? 'Failed to load')
      return
    }
    const d = res.data
    setScheduledTo(d.to)
    setScheduledSubject(d.subject ?? '')
    setScheduledBody(d.bodyPlain ?? '')
    const scheduledFor = new Date(d.scheduledFor)
    const y = scheduledFor.getFullYear()
    const m = String(scheduledFor.getMonth() + 1).padStart(2, '0')
    const day = String(scheduledFor.getDate()).padStart(2, '0')
    const h = String(scheduledFor.getHours()).padStart(2, '0')
    const min = String(scheduledFor.getMinutes()).padStart(2, '0')
    setScheduledDateTime(`${y}-${m}-${day}T${h}:${min}`)
    setEditingScheduledId(id)
  }

  function cancelEditScheduled() {
    setEditingScheduledId(null)
    setScheduledTo('')
    setScheduledSubject('')
    setScheduledBody('')
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    setScheduledDateTime(`${y}-${m}-${day}T${h}:${min}`)
  }

  async function handleDeleteScheduled(id: string) {
    if (!token || !confirm('Cancel this scheduled email?')) return
    setEmailError(null)
    const res = await deleteScheduledEmail(token, id)
    if (res.success) {
      if (editingScheduledId === id) cancelEditScheduled()
      setEmailSuccess('Scheduled email cancelled.')
      loadScheduledList()
    } else setEmailError(res.message ?? 'Failed to delete')
  }

  async function handleScheduleEmail() {
    if (!token) return
    const to = scheduledTo.trim()
    const subject = scheduledSubject.trim()
    const bodyPlain = scheduledBody.trim()
    if (!to) {
      setEmailError('Enter recipient email')
      return
    }
    const scheduledFor = new Date(scheduledDateTime)
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
      setEmailError('Pick a date and time in the future')
      return
    }
    setEmailError(null)
    setEmailSuccess(null)
    setScheduleLoading(true)
    const payload = { to, subject, bodyPlain, scheduledFor: scheduledFor.toISOString() }
    const res = editingScheduledId
      ? await updateScheduledEmail(token, editingScheduledId, payload)
      : await scheduleEmail(token, payload)
    setScheduleLoading(false)
    if (res.success && res.data) {
      setEmailSuccess(editingScheduledId ? 'Scheduled email updated.' : `Scheduled for ${scheduledFor.toLocaleString()}.`)
      cancelEditScheduled()
      loadScheduledList()
    } else setEmailError(res.message ?? (editingScheduledId ? 'Failed to update' : 'Failed to schedule'))
  }

  async function loadDigest() {
    if (!token) return
    setDigestLoading(true)
    if (emailStatus?.gmail?.connected) {
      const lastSyncedAt = emailStatus.gmail?.lastSyncedAt
      const lastSyncedMs = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0
      if (Date.now() - lastSyncedMs > AUTO_SYNC_THROTTLE_MS) {
        const syncRes = await syncGmail(token)
        if (syncRes.success) {
          const statusRes = await getEmailIntegrationStatus(token)
          if (statusRes.success && statusRes.data) setEmailStatus(statusRes.data)
        }
      }
    }
    const [gmailRes, telegramRes] = await Promise.all([
      emailStatus?.gmail?.connected ? getGmailDigest(token) : Promise.resolve({ success: false, data: undefined }),
      me?.linked ? getTelegramDigest(token) : Promise.resolve({ success: false, data: undefined }),
    ])
    setDigestLoading(false)
    if (gmailRes.success && gmailRes.data) setGmailDigest(gmailRes.data)
    else setGmailDigest(null)
    if (telegramRes.success && telegramRes.data) setTelegramDigest(telegramRes.data)
    else setTelegramDigest(null)
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1000)
    })
  }

  const setWebhookHref = (() => {
    const u = apiUrl('/api/pulsebot/set-webhook')
    return u.startsWith('http') ? u : `${window.location.origin}${u}`
  })()

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden overflow-y-auto">
      {/* Full-page 3D background */}
      <div className="fixed inset-0 z-0">
        <PulseBot3DScene background />
      </div>
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(3,7,18,0.85) 0%, rgba(3,7,18,0.6) 35%, rgba(3,7,18,0.75) 70%, rgba(3,7,18,0.95) 100%)',
        }}
      />
      {/* Grid + gradient */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 100% 60% at 50% -20%, rgba(6, 182, 212, 0.12), transparent 50%),' +
            'radial-gradient(ellipse 80% 50% at 80% 80%, rgba(52, 211, 153, 0.06), transparent 45%)',
        }}
      />
      <div className="relative z-10">
        <Navbar />
        <div className="pt-24 pb-20 px-4 max-w-4xl mx-auto w-full min-w-0" style={{ perspective: '1200px' }}>
        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-4 py-2 mb-4 font-mono text-xs uppercase tracking-[0.2em] text-cyan-300/90">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" aria-hidden />
            AI Agent
            {isLoggedIn && (
              <span className="ml-2">
                <PointsDeductionBadge displayedPoints={displayedPoints} pointsDeduction={pointsDeduction} />
              </span>
            )}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-emerald-200 to-cyan-300">
              PulseBot
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Link Telegram for summaries & Q&A. Connect Gmail for AI email tasks and one-click replies.
          </p>
        </motion.header>

        {!isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, y: 20, rotateX: 5 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ type: 'spring', damping: 24 }}
            className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 backdrop-blur-xl p-8 text-center max-w-md mx-auto shadow-[0_0_30px_rgba(6,182,212,0.1)]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <p className="text-slate-300 mb-6">Sign in to link Telegram and use PulseBot.</p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-medium hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
            >
              Log in
            </Link>
          </motion.div>
        )}

        {isLoggedIn && (
          <motion.section
            variants={container}
            initial="hidden"
            animate="visible"
            className="space-y-8"
            style={{ perspective: '1200px' }}
          >
            {/* ——— Telegram ——— */}
            <motion.div variants={item} className="flex items-center gap-4">
              <h2 className="font-mono text-sm uppercase tracking-[0.25em] text-cyan-400/80 whitespace-nowrap">
                Telegram
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/30 to-transparent" />
            </motion.div>

            {/* Link status card */}
            <motion.div
              variants={item}
              whileHover={cardHover}
              whileTap={cardTap}
              className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] ring-1 ring-cyan-500/10"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400/90 mb-1">Link status</h2>
              <div className="h-px w-12 bg-gradient-to-r from-cyan-500/60 to-transparent mb-4" />
              {meLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-500"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                  <span className="text-sm">Loading…</span>
                </div>
              ) : me?.linked ? (
                <div>
                  <p className="text-emerald-400 font-medium mb-1">
                    Linked as {me.telegramUsername ? `@${me.telegramUsername}` : 'Telegram user'}
                  </p>
                  {me.groups.length > 0 ? (
                    <p className="text-slate-400 text-sm mb-2">
                      {me.groups.length} group{me.groups.length !== 1 ? 's' : ''} with recent activity
                    </p>
                  ) : (
                    <p className="text-slate-500 text-sm mb-2">
                      Add the bot to a Telegram group and chat to see groups here.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-sm mb-4">Not linked. Get a code below and send it to the bot in Telegram.</p>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <motion.button
                  type="button"
                  onClick={handleCreateLinkCode}
                  disabled={linkCodeLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-5 py-2.5 font-semibold text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50 disabled:pointer-events-none hover:bg-cyan-500/25 hover:border-cyan-400/50"
                >
                  {linkCodeLoading ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        className="inline-block w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      Creating…
                    </span>
                  ) : me?.linked ? 'Get new link code' : 'Link Telegram'}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={refetchMe}
                  disabled={meLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-slate-500/50 bg-slate-800/50 px-5 py-2.5 font-medium text-slate-300 hover:bg-slate-700/50 hover:border-slate-400/50 disabled:opacity-50"
                >
                  {meLoading ? 'Loading…' : 'Refresh status'}
                </motion.button>
              </div>

              {linkCodeError && (
                <p className="mt-3 text-sm text-red-400/90 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2">
                  {linkCodeError}
                </p>
              )}

              {linkCode && (
                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-800/50 p-4 space-y-3 min-w-0 overflow-hidden">
                  <p className="font-mono text-xs uppercase tracking-wider text-slate-500">One-time code (expires in {linkCode.expiresInMinutes} min)</p>
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <code className="px-4 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-mono text-lg tracking-wider break-all max-w-full">
                      {linkCode.code}
                    </code>
                    <motion.button
                      type="button"
                      onClick={() => copyToClipboard(linkCode.code)}
                      whileTap={{ scale: 0.96 }}
                      className="px-3 py-1.5 rounded-lg border border-slate-500/50 bg-slate-700/50 text-xs font-medium text-slate-300 hover:bg-slate-600/50"
                    >
                      {copyFeedback ? 'Copied' : 'Copy'}
                    </motion.button>
                  </div>
                  <p className="text-sm text-slate-400 break-words">{linkCode.instructions}</p>
                  <a
                    href={linkCode.botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium text-sm break-all max-w-full"
                  >
                    Open {linkCode.botUrl.replace('https://', '')}
                    <span aria-hidden>→</span>
                  </a>
                </div>
              )}

              <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 min-w-0 overflow-hidden">
                <p className="font-mono text-xs uppercase tracking-wider text-amber-400/90 mb-2">/link not working?</p>
                <p className="text-slate-400 text-sm mb-2 break-words">
                  Telegram needs a <strong className="text-slate-300">public HTTPS URL</strong>. If your backend is on localhost, Telegram never receives /link.
                </p>
                <ol className="text-sm text-slate-400 list-decimal list-inside space-y-1 mb-2 break-words [word-break:break-word]">
                  <li>Expose backend: <code className="bg-slate-800/80 px-1 rounded text-amber-300/90 break-all">ngrok http 5000</code>.</li>
                  <li>In Backend <code className="bg-slate-800/80 px-1 rounded break-all">.env</code>, set <code className="bg-slate-800/80 px-1 rounded text-amber-300/90 break-all">PULSEBOT_WEBHOOK_BASE_URL=https://YOUR_NGROK_URL</code>.</li>
                  <li>Restart backend, then click: <a href={setWebhookHref} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">Register webhook</a>.</li>
                  <li>Get a fresh code here, then in Telegram: <code className="bg-slate-800/80 px-1 rounded break-all">/link YOUR_CODE</code>.</li>
                </ol>
                <p className="text-slate-500 text-xs break-words">Backend logs: <code className="bg-slate-800/80 px-1 rounded break-all">[PulseBot] Webhook:</code></p>
              </div>
            </motion.div>

            {/* Summary card */}
            <motion.div
              variants={item}
              whileHover={cardHover}
              whileTap={cardTap}
              className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] ring-1 ring-cyan-500/10"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-1">Chat summary</h2>
              <div className="h-px w-12 bg-gradient-to-r from-cyan-500/60 to-transparent mb-2" />
              <p className="text-slate-400 text-sm mb-4">
                AI summary of linked groups & channels (last 12h). Costs {COST_PULSEBOT_SUMMARY} loyalty points.
              </p>
              <motion.button
                type="button"
                onClick={handleSummary}
                disabled={summaryLoading || !me?.linked}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-5 py-2.5 font-semibold text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50 disabled:pointer-events-none hover:bg-cyan-500/25"
              >
                {summaryLoading ? (
                  <span className="flex items-center gap-2">
                    <motion.span
                      className="inline-block w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    Generating…
                  </span>
                ) : 'Generate summary'}
              </motion.button>
              {summaryError && (
                <p className="mt-3 text-sm text-red-400/90 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2">
                  {summaryError}
                </p>
              )}
              <AnimatePresence>
                {summary && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, rotateX: -5 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', damping: 24 }}
                    className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-800/50 p-4 max-h-[28rem] overflow-y-auto"
                  >
                    <p className="font-mono text-xs uppercase tracking-wider text-cyan-400/80 mb-2">Summary</p>
                    <p className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">{summary}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Ask card */}
            <motion.div
              variants={item}
              whileHover={cardHover}
              whileTap={cardTap}
              className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] ring-1 ring-cyan-500/10"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-1">Ask about your chats</h2>
              <div className="h-px w-12 bg-gradient-to-r from-cyan-500/60 to-transparent mb-2" />
              <p className="text-slate-400 text-sm mb-4">
                Ask a question about recent group & channel chats. Costs {COST_PULSEBOT_ASK} loyalty points per question.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="e.g. What did we decide about the launch?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                  className="flex-1 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none"
                />
                <motion.button
                  type="button"
                  onClick={handleAsk}
                  disabled={askLoading || !me?.linked || !question.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-5 py-3 font-semibold text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50 disabled:pointer-events-none hover:bg-cyan-500/25 shrink-0"
                >
                  {askLoading ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        className="inline-block w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      Asking…
                    </span>
                  ) : 'Ask'}
                </motion.button>
              </div>
              {askError && (
                <p className="mt-3 text-sm text-red-400/90 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2">
                  {askError}
                </p>
              )}
              <AnimatePresence>
                {answer && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, rotateX: -5 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', damping: 24 }}
                    className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-800/50 p-4"
                  >
                    <p className="font-mono text-xs uppercase tracking-wider text-cyan-400/80 mb-2">Answer</p>
                    <p className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Telegram insights (in Telegram section) */}
            {me?.linked && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 24, stiffness: 200 }}
                whileHover={cardHover}
                whileTap={cardTap}
                style={{ transformStyle: 'preserve-3d' }}
                className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] min-h-[200px] ring-1 ring-cyan-500/10"
              >
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-1">Telegram insights</h2>
                <div className="h-px w-12 bg-gradient-to-r from-cyan-500/60 to-transparent mb-3" />
                <p className="text-slate-400 text-sm mb-4">Message counts, last activity, and top groups from your linked chats.</p>
                <motion.button
                  type="button"
                  onClick={loadDigest}
                  disabled={digestLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 font-semibold text-cyan-200 disabled:opacity-50 mb-4 hover:bg-cyan-500/25 transition-colors"
                >
                  {digestLoading ? 'Loading…' : 'Refresh insights'}
                </motion.button>
                {telegramDigest ? (
                  <div className="rounded-xl border border-slate-600/60 bg-slate-800/50 p-4 space-y-3">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div><span className="text-slate-500">Total messages (last {telegramDigest.periodHours}h)</span><p className="text-slate-200 font-medium">{telegramDigest.totalMessages}</p></div>
                      {telegramDigest.lastActivityAt && <div><span className="text-slate-500">Last activity</span><p className="text-slate-200">{new Date(telegramDigest.lastActivityAt).toLocaleString()}</p></div>}
                      {telegramDigest.mostActiveSender && <div className="sm:col-span-2"><span className="text-slate-500">Most active</span><p className="text-slate-200">{telegramDigest.mostActiveSender.username ?? `User ${telegramDigest.mostActiveSender.telegramUserId}`} <span className="text-slate-400">({telegramDigest.mostActiveSender.count} msgs)</span></p></div>}
                    </div>
                    {telegramDigest.topGroupsByMessageCount.length > 0 && (
                      <div>
                        <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Top 5 groups by messages</p>
                        <ul className="space-y-1.5 text-sm">
                          {telegramDigest.topGroupsByMessageCount.map((g) => (
                            <li key={g.groupTelegramId} className="flex justify-between rounded-lg bg-slate-700/40 px-3 py-2 text-slate-200"><span className="truncate pr-2">{g.groupTitle}</span><span className="text-cyan-400 shrink-0">{g.messageCount} msgs</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : !digestLoading && <p className="text-slate-500 text-sm">Click Refresh insights to load.</p>}
              </motion.div>
            )}

            {/* ——— Email (Gmail) ——— */}
            <motion.div variants={item} className="flex items-center gap-4 pt-4">
              <h2 className="font-mono text-sm uppercase tracking-[0.25em] text-cyan-400/80 whitespace-nowrap">
                Email
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/30 to-transparent" />
            </motion.div>

            <AnimatePresence mode="wait">
              {emailSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-emerald-200 text-sm"
                >
                  {emailSuccess}
                </motion.div>
              )}
              {emailError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-red-200 text-sm"
                >
                  {emailError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Gmail syncing card */}
            <motion.div
              variants={item}
              whileHover={cardHover}
              whileTap={cardTap}
              className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] ring-1 ring-cyan-500/10"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-1">Gmail</h2>
              <div className="h-px w-12 bg-gradient-to-r from-cyan-500/60 to-transparent mb-4" />
              <p className="text-slate-400 text-sm mb-4">
                Connect Gmail to sync inbox, get AI tasks (replies needed, follow-ups), and send replies from here.
              </p>
              {emailStatusLoading ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-500"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                  Loading…
                </div>
              ) : emailStatus?.gmail?.connected ? (
                <div>
                  <p className="text-emerald-400 font-medium mb-1">{emailStatus.gmail.email}</p>
                  <p className="text-slate-500 text-xs mb-4">
                    Last synced: {emailStatus.gmail.lastSyncedAt ? new Date(emailStatus.gmail.lastSyncedAt).toLocaleString() : 'Never'} · {emailStatus.gmail.syncedCount ?? 0} stored
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      type="button"
                      onClick={handleSync}
                      disabled={syncLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 font-semibold text-cyan-200 disabled:opacity-50 disabled:pointer-events-none hover:bg-cyan-500/25"
                    >
                      {syncLoading ? 'Syncing…' : 'Sync emails'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleListTasks}
                      disabled={tasksLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-2 font-semibold text-amber-200 disabled:opacity-50 disabled:pointer-events-none hover:bg-amber-500/25"
                    >
                      {tasksLoading ? 'Analyzing…' : `List tasks (${COST_EMAIL_TASKS} pts)`}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleDisconnectGmail}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-xl border border-slate-500/50 bg-slate-800/50 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700/50"
                    >
                      Disconnect
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleConnectGmail}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-5 py-2.5 font-semibold text-cyan-200 hover:bg-cyan-500/25"
                >
                  Connect Gmail
                </motion.button>
              )}
            </motion.div>

            {/* Email tasks: above scheduler */}
            {emailStatus?.gmail?.connected && Array.isArray(tasks) && tasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                whileHover={cardHover}
                whileTap={cardTap}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative z-10 rounded-2xl border border-cyan-500/20 bg-slate-900/80 backdrop-blur-xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.12)]"
              >
                <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-emerald-200 text-sm mb-4">
                  Found {tasks.length} task{tasks.length !== 1 ? 's' : ''}.
                </p>
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400/90 mb-2">Email tasks</h2>
                <div className="h-px w-12 bg-gradient-to-r from-cyan-500/60 to-transparent mb-4" />
                <ul className="space-y-2">
                  {tasks.map((t, idx) => (
                    <li key={t?._id ?? `task-${idx}`}>
                      <motion.button
                        type="button"
                        onClick={() => t && openTask(t)}
                        whileHover={{ x: 4 }}
                        className="w-full text-left p-3 rounded-xl border border-slate-600/60 bg-slate-800/60 hover:bg-slate-700/60 hover:border-cyan-500/30 text-slate-200"
                      >
                        <p className="font-medium text-slate-200 text-sm">{t?.title ?? 'Reply needed'}</p>
                        <p className="text-slate-500 text-xs truncate">
                          {t?.syncedEmail?.subject ?? ''} · {t?.syncedEmail?.from ?? ''}
                        </p>
                      </motion.button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Scheduled Email Queue — just above insights */}
            {emailStatus?.gmail?.connected && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 24, stiffness: 200 }}
                whileHover={cardHover}
                whileTap={cardTap}
                style={{ transformStyle: 'preserve-3d' }}
                className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] ring-1 ring-cyan-500/10"
              >
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-1">Scheduled Email Queue</h2>
                <div className="h-px w-12 bg-gradient-to-r from-cyan-500/60 to-transparent mb-3" />
                <p className="text-slate-400 text-sm mb-4">Compose an email and choose when to send it.</p>
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    placeholder="To (email)"
                    value={scheduledTo}
                    onChange={(e) => setScheduledTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Subject"
                    value={scheduledSubject}
                    onChange={(e) => setScheduledSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none text-sm"
                  />
                  <textarea
                    placeholder="Message"
                    value={scheduledBody}
                    onChange={(e) => setScheduledBody(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none text-sm resize-none"
                  />
                  <div>
                    <label className="block text-slate-400 text-xs font-medium mb-1.5">Send at</label>
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none text-sm [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      type="button"
                      onClick={handleScheduleEmail}
                      disabled={scheduleLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-4 py-2.5 font-semibold text-cyan-200 disabled:opacity-50 hover:bg-cyan-500/25 transition-colors"
                    >
                      {scheduleLoading
                        ? (editingScheduledId ? 'Updating…' : 'Scheduling…')
                        : editingScheduledId
                          ? 'Update scheduled email'
                          : 'Schedule email'}
                    </motion.button>
                    {editingScheduledId && (
                      <button
                        type="button"
                        onClick={cancelEditScheduled}
                        className="rounded-xl border border-slate-500/50 px-4 py-2.5 font-medium text-slate-400 hover:bg-slate-800/60 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                {scheduledList.length > 0 && (
                  <div className="rounded-xl border border-slate-600/60 bg-slate-800/50 p-4">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Queue</p>
                    <ul className="space-y-2 text-sm">
                      {scheduledList.map((e) => (
                        <li
                          key={e._id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-slate-200 ${editingScheduledId === e._id ? 'bg-cyan-500/15 border border-cyan-500/30' : 'bg-slate-700/40'}`}
                        >
                          <span className="truncate min-w-0">To: {e.to} · {e.subject || '(no subject)'}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs ${e.status === 'pending' ? 'text-amber-400' : e.status === 'sent' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {e.status === 'pending' ? new Date(e.scheduledFor).toLocaleString() : e.status}
                            </span>
                            {e.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditScheduled(e._id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-600/50 transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteScheduled(e._id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-600/50 transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}

            {/* Gmail insights (in Email section) — animate on mount so it’s not stuck hidden by stagger */}
            {emailStatus?.gmail?.connected && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 24, stiffness: 200 }}
                whileHover={cardHover}
                whileTap={cardTap}
                style={{ transformStyle: 'preserve-3d' }}
                className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] min-h-[240px] ring-1 ring-cyan-500/10"
              >
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-1">Gmail insights</h2>
                <div className="h-px w-12 bg-gradient-to-r from-cyan-500/60 to-transparent mb-3" />
                <p className="text-slate-400 text-sm mb-4">Unread count, threads, last activity, and top senders from your inbox.</p>
                <motion.button
                  type="button"
                  onClick={loadDigest}
                  disabled={digestLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 font-semibold text-cyan-200 disabled:opacity-50 mb-4 hover:bg-cyan-500/25 transition-colors"
                >
                  {digestLoading ? 'Loading…' : 'Refresh insights'}
                </motion.button>
                {gmailDigest ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-600/60 bg-slate-800/50 p-4">
                      <p className="text-slate-500 text-xs uppercase tracking-wider mb-3">Stats</p>
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div><span className="text-slate-500">Unread</span><p className="text-slate-200 font-medium">{gmailDigest.unreadCount}</p></div>
                        {gmailDigest.totalMessages != null && <div><span className="text-slate-500">Total messages</span><p className="text-slate-200">{gmailDigest.totalMessages}</p></div>}
                        {gmailDigest.totalThreads != null && <div><span className="text-slate-500">Total threads</span><p className="text-slate-200">{gmailDigest.totalThreads}</p></div>}
                        {gmailDigest.lastActivityAt && <div><span className="text-slate-500">Last activity</span><p className="text-slate-200">{new Date(gmailDigest.lastActivityAt).toLocaleString()}</p></div>}
                        {gmailDigest.mostActiveSender && <div className="sm:col-span-2"><span className="text-slate-500">Most active sender</span><p className="text-slate-200 truncate" title={gmailDigest.mostActiveSender.email}>{gmailDigest.mostActiveSender.email}</p><p className="text-slate-400 text-xs">{gmailDigest.mostActiveSender.count} emails</p></div>}
                      </div>
                      {gmailDigest.topThreads.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600/60">
                          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Top 5 longest threads</p>
                          <ul className="space-y-1.5 text-sm">
                            {gmailDigest.topThreads.map((t, i) => (
                              <li key={t.threadId} className="truncate text-slate-300" title={t.subject}>{i + 1}. {t.subject || '(no subject)'} — {t.messageCount} msgs</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {gmailDigest.lastEmails && gmailDigest.lastEmails.length > 0 && (
                      <div className="rounded-xl border border-slate-600/60 bg-slate-800/50 p-4">
                        <p className="text-slate-500 text-xs uppercase tracking-wider mb-3">Last 3 emails</p>
                        <ul className="space-y-3">
                          {gmailDigest.lastEmails.map((e) => (
                            <li key={e.messageId} className="rounded-lg border border-slate-600/40 bg-slate-700/30 p-3">
                              <p className="font-medium text-slate-200 text-sm truncate" title={e.subject}>{e.subject}</p>
                              <p className="text-slate-500 text-xs mt-0.5">From: {e.from}</p>
                              <p className="text-slate-400 text-xs mt-1">{new Date(e.date).toLocaleString()}</p>
                              {e.snippet && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{e.snippet}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : !digestLoading && <p className="text-slate-500 text-sm">Click Refresh insights to load.</p>}
              </motion.div>
            )}

            {/* Task detail modal — rendered in portal so it stays centered in viewport when scrolled */}
            {selectedTask && emailDetail && typeof document !== 'undefined' &&
              createPortal(
                <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                      onClick={() => !sendLoading && setSelectedTask(null)}
                    >
                      <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg rounded-2xl border border-cyan-500/20 bg-slate-900/90 backdrop-blur-xl p-6 max-h-[90vh] overflow-y-auto shadow-[0_0_40px_rgba(6,182,212,0.15)]"
                      >
                        <h3 className="font-semibold text-slate-100 mb-2">{emailDetail.email.subject}</h3>
                        <p className="text-slate-500 text-xs mb-2">From: {emailDetail.email.from}</p>
                        <div className="text-slate-300 text-sm mb-4 whitespace-pre-wrap border-b border-slate-600/60 pb-4">
                          {emailDetail.email.bodyPlain || emailDetail.email.snippet}
                        </div>
                        {emailDetail.task.replySentAt ? (
                          <p className="text-emerald-400 text-sm">Reply sent.</p>
                        ) : (
                          <>
                            <label className="block text-xs font-mono uppercase tracking-wider text-cyan-400/90 mb-1">Your reply</label>
                            <textarea
                              value={replyDraft}
                              onChange={(e) => setReplyDraft(e.target.value)}
                              rows={6}
                              className="w-full rounded-xl border border-slate-600/80 bg-slate-800/60 p-3 text-slate-200 text-sm resize-none mb-2 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none"
                              placeholder="Reply text…"
                            />
                            <input
                              type="text"
                              value={userMessage}
                              onChange={(e) => setUserMessage(e.target.value)}
                              placeholder="Optional: e.g. Make it shorter, more formal"
                              className="w-full rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-slate-200 text-sm mb-3 focus:border-cyan-500/50 outline-none"
                            />
                            <div className="flex flex-wrap gap-2">
                              <motion.button
                                type="button"
                                onClick={handleSuggestReply}
                                disabled={suggestLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-2 font-semibold text-amber-200 disabled:opacity-50"
                              >
                                {suggestLoading ? '…' : `Suggest reply (${COST_EMAIL_SUGGEST_REPLY} pts)`}
                              </motion.button>
                              <motion.button
                                type="button"
                                onClick={handleSendReply}
                                disabled={sendLoading || !replyDraft.trim()}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 font-semibold text-emerald-200 disabled:opacity-50 hover:bg-emerald-500/25"
                              >
                                {sendLoading ? 'Sending…' : 'Send reply'}
                              </motion.button>
                              <motion.button
                                type="button"
                                onClick={() => setSelectedTask(null)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="rounded-xl border border-slate-500/50 bg-slate-800/50 px-4 py-2 font-medium text-slate-300"
                              >
                                Close
                              </motion.button>
                            </div>
                          </>
                        )}
                      </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
              )}
          </motion.section>
        )}
        </div>
      </div>
    </div>
  )
}
