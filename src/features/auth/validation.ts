/**
 * Sign-up validation, kept out of the component so the rules are readable in
 * one place and can be reused by the admin's Student Management screen later.
 */

/** Change this single constant to open signup to another domain (spec §2). */
export const INSTITUTIONAL_DOMAIN = 'gctu.edu.gh'

export const LEVELS = [100, 200, 300, 400] as const

export const PROGRAMMES = [
  'BSc. Information Technology',
  'BSc. Computer Science',
  'BSc. Telecommunications Engineering',
  'BSc. Computer Engineering',
  'BSc. Cyber Security',
  'BSc. Business Administration',
] as const

export type SignUpValues = {
  fullName: string
  email: string
  studentIdNumber: string
  programme: string
  level: string
  password: string
  confirmPassword: string
}

export type SignUpErrors = Partial<Record<keyof SignUpValues, string>>

// Matches the GCTU/22/0148 shape shown throughout the mockups, while staying
// tolerant of a different segment length.
const STUDENT_ID_PATTERN = /^[A-Z]{2,6}\/\d{2}\/\d{3,6}$/

export function validateSignUp(values: SignUpValues): SignUpErrors {
  const errors: SignUpErrors = {}
  const email = values.email.trim().toLowerCase()

  if (values.fullName.trim().length < 3) {
    errors.fullName = 'Enter your full name as it appears on your student record.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  } else if (!email.endsWith(`@${INSTITUTIONAL_DOMAIN}`)) {
    errors.email = `Use your institutional email (@${INSTITUTIONAL_DOMAIN}).`
  }

  if (!STUDENT_ID_PATTERN.test(values.studentIdNumber.trim().toUpperCase())) {
    errors.studentIdNumber = 'Use the format on your card, e.g. GCTU/22/0148.'
  }

  if (!values.programme) errors.programme = 'Select your programme.'
  if (!values.level) errors.level = 'Select your level.'

  if (values.password.length < 8) {
    errors.password = 'Use at least 8 characters.'
  } else if (!/[0-9]/.test(values.password) || !/[a-zA-Z]/.test(values.password)) {
    errors.password = 'Include at least one letter and one number.'
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}
