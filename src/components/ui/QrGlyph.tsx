import { cn } from '@/lib/cn'

/**
 * Decorative QR-like glyph used as brand furniture where no real code is being
 * displayed (auth hero, empty states). Deterministic — not a scannable code.
 * Real, scannable codes are rendered by the QR generator, never by this.
 */
export function QrGlyph({ className, modules = 11 }: { className?: string; modules?: number }) {
  const cells: { x: number; y: number }[] = []
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      // Stable pseudo-pattern: dense enough to read as a code at a glance.
      if (((x * 7 + y * 13 + ((x * y) % 5)) % 3) % 2 === 0) cells.push({ x, y })
    }
  }

  return (
    <svg
      viewBox={`0 0 ${modules} ${modules}`}
      className={cn('block', className)}
      aria-hidden
      role="presentation"
      shapeRendering="crispEdges"
    >
      {cells.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="0.82" height="0.82" fill="currentColor" />
      ))}
    </svg>
  )
}
