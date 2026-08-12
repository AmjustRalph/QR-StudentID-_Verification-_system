import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

/**
 * Renders a genuinely scannable QR code (unlike QrGlyph, which is decorative
 * brand furniture). Dark modules on a white backing, matching how the
 * mockups present the code and how most scanners expect it regardless of
 * the surrounding panel's colour.
 */
export function QrCode({ value, className }: { value: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setSvg(null)
    setError(false)

    QRCode.toString(value, { type: 'svg', margin: 0 })
      .then((markup) => {
        if (active) setSvg(markup)
      })
      .catch(() => {
        if (active) setError(true)
      })

    return () => {
      active = false
    }
  }, [value])

  if (error) {
    return (
      <div className={cn('grid place-items-center rounded bg-denied-50 text-denied-600', className)}>
        <span className="eyebrow px-2 text-center">Could not render code</span>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className={cn('grid place-items-center rounded bg-white text-azure-600', className)}>
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div
      role="img"
      aria-label="Scannable verification code"
      className={cn('rounded bg-white p-2 [&_svg]:h-full [&_svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
