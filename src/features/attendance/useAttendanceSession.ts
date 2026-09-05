import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AttendanceSessionRecord, ScanSource, SessionPeriod, StudentStatus } from '@/lib/database.types'

export type RosterEntry = {
  studentId: string
  fullName: string
  studentIdNumber: string
  photoUrl: string | null
  status: StudentStatus
  presentAt: string | null
  scanSource: ScanSource | null
}

type EnrolledRow = {
  student: {
    id: string
    full_name: string
    student_id_number: string
    photo_url: string | null
    status: StudentStatus
  } | null
}

/**
 * Owns the lifecycle of a single attendance session for one course: find an
 * already-open one to resume, otherwise start a fresh one, then keep the
 * roster and live counts in sync as scans come in (spec §4.3 / §4.4).
 */
export function useAttendanceSession(courseId: string, lecturerId: string) {
  const [session, setSession] = useState<AttendanceSessionRecord | null>(null)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** True once we know there is no open session to resume, so the caller must
   * collect a classroom + session period before one can be started. */
  const [needsSetup, setNeedsSetup] = useState(false)

  const loadRoster = useCallback(
    async (sessionId: string) => {
      const [enrolledResult, marksResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('student:students(id, full_name, student_id_number, photo_url, status)')
          .eq('course_id', courseId),
        supabase.from('attendance').select('student_id, scanned_at, scan_source').eq('session_id', sessionId),
      ])
      if (enrolledResult.error) throw enrolledResult.error
      if (marksResult.error) throw marksResult.error

      const marksByStudent = new Map(
        (marksResult.data ?? []).map((mark) => [mark.student_id, mark]),
      )

      const rows: RosterEntry[] = ((enrolledResult.data ?? []) as unknown as EnrolledRow[])
        .map((row) => row.student)
        .filter((student): student is NonNullable<typeof student> => Boolean(student))
        .map((student) => {
          const mark = marksByStudent.get(student.id)
          return {
            studentId: student.id,
            fullName: student.full_name,
            studentIdNumber: student.student_id_number,
            photoUrl: student.photo_url,
            status: student.status,
            presentAt: mark?.scanned_at ?? null,
            scanSource: mark?.scan_source ?? null,
          }
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName))

      setRoster(rows)
    },
    [courseId],
  )

  const init = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: existing, error: findError } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('course_id', courseId)
        .eq('lecturer_id', lecturerId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (findError) throw findError

      if (existing) {
        setSession(existing)
        setNeedsSetup(false)
        await loadRoster(existing.id)
      } else {
        setSession(null)
        setNeedsSetup(true)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this session.')
    } finally {
      setLoading(false)
    }
  }, [courseId, lecturerId, loadRoster])

  useEffect(() => {
    void init()
  }, [init])

  const startSession = useCallback(
    async (venue: string, sessionPeriod: SessionPeriod) => {
      const { data: created, error: createError } = await supabase
        .from('attendance_sessions')
        .insert({ course_id: courseId, lecturer_id: lecturerId, venue, session_period: sessionPeriod })
        .select()
        .single()
      if (createError) throw createError
      setSession(created)
      setNeedsSetup(false)
      await loadRoster(created.id)
    },
    [courseId, lecturerId, loadRoster],
  )

  const refreshSession = useCallback(async (sessionId: string) => {
    const { data, error: refreshError } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    if (!refreshError && data) setSession(data)
  }, [])

  const markPresent = useCallback(
    async (studentId: string, scanSource: ScanSource) => {
      if (!session) return { ok: false as const, alreadyMarked: false, message: 'No active session.' }

      const { error: insertError } = await supabase
        .from('attendance')
        .insert({ session_id: session.id, student_id: studentId, scan_source: scanSource })

      if (insertError) {
        if (insertError.code === '23505') {
          return { ok: false as const, alreadyMarked: true, message: 'Already marked present.' }
        }
        return { ok: false as const, alreadyMarked: false, message: insertError.message }
      }

      const scannedAt = new Date().toISOString()
      setRoster((previous) =>
        previous.map((entry) =>
          entry.studentId === studentId ? { ...entry, presentAt: scannedAt, scanSource } : entry,
        ),
      )
      await refreshSession(session.id)
      return { ok: true as const, alreadyMarked: false, message: null }
    },
    [session, refreshSession],
  )

  const endSession = useCallback(
    async (reportedHeadcount: number) => {
      if (!session) return
      const { data, error: endError } = await supabase
        .from('attendance_sessions')
        .update({ ended_at: new Date().toISOString(), reported_headcount: reportedHeadcount })
        .eq('id', session.id)
        .select()
        .single()
      if (endError) throw endError
      setSession(data)
    },
    [session],
  )

  return { session, roster, loading, error, needsSetup, startSession, markPresent, endSession }
}
