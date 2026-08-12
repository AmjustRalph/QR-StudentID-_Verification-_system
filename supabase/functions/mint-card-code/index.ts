// @ts-nocheck -- Deno runtime; see the note at the top of ../_shared/db.ts.
//
// Mints the permanent code embedded on a student's physical PVC card at print
// time (spec §4.1 / §7). Admin-only: this is card issuance, not something a
// student ever triggers for themselves, and the mockups do not surface this
// code anywhere in the student UI. Deterministic — reprinting a lost card
// yields the same code, since it is derived from the seed with no time
// component.
import { admin, authenticate } from '../_shared/db.ts'
import { handleCors, json } from '../_shared/cors.ts'
import { mintToken } from '../_shared/token.ts'

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const caller = await authenticate(req)
  if (!caller) return json({ error: 'unauthorized' }, 401)
  if (caller.role !== 'admin') return json({ error: 'forbidden' }, 403)

  let body: { studentId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request', message: 'Expected a JSON body with studentId.' }, 400)
  }

  const studentId = body.studentId
  if (!studentId) return json({ error: 'bad_request', message: 'studentId is required.' }, 400)

  const { data: secret, error } = await admin
    .from('student_secrets')
    .select('qr_seed')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) return json({ error: 'server_error', message: error.message }, 500)
  if (!secret) return json({ error: 'not_found', message: 'No student found with that id.' }, 404)

  const token = await mintToken(secret.qr_seed, { studentId, kind: 'static', period: null })
  return json({ code: token, kind: 'static' })
})
