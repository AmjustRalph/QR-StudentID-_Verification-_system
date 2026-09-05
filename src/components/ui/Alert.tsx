import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'denied' | 'pending' | 'verified' | 'azure'

const TONE: Record<Tone, string> = {
  denied: 'border-denied-100 bg-denied-50 text-denied-700',
  pending: 'border-pending-100 bg-pending-50 text-pending-700',
  verified: 'border-verified-100 bg-verified-50 text-verified-700',
  azure: 'border-azure-100 bg-azure-50 text-azure-700',
}

export function Alert({
  tone = 'denied',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'denied' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3',
        TONE[tone],
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {children && <div className="data mt-0.5 text-xs opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
