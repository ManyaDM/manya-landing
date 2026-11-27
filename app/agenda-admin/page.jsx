import { adminConfigured, missingAdminVars, missingVars } from '@/lib/agenda/config'
import { currentAdmin } from '@/lib/agenda/session'
import AdminPanel from './AdminPanel'
import LogoutButton from './LogoutButton'
import './agenda-admin.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Agenda · Administración | Manya',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const OAUTH_MESSAGES = {
  ok: ['ok', 'Calendario conectado.'],
  denied: ['error', 'Se canceló el permiso en Google.'],
  email_mismatch: ['error', 'La cuenta de Google no coincide con el correo de esa persona. Inicia sesión con su cuenta @manya.pe.'],
  scopes: ['error', 'Faltó aceptar los permisos de calendario. Vuelve a conectar y marca todas las casillas.'],
  no_refresh_token: ['error', 'Google no entregó un token permanente. Desconecta la app en myaccount.google.com/permissions y vuelve a intentar.'],
  state: ['error', 'La solicitud expiró o no es válida. Vuelve a intentar.'],
  not_configured: ['error', 'Faltan variables de entorno de Google.'],
  login: ['error', 'Tu sesión expiró. Ingresa otra vez y vuelve a conectar.'],
  error: ['error', 'No se pudo conectar el calendario. Vuelve a intentar.'],
}

const LOGIN_MESSAGES = {
  cancelled: 'Cancelaste el inicio de sesión con Google.',
  state: 'La solicitud expiró o no es válida. Vuelve a intentar.',
  error: 'No pudimos iniciar sesión con Google. Vuelve a intentar.',
  rate_limited: 'Hiciste varios intentos seguidos. Espera unos minutos.',
}

function Shell({ children, email }) {
  return (
    <div className="agadm">
      <header className="agadm-bar">
        <div className="agadm-bar-brand">
          <img src="https://manya.pe/wp-content/uploads/2025/03/manyalogoblue.svg" alt="Manya" width="72" height="24" />
          <span className="agadm-bar-sep" aria-hidden="true" />
          <h1>Agenda · Administración</h1>
        </div>
        {email && (
          <div className="agadm-bar-user">
            <span className="agadm-bar-email" title={email}>{email}</span>
            <LogoutButton />
          </div>
        )}
      </header>
      <div className="agadm-main">{children}</div>
    </div>
  )
}

function GoogleButton() {
  return (
    <a className="agadm-btn agadm-google" href="/api/agenda/admin/login">
      <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
      Iniciar sesión con Google
    </a>
  )
}

function LoginScreen({ status }) {
  if (status === 'denied') {
    return (
      <div className="agadm-card agadm-narrow" role="alert">
        <h2>Sin acceso al panel</h2>
        <p className="agadm-muted">Tu cuenta no tiene acceso. Pídele a un administrador que te agregue.</p>
        <p className="agadm-help">Solo pueden ingresar cuentas @manya.pe autorizadas en <b>Accesos</b>.</p>
        <a className="agadm-btn quiet" href="/api/agenda/admin/login">Probar con otra cuenta</a>
      </div>
    )
  }
  return (
    <div className="agadm-card agadm-narrow">
      <h2>Ingresar</h2>
      <p className="agadm-muted">Panel interno para conectar calendarios, definir horarios y ver las reservas. Ingresa con tu cuenta @manya.pe.</p>
      {LOGIN_MESSAGES[status] && <p className="agadm-error" role="alert">{LOGIN_MESSAGES[status]}</p>}
      <GoogleButton />
    </div>
  )
}

export default async function AgendaAdminPage({ searchParams }) {
  if (!adminConfigured()) {
    return (
      <Shell>
        <div className="agadm-card agadm-narrow">
          <h2>Panel no configurado</h2>
          <p>Faltan variables de entorno en el servidor: {missingAdminVars().map((m) => <code key={m}>{m}</code>)}</p>
          <p className="agadm-help">Agrega también <code>AGENDA_ADMIN_EMAILS</code> con el correo del primer administrador.</p>
        </div>
      </Shell>
    )
  }
  const email = await currentAdmin()
  if (!email) return <Shell><LoginScreen status={searchParams?.login} /></Shell>
  const notice = OAUTH_MESSAGES[searchParams?.oauth] || null
  return (
    <Shell email={email}>
      <AdminPanel missing={missingVars()} notice={notice} me={email} />
    </Shell>
  )
}
