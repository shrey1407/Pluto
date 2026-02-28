import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Navbar from '../components/Navbar'
import DailyClaimModal from '../components/DailyClaimModal'
import BuyLoyaltyModal, { type TxStep } from '../components/BuyLoyaltyModal'
import { useAuth } from '../context/AuthContext'
import {
  getMe,
  updateProfile,
  getDailyClaimStatus,
  createLoyaltyOrder,
  confirmLoyaltyOrder,
  type ProfileData,
  type DailyClaimStatus,
} from '../lib/api'

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

/** Resize image to max 400px and compress as JPEG to keep payload small. */
function resizeImageToDataUrl(file: File, maxSize = 400, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const scale = Math.min(maxSize / w, maxSize / h, 1)
      const cw = Math.round(w * scale)
      const ch = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, cw, ch)
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

export default function Profile() {
  const { user: authUser, token, setAuth, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editPicture, setEditPicture] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dailyClaimOpen, setDailyClaimOpen] = useState(false)
  const [dailyClaimStatus, setDailyClaimStatus] = useState<DailyClaimStatus | null>(null)
  const [buyLoyaltyOpen, setBuyLoyaltyOpen] = useState(false)
  const [txStep, setTxStep] = useState<TxStep>('review')
  const [orderData, setOrderData] = useState<{
    orderId: string
    pointsAmount: number
    amountCrypto: string
    txHash: string
    walletAddress: string
  } | null>(null)
  const [successData, setSuccessData] = useState<{
    txHash: string
    loyaltyPointsCredited: number
    newBalance: number
    previousBalance: number
  } | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [selectedBuyAmount, setSelectedBuyAmount] = useState(100)
  const [twitterUrl, setTwitterUrl] = useState('')
  const [twitterLinking, setTwitterLinking] = useState(false)
  const [twitterLinkError, setTwitterLinkError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { address: walletAddress } = useAccount()

  async function refetchProfile() {
    if (!token) return
    const [meRes, claimRes] = await Promise.all([
      getMe(token),
      getDailyClaimStatus(token),
    ])
    if (meRes.success && meRes.data) {
      setProfile(meRes.data)
      const u = meRes.data.user
      setAuth(
        {
          id: String(u.id),
          email: u.email,
          username: u.username,
          referralCode: u.referralCode,
          loyaltyPoints: u.loyaltyPoints ?? 0,
          profilePicture: u.profilePicture,
          dailyClaimStreak: u.dailyClaimStreak,
          lastDailyClaimAt: u.lastDailyClaimAt,
          walletAddress: u.walletAddress,
          twitterId: u.twitterId,
        },
        token
      )
    }
    if (claimRes.success && claimRes.data) setDailyClaimStatus(claimRes.data)
  }

  async function handleBuyLoyaltyStart() {
    if (!token || !walletAddress) return
    const amount = Math.max(1, Math.min(100000, selectedBuyAmount || 1))
    if (amount !== (selectedBuyAmount || 1)) setSelectedBuyAmount(amount)
    setBuyError(null)
    setTxStep('review')
    setOrderData(null)
    setSuccessData(null)
    const res = await createLoyaltyOrder(token, {
      walletAddress,
      amount,
    })
    if (!res.success || !res.data) {
      setBuyError(res.message ?? 'Failed to create order')
      setBuyLoyaltyOpen(true)
      setTxStep('error')
      return
    }
    setOrderData({
      orderId: res.data.orderId,
      pointsAmount: res.data.pointsAmount,
      amountCrypto: res.data.amountCrypto,
      txHash: res.data.txHash,
      walletAddress: res.data.walletAddress,
    })
    setTxStep('review')
    setBuyLoyaltyOpen(true)
  }

  async function handleBuyLoyaltyConfirm() {
    if (!token || !orderData) return
    setTxStep('confirming')
    setBuyError(null)
    const res = await confirmLoyaltyOrder(token, orderData.orderId)
    if (!res.success || !res.data) {
      setBuyError(res.message ?? 'Failed to confirm')
      setTxStep('error')
      return
    }
    setSuccessData({
      txHash: res.data.txHash,
      loyaltyPointsCredited: res.data.loyaltyPointsCredited,
      newBalance: res.data.newBalance,
      previousBalance: res.data.previousBalance,
    })
    setTxStep('success')
  }

  function handleBuyLoyaltyClose() {
    setBuyLoyaltyOpen(false)
    setTxStep('review')
    setOrderData(null)
    setSuccessData(null)
    setBuyError(null)
    refetchProfile()
  }

  useEffect(() => {
    if (!isLoggedIn || !token) {
      navigate('/login', { replace: true })
      return
    }
    let cancelled = false
    getMe(token).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (res.success && res.data) {
        setProfile(res.data)
        const u = res.data.user
        setAuth(
          {
            id: String(u.id),
            email: u.email,
            username: u.username,
            referralCode: u.referralCode,
            loyaltyPoints: u.loyaltyPoints ?? 0,
            profilePicture: u.profilePicture,
            dailyClaimStreak: u.dailyClaimStreak,
            lastDailyClaimAt: u.lastDailyClaimAt,
            walletAddress: u.walletAddress,
            twitterId: u.twitterId,
          },
          token
        )
      } else setError(res.message ?? 'Failed to load profile')
    })
    return () => {
      cancelled = true
    }
  }, [isLoggedIn, token, navigate])

  useEffect(() => {
    if (!token || !profile) return
    let cancelled = false
    getDailyClaimStatus(token).then((res) => {
      if (cancelled) return
      if (res.success && res.data) setDailyClaimStatus(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [token, profile])

  function startEdit() {
    if (!profile) return
    setEditUsername(profile.user.username ?? '')
    setEditPicture(profile.user.profilePicture ?? null)
    setSaveError(null)
    setEditing(true)
  }

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      setEditPicture(dataUrl)
    } catch {
      setSaveError('Failed to process image. Try a smaller photo.')
    }
  }

  async function handleSave() {
    if (!token) return
    setSaveError(null)
    setSaving(true)
    const body: { username?: string; profilePicture?: string | null } = {}
    if (editUsername.trim() !== (profile?.user.username ?? '')) body.username = editUsername.trim() || undefined
    if (editPicture !== (profile?.user.profilePicture ?? null)) body.profilePicture = editPicture || null
    const res = await updateProfile(token, body)
    setSaving(false)
    if (!res.success) {
      setSaveError(res.message ?? 'Failed to update')
      return
    }
    if (res.data?.user) {
      setProfile((prev) => (prev ? { ...prev, user: { ...prev.user, ...res.data!.user } } : null))
      setAuth(
        {
          id: authUser!.id,
          email: authUser!.email,
          username: res.data.user.username ?? authUser!.username,
          referralCode: authUser!.referralCode,
          loyaltyPoints: authUser!.loyaltyPoints,
          profilePicture: res.data.user.profilePicture ?? authUser!.profilePicture,
          twitterId: res.data.user.twitterId ?? authUser!.twitterId,
        },
        token
      )
    }
    setEditing(false)
  }

  async function handleConnectTwitter() {
    if (!token || !twitterUrl.trim()) return
    setTwitterLinkError(null)
    setTwitterLinking(true)
    const res = await updateProfile(token, { twitterProfileUrl: twitterUrl.trim() })
    setTwitterLinking(false)
    if (!res.success) {
      setTwitterLinkError(res.message ?? 'Failed to connect Twitter')
      return
    }
    setTwitterUrl('')
    if (res.data?.user) {
      setProfile((prev) => (prev ? { ...prev, user: { ...prev.user, ...res.data!.user } } : null))
      setAuth(
        {
          id: authUser!.id,
          email: authUser!.email,
          username: authUser!.username,
          referralCode: authUser!.referralCode,
          loyaltyPoints: authUser!.loyaltyPoints,
          profilePicture: authUser!.profilePicture,
          dailyClaimStreak: authUser!.dailyClaimStreak,
          lastDailyClaimAt: authUser!.lastDailyClaimAt,
          walletAddress: authUser!.walletAddress,
          twitterId: res.data.user.twitterId ?? authUser!.twitterId,
        },
        token
      )
    }
  }

  function cancelEdit() {
    setEditing(false)
    setEditUsername(profile?.user.username ?? '')
    setEditPicture(profile?.user.profilePicture ?? null)
    setSaveError(null)
  }

  function copyReferralCode() {
    const code = profile?.user.referralCode
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!isLoggedIn) return null
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <Navbar />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <motion.div
            className="w-10 h-10 border-2 border-amber-500/40 border-t-amber-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>
    )
  }
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <Navbar />
        <div className="pt-24 flex items-center justify-center px-4 min-h-[60vh]">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error ?? 'Profile not found'}</p>
            <Link to="/" className="text-amber-400 hover:text-amber-300">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const user = profile.user
  const stats = profile.profile
  const displayName = user.username || user.email || 'User'
  const avatarUrl = editing ? (editPicture ?? user.profilePicture) : user.profilePicture

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)] pointer-events-none" />

        <motion.div
          className="relative max-w-xl mx-auto space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Profile header */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-6 shadow-xl"
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <motion.div variants={item} className="relative shrink-0">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-amber-500/30 bg-slate-800 flex items-center justify-center ring-2 ring-amber-500/10">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-amber-500/90">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {editing && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg hover:bg-amber-400 transition-colors border-2 border-[#0a0a0f]"
                    aria-label="Change photo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePictureChange}
                />
              </motion.div>
              <div className="flex-1 w-full text-center sm:text-left min-w-0">
                <AnimatePresence mode="wait">
                  {editing ? (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm text-white/50 mb-1.5">Username</label>
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-white/40 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          placeholder="Display name"
                        />
                      </div>
                      {saveError && (
                        <p className="text-sm text-red-400">{saveError}</p>
                      )}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="px-5 py-2.5 rounded-xl bg-amber-500/90 text-white font-medium hover:bg-amber-400 disabled:opacity-60 transition-colors"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-5 py-2.5 rounded-xl border border-white/20 text-white/70 hover:bg-white/5 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      <h1 className="text-xl font-bold text-white truncate">{displayName}</h1>
                      {user.email && (
                        <p className="text-white/50 text-sm truncate">{user.email}</p>
                      )}
                      <button
                        type="button"
                        onClick={startEdit}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-500/30 text-amber-400/90 text-sm font-medium hover:bg-amber-500/10 hover:border-amber-500/50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit profile
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Loyalty points – hero highlight */}
          <motion.section
            variants={container}
            initial="hidden"
            animate="visible"
            className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-br from-yellow-500/10 via-amber-500/8 to-transparent p-5 shadow-[0_0_32px_rgba(245,158,11,0.06)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(250,204,21,0.05),transparent)] pointer-events-none" />
            <motion.div variants={item} className="relative flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                  <span className="text-lg">✨</span>
                </div>
                <div>
                  <p className="text-amber-300/90 text-xs font-medium uppercase tracking-wider">Loyalty Points</p>
                  <p className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-amber-500 tabular-nums">
                    {user.loyaltyPoints ?? 0}
                  </p>
                  <p className="text-white/45 text-xs mt-0.5">Your power across Pluto</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {typeof user.dailyClaimStreak === 'number' && user.dailyClaimStreak > 0 && (
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
                    <p className="text-white/50 text-xs">Daily streak</p>
                    <p className="text-amber-400/95 font-semibold text-sm">{user.dailyClaimStreak} day{user.dailyClaimStreak !== 1 ? 's' : ''}</p>
                  </div>
                )}
                <div className="relative inline-block">
                  {dailyClaimStatus?.canClaim && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900"
                      aria-label="Reward available"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setDailyClaimOpen(true)}
                    className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-2 text-xs font-medium text-amber-300/95 hover:bg-amber-500/30 hover:border-amber-500/50 transition-colors flex items-center gap-1.5"
                  >
                    <span aria-hidden>🎁</span>
                    Daily rewards
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.section>

          {/* Buy loyalty points – RainbowKit wallet + mock order */}
          <motion.section
            variants={container}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-6"
          >
            <motion.div variants={item} className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">Buy loyalty points</h2>
                    <p className="text-white/50 text-xs mt-0.5">Connect wallet · Make purchase</p>
                  </div>
                </div>
                <ConnectButton
                  chainStatus="icon"
                  showBalance={false}
                  accountStatus="address"
                />
              </div>
              {walletAddress && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-white/50 uppercase tracking-wider">Wallet</p>
                  <p className="font-mono text-sm text-white/80 truncate max-w-[240px]" title={walletAddress}>
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                </div>
              )}
              {walletAddress && (
                <>
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Amount (points)</p>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {[100, 500, 1000, 2000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setSelectedBuyAmount(amt)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            selectedBuyAmount === amt
                              ? 'bg-amber-500/30 border border-amber-500/50 text-amber-200'
                              : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {amt} pts
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label htmlFor="buy-loyalty-custom" className="text-sm text-white/60 shrink-0">
                        Or enter amount:
                      </label>
                      <input
                        id="buy-loyalty-custom"
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        value={selectedBuyAmount || ''}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            setSelectedBuyAmount(0)
                            return
                          }
                          const v = parseInt(raw, 10)
                          if (!Number.isNaN(v)) setSelectedBuyAmount(Math.max(0, Math.min(100000, v)))
                        }}
                        onBlur={() => {
                          if (selectedBuyAmount < 1) setSelectedBuyAmount(100)
                        }}
                        placeholder="e.g. 250"
                        className="w-28 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white font-medium placeholder-white/30 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-white/50">pts</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleBuyLoyaltyStart}
                    disabled={!selectedBuyAmount || selectedBuyAmount < 1}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Buy {selectedBuyAmount || '—'} points
                  </button>
                </>
              )}
            </motion.div>
          </motion.section>

          {/* Referral code – copy card */}
          <motion.section
            variants={container}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-6"
          >
            <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider mb-1">Your referral code</h2>
                <p className="text-white/50 text-xs mb-3">Share this code so others can join. You earn when they sign up.</p>
                <div className="inline-flex items-center gap-3 rounded-xl bg-slate-800/80 border border-white/10 px-4 py-3 font-mono text-lg font-semibold text-amber-400/95 tracking-widest">
                  {user.referralCode ?? '—'}
                </div>
              </div>
              <button
                type="button"
                onClick={copyReferralCode}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-medium hover:bg-amber-500/30 hover:border-amber-500/50 transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2v2zm2-4h10a2 2 0 012 2v6a2 2 0 01-2 2h-2v-2zm0-4V6a2 2 0 012-2h2v2z" />
                    </svg>
                    Copy code
                  </>
                )}
              </button>
            </motion.div>
          </motion.section>

          {/* Connect Twitter / X – required for quest verification */}
          <motion.section
            variants={container}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-6"
          >
            <motion.div variants={item} className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">Twitter / X</h2>
                <p className="text-white/50 text-xs mt-0.5">Link your account to verify quests (follow, tweet)</p>
              </div>
            </motion.div>
            {user.twitterId ? (
              <motion.div variants={item} className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-300 font-medium">Twitter / X connected</span>
              </motion.div>
            ) : (
              <motion.div variants={item} className="space-y-3">
                <input
                  type="text"
                  value={twitterUrl}
                  onChange={(e) => { setTwitterUrl(e.target.value); setTwitterLinkError(null) }}
                  placeholder="https://x.com/yourhandle or @yourhandle"
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
                {twitterLinkError && (
                  <p className="text-sm text-red-400">{twitterLinkError}</p>
                )}
                <button
                  type="button"
                  onClick={handleConnectTwitter}
                  disabled={twitterLinking || !twitterUrl.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  {twitterLinking ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Connect Twitter
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </motion.section>

          {/* Campaigns & Quests */}
          <motion.section
            variants={container}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-4"
          >
            <Link to="/campaigns">
              <motion.div
                variants={item}
                className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-5 hover:border-violet-500/30 hover:bg-slate-800/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/50 text-xs uppercase tracking-wider">Campaigns created</p>
                    <p className="text-2xl font-bold text-white tabular-nums">{stats.campaignsCreated}</p>
                    <p className="text-violet-400/80 text-xs mt-0.5 group-hover:underline">View campaigns →</p>
                  </div>
                </div>
              </motion.div>
            </Link>
            <Link to="/campaigns">
              <motion.div
                variants={item}
                className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-5 hover:border-emerald-500/30 hover:bg-slate-800/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/50 text-xs uppercase tracking-wider">Quests completed</p>
                    <p className="text-2xl font-bold text-white tabular-nums">{stats.questsCompleted}</p>
                    <p className="text-emerald-400/80 text-xs mt-0.5 group-hover:underline">View quests →</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </motion.section>

          {/* Campaigns participated (optional stat) */}
          {stats.campaignsParticipated > 0 && (
            <motion.div
              variants={item}
              className="rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 flex items-center justify-between"
            >
              <span className="text-white/50 text-sm">Campaigns participated</span>
              <span className="font-semibold text-white tabular-nums">{stats.campaignsParticipated}</span>
            </motion.div>
          )}

          {/* Account details */}
          <motion.section
            variants={container}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6"
          >
            <motion.h2 variants={item} className="text-sm font-medium text-white/70 uppercase tracking-wider mb-4">
              Account details
            </motion.h2>
            <dl className="space-y-4">
              {user.walletAddress && (
                <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-white/5">
                  <dt className="text-white/50 text-sm shrink-0 w-28">Wallet</dt>
                  <dd className="text-white/80 text-sm font-mono truncate" title={user.walletAddress}>
                    {user.walletAddress}
                  </dd>
                </motion.div>
              )}
              {user.createdAt && (
                <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-white/5">
                  <dt className="text-white/50 text-sm shrink-0 w-28">Joined</dt>
                  <dd className="text-white/80 text-sm">
                    {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </dd>
                </motion.div>
              )}
              {user.emailVerified !== undefined && (
                <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3">
                  <dt className="text-white/50 text-sm shrink-0 w-28">Email verified</dt>
                  <dd className="text-white/80 text-sm">
                    {user.emailVerified ? (
                      <span className="text-emerald-400/90">Verified</span>
                    ) : (
                      <span className="text-amber-400/90">Not verified</span>
                    )}
                  </dd>
                </motion.div>
              )}
            </dl>
          </motion.section>

          <motion.p variants={item} className="text-center pt-2">
            <Link to="/" className="text-sm text-white/50 hover:text-amber-400 transition-colors">
              ← Back to home
            </Link>
          </motion.p>

          <DailyClaimModal
            open={dailyClaimOpen}
            onClose={() => setDailyClaimOpen(false)}
            onClaimSuccess={refetchProfile}
          />
          <BuyLoyaltyModal
            open={buyLoyaltyOpen}
            onClose={() => setBuyLoyaltyOpen(false)}
            order={orderData}
            success={successData}
            step={txStep}
            error={buyError}
            onConfirm={handleBuyLoyaltyConfirm}
            onCloseSuccess={handleBuyLoyaltyClose}
          />
        </motion.div>
      </div>
    </div>
  )
}
