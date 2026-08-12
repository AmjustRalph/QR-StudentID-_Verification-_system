import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import type { CourseRecord } from '@/lib/database.types'

type EnrolledRow = { course: CourseRecord | null }

export function useEnrolledCourses(studentId: string | null) {
  return useAsync<CourseRecord[]>(async () => {
    if (!studentId) return []
    const { data, error } = await supabase
      .from('enrollments')
      .select('course:courses(id, code, name, lecturer_id, created_at)')
      .eq('student_id', studentId)
    if (error) throw error
    return ((data ?? []) as unknown as EnrolledRow[])
      .map((row) => row.course)
      .filter((course): course is CourseRecord => Boolean(course))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [studentId])
}
