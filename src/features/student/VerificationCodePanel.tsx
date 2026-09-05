import { useEffect, useState } from 'react'
import { Reticle } from '@/components/ui/Reticle'
import { QrCode } from '@/components/ui/QrCode'
import { Spinner } from '@/components/ui/Spinner'
import { useVerificationCode } from './useVerificationCode'
import type { StudentRecord } from '@/lib/database.types'

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const mins = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function useCountdown(expiresAt: string | null): number {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0)
      return
    }

    const tick = () => {
      const secondsLeft = Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)
      setRemaining(Math.max(0, secondsLeft))
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [expiresAt])

  return remaining
}

/**
 * The navy verification-code panel from Figure 4.2. Mints a real, signed,
 * time-boxed code from the mint-code Edge Function and re-renders it the
 * instant a fresh one arrives — this is the actual code a scanning device
 * checks against via verify-code, not a placeholder.
 */
export function VerificationCodePanel({ student }: { student: StudentRecord }) {
  const { code, expiresAt, loading, error } = useVerificationCode()
  const remaining = useCountdown(expiresAt)

  return (
    <section className="relative overflow-hidden rounded-xl bg-navy-900 p-6 shadow-panel sm:p-7">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 120% at 85% 0%, var(--color-navy-700) 0%, transparent 62%)',
        }}
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <Reticle tone="verified" size="md" className="shrink-0 self-start">
          {code ? (
            <QrCode value={code} className="h-32 w-32" />
          ) : (
            <div className="grid h-32 w-32 place-items-center rounded bg-white/10">
              <Spinner className="h-6 w-6 text-white" />
            </div>
          )}
        </Reticle>

        <div className="min-w-0 flex-1">
          <p className="eyebrow text-azure-100/60">Your verification code</p>
          <p className="mt-1 font-display text-2xl font-bold text-white">{student.full_name}</p>
          <p className="data mt-1 text-sm text-azure-100/70">
            ID: {student.student_id_number}
            {student.programme && <span className="mx-2 text-azure-100/30">•</span>}
            {student.level && `Level ${student.level}`}
          </p>

          {error ? (
            <p className="eyebrow mt-3 text-denied-600">{error}</p>
          ) : (
            <p className="eyebrow mt-3 flex items-center gap-2 text-verified-600" aria-live="off">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-verified-600" />
              {loading && !code ? 'Generating…' : `Refreshes in ${formatCountdown(remaining)}`}
            </p>
          )}
        </div>

        <p className="text-xs leading-relaxed text-azure-100/50 sm:max-w-52 sm:self-start sm:text-right">
          For classroom use only. Physical card required for examinations.
        </p>
      </div>
    </section>
  )
}
