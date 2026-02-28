import { useState, useEffect, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { usePointsDeduction, PointsDeductionBadge } from '../hooks/usePointsDeduction'
import {
  getWalletInsights,
  COST_CHAINLENS,
  type ChainLensData,
  type ChainLensTopHolding,
  type ChainLensTimelineItem,
  type ChainLensPortfolioAllocationItem,
  type ChainLensActivityByDay,
  type ChainLensNFT,
} from '../lib/api'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const CHAINS = [
  { value: 'eth', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'bsc', label: 'BSC' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'optimism', label: 'Optimism' },
  { value: 'base', label: 'Base' },
  { value: 'avalanche', label: 'Avalanche' },
] as const

const CHART_COLORS = [
  '#6366f1', // indigo-500
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
  '#3b82f6', // blue-500
  '#84cc16', // lime-500
]

/** Merge slices below threshold into "Other" so small percentages don't collapse in the pie. */
const PIE_MIN_PERCENT = 2
function buildPieAllocation(
  allocation: ChainLensPortfolioAllocationItem[]
): ChainLensPortfolioAllocationItem[] {
  const main: ChainLensPortfolioAllocationItem[] = []
  let otherValue = 0
  let otherPct = 0
  for (const item of allocation) {
    if (item.percentage >= PIE_MIN_PERCENT) {
      main.push(item)
    } else {
      otherValue += item.value
      otherPct += item.percentage
    }
  }
  if (otherPct > 0) {
    main.push({
      name: 'Other',
      symbol: 'Other',
      value: Math.round(otherValue * 100) / 100,
      percentage: Math.round(otherPct * 100) / 100,
    })
  }
  return main
}

const tooltipContentStyle: CSSProperties = {
  backgroundColor: 'rgba(15,15,28,0.98)',
  border: '1px solid rgba(99,102,241,0.35)',
  borderRadius: '12px',
  padding: '12px 16px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 500,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
  backdropFilter: 'blur(12px)',
}

function PortfolioTooltipContent({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: ChainLensPortfolioAllocationItem }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload as ChainLensPortfolioAllocationItem | undefined
  const pct = item?.percentage ?? payload[0].value ?? 0
  const value = item?.value ?? 0
  const name = item?.name ?? payload[0].name ?? ''
  return (
    <div style={tooltipContentStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{name}</div>
      <div style={{ color: '#e2e8f0' }}>
        {(Number(pct) || 0).toFixed(1)}% · {formatUSD(value)}
      </div>
    </div>
  )
}

function ActivityTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const count = payload[0].value ?? 0
  return (
    <div style={tooltipContentStyle}>
      {label != null && <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>}
      <div style={{ color: '#e2e8f0' }}>{count} txs</div>
    </div>
  )
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function txExplorerUrl(chain: string, txHash: string): string {
  const base: Record<string, string> = {
    eth: 'https://etherscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    bsc: 'https://bscscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
    optimism: 'https://optimistic.etherscan.io/tx/',
    base: 'https://basescan.org/tx/',
    avalanche: 'https://snowtrace.io/tx/',
  }
  return (base[chain] ?? base.eth) + txHash
}

function nftExplorerUrl(chain: string, tokenAddress: string, tokenId: string): string {
  const base: Record<string, string> = {
    eth: 'https://etherscan.io/nft/',
    polygon: 'https://polygonscan.com/nft/',
    bsc: 'https://bscscan.com/nft/',
    arbitrum: 'https://arbiscan.io/nft/',
    optimism: 'https://optimistic.etherscan.io/nft/',
    base: 'https://basescan.org/nft/',
    avalanche: 'https://snowtrace.io/nft/',
  }
  const root = base[chain] ?? base.eth
  return `${root}${tokenAddress}/${tokenId}`
}

function DegenBadge({ label }: { label: string }) {
  const style =
    label === 'DeFi Scientist'
      ? 'from-emerald-500/35 to-cyan-500/25 border-emerald-500/50 text-emerald-200 shadow-lg shadow-emerald-500/15'
      : label === 'Diamond Hands'
        ? 'from-amber-500/35 to-orange-500/25 border-amber-500/50 text-amber-200 shadow-lg shadow-amber-500/15'
        : 'from-slate-500/30 to-slate-600/25 border-slate-500/45 text-slate-200 shadow-lg shadow-slate-500/10'
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gradient-to-r border-2 px-4 py-1.5 text-sm font-bold ${style}`}
    >
      {label}
    </span>
  )
}

export default function ChainLens() {
  const { isLoggedIn, token } = useAuth()
  const [searchParams] = useSearchParams()
  const { address: walletAddress } = useAccount()
  const { displayedPoints, pointsDeduction, triggerDeduction } = usePointsDeduction()
  const [searchAddress, setSearchAddress] = useState('')
  const [chain, setChain] = useState<string>('eth')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ChainLensData | null>(null)

  const addressFromUrl = searchParams.get('address')?.trim()

  useEffect(() => {
    if (addressFromUrl && /^0x[a-fA-F0-9]{40}$/.test(addressFromUrl)) {
      setSearchAddress(addressFromUrl)
    } else if (walletAddress) {
      setSearchAddress(walletAddress)
    } else {
      setSearchAddress('')
    }
  }, [addressFromUrl, walletAddress])

  async function handleAnalyze() {
    const address = searchAddress.trim()
    if (!address) {
      setError('Enter a wallet address or connect your wallet.')
      return
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid wallet address.')
      return
    }
    if (!token) {
      setError('Please sign in to use ChainLens.')
      return
    }
    setError(null)
    setLoading(true)
    setData(null)
    const res = await getWalletInsights(token, { walletAddress: address, chain })
    setLoading(false)
    if (!res.success) {
      setError(res.message ?? 'Failed to load wallet insights.')
      return
    }
    if (res.data) {
      setData(res.data)
      triggerDeduction(res.data.yourNewBalance, res.data.loyaltyPointsSpent)
    }
  }

  const addressToUse = (searchAddress.trim() || walletAddress) ?? ''
  const canAnalyze = !!addressToUse && /^0x[a-fA-F0-9]{40}$/.test(addressToUse) && !!token

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden overflow-y-auto">
      {/* Web3 background: mesh gradient + subtle grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 140% 90% at 50% -20%, rgba(99, 102, 241, 0.28), transparent 55%),' +
            'radial-gradient(ellipse 90% 70% at 95% 40%, rgba(6, 182, 212, 0.15), transparent 50%),' +
            'radial-gradient(ellipse 70% 90% at 5% 70%, rgba(139, 92, 246, 0.12), transparent 50%),' +
            'linear-gradient(180deg, #050508 0%, #080810 35%, #0a0a14 70%, #050508 100%)',
        }}
      />
      <div
        className="fixed inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <Navbar />

      <div className="relative pt-24 pb-20 px-4 max-w-5xl mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500/15 to-cyan-500/15 border border-indigo-500/25 px-5 py-2.5 mb-6 shadow-lg shadow-indigo-500/10">
            <span className="text-2xl" aria-hidden>🔗</span>
            <span className="text-sm font-semibold text-indigo-200 uppercase tracking-widest">ChainLens</span>
            {isLoggedIn && (
              <span className="ml-1">
                <PointsDeductionBadge displayedPoints={displayedPoints} pointsDeduction={pointsDeduction} />
              </span>
            )}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-cyan-200 to-violet-200 mb-4 drop-shadow-[0_0_40px_rgba(99,102,241,0.3)]">
            On-chain visibility
          </h1>
          <p className="text-white/60 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
            Analyze any wallet: portfolio, activity, and degen score. One lookup costs <span className="text-indigo-300 font-semibold">{COST_CHAINLENS}</span> loyalty points.
          </p>
        </motion.header>

        {/* Auth gate */}
        {!isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl p-8 text-center max-w-md mx-auto shadow-2xl shadow-indigo-500/10 ring-1 ring-white/10 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-violet-500" style={{ boxShadow: '0 0 20px rgba(99,102,241,0.4)' }} />
            <p className="text-white/80 mb-6 text-base">Sign in to use ChainLens and spend loyalty points for wallet insights.</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all hover:border-white/30"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 ring-2 ring-indigo-400/20 hover:ring-indigo-400/40 transition-all"
              >
                Sign up
              </Link>
            </div>
          </motion.div>
        )}

        {/* Connect + Search + Analyze (when logged in) */}
        {isLoggedIn && (
          <motion.section
            variants={container}
            initial="hidden"
            animate="visible"
            className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/10 ring-1 ring-white/10 mb-10 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-violet-500 opacity-90" style={{ boxShadow: '0 0 24px rgba(99,102,241,0.35)' }} />
            <div className="flex flex-col gap-6 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Wallet</h2>
                <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <div>
                  <label htmlFor="chainlens-address" className="block text-xs text-white/50 uppercase tracking-wider mb-2 font-medium">
                    Wallet address
                  </label>
                  <input
                    id="chainlens-address"
                    type="text"
                    placeholder="0x..."
                    value={searchAddress}
                    onChange={(e) => setSearchAddress(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3.5 font-mono text-sm text-white placeholder-white/30 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/25 outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="chainlens-chain" className="block text-xs text-white/50 uppercase tracking-wider mb-2 font-medium">
                    Chain
                  </label>
                  <select
                    id="chainlens-chain"
                    value={chain}
                    onChange={(e) => setChain(e.target.value)}
                    className="rounded-xl bg-white/5 border border-white/15 px-4 py-3.5 text-sm text-white focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/25 outline-none transition-all min-w-[140px] [&>option]:bg-slate-900"
                  >
                    {CHAINS.map((c) => (
                      <option key={c.value} value={c.value} className="bg-slate-900 text-white">
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || loading}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all ring-2 ring-indigo-400/20 hover:ring-indigo-400/40 disabled:ring-0 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Analyze
                    </>
                  )}
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-300 rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 font-medium">
                  {error}
                </p>
              )}
            </div>
          </motion.section>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/10 to-transparent backdrop-blur-2xl p-16 text-center shadow-2xl shadow-indigo-500/10 ring-1 ring-white/10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-violet-500 opacity-80" />
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-400" />
              <p className="mt-5 text-white/70 font-medium">Fetching on-chain data…</p>
              <p className="mt-1 text-sm text-white/45">Portfolio, activity &amp; NFTs</p>
            </motion.div>
          )}

          {!loading && data && (
            <motion.div
              key="results"
              variants={container}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Summary row: Net worth + Degen score */}
              <div className="grid gap-4 sm:grid-cols-2">
                <motion.div
                  variants={item}
                  className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 shadow-xl shadow-indigo-500/5 ring-1 ring-white/10 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-90" style={{ boxShadow: '0 0 16px rgba(99,102,241,0.3)' }} />
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/50 uppercase tracking-wider mb-1 font-medium">Portfolio value</p>
                      <p className="text-3xl font-bold text-white tracking-tight">{formatUSD(data.portfolio.netWorthUSD)}</p>
                      <p className="text-sm text-white/50 mt-1">{data.portfolio.tokenCount} tokens</p>
                      {data.portfolio.nativeBalance != null && (
                        <p className="text-xs text-white/45 mt-2 font-mono px-2 py-1 rounded-lg bg-white/5 inline-block">
                          Native: {data.portfolio.nativeBalance} {data.chain === 'eth' ? 'ETH' : data.chain === 'polygon' ? 'MATIC' : data.chain === 'bsc' ? 'BNB' : data.chain.toUpperCase()}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
                <motion.div
                  variants={item}
                  className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 shadow-xl shadow-cyan-500/5 ring-1 ring-white/10 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-emerald-500 opacity-90" style={{ boxShadow: '0 0 16px rgba(6,182,212,0.3)' }} />
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-3 font-medium">Degen score</p>
                  <DegenBadge label={data.degenScore.label} />
                  <p className="text-sm text-white/60 mt-3 leading-relaxed">{data.degenScore.description}</p>
                  <p className="text-xs text-white/45 mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5">
                    <span>{data.degenScore.txCount} txs</span>
                    <span className="text-white/30">·</span>
                    <span>{data.degenScore.uniqueTokenCount} unique tokens</span>
                  </p>
                </motion.div>
              </div>

              {/* Charts row: Portfolio allocation + Activity by day */}
              {((data.portfolioAllocation?.length ?? 0) > 0 || (data.activityByDay?.length ?? 0) > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.portfolioAllocation && data.portfolioAllocation.length > 0 && (() => {
                    const pieData = buildPieAllocation(data.portfolioAllocation as ChainLensPortfolioAllocationItem[])
                    return (
                    <motion.section
                      variants={item}
                      className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 shadow-xl ring-1 ring-white/10 overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-pink-500 opacity-90" style={{ boxShadow: '0 0 16px rgba(139,92,246,0.25)' }} />
                      <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">Portfolio allocation</h3>
                      <div className="h-[280px] w-full rounded-xl bg-white/[0.03] border border-white/5 p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="percentage"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={2}
                              stroke="rgba(255,255,255,0.08)"
                              strokeWidth={1}
                              minAngle={3}
                              label={({ payload }: { payload?: ChainLensPortfolioAllocationItem }) =>
                                payload ? `${payload.name} ${payload.percentage.toFixed(0)}%` : ''}
                              labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}
                            >
                              {pieData.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<PortfolioTooltipContent />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.section>
                    )
                  })()}
                  {data.activityByDay && data.activityByDay.length > 0 && (
                    <motion.section
                      variants={item}
                      className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 shadow-xl ring-1 ring-white/10 overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-90" style={{ boxShadow: '0 0 16px rgba(6,182,212,0.25)' }} />
                      <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">Activity (txs per day)</h3>
                      <div className="h-[280px] w-full rounded-xl bg-white/[0.03] border border-white/5 p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[...(data.activityByDay as ChainLensActivityByDay[])].reverse()}
                            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                          >
                            <XAxis
                              dataKey="date"
                              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                              tickFormatter={(v) => v.slice(5)}
                            />
                            <YAxis
                              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                              allowDecimals={false}
                            />
                            <Tooltip content={<ActivityTooltipContent />} />
                            <Bar
                              dataKey="count"
                              fill="url(#activityBarGradient)"
                              radius={[4, 4, 0, 0]}
                            />
                            <defs>
                              <linearGradient id="activityBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#06b6d4" />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.section>
                  )}
                </div>
              )}

              {/* Top holdings */}
              {data.topHoldings.length > 0 && (
                <motion.section variants={item} className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 shadow-xl ring-1 ring-white/10 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-emerald-500 opacity-90" style={{ boxShadow: '0 0 16px rgba(245,158,11,0.2)' }} />
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">Top holdings</h3>
                  <ul className="space-y-4">
                    {data.topHoldings.map((h: ChainLensTopHolding, i: number) => (
                      <li key={`${h.symbol}-${i}`} className="flex items-center gap-4 rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3 hover:bg-white/[0.06] hover:border-white/10 transition-all">
                        {h.logo ? (
                          <img src={h.logo} alt="" className="w-10 h-10 rounded-xl bg-white/10 shrink-0 ring-1 ring-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                            {h.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between gap-2 items-baseline">
                            <span className="font-semibold text-white truncate">{h.symbol}</span>
                            <span className="text-indigo-200 font-medium shrink-0">{formatUSD(h.valueUSD)}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-500 shadow-sm"
                              style={{ width: `${Math.min(100, h.percentage)}%`, boxShadow: '0 0 12px rgba(99,102,241,0.4)' }}
                            />
                          </div>
                          <p className="text-xs text-white/45 mt-1">
                            {h.balance} · {h.percentage.toFixed(1)}%
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </motion.section>
              )}

              {/* NFTs */}
              {data.nfts && data.nfts.length > 0 && (
                <motion.section variants={item} className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 shadow-xl ring-1 ring-white/10 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-violet-500 opacity-90" style={{ boxShadow: '0 0 16px rgba(236,72,153,0.25)' }} />
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">
                    NFTs · {data.nfts.length} collected
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {data.nfts.map((nft: ChainLensNFT, i: number) => (
                      <a
                        key={`${nft.tokenAddress}-${nft.tokenId}-${i}`}
                        href={nftExplorerUrl(data.chain, nft.tokenAddress, nft.tokenId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden hover:border-violet-500/40 hover:bg-white/[0.08] hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300"
                      >
                        <div className="aspect-square bg-white/5 relative overflow-hidden">
                          {nft.image ? (
                            <img
                              src={nft.image}
                              alt={nft.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl text-white/20 bg-gradient-to-br from-white/5 to-transparent">
                              🖼
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <div className="p-3 border-t border-white/5">
                          <p className="text-sm font-semibold text-white truncate" title={nft.name}>
                            {nft.name}
                          </p>
                          <p className="text-xs text-white/50 truncate mt-0.5">{nft.collection}</p>
                          {nft.floorPriceUsd != null && (
                            <p className="text-xs text-violet-300 mt-1 font-medium">
                              {formatUSD(nft.floorPriceUsd)} floor
                            </p>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Transaction timeline */}
              {data.transactionTimeline.length > 0 && (
                <motion.section variants={item} className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 shadow-xl ring-1 ring-white/10 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-90" style={{ boxShadow: '0 0 16px rgba(16,185,129,0.25)' }} />
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">Recent activity</h3>
                  <ul className="space-y-3">
                    {data.transactionTimeline.map((tx: ChainLensTimelineItem, i: number) => (
                      <li key={tx.txHash + i} className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3 hover:bg-white/[0.06] hover:border-white/10 transition-all">
                        <span
                          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                            tx.type === 'Receive' || tx.type === 'Buy'
                              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/25 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {tx.type === 'Receive' || tx.type === 'Buy' ? '↓' : '↑'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white font-semibold">
                            {tx.type} {tx.token ?? ''}
                          </p>
                          <p className="text-xs text-white/50 truncate">{tx.amount ?? '—'}</p>
                        </div>
                        <span className="text-xs text-white/45 shrink-0 hidden sm:inline">{formatDate(tx.date)}</span>
                        <a
                          href={txExplorerUrl(data.chain, tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 text-xs font-medium shrink-0 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 transition-colors"
                        >
                          View
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.section>
              )}

              {/* Cost & balance */}
              <motion.div
                variants={item}
                className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 ring-1 ring-white/5"
              >
                <span className="text-sm text-white/70">
                  Cost: <span className="font-semibold text-indigo-200">{data.loyaltyPointsSpent}</span> loyalty points · New balance: <strong className="text-white">{data.yourNewBalance}</strong> pts
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoggedIn && !loading && !data && !error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-10 text-center max-w-md mx-auto"
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-white/60 font-medium mb-1">Ready to analyze</p>
            <p className="text-white/45 text-sm">Connect a wallet or enter an address, then click Analyze.</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
