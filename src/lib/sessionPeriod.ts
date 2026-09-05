import type { SessionPeriod } from './database.types'

export const SESSION_PERIOD_LABEL: Record<SessionPeriod, string> = {
  morning: 'Morning',
  evening: 'Evening',
}

export const SESSION_PERIOD_OPTIONS: { value: SessionPeriod; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
]
