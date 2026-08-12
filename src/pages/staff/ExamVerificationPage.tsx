import { useState } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill, type PillTone } from '@/components/ui/StatusPill'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatClockTime, formatCompactDate, formatTime } from '@/lib/format'
import { useQrScanner } from '@/features/scanning/useQrScanner'
import { ScannerViewport } from '@/features/scanning/ScannerViewport'
import { PhotoGlanceCard } from '@/features/scanning/PhotoGlanceCard'
import { denialLabel } from '@/features/scanning/verifyScannedCode'
import { checkExamEligibility, type EligibilityResult } from '@/features/verification/checkExamEligibility'

type Examination = {
  id: string
  exam_date: string
  exam_time: string
  venue: string
  course: { code: string; name: string } | null
}

type LogEntry = {
  id: string
  label: string
  studentIdNumber: string | null
  outcome: 'granted' | 'denied'
  reasonLabel: string | null
  verifiedAt: string
}

function ExaminationPicker({ onSelect }: { onSelect: (exam: Examination) => void }) {
  const exams = useAsync<Examination[]>(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('examinations')
      .select('id, exam_date, exam_time, venue, course:courses(code, name)')
      .gte('exam_date', today)
      .order('exam_date', { ascending: true })
      .limit(20)
    if (error) throw error
    return (data ?? []) as unknown as Examination[]
  }, [])

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
                <p className="font-semibold text-navy-900">{exam.course?.name ?? 'Examination'}</p>
                <p className="data mt-0.5 text-xs text-ink-muted">
                  {formatCompactDate(exam.exam_date)} · {formatClockTime(exam.exam_time)} · {exam.venue}
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
          title="No examinations scheduled"
          description="An administrator needs to schedule an examination before you can run verification."
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

function VerificationSession({ exam, onExit }: { exam: Examination; onExit: () => void }) {
  const { profile } = useAuth()
  const invigilatorId = profile!.id

  const [result, setResult] = useState<EligibilityResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])

  async function handleDecode(raw: string) {
    if (busy) return
    setBusy(true)
    try {
      const outcome = await checkExamEligibility(raw, exam.id)
      setResult(outcome)

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
    } finally {
      setBusy(false)
    }
  }

  const { videoRef, status, error: cameraError } = useQrScanner((value) => void handleDecode(value), {
    paused: busy,
  })

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-navy-900 p-5 text-white shadow-panel">
        <h2 className="font-display text-lg font-bold">{exam.course?.name ?? 'Examination'}</h2>
        <p className="data mt-1 text-xs text-azure-100/70">
          {exam.venue} · Invig. {profile?.full_name}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <CheckChip label="QR Valid" state={result?.checks.qrValid ?? null} />
        <CheckChip label="Registered" state={result?.checks.registered ?? null} />
        <CheckChip label="Cleared" state={result?.checks.cleared ?? null} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <ScannerViewport videoRef={videoRef} status={status} error={cameraError} caption="Present ID card or phone code" />

          {busy && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-ink-muted">
              <Spinner className="h-4 w-4 text-azure-600" /> Checking eligibility…
            </div>
          )}

          {result && !busy && (
            <Card>
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
              {log.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{entry.label}</p>
                    <p className="data text-xs text-ink-muted">
                      {entry.studentIdNumber ?? `Scan ${formatTime(entry.verifiedAt)}`}
                    </p>
                  </div>
                  <StatusPill
                    tone={entry.outcome === 'granted' ? 'verified' : entry.reasonLabel === denialLabel('pending_fees') ? 'pending' : 'denied'}
                    className="shrink-0"
                  >
                    {entry.outcome === 'granted' ? 'Granted' : entry.reasonLabel === denialLabel('pending_fees') ? 'Clearance Due' : 'Denied'}
                  </StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">No scans yet this session.</p>
          )}
        </Card>
      </div>

      <Button variant="secondary" onClick={onExit}>
        ← Back to Examinations
      </Button>
    </div>
  )
}

export function ExamVerificationPage() {
  const [exam, setExam] = useState<Examination | null>(null)

  return (
    <AppShell title="Examination Verification">
      <PageHeading
        title={exam ? exam.course?.name ?? 'Examination' : 'Select an Examination'}
        meta={exam ? `${exam.venue} · ${formatCompactDate(exam.exam_date)}` : 'Choose which examination you are invigilating'}
      />
      {exam ? <VerificationSession exam={exam} onExit={() => setExam(null)} /> : <ExaminationPicker onSelect={setExam} />}
    </AppShell>
  )
}
