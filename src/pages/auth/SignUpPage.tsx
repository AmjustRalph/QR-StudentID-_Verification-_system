import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Field, SelectField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/supabase'
import {
  LEVELS,
  PROGRAMMES,
  validateSignUp,
  type SignUpErrors,
  type SignUpValues,
} from '@/features/auth/validation'

const EMPTY: SignUpValues = {
  fullName: '',
  email: '',
  studentIdNumber: '',
  programme: '',
  level: '',
  password: '',
  confirmPassword: '',
}

export function SignUpPage() {
  const { signUp } = useAuth()
  const [values, setValues] = useState<SignUpValues>(EMPTY)
  const [errors, setErrors] = useState<SignUpErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  function set<K extends keyof SignUpValues>(key: K, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    const found = validateSignUp(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      const { needsEmailConfirmation } = await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        studentIdNumber: values.studentIdNumber,
        programme: values.programme,
        level: Number(values.level),
      })
      // When confirmation is off, a session already exists and PublicOnlyRoute
      // redirects straight to the dashboard — nothing more to do here.
      if (needsEmailConfirmation) setConfirmationSent(true)
    } catch (caught) {
      setFormError(friendlyError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmationSent) {
    return (
      <AuthLayout
        eyebrow="QR-SIDVS · Sign up"
        title="Check your inbox"
        subtitle={`We sent a verification link to ${values.email.trim().toLowerCase()}.`}
        footer={
          <Link to="/login" className="font-semibold text-azure-600 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <Alert tone="verified" title="Account created">
          Confirm your email address, then sign in to see your verification code.
        </Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="QR-SIDVS · Sign up"
      title="Create your account"
      subtitle="Register with your GCTU student details to get your verification code."
      footer={
        <p>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-azure-600 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="denied">{formError}</Alert>}

        <Field
          label="Full Name"
          autoComplete="name"
          placeholder="Abena Owusu"
          value={values.fullName}
          error={errors.fullName}
          onChange={(event) => set('fullName', event.target.value)}
        />

        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          error={errors.email}
          onChange={(event) => set('email', event.target.value)}
        />

        <Field
          label="Index Number"
          placeholder="4211230109"
          className="data"
          inputMode="numeric"
          maxLength={10}
          value={values.studentIdNumber}
          error={errors.studentIdNumber}
          onChange={(event) => set('studentIdNumber', event.target.value.replace(/\D/g, ''))}
        />

        <SelectField
          label="Programme"
          value={values.programme}
          error={errors.programme}
          onChange={(event) => set('programme', event.target.value)}
        >
          <option value="">Select your programme</option>
          {PROGRAMMES.map((programme) => (
            <option key={programme} value={programme}>
              {programme}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Level"
          value={values.level}
          error={errors.level}
          onChange={(event) => set('level', event.target.value)}
        >
          <option value="">Select your level</option>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              Level {level}
            </option>
          ))}
        </SelectField>

        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={values.password}
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
          onChange={(event) => set('password', event.target.value)}
        />

        <Field
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => set('confirmPassword', event.target.value)}
        />

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Create Account →
        </Button>
      </form>
    </AuthLayout>
  )
}
