/** yah so just so u Know and dont touch anything if you arent Ralph READ ALL THE COMMENTS SO U DONT FUCK ANYTHING UP!!
 * One-time Administrator bootstrap (spec §2 / §6 step 3).
 *
 * There is deliberately no admin signup path in the UI, so the very first
 * administrator has to be created out of band. This script does that with the
 * service_role key, which bypasses RLS and can reach the Auth Admin API.
 *
 *   1. cp .env.example .env  and fill in every value
 *   2. Apply supabase/migrations/0001_schema.sql then 0002_rls.sql
 *   3. npm run seed:admin
 *   4. Sign in, change the password immediately, then delete SEED_ADMIN_PASSWORD
 *      from .env
 *
 * Safe to re-run: an existing account is repaired (role corrected) rather than
 * duplicated.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types'

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.startsWith('paste-your')) {
    console.error(`\n  ✗ ${name} is missing from .env (or still holds the placeholder).\n`)
    process.exit(1)
  }
  return value
}

const url = required('VITE_SUPABASE_URL')
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
const email = required('SEED_ADMIN_EMAIL')
const password = required('SEED_ADMIN_PASSWORD')
const fullName = process.env.SEED_ADMIN_NAME || 'System Administrator'

if (password.length < 12) {
  console.error('\n  ✗ SEED_ADMIN_PASSWORD must be at least 12 characters.\n')
  process.exit(1)
}

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findAuthUserByEmail(target: string): Promise<string | null> {
  // The Admin API has no get-by-email, so page through until we find it. Fine
  // at bootstrap time, when the project has a handful of users at most.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (hit) return hit.id
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  console.log(`\n  QR-SIDVS — seeding administrator ${email}\n`)

  let authUserId = await findAuthUserByEmail(email)

  if (authUserId) {
    console.log('  · Auth user already exists — reusing it.')
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no inbox round-trip for the bootstrap account
      user_metadata: { role: 'admin', full_name: fullName },
    })
    if (error) throw error
    authUserId = data.user.id
    console.log('  · Auth user created.')
  }

  // The on_auth_user_created trigger should already have written public.users.
  // Verify rather than assume — if the migrations were not applied, this is
  // where it shows up, and the message needs to say so plainly.
  const { data: profile, error: readError } = await admin
    .from('users')
    .select('id, role, full_name')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (readError) throw readError

  if (!profile) {
    console.error(
      '\n  ✗ No public.users row was created for this account.\n' +
        '    The on_auth_user_created trigger is missing — apply\n' +
        '    supabase/migrations/0001_schema.sql, then re-run this script.\n',
    )
    process.exit(1)
  }

  if (profile.role !== 'admin' || profile.full_name !== fullName) {
    const { error } = await admin
      .from('users')
      .update({ role: 'admin', full_name: fullName })
      .eq('id', profile.id)
    if (error) throw error
    console.log(`  · Promoted profile to admin (was '${profile.role}').`)
  } else {
    console.log('  · Profile already has the admin role.')
  }

  // A student row here would mean the account was first created through the
  // public signup path. Harmless, but worth flagging.
  const { data: strayStudent } = await admin
    .from('students')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (strayStudent) {
    console.warn(
      '  ! This account also has a public.students row, so it was originally\n' +
        '    a student signup. Consider using a dedicated admin address instead.',
    )
  }

  console.log(
    `\n  ✓ Administrator ready.\n` +
      `    Sign in at /login as ${email}\n` +
      `    Change the password immediately, then remove SEED_ADMIN_PASSWORD from .env.\n`,
  )
}

main().catch((error: unknown) => {
  console.error('\n  ✗ Seeding failed:', error instanceof Error ? error.message : error, '\n')
  process.exit(1)
})
