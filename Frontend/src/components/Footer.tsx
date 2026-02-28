import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const links: { label: string; href?: string; to?: string }[] = [
  { label: 'Features', href: '#features' },
  { label: 'Leaderboard', href: '#leaderboard' },
  { label: 'Stats', href: '#stats' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Feedback', href: '#feedback' },
  { label: 'Docs', to: '/docs' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
]

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="relative border-t border-white/10 py-12 px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(5,5,8,0.8) 0%, rgba(10,10,18,0.95) 100%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(99, 102, 241, 0.1), transparent 60%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-white/10"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              boxShadow: '0 0 20px -5px rgba(99, 102, 241, 0.4)',
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden>
              <circle cx="12" cy="12" r="4" />
              <ellipse cx="12" cy="12" rx="8" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="12" cy="12" rx="4" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <span className="font-bold text-white">Pluto</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6">
          {links.map((link) =>
            link.to ? (
              <Link
                key={link.label}
                to={link.to}
                className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href ?? '#'}
                className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="text-sm text-slate-500">
          © {new Date().getFullYear()} Pluto. All rights reserved.
        </div>
      </div>
    </motion.footer>
  )
}
