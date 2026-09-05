import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Segmented } from '@/components/ui/Segmented'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/supabase'
import { ROLE_LABEL, type Role } from '@/lib/roles'
import { LOGIN_ROLE_HINT_KEY } from '@/lib/roleMismatchNotice'

// Administrator is deliberately excluded — there is no public signup path for
// it (spec §2, admin is provisioned only via the one-time seed script), so
// offering it as a selectable option here has no honest use.
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'student', label: ROLE_LABEL.student },
  { value: 'staff', label: ROLE_LABEL.staff },
]

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [roleTouched, setRoleTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // Left for the post-login page to read once: if the account's real role
      // (from the database) doesn't match what was picked here, it shows a
      // brief courtesy note rather than silently ignoring the selection.
      if (roleTouched) {
        sessionStorage.setItem(LOGIN_ROLE_HINT_KEY, role)
      } else {
        sessionStorage.removeItem(LOGIN_ROLE_HINT_KEY)
      }
      await signIn(email, password)
      // No redirect here: PublicOnlyRoute sends the user to ROLE_HOME once the
      // profile lands, using the role from the database rather than `role`.
    } catch (caught) {
      setError(friendlyError(caught))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="QR-SIDVS · Sign in"
      title="Welcome back"
      subtitle="Enter your credentials to continue to your dashboard."
      footer={
        <div className="space-y-1">
          <p>
            New student?{' '}
            <Link to="/signup" className="font-semibold text-azure-600 hover:underline">
              Create your account
            </Link>
          </p>
          <p>
            <Link
              to="/forgot-password"
              className="font-semibold text-azure-600 hover:underline"
            >
              Forgot password?
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <Alert tone="denied">{error}</Alert>}

        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Segmented
          label="Sign in as"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(next) => {
            setRole(next)
            setRoleTouched(true)
          }}
          hint="For convenience only — your actual access comes from your account record."
        />

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Sign In →
        </Button>
      </form>
    </AuthLayout>
  )
}
