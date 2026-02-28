import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  getAgoraAdminReports,
  updateAgoraReportStatus,
  hideAgoraPost,
  type AgoraAdminReportEntry,
} from '../lib/api'

const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

type StatusFilter = 'all' | 'pending' | 'reviewed' | 'dismissed'

export default function AgoraAdminReports() {
  const { isLoggedIn, user, token } = useAuth()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [reports, setReports] = useState<AgoraAdminReportEntry[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchReports = useCallback(
    async (page = 1) => {
      if (!token) return
      setLoading(true)
      setError(null)
      const res = await getAgoraAdminReports(token, {
        page,
        limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setLoading(false)
      if (!res.success) {
        setError(res.message ?? 'Failed to load reports')
        setReports([])
        return
      }
      if (res.data) {
        setReports(res.data.reports)
        setPagination(res.data.pagination)
      }
    },
    [token, statusFilter]
  )

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    if (!user?.isAdmin) {
      navigate('/agora', { replace: true })
      return
    }
    fetchReports(1)
  }, [isLoggedIn, user?.isAdmin, navigate, fetchReports])

  async function handleUpdateStatus(reportId: string, status: 'reviewed' | 'dismissed') {
    if (!token) return
    setActionLoading(reportId)
    const res = await updateAgoraReportStatus(token, reportId, status)
    setActionLoading(null)
    if (res.success) {
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }))
    }
  }

  async function handleHidePost(postId: string, reportId: string) {
    if (!token) return
    setActionLoading(reportId)
    const res = await hideAgoraPost(token, postId)
    setActionLoading(null)
    if (res.success) {
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }))
    }
  }

  if (!user?.isAdmin) return null

  return (
    <motion.div
      className="relative max-w-3xl"
      initial="visible"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
    >
      <div className="mb-6">
        <Link
          to="/agora"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Agora
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">Report moderation</h1>
        <p className="text-white/60 text-sm">Review and act on reported posts and users.</p>
      </div>

      {/* Status filter */}
      <motion.div variants={item} className="flex flex-wrap gap-2 mb-6">
        {(['pending', 'reviewed', 'dismissed', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </motion.div>

      {error && (
        <motion.div
          variants={item}
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm mb-6"
        >
          {error}
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <motion.div
          variants={item}
          className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
        >
          <p className="text-white/60">
            {statusFilter === 'all' ? 'No reports.' : `No ${statusFilter} reports.`}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <motion.div
              key={r.id}
              variants={item}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.referenceType === 'Post'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {r.referenceType}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'pending'
                        ? 'bg-rose-500/20 text-rose-400'
                        : r.status === 'reviewed'
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <span className="text-white/40 text-xs">{formatDate(r.createdAt)}</span>
              </div>
              <p className="text-white/70 text-sm mb-2">
                Reported by{' '}
                <span className="text-white/90">
                  {r.reporter?.username ?? r.reporter?.email ?? 'Unknown'}
                </span>
              </p>
              {r.reason && (
                <p className="text-white/60 text-sm mb-2">
                  <span className="text-white/50">Reason:</span> {r.reason}
                </p>
              )}
              {r.reference && (
                <div className="rounded-lg bg-white/5 border border-white/10 p-3 mb-3 text-sm">
                  {r.referenceType === 'Post' && r.reference && 'content' in r.reference && (
                    <>
                      <p className="text-white/50 text-xs mb-1">Post content</p>
                      <p className="text-white/80 line-clamp-2">
                        {(r.reference as { content?: string }).content ?? '—'}
                      </p>
                      {(r.reference as { hidden?: boolean }).hidden && (
                        <p className="text-rose-400 text-xs mt-1">(Post is hidden)</p>
                      )}
                      {(r.reference as { user?: { _id: string; username?: string } }).user && (
                        <p className="text-white/50 text-xs mt-1">
                          by{' '}
                          {(r.reference as { user: { username?: string; email?: string } }).user
                            ?.username ??
                            (r.reference as { user: { email?: string } }).user?.email ??
                            'Unknown'}
                        </p>
                      )}
                    </>
                  )}
                  {r.referenceType === 'User' && r.reference && (
                    <>
                      <p className="text-white/50 text-xs mb-1">Reported user</p>
                      <p className="text-white/80">
                        {(r.reference as { username?: string }).username ??
                          (r.reference as { email?: string }).email ??
                          '—'}
                      </p>
                    </>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {r.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(r.id, 'reviewed')}
                      disabled={actionLoading !== null}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-50"
                    >
                      {actionLoading === r.id ? '...' : 'Mark reviewed'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(r.id, 'dismissed')}
                      disabled={actionLoading !== null}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    {r.referenceType === 'Post' &&
                      r.referenceId &&
                      !(r.reference as { hidden?: boolean })?.hidden && (
                        <button
                          type="button"
                          onClick={() => handleHidePost(r.referenceId, r.id)}
                          disabled={actionLoading !== null}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 disabled:opacity-50"
                        >
                          Hide post
                        </button>
                      )}
                  </>
                )}
                {r.referenceType === 'Post' && r.referenceId && (
                  <Link
                    to={`/agora/thread/${r.referenceId}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 hover:bg-cyan-500/20"
                  >
                    View thread
                  </Link>
                )}
                {r.referenceType === 'User' && r.referenceId && (
                  <Link
                    to={`/agora/user/${r.referenceId}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 hover:bg-cyan-500/20"
                  >
                    View profile
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && pagination.totalPages > 1 && (
        <motion.div variants={item} className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => fetchReports(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-white/80 hover:bg-white/15 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-white/60 text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => fetchReports(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-white/80 hover:bg-white/15 disabled:opacity-50"
          >
            Next
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}
