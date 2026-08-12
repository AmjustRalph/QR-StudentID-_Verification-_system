import { useMemo, useState } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Field, SelectField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatDate, formatTime } from '@/lib/format'
import { useAllCourses } from '@/features/admin/useAllCourses'
import type { ScanSource } from '@/lib/database.types'

type SessionRow = {
  id: string
  started_at: string
  ended_at: string | null
  scanned_count: number
  reported_headcount: number | null
  discrepancy_flag: boolean
  discrepancy_resolved: boolean
  course: { id: string; code: string; name: string } | null
  lecturer: { full_name: string } | null
}

type AttendeeRow = {
  id: string
  scanned_at: string
  scan_source: ScanSource
  student: { full_name: string; student_id_number: string } | null
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

function SessionAttendees({ sessionId }: { sessionId: string }) {
  const attendees = useAsync<AttendeeRow[]>(async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, scanned_at, scan_source, student:students(full_name, student_id_number)')
      .eq('session_id', sessionId)
      .order('scanned_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as AttendeeRow[]
  }, [sessionId])

  if (attendees.loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner className="h-4 w-4 text-azure-600" />
      </div>
    )
  }
  if (attendees.error) return <Alert tone="denied">{attendees.error}</Alert>
  if (!attendees.data || attendees.data.length === 0) {
    return <p className="py-4 text-center text-sm text-ink-muted">No one scanned in this session.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-sm text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="eyebrow px-4 py-2 text-ink-muted">Student</th>
            <th className="eyebrow px-4 py-2 text-ink-muted">Time</th>
            <th className="eyebrow px-4 py-2 text-ink-muted">Source</th>
          </tr>
        </thead>
        <tbody>
          {attendees.data.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2">
                <p className="font-medium text-navy-900">{row.student?.full_name ?? '—'}</p>
                <p className="data text-xs text-ink-muted">{row.student?.student_id_number}</p>
              </td>
              <td className="data px-4 py-2 text-ink-muted">{formatTime(row.scanned_at)}</td>
              <td className="data px-4 py-2 text-ink-muted">{SOURCE_LABEL[row.scan_source]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AttendanceRecordsPage() {
  const courses = useAllCourses()
  const [courseId, setCourseId] = useState('')
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(defaultTo())
  const [expanded, setExpanded] = useState<string | null>(null)

  const sessions = useAsync<SessionRow[]>(async () => {
    let query = supabase
      .from('attendance_sessions')
      .select(
        // attendance_sessions has two FKs into users (lecturer_id, resolved_by), so the
        // embed must be disambiguated — plain `users(...)` is a PGRST201 ambiguity error.
        'id, started_at, ended_at, scanned_count, reported_headcount, discrepancy_flag, discrepancy_resolved, course:courses(id, code, name), lecturer:users!attendance_sessions_lecturer_id_fkey(full_name)',
      )
      .gte('started_at', `${from}T00:00:00`)
      .lte('started_at', `${to}T23:59:59`)
      .order('started_at', { ascending: false })
      .limit(100)
    if (courseId) query = query.eq('course_id', courseId)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as SessionRow[]
  }, [courseId, from, to])

  const flaggedCount = useMemo(
    () => sessions.data?.filter((s) => s.discrepancy_flag && !s.discrepancy_resolved).length ?? 0,
    [sessions.data],
  )

  return (
    <AppShell title="Attendance Records">
      <PageHeading title="Attendance Records" meta="Every session across every course" />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">All courses</option>
            {courses.data?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.name}
              </option>
            ))}
          </SelectField>
          <Field label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Field label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </Card>

      <Card flush>
        <CardHeader
          title={`${sessions.data?.length ?? 0} session${sessions.data?.length === 1 ? '' : 's'}`}
          action={
            flaggedCount > 0 && (
              <StatusPill tone="pending">
                {flaggedCount} unresolved flag{flaggedCount === 1 ? '' : 's'}
              </StatusPill>
            )
          }
        />
        {sessions.loading ? (
          <div className="grid h-40 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : sessions.error ? (
          <div className="p-5">
            <Alert tone="denied">{sessions.error}</Alert>
          </div>
        ) : sessions.data && sessions.data.length > 0 ? (
          <ul>
            {sessions.data.map((session) => (
              <li key={session.id} className="border-b border-line last:border-0">
                <button
                  onClick={() => setExpanded(expanded === session.id ? null : session.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-canvas"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900">{session.course?.name ?? '—'}</p>
                    <p className="data mt-0.5 text-xs text-ink-muted">
                      {formatDate(session.started_at)} {formatTime(session.started_at)} · Lect.{' '}
                      {session.lecturer?.full_name ?? '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="data text-sm text-ink-muted">
                      {session.scanned_count}
                      {session.reported_headcount !== null && ` / ${session.reported_headcount}`}
                    </p>
                    {session.ended_at === null ? (
                      <StatusPill tone="verified" dot>
                        Active
                      </StatusPill>
                    ) : session.discrepancy_flag ? (
                      <StatusPill tone={session.discrepancy_resolved ? 'neutral' : 'pending'}>
                        {session.discrepancy_resolved ? 'Resolved' : 'Flagged'}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Closed</StatusPill>
                    )}
                  </div>
                </button>
                {expanded === session.id && (
                  <div className="border-t border-line bg-canvas px-5 py-3">
                    <SessionAttendees sessionId={session.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No sessions in this range" description="Try widening the date range or course filter." />
        )}
      </Card>
    </AppShell>
  )
}
