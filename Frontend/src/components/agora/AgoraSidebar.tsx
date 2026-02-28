import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/agora', end: true, label: 'Feed', icon: FeedIcon },
  { to: '/agora/notifications', end: true, label: 'Notifications', icon: BellIcon },
  { to: '/agora/messages', end: false, label: 'Messages', icon: MessagesIcon },
  { to: '/agora/tips', end: true, label: 'Tips', icon: TipsIcon },
  { to: '/agora/bookmarks', end: true, label: 'Bookmarks', icon: BookmarksIcon },
  { to: '/agora/explore', end: true, label: 'Explore', icon: ExploreIcon },
  { to: '/agora/most-tipped', end: true, label: 'Most Tipped Creators', icon: StarIcon },
]

function FeedIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function BellIcon({ active: _active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function MessagesIcon({ active: _active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function TipsIcon({ active: _active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function BookmarksIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function StarIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

function ExploreIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0h.5a2.5 2.5 0 002.5-2.5V8m0 4a2 2 0 01-2 2h-2a2 2 0 01-2-2m0-4a2 2 0 012-2h2a2 2 0 012 2m0 0V5a2.5 2.5 0 002.5 2.5h.5a2 2 0 012 2 2 2 0 104 0h.5a2.5 2.5 0 002.5-2.5V3.055" />
    </svg>
  )
}

function ProfileIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function AdminReportsIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

export interface AgoraSidebarProps {
  onCastClick: () => void
}

export default function AgoraSidebar({ onCastClick }: AgoraSidebarProps) {
  const location = useLocation()
  const { user } = useAuth()
  const profileTo = user?.id ? `/agora/user/${user.id}` : '/agora'
  const isProfileActive = user?.id && location.pathname === `/agora/user/${user.id}`

  return (
    <aside className="w-64 shrink-0 flex flex-col py-4">
      <NavLink
        to="/agora"
        end
        className="mb-2 px-4 py-2 flex items-center gap-3 rounded-full text-xl font-bold bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent hover:bg-white/5 transition-colors"
      >
        Agora
      </NavLink>
      <nav className="flex flex-col gap-1 mt-4">
        {navItems.map(({ to, end, label, icon: Icon }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-base font-medium transition-colors ${
                isActive ? 'text-indigo-400 bg-indigo-500/15' : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon active={isActive} />
              <span>{label}</span>
            </NavLink>
          )
        })}
        {user?.isAdmin && (
          <NavLink
            to="/agora/admin/reports"
            end
            className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-base font-medium transition-colors ${
              location.pathname === '/agora/admin/reports'
                ? 'text-indigo-400 bg-indigo-500/15'
                : 'text-white/80 hover:bg-white/5 hover:text-white'
            }`}
          >
            <AdminReportsIcon active={location.pathname === '/agora/admin/reports'} />
            <span>Moderation</span>
          </NavLink>
        )}
        {user?.id && (
          <NavLink
            to={profileTo}
            end
            className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-base font-medium transition-colors ${
              isProfileActive ? 'text-indigo-400 bg-indigo-500/15' : 'text-white/80 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ProfileIcon active={isProfileActive} />
            <span>Profile</span>
          </NavLink>
        )}
      </nav>
      <button
        type="button"
        onClick={onCastClick}
        className="mt-4 mx-4 py-2.5 rounded-full font-semibold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 transition-all"
      >
        Create Cast
      </button>
    </aside>
  )
}
