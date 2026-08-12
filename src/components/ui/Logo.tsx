import { cn } from '@/lib/cn'

type Props = {
  /** `onDark` is the navy rail / hero treatment; `onLight` is for light surfaces. */
  variant?: 'onDark' | 'onLight'
  withWordmark?: boolean
  className?: string
}

/**
 * Placeholder GCTU/QR-SIDVS mark: the letters "QR" inside a bracketed square,
 * echoing the reticle motif. Swap for the official GCTU asset when supplied
 * (see spec §7 / §8).
 */
export function Logo({ variant = 'onDark', withWordmark = false, className }: Props) {
  const onDark = variant === 'onDark'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-md border-2',
          onDark ? 'border-azure-500 text-white' : 'border-azure-600 text-navy-900',
        )}
      >
        <span className="font-display text-sm font-bold tracking-tight">QR</span>
      </div>
      {withWordmark && (
        <div className="leading-tight">
          <div
            className={cn(
              'font-display text-sm font-bold',
              onDark ? 'text-white' : 'text-navy-900',
            )}
          >
            QR-SIDVS
          </div>
          <div className={cn('eyebrow', onDark ? 'text-azure-100/70' : 'text-ink-faint')}>
            GCTU Portal
          </div>
        </div>
      )}
    </div>
  )
}
