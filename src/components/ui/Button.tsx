import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onDark'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-azure-600 text-white hover:bg-azure-700 disabled:bg-azure-500',
  secondary:
    'bg-surface text-navy-900 border border-line-strong hover:bg-canvas disabled:text-ink-faint',
  ghost: 'bg-transparent text-azure-600 hover:bg-azure-50',
  danger: 'bg-denied-600 text-white hover:bg-denied-700',
  onDark: 'bg-white/10 text-white border border-white/20 hover:bg-white/15',
}

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-display font-semibold',
        'transition-[background-color,color,transform] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}
