import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ReticleTone = 'azure' | 'verified' | 'denied' | 'pending' | 'navy'

const TONE_BORDER: Record<ReticleTone, string> = {
  azure: 'border-azure-600',
  verified: 'border-verified-600',
  denied: 'border-denied-600',
  pending: 'border-pending-600',
  navy: 'border-navy-700',
}

const SIZE = {
  sm: { arm: 'h-3 w-3', weight: 'border-2', pad: 'p-1.5' },
  md: { arm: 'h-5 w-5', weight: 'border-2', pad: 'p-2.5' },
  lg: { arm: 'h-8 w-8', weight: 'border-[3px]', pad: 'p-4' },
} as const

type Props = {
  children?: ReactNode
  tone?: ReticleTone
  size?: keyof typeof SIZE
  /** Renders the diagonal hatch backdrop used on the live scanning surface. */
  hatched?: boolean
  /** Pulses the brackets to signal an active scan. */
  active?: boolean
  className?: string
}

/**
 * The corner-bracket "scan reticle" — the signature motif of the system.
 * Wraps anything that represents a code being read or presented: the student's
 * rotating QR, the camera viewport, the identity photo on a verification result.
 */
export function Reticle({
  children,
  tone = 'azure',
  size = 'md',
  hatched = false,
  active = false,
  className,
}: Props) {
  const { arm, weight, pad } = SIZE[size]
  const border = TONE_BORDER[tone]
  const corner = cn('pointer-events-none absolute', arm, weight, border, active && 'animate-pulse')

  return (
    <div className={cn('relative', pad, className)}>
      {hatched && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--color-azure-100) 0 1px, transparent 1px 9px)',
          }}
        />
      )}
      <span aria-hidden className={cn(corner, 'left-0 top-0 border-b-0 border-r-0')} />
      <span aria-hidden className={cn(corner, 'right-0 top-0 border-b-0 border-l-0')} />
      <span aria-hidden className={cn(corner, 'bottom-0 left-0 border-r-0 border-t-0')} />
      <span aria-hidden className={cn(corner, 'bottom-0 right-0 border-l-0 border-t-0')} />
      <div className="relative">{children}</div>
    </div>
  )
}
