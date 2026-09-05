import { useEffect, useState } from 'react'

/**
 * Tracks browser connectivity via the online/offline events. A signal, not a
 * guarantee — navigator.onLine can read true while genuinely unreachable
 * (wifi with no internet), so callers should still treat an individual
 * request's own failure as authoritative rather than trusting this alone.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
