import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRecord } from '@/lib/database.types'

type SignUpInput = {
  email: string
  password: string
  fullName: string
  studentIdNumber: string
  programme: string
  level: number
}

type AuthContextValue = {
  session: Session | null
  profile: UserRecord | null
  /** True until the initial session + profile lookup has settled. */
  loading: boolean
  /** Set when a session exists but no matching public.users row could be read. */
  profileError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * The public.users row is written by a database trigger the moment the auth
 * user is created, but the client can occasionally win the race on a fresh
 * signup. Retry briefly before treating a missing row as an error.
 */
async function fetchProfile(authUserId: string, attempts = 3): Promise<UserRecord | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (error) throw error
    if (data) return data
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Guards against a slow profile fetch from a previous session overwriting the
  // state of a newer one.
  const requestRef = useRef(0)

  const loadProfile = useCallback(async (next: Session | null) => {
    const token = ++requestRef.current

    if (!next) {
      setProfile(null)
      setProfileError(null)
      return
    }

    try {
      const record = await fetchProfile(next.user.id)
      if (token !== requestRef.current) return
      setProfile(record)
      setProfileError(
        record
          ? null
          : 'Your account exists but has no profile record. Contact an administrator.',
      )
    } catch (error) {
      if (token !== requestRef.current) return
      setProfile(null)
      setProfileError(error instanceof Error ? error.message : 'Could not load your profile.')
    }
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return
        setSession(data.session)
        await loadProfile(data.session)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      void loadProfile(next)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        // Consumed by the on_auth_user_created trigger to populate public.users
        // and public.students. The trigger forces role to 'student' regardless
        // of what is sent here — this metadata cannot grant privilege.
        data: {
          role: 'student',
          full_name: input.fullName.trim(),
          student_id_number: input.studentIdNumber.trim().toUpperCase(),
          programme: input.programme.trim(),
          level: String(input.level),
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) throw error

    // Supabase returns a user with no session when email confirmation is on.
    return { needsEmailConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setProfileError(null)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }, [])

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
