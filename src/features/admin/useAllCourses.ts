import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import type { CourseRecord } from '@/lib/database.types'

export function useAllCourses() {
  return useAsync<CourseRecord[]>(async () => {
    const { data, error } = await supabase.from('courses').select('*').order('code')
    if (error) throw error
    return data ?? []
  }, [])
}
