import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { getAgoraNotifications } from '../lib/api'
import NotificationPanel from './agora/NotificationPanel'

const navVariants = {
  hidden: { y: -20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
}

const mobileNavLinks = [
  { to: '/campaigns', label: 'Campquest' },
  { to: '/agora', label: 'Agora' },
  { to: '/chainlens', label: 'ChainLens' },
  { to: '/trendcraft', label: 'Trendcraft' },
  { to: '/pulsebot', label: 'PulseBot' },
]

export default function Navbar() {
  const { isLoggedIn, user, logout, token } = useAuth()
  const navigate = useNavigate()
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setUnreadCount(0)
      return
    }
    getAgoraNotifications(token, { page: 1, limit: 1, unread: true })
      .then((res) => {
        if (res.success && res.data?.pagination) {
          setUnreadCount(res.data.pagination.total)
        }
      })
      .catch(() => {})
    const interval = setInterval(() => {
      getAgoraNotifications(token, { page: 1, limit: 1, unread: true })
        .then((res) => {
          if (res.success && res.data?.pagination) {
            setUnreadCount(res.data.pagination.total)
          }
        })
        .catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [isLoggedIn, token])

  return (
    <motion.nav
      variants={navVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 safe-area-top"
      style={{
        background: 'rgba(5, 5, 12, 0.7)',
        backdropFilter: 'blur(20px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo + Name */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-white/10 group-hover:scale-105 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            boxShadow: '0 0 24px -6px rgba(99, 102, 241, 0.4)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 text-white"
            fill="currentColor"
            aria-hidden
          >
            <circle cx="12" cy="12" r="4" />
            <ellipse cx="12" cy="12" rx="8" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="12" cy="12" rx="4" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <span className="text-xl font-bold text-white tracking-tight">Pluto</span>
      </Link>

      {/* Mobile menu button */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="sm:hidden flex items-center justify-center w-10 h-10 rounded-xl text-white/90 hover:bg-white/10 active:bg-white/15 transition-colors touch-manipulation"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

      {/* Auth actions: on mobile show bell + profile only; nav links & logout in menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {isLoggedIn ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/campaigns"
              className="text-sm font-medium text-white/80 hover:text-cyan-400 transition-colors hidden sm:inline"
            >
              Campquest
            </Link>
            <Link
              to="/agora"
              className="text-sm font-medium text-white/80 hover:text-cyan-400 transition-colors hidden sm:inline"
            >
              Agora
            </Link>
            <Link
              to="/chainlens"
              className="text-sm font-medium text-white/80 hover:text-cyan-400 transition-colors hidden sm:inline"
            >
              ChainLens
            </Link>
            <Link
              to="/trendcraft"
              className="text-sm font-medium text-white/80 hover:text-cyan-400 transition-colors hidden sm:inline"
            >
              Trendcraft
            </Link>
            <Link
              to="/pulsebot"
              className="text-sm font-medium text-white/80 hover:text-cyan-400 transition-colors hidden sm:inline"
            >
              PulseBot
            </Link>
            <div className="relative">
              <button
                ref={bellRef}
                type="button"
                onClick={() => setNotificationOpen((o) => !o)}
                className="relative flex items-center justify-center w-10 h-10 rounded-full min-w-[44px] min-h-[44px] text-white/80 hover:text-cyan-400 hover:bg-white/5 transition-colors touch-manipulation"
                aria-label="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-xs font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {token && (
                <NotificationPanel
                  isOpen={notificationOpen}
                  onClose={() => setNotificationOpen(false)}
                  token={token}
                  anchorRef={bellRef}
                  onUnreadChange={() => {
                    getAgoraNotifications(token, { page: 1, limit: 1, unread: true }).then((res) => {
                      if (res.success && res.data?.pagination) {
                        setUnreadCount(res.data.pagination.total)
                      }
                    })
                  }}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/', { replace: true })
              }}
              className="hidden sm:block px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              Log out
            </button>
            <Link
              to="/profile"
              className="flex items-center justify-center w-10 h-10 rounded-full min-w-[44px] min-h-[44px] text-white transition-colors overflow-hidden shrink-0 ring-1 ring-white/20 hover:ring-cyan-400/40 touch-manipulation"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              aria-label="Profile"
            >
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-cyan-400">
                  {(user?.username ?? user?.email ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          </div>
        ) : (
          <>
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all ring-1 ring-white/20 hover:ring-cyan-400/50"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                boxShadow: '0 0 20px -5px rgba(99, 102, 241, 0.4)',
              }}
            >
              Sign up
            </Link>
          </>
        )}
      </div>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-[65px] z-40 bg-[#0a0a0f]/95 backdrop-blur-md sm:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 right-0 top-[65px] z-50 max-h-[calc(100vh-65px)] overflow-y-auto border-b border-white/10 sm:hidden"
              style={{
                background: 'rgba(10, 10, 15, 0.98)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              }}
            >
              <nav className="px-4 py-4 flex flex-col gap-1">
                {mobileNavLinks.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="min-h-[48px] flex items-center px-4 rounded-xl text-base font-medium text-white/90 hover:bg-white/10 hover:text-white active:bg-white/15 transition-colors touch-manipulation"
                  >
                    {label}
                  </Link>
                ))}
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      logout()
                      navigate('/', { replace: true })
                    }}
                    className="min-h-[48px] w-full text-left flex items-center px-4 rounded-xl text-base font-medium text-rose-400/90 hover:bg-white/10 active:bg-white/15 transition-colors touch-manipulation"
                  >
                    Log out
                  </button>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
