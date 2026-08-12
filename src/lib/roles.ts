export const ROLES = ['student', 'staff', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  staff: 'Staff',
  admin: 'Administrator',
}

/** Landing route for each role after sign-in. */
export const ROLE_HOME: Record<Role, string> = {
  student: '/student',
  staff: '/staff',
  admin: '/admin',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
