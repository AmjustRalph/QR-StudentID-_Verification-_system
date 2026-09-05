import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { useStudentRecord } from '@/features/student/useStudentRecord'
import { useEnrolledCourses } from '@/features/student/useEnrolledCourses'
import { CLEARANCE_PILL } from '@/features/student/clearance'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatClockTime, formatCompactDate } from '@/lib/format'
import { SESSION_PERIOD_LABEL } from '@/lib/sessionPeriod'
import type { ClearanceStatus, SessionPeriod } from '@/lib/database.types'

type ExamRow = {
  id: string
  exam_date: string
  exam_time: string
  venue: string | null
  session_period: SessionPeriod | null
  semester: string | null
  course: { id: string; code: string; name: string } | null
  clearance: ClearanceStatus | null
  registered: boolean
}

export function ExaminationSchedulePage() {
  const { data: student } = useStudentRecord()
  const studentId = student?.id ?? null
  const enrolledCourses = useEnrolledCourses(studentId)

  const exams = useAsync<ExamRow[]>(async () => {
    const courseIds = enrolledCourses.data?.map((course) => course.id) ?? []
    if (!studentId || courseIds.length === 0) return []

    const { data, error } = await supabase
      .from('examinations')
      .select('id, exam_date, exam_time, venue, session_period, semester, course:courses(id, code, name)')
      .in('course_id', courseIds)
      .order('exam_date', { ascending: true })
    if (error) throw error

    const rows = (data ?? []) as unknown as Omit<ExamRow, 'clearance' | 'registered'>[]
    if (rows.length === 0) return []

    const { data: registrations, error: registrationError } = await supabase
      .from('exam_registrations')
      .select('examination_id, is_registered, clearance_status')
      .eq('student_id', studentId)
      .in('examination_id', rows.map((row) => row.id))
    if (registrationError) throw registrationError

    const byExam = new Map(registrations?.map((r) => [r.examination_id, r]))
    return rows.map((row) => {
      const registration = byExam.get(row.id)
      return {
        ...row,
        registered: registration?.is_registered ?? false,
        clearance: registration?.clearance_status ?? null,
      }
    })
  }, [studentId, enrolledCourses.data])

  return (
    <AppShell title="Examination Schedule">
      <PageHeading title="Examination Schedule" meta="Every scheduled examination for your enrolled courses" />

      <Card flush>
        <CardHeader title={`${exams.data?.length ?? 0} examination${exams.data?.length === 1 ? '' : 's'}`} />
        {exams.loading || enrolledCourses.loading ? (
          <div className="grid h-40 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : exams.error || enrolledCourses.error ? (
          <div className="p-5">
            <Alert tone="denied">{exams.error ?? enrolledCourses.error}</Alert>
          </div>
        ) : exams.data && exams.data.length > 0 ? (
          <ul>
            {exams.data.map((exam) => {
              const pill = exam.clearance ? CLEARANCE_PILL[exam.clearance] : null
              return (
                <li
                  key={exam.id}
                  className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900">{exam.course?.name ?? 'Examination'}</p>
                    <p className="data mt-0.5 text-xs text-ink-muted">{exam.course?.code}</p>
                    <p className="data mt-1 text-sm text-ink-muted">
                      {formatCompactDate(exam.exam_date)} · {formatClockTime(exam.exam_time)}
                      {exam.session_period && ` · ${SESSION_PERIOD_LABEL[exam.session_period]}`}
                      {exam.venue ? ` · ${exam.venue}` : ' · Venue to be confirmed'}
                    </p>
                    {exam.semester && <p className="mt-0.5 text-xs text-ink-faint">{exam.semester}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {!exam.registered ? (
                      <StatusPill tone="neutral">Not Registered</StatusPill>
                    ) : pill ? (
                      <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            title="No examinations scheduled"
            description="Scheduled examinations for your enrolled courses will be listed here."
          />
        )}
      </Card>
    </AppShell>
  )
}
