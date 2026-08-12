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
import { ROLES, ROLE_LABEL, type Role } from '@/lib/roles'

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }))

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
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
          label="Institutional Email"
          type="email"
          autoComplete="email"
          required
          placeholder="yourname@gctu.edu.gh"
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
          onChange={setRole}
          hint="For convenience only — your actual access comes from your account record."
        />

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Sign In →
        </Button>
      </form>
    </AuthLayout>
  )
}
