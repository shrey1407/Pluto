import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { usePointsDeduction, PointsDeductionBadge } from '../hooks/usePointsDeduction'
import {
  getTrendcraftFeed,
  generateTrendcraftContent,
  getTrendcraftContentSuggestions,
  COST_TRENDCRAFT_GEMINI,
  type TrendcraftItem,
  type TrendcraftSource,
} from '../lib/api'

const SOURCES: { id: TrendcraftSource; label: string }[] = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'hackernews', label: 'Hacker News' },
  { id: 'news', label: 'News' },
]

const STEPS = [
  { id: 'feed' as const, number: 1, label: 'Discover', short: 'Feed' },
  { id: 'suggestions' as const, number: 2, label: 'Get ideas', short: 'Suggestions' },
  { id: 'generate' as const, number: 3, label: 'Create', short: 'Generate' },
]

type Tab = 'feed' | 'generate' | 'suggestions'

function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function sourceBadgeClass(source: TrendcraftSource): string {
  switch (source) {
    case 'youtube':
      return 'bg-red-500/20 text-red-300 border-red-500/30'
    case 'reddit':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    case 'hackernews':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    case 'news':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    default:
      return 'bg-white/10 text-white/70 border-white/20'
  }
}

function SourceIcon({ source, className = 'w-4 h-4' }: { source: TrendcraftSource; className?: string }) {
  switch (source) {
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.536z" />
        </svg>
      )
    case 'reddit':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056 1.25 1.25 0 0 1 1.248-1.305zm5.316 0c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056 1.25 1.25 0 0 1 1.248-1.305zm-5.316 1.605a.781.781 0 0 0-.781.781v3.281c0 .431.35.781.781.781h3.139c.431 0 .781-.35.781-.781V7.13a.781.781 0 0 0-.781-.781h-3.139zm-4.5 1.605a1.266 1.266 0 0 0-1.265 1.266v1.266a1.266 1.266 0 1 0 2.531 0V7.616A1.266 1.266 0 0 0 8.5 6.35zm9.5 0a1.266 1.266 0 0 0-1.265 1.266v1.266a1.266 1.266 0 1 0 2.531 0V7.616A1.266 1.266 0 0 0 18 6.35z" />
        </svg>
      )
    case 'hackernews':
      return (
        <span className={`${className} font-bold text-[0.65em] leading-none flex items-center justify-center`} style={{ fontFamily: 'ui-monospace, monospace' }}>
          Y
        </span>
      )
    case 'news':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    default:
      return null
  }
}

