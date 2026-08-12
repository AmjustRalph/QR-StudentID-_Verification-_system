import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { useAuth } from '@/features/auth/AuthProvider'
import type { StudentRecord } from '@/lib/database.types'

/** Loads the signed-in student's academic record. RLS scopes this to their own row. */
export function useStudentRecord() {
  const { session } = useAuth()
  const authUserId = session?.user.id ?? null

  return useAsync<StudentRecord | null>(async () => {
    if (!authUserId) return null
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    if (error) throw error
    return data
  }, [authUserId])
}
