import { useState, useCallback, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom'
import Navbar from '../components/Navbar'
import AgoraSidebar from '../components/agora/AgoraSidebar'
import CastModal from '../components/agora/CastModal'
import { useAuth } from '../context/AuthContext'
import type { AgoraCast } from '../lib/api'

const mobileNavItems = [
  { to: '/agora', end: true, label: 'Feed', icon: 'feed' },
  { to: '/agora/notifications', end: true, label: 'Alerts', icon: 'bell' },
  { to: '/agora/messages', end: false, label: 'Messages', icon: 'messages' },
  { to: '/agora/tips', end: true, label: 'Tips', icon: 'tips' },
] as const

export default function AgoraLayout() {
  const { isLoggedIn, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [castModalOpen, setCastModalOpen] = useState(false)
  const [initialCastContent, setInitialCastContent] = useState<string | null>(null)
  const addCastRef = useRef<((cast: AgoraCast) => void) | null>(null)

  useEffect(() => {
    const content = (location.state as { castContent?: string } | null)?.castContent
    if (typeof content === 'string' && content.trim()) {
      setInitialCastContent(content.trim())
      setCastModalOpen(true)
      navigate('/agora', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  const handleCastSuccess = useCallback((post: AgoraCast) => {
    addCastRef.current?.(post)
  }, [])

  const handleCastClick = useCallback(() => {
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    setInitialCastContent(null)
    setCastModalOpen(true)
  }, [isLoggedIn, navigate])

  const handleCastModalClose = useCallback(() => {
    setCastModalOpen(false)
    setInitialCastContent(null)
  }, [])

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
    }
  }, [isLoggedIn, navigate])

  if (!isLoggedIn) return null

  const { user } = useAuth()
  const profileTo = user?.id ? `/agora/user/${user.id}` : '/agora'

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden overflow-y-auto">
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% -30%, rgba(99, 102, 241, 0.15), transparent 50%),' +
            'radial-gradient(ellipse 80% 60% at 90% 50%, rgba(6, 182, 212, 0.08), transparent 45%),' +
            'linear-gradient(180deg, #0a0a0f 0%, #050508 100%)',
        }}
      />
      <Navbar />
      <div className="pt-24 pb-20 lg:pb-16 px-4 relative z-10">
        <div className="max-w-6xl mx-auto flex gap-8">
          <aside className="hidden lg:block shrink-0">
            <AgoraSidebar onCastClick={handleCastClick} />
          </aside>
          <main className="flex-1 min-w-0 w-full">
            <Outlet context={{ addCastRef }} />
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 py-2 safe-area-bottom"
        style={{
          background: 'rgba(10, 10, 15, 0.92)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {mobileNavItems.map(({ to, end, label, icon }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={`flex flex-col items-center gap-0.5 min-h-[48px] justify-center px-3 py-2 rounded-xl touch-manipulation transition-colors ${
                isActive ? 'text-indigo-400' : 'text-white/70 hover:text-white'
              }`}
            >
              {icon === 'feed' && (
                <svg className="w-6 h-6" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              )}
              {icon === 'bell' && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              )}
              {icon === 'messages' && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
              {icon === 'tips' && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={handleCastClick}
          className="flex flex-col items-center gap-0.5 min-h-[48px] justify-center px-3 py-2 rounded-xl touch-manipulation font-semibold text-white bg-gradient-to-r from-indigo-500 to-cyan-500"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[10px]">Create</span>
        </button>
        <NavLink
          to={profileTo}
          end
          className={`flex flex-col items-center gap-0.5 min-h-[48px] justify-center px-3 py-2 rounded-xl touch-manipulation transition-colors ${
            location.pathname === profileTo ? 'text-indigo-400' : 'text-white/70 hover:text-white'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] font-medium">Profile</span>
        </NavLink>
      </nav>

      <CastModal
        open={castModalOpen}
        onClose={handleCastModalClose}
        token={token}
        onSuccess={handleCastSuccess}
        initialContent={initialCastContent}
      />
    </div>
  )
}
