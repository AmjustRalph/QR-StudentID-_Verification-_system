import { useState } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState, StatTile } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, SelectField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatDate, formatTime } from '@/lib/format'
import { useAllCourses } from '@/features/admin/useAllCourses'
import {
  aggregateByCourse,
  downloadCsv,
  toCsv,
  type CourseReportRow,
  type SessionForReport,
} from '@/features/admin/reportAggregation'

type SessionQueryRow = {
  course_id: string
  scanned_count: number
  discrepancy_flag: boolean
  course: { code: string; name: string } | null
}

type FlaggedSession = {
  id: string
  started_at: string
  scanned_count: number
  reported_headcount: number | null
  course: { code: string; name: string } | null
}

function defaultFrom(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ReportsPage() {
  const courses = useAllCourses()
  const [courseId, setCourseId] = useState('')
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(defaultTo())
  const [generation, setGeneration] = useState(0)

  const report = useAsync<CourseReportRow[]>(async () => {
    let query = supabase
      .from('attendance_sessions')
      .select('course_id, scanned_count, discrepancy_flag, course:courses(code, name)')
      .gte('started_at', `${from}T00:00:00`)
      .lte('started_at', `${to}T23:59:59`)
    if (courseId) query = query.eq('course_id', courseId)

    const { data, error } = await query
    if (error) throw error
    const sessions = (data ?? []) as unknown as SessionQueryRow[]

    const asReportSessions: SessionForReport[] = sessions
      .filter((s) => s.course !== null)
      .map((s) => ({
        course_id: s.course_id,
        course_code: s.course!.code,
        course_name: s.course!.name,
        scanned_count: s.scanned_count,
        discrepancy_flag: s.discrepancy_flag,
      }))

    const { data: enrollments, error: enrollError } = await supabase.from('enrollments').select('course_id')
    if (enrollError) throw enrollError
    const enrolledByCourse = new Map<string, number>()
    for (const row of enrollments ?? []) {
      enrolledByCourse.set(row.course_id, (enrolledByCourse.get(row.course_id) ?? 0) + 1)
    }

    return aggregateByCourse(asReportSessions, enrolledByCourse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, from, to, generation])

  const flagged = useAsync<FlaggedSession[]>(async () => {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('id, started_at, scanned_count, reported_headcount, course:courses(code, name)')
      .eq('discrepancy_flag', true)
      .eq('discrepancy_resolved', false)
      .order('started_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return (data ?? []) as unknown as FlaggedSession[]
  }, [generation])

  const [resolvingId, setResolvingId] = useState<string | null>(null)
  async function resolveSession(sessionId: string) {
    setResolvingId(sessionId)
    await supabase.from('attendance_sessions').update({ discrepancy_resolved: true }).eq('id', sessionId)
    setResolvingId(null)
    flagged.reload()
    report.reload()
  }

  const totals = report.data?.reduce(
    (acc, row) => ({
      sessions: acc.sessions + row.sessions,
      weightedRate: acc.weightedRate + (row.attendanceRate ?? 0) * row.sessions,
      rateWeight: acc.rateWeight + (row.attendanceRate !== null ? row.sessions : 0),
      flags: acc.flags + row.flags,
    }),
    { sessions: 0, weightedRate: 0, rateWeight: 0, flags: 0 },
  )
  const averageRate = totals && totals.rateWeight > 0 ? totals.weightedRate / totals.rateWeight : null

  return (
    <AppShell title="Reports">
      <PageHeading title="Generate Report" meta="Filter and export attendance, verification, or discrepancy records" />

      <Card className="mb-6 print:hidden">
        <div className="grid gap-4 sm:grid-cols-4">
          <SelectField label="Course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">All Courses</option>
            {courses.data?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} · {course.name}
              </option>
            ))}
          </SelectField>
          <Field label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Field label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <div className="flex items-end">
            <Button fullWidth onClick={() => setGeneration((g) => g + 1)}>
              Generate
            </Button>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatTile label="Total Sessions" value={report.loading ? '—' : (totals?.sessions ?? 0)} />
        <StatTile
          label="Average Attendance"
          value={report.loading ? '—' : averageRate === null ? 'n/a' : `${averageRate.toFixed(1)}%`}
          tone="verified"
        />
        <StatTile
          label="Flagged Discrepancies"
          value={report.loading ? '—' : (totals?.flags ?? 0)}
          tone="pending"
        />
      </div>

      <Card flush className="mb-6">
        <CardHeader
          title={`Report Preview: Attendance Summary (${formatDate(from)} – ${formatDate(to)})`}
          action={
            <div className="flex gap-2 print:hidden">
              <Button
                size="sm"
                variant="secondary"
                disabled={!report.data || report.data.length === 0}
                onClick={() => report.data && downloadCsv(`attendance-summary-${from}-to-${to}.csv`, toCsv(report.data))}
              >
                Export CSV
              </Button>
              <Button size="sm" variant="secondary" onClick={() => window.print()}>
                Export PDF
              </Button>
            </div>
          }
        />
        {report.loading ? (
          <div className="grid h-40 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : report.error ? (
          <div className="p-5">
            <Alert tone="denied">{report.error}</Alert>
          </div>
        ) : report.data && report.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="eyebrow px-5 py-3 text-ink-muted">Course</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Sessions</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Enrolled</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Avg. Present</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Attendance Rate</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Flags</th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((row) => (
                  <tr key={row.courseId} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-900">{row.courseName}</td>
                    <td className="data px-5 py-3 text-ink-muted">{row.sessions}</td>
                    <td className="data px-5 py-3 text-ink-muted">{row.enrolled}</td>
                    <td className="data px-5 py-3 text-ink-muted">{row.avgPresent.toFixed(1)}</td>
                    <td className="data px-5 py-3 text-ink-muted">
                      {row.attendanceRate === null ? 'n/a' : `${row.attendanceRate.toFixed(1)}%`}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone={row.flags > 0 ? 'pending' : 'verified'}>{row.flags}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No sessions in this range" description="Try widening the date range or course filter." />
        )}
      </Card>

      <Card flush className="print:hidden">
        <CardHeader title="Flagged Sessions" />
        {flagged.loading ? (
          <div className="grid h-32 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : flagged.error ? (
          <div className="p-5">
            <Alert tone="denied">{flagged.error}</Alert>
          </div>
        ) : flagged.data && flagged.data.length > 0 ? (
          <ul>
            {flagged.data.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{session.course?.name ?? '—'}</p>
                  <p className="data mt-0.5 text-xs text-ink-muted">
                    {formatDate(session.started_at)} {formatTime(session.started_at)} · Scanned{' '}
                    {session.scanned_count} / Reported {session.reported_headcount}
                  </p>
                </div>
                <Button
                  size="sm"
                  loading={resolvingId === session.id}
                  onClick={() => void resolveSession(session.id)}
                  className="shrink-0"
                >
                  Mark Resolved
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing flagged" description="Every discrepancy has been resolved." />
        )}
      </Card>
    </AppShell>
  )
}
