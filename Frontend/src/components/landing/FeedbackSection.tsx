import { useState } from 'react'
import { motion } from 'framer-motion'
import { submitFeedback } from '../../lib/api'

export default function FeedbackSection() {
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setError(null)
    setLoading(true)
    const res = await submitFeedback({
      message: message.trim(),
      name: name.trim() || undefined,
      email: email.trim() || undefined,
    })
    setLoading(false)
    if (res.success) {
      setSent(true)
      setMessage('')
      setName('')
      setEmail('')
    } else {
      setError(res.message ?? 'Failed to send feedback')
    }
  }

  return (
    <section
      id="feedback"
      className="relative py-20 sm:py-24 px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #080810 0%, #0a0a12 50%, #050508 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(139, 92, 246, 0.12), transparent 60%)',
        }}
      />
      <div className="relative max-w-2xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center"
        >
          Send feedback
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-slate-400 text-center mb-10"
        >
          We’d love to hear from you. Your feedback is stored and helps us improve Pluto.
        </motion.p>

        {sent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center"
          >
            <p className="text-emerald-400 font-medium mb-1">Thank you for your feedback!</p>
            <p className="text-slate-400 text-sm">We’ve received your message.</p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Send another
            </button>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-6 space-y-4"
          >
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                {error}
              </p>
            )}
            <div>
              <label htmlFor="feedback-message" className="block text-sm font-medium text-white/80 mb-2">
                Message <span className="text-red-400">*</span>
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think..."
                rows={4}
                required
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 resize-none transition-colors"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="feedback-name" className="block text-sm font-medium text-white/80 mb-2">
                  Name (optional)
                </label>
                <input
                  id="feedback-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="feedback-email" className="block text-sm font-medium text-white/80 mb-2">
                  Email (optional)
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-colors"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </span>
              ) : (
                'Send feedback'
              )}
            </button>
          </motion.form>
        )}
      </div>
    </section>
  )
}
