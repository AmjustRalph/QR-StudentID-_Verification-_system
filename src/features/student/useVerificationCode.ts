import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type MintResponse = { code: string; kind: 'live'; expiresAt: string; periodSeconds: number }

type State = {
  code: string | null
  expiresAt: string | null
  periodSeconds: number
  loading: boolean
  error: string | null
}

/**
 * Fetches the student's live rotating code from the mint-code Edge Function
 * and re-fetches automatically the instant it expires, so the panel always
 * holds a code the verify-code function will currently accept — the student
 * never has to refresh the page to get a fresh one.
 */
export function useVerificationCode(): State {
  const [state, setState] = useState<State>({
    code: null,
    expiresAt: null,
    periodSeconds: 60,
    loading: true,
    error: null,
  })
  const timerRef = useRef<number | null>(null)

  const mint = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: previous.code === null, error: null }))

    const { data, error } = await supabase.functions.invoke<MintResponse>('mint-code')

    if (error || !data) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error?.message ?? 'Could not reach the verification service.',
      }))
      return
    }

    setState({
      code: data.code,
      expiresAt: data.expiresAt,
      periodSeconds: data.periodSeconds,
      loading: false,
      error: null,
    })

    const msUntilExpiry = new Date(data.expiresAt).getTime() - Date.now()
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => void mint(), Math.max(msUntilExpiry, 1000))
  }, [])

  useEffect(() => {
    void mint()
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [mint])

  return state
}
