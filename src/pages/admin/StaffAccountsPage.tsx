import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useStaffList } from '@/features/admin/useStaffList'
import { useAllCourses } from '@/features/admin/useAllCourses'
import { inviteStaff } from '@/features/admin/inviteStaff'
import { setAccountStatus } from '@/features/admin/setAccountStatus'
import type { UserRecord } from '@/lib/database.types'

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (fullName.trim().length < 2) return setError('Enter the staff member’s full name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.')

    setSubmitting(true)
    try {
      const result = await inviteStaff(email, fullName)
      setSentTo(result.email)
      setFullName('')
      setEmail('')
      onInvited()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send the invite.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <p className="eyebrow text-ink-muted">Invite Staff</p>
      <p className="mt-1 text-sm text-ink-muted">
        Sends a Supabase Auth invite email. The invitee sets their own password from the link; this is the
        only way a Staff account is created. Invigilators use this same role, just pointed at exam sessions
        instead of lecture sessions.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {error && <Alert tone="denied">{error}</Alert>}
        {sentTo && (
          <Alert tone="verified" title="Invite sent">
            {sentTo} will receive an email to set their password and sign in.
          </Alert>
        )}

        <Field
          label="Full Name"
          placeholder="A. Quarshie"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <Field
          label="Email"
          type="email"
          placeholder="lecturer@gctu.edu.gh"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Button type="submit" fullWidth loading={submitting}>
          Send Invite →
        </Button>
      </form>
    </Card>
  )
}

function StaffList({
  staff,
  selectedId,
  onSelect,
}: {
  staff: UserRecord[]
  selectedId: string | null
  onSelect: (member: UserRecord) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return staff
    return staff.filter(
      (member) => member.full_name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle),
    )
  }, [staff, query])

  return (
    <Card flush>
      <CardHeader title={`Staff Members (${staff.length})`} />
      <div className="border-b border-line p-3">
        <Field
          label="Search staff"
          placeholder="Search by name or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="max-h-[32rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">No match.</p>
        ) : (
          <ul>
            {filtered.map((member) => (
              <li key={member.id}>
                <button
                  onClick={() => onSelect(member)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 border-b border-line px-5 py-3 text-left last:border-0 hover:bg-canvas',
                    selectedId === member.id && 'bg-azure-50',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{member.full_name}</p>
                    <p className="data text-xs text-ink-muted">{member.email}</p>
                  </div>
                  <StatusPill tone={member.status === 'active' ? 'verified' : 'neutral'} className="shrink-0">
                    {member.status === 'active' ? 'Active' : 'Deactivated'}
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

function StaffDetail({
  member,
  onStatusChanged,
  onExit,
}: {
  member: UserRecord
  onStatusChanged: (next: UserRecord) => void
  onExit: () => void
}) {
  const courses = useAllCourses()
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null)

  async function toggleStatus() {
    setStatusBusy(true)
    setStatusError(null)
    const nextStatus = member.status === 'active' ? 'deactivated' : 'active'
    try {
      const updated = await setAccountStatus(member.id, nextStatus)
      onStatusChanged(updated)
    } catch (caught) {
      setStatusError(caught instanceof Error ? caught.message : 'Could not update status.')
    } finally {
      setStatusBusy(false)
    }
  }

  async function assignCourse(courseId: string) {
    setTogglingCourseId(courseId)
    await supabase.from('courses').update({ lecturer_id: member.id }).eq('id', courseId)
    setTogglingCourseId(null)
    courses.reload()
  }

  async function unassignCourse(courseId: string) {
    setTogglingCourseId(courseId)
    await supabase.from('courses').update({ lecturer_id: null }).eq('id', courseId)
    setTogglingCourseId(null)
    courses.reload()
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-navy-900">{member.full_name}</p>
            <p className="data mt-0.5 text-sm text-ink-muted">{member.email}</p>
            <p className="data mt-1 text-xs text-ink-faint">Joined {formatDate(member.created_at)}</p>
          </div>
          <StatusPill tone={member.status === 'active' ? 'verified' : 'neutral'} dot className="shrink-0">
            {member.status === 'active' ? 'Active' : 'Deactivated'}
          </StatusPill>
        </div>

        {statusError && (
          <Alert tone="denied" className="mt-4">
            {statusError}
          </Alert>
        )}

        <Button
          className="mt-4"
          variant={member.status === 'active' ? 'danger' : 'primary'}
          loading={statusBusy}
          onClick={() => void toggleStatus()}
        >
          {member.status === 'active' ? 'Deactivate Staff' : 'Reactivate Staff'}
        </Button>
        {member.status === 'deactivated' && (
          <p className="mt-2 text-xs text-ink-muted">
            A deactivated staff member is signed out of any active session and cannot sign back in, start
            attendance sessions, mark attendance, or record exam verifications, until reactivated.
          </p>
        )}
      </Card>

      <Card flush>
        <CardHeader title="Course Assignments" />
        {courses.loading ? (
          <div className="grid h-24 place-items-center text-azure-600">
            <Spinner className="h-5 w-5" />
          </div>
        ) : courses.error ? (
          <div className="p-5">
            <Alert tone="denied">{courses.error}</Alert>
          </div>
        ) : courses.data && courses.data.length > 0 ? (
          <ul>
            {courses.data.map((course) => {
              const isThisStaff = course.lecturer_id === member.id
              return (
                <li
                  key={course.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900">{course.name}</p>
                    <p className="data text-xs text-ink-muted">
                      {course.code}
                      {!isThisStaff && course.lecturer_id && ' · currently assigned to another lecturer'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isThisStaff ? 'secondary' : 'primary'}
                    loading={togglingCourseId === course.id}
                    onClick={() => void (isThisStaff ? unassignCourse(course.id) : assignCourse(course.id))}
                    className="shrink-0"
                  >
                    {isThisStaff ? 'Assigned ✓' : 'Assign'}
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState title="No courses yet" description="Add a course from Student Management first." />
        )}
      </Card>

      <Button variant="secondary" onClick={onExit}>
        ← Back to Staff Accounts
      </Button>
    </div>
  )
}

export function StaffAccountsPage() {
  const staff = useStaffList()
  const [selected, setSelected] = useState<UserRecord | null>(null)

  if (selected) {
    return (
      <AppShell title="Staff Accounts">
        <PageHeading title="Manage Staff" />
        <StaffDetail
          member={selected}
          onExit={() => setSelected(null)}
          onStatusChanged={(next) => {
            setSelected(next)
            staff.reload()
          }}
        />
      </AppShell>
    )
  }

  return (
    <AppShell title="Staff Accounts">
      <PageHeading title="Staff" meta="Lecturers and invigilators: one role covers both" />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <InviteForm onInvited={() => staff.reload()} />

        {staff.loading ? (
          <Card>
            <div className="grid h-40 place-items-center text-azure-600">
              <Spinner className="h-5 w-5" />
            </div>
          </Card>
        ) : staff.error ? (
          <Card>
            <Alert tone="denied">{staff.error}</Alert>
          </Card>
        ) : staff.data && staff.data.length > 0 ? (
          <div>
            <StaffList staff={staff.data} selectedId={null} onSelect={setSelected} />
          </div>
        ) : (
          <Card>
            <EmptyState title="No staff yet" description="Send an invite to add the first lecturer or invigilator." />
          </Card>
        )}
      </div>
    </AppShell>
  )
}
