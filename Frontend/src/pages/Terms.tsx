import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const sections = [
  {
    title: 'Acceptance of terms',
    content: [
      'By accessing or using Pluto (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform. We may update these terms from time to time; continued use after changes constitutes acceptance.',
    ],
  },
  {
    title: 'Description of service',
    content: [
      'Pluto provides a platform for campaigns, quests, loyalty points, and related features (e.g. ChainLens, Agora, PulseBot, Trendcraft). We reserve the right to modify, suspend, or discontinue any part of the service with reasonable notice where practicable.',
    ],
  },
  {
    title: 'Eligibility and account',
    content: [
      'You must be at least 13 years of age (or the minimum age in your jurisdiction) to use Pluto. You are responsible for maintaining the confidentiality of your account and for all activity under your account.',
      'You must provide accurate information and keep it up to date. We may suspend or terminate accounts that violate these terms or for other reasons we deem appropriate.',
    ],
  },
  {
    title: 'Loyalty points and conduct',
    content: [
      'Loyalty points on Pluto are in-app credits and have no cash value unless otherwise stated. They may be earned, spent, or lost according to our rules and feature logic. We do not guarantee availability or value of any reward.',
      'You agree not to abuse the Platform (e.g. fraud, manipulation, spam, or violation of third-party terms when completing quests). We may revoke points or ban accounts for such conduct.',
    ],
  },
  {
    title: 'Intellectual property and content',
    content: [
      'Pluto and its branding, design, and technology are owned by us or our licensors. You may not copy, modify, or reverse-engineer the Platform without permission.',
      'You retain rights to content you submit. By submitting content, you grant us a license to use, display, and process it as needed to operate the service.',
    ],
  },
  {
    title: 'Disclaimer of warranties',
    content: [
      'The Platform is provided &quot;as is&quot; and &quot;as available&quot;. We disclaim all warranties, express or implied, including merchantability and fitness for a particular purpose. We do not warrant that the service will be uninterrupted or error-free.',
    ],
  },
  {
    title: 'Limitation of liability',
    content: [
      'To the maximum extent permitted by law, we and our affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill, arising from your use of the Platform.',
    ],
  },
  {
    title: 'Governing law and contact',
    content: [
      'These terms are governed by the laws of the jurisdiction in which we operate, without regard to conflict of law principles. For questions or notices, please use the Feedback section on our website or the contact information we provide.',
    ],
  },
]

export default function Terms() {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: 'linear-gradient(180deg, #050508 0%, #0a0a12 25%, #080810 75%, #050508 100%)',
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 100% 60% at 50% -20%, rgba(99, 102, 241, 0.2), transparent 50%),' +
            'radial-gradient(ellipse 60% 80% at 90% 50%, rgba(6, 182, 212, 0.08), transparent 45%),' +
            'radial-gradient(ellipse 60% 80% at 10% 80%, rgba(139, 92, 246, 0.08), transparent 45%)',
        }}
      />
      <Navbar />

      <main className="relative pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors mb-6"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Terms of Service</h1>
            <p className="text-slate-400 text-sm">Last updated: {new Date().toLocaleDateString('en-US')}</p>
          </motion.div>

          <div className="space-y-10">
            <p className="text-slate-300 leading-relaxed">
              Please read these Terms of Service carefully before using Pluto. By using the Platform, you agree to these terms.
            </p>

            {sections.map((section, i) => (
              <motion.section
                key={section.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <h2 className="text-xl font-semibold text-white mb-3">{section.title}</h2>
                <div className="space-y-3">
                  {section.content.map((para, j) => (
                    <p key={j} className="text-slate-300 text-sm sm:text-base leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              </motion.section>
            ))}
          </div>

          <p className="mt-12 text-slate-500 text-sm">
            If you have questions about these Terms of Service, please contact us through the Feedback section on our website.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
