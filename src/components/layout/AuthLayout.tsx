import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/Logo'
import { Reticle } from '@/components/ui/Reticle'
import { QrGlyph } from '@/components/ui/QrGlyph'

type Props = {
  eyebrow: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * The split layout from Figure 4.1: navy value-proposition panel on the left,
 * form on the canvas to the right. The left panel collapses on small screens.
 */
export function AuthLayout({ eyebrow, title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,46%)_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-900 p-14 lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 10% 0%, var(--color-navy-700) 0%, transparent 60%)',
          }}
        />
        <div className="relative">
          <Logo />
          <h1 className="mt-12 max-w-md font-display text-4xl font-bold leading-tight text-white">
            Verify identity in under three seconds.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-azure-100/70">
            QR-SIDVS replaces manual registers and physical ID checks with a single scan  linked
            directly to the GCTU student record.
          </p>
        </div>

        <div className="relative mt-auto flex items-end justify-between gap-8">
          <Reticle tone="verified" size="md">
            <QrGlyph className="h-36 w-36 text-white" />
          </Reticle>
          <p className="eyebrow max-w-[10rem] text-right leading-4 text-azure-100/40">
            Ghana Communication Technology University
          </p>
        </div>
      </aside>

      <main className="flex min-h-dvh items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo variant="onLight" withWordmark />
          </div>
          <p className="eyebrow mt-8 text-azure-600 lg:mt-0">{eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-navy-900">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
