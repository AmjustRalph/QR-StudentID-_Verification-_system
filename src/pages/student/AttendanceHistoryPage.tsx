import { useMemo, useState } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Field, SelectField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { useStudentRecord } from '@/features/student/useStudentRecord'
import { useEnrolledCourses } from '@/features/student/useEnrolledCourses'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatDate, formatTime } from '@/lib/format'
import type { ScanSource } from '@/lib/database.types'

type AttendanceRow = {
  id: string
  scanned_at: string
  scan_source: ScanSource
  session: { course: { id: string; code: string; name: string } | null } | null
}

const SOURCE_LABEL: Record<ScanSource, string> = {
  physical_card: 'Physical Card',
  digital_display: 'Phone Code',
  manual: 'Manual',
}

function defaultFrom(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

export function AttendanceHistoryPage() {
  const { data: student } = useStudentRecord()
  const studentId = student?.id ?? null
  const enrolledCourses = useEnrolledCourses(studentId)

  const [courseId, setCourseId] = useState('')
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(defaultTo())

  const attendance = useAsync<AttendanceRow[]>(async () => {
    if (!studentId) return []
    const { data, error } = await supabase
      .from('attendance')
      .select('id, scanned_at, scan_source, session:attendance_sessions(course:courses(id, code, name))')
      .eq('student_id', studentId)
      .gte('scanned_at', `${from}T00:00:00`)
      .lte('scanned_at', `${to}T23:59:59`)
      .order('scanned_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as unknown as AttendanceRow[]
  }, [studentId, from, to])

  const filtered = useMemo(() => {
    if (!attendance.data) return []
    if (!courseId) return attendance.data
    return attendance.data.filter((row) => row.session?.course?.id === courseId)
  }, [attendance.data, courseId])

  return (
    <AppShell title="Attendance History">
      <PageHeading title="Attendance History" meta="Every session you've been marked present for" />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">All courses</option>
            {enrolledCourses.data?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </SelectField>
          <Field label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Field label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </Card>

      <Card flush>
        <CardHeader title={`${filtered.length} record${filtered.length === 1 ? '' : 's'}`} />
        {attendance.loading ? (
          <div className="grid h-40 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : attendance.error ? (
          <div className="p-5">
            <Alert tone="denied">{attendance.error}</Alert>
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="eyebrow px-5 py-3 text-ink-muted">Course</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Date</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Time</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Source</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-900">
                      {row.session?.course?.name ?? 'Unknown course'}
                    </td>
                    <td className="data px-5 py-3 text-ink-muted">{formatDate(row.scanned_at)}</td>
                    <td className="data px-5 py-3 text-ink-muted">{formatTime(row.scanned_at)}</td>
                    <td className="data px-5 py-3 text-ink-muted">{SOURCE_LABEL[row.scan_source]}</td>
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
            title="No attendance in this range"
            description="Try widening the date range or selecting a different course."
          />
        )}
      </Card>
    </AppShell>
  )
}
