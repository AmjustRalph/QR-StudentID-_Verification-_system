import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { supabase, friendlyError } from '@/lib/supabase'

/**
 * Landing page for the emailed reset link. Supabase exchanges the link for a
 * recovery session before this renders (detectSessionInUrl), so the update
 * below authenticates against that session.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)))
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (caught) {
      setError(friendlyError(caught))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="QR-SIDVS · Password reset"
      title="Choose a new password"
      subtitle="You will be signed out and asked to sign in with the new password."
    >
      {ready === false ? (
        <Alert tone="denied" title="This reset link is no longer valid">
          Request a fresh link from the Forgot password screen.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <Alert tone="denied">{error}</Alert>}
          <Field
            label="New Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            hint="At least 8 characters."
            onChange={(event) => setPassword(event.target.value)}
          />
          <Field
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <Button type="submit" fullWidth size="lg" loading={submitting} disabled={ready === null}>
            Update Password →
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
