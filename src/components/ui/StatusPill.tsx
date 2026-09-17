import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type PillTone = 'verified' | 'denied' | 'pending' | 'azure' | 'neutral'

const TONE: Record<PillTone, string> = {
  verified: 'bg-verified-100 text-verified-700',
  denied: 'bg-denied-100 text-denied-700',
  pending: 'bg-pending-100 text-pending-700',
  azure: 'bg-azure-100 text-azure-700',
  neutral: 'bg-canvas text-ink-muted',
}

const DOT: Record<PillTone, string> = {
  verified: 'bg-verified-600',
  denied: 'bg-denied-600',
  pending: 'bg-pending-600',
  azure: 'bg-azure-600',
  neutral: 'bg-ink-faint',
}

type Props = {
  tone?: PillTone
  children: ReactNode
  /** Leading status dot — used on PRESENT / GRANTED / SCANNING ACTIVE style pills. */
  dot?: boolean
  /** Pulses the dot — reserve for a genuinely ongoing state (an open scanning
   * session, a live feed), not every dot pill, or the "this is happening
   * right now" signal loses meaning. */
  pulse?: boolean
  className?: string
}

/** The tracked, uppercase mono status chip used across every table and result card. */
export function StatusPill({ tone = 'neutral', children, dot = false, pulse = false, className }: Props) {
  return (
    <span
      className={cn(
        'eyebrow inline-flex items-center gap-1.5 rounded px-2 py-1',
        TONE[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', DOT[tone], pulse && 'animate-live-pulse')}
        />
      )}
      {children}
    </span>
  )
}
