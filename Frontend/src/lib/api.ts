// When empty, requests are same-origin; Vite proxy (vite.config.ts) forwards /api to backend in dev
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

/** Headers to add for tunnel URLs (ngrok shows interstitial without this) */
function tunnelHeaders(): Record<string, string> {
  if (API_BASE && (API_BASE.includes('ngrok') || API_BASE.includes('trycloudflare'))) {
    return { 'ngrok-skip-browser-warning': 'true' }
  }
  return {}
}

/** fetch with tunnel bypass headers for API calls */
function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = { ...tunnelHeaders(), ...(init?.headers as Record<string, string>) }
  return fetch(url, { ...init, headers })
}

export function apiUrl(path: string): string {
  const base = (API_BASE ?? '').replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  // Avoid double /api when base already ends with /api (e.g. VITE_API_BASE_URL=http://localhost:5000/api)
  const baseWithoutApi = base ? base.replace(/\/api\/?$/, '') : ''
  return baseWithoutApi ? `${baseWithoutApi}${p}` : p
}

export async function fetchJson<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; success: boolean; message?: string }> {
  const url = path.startsWith('http') ? path : apiUrl(path)
  const res = await apiFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      success: false,
      message: (json as { message?: string }).message ?? 'Request failed',
    }
  }
  return { ...json, success: json.success !== false }
}

