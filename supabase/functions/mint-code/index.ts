// @ts-nocheck -- Deno runtime; see the note at the top of ../_shared/db.ts.
//
// Mints the signed-in student's rotating digital verification code (spec
// §4.1). Always for the caller's own record — it takes no student_id
// parameter, so there is nothing to check for "is this your own record".
import { admin, authenticate } from '../_shared/db.ts'
import { handleCors, json } from '../_shared/cors.ts'
import { LIVE_CODE_PERIOD_SECONDS, currentPeriod, mintToken } from '../_shared/token.ts'

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const caller = await authenticate(req)
  if (!caller) return json({ error: 'unauthorized' }, 401)
  if (caller.role !== 'student' || !caller.studentId) {
    return json({ error: 'forbidden', message: 'Only a student can mint their own code.' }, 403)
  }

  const { data: secret, error } = await admin
    .from('student_secrets')
    .select('qr_seed')
    .eq('student_id', caller.studentId)
    .maybeSingle()

  if (error) return json({ error: 'server_error', message: error.message }, 500)
  if (!secret) {
    return json(
      { error: 'no_seed', message: 'No verification seed exists yet for this student.' },
      404,
    )
  }

  const period = currentPeriod()
  const token = await mintToken(secret.qr_seed, {
    studentId: caller.studentId,
    kind: 'live',
    period,
  })
  const expiresAt = new Date((period + 1) * LIVE_CODE_PERIOD_SECONDS * 1000).toISOString()

  return json({ code: token, kind: 'live', expiresAt, periodSeconds: LIVE_CODE_PERIOD_SECONDS })
})
