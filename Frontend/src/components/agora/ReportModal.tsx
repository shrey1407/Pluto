import { useState } from 'react'
import { createPortal } from 'react-dom'

export type ReportModalProps = {
  open: boolean
  onClose: () => void
  title: string
  onConfirm: (reason?: string) => Promise<{ success: boolean; message?: string }>
}

export default function ReportModal({ open, onClose, title, onConfirm }: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    const res = await onConfirm(reason.trim() || undefined)
    setLoading(false)
    if (res.success) {
      setReason('')
      onClose()
    } else {
      setError(res.message ?? 'Failed to submit report')
    }
  }

  function handleClose() {
    if (!loading) {
      setReason('')
      setError(null)
      onClose()
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-white/60 text-sm mb-4">
          Your report will be reviewed. Optionally add details below.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          rows={3}
          maxLength={500}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm mb-4"
          disabled={loading}
        />
        {error && (
          <p className="text-rose-400 text-sm mb-4">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/20 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-400 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Report'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
