/**
 * sessionStorage key LoginPage writes to when the user explicitly picked a
 * "Sign in as" option, so the landing dashboard can show a one-time courtesy
 * note if their real role (from the database) turned out to be different.
 * Shared here so both sides agree on the key without importing one page from
 * the other.
 */
export const LOGIN_ROLE_HINT_KEY = 'qrsidvs:login-role-hint'
