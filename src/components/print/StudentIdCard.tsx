import { useState } from 'react'
import { QrCode } from '@/components/ui/QrCode'

const CARD_SIZE = { width: '85.6mm', height: '54mm' }

/** Ghana's academic year runs roughly Aug–Jul, so a student ID printed in
 * e.g. March 2027 should read "2026/2027", not "2027/2027". */
function currentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const startYear = now.getMonth() >= 7 ? year : year - 1
  return `${startYear}/${startYear + 1}`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/** Falls back to a drawn monogram if /gctu-logo.webp hasn't been added to
 * public/ yet, so the card still renders something sensible in the meantime. */
function CrestMark({ size }: { size: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        aria-hidden
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-full border-2 border-pending-100 bg-navy-800 font-display text-[6px] font-bold tracking-wide text-pending-100"
      >
        GCTU
      </div>
    )
  }

  return (
    <img
      src="/gctu-logo.webp"
      alt="GCTU crest"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-contain"
      onError={() => setFailed(true)}
    />
  )
}

export type IdCardStudent = {
  full_name: string
  student_id_number: string
  programme: string | null
  photo_url: string | null
}

/**
 * Front face: identity at a glance — crest, name, photo, programme.
 * True CR80 size (85.6mm x 54mm) so it prints 1:1 onto blank PVC card stock.
 * `print-color-adjust` is set inline (not just in the stylesheet) because
 * Chrome/Firefox otherwise drop background colours entirely when printing
 * unless the user also ticks "Background graphics" in the print dialog.
 */
export function StudentIdCardFront({ student }: { student: IdCardStudent }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden bg-white text-navy-900 shadow-panel"
      style={{ ...CARD_SIZE, fontFamily: 'var(--font-sans)', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      {/* Header band */}
      <div className="flex items-center gap-[2.5mm] bg-navy-900 px-[3.5mm] py-[2.5mm]">
        <CrestMark size="10mm" />
        <div className="min-w-0 leading-[1.35]">
          <p className="font-display text-[7px] font-bold uppercase tracking-wide text-white">
            Ghana Communication
            <br />
            Technology University
          </p>
          <p className="mt-[1mm] text-[5px] font-semibold uppercase tracking-[0.15em] text-pending-100">
            Student Identity Card
          </p>
        </div>
      </div>

      {/* Body — photo and text kept together as one group and centred as a
          unit, rather than pinned to opposite edges (that left a dead gap
          in the middle when the text didn't fill the remaining width). */}
      <div className="flex flex-1 items-center justify-center gap-[4mm] px-[3.5mm] py-[2.5mm]">
        {student.photo_url ? (
          <img
            src={student.photo_url}
            alt=""
            className="shrink-0 rounded-[1mm] border border-line-strong object-cover"
            style={{ width: '20mm', height: '25mm' }}
          />
        ) : (
          <div
            className="grid shrink-0 place-items-center rounded-[1mm] border border-line-strong bg-azure-50 font-display text-[13px] font-bold text-azure-700"
            style={{ width: '20mm', height: '25mm' }}
          >
            {initials(student.full_name)}
          </div>
        )}

        <div className="min-w-0 max-w-[38mm] leading-[1.6]">
          <p className="truncate font-display text-[9.5px] font-bold text-navy-900">{student.full_name}</p>
          <p className="data mt-[1.5mm] text-[8px] font-semibold text-azure-700">{student.student_id_number}</p>
          {student.programme && (
            <p className="mt-[2.5mm] truncate text-[6.5px] text-ink-muted">{student.programme}</p>
          )}
        </div>
      </div>

      {/* Accent footer bar — the crest's gold trim, not the app's bright azure */}
      <div className="h-[2mm] bg-pending-600" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />
    </div>
  )
}

/**
 * Back face: the scannable code, sized generously since nothing else
 * competes with it here. Prints as a second page directly after the front
 * (see .id-card-page in src/styles/index.css) — flip the card stock and
 * feed it again for a true double-sided card.
 */
export function StudentIdCardBack({ cardCode }: { cardCode: string }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden bg-white text-navy-900 shadow-panel"
      style={{ ...CARD_SIZE, fontFamily: 'var(--font-sans)', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <div className="bg-navy-900 px-[3.5mm] py-[2mm] text-center">
        <p className="text-[6px] font-semibold uppercase tracking-[0.2em] text-white">Student Identity Card</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-[1.5mm]">
        <QrCode value={cardCode} className="h-[28mm] w-[28mm]" />
        <p className="text-[5.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          Scan to verify identity
        </p>
        <p className="text-[5px] text-ink-faint">Valid: A.Y. {currentAcademicYear()}</p>
      </div>

      <div className="bg-navy-900 px-[3.5mm] py-[2mm] text-center">
        <p className="text-[5px] font-semibold uppercase tracking-[0.2em] text-pending-100">
          Knowledge Comes From Learning
        </p>
        <p className="mt-[0.5mm] text-[4.5px] text-white/70">
          Property of GCTU: if found, please return to the Registry
        </p>
      </div>
    </div>
  )
}
