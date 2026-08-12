import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Which env vars are missing or still hold the placeholder from .env.example.
 * Checked by <App> so a misconfigured checkout gets a setup screen telling it
 * what to do, rather than a blank page from a module-load throw.
 */
export const missingSupabaseConfig: string[] = [
  !url || url.startsWith('paste-your') ? 'VITE_SUPABASE_URL' : null,
  !anonKey || anonKey.startsWith('paste-your') ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter((name): name is string => name !== null)

// Placeholders keep createClient from throwing when config is absent. Any call
// made against them fails, which is fine — the setup screen renders instead.
export const supabase = createClient<Database>(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Supabase surfaces auth and Postgres errors with quite different shapes and
 * wording. Everything user-facing goes through here so the UI never prints a
 * raw driver message at someone.
 */
export function friendlyError(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.'

  const message = typeof error === 'string' ? error : ((error as { message?: string }).message ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (lower.includes('email not confirmed')) {
    return 'Confirm your email address first — check your inbox for the verification link.'
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account already exists for this email. Try signing in instead.'
  }
  if (lower.includes('duplicate key') && lower.includes('student_id_number')) {
    return 'That student ID is already registered.'
  }
  if (lower.includes('password') && lower.includes('at least')) {
    return 'Password must be at least 8 characters.'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Cannot reach the server. Check your connection and try again.'
  }

  return message || 'Something went wrong. Please try again.'
}
