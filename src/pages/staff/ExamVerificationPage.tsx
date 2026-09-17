import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, SelectField } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill, type PillTone } from '@/components/ui/StatusPill'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/cn'
import { supabase, friendlyError } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { useOnlineStatus } from '@/lib/useOnlineStatus'
import { useOfflineQueue } from '@/lib/useOfflineQueue'
import { isNetworkError } from '@/lib/isNetworkError'
import { formatClockTime, formatCompactDate, formatTime } from '@/lib/format'
import { useQrScanner } from '@/features/scanning/useQrScanner'
import { ScannerViewport } from '@/features/scanning/ScannerViewport'
import { PhotoGlanceCard } from '@/features/scanning/PhotoGlanceCard'
import { denialLabel, type ScannedStudent } from '@/features/scanning/verifyScannedCode'
import { checkExamEligibility, type EligibilityResult } from '@/features/verification/checkExamEligibility'
import { SESSION_PERIOD_LABEL, SESSION_PERIOD_OPTIONS } from '@/lib/sessionPeriod'
import { useFeedbackSound } from '@/lib/useFeedbackSound'
import type { ClearanceStatus, CourseRecord, ExaminationKind, SessionPeriod, StudentStatus } from '@/lib/database.types'

type Examination = {
  id: string
  exam_date: string
  exam_time: string
  /** Set by the invigilator when they start verifying, not admin at scheduling time. */
  venue: string | null
  session_period: SessionPeriod | null
  /** 'exam' (admin-scheduled, full registration+clearance flow) vs a
   * lecturer-scheduled 'quiz'/'test' (identity-only, no admin needed). */
  kind: ExaminationKind
  course: { id: string; code: string; name: string } | null
}

type LogEntry = {
  id: string
  label: string
  studentIdNumber: string | null
  outcome: 'granted' | 'denied'
  reasonLabel: string | null
  verifiedAt: string
  pendingSync?: boolean
}

/** The exam roster, cached client-side while online so identity + clearance
 * lookups keep working offline (spec §4.6 checks b and c need this data —
 * check a, cryptographic QR validity, cannot be done offline at all, since
 * the signing seed deliberately never leaves the server). */
type CachedStudent = {
  id: string
  full_name: string
  student_id_number: string
  photo_url: string | null
  programme: string | null
  level: number | null
  status: StudentStatus
  isRegistered: boolean
  clearance: ClearanceStatus | null
}

type QueuedDecision = {
  studentId: string
  fullName: string
  studentIdNumber: string
  outcome: 'granted' | 'denied'
  reason: string | null
}

const KIND_LABEL: Record<ExaminationKind, string> = { exam: 'Exam', quiz: 'Quiz', test: 'Test' }
const KIND_TONE: Record<ExaminationKind, PillTone> = { exam: 'azure', quiz: 'verified', test: 'pending' }

function venueLabel(exam: Pick<Examination, 'venue' | 'session_period'>): string {
  const period = exam.session_period ? `${SESSION_PERIOD_LABEL[exam.session_period]} · ` : ''
  return exam.venue ? `${period}${exam.venue}` : `${period}Classroom not yet set`
}

