import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell, PageHeading } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { StatusPill } from '@/components/ui/StatusPill'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase, friendlyError } from '@/lib/supabase'
import { formatDate } from '@/lib/format'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function StaffProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) setFullName(profile.full_name)
  }, [profile])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    setError(null)
    setSaved(false)

    if (fullName.trim().length < 2) {
      setError('Enter your full name.')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase
      .from('users')
      .update({ full_name: fullName.trim() })
      .eq('id', profile.id)
    setSaving(false)

    if (updateError) {
      setError(friendlyError(updateError))
      return
    }
    setSaved(true)
    void refreshProfile()
  }

  if (!profile) return null

  return (
    <AppShell title="My Profile">
      <PageHeading title="My Profile" meta="Your staff account" />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="grid h-24 w-24 place-items-center rounded-lg bg-azure-100 font-display text-2xl font-bold text-azure-700">
              {initials(profile.full_name)}
            </div>
            <p className="mt-4 font-display text-lg font-bold text-navy-900">{profile.full_name}</p>
            <p className="data mt-0.5 text-sm text-ink-muted">{profile.email}</p>
            <StatusPill tone={profile.status === 'active' ? 'verified' : 'neutral'} dot className="mt-2">
              {profile.status === 'active' ? 'Active' : 'Deactivated'}
            </StatusPill>
          </div>

          <div className="mt-6 space-y-4 border-t border-line pt-5">
            <div>
              <p className="eyebrow text-ink-faint">Role</p>
              <p className="data mt-1 text-sm text-navy-900">Staff</p>
            </div>
            <div>
              <p className="eyebrow text-ink-faint">Joined</p>
              <p className="data mt-1 text-sm text-navy-900">{formatDate(profile.created_at)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            Contact an administrator to change your email or account status.
          </p>
        </Card>

        <Card>
          <p className="eyebrow text-ink-muted">Update Your Details</p>
          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            {error && <Alert tone="denied">{error}</Alert>}
            {saved && <Alert tone="verified">Profile updated.</Alert>}

            <Field
              label="Full Name"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value)
                setSaved(false)
              }}
            />

            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  )
}
