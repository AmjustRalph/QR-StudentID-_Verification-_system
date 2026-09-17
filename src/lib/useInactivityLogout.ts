import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'qrsidvs:last-activity'
const TIMEOUT_MS = 18 * 60 * 60 * 1000 // 18 hours
const CHECK_INTERVAL_MS = 60 * 1000
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

function markActivity() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    // Storage unavailable (private browsing, quota) — the timeout just won't
    // survive a reload; the session still works, it's only this feature that
    // degrades.
  }
}

function getLastActivity(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : Date.now()
  } catch {
    return Date.now()
  }
}

/**
 * Signs a user out after 18 hours with no interaction anywhere in the app.
 * This isn't a Supabase-native feature — its refresh token happily keeps a
 * session alive indefinitely as long as the app is used, so idle timeout has
 * to be enforced here instead.
 *
 * The timestamp lives in localStorage (not component state), so activity in
 * any tab resets the clock for all of them, and a tab reopened after being
 * closed past the timeout logs out immediately rather than waiting for the
 * next interval tick.
 */
export function useInactivityLogout(active: boolean, onTimeout: () => void) {
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!active) return

    // Signing in (or simply having the app open) counts as activity, so the
    // clock starts fresh rather than picking up a stale timestamp from
    // whatever the last session left behind.
    markActivity()

    const handleActivity = () => markActivity()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }))

    const checkTimeout = () => {
      if (Date.now() - getLastActivity() >= TIMEOUT_MS) {
        onTimeoutRef.current()
      }
    }
    const interval = setInterval(checkTimeout, CHECK_INTERVAL_MS)
    // Catches the "tab was closed and reopened after 18+ hours" case
    // immediately, instead of waiting up to a minute for the interval.
    checkTimeout()
    window.addEventListener('focus', checkTimeout)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity))
      window.removeEventListener('focus', checkTimeout)
      clearInterval(interval)
    }
  }, [active])
}
