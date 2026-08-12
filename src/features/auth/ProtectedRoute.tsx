import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { ROLE_HOME, type Role } from '@/lib/roles'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas text-azure-600">
      <Spinner className="h-8 w-8" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

/**
 * Gate for every signed-in route.
 *
 * The role checked here is always profile.role — read from the database — never
 * the role picked on the login screen. That selector is routing convenience
 * only (spec §2); a student choosing "Admin" still lands on the student area.
 */
export function ProtectedRoute({ allow }: { allow: Role[] }) {
  const { session, profile, loading, profileError, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!profile) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6">
        <div className="w-full max-w-md space-y-4">
          <Alert tone="denied" title="Profile unavailable">
            {profileError ?? 'We could not load your account profile.'}
          </Alert>
          <Button variant="secondary" fullWidth onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  if (!allow.includes(profile.role)) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }

  return <Outlet />
}

/** Bounces an already-signed-in visitor away from the auth screens. */
export function PublicOnlyRoute() {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (session && profile) return <Navigate to={ROLE_HOME[profile.role]} replace />

  return <Outlet />
}