function ScheduleQuizForm({ onCreated }: { onCreated: () => void }) {
  const { profile } = useAuth()
  const userId = profile?.id ?? null

  const courses = useAsync<CourseRecord[]>(async () => {
    if (!userId) return []
    const { data, error } = await supabase.from('courses').select('*').eq('lecturer_id', userId).order('code')
    if (error) throw error
    return data ?? []
  }, [userId])

  const [courseId, setCourseId] = useState('')
  const [examDate, setExamDate] = useState('')
  const [examTime, setExamTime] = useState('09:00')
  const [kind, setKind] = useState<'quiz' | 'test'>('quiz')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!courseId || !examDate || !examTime) {
      setError('Fill in course, date and time.')
      return
    }
    setSubmitting(true)
    const { error: insertError } = await supabase.from('examinations').insert({
      course_id: courseId,
      exam_date: examDate,
      exam_time: examTime,
      // Same as a formal exam: the room gets set at verification time, not here.
      venue: null,
      session_period: null,
      kind,
      semester: null,
      eligibility_criteria: null,
    })
    setSubmitting(false)
    if (insertError) {
      setError(friendlyError(insertError))
      return
    }
    setCourseId('')
    setExamDate('')
    onCreated()
  }

  return (
    <Card>
      <p className="eyebrow text-ink-muted">Schedule Quiz / Test</p>
      <p className="mt-1 text-xs text-ink-muted">
        For one of your own courses — no admin needed. Students just scan in, either code works, and there's no
        registration or clearance check.
      </p>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {error && <Alert tone="denied">{error}</Alert>}

        <SelectField label="Course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
          <option value="">Select one of your courses</option>
          {courses.data?.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} — {course.name}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
          <Field label="Time" type="time" value={examTime} onChange={(event) => setExamTime(event.target.value)} />
        </div>

        <Segmented
          label="Type"
          options={[
            { value: 'quiz', label: 'Quiz' },
            { value: 'test', label: 'Test' },
          ]}
          value={kind}
          onChange={setKind}
        />

        <Button type="submit" fullWidth loading={submitting}>
          Schedule →
        </Button>
      </form>
    </Card>
  )
}

function ExaminationPicker({
  exams,
  onSelect,
}: {
  exams: ReturnType<typeof useAsync<Examination[]>>
  onSelect: (exam: Examination) => void
}) {
  return (
    <Card flush>
      <CardHeader title="Select an Examination" />
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
          {exams.data.map((exam) => (
            <li key={exam.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-navy-900">{exam.course?.name ?? 'Examination'}</p>
                  <StatusPill tone={KIND_TONE[exam.kind]} className="shrink-0">
                    {KIND_LABEL[exam.kind]}
                  </StatusPill>
                </div>
                <p className="data mt-0.5 text-xs text-ink-muted">
                  {formatCompactDate(exam.exam_date)} · {formatClockTime(exam.exam_time)} · {venueLabel(exam)}
                </p>
              </div>
              <Button size="sm" onClick={() => onSelect(exam)} className="shrink-0">
                Select →
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing scheduled"
          description="An administrator schedules formal exams — or schedule your own quiz or test on the left."
        />
      )}
    </Card>
  )
}

function CheckChip({ label, state }: { label: string; state: boolean | null }) {
  const tone: PillTone = state === null ? 'neutral' : state ? 'verified' : 'denied'
  return (
    <StatusPill tone={tone} dot>
      {label}
    </StatusPill>
  )
}

/** Same registration/clearance logic as checkExamEligibility's checks (b) and
 * (c), just sourced from the cached roster instead of a live query. Check (a)
 * is reported as null (not evaluated) rather than true — offline, identity is
 * established by the invigilator visually matching the physical card, not by
 * verifying a signature. A quiz/test skips (b) and (c) entirely — any
 * enrolled student in the roster qualifies. */
function evaluateFromCache(student: CachedStudent, kind: ExaminationKind): EligibilityResult {
  const scanned: ScannedStudent = {
    id: student.id,
    full_name: student.full_name,
    student_id_number: student.student_id_number,
    programme: student.programme,
    level: student.level,
    photo_url: student.photo_url,
    status: student.status,
  }

  if (kind !== 'exam') {
    return { outcome: 'granted', student: scanned, checks: { qrValid: null, registered: null, cleared: null } }
  }

  if (!student.isRegistered) {
    return { outcome: 'denied', reason: 'not_registered', student: scanned, checks: { qrValid: null, registered: false, cleared: null } }
  }
  if (student.clearance !== 'cleared') {
    return {
      outcome: 'denied',
      reason: student.clearance ?? 'not_registered',
      student: scanned,
      checks: { qrValid: null, registered: true, cleared: false },
    }
  }
  return { outcome: 'granted', student: scanned, checks: { qrValid: null, registered: true, cleared: true } }
}

function useExamRoster(examId: string, courseId: string | undefined) {
  const storageKey = `qrsidvs:exam-roster:${examId}`
  const [data, setData] = useState<CachedStudent[] | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as CachedStudent[]) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(data === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    let active = true
    setLoading((current) => current || data === null)

    type EnrolledRow = { student: Omit<CachedStudent, 'isRegistered' | 'clearance'> | null }

    ;(async () => {
      try {
        const [enrolledResult, registrationsResult] = await Promise.all([
          supabase
            .from('enrollments')
            .select('student:students(id, full_name, student_id_number, photo_url, programme, level, status)')
            .eq('course_id', courseId),
          supabase
            .from('exam_registrations')
            .select('student_id, is_registered, clearance_status')
            .eq('examination_id', examId),
        ])
        if (enrolledResult.error) throw enrolledResult.error
        if (registrationsResult.error) throw registrationsResult.error
        if (!active) return

        const byStudent = new Map(registrationsResult.data?.map((r) => [r.student_id, r]))
        const rows: CachedStudent[] = ((enrolledResult.data ?? []) as unknown as EnrolledRow[])
          .map((row) => row.student)
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
          .map((s) => {
            const reg = byStudent.get(s.id)
            return { ...s, isRegistered: reg?.is_registered ?? false, clearance: reg?.clearance_status ?? null }
          })

        setData(rows)
        setLoading(false)
        try {
          localStorage.setItem(storageKey, JSON.stringify(rows))
        } catch {
          // Best-effort cache — offline lookup just won't survive a reload if this fails.
        }
      } catch (caught) {
        if (!active) return
        setLoading(false)
        // A cached copy (from localStorage, or an earlier successful fetch)
        // is still good to work from — only surface an error with nothing to fall back on.
        if (!data) setError(caught instanceof Error ? caught.message : 'Could not load the roster.')
      }
    })()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, courseId])

  return { data, loading, error }
}

