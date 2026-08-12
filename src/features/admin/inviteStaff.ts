import { supabase } from '@/lib/supabase'

type InviteResponse =
  | { ok: true; id: string; email: string }
  | { ok: false; reason: string; message: string }

/** Sends the Supabase Auth invite email that creates a Staff account (spec §2). */
export async function inviteStaff(email: string, fullName: string): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.functions.invoke<InviteResponse>('invite-staff', {
    body: { email, fullName, redirectTo: `${window.location.origin}/reset-password` },
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not reach the invite service.')
  }
  if (!data.ok) {
    throw new Error(data.message)
  }
  return data
}
