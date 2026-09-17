import { useEffect, useMemo, useState } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { Reticle } from '@/components/ui/Reticle'
import { QrCode } from '@/components/ui/QrCode'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { useAllCourses } from '@/features/admin/useAllCourses'
import { useCardCode } from '@/features/admin/useCardCode'
import { CoursesPanel } from '@/features/admin/CoursesPanel'
import { PrintCardOverlay } from '@/components/print/PrintCardOverlay'
import type { StudentRecord } from '@/lib/database.types'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function StudentList({
  students,
  selectedId,
  onSelect,
}: {
  students: StudentRecord[]
  selectedId: string | null
  onSelect: (student: StudentRecord) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return students
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(needle) ||
        s.student_id_number.toLowerCase().includes(needle) ||
        s.email.toLowerCase().includes(needle),
    )
  }, [students, query])

  return (
    <Card flush>
      <CardHeader title={`Students (${students.length})`} />
      <div className="border-b border-line p-3">
        <Field
          label="Search students"
          placeholder="Search by name, ID or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="max-h-[36rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">No match.</p>
        ) : (
          <ul>
            {filtered.map((student) => (
              <li key={student.id}>
                <button
                  onClick={() => onSelect(student)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 border-b border-line px-5 py-3 text-left last:border-0 hover:bg-canvas',
                    selectedId === student.id && 'bg-azure-50',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{student.full_name}</p>
                    <p className="data text-xs text-ink-muted">{student.student_id_number}</p>
                  </div>
                  <StatusPill tone={student.status === 'active' ? 'verified' : 'neutral'} className="shrink-0">
                    {student.status === 'active' ? 'Active' : 'Deactivated'}
                  </StatusPill>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function StudentDetail({
  student,
  onStatusChanged,
}: {
  student: StudentRecord
  onStatusChanged: (next: StudentRecord) => void
}) {
  const courses = useAllCourses()
  const enrollments = useAsync<Set<string>>(async () => {
    const { data, error } = await supabase.from('enrollments').select('course_id').eq('student_id', student.id)
    if (error) throw error
    return new Set((data ?? []).map((row) => row.course_id))
  }, [student.id])

  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const card = useCardCode()
  const [showPrintCard, setShowPrintCard] = useState(false)
  useEffect(() => {
    card.reset()
    setShowPrintCard(false)
    // Only reset when the selected student changes, not on every card state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id])

  async function toggleStatus() {
    setStatusBusy(true)
    setStatusError(null)
    const nextStatus = student.status === 'active' ? 'deactivated' : 'active'
    const { data, error } = await supabase
      .from('students')
      .update({ status: nextStatus })
      .eq('id', student.id)
      .select()
      .single()
    setStatusBusy(false)
    if (error) {
      setStatusError(error.message)
      return
    }
    onStatusChanged(data)
  }

  async function toggleEnrollment(courseId: string, enrolled: boolean) {
    setTogglingCourseId(courseId)
    if (enrolled) {
      await supabase.from('enrollments').delete().eq('student_id', student.id).eq('course_id', courseId)
    } else {
      await supabase.from('enrollments').insert({ student_id: student.id, course_id: courseId })
    }
    setTogglingCourseId(null)
    enrollments.reload()
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start gap-4">
          {student.photo_url ? (
            <img src={student.photo_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-azure-100 font-display text-xl font-bold text-azure-700">
              {initials(student.full_name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-navy-900">{student.full_name}</p>
            <p className="data mt-0.5 text-sm text-ink-muted">{student.student_id_number}</p>
            <p className="text-sm text-ink-muted">{student.email}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {student.programme}
              {student.level && ` · Level ${student.level}`}
            </p>
          </div>
          <StatusPill tone={student.status === 'active' ? 'verified' : 'neutral'} dot className="shrink-0">
            {student.status === 'active' ? 'Active' : 'Deactivated'}
          </StatusPill>
        </div>

        {statusError && (
          <Alert tone="denied" className="mt-4">
            {statusError}
          </Alert>
        )}

        <Button
          className="mt-4"
          variant={student.status === 'active' ? 'danger' : 'primary'}
          loading={statusBusy}
          onClick={() => void toggleStatus()}
        >
          {student.status === 'active' ? 'Deactivate Student' : 'Reactivate Student'}
        </Button>
        {student.status === 'deactivated' && (
          <p className="mt-2 text-xs text-ink-muted">
            A deactivated student's codes are rejected by verify-code on every scan, so they cannot be marked
            present or granted exam access until reactivated.
          </p>
        )}
      </Card>

      <Card flush>
        <CardHeader title="Course Enrollments" />
        {courses.loading || enrollments.loading ? (
          <div className="grid h-24 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : courses.error || enrollments.error ? (
          <div className="p-5">
            <Alert tone="denied">{courses.error ?? enrollments.error}</Alert>
          </div>
        ) : courses.data && courses.data.length > 0 ? (
          <ul>
            {courses.data.map((course) => {
              const isEnrolled = enrollments.data?.has(course.id) ?? false
              return (
                <li
                  key={course.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900">{course.name}</p>
                    <p className="data text-xs text-ink-muted">{course.code}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isEnrolled ? 'secondary' : 'primary'}
                    loading={togglingCourseId === course.id}
                    onClick={() => void toggleEnrollment(course.id, isEnrolled)}
                    className="shrink-0"
                  >
                    {isEnrolled ? 'Enrolled ✓' : 'Enrol'}
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState title="No courses yet" description="Courses are created directly in the database for now." />
        )}
      </Card>

      <Card>
        <p className="eyebrow text-ink-muted">Physical Card Code</p>
        <p className="mt-2 text-sm text-ink-muted">
          The permanent code embedded on this student's PVC card. Deterministic: regenerating always returns
          the same code, matching a reprinted card.
        </p>

        {card.error && (
          <Alert tone="denied" className="mt-3">
            {card.error}
          </Alert>
        )}

        {card.code ? (
          <>
            <div className="mt-4 flex items-center gap-4">
              <Reticle tone="navy" size="sm">
                <QrCode value={card.code} className="h-32 w-32" />
              </Reticle>
              <p className="text-xs text-ink-muted">
                Scan this with a phone or point a scanning device's camera at it to test the physical-card path
                in Attendance Scanning or Exam Verification.
              </p>
            </div>
            <Button className="mt-4" variant="secondary" onClick={() => setShowPrintCard(true)}>
              Print ID Card →
            </Button>
          </>
        ) : (
          <Button className="mt-4" loading={card.loading} onClick={() => void card.generate(student.id)}>
            Generate Card Code
          </Button>
        )}
      </Card>

      {showPrintCard && card.code && (
        <PrintCardOverlay student={student} cardCode={card.code} onClose={() => setShowPrintCard(false)} />
      )}
    </div>
  )
}

export function StudentManagementPage() {
  const students = useAsync<StudentRecord[]>(async () => {
    const { data, error } = await supabase.from('students').select('*').order('full_name')
    if (error) throw error
    return data ?? []
  }, [])

  const [selected, setSelected] = useState<StudentRecord | null>(null)

  return (
    <AppShell title="Student Management">
      <PageHeading title="Students" meta="Manage enrollments, status, and card codes" />

      <div className="mb-6">
        <CoursesPanel />
      </div>

      {students.error ? (
        <Alert tone="denied">{students.error}</Alert>
      ) : students.loading ? (
        <div className="grid h-64 place-items-center text-azure-600">
          <Spinner className="h-6 w-6" />
        </div>
      ) : students.data && students.data.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <StudentList students={students.data} selectedId={selected?.id ?? null} onSelect={setSelected} />
          {selected ? (
            <StudentDetail
              student={selected}
              onStatusChanged={(next) => {
                setSelected(next)
                students.reload()
              }}
            />
          ) : (
            <Card className="flex items-center justify-center text-center text-sm text-ink-muted">
              Select a student to view and manage their record.
            </Card>
          )}
        </div>
      ) : (
        <EmptyState
          title="No students yet"
          description="Students appear here once they sign up. There is no admin-created signup path by design."
        />
      )}
    </AppShell>
  )
}
