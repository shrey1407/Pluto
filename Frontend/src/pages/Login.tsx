import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { postAuth } from '../lib/api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

const GOOGLE_OAUTH_SCOPE = 'openid email profile'

function buildGoogleAuthUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: GOOGLE_OAUTH_SCOPE,
    nonce: crypto.randomUUID(),
  })
  if (state) params.set('state', state)
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export default function Login() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const googleRedirectUri = `${currentOrigin}/login/callback`

  function handleGoogleClick() {
    if (!GOOGLE_CLIENT_ID) return
    setError(null)
    window.location.href = buildGoogleAuthUrl(googleRedirectUri, refCode || undefined)
  }

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
    setLoading(true)
    const res = await postAuth('auth/login', {
      email: email.trim().toLowerCase(),
      password,
    })
    setLoading(false)
    if (!res.success || !res.data) {
      setError(res.message ?? 'Login failed')
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
            'radial-gradient(ellipse 80% 50% at 20% 40%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)',
            'radial-gradient(ellipse 80% 50% at 80% 60%, rgba(249, 115, 22, 0.15) 0%, transparent 50%)',
            'radial-gradient(ellipse 80% 50% at 20% 40%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(120,80,20,0.08),transparent)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative w-full max-w-md"
      >
        <motion.div
          className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl shadow-amber-500/5"
          whileHover={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(251,191,36,0.08)' }}
          transition={{ duration: 0.3 }}
        >
          <motion.h1
            className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            Log in
          </motion.h1>
          <p className="text-white/50 text-sm mb-6">Welcome back to Pluto</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <motion.div variants={container} initial="hidden" animate="visible" className="flex flex-col gap-4">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key={error}
                    initial={{ opacity: 0, y: -8, x: 0 }}
                    animate={{ opacity: 1, y: 0, x: [0, -8, 8, -4, 4, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ opacity: { duration: 0.2 }, x: { duration: 0.4 } }}
                    className="rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-sm px-4 py-3 flex items-center gap-2"
                  >
                    <span className="text-red-400">!</span>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div variants={item}>
                <label htmlFor="login-email" className="block text-sm text-white/70 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all duration-200"
                  placeholder="you@example.com"
                />
              </motion.div>

              <motion.div variants={item}>
                <label htmlFor="login-password" className="block text-sm text-white/70 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
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
                      Signing in…
                    </>
                  ) : (
                    'Log in'
                  )}
                </motion.button>
              </motion.div>

              <motion.div variants={item} className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 w-full">
                  <span className="flex-1 h-px bg-white/20" />
                  <span className="text-xs text-white/50 uppercase tracking-wider">or</span>
                  <span className="flex-1 h-px bg-white/20" />
                </div>
                {GOOGLE_CLIENT_ID ? (
                  <motion.button
                    type="button"
                    onClick={handleGoogleClick}
                    className="w-full py-3.5 rounded-xl border border-white/20 bg-slate-800/60 text-white font-medium hover:bg-slate-700/60 hover:border-white/30 transition-all duration-200 flex items-center justify-center gap-3"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </motion.button>
                ) : (
                  <p className="text-sm text-white/50 text-center rounded-lg bg-white/5 border border-white/10 px-4 py-3 w-full">
                    To enable <strong className="text-white/70">Sign in with Google</strong>, add{' '}
                    <code className="text-amber-300/90 text-xs">VITE_GOOGLE_CLIENT_ID</code> to{' '}
                    <code className="text-amber-300/90 text-xs">Frontend/.env</code> (same value as Backend{' '}
                    <code className="text-amber-300/90 text-xs">GOOGLE_CLIENT_ID</code>) and restart the dev server.
                  </p>
                )}
              </motion.div>
            </motion.div>
          </form>

          <motion.p
            className="mt-6 text-center text-sm text-white/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 transition-colors group"
            >
              Sign up
              <span className="inline-block group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </motion.p>
          <motion.p
            className="mt-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
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
