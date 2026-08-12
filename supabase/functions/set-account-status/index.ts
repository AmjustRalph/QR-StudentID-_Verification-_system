// @ts-nocheck -- Deno runtime; see the note at the top of ../_shared/db.ts.
//
// Fully disables an account: bans the underlying Supabase Auth login via the
// Admin API (needs the service_role key, unreachable from the browser) AND
// sets public.users.status, which is what already gates staff writes via RLS
// (0004_staff_status.sql). The two have to move together — a plain
// client-side `users` update only does the RLS half and leaves the person
// still able to sign in.
//
// Admin-only. Reactivating unbans (ban_duration: 'none').
import { admin, authenticate } from '../_shared/db.ts'
import { handleCors, json } from '../_shared/cors.ts'

type Status = 'active' | 'deactivated'

// Supabase's ban_duration has no "forever" literal — this is the documented
// convention for an effectively permanent ban (~100 years).
const PERMANENT_BAN = '876000h'

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const caller = await authenticate(req)
  if (!caller) return json({ error: 'unauthorized' }, 401)
  if (caller.role !== 'admin') return json({ error: 'forbidden' }, 403)

  let body: { userId?: string; status?: Status }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request', message: 'Expected a JSON body with userId and status.' }, 400)
  }

  if (!body.userId || (body.status !== 'active' && body.status !== 'deactivated')) {
    return json(
      { error: 'bad_request', message: 'userId and status ("active" | "deactivated") are required.' },
      400,
    )
  }

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('auth_user_id')
    .eq('id', body.userId)
    .maybeSingle()
  if (profileError) return json({ error: 'server_error', message: profileError.message }, 500)
  if (!profile) return json({ ok: false, reason: 'not_found', message: 'No account found with that id.' })

  const { error: banError } = await admin.auth.admin.updateUserById(profile.auth_user_id, {
    ban_duration: body.status === 'deactivated' ? PERMANENT_BAN : 'none',
  })
  if (banError) {
    return json({ ok: false, reason: 'ban_failed', message: banError.message })
  }

  const { data: updated, error: updateError } = await admin
    .from('users')
    .update({ status: body.status })
    .eq('id', body.userId)
    .select()
    .single()
  if (updateError) {
    return json({ ok: false, reason: 'status_update_failed', message: updateError.message })
  }

  return json({ ok: true, user: updated })
})
