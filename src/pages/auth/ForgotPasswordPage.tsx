import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      // Always report success, even for an address with no account — otherwise
      // this screen becomes a way to enumerate who is registered.
      setSent(true)
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="QR-SIDVS · Password reset"
      title={sent ? 'Check your inbox' : 'Reset your password'}
      subtitle={
        sent
          ? `If an account exists for ${email.trim().toLowerCase()}, a reset link is on its way.`
          : 'Enter your institutional email and we will send you a reset link.'
      }
      footer={
        <Link to="/login" className="font-semibold text-azure-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="verified" title="Reset link sent">
          The link expires in 60 minutes.
        </Alert>
      ) : (
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
          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Send Reset Link →
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
