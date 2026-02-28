export default function SectionDivider() {
  return (
    <div className="relative w-full flex justify-center py-4 sm:py-6" aria-hidden>
      <div
        className="h-px w-full max-w-2xl mx-auto opacity-60"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.08) 80%, transparent 100%)',
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-500/40"
        style={{ boxShadow: '0 0 12px rgba(6, 182, 212, 0.3)' }}
      />
    </div>
  )
}
