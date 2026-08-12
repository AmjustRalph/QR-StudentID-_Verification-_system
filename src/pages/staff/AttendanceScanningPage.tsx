import { useMemo, useState } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatTime } from '@/lib/format'
import type { CourseRecord } from '@/lib/database.types'
import { useQrScanner } from '@/features/scanning/useQrScanner'
import { ScannerViewport } from '@/features/scanning/ScannerViewport'
import { PhotoGlanceCard } from '@/features/scanning/PhotoGlanceCard'
import { verifyScannedCode, denialLabel } from '@/features/scanning/verifyScannedCode'
import { useAttendanceSession, type RosterEntry } from '@/features/attendance/useAttendanceSession'

function toGlanceStudent(entry: RosterEntry) {
  return {
    full_name: entry.fullName,
    student_id_number: entry.studentIdNumber,
    photo_url: entry.photoUrl,
  }
}

type LastScan =
  | { outcome: 'checking' }
  | { outcome: 'marked'; entry: RosterEntry }
  | { outcome: 'already_marked'; entry: RosterEntry }
  | { outcome: 'denied'; reason: string }
  | { outcome: 'error'; message: string }

function CoursePicker({ onSelect }: { onSelect: (course: CourseRecord) => void }) {
  const { profile } = useAuth()
  const courses = useAsync<CourseRecord[]>(async () => {
    if (!profile) return []
    const { data, error } = await supabase.from('courses').select('*').eq('lecturer_id', profile.id).order('code')
    if (error) throw error
    return data ?? []
  }, [profile?.id])

  return (
    <Card flush>
      <CardHeader title="Start Attendance Session" />
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
            <li key={course.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 last:border-0">
              <div className="min-w-0">
                <p className="font-semibold text-navy-900">{course.name}</p>
                <p className="data mt-0.5 text-xs text-ink-muted">{course.code}</p>
              </div>
              <Button size="sm" onClick={() => onSelect(course)} className="shrink-0">
                Select →
              </Button>
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
  )
}

function EndSessionPanel({
  scannedCount,
  onCancel,
  onConfirm,
}: {
  scannedCount: number
  onCancel: () => void
  onConfirm: (headcount: number) => Promise<void>
}) {
  const [value, setValue] = useState(String(scannedCount))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Enter a whole number.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(parsed)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not end the session.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 p-5">
      <p className="text-sm text-ink-muted">
        Scanned count for this session is <span className="data font-semibold text-navy-900">{scannedCount}</span>.
        Enter the headcount you actually counted in the room — if it doesn't match, the session is flagged for
        admin review, but still closes normally.
      </p>
      <Field
        label="Actual headcount"
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        error={error ?? undefined}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={() => void handleSubmit()} loading={submitting} fullWidth>
          Confirm & End Session
        </Button>
      </div>
    </div>
  )
}

