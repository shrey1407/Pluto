import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const MIN_TIP = 1
const MAX_TIP = 1_000_000
const PRESETS = [10, 50, 100, 500, 1000]

type TipModalProps = {
  authorName: string
  userBalance: number
  onConfirm: (amount: number) => Promise<{ success: boolean; message?: string }>
  onClose: () => void
}

export default function TipModal({ authorName, userBalance, onConfirm, onClose }: TipModalProps) {
  const [amount, setAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successAmount, setSuccessAmount] = useState<number | null>(null)

  const numAmount = parseInt(amount, 10)
  const isValid = !Number.isNaN(numAmount) && numAmount >= MIN_TIP && numAmount <= MAX_TIP
  const canAfford = isValid && numAmount <= userBalance

  async function handleSubmit() {
    if (!isValid || !canAfford) return
    setError(null)
    setLoading(true)
    const res = await onConfirm(numAmount)
    setLoading(false)
    if (res.success) {
      setSuccessAmount(numAmount)
    } else {
      setError(res.message ?? 'Failed to tip')
    }
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (successAmount != null) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-amber-500/20 to-cyan-500/20 w-full max-w-sm p-8 shadow-2xl shadow-amber-500/20 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center gap-2 mb-4">
            <span className="text-4xl animate-bounce" style={{ animationDelay: '0ms' }}>🎉</span>
            <span className="text-4xl animate-bounce" style={{ animationDelay: '100ms' }}>⭐</span>
            <span className="text-4xl animate-bounce" style={{ animationDelay: '200ms' }}>🎉</span>
          </div>
          <h3 className="text-2xl font-bold text-amber-400 mb-2">Tip Sent!</h3>
          <p className="text-white/90 text-lg mb-1">
            You tipped <span className="font-bold text-amber-400">{successAmount.toLocaleString()}</span> pts to {authorName}
          </p>
          <p className="text-white/60 text-sm mb-6">Thanks for spreading the love!</p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg"
          >
            Awesome!
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div
        className="rounded-2xl border border-white/10 bg-[#0a0a0f] w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-1">Tip {authorName}</h3>
        <p className="text-white/60 text-sm mb-4">
          Send loyalty points to show your appreciation. Your balance: <span className="text-amber-400 font-medium">{userBalance.toLocaleString()}</span> pts
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              disabled={p > userBalance}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                amount === String(p)
                  ? 'bg-amber-500/30 text-amber-400 border border-amber-400/50'
                  : 'bg-white/5 text-white/80 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {p} pts
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label htmlFor="tip-amount" className="block text-sm font-medium text-white/70 mb-2">
            Custom amount
          </label>
          <input
            id="tip-amount"
            type="number"
            min={MIN_TIP}
            max={MAX_TIP}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Enter amount"
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
          />
        </div>

        {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/20 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !canAfford}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : `Tip ${isValid ? numAmount.toLocaleString() : '0'} pts`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