function StartVerificationForm({
  courseName,
  onStart,
}: {
  courseName: string
  onStart: (venue: string, period: SessionPeriod) => Promise<void>
}) {
  const [venue, setVenue] = useState('')
  const [period, setPeriod] = useState<SessionPeriod>('morning')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!venue.trim()) {
      setError('Enter the classroom name.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onStart(venue.trim(), period)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start verification.')
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <p className="eyebrow text-ink-muted">Start Exam Verification</p>
      <h2 className="mt-1 font-display text-lg font-bold text-navy-900">{courseName}</h2>
      <p className="mt-1 text-xs text-ink-muted">You're the invigilator in the room — set where and when this is happening.</p>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {error && <Alert tone="denied">{error}</Alert>}
        <Field
          label="Classroom / Venue"
          placeholder="e.g. Hall C"
          value={venue}
          onChange={(event) => setVenue(event.target.value)}
        />
        <Segmented label="Session" options={SESSION_PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <Button type="submit" fullWidth loading={submitting}>
          Start Verification →
        </Button>
      </form>
    </Card>
  )
}

function VerificationSession({ exam: initialExam, onExit }: { exam: Examination; onExit: () => void }) {
  const { profile } = useAuth()
  const invigilatorId = profile!.id
  const online = useOnlineStatus()
  const [exam, setExam] = useState(initialExam)
  const [sessionEnded, setSessionEnded] = useState(false)
  const needsClassroomSetup = !exam.venue || !exam.session_period
  const isFormalExam = exam.kind === 'exam'

  const roster = useExamRoster(exam.id, exam.course?.id)
  const queue = useOfflineQueue<QueuedDecision>(`qrsidvs:offline-verifications:${exam.id}`)

  const [result, setResult] = useState<EligibilityResult | null>(null)
  const [resultNonce, setResultNonce] = useState(0)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [idQuery, setIdQuery] = useState('')
  const { playGranted, playDenied } = useFeedbackSound()

  async function handleStartVerification(venue: string, period: SessionPeriod) {
    const { data, error } = await supabase
      .from('examinations')
      .update({ venue, session_period: period })
      .eq('id', exam.id)
      .select('id, exam_date, exam_time, venue, session_period, kind, course:courses(id, code, name)')
      .single()
    if (error) throw error
    setExam(data as unknown as Examination)
  }

  async function handleDecode(raw: string) {
    if (busy) return
    setBusy(true)
    try {
      const outcome = await checkExamEligibility(raw, exam.id, exam.kind)
      setResult(outcome)
      setResultNonce((n) => n + 1)
      if (outcome.outcome === 'granted') playGranted()
      else playDenied()

      const { error } = await supabase.from('verification_logs').insert({
        examination_id: exam.id,
        invigilator_id: invigilatorId,
        student_id: outcome.student?.id ?? null,
        outcome: outcome.outcome,
        denial_reason: outcome.outcome === 'denied' ? denialLabel(outcome.reason ?? '') : null,
      })
      if (error) throw error

      setLog((previous) =>
        [
          {
            id: crypto.randomUUID(),
            label: outcome.student?.full_name ?? 'Unregistered Code',
            studentIdNumber: outcome.student?.student_id_number ?? null,
            outcome: outcome.outcome,
            reasonLabel: outcome.outcome === 'denied' ? denialLabel(outcome.reason ?? '') : null,
            verifiedAt: new Date().toISOString(),
          },
          ...previous,
        ].slice(0, 20),
      )
    } catch (caught) {
      setResult({
        outcome: 'denied',
        reason: caught instanceof Error ? caught.message : 'Verification failed.',
        checks: { qrValid: false, registered: null, cleared: null },
      })
      setResultNonce((n) => n + 1)
      playDenied()
    } finally {
      setBusy(false)
    }
  }

  const { videoRef, status, error: cameraError } = useQrScanner((value) => void handleDecode(value), {
    paused: busy || !online || sessionEnded,
    // The scanner view only renders once the invigilator has set the
    // classroom — see the needsClassroomSetup early return below. Acquiring
    // the camera any earlier attaches the stream to a <video> that isn't
    // mounted yet, and it never gets retried.
    enabled: !needsClassroomSetup && !sessionEnded,
  })

  function handleOfflineDecision(student: CachedStudent) {
    const evaluated = evaluateFromCache(student, exam.kind)
    const queueId = queue.enqueue({
      studentId: student.id,
      fullName: student.full_name,
      studentIdNumber: student.student_id_number,
      outcome: evaluated.outcome,
      reason: evaluated.reason ?? null,
    })
    setResult(evaluated)
    setResultNonce((n) => n + 1)
    if (evaluated.outcome === 'granted') playGranted()
    else playDenied()
    setLog((previous) =>
      [
        {
          id: queueId,
          label: student.full_name,
          studentIdNumber: student.student_id_number,
          outcome: evaluated.outcome,
          reasonLabel: evaluated.reason ? denialLabel(evaluated.reason) : null,
          verifiedAt: new Date().toISOString(),
          pendingSync: true,
        },
        ...previous,
      ].slice(0, 20),
    )
    setIdQuery('')
  }

  async function syncQueue() {
    if (syncing) return
    setSyncing(true)
    for (const entry of queue.entries) {
      try {
        const { error } = await supabase.from('verification_logs').insert({
          examination_id: exam.id,
          invigilator_id: invigilatorId,
          student_id: entry.payload.studentId,
          outcome: entry.payload.outcome,
          denial_reason: entry.payload.outcome === 'denied' ? denialLabel(entry.payload.reason ?? '') : null,
        })
        if (error) throw error
        queue.remove(entry.id)
        setLog((previous) => previous.map((row) => (row.id === entry.id ? { ...row, pendingSync: false } : row)))
      } catch (caught) {
        if (isNetworkError(caught)) break // still offline — stop and retry later
        break // a real failure; leave it queued rather than silently drop an access record
      }
    }
    setSyncing(false)
  }

  const previousOnline = useRef(online)
  useEffect(() => {
    if (online && queue.entries.length > 0) void syncQueue()
    previousOnline.current = online
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const matches = useMemo(() => {
    const needle = idQuery.trim().toLowerCase()
    if (!needle || !roster.data) return []
    return roster.data
      .filter((s) => s.student_id_number.toLowerCase().includes(needle) || s.full_name.toLowerCase().includes(needle))
      .slice(0, 6)
  }, [roster.data, idQuery])

  if (needsClassroomSetup) {
    return <StartVerificationForm courseName={exam.course?.name ?? 'Examination'} onStart={handleStartVerification} />
  }

  if (sessionEnded) {
    const grantedCount = log.filter((entry) => entry.outcome === 'granted').length
    const deniedCount = log.filter((entry) => entry.outcome === 'denied').length
    return (
      <Card className="mx-auto max-w-md animate-pop-in text-center">
        <StatusPill tone="neutral">Session Ended</StatusPill>
        <h2 className="mt-3 font-display text-lg font-bold text-navy-900">{exam.course?.name ?? 'Examination'}</h2>
        <p className="mt-1 text-sm text-ink-muted">{venueLabel(exam)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-verified-50 p-4">
            <p className="font-display text-2xl font-bold text-verified-700">{grantedCount}</p>
            <p className="eyebrow mt-1 text-verified-700">Granted</p>
          </div>
          <div className="rounded-lg bg-denied-50 p-4">
            <p className="font-display text-2xl font-bold text-denied-700">{deniedCount}</p>
            <p className="eyebrow mt-1 text-denied-700">Denied</p>
          </div>
        </div>
        <Button className="mt-6" fullWidth onClick={onExit}>
          Return to Examinations →
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-navy-900 p-5 text-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold">{exam.course?.name ?? 'Examination'}</h2>
          <StatusPill tone={KIND_TONE[exam.kind]} className="shrink-0">
            {KIND_LABEL[exam.kind]}
          </StatusPill>
          <StatusPill tone="verified" dot pulse className="shrink-0">
            Verifying
          </StatusPill>
        </div>
        <p className="data mt-1 text-xs text-azure-100/70">
          {venueLabel(exam)} · Invig. {profile?.full_name}
        </p>
      </div>

      {!online && (
        <Alert tone="pending" title="You're offline">
          Verifications are being saved on this device and will sync automatically once your connection returns.
        </Alert>
      )}

      {queue.entries.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink-muted">
            <span className="data font-semibold text-navy-900">{queue.entries.length}</span> verification
            {queue.entries.length === 1 ? '' : 's'} waiting to sync
          </p>
          <Button size="sm" variant="secondary" loading={syncing} disabled={!online} onClick={() => void syncQueue()}>
            Sync Now
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <CheckChip label={online ? 'QR Valid' : 'ID Lookup'} state={result?.checks.qrValid ?? null} />
        {isFormalExam && (
          <>
            <CheckChip label="Registered" state={result?.checks.registered ?? null} />
            <CheckChip label="Cleared" state={result?.checks.cleared ?? null} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          {online ? (
            <ScannerViewport
              videoRef={videoRef}
              status={status}
              error={cameraError}
              caption={isFormalExam ? 'Present physical ID card' : 'Present ID card or phone code'}
            />
          ) : (
            <Card>
              <p className="eyebrow text-pending-600">Offline — verify by Student ID</p>
              <p className="mt-1 text-xs text-ink-muted">
                Confirm the physical card matches the person in front of you, then look them up below. The
                decision is based on the roster as of your last connection.
              </p>
              <Field
                label="Student ID or name"
                placeholder="Search the exam roster"
                value={idQuery}
                onChange={(event) => setIdQuery(event.target.value)}
                className="mt-3"
              />
              {roster.loading ? (
                <div className="mt-3 flex justify-center">
                  <Spinner className="h-4 w-4 text-azure-600" />
                </div>
              ) : roster.error && !roster.data ? (
                <Alert tone="denied" className="mt-3">
                  No cached roster available for this exam — connect once before going offline.
                </Alert>
              ) : matches.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {matches.map((student) => {
                    const willGrant = !isFormalExam || (student.isRegistered && student.clearance === 'cleared')
                    return (
                      <button
                        key={student.id}
                        onClick={() => handleOfflineDecision(student)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-left hover:bg-canvas"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy-900">{student.full_name}</p>
                          <p className="data text-xs text-ink-muted">{student.student_id_number}</p>
                        </div>
                        <StatusPill tone={willGrant ? 'verified' : 'denied'} className="shrink-0">
                          {willGrant ? 'Will Grant' : 'Will Deny'}
                        </StatusPill>
                      </button>
                    )
                  })}
                </div>
              ) : idQuery.trim() ? (
                <p className="mt-3 text-center text-xs text-ink-muted">No match in the cached roster.</p>
              ) : null}
            </Card>
          )}

          {busy && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-ink-muted">
              <Spinner className="h-4 w-4 text-azure-600" /> Checking eligibility…
            </div>
          )}

          {result && !busy && (
            <Card key={resultNonce} className="animate-pop-in">
              {result.student ? (
                <PhotoGlanceCard
                  size="lg"
                  student={result.student}
                  pillLabel={result.outcome === 'granted' ? 'Access Granted' : 'Access Denied'}
                  pillTone={result.outcome === 'granted' ? 'verified' : 'denied'}
                  meta={
                    result.student.programme
                      ? `${result.student.programme}${result.student.level ? ` · Level ${result.student.level}` : ''}`
                      : undefined
                  }
                />
              ) : (
                <div className="py-4 text-center">
                  <StatusPill tone="denied">Access Denied</StatusPill>
                  <p className="mt-2 text-sm text-ink-muted">{denialLabel(result.reason ?? '')}</p>
                </div>
              )}
              {result.student && result.outcome === 'denied' && (
                <p className="mt-3 text-center text-sm font-medium text-denied-600">
                  {denialLabel(result.reason ?? '')}
                </p>
              )}
            </Card>
          )}
        </div>

        <Card flush>
          <CardHeader title="Session Verification Log" />
          {log.length > 0 ? (
            <ul>
              {log.map((entry, index) => (
                <li
                  key={entry.id}
                  className={cn(
                    'flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0',
                    index === 0 && 'animate-row-in',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{entry.label}</p>
                    <p className="data text-xs text-ink-muted">
                      {entry.studentIdNumber ?? `Scan ${formatTime(entry.verifiedAt)}`}
                      {entry.pendingSync && ' · Pending sync'}
                    </p>
                  </div>
                  <StatusPill
                    tone={
                      entry.pendingSync
                        ? 'pending'
                        : entry.outcome === 'granted'
                          ? 'verified'
                          : entry.reasonLabel === denialLabel('pending_fees')
                            ? 'pending'
                            : 'denied'
                    }
                    className="shrink-0"
                  >
                    {entry.pendingSync
                      ? 'Queued'
                      : entry.outcome === 'granted'
                        ? 'Granted'
                        : entry.reasonLabel === denialLabel('pending_fees')
                          ? 'Clearance Due'
                          : 'Denied'}
                  </StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">No scans yet this session.</p>
          )}
        </Card>
      </div>

      <Button variant="secondary" onClick={() => setSessionEnded(true)}>
        End Session
      </Button>
    </div>
  )
}

export function ExamVerificationPage() {
  const [exam, setExam] = useState<Examination | null>(null)

  const exams = useAsync<Examination[]>(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('examinations')
      .select('id, exam_date, exam_time, venue, session_period, kind, course:courses(id, code, name)')
      .gte('exam_date', today)
      .order('exam_date', { ascending: true })
      .limit(20)
    if (error) throw error
    return (data ?? []) as unknown as Examination[]
  }, [])

  return (
    <AppShell title="Examination Verification">
      <PageHeading
        title={exam ? exam.course?.name ?? 'Examination' : 'Select an Examination'}
        meta={exam ? formatCompactDate(exam.exam_date) : 'Choose or schedule what you are invigilating'}
      />
      {exam ? (
        <VerificationSession exam={exam} onExit={() => setExam(null)} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <ScheduleQuizForm onCreated={() => exams.reload()} />
          <ExaminationPicker exams={exams} onSelect={setExam} />
        </div>
      )}
    </AppShell>
  )
}
