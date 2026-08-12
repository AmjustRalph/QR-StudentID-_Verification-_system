import { supabase } from '@/lib/supabase'
import type { AccountStatus, UserRecord } from '@/lib/database.types'

type StatusResponse = { ok: true; user: UserRecord } | { ok: false; reason: string; message: string }

/** Bans/unbans the Supabase Auth login and sets public.users.status together (see set-account-status). */
export async function setAccountStatus(userId: string, status: AccountStatus): Promise<UserRecord> {
  const { data, error } = await supabase.functions.invoke<StatusResponse>('set-account-status', {
    body: { userId, status },
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not reach the account service.')
  if (!data.ok) throw new Error(data.message)
  return data.user
}
