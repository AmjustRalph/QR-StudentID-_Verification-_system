import { Link } from 'react-router-dom'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { VerificationCodePanel } from '@/features/student/VerificationCodePanel'
import { useStudentRecord } from '@/features/student/useStudentRecord'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatCompactDate, formatClockTime, formatDate, formatFullDate, formatTime } from '@/lib/format'
import type { ClearanceStatus } from '@/lib/database.types'
import { useEnrolledCourses } from '@/features/student/useEnrolledCourses'
import { CLEARANCE_PILL } from '@/features/student/clearance'

type RecentAttendance = {
  id: string
  scanned_at: string
  session: { course: { code: string; name: string } | null } | null
}

type UpcomingExam = {
  id: string
  exam_date: string
  exam_time: string
  venue: string | null
  course: { code: string; name: string } | null
  clearance: ClearanceStatus | null
}

export function StudentDashboardPage() {
  const { profile } = useAuth()
  const { data: student, loading: studentLoading, error: studentError } = useStudentRecord()
  const studentId = student?.id ?? null
  const enrolledCourses = useEnrolledCourses(studentId)

  const attendance = useAsync<RecentAttendance[]>(async () => {
    if (!studentId) return []
    const { data, error } = await supabase
      .from('attendance')
      .select('id, scanned_at, session:attendance_sessions(course:courses(code, name))')
      .eq('student_id', studentId)
      .order('scanned_at', { ascending: false })
      .limit(5)
    if (error) throw error
    // Embedded selects are not described by the hand-maintained Database type,
    // so the shape is asserted here rather than inferred.
    return (data ?? []) as unknown as RecentAttendance[]
  }, [studentId])

  const exams = useAsync<UpcomingExam[]>(async () => {
    const enrolledCourseIds = enrolledCourses.data?.map((course) => course.id) ?? []
    if (!studentId || enrolledCourseIds.length === 0) return []
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('examinations')
      .select('id, exam_date, exam_time, venue, course:courses(code, name)')
      .in('course_id', enrolledCourseIds)
      .gte('exam_date', today)
      .order('exam_date', { ascending: true })
      .limit(5)
    if (error) throw error

    const rows = (data ?? []) as unknown as Omit<UpcomingExam, 'clearance'>[]
    if (rows.length === 0) return []

    // Clearance lives on the student's own registration rows, fetched separately
    // so the exam list stays readable even where no registration exists yet.
    const { data: registrations, error: registrationError } = await supabase
      .from('exam_registrations')
      .select('examination_id, clearance_status')
      .eq('student_id', studentId)
      .in(
        'examination_id',
        rows.map((row) => row.id),
      )
    if (registrationError) throw registrationError

    const byExam = new Map(registrations?.map((r) => [r.examination_id, r.clearance_status]))
    return rows.map((row) => ({ ...row, clearance: byExam.get(row.id) ?? null }))
  }, [studentId, enrolledCourses.data])

  return (
    <AppShell title="Student Dashboard">
      <PageHeading
        title={`Welcome back, ${student?.full_name?.split(' ')[0] ?? profile?.full_name?.split(' ')[0] ?? ''}`.trim()}
        meta={
          <>
            {formatFullDate(new Date())}
            {student?.programme && ` · ${student.programme}`}
            {student?.level && `, Level ${student.level}`}
          </>
        }
      />

      {studentError && (
        <Alert tone="denied" title="Could not load your student record" className="mb-6">
          {studentError}
        </Alert>
      )}

      {studentLoading ? (
        <div className="grid h-48 place-items-center rounded-xl bg-navy-900 text-white">
          <Spinner className="h-6 w-6" />
        </div>
      ) : student ? (
        <VerificationCodePanel student={student} />
      ) : (
        <Alert tone="pending" title="No student record found">
          Your account is not linked to a student record yet. Contact an administrator.
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card flush>
          <CardHeader
            title="Recent Attendance"
            action={
              <Link
                to="/student/attendance"
                className="text-sm font-semibold text-azure-600 hover:underline"
              >
                View all →
              </Link>
            }
          />
          {attendance.loading ? (
            <div className="grid h-40 place-items-center text-azure-600">
              <Spinner className="h-5 w-5" />
            </div>
          ) : attendance.error ? (
            <div className="p-5">
              <Alert tone="denied">{attendance.error}</Alert>
            </div>
          ) : attendance.data && attendance.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-lg text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="eyebrow px-5 py-3 text-ink-muted">Course</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">Date</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">Time</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.data.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium text-navy-900">
                        {row.session?.course?.name ?? 'Unknown course'}
                      </td>
                      <td className="data px-5 py-3 text-ink-muted">{formatDate(row.scanned_at)}</td>
                      <td className="data px-5 py-3 text-ink-muted">{formatTime(row.scanned_at)}</td>
                      <td className="px-5 py-3">
                        <StatusPill tone="verified" dot>
                          Present
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No attendance recorded yet"
              description="Your scans will appear here once a lecturer runs an attendance session for one of your courses."
            />
          )}
        </Card>

        <Card flush>
          <CardHeader
            title="Upcoming Examinations"
            action={
              <Link
                to="/student/examinations"
                className="text-sm font-semibold text-azure-600 hover:underline"
              >
                View all →
              </Link>
            }
          />
          {exams.loading ? (
            <div className="grid h-40 place-items-center text-azure-600">
              <Spinner className="h-5 w-5" />
            </div>
          ) : exams.error ? (
            <div className="p-5">
              <Alert tone="denied">{exams.error}</Alert>
            </div>
          ) : exams.data && exams.data.length > 0 ? (
            <ul>
              {exams.data.map((exam) => {
                const pill = exam.clearance ? CLEARANCE_PILL[exam.clearance] : null
                return (
                  <li
                    key={exam.id}
                    className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900">
                        {exam.course?.name ?? 'Examination'}
                      </p>
                      <p className="data mt-0.5 text-xs text-ink-muted">
                        {formatCompactDate(exam.exam_date)} · {formatClockTime(exam.exam_time)} ·{' '}
                        {exam.venue ?? 'Venue TBC'}
                      </p>
                    </div>
                    {pill ? (
                      <StatusPill tone={pill.tone} className="shrink-0">{pill.label}</StatusPill>
                    ) : (
                      <StatusPill tone="neutral" className="shrink-0">Not Registered</StatusPill>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              title="No examinations scheduled"
              description="Scheduled examinations for your courses will be listed here."
            />
          )}
        </Card>
      </div>
    </AppShell>
  )
}
