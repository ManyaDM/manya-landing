import 'server-only'

// Environment access. Values are never logged or returned to the client.
const BOOKING_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'AGENDA_ENCRYPTION_KEY']
// Admin sign-in is "Sign in with Google" (same OAuth client and redirect URI as calendar connections).
const ADMIN_VARS = ['AGENDA_SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
const OAUTH_VARS = [...BOOKING_VARS, 'GOOGLE_REDIRECT_URI']

const missing = (names) => names.filter((n) => !process.env[n])

/** Public booking (slots/book) needs DB + Google + encryption. */
export const bookingConfigured = () => missing(BOOKING_VARS).length === 0
/** Admin login needs the session secret and the Google OAuth client. */
export const adminConfigured = () => missing(ADMIN_VARS).length === 0
/** Connecting calendars additionally needs the redirect URI. */
export const oauthConfigured = () => missing(OAUTH_VARS).length === 0
/** Names (never values) of missing variables, for the admin page. */
export const missingVars = () => missing([...new Set([...OAUTH_VARS, ...ADMIN_VARS, 'AGENDA_ADMIN_EMAILS'])])
/** Names of the variables the admin sign-in needs that are missing. */
export const missingAdminVars = () => missing(ADMIN_VARS)

export const env = {
  get supabaseUrl() { return process.env.SUPABASE_URL },
  get supabaseKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID },
  get googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET },
  get googleRedirectUri() { return process.env.GOOGLE_REDIRECT_URI },
  get encryptionKey() { return process.env.AGENDA_ENCRYPTION_KEY },
  /** Comma-separated @manya.pe emails that are always admins (bootstrap; not removable from the panel). */
  get adminEmails() { return process.env.AGENDA_ADMIN_EMAILS || '' },
  get sessionSecret() { return process.env.AGENDA_SESSION_SECRET },
  get makeWebhookUrl() { return process.env.MAKE_AGENDA_WEBHOOK_URL },
  get siteUrl() { return process.env.NEXT_PUBLIC_SITE_URL || 'https://go.manya.pe' },
}
