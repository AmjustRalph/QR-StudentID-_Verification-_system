import { useCallback, useEffect, useState } from 'react'

export type QueueEntry<T> = {
  id: string
  queuedAt: string
  payload: T
}

/**
 * A small localStorage-backed FIFO queue for actions taken while offline.
 * Not a general sync engine — just enough to hold decisions until
 * connectivity returns and survive an accidental page reload in the meantime.
 */
export function useOfflineQueue<T>(storageKey: string) {
  const [entries, setEntries] = useState<QueueEntry<T>[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as QueueEntry<T>[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries))
    } catch {
      // Storage full or unavailable — the queue still works for this tab
      // session, it just won't survive a reload. Not worth surfacing.
    }
  }, [storageKey, entries])

  const enqueue = useCallback((payload: T) => {
    const entry: QueueEntry<T> = { id: crypto.randomUUID(), queuedAt: new Date().toISOString(), payload }
    setEntries((previous) => [...previous, entry])
    return entry.id
  }, [])

  const remove = useCallback((id: string) => {
    setEntries((previous) => previous.filter((entry) => entry.id !== id))
  }, [])

  return { entries, enqueue, remove }
}
