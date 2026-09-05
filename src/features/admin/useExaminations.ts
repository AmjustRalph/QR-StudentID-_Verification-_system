import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import type { SessionPeriod } from '@/lib/database.types'

export type ExaminationRow = {
  id: string
  exam_date: string
  exam_time: string
  venue: string | null
  session_period: SessionPeriod | null
  semester: string | null
  eligibility_criteria: string | null
  course: { id: string; code: string; name: string } | null
}

export function useExaminations() {
  return useAsync<ExaminationRow[]>(async () => {
    const { data, error } = await supabase
      .from('examinations')
      .select('id, exam_date, exam_time, venue, session_period, semester, eligibility_criteria, course:courses(id, code, name)')
      .order('exam_date', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as ExaminationRow[]
  }, [])
}
