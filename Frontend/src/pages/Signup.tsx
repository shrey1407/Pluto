import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { postAuth } from '../lib/api'

const MIN_PASSWORD_LENGTH = 8

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

export default function Signup() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState('')
  const [referralCode, setReferralCode] = useState(() => searchParams.get('ref') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const passwordStrength = password.length < MIN_PASSWORD_LENGTH
    ? (password.length / MIN_PASSWORD_LENGTH) * 100
    : Math.min(100, 80 + (password.length - MIN_PASSWORD_LENGTH) * 5)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    setLoading(true)
    const body: Record<string, string> = {
      email: email.trim().toLowerCase(),
      password,
    }
    if (username.trim()) body.username = username.trim()
    if (referralCode.trim()) body.referralCode = referralCode.trim()
    const res = await postAuth('auth/register', body)
    setLoading(false)
    if (!res.success || !res.data) {
      setError(res.message ?? 'Sign up failed')
      return
    }
    const { user, token } = res.data
    setAuth(
      {
        id: String(user.id),
        email: user.email,
        username: user.username,
        referralCode: user.referralCode,
        loyaltyPoints: user.loyaltyPoints,
        profilePicture: user.profilePicture,
        dailyClaimStreak: user.dailyClaimStreak,
        lastDailyClaimAt: user.lastDailyClaimAt,
        walletAddress: user.walletAddress,
        twitterId: user.twitterId,
        isAdmin: user.isAdmin,
      },
      token
    )
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12 text-white overflow-x-hidden overflow-y-auto relative">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 opacity-40"
        animate={{
          background: [
            'radial-gradient(ellipse 70% 60% at 80% 20%, rgba(249, 115, 22, 0.12) 0%, transparent 50%)',
            'radial-gradient(ellipse 70% 60% at 20% 80%, rgba(251, 191, 36, 0.12) 0%, transparent 50%)',
            'radial-gradient(ellipse 70% 60% at 80% 20%, rgba(249, 115, 22, 0.12) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_100%,rgba(120,60,20,0.06),transparent)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative w-full max-w-md"
      >
        <motion.div
          className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl shadow-orange-500/5"
          whileHover={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(249,115,22,0.08)' }}
          transition={{ duration: 0.3 }}
        >
          <motion.h1
            className="text-2xl font-bold mb-2 bg-gradient-to-r from-orange-200 to-amber-300 bg-clip-text text-transparent"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            Sign up
          </motion.h1>
          <p className="text-white/50 text-sm mb-6">Join Pluto and explore</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <motion.div variants={container} initial="hidden" animate="visible" className="flex flex-col gap-4">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key={error}
                    initial={{ opacity: 0, y: -8, x: 0 }}
                    animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 3, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ opacity: { duration: 0.2 }, x: { duration: 0.35 } }}
                    className="rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-sm px-4 py-3 flex items-center gap-2"
                  >
                    <span className="text-red-400">!</span>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div variants={item}>
                <label htmlFor="signup-email" className="block text-sm text-white/70 mb-1.5">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all duration-200"
                  placeholder="you@example.com"
                />
              </motion.div>

              <motion.div variants={item}>
                <label htmlFor="signup-password" className="block text-sm text-white/70 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 pr-12 text-white placeholder-white/40 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all duration-200"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors text-sm"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${passwordStrength}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
                <p className="mt-1 text-xs text-white/50">At least {MIN_PASSWORD_LENGTH} characters</p>
              </motion.div>

              <motion.div variants={item}>
                <label htmlFor="signup-username" className="block text-sm text-white/70 mb-1.5">
                  Username <span className="text-white/40">(optional)</span>
                </label>
                <input
                  id="signup-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all duration-200"
                  placeholder="Display name"
                />
              </motion.div>

              <motion.div variants={item}>
                <label htmlFor="signup-referral" className="block text-sm text-white/70 mb-1.5">
                  Referral code <span className="text-white/40">(optional)</span>
                </label>
                <input
                  id="signup-referral"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all duration-200 uppercase"
                  placeholder="e.g. ABC12XYZ"
                />
              </motion.div>

              <motion.div variants={item} className="pt-1">
                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/30 hover:from-amber-400 hover:to-orange-500 disabled:opacity-60 disabled:pointer-events-none transition-all duration-200 flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {loading ? (
                    <>
                      <motion.span
                        className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      Creating account…
                    </>
                  ) : (
                    'Sign up'
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          </form>

          <motion.p
            className="mt-6 text-center text-sm text-white/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 transition-colors group"
            >
              Log in
              <span className="inline-block group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </motion.p>
          <motion.p
            className="mt-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            <Link
              to="/"
              className="text-sm text-white/50 hover:text-white/80 inline-flex items-center gap-1 transition-colors"
            >
              ← Back to home
            </Link>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  )
}
