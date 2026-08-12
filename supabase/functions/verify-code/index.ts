// @ts-nocheck -- Deno runtime; see the note at the top of ../_shared/db.ts.
//
// The single source of truth for "is this a genuine QR-SIDVS code, and whose
// is it" — check (a) of the three-check exam eligibility flow in spec §4.6,
// and the identity lookup behind photo-glance confirmation in spec §4.2.
//
// Deliberately does not write to attendance or verification_logs. The caller
// (the Attendance Scanning or Exam Verification screen, once built) makes
// that write itself under its own session, so the existing RLS policies on
// those tables — "only the session's own lecturer", "only while the session
// is open", "invigilator must be the caller" — stay the one place that
// authorization is decided, rather than being duplicated here.
import { admin, authenticate } from '../_shared/db.ts'
import { handleCors, json } from '../_shared/cors.ts'
import { currentPeriod, decodeToken, verifyToken } from '../_shared/token.ts'

type ScanSource = 'physical_card' | 'digital_display'

const SOURCE_KIND: Record<ScanSource, 'live' | 'static'> = {
  physical_card: 'static',
  digital_display: 'live',
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const caller = await authenticate(req)
  if (!caller) return json({ error: 'unauthorized' }, 401)
  if (caller.role !== 'staff' && caller.role !== 'admin') {
    return json({ error: 'forbidden' }, 403)
  }

  let body: { code?: string; scanSource?: ScanSource }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request', message: 'Expected a JSON body with code.' }, 400)
  }

  if (!body.code) return json({ error: 'bad_request', message: 'code is required.' }, 400)

  const decoded = decodeToken(body.code)
  if (!decoded) return json({ valid: false, reason: 'malformed' })

  if (body.scanSource && SOURCE_KIND[body.scanSource] !== decoded.payload.kind) {
    return json({ valid: false, reason: 'source_mismatch' })
  }

  const { data: secret, error: secretError } = await admin
    .from('student_secrets')
    .select('qr_seed')
    .eq('student_id', decoded.payload.studentId)
    .maybeSingle()

  if (secretError) return json({ error: 'server_error', message: secretError.message }, 500)
  if (!secret) return json({ valid: false, reason: 'unknown_student' })

  const signatureOk = await verifyToken(secret.qr_seed, decoded)
  if (!signatureOk) return json({ valid: false, reason: 'bad_signature' })

  if (decoded.payload.kind === 'live') {
    const now = currentPeriod()
    // One period of grace: a code minted in the last second of its window
    // must still verify a moment later, on the next tick, at the scanner.
    if (decoded.payload.period !== now && decoded.payload.period !== now - 1) {
      return json({ valid: false, reason: 'expired' })
    }
  }

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id, full_name, student_id_number, programme, level, photo_url, status')
    .eq('id', decoded.payload.studentId)
    .maybeSingle()

  if (studentError) return json({ error: 'server_error', message: studentError.message }, 500)
  if (!student) return json({ valid: false, reason: 'unknown_student' })
  if (student.status !== 'active') {
    return json({ valid: false, reason: 'inactive_student', student })
  }

  return json({ valid: true, kind: decoded.payload.kind, student })
})
