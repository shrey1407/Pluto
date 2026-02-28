import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

export type PointsDeductionState = { from: number; to: number; amount: number } | null

export function usePointsDeduction() {
  const { user, refreshUser } = useAuth()
  const [displayedPoints, setDisplayedPoints] = useState<number>(0)
  const [pointsDeduction, setPointsDeduction] = useState<PointsDeductionState>(null)

  const currentPoints = user?.loyaltyPoints ?? 0

  useEffect(() => {
    if (pointsDeduction == null) setDisplayedPoints(currentPoints)
  }, [currentPoints, pointsDeduction])

  useEffect(() => {
    if (pointsDeduction == null) return
    const { from, to } = pointsDeduction
    setDisplayedPoints(from)
    const step = from > to ? -1 : 1
    const totalDuration = 3500
    const steps = Math.abs(from - to)
    if (steps === 0) {
      setDisplayedPoints(to)
      setPointsDeduction(null)
      refreshUser()
      return
    }
    const interval = totalDuration / steps
    let value = from
    const t = setInterval(() => {
      value += step
      if ((step > 0 && value >= to) || (step < 0 && value <= to)) {
        setDisplayedPoints(to)
        setPointsDeduction(null)
        refreshUser()
        clearInterval(t)
      } else {
        setDisplayedPoints(value)
      }
    }, interval)
    return () => clearInterval(t)
  }, [pointsDeduction, refreshUser])

  const triggerDeduction = useCallback((newBalance: number, amount: number) => {
    setPointsDeduction({ from: newBalance + amount, to: newBalance, amount })
  }, [])

  return { displayedPoints, pointsDeduction, triggerDeduction }
}

type PointsDeductionBadgeProps = {
  displayedPoints: number
  pointsDeduction: PointsDeductionState
  className?: string
}

export function PointsDeductionBadge({
  displayedPoints,
  pointsDeduction,
  className = '',
}: PointsDeductionBadgeProps) {
  const amount = pointsDeduction?.amount ?? 0
  return (
    <motion.span
      key={pointsDeduction ? 'deduct' : displayedPoints}
      initial={pointsDeduction ? { scale: 1.2, boxShadow: '0 0 24px rgba(16, 185, 129, 0.6)' } : false}
      animate={{ scale: 1, boxShadow: '0 0 0 transparent' }}
      transition={{ duration: 1.2 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-semibold ${className}`}
    >
      <span>{displayedPoints}</span>
      <span className="text-white/60 text-xs font-normal">pts</span>
      {pointsDeduction && amount > 0 && (
        <motion.span
          initial={{ opacity: 1, x: 0 }}
          animate={{ opacity: 0, x: -8 }}
          transition={{ delay: 1, duration: 0.4 }}
          className="text-red-400 text-xs font-medium"
        >
          -{amount}
        </motion.span>
      )}
    </motion.span>
  )
}
