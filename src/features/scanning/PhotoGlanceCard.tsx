import { cn } from '@/lib/cn'
import { StatusPill, type PillTone } from '@/components/ui/StatusPill'

type GlanceStudent = {
  full_name: string
  student_id_number: string
  photo_url: string | null
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function Avatar({ student, size }: { student: GlanceStudent; size: 'sm' | 'lg' }) {
  const dimension = size === 'lg' ? 'h-28 w-28' : 'h-12 w-12'
  if (student.photo_url) {
    return (
      <img
        src={student.photo_url}
        alt=""
        className={cn(dimension, 'shrink-0 rounded-lg object-cover')}
      />
    )
  }
  return (
    <div
      className={cn(
        dimension,
        'grid shrink-0 place-items-center rounded-lg bg-azure-100 font-display font-bold text-azure-700',
        size === 'lg' ? 'text-2xl' : 'text-sm',
      )}
    >
      {initials(student.full_name)}
    </div>
  )
}

/**
 * The photo-glance confirmation required on every scan (spec §4.2): identity
 * shown immediately so staff can visually match the person to the card,
 * whichever code type was scanned. `size="lg"` is the Exam Verification
 * presentation (Figure 4.4); `size="sm"` is the Attendance Scanning list item
 * (Figure 4.3).
 */
export function PhotoGlanceCard({
  student,
  pillLabel,
  pillTone,
  meta,
  size = 'sm',
}: {
  student: GlanceStudent
  pillLabel: string
  pillTone: PillTone
  meta?: string
  size?: 'sm' | 'lg'
}) {
  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center text-center">
        <Avatar student={student} size="lg" />
        <p className="mt-4 font-display text-xl font-bold text-navy-900">{student.full_name}</p>
        <p className="data mt-1 text-sm text-ink-muted">{student.student_id_number}</p>
        {meta && <p className="mt-0.5 text-sm text-ink-muted">{meta}</p>}
        <StatusPill tone={pillTone} dot className="mt-3">
          {pillLabel}
        </StatusPill>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
      <Avatar student={student} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-navy-900">{student.full_name}</p>
        <p className="data truncate text-xs text-ink-muted">
          {student.student_id_number}
          {meta ? ` · ${meta}` : ''}
        </p>
      </div>
      <StatusPill tone={pillTone} className="shrink-0">
        {pillLabel}
      </StatusPill>
    </div>
  )
}