export async function postAuth(
  path: 'auth/login' | 'auth/register',
  body: Record<string, unknown>
): Promise<{
  success: boolean
  message?: string
  data?: {
    user: { id: string; email?: string; username?: string; referralCode?: string; loyaltyPoints?: number }
    token: string
    expiresIn?: string
  }
}> {
  return fetchJson(apiUrl(`/api/${path}`), {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<{
    success: boolean
    message?: string
    data?: {
      user: { id: string; email?: string; username?: string; referralCode?: string; loyaltyPoints?: number; profilePicture?: string }
      token: string
      expiresIn?: string
    }
  }>
}

/** POST /api/auth/google - Sign in with Google (idToken from Google Identity Services). Optional referralCode for new signups. */
export async function loginWithGoogle(
  idToken: string,
  referralCode?: string
): Promise<{
  success: boolean
  message?: string
  data?: {
    user: { id: string; email?: string; username?: string; referralCode?: string; loyaltyPoints?: number; profilePicture?: string }
    token: string
    expiresIn?: string
  }
}> {
  return fetchJson(apiUrl('/api/auth/google'), {
    method: 'POST',
    body: JSON.stringify(
      referralCode?.trim()
        ? { idToken, referralCode: referralCode.trim() }
        : { idToken }
    ),
  }) as Promise<{
    success: boolean
    message?: string
    data?: {
      user: { id: string; email?: string; username?: string; referralCode?: string; loyaltyPoints?: number; profilePicture?: string }
      token: string
      expiresIn?: string
    }
  }>
}

export type ProfileUser = {
  id: string
  email?: string
  username?: string
  referralCode?: string
  loyaltyPoints?: number
  profilePicture?: string
  dailyClaimStreak?: number
  lastDailyClaimAt?: string | null
  twitterId?: string
  walletAddress?: string
  createdAt?: string
  emailVerified?: boolean
  isAdmin?: boolean
}

export type ProfileData = {
  user: ProfileUser
  profile: {
    followersCount: number
    followingCount: number
    questsCompleted: number
    campaignsParticipated: number
    campaignsCreated: number
    postsCount: number
  }
}

export async function getMe(token: string): Promise<{ success: boolean; message?: string; data?: ProfileData }> {
  const res = await apiFetch(apiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function updateProfile(
  token: string,
  body: { username?: string; profilePicture?: string | null; walletAddress?: string | null; twitterProfileUrl?: string }
): Promise<{
  success: boolean
  message?: string
  data?: { user: ProfileUser }
}> {
  const res = await apiFetch(apiUrl('/api/auth/me'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** Create a pending mock order; returns orderId, txHash, pointsAmount, etc. */
export async function createLoyaltyOrder(
  token: string,
  body: { walletAddress: string; amount?: number }
): Promise<{
  success: boolean
  message?: string
  data?: {
    orderId: string
    pointsAmount: number
    amountCrypto: string
    txHash: string
    status: string
    walletAddress: string
  }
}> {
  const res = await apiFetch(apiUrl('/api/wallet/orders'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** Simulate confirmation: credit loyalty points. */
export async function confirmLoyaltyOrder(
  token: string,
  orderId: string
): Promise<{
  success: boolean
  message?: string
  data?: {
    orderId: string
    txHash: string
    loyaltyPointsCredited: number
    newBalance: number
    previousBalance: number
  }
}> {
  const res = await apiFetch(apiUrl(`/api/wallet/orders/${orderId}/confirm`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: '{}',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** Daily claim: points per day 1–7 (matches backend DAILY_CLAIM_POINTS). */
export const DAILY_CLAIM_POINTS = [10, 20, 30, 40, 50, 60, 70] as const

export type DailyClaimStatus = {
  canClaim: boolean
  currentStreak: number
  nextDayNumber: number | null
  nextClaimAt: string | null
  pointsForNextClaim: number | null
}

export async function getDailyClaimStatus(token: string): Promise<{
  success: boolean
  message?: string
  data?: DailyClaimStatus
}> {
  const res = await apiFetch(apiUrl('/api/daily-claim/status'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function claimDailyReward(token: string): Promise<{
  success: boolean
  message?: string
  data?: { pointsClaimed: number; dayNumber: number; newBalance: number; nextClaimAt: string }
}> {
  const res = await apiFetch(apiUrl('/api/daily-claim'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: '{}',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

// ——— Campaigns ———
export type CampaignStatus = 'active' | 'expired' | 'draft'

export type CampaignOwner = { _id: string; username?: string; email?: string }

export type CampaignQuest = {
  _id: string
  title: string
  description: string
  requiredLink: string
  type: string
  campaignId?: { _id: string; name?: string }
  createdAt?: string
}

export type CampaignListItem = {
  _id: string
  name: string
  description: string
  owner: CampaignOwner
  quests: CampaignQuest[] | string[]
  participants: { _id: string }[] | string[]
  costInPoints: number
  status: CampaignStatus
  expiryDate?: string | null
  createdAt: string
  updatedAt: string
}

export type CampaignDetail = CampaignListItem & {
  quests: CampaignQuest[]
  participants: { _id: string; username?: string; email?: string }[]
}

export async function listCampaigns(ownerId?: string): Promise<{
  success: boolean
  message?: string
  data?: { campaigns: CampaignListItem[] }
}> {
  const qs = ownerId ? `?owner=${encodeURIComponent(ownerId)}` : ''
  const url = apiUrl(`/api/campaigns${qs}`)
  let res: Response
  try {
    res = await apiFetch(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return { success: false, message: msg }
  }
  let json: unknown
  try {
    const text = await res.text()
    if (res.ok && (text.startsWith('<!') || text.startsWith('<html'))) {
      return { success: false, message: 'API returned HTML (check proxy: /api should forward to backend)' }
    }
    json = text ? JSON.parse(text) : {}
  } catch {
    json = {}
  }
  const body = json as { data?: { campaigns?: CampaignListItem[] }; campaigns?: CampaignListItem[]; message?: string }
  if (!res.ok) {
    const message = body.message ?? (res.status === 500 ? 'Server error (check backend terminal)' : res.status === 0 ? 'Network/CORS error (check backend runs and CORS allows your origin)' : 'Request failed')
    return { success: false, message }
  }
  const campaigns = Array.isArray(body.data?.campaigns)
    ? body.data.campaigns
    : Array.isArray(body.campaigns)
      ? body.campaigns
      : []
  return { success: true, data: { campaigns } }
}

export async function getCampaign(id: string, token?: string | null): Promise<{
  success: boolean
  message?: string
  data?: { campaign: CampaignDetail; completedQuestIds?: string[] }
}> {
  const res = await apiFetch(apiUrl(`/api/campaigns/${id}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function createCampaign(
  token: string,
  body: { name: string; description: string; expiryDays?: number }
): Promise<{
  success: boolean
  message?: string
  data?: { campaign: CampaignListItem; newBalance?: number }
}> {
  const res = await apiFetch(apiUrl('/api/campaigns'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function updateCampaign(
  token: string,
  id: string,
  body: { name?: string; description?: string; status?: CampaignStatus; expiryDate?: string | null }
): Promise<{ success: boolean; message?: string; data?: { campaign: CampaignListItem } }> {
  const res = await apiFetch(apiUrl(`/api/campaigns/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function deleteCampaign(token: string, id: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(apiUrl(`/api/campaigns/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function addQuestToCampaign(
  token: string,
  campaignId: string,
  body: { title: string; description: string; requiredLink: string; type: string }
): Promise<{ success: boolean; message?: string; data?: { quest: CampaignQuest; newBalance?: number } }> {
  const res = await apiFetch(apiUrl(`/api/campaigns/${campaignId}/quests`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

// ——— Quests ———
export async function listQuests(campaignId?: string): Promise<{
  success: boolean
  message?: string
  data?: { quests: CampaignQuest[] }
}> {
  const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ''
  const res = await apiFetch(apiUrl(`/api/quests${qs}`))
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function getQuest(id: string): Promise<{
  success: boolean
  message?: string
  data?: { quest: CampaignQuest }
}> {
  const res = await apiFetch(apiUrl(`/api/quests/${id}`))
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function updateQuest(
  token: string,
  id: string,
  body: { title?: string; description?: string; requiredLink?: string; type?: string }
): Promise<{ success: boolean; message?: string; data?: { quest: CampaignQuest } }> {
  const res = await apiFetch(apiUrl(`/api/quests/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function deleteQuest(token: string, id: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(apiUrl(`/api/quests/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function verifyQuest(
  token: string,
  questId: string,
  tweetUrl?: string
): Promise<{
  success: boolean
  message?: string
  data?: { message: string; points_awarded: number; total_points: number; quest_id: string }
}> {
  const qs = tweetUrl ? `?tweetUrl=${encodeURIComponent(tweetUrl)}` : ''
  const res = await apiFetch(apiUrl(`/api/quests/${questId}/verify${qs}`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export const QUEST_TYPES = [
  { value: 'follow_twitter', label: 'Follow on Twitter/X', hint: 'Twitter profile URL' },
  { value: 'retweet_tweet', label: 'Retweet', hint: 'Tweet URL' },
  { value: 'tweet_tag', label: 'Tag in a tweet', hint: 'Handle or profile URL; verify with your tweet URL' },
  { value: 'agora_follow', label: 'Follow on Agora', hint: 'Leave empty to follow campaign creator' },
  { value: 'agora_like_post', label: 'Like a cast', hint: 'Cast ID or thread URL' },
  { value: 'agora_comment', label: 'Reply to a cast', hint: 'Cast ID or thread URL' },
  { value: 'agora_bookmark_post', label: 'Bookmark a cast', hint: 'Cast ID or thread URL' },
] as const

export const COST_CAMPAIGN_CREATE = 100
export const COST_QUEST_ADD = 50
export const QUEST_COMPLETION_REWARD_POINTS = 25

// ——— ChainLens (wallet intelligence) ———
export const COST_CHAINLENS = 10

export type ChainLensTopHolding = {
  symbol: string
  name: string
  balance: string
  valueUSD: number
  percentage: number
  logo?: string
}

export type ChainLensTimelineItem = {
  type: 'Send' | 'Receive' | 'Buy' | 'Sell'
  token?: string
  amount?: string
  value?: string
  date: string
  txHash: string
  from?: string
  to?: string
}

export type ChainLensPortfolioAllocationItem = {
  name: string
  symbol: string
  value: number
  percentage: number
}

export type ChainLensActivityByDay = {
  date: string
  count: number
}

export type ChainLensNFT = {
  tokenAddress: string
  tokenId: string
  name: string
  collection: string
  image?: string
  floorPriceUsd?: number
  contractType?: string
}

export type ChainLensData = {
  walletAddress: string
  chain: string
  portfolio: {
    netWorthUSD: number
    tokenCount: number
    nativeBalance?: string
  }
  degenScore: {
    label: 'Paper Hands' | 'Diamond Hands' | 'DeFi Scientist'
    description: string
    txCount: number
    uniqueTokenCount: number
  }
  topHoldings: ChainLensTopHolding[]
  portfolioAllocation?: ChainLensPortfolioAllocationItem[]
  activityByDay?: ChainLensActivityByDay[]
  nfts?: ChainLensNFT[]
  transactionTimeline: ChainLensTimelineItem[]
  loyaltyPointsSpent: number
  yourNewBalance: number
}

export async function getWalletInsights(
  token: string,
  body: { walletAddress: string; chain?: string }
): Promise<{
  success: boolean
  message?: string
  data?: ChainLensData
}> {
  const res = await apiFetch(apiUrl('/api/chainlens'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

// ——— Trendcraft ———
export const COST_TRENDCRAFT_GEMINI = 3

export type TrendcraftSource = 'youtube' | 'reddit' | 'hackernews' | 'news'

export type TrendcraftItem = {
  source: TrendcraftSource
  id: string
  title: string
  url?: string
  description?: string
  publishedAt?: string
  metadata: Record<string, unknown>
}

export async function getTrendcraftFeed(
  params?: {
    sources?: string
    limit?: number
    subreddit?: string
    hn_list?: string
    country?: string
    category?: string
  },
  token?: string | null
): Promise<{
  success: boolean
  message?: string
  data?: { items: TrendcraftItem[]; sources: string[]; newBalance?: number }
}> {
  const qs = new URLSearchParams()
  if (params?.sources) qs.set('sources', params.sources)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.subreddit) qs.set('subreddit', params.subreddit)
  if (params?.hn_list) qs.set('hn_list', params.hn_list)
  if (params?.country) qs.set('country', params.country)
  if (params?.category) qs.set('category', params.category)
  const url = apiUrl(`/api/trendcraft/feed${qs.toString() ? `?${qs}` : ''}`)
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function getTrendcraftYouTube(params?: {
  limit?: number
  q?: string
  order?: 'viewCount' | 'relevance' | 'date'
}): Promise<{ success: boolean; message?: string; data?: { source: string; items: TrendcraftItem[] } }> {
  const qs = new URLSearchParams()
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.q) qs.set('q', params.q)
  if (params?.order) qs.set('order', params.order)
  const url = apiUrl(`/api/trendcraft/youtube${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function getTrendcraftReddit(params?: {
  subreddit?: string
  limit?: number
}): Promise<{ success: boolean; message?: string; data?: { source: string; subreddit: string; items: TrendcraftItem[] } }> {
  const qs = new URLSearchParams()
  if (params?.subreddit) qs.set('subreddit', params.subreddit)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/trendcraft/reddit${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function getTrendcraftHackerNews(params?: {
  list?: 'topstories' | 'beststories' | 'newstories'
  limit?: number
}): Promise<{ success: boolean; message?: string; data?: { source: string; list: string; items: TrendcraftItem[] } }> {
  const qs = new URLSearchParams()
  if (params?.list) qs.set('list', params.list)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/trendcraft/hackernews${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function getTrendcraftNews(params?: {
  country?: string
  category?: string
  pageSize?: number
  page?: number
  q?: string
}): Promise<{
  success: boolean
  message?: string
  data?: { source: string; country: string; category?: string; page: number; items: TrendcraftItem[] }
}> {
  const qs = new URLSearchParams()
  if (params?.country) qs.set('country', params.country)
  if (params?.category) qs.set('category', params.category)
  if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize))
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.q) qs.set('q', params.q)
  const url = apiUrl(`/api/trendcraft/news${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function generateTrendcraftContent(
  token: string,
  body: { keyword?: string; contentIdea?: string }
): Promise<{
  success: boolean
  message?: string
  data?: {
    content: string
    input: { keyword?: string; contentIdea?: string }
    loyaltyPointsDeducted: number
    newBalance: number
  }
}> {
  const res = await apiFetch(apiUrl('/api/trendcraft/generate-content'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function getTrendcraftContentSuggestions(token: string): Promise<{
  success: boolean
  message?: string
  data?: {
    suggestions: Array<{ index: number; text: string }>
    loyaltyPointsDeducted: number
    newBalance: number
  }
}> {
  const res = await apiFetch(apiUrl('/api/trendcraft/content-suggestions'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

// ——— PulseBot (Telegram chat context, summaries, Q&A) ———
export const COST_PULSEBOT_SUMMARY = 10
export const COST_PULSEBOT_ASK = 10
export const COST_PULSEBOT_STATS = 2

export const COST_EMAIL_TASKS = 5
export const COST_EMAIL_SUGGEST_REPLY = 5
export const COST_GITHUB_TASKS = 5

export type PulseBotMe = {
  linked: boolean
  telegramUsername: string | null
  groups: Array<{ groupTelegramId: string; title: string }>
}

export async function getPulseBotMe(token: string): Promise<{
  success: boolean
  message?: string
  data?: PulseBotMe
}> {
  const res = await apiFetch(apiUrl('/api/pulsebot/me'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function createPulseBotLinkCode(token: string): Promise<{
  success: boolean
  message?: string
  data?: {
    code: string
    botUsername: string
    botUrl: string
    instructions: string
    expiresInMinutes: number
  }
}> {
  const res = await apiFetch(apiUrl('/api/pulsebot/link-code'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function generatePulseBotSummary(token: string): Promise<{
  success: boolean
  message?: string
  data?: { summary: string; loyaltyPointsDeducted: number; newBalance: number }
}> {
  const res = await apiFetch(apiUrl('/api/pulsebot/summary'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function pulsebotAsk(
  token: string,
  body: { question: string }
): Promise<{
  success: boolean
  message?: string
  data?: { answer: string; loyaltyPointsDeducted: number; newBalance: number }
}> {
  const res = await apiFetch(apiUrl('/api/pulsebot/ask'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export type PulseBotStatsGroup = {
  groupTelegramId: string
  title: string
  totalMessages: number
  topParticipants: Array<{ telegramUserId: number; username: string | null; messageCount: number }>
}

export async function getPulseBotStats(token: string): Promise<{
  success: boolean
  message?: string
  data?: { groups: PulseBotStatsGroup[]; periodHours: number; newBalance?: number }
}> {
  const res = await apiFetch(apiUrl('/api/pulsebot/stats'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

// ——— Email integration (Gmail: sync, AI tasks, suggest reply, send) ———

export type EmailIntegrationStatus = {
  gmail: {
    connected: boolean
    email?: string
    lastSyncedAt?: string
    syncedCount?: number
  }
}

export async function getEmailIntegrationStatus(token: string): Promise<{
  success: boolean
  message?: string
  data?: EmailIntegrationStatus
}> {
  const res = await apiFetch(apiUrl('/api/email-integration/status'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export type GmailDigest = {
  unreadCount: number
  totalMessages: number | null
  totalThreads: number | null
  topThreads: Array<{ threadId: string; messageCount: number; subject: string }>
  lastActivityAt: string | null
  mostActiveSender: { email: string; count: number } | null
  lastEmails?: Array<{ messageId: string; subject: string; from: string; date: string; snippet: string }>
}

export async function getGmailDigest(token: string): Promise<{
  success: boolean
  message?: string
  data?: GmailDigest
}> {
  const res = await apiFetch(apiUrl('/api/email-integration/gmail/digest'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export type TelegramDigest = {
  totalMessages: number
  topGroupsByMessageCount: Array<{ groupTelegramId: string; groupTitle: string; messageCount: number }>
  lastActivityAt: string | null
  mostActiveSender: { username: string | null; telegramUserId: number; count: number } | null
  periodHours: number
}

export async function getTelegramDigest(token: string): Promise<{
  success: boolean
  message?: string
  data?: TelegramDigest
}> {
  const res = await apiFetch(apiUrl('/api/pulsebot/digest'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function getGmailConnectUrl(token: string): Promise<{
  success: boolean
  message?: string
  data?: { url: string; redirectUri: string }
}> {
  const res = await apiFetch(apiUrl('/api/email-integration/gmail/auth-url'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function disconnectGmail(token: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(apiUrl('/api/email-integration/gmail/disconnect'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function syncGmail(token: string): Promise<{
  success: boolean
  message?: string
  data?: { synced: number; total: number }
}> {
  const res = await apiFetch(apiUrl('/api/email-integration/gmail/sync'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export type ScheduledEmailItem = {
  _id: string
  to: string
  subject: string
  scheduledFor: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  error?: string
}

export async function scheduleEmail(
  token: string,
  body: { to: string; subject: string; bodyPlain: string; scheduledFor: string }
): Promise<{
  success: boolean
  message?: string
  data?: ScheduledEmailItem
}> {
  const res = await apiFetch(apiUrl('/api/email-integration/scheduled'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function listScheduledEmails(token: string): Promise<{
  success: boolean
  message?: string
  data?: ScheduledEmailItem[]
}> {
  const res = await apiFetch(apiUrl('/api/email-integration/scheduled'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  const d = json as { success?: boolean; data?: unknown }
  return { ...d, success: d.success !== false, data: Array.isArray(d.data) ? d.data : [] }
}

export type ScheduledEmailDetail = ScheduledEmailItem & { bodyPlain?: string }

export async function getScheduledEmail(
  token: string,
  id: string
): Promise<{ success: boolean; message?: string; data?: ScheduledEmailDetail }> {
  const res = await apiFetch(apiUrl(`/api/email-integration/scheduled/${id}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function updateScheduledEmail(
  token: string,
  id: string,
  body: { to: string; subject: string; bodyPlain: string; scheduledFor: string }
): Promise<{ success: boolean; message?: string; data?: ScheduledEmailItem }> {
  const res = await apiFetch(apiUrl(`/api/email-integration/scheduled/${id}`), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function deleteScheduledEmail(
  token: string,
  id: string
): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(apiUrl(`/api/email-integration/scheduled/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export type EmailTaskItem = {
  _id: string
  syncedEmail: { messageId: string; subject: string; from: string; date: string }
  title: string
  description: string
  type: string
}

export async function listEmailTasks(token: string): Promise<{
  success: boolean
  message?: string
  data?: { tasks: EmailTaskItem[]; newBalance?: number }
}> {
  const res = await apiFetch(apiUrl('/api/email-integration/tasks'), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: (json as { success?: boolean }).success !== false }
}

export async function getEmailByMessageId(
  token: string,
  messageId: string
): Promise<{
  success: boolean
  message?: string
  data?: {
    email: {
      messageId: string
      threadId: string
      from: string
      to: string
      subject: string
      snippet: string
      bodyPlain?: string
      date: string
    }
    task: {
      _id: string
      title: string
      description: string
      type: string
      suggestedReply?: string
      confirmedReply?: string
      replySentAt?: string
    } | null
  }
}> {
  const res = await apiFetch(apiUrl(`/api/email-integration/emails/${encodeURIComponent(messageId)}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function suggestEmailReply(
  token: string,
  taskId: string,
  body: { userMessage?: string }
): Promise<{
  success: boolean
  message?: string
  data?: { suggestedReply: string; newBalance?: number }
}> {
  const res = await apiFetch(apiUrl(`/api/email-integration/tasks/${taskId}/suggest-reply`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

export async function sendEmailReply(
  token: string,
  taskId: string,
  body: { confirmedReply: string }
): Promise<{ success: boolean; message?: string; data?: { sent: boolean; messageId: string } }> {
  const res = await apiFetch(apiUrl(`/api/email-integration/tasks/${taskId}/send`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

// ——— Agora (social feed, Casts) ———

export type AgoraCastAuthor = {
  _id: string
  username?: string
  email?: string
  profilePicture?: string
}

export type AgoraCast = {
  _id: string
  user: AgoraCastAuthor
  content: string
  images?: string[] // base64 data URLs (same as profile picture)
  parentPost?: { _id: string; content: string; user?: AgoraCastAuthor; createdAt?: string } | null
  likesCount: number
  createdAt: string
  updatedAt?: string
  likedByCurrentUser?: boolean
  bookmarkedByCurrentUser?: boolean
}

export type AgoraFeedResponse = {
  posts: AgoraCast[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

async function agoraFetch(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<{ success: boolean; message?: string; data?: unknown }> {
  const { token, ...rest } = options
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  }
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(apiUrl(path), { ...rest, headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** GET /api/agora/posts - List all casts (For You feed). Optional auth. */
export async function getAgoraPosts(params?: {
  page?: number
  limit?: number
  author?: string
  parentPost?: string | null
  following?: boolean
}, token?: string | null): Promise<{ success: boolean; message?: string; data?: AgoraFeedResponse }> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.author) qs.set('author', params.author)
  if (params?.parentPost !== undefined) qs.set('parentPost', String(params.parentPost))
  if (params?.following) qs.set('following', 'true')
  const url = apiUrl(`/api/agora/posts${qs.toString() ? `?${qs}` : ''}`)
  const headers: HeadersInit = {}
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** GET /api/agora/feed - Home feed (following only). Auth required. */
export async function getAgoraHomeFeed(
  token: string,
  params?: { page?: number; limit?: number }
): Promise<{ success: boolean; message?: string; data?: AgoraFeedResponse }> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  return agoraFetch(`/api/agora/feed${qs.toString() ? `?${qs}` : ''}`, { token }) as Promise<{
    success: boolean
    message?: string
    data?: AgoraFeedResponse
  }>
}

/** GET /api/agora/users/most-tipped - List users by total tips received. Optional auth. */
export type AgoraMostTippedUser = {
  user: { id: string; username?: string; email?: string; profilePicture?: string; referralCode?: string }
  totalTipsReceived: number
}

export async function getAgoraMostTippedUsers(
  params?: { page?: number; limit?: number },
  token?: string | null
): Promise<{
  success: boolean
  message?: string
  data?: {
    users: AgoraMostTippedUser[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/users/most-tipped${qs.toString() ? `?${qs}` : ''}`)
  const headers: HeadersInit = {}
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** GET /api/agora/users - List users (for search). Paginated, optional q for username/email search. Auth required. */
export type AgoraListedUser = {
  id: string
  username?: string
  email?: string
  referralCode?: string
  profilePicture?: string
}

export async function listAgoraUsers(
  params: { page?: number; limit?: number; q?: string },
  token: string
): Promise<{
  success: boolean
  message?: string
  data?: {
    users: AgoraListedUser[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
}> {
  const qs = new URLSearchParams()
  if (params.page != null) qs.set('page', String(params.page))
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.q != null && params.q.trim()) qs.set('q', params.q.trim())
  const path = `/api/agora/users${qs.toString() ? `?${qs}` : ''}`
  return agoraFetch(path, { token }) as Promise<{
    success: boolean
    message?: string
    data?: {
      users: AgoraListedUser[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
  }>
}

/** GET /api/agora/feed/trending - Trending casts by likes. Optional auth. */
export async function getAgoraTrendingFeed(
  params?: { page?: number; limit?: number },
  token?: string | null
): Promise<{ success: boolean; message?: string; data?: AgoraFeedResponse }> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/feed/trending${qs.toString() ? `?${qs}` : ''}`)
  const headers: HeadersInit = {}
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** POST /api/agora/posts - Create a cast. */
export async function createAgoraCast(
  token: string,
  body: { content: string; parentPost?: string; images?: string[] }
): Promise<{ success: boolean; message?: string; data?: { post: AgoraCast } }> {
  return agoraFetch('/api/agora/posts', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { post: AgoraCast } }>
}

/** POST /api/agora/posts/:id/like - Like a cast. */
export async function likeAgoraCast(
  token: string,
  id: string
): Promise<{ success: boolean; message?: string; data?: { liked: boolean; likesCount: number } }> {
  return agoraFetch(`/api/agora/posts/${id}/like`, { method: 'POST', body: '{}', token }) as Promise<{
    success: boolean
    message?: string
    data?: { liked: boolean; likesCount: number }
  }>
}

/** GET /api/agora/posts/:id - Get single cast with paginated replies (thread). */
export type AgoraThreadResponse = {
  post: AgoraCast
  replies: AgoraCast[]
  repliesPagination: { page: number; limit: number; total: number; totalPages: number }
}

export async function getAgoraPost(
  id: string,
  params?: { replyPage?: number; replyLimit?: number },
  token?: string | null
): Promise<{ success: boolean; message?: string; data?: AgoraThreadResponse }> {
  const qs = new URLSearchParams()
  if (params?.replyPage != null) qs.set('replyPage', String(params.replyPage))
  if (params?.replyLimit != null) qs.set('replyLimit', String(params.replyLimit))
  const url = apiUrl(`/api/agora/posts/${id}${qs.toString() ? `?${qs}` : ''}`)
  const headers: HeadersInit = {}
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** POST /api/agora/posts/:id/replies - Create a reply to a cast (thread). */
export async function createAgoraReply(
  token: string,
  postId: string,
  content: string,
  images?: string[]
): Promise<{ success: boolean; message?: string; data?: { post: AgoraCast } }> {
  return agoraFetch(`/api/agora/posts/${postId}/replies`, {
    method: 'POST',
    body: JSON.stringify(images?.length ? { content, images } : { content }),
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { post: AgoraCast } }>
}

/** PATCH /api/agora/posts/:id - Update cast or reply content (and optionally images). */
export async function updateAgoraCast(
  token: string,
  id: string,
  payload: { content?: string; images?: string[] }
): Promise<{ success: boolean; message?: string; data?: { post: AgoraCast } }> {
  return agoraFetch(`/api/agora/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { post: AgoraCast } }>
}

/** POST /api/agora/posts/:id/bookmark - Bookmark a cast. Auth required. */
export async function bookmarkAgoraCast(
  token: string,
  postId: string
): Promise<{ success: boolean; message?: string; data?: { bookmarked: boolean } }> {
  return agoraFetch(`/api/agora/posts/${postId}/bookmark`, {
    method: 'POST',
    body: '{}',
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { bookmarked: boolean } }>
}

/** DELETE /api/agora/posts/:id/bookmark - Remove bookmark. Auth required. */
export async function removeAgoraBookmark(
  token: string,
  postId: string
): Promise<{ success: boolean; message?: string; data?: { bookmarked: boolean } }> {
  return agoraFetch(`/api/agora/posts/${postId}/bookmark`, {
    method: 'DELETE',
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { bookmarked: boolean } }>
}

/** POST /api/agora/posts/:id/tip - Tip loyalty points to the cast author. Auth required. */
export async function tipAgoraPost(
  token: string,
  postId: string,
  amount: number
): Promise<{
  success: boolean
  message?: string
  data?: { amount: number; postId: string; recipientId: string; yourNewBalance: number }
}> {
  return agoraFetch(`/api/agora/posts/${postId}/tip`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
    token,
  }) as Promise<{
    success: boolean
    message?: string
    data?: { amount: number; postId: string; recipientId: string; yourNewBalance: number }
  }>
}

/** POST /api/agora/users/:id/tip - Tip loyalty points directly to a user (from profile). Auth required. */
export async function tipAgoraUser(
  token: string,
  userId: string,
  amount: number
): Promise<{
  success: boolean
  message?: string
  data?: { amount: number; recipientId: string; yourNewBalance: number }
}> {
  return agoraFetch(`/api/agora/users/${userId}/tip`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
    token,
  }) as Promise<{
    success: boolean
    message?: string
    data?: { amount: number; recipientId: string; yourNewBalance: number }
  }>
}

/** POST /api/agora/replies/:id/tip - Tip loyalty points to the reply author. Auth required. */
export async function tipAgoraReply(
  token: string,
  replyId: string,
  amount: number
): Promise<{
  success: boolean
  message?: string
  data?: { amount: number; postId: string; recipientId: string; yourNewBalance: number }
}> {
  return agoraFetch(`/api/agora/replies/${replyId}/tip`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
    token,
  }) as Promise<{
    success: boolean
    message?: string
    data?: { amount: number; postId: string; recipientId: string; yourNewBalance: number }
  }>
}

/** POST /api/agora/posts/:id/report - Report a post. Auth required. */
export async function reportAgoraPost(
  token: string,
  postId: string,
  reason?: string
): Promise<{ success: boolean; message?: string; data?: { reportId: string } }> {
  return agoraFetch(`/api/agora/posts/${postId}/report`, {
    method: 'POST',
    body: JSON.stringify(reason != null && reason.trim() ? { reason: reason.trim() } : {}),
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { reportId: string } }>
}

/** POST /api/agora/users/:id/report - Report a user. Auth required. */
export async function reportAgoraUser(
  token: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean; message?: string; data?: { reportId: string } }> {
  return agoraFetch(`/api/agora/users/${userId}/report`, {
    method: 'POST',
    body: JSON.stringify(reason != null && reason.trim() ? { reason: reason.trim() } : {}),
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { reportId: string } }>
}

/** GET /api/agora/admin/reports - List reports (admin). Paginated, optional status filter. */
export type AgoraAdminReportEntry = {
  id: string
  reporter: { _id: string; username?: string; email?: string }
  referenceType: 'Post' | 'User'
  referenceId: string
  reference: {
    content?: string
    user?: { _id: string; username?: string; email?: string; profilePicture?: string }
    username?: string
    email?: string
    referralCode?: string
    createdAt?: string
    hidden?: boolean
  } | null
  reason?: string
  status: 'pending' | 'reviewed' | 'dismissed'
  createdAt: string
}

export async function getAgoraAdminReports(
  token: string,
  params?: { page?: number; limit?: number; status?: string }
): Promise<{
  success: boolean
  message?: string
  data?: {
    reports: AgoraAdminReportEntry[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.status != null && params.status) qs.set('status', params.status)
  const path = `/api/agora/admin/reports${qs.toString() ? `?${qs}` : ''}`
  return agoraFetch(path, { token }) as Promise<{
    success: boolean
    message?: string
    data?: {
      reports: AgoraAdminReportEntry[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
  }>
}

/** PATCH /api/agora/admin/reports/:id - Update report status (admin). status: 'reviewed' | 'dismissed'. */
export async function updateAgoraReportStatus(
  token: string,
  reportId: string,
  status: 'reviewed' | 'dismissed'
): Promise<{ success: boolean; message?: string; data?: { report: { id: string; status: string } } }> {
  return agoraFetch(`/api/agora/admin/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { report: { id: string; status: string } } }>
}

/** PATCH /api/agora/admin/posts/:id/hide - Hide a post (admin). */
export async function hideAgoraPost(
  token: string,
  postId: string
): Promise<{ success: boolean; message?: string; data?: { post: { id: string; hidden: boolean } } }> {
  return agoraFetch(`/api/agora/admin/posts/${postId}/hide`, {
    method: 'PATCH',
    body: JSON.stringify({}),
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { post: { id: string; hidden: boolean } } }>
}

/** GET /api/agora/me/tips/sent - List tips sent by current user. Auth required. */
export type AgoraTipEntry = {
  id: string
  amount: number
  referenceType: 'Post' | 'User'
  postId?: string
  recipientId?: string
  recipient?: { _id: string; username?: string; email?: string; profilePicture?: string }
  fromUserId?: string
  fromUser?: { _id: string; username?: string; email?: string; profilePicture?: string }
  postPreview?: string
  createdAt: string
}

export async function getAgoraSentTips(
  token: string,
  params?: { page?: number; limit?: number }
): Promise<{
  success: boolean
  message?: string
  data?: { tips: AgoraTipEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/me/tips/sent${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** GET /api/agora/me/tips/received - List tips received by current user. Auth required. */
export async function getAgoraReceivedTips(
  token: string,
  params?: { page?: number; limit?: number }
): Promise<{
  success: boolean
  message?: string
  data?: { tips: AgoraTipEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/me/tips/received${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** GET /api/agora/me/bookmarks - List current user's bookmarked casts. Auth required. */
export async function getAgoraBookmarks(
  token: string,
  params?: { page?: number; limit?: number }
): Promise<{ success: boolean; message?: string; data?: AgoraFeedResponse }> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/me/bookmarks${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

// ——— Agora Messaging (Conversations & DMs) ———

export type AgoraConversation = {
  id: string
  participants: string[]
  otherUser?: { _id?: string; username?: string; email?: string; profilePicture?: string }
  lastMessage?: {
    id: string
    content: string
    sender?: { _id?: string; username?: string; email?: string }
    createdAt: string
  }
  updatedAt: string
  createdAt: string
}

export type AgoraMessage = {
  _id: string
  conversation: string
  sender: { _id: string; username?: string; email?: string }
  content: string
  editedAt?: string
  createdAt: string
}

/** GET /api/agora/conversations - List conversations. Auth required. */
export async function getAgoraConversations(
  token: string,
  params?: { page?: number; limit?: number }
): Promise<{
  success: boolean
  message?: string
  data?: {
    conversations: AgoraConversation[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/conversations${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** POST /api/agora/conversations - Get or create conversation with user. Auth required. */
export async function getOrCreateAgoraConversation(
  token: string,
  otherUserId: string
): Promise<{
  success: boolean
  message?: string
  data?: { conversation: AgoraConversation }
}> {
  return agoraFetch('/api/agora/conversations', {
    method: 'POST',
    body: JSON.stringify({ otherUserId }),
    token,
  }) as Promise<{
    success: boolean
    message?: string
    data?: { conversation: AgoraConversation }
  }>
}

/** GET /api/agora/conversations/:id/messages - Get messages. Auth required. */
export async function getAgoraMessages(
  token: string,
  conversationId: string,
  params?: { page?: number; limit?: number }
): Promise<{
  success: boolean
  message?: string
  data?: {
    messages: AgoraMessage[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/conversations/${conversationId}/messages${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** PATCH /api/agora/conversations/:convId/messages/:msgId - Edit message. Auth required. */
export async function updateAgoraMessage(
  token: string,
  conversationId: string,
  messageId: string,
  content: string
): Promise<{
  success: boolean
  message?: string
  data?: { message: AgoraMessage }
}> {
  return agoraFetch(`/api/agora/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
    token,
  }) as Promise<{
    success: boolean
    message?: string
    data?: { message: AgoraMessage }
  }>
}

/** DELETE /api/agora/conversations/:convId/messages/:msgId - Delete message. Auth required. */
export async function deleteAgoraMessage(
  token: string,
  conversationId: string,
  messageId: string
): Promise<{ success: boolean; message?: string }> {
  return agoraFetch(`/api/agora/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
    token,
  }) as Promise<{ success: boolean; message?: string }>
}

/** DELETE /api/agora/posts/:id - Delete cast (and its replies). */
export async function deleteAgoraCast(
  token: string,
  id: string
): Promise<{ success: boolean; message?: string }> {
  return agoraFetch(`/api/agora/posts/${id}`, { method: 'DELETE', token }) as Promise<{
    success: boolean
    message?: string
  }>
}

/** DELETE /api/agora/replies/:id - Delete a reply. */
export async function deleteAgoraReply(
  token: string,
  id: string
): Promise<{ success: boolean; message?: string }> {
  return agoraFetch(`/api/agora/replies/${id}`, { method: 'DELETE', token }) as Promise<{
    success: boolean
    message?: string
  }>
}

/** DELETE /api/agora/posts/:id/like - Unlike a cast. */
export async function unlikeAgoraCast(
  token: string,
  id: string
): Promise<{ success: boolean; message?: string; data?: { liked: boolean; likesCount: number } }> {
  return agoraFetch(`/api/agora/posts/${id}/like`, { method: 'DELETE', token }) as Promise<{
    success: boolean
    message?: string
    data?: { liked: boolean; likesCount: number }
  }>
}

/** GET /api/agora/users/:id - Get user public profile. */
export type AgoraUserProfile = {
  user: {
    id: string
    username?: string
    email?: string
    referralCode?: string
    createdAt?: string
    profilePicture?: string
    walletAddress?: string
  }
  profile: {
    followersCount: number
    followingCount: number
    postsCount: number
    isFollowingByCurrentUser: boolean
  }
}

export async function getAgoraUserProfile(
  userId: string,
  token?: string | null
): Promise<{ success: boolean; message?: string; data?: AgoraUserProfile }> {
  const url = apiUrl(`/api/agora/users/${userId}`)
  const headers: HeadersInit = {}
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** POST /api/agora/users/:id/follow - Follow a user. */
export async function followAgoraUser(
  token: string,
  userId: string
): Promise<{ success: boolean; message?: string; data?: { following: boolean; userId: string } }> {
  return agoraFetch(`/api/agora/users/${userId}/follow`, {
    method: 'POST',
    body: '{}',
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { following: boolean; userId: string } }>
}

/** DELETE /api/agora/users/:id/follow - Unfollow a user. */
export async function unfollowAgoraUser(
  token: string,
  userId: string
): Promise<{ success: boolean; message?: string; data?: { following: boolean; userId: string } }> {
  return agoraFetch(`/api/agora/users/${userId}/follow`, {
    method: 'DELETE',
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { following: boolean; userId: string } }>
}

export type AgoraFollowUser = {
  _id: string
  username?: string
  email?: string
  profilePicture?: string
  referralCode?: string
}

export type AgoraFollowEntry = {
  user: AgoraFollowUser
  followedAt: string
  isFollowingByCurrentUser?: boolean
}

/** GET /api/agora/users/:id/followers - List users who follow this user. Paginated. */
export async function getAgoraFollowers(
  userId: string,
  params?: { page?: number; limit?: number },
  token?: string | null
): Promise<{
  success: boolean
  message?: string
  data?: { followers: AgoraFollowEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/users/${userId}/followers${qs.toString() ? `?${qs}` : ''}`)
  const headers: HeadersInit = {}
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** GET /api/agora/users/:id/following - List users this user follows. Paginated. */
export async function getAgoraFollowing(
  userId: string,
  params?: { page?: number; limit?: number },
  token?: string | null
): Promise<{
  success: boolean
  message?: string
  data?: { following: AgoraFollowEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/users/${userId}/following${qs.toString() ? `?${qs}` : ''}`)
  const headers: HeadersInit = {}
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** GET /api/agora/users/:id/liked - List casts liked by this user (excluding their own). */
export async function getAgoraUserLikedPosts(
  userId: string,
  params?: { page?: number; limit?: number },
  token?: string | null
): Promise<{ success: boolean; message?: string; data?: AgoraFeedResponse }> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const url = apiUrl(`/api/agora/users/${userId}/liked${qs.toString() ? `?${qs}` : ''}`)
  const headers: HeadersInit = {}
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  const res = await apiFetch(url, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

// ——— Agora Notifications ———

export type AgoraNotificationType = 'reply' | 'follow' | 'tip' | 'like'

export type AgoraNotification = {
  id: string
  type: AgoraNotificationType
  fromUser?: { _id: string; username?: string; email?: string; profilePicture?: string }
  referenceType: 'Post' | 'User'
  referenceId?: string
  metadata?: { postId?: string; replyPostId?: string; amount?: number; preview?: string }
  read: boolean
  createdAt: string
}

/** GET /api/agora/notifications - List current user's notifications. Auth required. */
export async function getAgoraNotifications(
  token: string,
  params?: { page?: number; limit?: number; unread?: boolean }
): Promise<{
  success: boolean
  message?: string
  data?: {
    notifications: AgoraNotification[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
}> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.unread) qs.set('unread', 'true')
  const url = apiUrl(`/api/agora/notifications${qs.toString() ? `?${qs}` : ''}`)
  const res = await apiFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, message: (json as { message?: string }).message ?? 'Request failed' }
  return { ...json, success: json.success !== false }
}

/** PATCH /api/agora/notifications/:id/read - Mark one notification as read. Auth required. */
export async function markAgoraNotificationRead(
  token: string,
  id: string
): Promise<{ success: boolean; message?: string }> {
  return agoraFetch(`/api/agora/notifications/${id}/read`, {
    method: 'PATCH',
    body: '{}',
    token,
  }) as Promise<{ success: boolean; message?: string }>
}

/** POST /api/agora/notifications/read-all - Mark all notifications as read. Auth required. */
export async function markAllAgoraNotificationsRead(
  token: string
): Promise<{ success: boolean; message?: string; data?: { updatedCount: number } }> {
  return agoraFetch(`/api/agora/notifications/read-all`, {
    method: 'POST',
    body: '{}',
    token,
  }) as Promise<{ success: boolean; message?: string; data?: { updatedCount: number } }>
}

// ——— Landing (public: leaderboard, stats, feedback) ———

export type LeaderboardEntry = {
  rank: number
  username: string
  loyaltyPoints: number
  profilePicture: string | null
}

export async function getLeaderboard(): Promise<{
  success: boolean
  message?: string
  data?: { leaderboard: LeaderboardEntry[] }
}> {
  return fetchJson(apiUrl('/api/landing/leaderboard'))
}

export type LandingStats = {
  userCount: number
  campaignCount: number
  questCount: number
  completionCount: number
  totalPoints: number
}

export async function getLandingStats(): Promise<{
  success: boolean
  message?: string
  data?: LandingStats
}> {
  return fetchJson(apiUrl('/api/landing/stats'))
}

export async function submitFeedback(body: {
  message: string
  name?: string
  email?: string
}): Promise<{ success: boolean; message?: string; data?: { id: string } }> {
  return fetchJson(apiUrl('/api/landing/feedback'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
