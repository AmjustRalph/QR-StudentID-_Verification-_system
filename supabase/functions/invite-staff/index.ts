// @ts-nocheck -- Deno runtime; see the note at the top of ../_shared/db.ts.
//
// Sends a Supabase Auth invite email to create a Staff account (spec §2:
// "Staff — created only by an Administrator, via the Staff Accounts screen —
// sends a Supabase Auth invite email"). Admin-only, and the only staff
// creation path — invigilators are not a separate role, so this covers both.
//
// Business-logic outcomes (already invited, Supabase send failure) come back
// as 200 { ok: false, reason, message } rather than an HTTP error status, so
// the frontend can read the message without unpacking a FunctionsHttpError
// body — same pattern as verify-code.
import { admin, authenticate } from '../_shared/db.ts'
import { handleCors, json } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const caller = await authenticate(req)
  if (!caller) return json({ error: 'unauthorized' }, 401)
  if (caller.role !== 'admin') return json({ error: 'forbidden' }, 403)

  let body: { email?: string; fullName?: string; redirectTo?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request', message: 'Expected a JSON body with email and fullName.' }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const fullName = body.fullName?.trim()
  if (!email || !fullName) {
    return json({ error: 'bad_request', message: 'email and fullName are required.' }, 400)
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role: 'staff', full_name: fullName },
    redirectTo: body.redirectTo,
  })

  if (error) {
    const alreadyExists = /already.*registered|already.*exists/i.test(error.message)
    return json({
      ok: false,
      reason: alreadyExists ? 'already_exists' : 'invite_failed',
      message: alreadyExists ? 'An account already exists for this email.' : error.message,
    })
  }

  return json({ ok: true, id: data.user.id, email: data.user.email })
})
