import { useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, SelectField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { supabase, friendlyError } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { formatClockTime, formatCompactDate } from '@/lib/format'
import { SESSION_PERIOD_LABEL } from '@/lib/sessionPeriod'
import { useAllCourses } from '@/features/admin/useAllCourses'
import { useExaminations, type ExaminationRow } from '@/features/admin/useExaminations'
import { CLEARANCE_PILL } from '@/features/student/clearance'
import type { ClearanceStatus } from '@/lib/database.types'

function NewExaminationForm({ onCreated }: { onCreated: () => void }) {
  const courses = useAllCourses()
  const [courseId, setCourseId] = useState('')
  const [examDate, setExamDate] = useState('')
  const [examTime, setExamTime] = useState('09:00')
  const [semester, setSemester] = useState('')
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
      // The invigilator sets these when they start verifying (spec follow-up)
      // — they're the one actually in the room, not admin at scheduling time.
      venue: null,
      session_period: null,
      semester: semester.trim() || null,
      eligibility_criteria: null,
    })
    setSubmitting(false)
    if (insertError) {
      setError(friendlyError(insertError))
      return
    }
    setCourseId('')
    setExamDate('')
    setSemester('')
    onCreated()
  }

  return (
    <Card>
      <p className="eyebrow text-ink-muted">Schedule Examination</p>
      <p className="mt-1 text-xs text-ink-muted">
        The classroom and morning/evening session are set by the invigilator when they start verifying.
      </p>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {error && <Alert tone="denied">{error}</Alert>}

        <SelectField label="Course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
          <option value="">Select a course</option>
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

        <Field
          label="Semester"
          placeholder="Semester 2, 2025/2026"
          value={semester}
          onChange={(event) => setSemester(event.target.value)}
        />

        <Button type="submit" fullWidth loading={submitting}>
          Schedule Examination →
        </Button>
      </form>
    </Card>
  )
}

type RegistrationRow = {
  studentId: string
  fullName: string
  studentIdNumber: string
  isRegistered: boolean
  clearance: ClearanceStatus
}

