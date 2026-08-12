import { Link } from 'react-router-dom'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState, StatTile } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatDate, formatTime } from '@/lib/format'

type Overview = {
  students: number
  sessions: number
  verificationsToday: number
  flagged: number
  attendanceRate: number | null
}

type FlaggedSession = {
  id: string
  started_at: string
  scanned_count: number
  reported_headcount: number | null
  course: { code: string; name: string } | null
}

/** `head: true` asks Postgres for the count only — no rows cross the wire. */
async function readCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

export function AdminDashboardPage() {
  const overview = useAsync<Overview>(async () => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [students, sessions, verificationsToday, flagged] = await Promise.all([
      readCount(
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
      ),
      readCount(supabase.from('attendance_sessions').select('*', { count: 'exact', head: true })),
      readCount(
        supabase
          .from('verification_logs')
          .select('*', { count: 'exact', head: true })
          .gte('verified_at', startOfToday.toISOString()),
      ),
      readCount(
        supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('discrepancy_flag', true)
          .eq('discrepancy_resolved', false),
      ),
    ])

    // Attendance rate needs closed sessions with a headcount to compare against;
    // until any exist it stays null rather than showing a misleading 0%.
    const { data: closed, error } = await supabase
      .from('attendance_sessions')
      .select('scanned_count, reported_headcount')
      .not('reported_headcount', 'is', null)
      .limit(500)
    if (error) throw error

    const totals = (closed ?? []).reduce(
      (acc, row) => ({
        scanned: acc.scanned + row.scanned_count,
        expected: acc.expected + (row.reported_headcount ?? 0),
      }),
      { scanned: 0, expected: 0 },
    )

    return {
      students,
      sessions,
      verificationsToday,
      flagged,
      attendanceRate: totals.expected > 0 ? (totals.scanned / totals.expected) * 100 : null,
    }
  }, [])

  const flaggedSessions = useAsync<FlaggedSession[]>(async () => {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('id, started_at, scanned_count, reported_headcount, course:courses(code, name)')
      .eq('discrepancy_flag', true)
      .eq('discrepancy_resolved', false)
      .order('started_at', { ascending: false })
      .limit(5)
    if (error) throw error
    return (data ?? []) as unknown as FlaggedSession[]
  }, [])

  const stats = overview.data

  return (
    <AppShell title="Administrator Dashboard">
      <PageHeading title="System Overview" meta="Live counts from Supabase" />

      {overview.error && (
        <Alert tone="denied" title="Could not load the overview" className="mb-6">
          {overview.error}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Registered Students"
          value={overview.loading ? '—' : (stats?.students ?? 0).toLocaleString()}
          caption="active accounts"
        />
        <StatTile
          label="Attendance Rate"
          value={
            overview.loading
              ? '—'
              : stats?.attendanceRate === null || stats?.attendanceRate === undefined
                ? 'n/a'
                : `${stats.attendanceRate.toFixed(1)}%`
          }
          caption={`across ${stats?.sessions ?? 0} sessions`}
          tone="verified"
        />
        <StatTile
          label="Exam Verifications Today"
          value={overview.loading ? '—' : (stats?.verificationsToday ?? 0).toLocaleString()}
          caption="logged since midnight"
        />
        <StatTile
          label="Headcount Discrepancies"
          value={overview.loading ? '—' : (stats?.flagged ?? 0).toLocaleString()}
          caption="flagged for review"
          tone="pending"
        />
      </div>

      {!overview.loading && (stats?.flagged ?? 0) > 0 && (
        <Alert
          tone="pending"
          className="mt-5"
          title={`${stats?.flagged} session${stats?.flagged === 1 ? '' : 's'} flagged — scanned count did not match reported headcount`}
          action={
            <Link
              to="/admin/reports"
              className="shrink-0 rounded-lg border border-line-strong bg-surface px-3 py-2 font-display text-sm font-semibold text-azure-600 hover:bg-canvas"
            >
              Review Flags
            </Link>
          }
        />
      )}

      <div className="mt-6">
        <Card flush>
          <CardHeader title="Flagged Sessions" />
          {flaggedSessions.loading ? (
            <div className="grid h-40 place-items-center text-azure-600">
              <Spinner className="h-5 w-5" />
            </div>
          ) : flaggedSessions.error ? (
            <div className="p-5">
              <Alert tone="denied">{flaggedSessions.error}</Alert>
            </div>
          ) : flaggedSessions.data && flaggedSessions.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-md text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="eyebrow px-5 py-3 text-ink-muted">Course</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">Session</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">Scanned</th>
                    <th className="eyebrow px-5 py-3 text-ink-muted">Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedSessions.data.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium text-navy-900">
                        {row.course?.name ?? '—'}
                      </td>
                      <td className="data px-5 py-3 text-ink-muted">
                        {formatDate(row.started_at)} {formatTime(row.started_at)}
                      </td>
                      <td className="data px-5 py-3 text-ink-muted">{row.scanned_count}</td>
                      <td className="data px-5 py-3 text-pending-700">
                        {row.reported_headcount ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nothing flagged"
              description="Sessions where the lecturer's headcount disagrees with the scanned count will be listed here for review."
            />
          )}
        </Card>
      </div>
    </AppShell>
  )
}
