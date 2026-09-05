/**
 * Demo data for trying Attendance Scanning and Exam Verification.
 *
 * Neither Student Management nor Staff Accounts is built yet, so there is no
 * screen to assign a lecturer to a course or enrol a student by hand. This
 * script creates a minimal, working slice directly:
 *   - one staff account (used as both lecturer and invigilator — spec §2
 *     treats invigilators as the Staff role pointed at exams instead of
 *     lectures, so one account genuinely covers both screens)
 *   - four courses assigned to that staff member, named after the ones shown
 *     in the mockups (Figure 4.5)
 *   - every existing active student enrolled in all four courses
 *   - one examination a week out, with a registration per enrolled student —
 *     every third one deliberately left on pending_fees, so Exam Verification
 *     has both a GRANTED and a DENIED case to show without configuring
 *     anything by hand
 *
 * Safe to re-run: everything is looked up before being created or updated.
 *
 * Placeholder data — the real course list is still an open item (spec §8).
 * Nothing in the app treats these rows specially, so replacing them later is
 * just deleting rows, no migration needed.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { ClearanceStatus, Database } from '../src/lib/database.types'

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

const STAFF_EMAIL = process.env.SEED_STAFF_EMAIL || 'staff.demo@gctu.edu.gh'
const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD || 'DemoStaff#2026'
const STAFF_NAME = process.env.SEED_STAFF_NAME || 'K. Mensah'

const COURSES = [
  { code: 'DBS201', name: 'Database Systems II' },
  { code: 'SE220', name: 'Software Engineering' },
  { code: 'NET310', name: 'Computer Networks' },
  { code: 'WEB215', name: 'Web Technologies' },
]

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findAuthUserByEmail(target: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (hit) return hit.id
    if (data.users.length < 200) return null
  }
  return null
}

async function ensureStaffAccount(): Promise<string> {
  let authUserId = await findAuthUserByEmail(STAFF_EMAIL)

  if (!authUserId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: STAFF_EMAIL,
      password: STAFF_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'staff', full_name: STAFF_NAME },
    })
    if (error) throw error
    authUserId = data.user.id
    console.log(`  · Created staff account ${STAFF_EMAIL} (password: ${STAFF_PASSWORD})`)
  } else {
    console.log(`  · Staff account ${STAFF_EMAIL} already exists — reusing it.`)
  }

  const { data: profile, error } = await admin
    .from('users')
    .select('id, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (error) throw error
  if (!profile) {
    throw new Error('No public.users row for the staff account — apply the migrations first, then re-run.')
  }

  if (profile.role !== 'staff') {
    const { error: updateError } = await admin.from('users').update({ role: 'staff' }).eq('id', profile.id)
    if (updateError) throw updateError
  }

  return profile.id
}

async function ensureCourses(lecturerId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}

  for (const course of COURSES) {
    const { data: existing } = await admin.from('courses').select('id').eq('code', course.code).maybeSingle()
    if (existing) {
      ids[course.code] = existing.id
      await admin.from('courses').update({ lecturer_id: lecturerId }).eq('id', existing.id)
      continue
    }
    const { data: created, error } = await admin
      .from('courses')
      .insert({ code: course.code, name: course.name, lecturer_id: lecturerId })
      .select('id')
      .single()
    if (error) throw error
    ids[course.code] = created.id
  }

  console.log(`  · ${COURSES.length} courses ready, all assigned to ${STAFF_NAME}.`)
  return ids
}

async function enrollAllStudents(courseIds: string[]): Promise<string[]> {
  const { data: students, error } = await admin.from('students').select('id').eq('status', 'active')
  if (error) throw error

  if (!students || students.length === 0) {
    console.warn(
      '  ! No active students found. Sign up a test student first, then re-run this\n' +
        '    script to enrol them — the scanning screens need at least one enrolled\n' +
        '    student to show anything.',
    )
    return []
  }

  const rows = students.flatMap((student) =>
    courseIds.map((courseId) => ({ student_id: student.id, course_id: courseId })),
  )
  const { error: enrollError } = await admin
    .from('enrollments')
    .upsert(rows, { onConflict: 'student_id,course_id' })
  if (enrollError) throw enrollError

  console.log(`  · Enrolled ${students.length} student(s) in all 4 courses.`)
  return students.map((student) => student.id)
}

async function ensureExamination(courseId: string): Promise<string> {
  const examDate = new Date()
  examDate.setDate(examDate.getDate() + 7)
  const dateStr = examDate.toISOString().slice(0, 10)

  const { data: existing } = await admin
    .from('examinations')
    .select('id')
    .eq('course_id', courseId)
    .eq('exam_date', dateStr)
    .maybeSingle()
  if (existing) {
    console.log(`  · Examination for ${dateStr} already exists — reusing it.`)
    return existing.id
  }

  const { data: created, error } = await admin
    .from('examinations')
    .insert({
      course_id: courseId,
      exam_date: dateStr,
      exam_time: '09:00:00',
      // Left unset on purpose: the invigilator fills these in when they start
      // verifying, so the seeded exam exercises that flow instead of skipping it.
      venue: null,
      session_period: null,
      semester: 'Semester 2, 2025/2026',
      eligibility_criteria: null,
    })
    .select('id')
    .single()
  if (error) throw error

  console.log(`  · Examination created for ${dateStr} (invigilator sets the classroom).`)
  return created.id
}

async function ensureRegistrations(examinationId: string, studentIds: string[]) {
  if (studentIds.length === 0) return

  const rows = studentIds.map((studentId, index) => ({
    examination_id: examinationId,
    student_id: studentId,
    is_registered: true,
    // Every third student left pending, so Exam Verification has something to deny.
    clearance_status: (index % 3 === 2 ? 'pending_fees' : 'cleared') as ClearanceStatus,
  }))

  const { error } = await admin.from('exam_registrations').upsert(rows, {
    onConflict: 'examination_id,student_id',
  })
  if (error) throw error

  console.log(`  · ${rows.length} exam registration(s) ready (some deliberately pending fees).`)
}

async function main() {
  console.log('\n  QR-SIDVS — seeding demo staff, courses, enrollments and an examination\n')

  const staffId = await ensureStaffAccount()
  const courseIds = await ensureCourses(staffId)
  const studentIds = await enrollAllStudents(Object.values(courseIds))
  const examinationId = await ensureExamination(courseIds['DBS201'])
  await ensureRegistrations(examinationId, studentIds)

  console.log(
    `\n  ✓ Demo data ready.\n` +
      `    Sign in at /login as ${STAFF_EMAIL} / ${STAFF_PASSWORD}\n` +
      `    to try Attendance Scanning and Exam Verification.\n`,
  )
}

main().catch((error: unknown) => {
  console.error('\n  ✗ Seeding failed:', error instanceof Error ? error.message : error, '\n')
  process.exit(1)
})
