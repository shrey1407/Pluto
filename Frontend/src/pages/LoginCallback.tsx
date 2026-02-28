import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginWithGoogle } from '../lib/api'

/**
 * Google OAuth redirect target. Google redirects here with #id_token=... after sign-in.
 * We send the id_token to our backend and then redirect to home.
 */
export default function LoginCallback() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) {
      setError('No token received from Google. Try again from the login page.')
      return
    }

    const params = new URLSearchParams(hash.slice(1))
    const idToken = params.get('id_token')
    const referralCode = params.get('state') ?? undefined
    if (!idToken) {
      setError('Invalid response from Google. Try again from the login page.')
      return
    }

    let cancelled = false
    ;(async () => {
      const res = await loginWithGoogle(idToken, referralCode)
      if (cancelled) return
      if (!res.success || !res.data) {
        setError(res.message ?? 'Google sign-in failed')
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
    })()

    return () => {
      cancelled = true
    }
  }, [setAuth, navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 max-w-md text-center">
          <p className="text-red-300 mb-4">{error}</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-medium"
          >
            Back to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 text-white">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/70">Signing you in…</p>
      </div>
    </div>
  )
}
