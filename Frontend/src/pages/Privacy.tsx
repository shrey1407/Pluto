import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const sections = [
  {
    title: 'Information we collect',
    content: [
      'We collect information you provide when you sign up (e.g. email, username when using Google or other auth), when you complete your profile, and when you use features such as campaigns, quests, ChainLens, PulseBot, and Trendcraft.',
      'We may collect usage data (e.g. which features you use) to improve the product. If you connect a wallet or link Telegram, we store the identifiers necessary to provide those features.',
    ],
  },
  {
    title: 'How we use your information',
    content: [
      'We use your information to operate Pluto, to authenticate you, to process loyalty points and quest completions, and to provide support.',
      'We do not sell your personal data. We may use aggregated or anonymized data for analytics and product improvement.',
    ],
  },
  {
    title: 'Data retention and security',
    content: [
      'We retain your data for as long as your account is active or as needed to provide services and comply with legal obligations.',
      'We use reasonable technical and organizational measures to protect your data. Communication with our servers is over HTTPS.',
    ],
  },
  {
    title: 'Your rights',
    content: [
      'You may access, correct, or delete your account and associated data through your profile or by contacting us. You may withdraw consent where we rely on it.',
      'Depending on your location, you may have additional rights (e.g. GDPR, CCPA). Contact us to exercise them.',
    ],
  },
  {
    title: 'Cookies and similar technologies',
    content: [
      'We use cookies and similar technologies for session management, preferences, and security. You can control cookies through your browser settings.',
    ],
  },
  {
    title: 'Changes to this policy',
    content: [
      'We may update this Privacy Policy from time to time. We will post the updated version on this page and indicate the effective date. Continued use of Pluto after changes constitutes acceptance.',
    ],
  },
]

export default function Privacy() {
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
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
            <p className="text-slate-400 text-sm">Last updated: {new Date().toLocaleDateString('en-US')}</p>
          </motion.div>

          <div className="space-y-10">
            <p className="text-slate-300 leading-relaxed">
              Pluto (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This policy describes how we collect, use, and safeguard your information when you use our platform.
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
            If you have questions about this Privacy Policy, please contact us through the Feedback section on our website or at the contact details provided in our Terms of Service.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
