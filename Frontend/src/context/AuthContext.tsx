import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { getMe } from '../lib/api'

export type AuthUser = {
  id: string
  email?: string
  username?: string
  referralCode?: string
  loyaltyPoints?: number
  profilePicture?: string
  dailyClaimStreak?: number
  lastDailyClaimAt?: string | null
  walletAddress?: string
  twitterId?: string
  isAdmin?: boolean
}

type AuthContextType = {
  isLoggedIn: boolean
  user: AuthUser | null
  token: string | null
  setAuth: (user: AuthUser | null, token: string | null) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const STORAGE_TOKEN = 'pluto_token'
const STORAGE_USER = 'pluto_user'

const AuthContext = createContext<AuthContextType | null>(null)

function loadStored(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem(STORAGE_TOKEN)
    const raw = localStorage.getItem(STORAGE_USER)
    const user = raw ? (JSON.parse(raw) as AuthUser) : null
    if (token && user) return { user, token }
  } catch {
    // ignore
  }
  return { user: null, token: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(loadStored)

  const setAuth = useCallback((user: AuthUser | null, token: string | null) => {
    setState({ user, token })
    if (token) localStorage.setItem(STORAGE_TOKEN, token)
    else localStorage.removeItem(STORAGE_TOKEN)
    if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_USER)
  }, [])

  const logout = useCallback(() => {
    setState({ user: null, token: null })
    localStorage.removeItem(STORAGE_TOKEN)
    localStorage.removeItem(STORAGE_USER)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = state.token
    if (!token) return
    const res = await getMe(token)
    if (res.success && res.data?.user) {
      const u = res.data.user
      setAuth(
        {
          id: String(u.id),
          email: u.email,
          username: u.username,
          referralCode: u.referralCode,
          loyaltyPoints: u.loyaltyPoints,
          profilePicture: u.profilePicture,
          dailyClaimStreak: u.dailyClaimStreak,
          lastDailyClaimAt: u.lastDailyClaimAt,
          walletAddress: u.walletAddress,
          twitterId: u.twitterId,
          isAdmin: u.isAdmin,
        },
        token
      )
    }
  }, [state.token, setAuth])

  // Sync user from server on app load when we have a stored session (so profile picture etc. are visible without opening profile)
  useEffect(() => {
    if (state.token && state.user) {
      void refreshUser()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount when session exists

  const isLoggedIn = !!state.token && !!state.user

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user: state.user,
        token: state.token,
        setAuth,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
