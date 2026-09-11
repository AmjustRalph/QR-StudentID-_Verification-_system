import { supabase } from '@/lib/supabase'
import { verifyScannedCode, type ScannedStudent } from '@/features/scanning/verifyScannedCode'
import type { ExaminationKind } from '@/lib/database.types'

export type EligibilityChecks = {
  /** null means "not cryptographically evaluated" — the offline ID-lookup
   * path never checks a signature, only the two cached-data checks below. */
  qrValid: boolean | null
  /** null means "not evaluated" — either an earlier check already failed, or
   * (quiz/test only) this check doesn't apply at all. */
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
 * Check (a) is pinned to the physical card for a formal exam: the dashboard's
 * rotating phone code is explicitly "classroom use only, physical card
 * required for examinations" (spec §4.1). A student presenting their phone
 * here fails check (a) with source_mismatch, same as if they had no code.
 *
 * A lecturer-scheduled quiz/test is a different, lighter thing — no admin
 * registration/clearance record exists for it at all, so checks (b) and (c)
 * are skipped entirely (reported as null, meaning "not applicable" rather
 * than "not evaluated"), and either code type is accepted, matching how the
 * phone code is already framed as fine for classroom use.
 */
export async function checkExamEligibility(
  code: string,
  examinationId: string,
  examinationKind: ExaminationKind = 'exam',
): Promise<EligibilityResult> {
  const codeResult = await verifyScannedCode(code, examinationKind === 'exam' ? 'physical_card' : undefined)

  if (!codeResult.valid) {
    return {
      outcome: 'denied',
      reason: codeResult.reason,
      student: codeResult.student,
      checks: { qrValid: false, registered: null, cleared: null },
    }
  }

  const student = codeResult.student

  if (examinationKind !== 'exam') {
    return { outcome: 'granted', student, checks: { qrValid: true, registered: null, cleared: null } }
  }

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
