/**
 * Hand-maintained mirror of supabase/migrations/*.sql.
 *
 * Once the Supabase CLI is linked to the project this can be replaced with:
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 * Until then, keep this file in step with the migrations by hand.
 *
 * Note there is no `student_secrets` entry: that table is unreachable from the
 * browser by design (see 0002_rls.sql), so it must not be addressable here.
 */

export type UserRole = 'student' | 'staff' | 'admin'
export type AccountStatus = 'active' | 'deactivated'
export type StudentStatus = 'active' | 'deactivated'
export type ScanSource = 'physical_card' | 'digital_display' | 'manual'
export type AttendanceStatus = 'present'
export type VerificationOutcome = 'granted' | 'denied'
export type ClearanceStatus = 'cleared' | 'pending_fees' | 'blocked'
export type SessionPeriod = 'morning' | 'evening'
export type ExaminationKind = 'exam' | 'quiz' | 'test'

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  // supabase-js reads this to type embedded selects. Left empty here because
  // the relationships are hand-maintained: queries that embed a related table
  // declare their own result shape at the call site instead.
  Relationships: []
}

export type UserRecord = {
  id: string
  auth_user_id: string
  full_name: string
  email: string
  role: UserRole
  status: AccountStatus
  created_at: string
  updated_at: string
}

export type StudentRecord = {
  id: string
  auth_user_id: string
  full_name: string
  student_id_number: string
  programme: string | null
  level: number | null
  email: string
  photo_url: string | null
  status: StudentStatus
  created_at: string
  updated_at: string
}

export type CourseRecord = {
  id: string
  code: string
  name: string
  lecturer_id: string | null
  created_at: string
}

export type EnrollmentRecord = {
  student_id: string
  course_id: string
  created_at: string
}

export type AttendanceSessionRecord = {
  id: string
  course_id: string
  lecturer_id: string
  started_at: string
  ended_at: string | null
  venue: string | null
  session_period: SessionPeriod | null
  scanned_count: number
  reported_headcount: number | null
  discrepancy_flag: boolean
  discrepancy_resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export type AttendanceRecord = {
  id: string
  session_id: string
  student_id: string
  scanned_at: string
  scan_source: ScanSource
  status: AttendanceStatus
}

export type ExaminationRecord = {
  id: string
  course_id: string
  exam_date: string
  exam_time: string
  /** Set by the invigilator when they start verifying (spec follow-up), not admin at scheduling time. */
  venue: string | null
  session_period: SessionPeriod | null
  /** 'exam' (admin-scheduled, full registration+clearance flow) vs a
   * lecturer-scheduled 'quiz'/'test' (identity-only, no admin needed). */
  kind: ExaminationKind
  semester: string | null
  eligibility_criteria: string | null
  created_at: string
}

export type ExamRegistrationRecord = {
  id: string
  examination_id: string
  student_id: string
  is_registered: boolean
  clearance_status: ClearanceStatus
  created_at: string
  updated_at: string
}

export type VerificationLogRecord = {
  id: string
  student_id: string | null
  examination_id: string
  invigilator_id: string
  verified_at: string
  outcome: VerificationOutcome
  denial_reason: string | null
}

export type Database = {
  public: {
    Tables: {
      users: Table<UserRecord, Omit<UserRecord, 'id' | 'created_at' | 'updated_at'>>
      students: Table<StudentRecord, Omit<StudentRecord, 'id' | 'created_at' | 'updated_at'>>
      courses: Table<CourseRecord, Omit<CourseRecord, 'id' | 'created_at'>>
      enrollments: Table<EnrollmentRecord, Omit<EnrollmentRecord, 'created_at'>>
      attendance_sessions: Table<
        AttendanceSessionRecord,
        Pick<AttendanceSessionRecord, 'course_id' | 'lecturer_id'> &
          Partial<AttendanceSessionRecord>
      >
      attendance: Table<
        AttendanceRecord,
        Pick<AttendanceRecord, 'session_id' | 'student_id' | 'scan_source'> &
          Partial<AttendanceRecord>
      >
      examinations: Table<
        ExaminationRecord,
        Omit<ExaminationRecord, 'id' | 'created_at'>
      >
      exam_registrations: Table<
        ExamRegistrationRecord,
        Pick<ExamRegistrationRecord, 'examination_id' | 'student_id'> &
          Partial<ExamRegistrationRecord>
      >
      verification_logs: Table<
        VerificationLogRecord,
        Pick<VerificationLogRecord, 'examination_id' | 'invigilator_id' | 'outcome'> &
          Partial<VerificationLogRecord>
      >
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      account_status: AccountStatus
      student_status: StudentStatus
      scan_source: ScanSource
      attendance_status: AttendanceStatus
      verification_outcome: VerificationOutcome
      clearance_status: ClearanceStatus
      session_period: SessionPeriod
      examination_kind: ExaminationKind
    }
  }
}
