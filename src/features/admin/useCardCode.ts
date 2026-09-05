import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

type MintCardResponse = { code: string; kind: 'static' }

/** 
 * Mints the permanent physical-card code for a student on demand (admin-only,
 * via mint-card-code). Deterministic — regenerating for the same student
 * always returns the same code, matching a reprinted card.
 */
export function useCardCode() {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (studentId: string) => {
    setLoading(true)
    setError(null)
    setCode(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke<MintCardResponse>(
        'mint-card-code',
        { body: { studentId } },
      )
      if (fnError || !data) throw new Error(fnError?.message ?? 'Could not generate the card code.')
      setCode(data.code)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate the card code.')
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setCode(null)
    setError(null)
  }, [])

  return { code, loading, error, generate, reset }
}
