import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/ui/Logo'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABEL, type Role } from '@/lib/roles'

export type NavItem = { to: string; label: string; end?: boolean }

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  student: [
    { to: '/student', label: 'My Dashboard', end: true },
    { to: '/student/attendance', label: 'Attendance History' },
    { to: '/student/examinations', label: 'Examination Schedule' },
    { to: '/student/profile', label: 'My Profile' },
  ],
  staff: [
    { to: '/staff', label: 'My Dashboard', end: true },
    { to: '/staff/attendance', label: 'Attendance Scanning' },
    { to: '/staff/verification', label: 'Exam Verification' },
    { to: '/staff/profile', label: 'My Profile' },
  ],
  admin: [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/students', label: 'Student Management' },
    { to: '/admin/staff', label: 'Staff Accounts' },
    { to: '/admin/attendance', label: 'Attendance Records' },
    { to: '/admin/examinations', label: 'Examinations' },
    { to: '/admin/reports', label: 'Reports' },
  ],
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="py-3">
      {items.map((item) => (
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
          {({ isActive }) => (
            <>
              <span
                aria-hidden
                className={cn(
                  'h-3.5 w-3.5 shrink-0 rounded-sm',
                  isActive ? 'bg-azure-600' : 'bg-white/15',
                )}
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
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
      <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-sm bg-white/15" />
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

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Desktop rail */}
      <aside className="hidden bg-navy-900 lg:block print:hidden">
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
          <div className="relative flex h-full w-64 flex-col bg-navy-900 shadow-pop">
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
            <span aria-hidden className="text-lg leading-none">
              ≡
            </span>
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

        <main className="flex-1 px-5 py-7 lg:px-8">{children}</main>
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
