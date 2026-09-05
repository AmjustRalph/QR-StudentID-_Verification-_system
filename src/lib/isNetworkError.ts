/**
 * Best-effort test for "the request never reached the server" vs. "the
 * server answered" — used during queue sync to tell a still-offline retry
 * apart from a real failure worth reporting.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|networkerror|load failed|network request failed|econnrefused/i.test(message)
}