function ScanningSession({ course, onExit }: { course: CourseRecord; onExit: () => void }) {
  const { profile } = useAuth()
  const lecturerId = profile!.id
  const { session, roster, loading, error, markPresent, endSession } = useAttendanceSession(course.id, lecturerId)

  const [lastScan, setLastScan] = useState<LastScan | null>(null)
  const [busy, setBusy] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [manualQuery, setManualQuery] = useState('')

  async function handleDecode(raw: string) {
    if (busy) return
    setBusy(true)
    setLastScan({ outcome: 'checking' })
    try {
      const result = await verifyScannedCode(raw)
      if (!result.valid) {
        setLastScan({ outcome: 'denied', reason: denialLabel(result.reason) })
        return
      }
      const scanSource = result.kind === 'live' ? 'digital_display' : 'physical_card'
      const outcome = await markPresent(result.student.id, scanSource)
      const entry: RosterEntry = {
        studentId: result.student.id,
        fullName: result.student.full_name,
        studentIdNumber: result.student.student_id_number,
        photoUrl: result.student.photo_url,
        status: result.student.status,
        presentAt: new Date().toISOString(),
        scanSource,
      }
      if (outcome.ok) {
        setLastScan({ outcome: 'marked', entry })
      } else if (outcome.alreadyMarked) {
        setLastScan({ outcome: 'already_marked', entry })
      } else {
        setLastScan({ outcome: 'error', message: outcome.message })
      }
    } catch (caught) {
      setLastScan({ outcome: 'error', message: caught instanceof Error ? caught.message : 'Verification failed.' })
    } finally {
      setBusy(false)
    }
  }

  const { videoRef, status, error: cameraError } = useQrScanner(
    (value) => void handleDecode(value),
    { paused: busy || endingSession || Boolean(session?.ended_at) },
  )

  const present = useMemo(() => roster.filter((r) => r.presentAt !== null).sort((a, b) => (b.presentAt ?? '').localeCompare(a.presentAt ?? '')), [roster])
  const absent = useMemo(() => roster.filter((r) => r.presentAt === null), [roster])
  const manualResults = useMemo(() => {
    const query = manualQuery.trim().toLowerCase()
    if (!query) return absent.slice(0, 6)
    return absent.filter(
      (r) => r.fullName.toLowerCase().includes(query) || r.studentIdNumber.toLowerCase().includes(query),
    )
  }, [absent, manualQuery])

  async function handleManualMark(studentId: string) {
    const outcome = await markPresent(studentId, 'manual')
    if (!outcome.ok && !outcome.alreadyMarked) {
      setLastScan({ outcome: 'error', message: outcome.message })
    }
  }

  if (loading) {
    return (
      <div className="grid h-64 place-items-center text-azure-600">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <Alert tone="denied" title="Could not start this session">
        {error ?? 'Unknown error.'}
      </Alert>
    )
  }

  if (session.ended_at) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="eyebrow text-verified-600">Session ended</p>
        <h2 className="mt-2 font-display text-xl font-bold text-navy-900">{course.name}</h2>
        <p className="data mt-2 text-sm text-ink-muted">
          Scanned {session.scanned_count} · Reported {session.reported_headcount}
        </p>
        {session.discrepancy_flag && (
          <Alert tone="pending" className="mt-4 text-left" title="Flagged for review">
            The scanned count did not match the reported headcount. An administrator will review this session.
          </Alert>
        )}
        <Button className="mt-5" onClick={onExit}>
          Back to Courses
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-navy-900 p-5 text-white shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{course.name} — Lecture</h2>
            <p className="data mt-1 text-xs text-azure-100/70">
              Session started {formatTime(session.started_at)} · Lect. {profile?.full_name}
            </p>
          </div>
          <StatusPill tone="verified" dot className="shrink-0">
            Scanning Active
          </StatusPill>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <ScannerViewport
            videoRef={videoRef}
            status={status}
            error={cameraError}
            caption="Present ID card or phone code to the scanner"
          />

          {lastScan && (
            <Card>
              {lastScan.outcome === 'checking' ? (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-ink-muted">
                  <Spinner className="h-4 w-4 text-azure-600" /> Checking code…
                </div>
              ) : lastScan.outcome === 'marked' ? (
                <PhotoGlanceCard
                  student={toGlanceStudent(lastScan.entry)}
                  pillLabel="Marked"
                  pillTone="verified"
                  meta={lastScan.entry.studentIdNumber}
                />
              ) : lastScan.outcome === 'already_marked' ? (
                <PhotoGlanceCard
                  student={toGlanceStudent(lastScan.entry)}
                  pillLabel="Already Marked"
                  pillTone="pending"
                />
              ) : lastScan.outcome === 'denied' ? (
                <p className="text-sm font-medium text-denied-600">{lastScan.reason}</p>
              ) : (
                <p className="text-sm font-medium text-denied-600">{lastScan.message}</p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card flush>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="eyebrow text-ink-muted">Scanned This Session</p>
              <p className="data font-display text-lg font-bold text-navy-900">
                {session.scanned_count} / {roster.length}
              </p>
            </div>
            {present.length > 0 ? (
              <ul>
                {present.slice(0, 8).map((entry) => (
                  <li key={entry.studentId} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0">
                    <p className="min-w-0 truncate font-medium text-navy-900">{entry.fullName}</p>
                    <p className="data shrink-0 text-xs text-ink-muted">
                      {entry.presentAt && formatTime(entry.presentAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-ink-muted">No scans yet.</p>
            )}
          </Card>

          <Card>
            <p className="eyebrow text-ink-muted">Mark Manually</p>
            <p className="mt-1 text-xs text-ink-muted">
              For a student with neither card nor phone. Logged separately as a manual mark.
            </p>
            <Field
              label="Search roster"
              placeholder="Search by name or student ID"
              value={manualQuery}
              onChange={(event) => setManualQuery(event.target.value)}
              className="mt-2"
            />
            <div className="mt-3 space-y-2">
              {manualResults.length === 0 ? (
                <p className="py-2 text-center text-xs text-ink-muted">
                  {absent.length === 0 ? 'Everyone enrolled has been marked present.' : 'No match.'}
                </p>
              ) : (
                manualResults.map((entry) => (
                  <div key={entry.studentId} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-900">{entry.fullName}</p>
                      <p className="data text-xs text-ink-muted">{entry.studentIdNumber}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleManualMark(entry.studentId)}
                      className="shrink-0"
                    >
                      Mark Present
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {endingSession ? (
            <Card flush>
              <EndSessionPanel
                scannedCount={session.scanned_count}
                onCancel={() => setEndingSession(false)}
                onConfirm={async (headcount) => {
                  await endSession(headcount)
                  setEndingSession(false)
                }}
              />
            </Card>
          ) : (
            <Button fullWidth size="lg" variant="danger" onClick={() => setEndingSession(true)}>
              End Session & Take Headcount
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AttendanceScanningPage() {
  const [course, setCourse] = useState<CourseRecord | null>(null)

  return (
    <AppShell title="Attendance Scanning">
      <PageHeading
        title={course ? course.name : 'Select a Course'}
        meta={course ? course.code : 'Choose which course you are taking attendance for'}
      />
      {course ? (
        <ScanningSession course={course} onExit={() => setCourse(null)} />
      ) : (
        <CoursePicker onSelect={setCourse} />
      )}
    </AppShell>
  )
}
