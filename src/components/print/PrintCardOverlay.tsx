import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { StudentIdCardFront, StudentIdCardBack, type IdCardStudent } from './StudentIdCard'

const COPIES = 4

function CardPair({ student, cardCode, showLabels }: { student: IdCardStudent; cardCode: string; showLabels: boolean }) {
  return (
    <>
      <div className="id-card-page">
        {showLabels && (
          <p className="id-card-no-print mb-1.5 text-center text-xs font-semibold text-white/80">Front</p>
        )}
        <StudentIdCardFront student={student} />
      </div>
      <div className="id-card-page">
        {showLabels && (
          <p className="id-card-no-print mb-1.5 text-center text-xs font-semibold text-white/80">Back</p>
        )}
        <StudentIdCardBack cardCode={cardCode} />
      </div>
    </>
  )
}

/**
 * Full-screen overlay shown when an admin clicks "Print ID Card". Only the
 * card faces inside #id-card-print-root survive onto paper — see the
 * `@media print` rules in src/styles/index.css — everything else here
 * (backdrop, buttons) carries `id-card-no-print` and disappears on print.
 * Each face prints as its own CR80-sized page (`.id-card-page` forces a
 * page break after every one) — flip the card stock between a front and
 * its back for a true double-sided print.
 *
 * Prints COPIES pairs in one job (spares are easier to hand out than
 * reprinting one at a time), but the on-screen preview only shows the
 * first pair — the rest are marked `id-card-print-only` (hidden on screen,
 * shown in print) so the preview stays readable instead of showing 8 cards.
 *
 * Rendered through a portal into #print-portal (a sibling of #root in
 * index.html, declared outside the React tree entirely), not inline where
 * this component sits in the page. `visibility: hidden` — used to hide
 * everything else on print — keeps hidden elements' layout space; without
 * the portal, the whole dashboard behind this overlay (nav, sidebar, the
 * page content underneath) would still occupy real page height above the
 * card, pushing the actual first printed page down by however many blank
 * pages that invisible content amounts to. #root is set to display:none for
 * print instead (see index.css), which removes it from flow entirely — that
 * only works if the card lives outside #root, hence the portal.
 */
export function PrintCardOverlay({
  student,
  cardCode,
  onClose,
}: {
  student: IdCardStudent
  cardCode: string
  onClose: () => void
}) {
  const portalTarget = document.getElementById('print-portal')
  if (!portalTarget) return null

  return createPortal(
    <div className="id-card-overlay fixed inset-0 z-50 overflow-auto bg-navy-950/70 p-6">
      <div className="id-card-no-print mx-auto mb-4 flex max-w-fit items-center gap-3">
        <Button onClick={() => window.print()}>Print →</Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>

      <div id="id-card-print-root" className="mx-auto flex w-fit flex-wrap items-start justify-center gap-6">
        <CardPair student={student} cardCode={cardCode} showLabels />
        <div className="id-card-print-only">
          {Array.from({ length: COPIES - 1 }, (_, i) => (
            <CardPair key={i} student={student} cardCode={cardCode} showLabels={false} />
          ))}
        </div>
      </div>

      <p className="id-card-no-print mx-auto mt-4 max-w-sm text-center text-xs text-white/70">
        In the print dialog, set scale to "Actual size" and make sure "Background graphics" is turned on,
        otherwise the navy bands print as white. This prints {COPIES} front+back copies ({COPIES * 2} pages);
        flip the card stock between each front and its back for a double-sided print.
      </p>
    </div>,
    portalTarget,
  )
}
