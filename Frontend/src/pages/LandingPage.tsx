import Navbar from '../components/Navbar'
import Hero3D from '../components/landing/Hero3D'
import HeroOverlay from '../components/landing/HeroOverlay'
import FeatureCards from '../components/landing/FeatureCards'
import SectionDivider from '../components/landing/SectionDivider'
import LeaderboardSection from '../components/landing/LeaderboardSection'
import StatsSection from '../components/landing/StatsSection'
import FAQSection from '../components/landing/FAQSection'
import FeedbackSection from '../components/landing/FeedbackSection'
import Footer from '../components/Footer'

export default function LandingPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          'linear-gradient(180deg, #050508 0%, #0a0a12 25%, #080810 75%, #050508 100%)',
      }}
    >
      {/* Ambient web3 glow */}
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

      {/* Hero: 3D canvas + overlay */}
      <div className="relative">
        <Hero3D />
        <HeroOverlay />
      </div>

      {/* Spacer: hero → features */}
      <div className="h-8 sm:h-12" aria-hidden />

      {/* Feature cards on scroll */}
      <FeatureCards />

      <SectionDivider />

      {/* Leaderboard: top users by loyalty points */}
      <LeaderboardSection />

      <SectionDivider />

      {/* Platform stats */}
      <StatsSection />

      <SectionDivider />

      {/* FAQ */}
      <FAQSection />

      <SectionDivider />

      {/* Feedback (stored in DB) */}
      <FeedbackSection />

      {/* Spacer before footer */}
      <div className="h-6 sm:h-8" aria-hidden />

      <Footer />
    </div>
  )
}
