import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type CardProps = {
  children: ReactNode
  className?: string
  /** Removes internal padding so the card can hold a flush table. */
  flush?: boolean
}

export function Card({ children, className, flush = false }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-line bg-surface shadow-card',
        !flush && 'p-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4',
        className,
      )}
    >
      <h2 className="min-w-0 flex-1 truncate font-display text-base font-bold text-navy-900">{title}</h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** The four-across KPI tile from the Administrator Dashboard (Figure 4.5). */
export function StatTile({
  label,
  value,
  caption,
  tone = 'azure',
}: {
  label: string
  value: ReactNode
  caption?: ReactNode
  tone?: 'azure' | 'verified' | 'pending' | 'denied' | 'navy'
}) {
  const valueTone = {
    azure: 'text-azure-600',
    verified: 'text-verified-600',
    pending: 'text-pending-600',
    denied: 'text-denied-600',
    navy: 'text-navy-900',
  }[tone]

  return (
    <Card>
      <p className="eyebrow text-ink-muted">{label}</p>
      <p className={cn('mt-2 font-display text-4xl font-bold tabular-nums', valueTone)}>{value}</p>
      {caption && <p className="data mt-2 text-xs text-ink-muted">{caption}</p>}
    </Card>
  )
}

/** Empty-state block for lists and tables with no rows yet. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-display text-sm font-semibold text-navy-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
