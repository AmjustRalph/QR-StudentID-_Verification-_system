import { supabase } from '@/lib/supabase'
import { verifyScannedCode, type ScannedStudent } from '@/features/scanning/verifyScannedCode'

export type EligibilityChecks = {
  qrValid: boolean
  /** null means "not evaluated" — an earlier check already failed. */
  registered: boolean | null
  cleared: boolean | null
}

export type EligibilityResult = {
  outcome: 'granted' | 'denied'
  reason?: string
  student?: ScannedStudent
  checks: EligibilityChecks
}

/**
 * The three sequential checks from spec §4.6: (a) QR code validity,
 * (b) exam registration, (c) administrative clearance. All three must pass
 * for `granted`; the first one to fail decides the denial reason, and every
 * check after it is left unevaluated (reported as null, not false).
 *
 * Check (a) is pinned to the physical card: the dashboard's rotating phone
 * code is explicitly "classroom use only, physical card required for
 * examinations" (spec §4.1). A student presenting their phone here fails
 * check (a) with source_mismatch, same as if they had no code at all.
 */
export async function checkExamEligibility(
  code: string,
  examinationId: string,
): Promise<EligibilityResult> {
  const codeResult = await verifyScannedCode(code, 'physical_card')

  if (!codeResult.valid) {
    return {
      outcome: 'denied',
      reason: codeResult.reason,
      student: codeResult.student,
      checks: { qrValid: false, registered: null, cleared: null },
    }
  }

  const student = codeResult.student

  const { data: registration, error } = await supabase
    .from('exam_registrations')
    .select('is_registered, clearance_status')
    .eq('examination_id', examinationId)
    .eq('student_id', student.id)
    .maybeSingle()
  if (error) throw error

  const registered = Boolean(registration?.is_registered)
  if (!registered) {
    return {
      outcome: 'denied',
      reason: 'not_registered',
      student,
      checks: { qrValid: true, registered: false, cleared: null },
    }
  }

  const cleared = registration!.clearance_status === 'cleared'
  if (!cleared) {
    return {
      outcome: 'denied',
      reason: registration!.clearance_status,
      student,
      checks: { qrValid: true, registered: true, cleared: false },
    }
  }

  return { outcome: 'granted', student, checks: { qrValid: true, registered: true, cleared: true } }
}
