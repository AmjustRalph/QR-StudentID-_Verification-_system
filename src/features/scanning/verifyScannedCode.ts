import { supabase } from '@/lib/supabase'
import type { ClearanceStatus, StudentStatus } from '@/lib/database.types'

export type ScannedStudent = {
  id: string
  full_name: string
  student_id_number: string
  programme: string | null
  level: number | null
  photo_url: string | null
  status: StudentStatus
}

export type VerifyCodeReason =
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'unknown_student'
  | 'inactive_student'
  | 'source_mismatch'

export type VerifyCodeResult =
  | { valid: true; kind: 'live' | 'static'; student: ScannedStudent }
  | { valid: false; reason: VerifyCodeReason; student?: ScannedStudent }

type ScanSourceHint = 'physical_card' | 'digital_display'

/** Human labels for every reason verify-code or the eligibility check can deny a scan for. */
export const DENIAL_LABEL: Record<string, string> = {
  malformed: 'Unrecognised code',
  bad_signature: 'Invalid code',
  expired: 'Code expired: ask the student to refresh their dashboard',
  unknown_student: 'No matching student record',
  inactive_student: 'Student account is deactivated',
  source_mismatch: 'Physical card required: phone code not accepted for examinations',
  not_registered: 'Not registered for this examination',
  pending_fees: 'Outstanding fees: clearance required',
  blocked: 'Administrative clearance blocked',
}

export function denialLabel(reason: string): string {
  return DENIAL_LABEL[reason] ?? 'Verification failed'
}

/**
 * Thin wrapper around the verify-code Edge Function — check (a) of the exam
 * eligibility flow (spec §4.6), and the sole identity source behind
 * photo-glance confirmation (spec §4.2) for both scanning screens.
 */
export async function verifyScannedCode(
  code: string,
  scanSource?: ScanSourceHint,
): Promise<VerifyCodeResult> {
  const { data, error } = await supabase.functions.invoke<VerifyCodeResult>('verify-code', {
    body: { code, scanSource },
  })
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not reach the verification service.')
  }
  return data
}

export type { ClearanceStatus }