export default function Trendcraft() {
  const { isLoggedIn, token } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('feed')
  const [sources, setSources] = useState<string>('youtube,reddit,hackernews,news')
  const [limit, setLimit] = useState(12)
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [feedItems, setFeedItems] = useState<TrendcraftItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [contentIdea, setContentIdea] = useState('')
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
  const [newBalanceAfterGenerate, setNewBalanceAfterGenerate] = useState<number | null>(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Array<{ index: number; text: string }>>([])
  const [newBalanceAfterSuggestions, setNewBalanceAfterSuggestions] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const { displayedPoints, pointsDeduction, triggerDeduction } = usePointsDeduction()

  const triggerPointsDeduction = (newBalance: number) => triggerDeduction(newBalance, COST_TRENDCRAFT_GEMINI)

  async function loadFeed() {
    if (!token) {
      setFeedError('Sign in to load feed.')
      return
    }
    setFeedError(null)
    setFeedLoading(true)
    setFeedItems([])
    const res = await getTrendcraftFeed({ sources, limit }, token)
    setFeedLoading(false)
    if (!res.success) {
      setFeedError(res.message ?? 'Failed to load feed')
      return
    }
    if (res.data?.items) setFeedItems(res.data.items)
    if (res.data?.newBalance != null) triggerPointsDeduction(res.data.newBalance)
  }

  async function handleGenerate() {
    const input = keyword.trim() || contentIdea.trim()
    if (!input || !token) {
      setGenerateError(!token ? 'Sign in to generate content.' : 'Enter a keyword or content idea.')
      return
    }
    setGenerateError(null)
    setGeneratedContent(null)
    setNewBalanceAfterGenerate(null)
    setGenerateLoading(true)
    const res = await generateTrendcraftContent(token, {
      keyword: keyword.trim() || undefined,
      contentIdea: contentIdea.trim() || undefined,
    })
    setGenerateLoading(false)
    if (!res.success) {
      setGenerateError(res.message ?? 'Failed to generate')
      return
    }
    if (res.data) {
      setGeneratedContent(res.data.content)
      setNewBalanceAfterGenerate(res.data.newBalance)
      if (res.data.newBalance != null) triggerPointsDeduction(res.data.newBalance)
    }
  }

  async function handleSuggestions() {
    if (!token) {
      setSuggestionsError('Sign in to get suggestions.')
      return
    }
    setSuggestionsError(null)
    setSuggestions([])
    setNewBalanceAfterSuggestions(null)
    setSuggestionsLoading(true)
    const res = await getTrendcraftContentSuggestions(token)
    setSuggestionsLoading(false)
    if (!res.success) {
      setSuggestionsError(res.message ?? 'Failed to get suggestions')
      return
    }
    if (res.data) {
      setSuggestions(res.data.suggestions)
      setNewBalanceAfterSuggestions(res.data.newBalance)
      if (res.data.newBalance != null) triggerPointsDeduction(res.data.newBalance)
    }
  }

  async function handleUseIdea(idea: string) {
    if (!token || !idea.trim()) return
    setTab('generate')
    setContentIdea(idea.trim())
    setKeyword('')
    setGenerateError(null)
    setGeneratedContent(null)
    setNewBalanceAfterGenerate(null)
    setGenerateLoading(true)
    const res = await generateTrendcraftContent(token, { contentIdea: idea.trim() })
    setGenerateLoading(false)
    if (!res.success) {
      setGenerateError(res.message ?? 'Failed to generate')
      return
    }
    if (res.data) {
      setGeneratedContent(res.data.content)
      setNewBalanceAfterGenerate(res.data.newBalance)
      if (res.data.newBalance != null) triggerPointsDeduction(res.data.newBalance)
    }
  }

  function toggleSource(id: TrendcraftSource) {
    const list = sources.split(',').map((s) => s.trim()).filter(Boolean)
    const has = list.includes(id)
    if (has) setSources(list.filter((s) => s !== id).join(','))
    else setSources([...list, id].join(','))
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden overflow-y-auto">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% -30%, rgba(16, 185, 129, 0.2), transparent 50%),' +
            'radial-gradient(ellipse 80% 60% at 90% 50%, rgba(6, 182, 212, 0.1), transparent 45%),' +
            'linear-gradient(180deg, #050508 0%, #0a0a12 50%, #050508 100%)',
        }}
      />
      <Navbar />

      <div className="relative pt-24 pb-20 px-4 max-w-4xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-2 mb-4">
            <span className="text-2xl" aria-hidden>📈</span>
            <span className="text-sm font-medium text-white/70 uppercase tracking-widest">Trendcraft</span>
            {isLoggedIn && (
              <span className="ml-2">
                <PointsDeductionBadge displayedPoints={displayedPoints} pointsDeduction={pointsDeduction} />
              </span>
            )}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-300 mb-2">
            Creator flow
          </h1>
          <p className="text-white/60 text-lg mb-6">
            Discover trends → Get ideas → Create content. One flow.
          </p>

          {/* Step flow */}
          <nav className="flex flex-wrap gap-2 justify-center mb-8" aria-label="Creator steps">
            {STEPS.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setTab(step.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  tab === step.id
                    ? 'bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 shadow-lg shadow-emerald-500/20'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                    tab === step.id ? 'bg-emerald-500/50 text-white' : 'bg-white/10 text-white/60'
                  }`}
                >
                  {step.number}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.short}</span>
              </button>
            ))}
          </nav>
        </motion.header>

        <AnimatePresence mode="wait">
          {tab === 'feed' && (
            <motion.section
              key="feed"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl p-6 shadow-xl"
            >
              <p className="text-sm text-white/60 mb-4">
                Load feed costs {COST_TRENDCRAFT_GEMINI} loyalty points. Sign in to load.
              </p>
              <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Sources</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSource(s.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      sources.includes(s.id)
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-white/50'
                    }`}
                  >
                    <SourceIcon source={s.id} className="w-4 h-4" />
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 items-center mb-6">
                <label className="text-sm text-white/60">Limit</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 12)}
                  className="w-20 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={loadFeed}
                  disabled={feedLoading || !token}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                >
                  {feedLoading ? 'Loading…' : token ? 'Load feed' : 'Sign in to load feed'}
                </button>
              </div>
              {feedError && (
                <p className="text-sm text-red-400/90 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2">
                  {feedError}
                </p>
              )}
              {feedItems.length > 0 && (
                <ul className="space-y-4">
                  {feedItems.map((item) => (
                    <li
                      key={`${item.source}-${item.id}`}
                      className="group rounded-xl bg-white/[0.06] border border-white/10 p-5 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${sourceBadgeClass(item.source)}`}
                        >
                          <SourceIcon source={item.source} className="w-3.5 h-3.5" />
                          <span className="capitalize">{item.source === 'hackernews' ? 'HN' : item.source}</span>
                        </span>
                      </div>
                      <h3 className="font-bold text-white mb-2 line-clamp-2 text-base leading-snug">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-white/50 line-clamp-2 mb-3 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {item.publishedAt && (
                          <span className="text-xs text-white/45">{formatDate(item.publishedAt)}</span>
                        )}
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          Open link
                          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!feedLoading && feedItems.length === 0 && !feedError && (
                <p className="text-white/40 text-sm text-center py-8">
                  {token ? 'Select sources and click Load feed.' : 'Sign in to load feed.'}
                </p>
              )}
            </motion.section>
          )}

          {tab === 'generate' && (
            <motion.section
              key="generate"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl p-6 shadow-xl"
            >
              <p className="text-sm text-white/60 mb-4">
                Generate a short piece of content (under 500 chars) using current trends. Share it on Agora. Costs {COST_TRENDCRAFT_GEMINI} loyalty points.
              </p>
              {!isLoggedIn ? (
                <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center">
                  <p className="text-white/70 mb-4">Sign in to generate content.</p>
                  <Link
                    to="/login"
                    className="inline-block rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2 font-medium hover:bg-emerald-500/30"
                  >
                    Log in
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Keyword (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. AI"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:border-emerald-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Content idea (optional)</label>
                      <textarea
                        placeholder="e.g. A short take on recent AI news"
                        value={contentIdea}
                        onChange={(e) => setContentIdea(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:border-emerald-500/50 outline-none resize-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generateLoading || (!keyword.trim() && !contentIdea.trim())}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                  >
                    {generateLoading ? 'Generating…' : 'Generate'}
                  </button>
                  {generateError && (
                    <p className="mt-4 text-sm text-red-400/90 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2">
                      {generateError}
                    </p>
                  )}
                  {generatedContent && (
                    <div className="mt-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="text-xs text-white/50 uppercase tracking-wider">Generated content</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const text = (editingContent ?? generatedContent ?? '').trim()
                              if (!text) return
                              navigate('/agora', { state: { castContent: text } })
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-medium hover:bg-indigo-500/30 hover:border-indigo-500/50 transition-colors"
                          >
                            Cast to Agora
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const text = editingContent ?? generatedContent
                              void navigator.clipboard.writeText(text ?? '').then(() => {
                                setCopyFeedback(true)
                                setTimeout(() => setCopyFeedback(false), 1000)
                              })
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs font-medium text-white/80 hover:bg-white/20 hover:border-white/30 transition-colors min-w-[4rem]"
                          >
                            {copyFeedback ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContent(null)
                              void handleGenerate()
                            }}
                            disabled={generateLoading}
                            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs font-medium text-white/80 hover:bg-white/20 disabled:opacity-50 transition-colors"
                          >
                            Regenerate
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingContent !== null) {
                                setGeneratedContent(editingContent)
                                setEditingContent(null)
                              } else {
                                setEditingContent(generatedContent)
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs font-medium text-white/80 hover:bg-white/20 transition-colors"
                          >
                            {editingContent !== null ? 'Done' : 'Edit'}
                          </button>
                        </div>
                      </div>
                      {editingContent !== null ? (
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white text-sm placeholder-white/30 focus:border-emerald-500/50 outline-none resize-none min-h-[120px]"
                          rows={4}
                        />
                      ) : (
                        <p className="text-white whitespace-pre-wrap">{generatedContent}</p>
                      )}
                      {newBalanceAfterGenerate != null && (
                        <p className="text-xs text-white/50 mt-3">New balance: {newBalanceAfterGenerate} pts</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.section>
          )}

          {tab === 'suggestions' && (
            <motion.section
              key="suggestions"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl p-6 shadow-xl"
            >
              <p className="text-sm text-white/60 mb-4">
                Get 5 content ideas based on current trends. Costs {COST_TRENDCRAFT_GEMINI} loyalty points. Use an idea to jump to Create and generate content to cast on Agora.
              </p>
              {!isLoggedIn ? (
                <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center">
                  <p className="text-white/70 mb-4">Sign in to get suggestions.</p>
                  <Link
                    to="/login"
                    className="inline-block rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2 font-medium hover:bg-emerald-500/30"
                  >
                    Log in
                  </Link>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSuggestions}
                    disabled={suggestionsLoading}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                  >
                    {suggestionsLoading ? 'Loading…' : 'Get 5 ideas'}
                  </button>
                  {suggestionsError && (
                    <p className="mt-4 text-sm text-red-400/90 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2">
                      {suggestionsError}
                    </p>
                  )}
                  {suggestions.length > 0 && (
                    <ol className="mt-6 space-y-3">
                      {suggestions.map((s) => (
                        <li
                          key={s.index}
                          className="rounded-xl bg-white/[0.06] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5"
                        >
                          <div className="flex gap-3 flex-1 min-w-0">
                            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-sm">
                              {s.index}
                            </span>
                            <p className={`text-sm flex-1 min-w-0 ${s.text ? 'text-white/90' : 'text-white/40 italic'}`}>
                              {s.text || 'No suggestion'}
                            </p>
                          </div>
                          {s.text && (
                            <button
                              type="button"
                              onClick={() => handleUseIdea(s.text)}
                              disabled={generateLoading}
                              className="flex-shrink-0 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 hover:border-emerald-500/50 disabled:opacity-50 transition-colors"
                            >
                              Use This Idea
                            </button>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  {newBalanceAfterSuggestions != null && suggestions.length > 0 && (
                    <p className="text-xs text-white/50 mt-4">New balance: {newBalanceAfterSuggestions} pts</p>
                  )}
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
