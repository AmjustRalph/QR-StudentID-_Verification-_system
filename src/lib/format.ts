/** Formatting helpers shared across tables and cards. All dates render in en-GB. */

const DATE_FULL = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const DATE_SHORT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const DATE_COMPACT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })

const TIME_SHORT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

export const formatFullDate = (value: Date | string) => DATE_FULL.format(toDate(value))
export const formatDate = (value: Date | string) => DATE_SHORT.format(toDate(value))
export const formatCompactDate = (value: Date | string) =>
  DATE_COMPACT.format(toDate(value)).toUpperCase()
export const formatTime = (value: Date | string) => TIME_SHORT.format(toDate(value)).toUpperCase()

/** Postgres `time` columns arrive as "09:00:00" — no date attached. */
export function formatClockTime(value: string): string {
  const [hours, minutes] = value.split(':')
  return `${hours?.padStart(2, '0') ?? '00'}:${minutes ?? '00'}`
}

export function firstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] ?? 'there'
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}
