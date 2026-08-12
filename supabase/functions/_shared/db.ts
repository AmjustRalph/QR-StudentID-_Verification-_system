// @ts-nocheck -- Deno module resolution (esm.sh specifiers, Deno.env, Deno.serve)
// is foreign to the frontend's Node/browser tsconfig. supabase/functions is
// deliberately outside both tsconfig.app.json and tsconfig.node.json's
// `include`, so `npm run typecheck` / `npm run build` never touch this
// directory — the Supabase Edge Runtime typechecks it against Deno's types
// when you run `supabase functions deploy`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically into
// every deployed Edge Function's environment — nothing to configure for these.
const url = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in the function environment.')
}

/**
 * Service-role client. Bypasses RLS entirely — this is what lets these
 * functions reach student_secrets, which has no RLS policy granting access to
 * anyone else. Every query built on it below is scoped deliberately in code.
 */
export const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type CallerRole = 'student' | 'staff' | 'admin'

export type Caller = {
  authUserId: string
  userId: string
  role: CallerRole
  /** public.students.id for a student caller; null for staff/admin. */
  studentId: string | null
}

/**
 * Resolves the request's Authorization JWT to an app role by reading
 * public.users — the same source of truth RLS policies use. Never trusts a
 * role sent in a request body; there is no such field on any of these
 * functions' inputs.
 */
export async function authenticate(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return null

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, role')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()
  if (profileError || !profile) return null

  let studentId: string | null = null
  if (profile.role === 'student') {
    const { data: student } = await admin
      .from('students')
      .select('id')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle()
    studentId = student?.id ?? null
  }

  return { authUserId: userData.user.id, userId: profile.id, role: profile.role, studentId }
}
