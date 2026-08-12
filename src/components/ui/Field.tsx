import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const CONTROL =
  'h-11 w-full rounded-lg border bg-surface px-3 text-sm text-navy-900 transition-colors ' +
  'placeholder:text-ink-faint disabled:bg-canvas disabled:text-ink-muted'

function Wrapper({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-denied-600">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  error?: string
}

export function Field({ label, hint, error, className, id, ...rest }: FieldProps) {
  const generated = useId()
  const inputId = id ?? generated

  return (
    <Wrapper id={inputId} label={label} hint={hint} error={error}>
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          CONTROL,
          error ? 'border-denied-600' : 'border-line-strong focus:border-azure-600',
          className,
        )}
      />
    </Wrapper>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}

export function SelectField({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...rest
}: SelectFieldProps) {
  const generated = useId()
  const selectId = id ?? generated

  return (
    <Wrapper id={selectId} label={label} hint={hint} error={error}>
      <select
        {...rest}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={cn(
          CONTROL,
          error ? 'border-denied-600' : 'border-line-strong focus:border-azure-600',
          className,
        )}
      >
        {children}
      </select>
    </Wrapper>
  )
}
