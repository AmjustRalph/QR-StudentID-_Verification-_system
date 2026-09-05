import { useMemo, useState } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Field } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useStudentRecord } from '@/features/student/useStudentRecord'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'

type EnrolledCourse = {
  id: string
  code: string
  name: string
  lecturer: { full_name: string } | null
}

type EnrollmentRow = { course: EnrolledCourse | null }

/**
 * Read-only by design — the administrator is the only one who assigns a
 * student to a course (spec §3, enrollments RLS). This just gives students a
 * proper place to search and see what they're actually enrolled in, which
 * previously only existed indirectly as a filter dropdown on other screens.
 */
export function MyCoursesPage() {
  const { data: student, loading: studentLoading } = useStudentRecord()
  const studentId = student?.id ?? null
  const [query, setQuery] = useState('')

  const courses = useAsync<EnrolledCourse[]>(async () => {
    if (!studentId) return []
    const { data, error } = await supabase
      .from('enrollments')
      .select('course:courses(id, code, name, lecturer:users(full_name))')
      .eq('student_id', studentId)
    if (error) throw error
    return ((data ?? []) as unknown as EnrollmentRow[])
      .map((row) => row.course)
      .filter((course): course is EnrolledCourse => Boolean(course))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [studentId])

  const filtered = useMemo(() => {
    if (!courses.data) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return courses.data
    return courses.data.filter(
      (course) => course.name.toLowerCase().includes(needle) || course.code.toLowerCase().includes(needle),
    )
  }, [courses.data, query])

  return (
    <AppShell title="My Courses">
      <PageHeading title="My Courses" meta="Courses you're enrolled in this semester" />

      <Card className="mb-6">
        <Field
          label="Search my courses"
          placeholder="Search by name or code"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      <Card flush>
        <CardHeader title={`${filtered.length} course${filtered.length === 1 ? '' : 's'}`} />
        {courses.loading || studentLoading ? (
          <div className="grid h-40 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : courses.error ? (
          <div className="p-5">
            <Alert tone="denied">{courses.error}</Alert>
          </div>
        ) : filtered.length > 0 ? (
          <ul>
            {filtered.map((course) => (
              <li key={course.id} className="border-b border-line px-5 py-4 last:border-0">
                <p className="font-semibold text-navy-900">{course.name}</p>
                <p className="data mt-0.5 text-xs text-ink-muted">
                  {course.code}
                  {course.lecturer?.full_name && ` · ${course.lecturer.full_name}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={query ? 'No match' : 'Not enrolled in any courses yet'}
            description={
              query
                ? 'Try a different search.'
                : 'An administrator assigns your courses for the semester — contact them if this looks wrong.'
            }
          />
        )}
      </Card>
    </AppShell>
  )
}
