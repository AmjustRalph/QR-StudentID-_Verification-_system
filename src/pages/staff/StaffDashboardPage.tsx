import { Link } from 'react-router-dom'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatDate, formatFullDate, formatTime, firstName } from '@/lib/format'
import type { AttendanceSessionRecord, CourseRecord } from '@/lib/database.types'

type SessionRow = AttendanceSessionRecord & { course: { code: string; name: string } | null }

export function StaffDashboardPage() {
  const { profile } = useAuth()
  const userId = profile?.id ?? null

  const courses = useAsync<CourseRecord[]>(async () => {
    if (!userId) return []
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('lecturer_id', userId)
      .order('code')
    if (error) throw error
    return data ?? []
  }, [userId])

  const sessions = useAsync<SessionRow[]>(async () => {
    if (!userId) return []
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*, course:courses(code, name)')
      .eq('lecturer_id', userId)
      .order('started_at', { ascending: false })
      .limit(6)
    if (error) throw error
    return (data ?? []) as unknown as SessionRow[]
  }, [userId])

  return (
    <AppShell title="Staff Dashboard">
      <PageHeading
        title={`Welcome back, ${firstName(profile?.full_name)}`}
        meta={formatFullDate(new Date())}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card flush>
          <CardHeader title="My Courses" />
          {courses.loading ? (
            <div className="grid h-40 place-items-center text-azure-600">
              <Spinner className="h-5 w-5" />
            </div>
          ) : courses.error ? (
            <div className="p-5">
              <Alert tone="denied">{courses.error}</Alert>
            </div>
          ) : courses.data && courses.data.length > 0 ? (
            <ul>
              {courses.data.map((course) => (
                <li
                  key={course.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900">{course.name}</p>
                    <p className="data mt-0.5 text-xs text-ink-muted">{course.code}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No courses assigned"
              description="An administrator needs to assign you as lecturer on a course before you can run attendance sessions."
            />
          )}
        </Card>

        <Card flush>
          <CardHeader
            title="Recent Sessions"
            action={
              <Link to="/staff/records" className="text-sm font-semibold text-azure-600 hover:underline">
                View all →
              </Link>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-lg text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="eyebrow px-5 py-3 text-ink-muted">Course</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">Started</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">Scanned</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">State</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.data.map((session) => (
                    <tr key={session.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium text-navy-900">
                        {session.course?.name ?? '—'}
                      </td>
                      <td className="data px-5 py-3 text-ink-muted">
                        {formatDate(session.started_at)} {formatTime(session.started_at)}
                      </td>
                      <td className="data px-5 py-3 text-ink-muted">
                        {session.scanned_count}
                        {session.reported_headcount !== null && ` / ${session.reported_headcount}`}
                      </td>
                      <td className="px-5 py-3">
                        {session.ended_at === null ? (
                          <StatusPill tone="verified" dot>
                            Active
                          </StatusPill>
                        ) : session.discrepancy_flag && !session.discrepancy_resolved ? (
                          <StatusPill tone="pending">Flagged</StatusPill>
                        ) : (
                          <StatusPill tone="neutral">Closed</StatusPill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No sessions yet"
              description="Start an attendance session from the scanning screen and it will appear here."
            />
          )}
        </Card>
      </div>
    </AppShell>
  )
}
