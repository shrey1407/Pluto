import { motion, AnimatePresence } from 'framer-motion'

export type TxStep = 'review' | 'confirming' | 'success' | 'error'

type OrderData = {
  orderId: string
  pointsAmount: number
  amountCrypto: string
  txHash: string
  walletAddress: string
}

type SuccessData = {
  txHash: string
  loyaltyPointsCredited: number
  newBalance: number
  previousBalance: number
}

type Props = {
  open: boolean
  onClose: () => void
  order: OrderData | null
  success: SuccessData | null
  step: TxStep
  error: string | null
  onConfirm: () => void
  onCloseSuccess: () => void
}

export default function BuyLoyaltyModal({
  open,
  onClose,
  order,
  success,
  step,
  error,
  onConfirm,
  onCloseSuccess,
}: Props) {
  if (!open) return null

  const handleBackdrop = (e: React.MouseEvent) => {
    if (step === 'review' || step === 'success' || step === 'error') {
      if (e.target === e.currentTarget) {
        if (step === 'success') onCloseSuccess()
        onClose()
      }
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={handleBackdrop}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl overflow-hidden border border-white/10 bg-[#1a1916] shadow-2xl"
          style={{ boxShadow: '0 0 0 1px rgba(251,191,36,0.08), 0 25px 50px -12px rgba(0,0,0,0.5)' }}
        >
          {/* Header - looks like wallet tx modal */}
          <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">
                {step === 'review' && 'Confirm transaction'}
                {step === 'confirming' && 'Confirming...'}
                {step === 'success' && 'Transaction submitted'}
                {step === 'error' && 'Transaction failed'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (step === 'success') onCloseSuccess()
                onClose()
              }}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {step === 'review' && order && (
              <>
                <p className="text-xs text-white/50 uppercase tracking-wider">You are purchasing</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Loyalty Points</span>
                    <span className="font-semibold text-amber-400">{order.pointsAmount} pts</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/50">Amount</span>
                    <span className="text-white/80 font-mono">{order.amountCrypto} ETH</span>
                  </div>
                </div>
                <p className="text-xs text-white/50 uppercase tracking-wider pt-2">From</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-sm text-white/90 break-all">
                  {order.walletAddress}
                </div>
                <p className="text-xs text-white/40">
                  This is a simulated purchase. No real crypto is transferred. Your wallet address will be saved to your profile.
                </p>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg shadow-amber-500/20"
                >
                  Confirm
                </button>
              </>
            )}

            {step === 'confirming' && (
              <div className="py-8 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin" />
                <p className="text-sm text-white/70">Confirming transaction...</p>
                <p className="text-xs text-white/45">Please wait</p>
              </div>
            )}

            {step === 'success' && success && (
              <>
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <p className="text-center text-sm font-medium text-white">Transaction submitted</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Points credited</span>
                    <span className="text-amber-400 font-semibold">+{success.loyaltyPointsCredited}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">New balance</span>
                    <span className="text-white font-medium">{success.newBalance} pts</span>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-xs text-white/45 mb-1">Transaction hash</p>
                    <p className="font-mono text-xs text-white/80 break-all">{success.txHash}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseSuccess}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-amber-500/80 hover:bg-amber-500 transition-colors"
                >
                  Done
                </button>
              </>
            )}

            {step === 'error' && (
              <>
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <p className="text-center text-sm text-red-400">{error ?? 'Something went wrong'}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-medium text-white bg-white/10 hover:bg-white/15 transition-colors"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