function RegistrationsPanel({ exam, onExit }: { exam: ExaminationRow; onExit: () => void }) {
  const roster = useAsync<RegistrationRow[]>(async () => {
    if (!exam.course) return []
    const [enrolledResult, registrationsResult] = await Promise.all([
      supabase
        .from('enrollments')
        .select('student:students(id, full_name, student_id_number)')
        .eq('course_id', exam.course.id),
      supabase
        .from('exam_registrations')
        .select('student_id, is_registered, clearance_status')
        .eq('examination_id', exam.id),
    ])
    if (enrolledResult.error) throw enrolledResult.error
    if (registrationsResult.error) throw registrationsResult.error

    const byStudent = new Map(registrationsResult.data?.map((r) => [r.student_id, r]))
    return ((enrolledResult.data ?? []) as unknown as { student: { id: string; full_name: string; student_id_number: string } | null }[])
      .map((row) => row.student)
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => {
        const reg = byStudent.get(s.id)
        return {
          studentId: s.id,
          fullName: s.full_name,
          studentIdNumber: s.student_id_number,
          isRegistered: reg?.is_registered ?? false,
          clearance: reg?.clearance_status ?? 'pending_fees',
        }
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [exam.id, exam.course?.id])

  const [busyStudentId, setBusyStudentId] = useState<string | null>(null)
  const [registeringAll, setRegisteringAll] = useState(false)

  async function upsertRegistration(studentId: string, patch: Partial<{ is_registered: boolean; clearance_status: ClearanceStatus }>) {
    setBusyStudentId(studentId)
    await supabase.from('exam_registrations').upsert(
      { examination_id: exam.id, student_id: studentId, ...patch },
      { onConflict: 'examination_id,student_id' },
    )
    setBusyStudentId(null)
    roster.reload()
  }

  async function registerAllEnrolled() {
    if (!roster.data) return
    setRegisteringAll(true)
    const rows = roster.data
      .filter((row) => !row.isRegistered)
      .map((row) => ({
        examination_id: exam.id,
        student_id: row.studentId,
        is_registered: true,
        clearance_status: row.clearance,
      }))
    if (rows.length > 0) {
      await supabase.from('exam_registrations').upsert(rows, { onConflict: 'examination_id,student_id' })
    }
    setRegisteringAll(false)
    roster.reload()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-navy-900 p-5 text-white shadow-panel">
        <h2 className="font-display text-lg font-bold">{exam.course?.name ?? 'Examination'}</h2>
        <p className="data mt-1 text-xs text-azure-100/70">
          {formatCompactDate(exam.exam_date)} · {formatClockTime(exam.exam_time)}
          {exam.session_period && ` · ${SESSION_PERIOD_LABEL[exam.session_period]} Session`}
          {exam.venue ? ` · ${exam.venue}` : ' · Classroom not yet set'}
        </p>
      </div>

      <Card flush>
        <CardHeader
          title={`Registrations (${roster.data?.length ?? 0} enrolled)`}
          action={
            <Button size="sm" variant="secondary" loading={registeringAll} onClick={() => void registerAllEnrolled()}>
              Register All Enrolled
            </Button>
          }
        />
        {roster.loading ? (
          <div className="grid h-40 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : roster.error ? (
          <div className="p-5">
            <Alert tone="denied">{roster.error}</Alert>
          </div>
        ) : roster.data && roster.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="eyebrow px-5 py-3 text-ink-muted">Student</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Registered</th>
                  <th className="eyebrow px-5 py-3 text-ink-muted">Clearance</th>
                </tr>
              </thead>
              <tbody>
                {roster.data.map((row) => (
                  <tr key={row.studentId} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy-900">{row.fullName}</p>
                      <p className="data text-xs text-ink-muted">{row.studentIdNumber}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Button
                        size="sm"
                        variant={row.isRegistered ? 'secondary' : 'primary'}
                        loading={busyStudentId === row.studentId}
                        onClick={() => void upsertRegistration(row.studentId, { is_registered: !row.isRegistered })}
                      >
                        {row.isRegistered ? 'Registered ✓' : 'Register'}
                      </Button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={row.clearance}
                          disabled={busyStudentId === row.studentId}
                          onChange={(event) =>
                            void upsertRegistration(row.studentId, {
                              clearance_status: event.target.value as ClearanceStatus,
                            })
                          }
                          className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm"
                        >
                          <option value="cleared">Cleared</option>
                          <option value="pending_fees">Pending Fees</option>
                          <option value="blocked">Blocked</option>
                        </select>
                        <StatusPill tone={CLEARANCE_PILL[row.clearance].tone}>
                          {CLEARANCE_PILL[row.clearance].label}
                        </StatusPill>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No students enrolled"
            description="Enrol students in this course from Student Management first."
          />
        )}
      </Card>

      <Button variant="secondary" onClick={onExit}>
        ← Back to Examinations
      </Button>
    </div>
  )
}

export function AdminExaminationsPage() {
  const examinations = useExaminations()
  const [selected, setSelected] = useState<ExaminationRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  async function handleDelete(examId: string) {
    setDeletingId(examId)
    setDeleteError(null)

    // exam_registrations and verification_logs both cascade-delete with the
    // examination — fine for registrations, but verification_logs is the
    // access audit trail, so once any scan has been logged the exam is kept
    // rather than silently taking that history with it.
    const { count, error: countError } = await supabase
      .from('verification_logs')
      .select('*', { count: 'exact', head: true })
      .eq('examination_id', examId)
    if (countError) {
      setDeleteError({ id: examId, message: friendlyError(countError) })
      setDeletingId(null)
      return
    }
    if ((count ?? 0) > 0) {
      setDeleteError({
        id: examId,
        message: `Cannot delete — ${count} verification${count === 1 ? '' : 's'} already logged for this exam.`,
      })
      setDeletingId(null)
      return
    }

    const { error: deleteRowError } = await supabase.from('examinations').delete().eq('id', examId)
    setDeletingId(null)
    if (deleteRowError) {
      setDeleteError({ id: examId, message: friendlyError(deleteRowError) })
      return
    }
    examinations.reload()
  }

  if (selected) {
    return (
      <AppShell title="Examinations">
        <PageHeading title="Manage Registrations" />
        <RegistrationsPanel exam={selected} onExit={() => setSelected(null)} />
      </AppShell>
    )
  }

  return (
    <AppShell title="Examinations">
      <PageHeading title="Examinations" meta="Schedule examinations and manage per-student registration and clearance" />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <NewExaminationForm onCreated={() => examinations.reload()} />

        <Card flush>
          <CardHeader title={`${examinations.data?.length ?? 0} Scheduled`} />
          {examinations.loading ? (
            <div className="grid h-40 place-items-center text-azure-600">
              <Spinner className="h-5 w-5" />
            </div>
          ) : examinations.error ? (
            <div className="p-5">
              <Alert tone="denied">{examinations.error}</Alert>
            </div>
          ) : examinations.data && examinations.data.length > 0 ? (
            <ul>
              {examinations.data.map((exam) => (
                <li key={exam.id} className="border-b border-line px-5 py-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900">{exam.course?.name ?? 'Examination'}</p>
                      <p className="data mt-0.5 text-xs text-ink-muted">
                        {formatCompactDate(exam.exam_date)} · {formatClockTime(exam.exam_time)}
                        {exam.session_period && ` · ${SESSION_PERIOD_LABEL[exam.session_period]}`}
                        {exam.venue ? ` · ${exam.venue}` : ' · Classroom not yet set'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => setSelected(exam)}>
                        Manage →
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={deletingId === exam.id}
                        onClick={() => void handleDelete(exam.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {deleteError?.id === exam.id && (
                    <p className="mt-2 text-xs font-medium text-denied-600">{deleteError.message}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No examinations scheduled" description="Schedule the first one on the left." />
          )}
        </Card>
      </div>
    </AppShell>
  )
}
