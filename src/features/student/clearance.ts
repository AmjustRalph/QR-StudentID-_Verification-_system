import type { ClearanceStatus } from '@/lib/database.types'
import type { PillTone } from '@/components/ui/StatusPill'

export const CLEARANCE_PILL: Record<ClearanceStatus, { tone: PillTone; label: string }> = {
  cleared: { tone: 'verified', label: 'Cleared' },
  pending_fees: { tone: 'pending', label: 'Pending Fees' },
  blocked: { tone: 'denied', label: 'Blocked' },
}
