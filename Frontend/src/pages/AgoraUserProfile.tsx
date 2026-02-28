import { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  getAgoraUserProfile,
  followAgoraUser,
  unfollowAgoraUser,
  tipAgoraUser,
  reportAgoraUser,
  getAgoraPosts,
  getAgoraUserLikedPosts,
  getAgoraFollowers,
  getAgoraFollowing,
  type AgoraUserProfile,
  type AgoraCast,
  type AgoraFollowEntry,
} from '../lib/api'
import CastCard from '../components/agora/CastCard'
import TipModal from '../components/agora/TipModal'
import ReportModal from '../components/agora/ReportModal'

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
}
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

export default function AgoraUserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoggedIn, user: authUser, token, refreshUser } = useAuth()
  const [profile, setProfile] = useState<AgoraUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [followLoading, setFollowLoading] = useState(false)

  const [tab, setTab] = useState<'casts' | 'liked'>('casts')
  const [casts, setCasts] = useState<AgoraCast[]>([])
  const [castsLoading, setCastsLoading] = useState(true)
  const [castsError, setCastsError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [likedCasts, setLikedCasts] = useState<AgoraCast[]>([])
  const [likedLoading, setLikedLoading] = useState(false)
  const [likedError, setLikedError] = useState<string | null>(null)
  const [likedPage, setLikedPage] = useState(1)
  const [likedHasMore, setLikedHasMore] = useState(true)
  const [likedLoadingMore, setLikedLoadingMore] = useState(false)

  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [followList, setFollowList] = useState<AgoraFollowEntry[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [followListPage, setFollowListPage] = useState(1)
  const [followListHasMore, setFollowListHasMore] = useState(false)
  const [followListLoadingMore, setFollowListLoadingMore] = useState(false)
  const [followButtonLoading, setFollowButtonLoading] = useState<string | null>(null)
  const [showTipModal, setShowTipModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const res = await getAgoraUserProfile(id, token)
    setLoading(false)
    if (!res.success) {
      setError(res.message ?? 'Failed to load profile')
      setProfile(null)
      return
    }
    setProfile(res.data ?? null)
  }, [id, token])

  const fetchCasts = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!id) return
      if (append) setLoadingMore(true)
      else setCastsLoading(true)
      setCastsError(null)

      const res = await getAgoraPosts(
        { page: pageNum, limit: 20, author: id, parentPost: null },
        token
      )

      if (append) setLoadingMore(false)
      else setCastsLoading(false)

      if (!res.success) {
        setCastsError(res.message ?? 'Failed to load casts')
        if (!append) setCasts([])
        return
      }
      const list = res.data?.posts ?? []
      const pagination = res.data?.pagination
      setHasMore(pagination ? pagination.page < pagination.totalPages : false)
      if (append) {
        setCasts((prev) => {
          const ids = new Set(prev.map((c) => c._id))
          const newOnes = list.filter((c) => !ids.has(c._id))
          return [...prev, ...newOnes]
        })
      } else {
        setCasts(list)
      }
    },
    [id, token]
  )

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }
    if (!id) return
    fetchProfile()
  }, [isLoggedIn, id])

  const fetchLiked = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!id) return
      if (append) setLikedLoadingMore(true)
      else setLikedLoading(true)
      setLikedError(null)

      const res = await getAgoraUserLikedPosts(id, { page: pageNum, limit: 20 }, token)

      if (append) setLikedLoadingMore(false)
      else setLikedLoading(false)

      if (!res.success) {
        setLikedError(res.message ?? 'Failed to load liked casts')
        if (!append) setLikedCasts([])
        return
      }
      const list = res.data?.posts ?? []
      const pagination = res.data?.pagination
      setLikedHasMore(pagination ? pagination.page < pagination.totalPages : false)
      if (append) {
        setLikedCasts((prev) => {
          const ids = new Set(prev.map((c) => c._id))
          const newOnes = list.filter((c) => !ids.has(c._id))
          return [...prev, ...newOnes]
        })
      } else {
        setLikedCasts(list)
      }
    },
    [id, token]
  )

  useEffect(() => {
    if (!id) return
    setPage(1)
    fetchCasts(1, false)
  }, [id, fetchCasts])

  useEffect(() => {
    if (!id || tab !== 'liked') return
    setLikedPage(1)
    fetchLiked(1, false)
  }, [id, tab, fetchLiked])

  const fetchFollowList = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!id || !followModal) return
      if (append) setFollowListLoadingMore(true)
      else setFollowListLoading(true)
      const fetcher = followModal === 'followers' ? getAgoraFollowers : getAgoraFollowing
      const res = await fetcher(id, { page: pageNum, limit: 20 }, token)
      if (append) setFollowListLoadingMore(false)
      else setFollowListLoading(false)
      if (!res.success) {
        if (!append) setFollowList([])
        return
      }
      const list = followModal === 'followers'
        ? ((res.data as { followers?: AgoraFollowEntry[] })?.followers ?? [])
        : ((res.data as { following?: AgoraFollowEntry[] })?.following ?? [])
      const pagination = followModal === 'followers' ? res.data?.pagination : res.data?.pagination
      setFollowListHasMore(pagination ? pagination.page < pagination.totalPages : false)
      if (append) {
        setFollowList((prev) => {
          const ids = new Set(prev.map((entry: AgoraFollowEntry) => entry.user._id))
          const newOnes = list.filter((entry: AgoraFollowEntry) => !ids.has(entry.user._id))
          return [...prev, ...newOnes]
        })
      } else {
        setFollowList(list)
      }
    },
    [id, followModal, token]
  )

  useEffect(() => {
    if (!followModal || !id) return
    setFollowListPage(1)
    fetchFollowList(1, false)
  }, [followModal, id, fetchFollowList])

  async function handleFollowInList(targetId: string, currentlyFollowing: boolean) {
    if (!token || targetId === authUser?.id) return
    setFollowButtonLoading(targetId)
    const res = currentlyFollowing
      ? await unfollowAgoraUser(token, targetId)
      : await followAgoraUser(token, targetId)
    setFollowButtonLoading(null)
    if (res.success) {
      setFollowList((prev) =>
        prev.map((e) =>
          e.user._id !== targetId ? e : { ...e, isFollowingByCurrentUser: !currentlyFollowing }
        )
      )
    }
  }

  function openFollowModal(type: 'followers' | 'following') {
    setFollowModal(type)
  }

  async function handleTipUser(amount: number) {
    if (!token || !id) return { success: false, message: 'Not logged in' }
    const res = await tipAgoraUser(token, id, amount)
    if (res.success) await refreshUser()
    return { success: res.success, message: res.message }
  }

  async function handleFollow() {
    if (!token || !id || !profile) return
    if (id === authUser?.id) return
    setFollowLoading(true)
    const isFollowing = profile.profile.isFollowingByCurrentUser
    const res = isFollowing
      ? await unfollowAgoraUser(token, id)
      : await followAgoraUser(token, id)
    setFollowLoading(false)
    if (res.success && profile) {
      setProfile({
        ...profile,
        profile: {
          ...profile.profile,
          isFollowingByCurrentUser: !isFollowing,
          followersCount: profile.profile.followersCount + (isFollowing ? -1 : 1),
        },
      })
    }
  }

  function handleLikeChange(castId: string, liked: boolean, likesCount: number) {
    setCasts((prev) =>
      prev.map((c) =>
        c._id === castId ? { ...c, likedByCurrentUser: liked, likesCount } : c
      )
    )
    setLikedCasts((prev) =>
      prev.map((c) =>
        c._id === castId ? { ...c, likedByCurrentUser: liked, likesCount } : c
      )
    )
  }

  function handleLoadMore() {
    if (tab === 'casts') {
      const next = page + 1
      setPage(next)
      fetchCasts(next, true)
    } else {
      const next = likedPage + 1
      setLikedPage(next)
      fetchLiked(next, true)
    }
  }

  const displayName =
    profile?.user?.username ?? profile?.user?.email ?? 'Anonymous'
  const isOwnProfile = id === authUser?.id

  return (
    <motion.div
      className="relative max-w-2xl"
      initial="visible"
      animate="visible"
      variants={container}
    >
          {/* Back link */}
          <motion.div variants={item} className="mb-6">
            <Link
              to="/agora"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Agora
            </Link>
          </motion.div>

          {loading ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
            >
              <p className="text-white/60">Loading profile...</p>
            </motion.div>
          ) : error || !profile ? (
            <motion.div
              variants={item}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center"
            >
              <p className="text-red-400 mb-2">{error ?? 'User not found'}</p>
              <Link to="/agora" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                Back to Agora
              </Link>
            </motion.div>
          ) : (
            <>
              {/* Profile header */}
              <motion.div
                variants={item}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 mb-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  {/* Avatar */}
                  <div
                    className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold bg-gradient-to-br from-indigo-500/40 to-cyan-500/40 border border-white/10 text-white overflow-hidden"
                  >
                    {profile.user.profilePicture ? (
                      <img
                        src={profile.user.profilePicture}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
                      {displayName}
                    </h1>
                    {profile.user.referralCode && (
                      <p className="text-white/50 text-sm mb-3">
                        @{profile.user.referralCode}
                      </p>
                    )}
                    {profile.user.walletAddress && (
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="font-mono text-sm text-white/60 truncate max-w-[200px] sm:max-w-[280px]" title={profile.user.walletAddress}>
                          {profile.user.walletAddress.slice(0, 6)}...{profile.user.walletAddress.slice(-4)}
                        </span>
                        <Link
                          to={`/chainlens?address=${encodeURIComponent(profile.user.walletAddress)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Analyze on ChainLens
                        </Link>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-white/70 mb-4">
                      <span>{profile.profile.postsCount} casts</span>
                      <button
                        type="button"
                        onClick={() => openFollowModal('followers')}
                        className="hover:text-indigo-400 transition-colors"
                      >
                        {profile.profile.followersCount} followers
                      </button>
                      <button
                        type="button"
                        onClick={() => openFollowModal('following')}
                        className="hover:text-indigo-400 transition-colors"
                      >
                        {profile.profile.followingCount} following
                      </button>
                    </div>
                    {!isOwnProfile && isLoggedIn && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleFollow}
                          disabled={followLoading}
                          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 ${
                            profile.profile.isFollowingByCurrentUser
                              ? 'bg-white/10 text-white/90 hover:bg-rose-500/20 hover:text-rose-400 border border-white/20'
                              : 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:from-indigo-400 hover:to-cyan-400'
                          }`}
                        >
                          {followLoading
                            ? '...'
                            : profile.profile.isFollowingByCurrentUser
                              ? 'Following'
                              : 'Follow'}
                        </button>
                        <Link
                          to={`/agora/messages?with=${id}`}
                          className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-400/30 transition-colors inline-flex items-center gap-2"
                        >
                          Message
                        </Link>
                        <button
                          type="button"
                          onClick={() => setShowTipModal(true)}
                          className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-400/30 transition-colors"
                        >
                          Tip
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReportModal(true)}
                          className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/10 text-white/70 hover:bg-rose-500/20 hover:text-rose-400 border border-white/20 transition-colors"
                        >
                          Report
                        </button>
                      </div>
                    )}
                    {isOwnProfile && (
                      <Link
                        to="/profile"
                        className="inline-block px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/10 text-white/90 hover:bg-white/15 border border-white/20 transition-colors"
                      >
                        Edit profile
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Tabs: Casts | Liked */}
              <motion.div variants={item} className="mb-6">
                <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setTab('casts')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      tab === 'casts'
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Casts
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('liked')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      tab === 'liked'
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Liked
                  </button>
                </div>
              </motion.div>

              {/* Content */}
              <motion.div variants={item}>
                {tab === 'casts' ? (
                  castsLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                      <p className="text-white/60">Loading casts...</p>
                    </div>
                  ) : castsError ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                      <p className="text-red-400">{castsError}</p>
                    </div>
                  ) : casts.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                      <p className="text-white/60">No casts yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AnimatePresence mode="popLayout">
                        {casts.map((cast) => (
                          <motion.div key={cast._id} variants={item}>
                            <CastCard
                              cast={cast}
                              token={token}
                              currentUserId={isOwnProfile ? authUser?.id : undefined}
                              onLikeChange={handleLikeChange}
                              onBookmarkChange={(id, bookmarked) =>
                                setCasts((prev) =>
                                  prev.map((c) => (c._id === id ? { ...c, bookmarkedByCurrentUser: bookmarked } : c))
                                )
                              }
                              onUpdate={isOwnProfile ? (updated) => setCasts((prev) => prev.map((c) => (c._id === updated._id ? updated : c))) : undefined}
                              onDelete={isOwnProfile ? () => setCasts((prev) => prev.filter((x) => x._id !== cast._id)) : undefined}
                              showAuthorLink={false}
                              showThreadLink
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {hasMore && (
                        <motion.div variants={item} className="flex justify-center pt-4">
                          <button
                            type="button"
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/30 disabled:opacity-50 transition-colors"
                          >
                            {loadingMore ? 'Loading...' : 'Load more'}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  )
                ) : likedLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                    <p className="text-white/60">Loading liked casts...</p>
                  </div>
                ) : likedError ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                    <p className="text-red-400">{likedError}</p>
                  </div>
                ) : likedCasts.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                    <p className="text-white/60">No liked casts yet. Casts this user has liked will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {likedCasts.map((cast) => (
                        <motion.div key={cast._id} variants={item}>
                          <CastCard
                            cast={cast}
                            token={token}
                            currentUserId={isOwnProfile ? authUser?.id : undefined}
                            onLikeChange={handleLikeChange}
                            onBookmarkChange={(id, bookmarked) =>
                              setLikedCasts((prev) =>
                                prev.map((c) => (c._id === id ? { ...c, bookmarkedByCurrentUser: bookmarked } : c))
                              )
                            }
                            onUpdate={isOwnProfile ? (updated) => setLikedCasts((prev) => prev.map((c) => (c._id === updated._id ? updated : c))) : undefined}
                            onDelete={isOwnProfile ? () => setLikedCasts((prev) => prev.filter((x) => x._id !== cast._id)) : undefined}
                            showAuthorLink
                            showThreadLink
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {likedHasMore && (
                      <motion.div variants={item} className="flex justify-center pt-4">
                        <button
                          type="button"
                          onClick={handleLoadMore}
                          disabled={likedLoadingMore}
                          className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/30 disabled:opacity-50 transition-colors"
                        >
                          {likedLoadingMore ? 'Loading...' : 'Load more'}
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            </>
          )}

      {/* Tip modal (profile) */}
      {showTipModal && id && profile && (
        <TipModal
          authorName={displayName}
          userBalance={authUser?.loyaltyPoints ?? 0}
          onConfirm={handleTipUser}
          onClose={() => setShowTipModal(false)}
        />
      )}

      {showReportModal && id && token && (
        <ReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          title="Report this user"
          onConfirm={async (reason) => {
            const res = await reportAgoraUser(token, id, reason)
            return { success: res.success, message: res.message }
          }}
        />
      )}

      {/* Followers / Following modal */}
      {followModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setFollowModal(null)}
        >
          <div
            className="rounded-2xl border border-white/10 bg-[#0a0a0f] w-full max-w-md max-h-[80vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {followModal === 'followers' ? 'Followers' : 'Following'}
              </h3>
              <button
                type="button"
                onClick={() => setFollowModal(null)}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {followListLoading ? (
                <div className="py-12 text-center text-white/60">Loading...</div>
              ) : followList.length === 0 ? (
                <div className="py-12 text-center text-white/60">
                  No {followModal} yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {followList
                    .filter((e) => e.user._id ?? (e.user as { id?: string }).id)
                    .map((entry) => {
                      const u = entry.user
                      const userId = (u._id ?? (u as { id?: string }).id)!
                      const displayName = u.username ?? u.email ?? 'Anonymous'
                      const isOwn = userId === authUser?.id
                      return (
                      <div
                        key={userId}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <Link
                          to={`/agora/user/${userId}`}
                          onClick={() => setFollowModal(null)}
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-white/10 text-white overflow-hidden"
                        >
                          {u.profilePicture ? (
                            <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </Link>
                        <Link
                          to={`/agora/user/${userId}`}
                          onClick={() => setFollowModal(null)}
                          className="flex-1 min-w-0 font-medium text-white hover:text-indigo-400 truncate"
                        >
                          {displayName}
                        </Link>
                        {!isOwn && isLoggedIn && (
                          <button
                            type="button"
                            onClick={() => handleFollowInList(userId, !!entry.isFollowingByCurrentUser)}
                            disabled={followButtonLoading === userId}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                              entry.isFollowingByCurrentUser
                                ? 'bg-white/10 text-white/90 hover:bg-rose-500/20 hover:text-rose-400 border border-white/20'
                                : 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:from-indigo-400 hover:to-cyan-400'
                            }`}
                          >
                            {followButtonLoading === userId
                              ? '...'
                              : entry.isFollowingByCurrentUser
                                ? 'Following'
                                : 'Follow'}
                          </button>
                        )}
                      </div>
                    )
                    })}
                </div>
              )}
              {followListHasMore && (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => {
                      const next = followListPage + 1
                      setFollowListPage(next)
                      fetchFollowList(next, true)
                    }}
                    disabled={followListLoadingMore}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white border border-white/20 disabled:opacity-50 transition-colors"
                  >
                    {followListLoadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
