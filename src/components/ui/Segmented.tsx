import { cn } from '@/lib/cn'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  hint?: string
}

/** The "Sign in as" three-up selector from Figure 4.1. */
export function Segmented<T extends string>({ label, options, value, onChange, hint }: Props<T>) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-semibold text-navy-900">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid grid-flow-col gap-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'h-11 rounded-lg border text-sm font-semibold transition-colors',
                selected
                  ? 'border-azure-600 bg-azure-50 text-azure-700'
                  : 'border-line-strong bg-surface text-ink-muted hover:bg-canvas',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}
