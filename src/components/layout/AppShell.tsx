import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  UserCircle,
  QrCode,
  ClipboardList,
  ShieldCheck,
  Users,
  UserCog,
  BarChart3,
  LogOut,
  Menu,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/ui/Logo'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABEL, isRole, type Role } from '@/lib/roles'
import { LOGIN_ROLE_HINT_KEY } from '@/lib/roleMismatchNotice'

export type NavItem = { to: string; label: string; end?: boolean; icon: LucideIcon }

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  student: [
    { to: '/student', label: 'My Dashboard', end: true, icon: LayoutDashboard },
    { to: '/student/courses', label: 'My Courses', icon: BookOpen },
    { to: '/student/attendance', label: 'Attendance History', icon: CalendarCheck },
    { to: '/student/examinations', label: 'Examination Schedule', icon: CalendarClock },
    { to: '/student/profile', label: 'My Profile', icon: UserCircle },
  ],
  staff: [
    { to: '/staff', label: 'My Dashboard', end: true, icon: LayoutDashboard },
    { to: '/staff/attendance', label: 'Attendance Scanning', icon: QrCode },
    { to: '/staff/records', label: 'Attendance Records', icon: ClipboardList },
    { to: '/staff/verification', label: 'Exam Verification', icon: ShieldCheck },
    { to: '/staff/profile', label: 'My Profile', icon: UserCircle },
  ],
  admin: [
    { to: '/admin', label: 'Overview', end: true, icon: LayoutDashboard },
    { to: '/admin/students', label: 'Student Management', icon: Users },
    { to: '/admin/staff', label: 'Staff Accounts', icon: UserCog },
    { to: '/admin/attendance', label: 'Attendance Records', icon: ClipboardList },
    { to: '/admin/examinations', label: 'Examinations', icon: CalendarClock },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  ],
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="py-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 border-l-[3px] px-5 py-2.5 text-sm transition-colors',
                isActive
                  ? 'border-azure-600 bg-white/[0.06] font-semibold text-white'
                  : 'border-transparent text-azure-100/60 hover:bg-white/[0.03] hover:text-white',
              )
            }
          >
            <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

/** Pinned to the bottom of the nav rail, in both the desktop aside and mobile drawer. */
function SidebarSignOut({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut } = useAuth()
  return (
    <button
      onClick={() => {
        onNavigate?.()
        void signOut()
      }}
      className="flex w-full items-center gap-3 border-l-[3px] border-transparent px-5 py-2.5 text-sm text-azure-100/60 transition-colors hover:bg-white/[0.03] hover:text-white"
    >
      <LogOut aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
      Log Out
    </button>
  )
}

type Props = {
  title: string
  actions?: ReactNode
  children: ReactNode
}

/** The persistent navy rail + top bar used by every signed-in screen. */
export function AppShell({ title, actions, children }: Props) {
  const { profile, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const role: Role = profile?.role ?? 'student'
  const items = NAV_BY_ROLE[role]
  const initials = (profile?.full_name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  // Reads the role the user picked at login (if any) exactly once, on the
  // first authenticated page they land on, then clears it — so this shows a
  // single courtesy note per sign-in rather than persisting across every
  // page visited afterwards.
  const [roleMismatch, setRoleMismatch] = useState<Role | null>(null)
  useEffect(() => {
    if (!profile) return
    const picked = sessionStorage.getItem(LOGIN_ROLE_HINT_KEY)
    sessionStorage.removeItem(LOGIN_ROLE_HINT_KEY)
    if (picked && isRole(picked) && picked !== profile.role) {
      setRoleMismatch(picked)
    }
    // Only ever meant to fire once, right after the profile first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(profile)])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Desktop rail */}
      <aside className="hidden bg-linear-to-b from-navy-900 to-navy-950 lg:block print:hidden">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="border-b border-white/10 px-5 py-4">
            <Logo withWordmark />
          </div>
          <NavList items={items} />
          <div className="mt-auto border-t border-white/10 py-3">
            <SidebarSignOut />
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-navy-950/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative flex h-full w-64 flex-col bg-linear-to-b from-navy-900 to-navy-950 shadow-pop">
            <div className="border-b border-white/10 px-5 py-4">
              <Logo withWordmark />
            </div>
            <NavList items={items} onNavigate={() => setDrawerOpen(false)} />
            <div className="mt-auto border-t border-white/10 py-3">
              <SidebarSignOut onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-5 lg:px-8 print:hidden">
          <button
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md border border-line-strong text-navy-900 lg:hidden"
          >
            <Menu aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>

          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-navy-900">{title}</h1>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {actions}
            <StatusPill tone="azure" className="hidden sm:inline-flex">
              {ROLE_LABEL[role]}
            </StatusPill>
            <div
              title={profile?.email ?? ''}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-canvas font-display text-xs font-bold text-navy-900"
            >
              {initials || '—'}
            </div>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Log Out
            </Button>
          </div>
        </header>

        <main className="flex-1 px-5 py-7 lg:px-8">
          {roleMismatch && (
            <Alert
              tone="azure"
              className="mb-6"
              title={`You selected ${ROLE_LABEL[roleMismatch]}, but this account is registered as ${ROLE_LABEL[role]} — you've been taken to the right place.`}
              action={
                <button
                  aria-label="Dismiss"
                  onClick={() => setRoleMismatch(null)}
                  className="rounded-md px-2 py-1 text-lg leading-none text-azure-700 hover:bg-azure-100"
                >
                  ×
                </button>
              }
            />
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

/** Page-level heading block: big title + contextual meta line. */
export function PageHeading({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-2xl font-bold text-navy-900">{title}</h2>
      {meta && <p className="data mt-1 text-sm text-ink-muted">{meta}</p>}
    </div>
  )
}
