export type SessionForReport = {
  course_id: string
  course_code: string
  course_name: string
  scanned_count: number
  discrepancy_flag: boolean
}

export type CourseReportRow = {
  courseId: string
  courseCode: string
  courseName: string
  sessions: number
  enrolled: number
  avgPresent: number
  attendanceRate: number | null
  flags: number
}

/**
 * Groups sessions by course and computes the same figures shown in the
 * Reports mockup (Figure 4.6): sessions run, average present, attendance
 * rate, and flag count. `enrolledByCourse` is current enrollment, not a
 * historical snapshot — acceptable at this project's scale (spec scope note).
 */
export function aggregateByCourse(
  sessions: SessionForReport[],
  enrolledByCourse: Map<string, number>,
): CourseReportRow[] {
  const byCourse = new Map<string, SessionForReport[]>()
  for (const session of sessions) {
    const list = byCourse.get(session.course_id) ?? []
    list.push(session)
    byCourse.set(session.course_id, list)
  }

  const rows: CourseReportRow[] = []
  for (const [courseId, courseSessions] of byCourse) {
    const enrolled = enrolledByCourse.get(courseId) ?? 0
    const totalScanned = courseSessions.reduce((sum, s) => sum + s.scanned_count, 0)
    const avgPresent = courseSessions.length > 0 ? totalScanned / courseSessions.length : 0
    rows.push({
      courseId,
      courseCode: courseSessions[0].course_code,
      courseName: courseSessions[0].course_name,
      sessions: courseSessions.length,
      enrolled,
      avgPresent,
      attendanceRate: enrolled > 0 ? (avgPresent / enrolled) * 100 : null,
      flags: courseSessions.filter((s) => s.discrepancy_flag).length,
    })
  }

  return rows.sort((a, b) => a.courseCode.localeCompare(b.courseCode))
}

export function toCsv(rows: CourseReportRow[]): string {
  const header = ['Course', 'Sessions', 'Enrolled', 'Avg Present', 'Attendance Rate', 'Flags']
  const lines = rows.map((row) =>
    [
      `"${row.courseName} (${row.courseCode})"`,
      row.sessions,
      row.enrolled,
      row.avgPresent.toFixed(1),
      row.attendanceRate === null ? 'n/a' : `${row.attendanceRate.toFixed(1)}%`,
      row.flags,
    ].join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
