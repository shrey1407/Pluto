import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const faqs: { question: string; answer: string }[] = [
  {
    question: 'What are loyalty points?',
    answer:
      'Loyalty points are the in-app currency on Pluto. You earn them by completing quests, claiming daily rewards, and participating in campaigns. You can spend them to create campaigns, add quests, use ChainLens, PulseBot, Trendcraft, and more.',
  },
  {
    question: 'How do I earn loyalty points?',
    answer:
      'Complete quests in active campaigns, claim your daily bonus (with streaks for more points), get referred by another user, or buy points via the wallet. Each quest completion awards points once you verify the required action (e.g. follow, tweet).',
  },
  {
    question: 'What is Campquest?',
    answer:
      'Campquest lets you create or join campaigns with quests. Campaign creators add quests (e.g. "Follow us on X", "Share a tweet"); participants complete them and verify to earn loyalty points. You can run limited-time campaigns and see leaderboards.',
  },
  {
    question: 'Is my wallet or data safe?',
    answer:
      'Pluto uses standard auth (e.g. Google) and optional wallet connect. We do not store passwords when using OAuth. Wallet connections are handled by your wallet provider. Loyalty points are stored in our database and are not on-chain currency unless you use the buy feature.',
  },
  {
    question: 'What is PulseBot?',
    answer:
      'PulseBot is an AI companion that works with your linked Telegram. You can get summaries of recent group chats, ask questions about them, and view activity stats. Link once via the app, then use the bot in Telegram.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section
      id="faq"
      className="relative py-20 sm:py-24 px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #050508 0%, #0a0a12 40%, #080810 80%, #050508 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 80%, rgba(6, 182, 212, 0.1), transparent 50%)',
        }}
      />
      <div className="relative max-w-3xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center"
        >
          Frequently asked questions
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-slate-400 text-center mb-12"
        >
          Quick answers to common questions
        </motion.p>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/5 transition-colors"
              >
                <span className="font-medium text-white">{faq.question}</span>
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-cyan-400 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/10"
                  >
                    <p className="px-5 py-4 text-slate-300 text-sm leading-relaxed">{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
