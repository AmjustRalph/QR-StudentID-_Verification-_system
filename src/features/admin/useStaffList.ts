import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import type { UserRecord } from '@/lib/database.types'

export function useStaffList() {
  return useAsync<UserRecord[]>(async () => {
    const { data, error } = await supabase.from('users').select('*').eq('role', 'staff').order('full_name')
    if (error) throw error
    return data ?? []
  }, [])
}
