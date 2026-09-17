import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusPill } from '@/components/ui/StatusPill'
import { useStudentRecord } from '@/features/student/useStudentRecord'
import { supabase, friendlyError } from '@/lib/supabase'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow text-ink-faint">{label}</p>
      <p className="data mt-1 text-sm text-navy-900">{value || '—'}</p>
    </div>
  )
}

export function StudentProfilePage() {
  const { data: student, loading, error, reload } = useStudentRecord()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [studentIdNumber, setStudentIdNumber] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (student) {
      setFullName(student.full_name)
      setStudentIdNumber(student.student_id_number)
      setPhotoUrl(student.photo_url)
    }
  }, [student])

  async function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !student) return

    setUploadError(null)

    if (!file.type.startsWith('image/')) {
      setUploadError('Choose an image file.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setUploadError('Image must be smaller than 5MB.')
      return
    }

    setUploading(true)
    const extension = file.name.split('.').pop() || 'jpg'
    const path = `${student.id}/${crypto.randomUUID()}.${extension}`

    const { error: uploadErr } = await supabase.storage
      .from('student-photos')
      .upload(path, file, { upsert: false, cacheControl: '3600' })

    if (uploadErr) {
      setUploading(false)
      setUploadError(friendlyError(uploadErr))
      return
    }

    const { data: publicUrl } = supabase.storage.from('student-photos').getPublicUrl(path)

    const { error: updateErr } = await supabase
      .from('students')
      .update({ photo_url: publicUrl.publicUrl })
      .eq('id', student.id)

    setUploading(false)
    if (updateErr) {
      setUploadError(friendlyError(updateErr))
      return
    }

    setPhotoUrl(publicUrl.publicUrl)
    reload()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!student) return
    setSaveError(null)
    setSaved(false)

    if (fullName.trim().length < 3) {
      setSaveError('Enter your full name.')
      return
    }
    if (!/^\d{10}$/.test(studentIdNumber.trim())) {
      setSaveError('Enter a valid 10-digit index number, e.g. 4211230109.')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase
      .from('students')
      .update({ full_name: fullName.trim(), student_id_number: studentIdNumber.trim() })
      .eq('id', student.id)
    setSaving(false)

    if (updateError) {
      setSaveError(friendlyError(updateError))
      return
    }
    setSaved(true)
    reload()
  }

  return (
    <AppShell title="My Profile">
      <PageHeading title="My Profile" meta="Your student record" />

      {loading ? (
        <div className="grid h-48 place-items-center text-azure-600">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error || !student ? (
        <Alert tone="denied" title="Could not load your profile">
          {error ?? 'No student record found for this account.'}
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <div className="flex flex-col items-center text-center">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-lg bg-azure-100 font-display text-2xl font-bold text-azure-700">
                  {initials(student.full_name)}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handlePhotoSelected(event)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                loading={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {photoUrl ? 'Change Photo' : 'Upload Photo'}
              </Button>
              {uploadError && <p className="mt-2 text-xs font-medium text-denied-600">{uploadError}</p>}

              <p className="mt-4 font-display text-lg font-bold text-navy-900">{student.full_name}</p>
              <p className="data mt-0.5 text-sm text-ink-muted">{student.student_id_number}</p>
              <StatusPill tone={student.status === 'active' ? 'verified' : 'neutral'} dot className="mt-2">
                {student.status === 'active' ? 'Active' : 'Deactivated'}
              </StatusPill>
            </div>

            <div className="mt-6 space-y-4 border-t border-line pt-5">
              <ReadOnlyField label="Institutional Email" value={student.email} />
              <ReadOnlyField label="Programme" value={student.programme ?? ''} />
              <ReadOnlyField label="Level" value={student.level ? String(student.level) : ''} />
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Contact an administrator to change your email, programme, or level.
            </p>
          </Card>

          <Card>
            <p className="eyebrow text-ink-muted">Update Your Details</p>
            <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
              {saveError && <Alert tone="denied">{saveError}</Alert>}
              {saved && <Alert tone="verified">Profile updated.</Alert>}

              <Field
                label="Full Name"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value)
                  setSaved(false)
                }}
              />

              <Field
                label="Index Number"
                className="data"
                inputMode="numeric"
                maxLength={10}
                hint="10 digits, e.g. 4211230109."
                value={studentIdNumber}
                onChange={(event) => {
                  setStudentIdNumber(event.target.value.replace(/\D/g, ''))
                  setSaved(false)
                }}
              />

              <Button type="submit" loading={saving}>
                Save Changes
              </Button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  )
}
