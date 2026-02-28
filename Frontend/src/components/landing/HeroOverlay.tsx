import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.4 },
  },
}

const item = {
  hidden: { y: 24, opacity: 0 },
  visible: { y: 0, opacity: 1 },
}

export default function HeroOverlay() {
  const { isLoggedIn } = useAuth()

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pointer-events-none">
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="text-center max-w-2xl"
      >
        <motion.p
          variants={item}
          className="text-cyan-400/90 text-sm font-semibold tracking-widest uppercase mb-3"
        >
          Welcome to the journey
        </motion.p>
        <motion.h1
          variants={item}
          className="text-5xl sm:text-6xl md:text-7xl font-bold text-white mb-4 tracking-tight drop-shadow-lg"
        >
          Explore{' '}
          <span
            className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400"
            style={{ textShadow: '0 0 60px rgba(99, 102, 241, 0.4)' }}
          >
            Pluto
          </span>
        </motion.h1>
        <motion.p
          variants={item}
          className="text-slate-400 text-lg sm:text-xl mb-8"
        >
          Gamified rewards, quests, and community. Level up your experience.
        </motion.p>
        <motion.div variants={item} className="flex gap-4 justify-center pointer-events-auto">
          <Link
            to={isLoggedIn ? '/profile' : '/signup'}
            className="group relative px-6 py-3 rounded-xl font-semibold text-white overflow-hidden transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              boxShadow: '0 0 30px -5px rgba(99, 102, 241, 0.5), 0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            <span className="relative z-10">{isLoggedIn ? 'Go to profile' : 'Get started'}</span>
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)',
              }}
            />
          </Link>
          <Link
            to="/agora"
            className="px-6 py-3 rounded-xl font-semibold border border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30 transition-all backdrop-blur-sm"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            Try Agora
          </Link>
          <a
            href="#features"
            className="px-6 py-3 rounded-xl font-semibold border border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30 transition-all backdrop-blur-sm"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            See features
          </a>
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto"
      >
        <a
          href="#features"
          className="flex flex-col items-center gap-1 text-cyan-400/80 hover:text-cyan-300 transition-colors"
          aria-label="Scroll to features"
        >
          <span className="text-xs font-medium">Scroll</span>
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
            className="block w-6 h-10 rounded-full border-2 border-current"
          />
        </a>
      </motion.div>
    </div>
  )
}
