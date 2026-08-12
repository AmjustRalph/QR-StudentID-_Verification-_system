/**
 * The signed-code format shared by mint-code, mint-card-code and verify-code.
 *
 * A token is base64url(payload) + "." + base64url(HMAC-SHA256(seed, payload)).
 * The HMAC key is the student's own qr_seed from student_secrets — there is no
 * separate global signing secret to configure or rotate. This also means
 * compromising one student's seed cannot be used to forge another student's
 * code, and it keeps every Edge Function in this project stateless: nothing
 * here needs to be looked up except by primary key.
 *
 * payload = "1|<studentId>|<kind>|<period>"
 *   kind   'live' (dashboard, rotates) or 'static' (physical card, permanent)
 *   period 60-second window index for 'live' codes; empty for 'static'
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type CodeKind = 'live' | 'static'

export type TokenPayload = {
  studentId: string
  kind: CodeKind
  /** 60-second window index. Present for 'live' codes, null for 'static'. */
  period: number | null
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (normalized.length % 4)) % 4
  const padded = normalized + '='.repeat(padLength)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodePayload(payload: TokenPayload): string {
  return `1|${payload.studentId}|${payload.kind}|${payload.period ?? ''}`
}

async function hmac(seed: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(seed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return toBase64Url(new Uint8Array(signature))
}

export async function mintToken(seed: string, payload: TokenPayload): Promise<string> {
  const message = encodePayload(payload)
  const signature = await hmac(seed, message)
  return `${toBase64Url(encoder.encode(message))}.${signature}`
}

export type DecodedToken = { payload: TokenPayload; message: string; signature: string }

/** Structural parse only — does not verify the signature belongs to this student. */
export function decodeToken(token: string): DecodedToken | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadPart, signature] = parts
  if (!payloadPart || !signature) return null

  let message: string
  try {
    message = decoder.decode(fromBase64Url(payloadPart))
  } catch {
    return null
  }

  const fields = message.split('|')
  if (fields.length !== 4) return null
  const [version, studentId, kind, periodRaw] = fields
  if (version !== '1' || !studentId || (kind !== 'live' && kind !== 'static')) return null

  if (kind === 'static') {
    return { payload: { studentId, kind, period: null }, message, signature }
  }

  const period = Number(periodRaw)
  if (!Number.isInteger(period)) return null
  return { payload: { studentId, kind, period }, message, signature }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Recomputes the HMAC over the decoded message and compares in constant time. */
export async function verifyToken(seed: string, decoded: DecodedToken): Promise<boolean> {
  const expected = await hmac(seed, decoded.message)
  return timingSafeEqual(expected, decoded.signature)
}

/** Rotation window length (spec §4.1). Must match CODE_LIFETIME_SECONDS in the frontend. */
export const LIVE_CODE_PERIOD_SECONDS = 60

export function currentPeriod(): number {
  return Math.floor(Date.now() / 1000 / LIVE_CODE_PERIOD_SECONDS)
}
