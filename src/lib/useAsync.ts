import { useCallback, useEffect, useState } from 'react'

type State<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Supabase's PostgrestError (and FunctionsError) carry a `.message` but are
 * plain objects, not `Error` instances — `error instanceof Error` misses them
 * and was hiding real query errors behind a generic message. This catches
 * anything with a usable string `message`, not just true Errors.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return 'Could not load this data.'
}

/**
 * Minimal data-fetching hook. Deliberately not a cache — screens here are
 * mount-and-read, and a query library would be more machinery than this project
 * needs. Swap for TanStack Query if the scanning screens later need
 * background refetching.
 */
export function useAsync<T>(run: () => Promise<T>, deps: unknown[] = []): State<T> & {
  reload: () => void
} {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null })
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    setState((previous) => ({ ...previous, loading: true, error: null }))

    run()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({ data: null, loading: false, error: messageOf(error) })
      })

    return () => {
      active = false
    }
    // `run` is intentionally excluded: callers pass an inline closure, and the
    // explicit deps array is what decides when a refetch happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { ...state, reload }
}
