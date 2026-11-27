import { adminConfigured, missingVars } from '@/lib/agenda/config'
import { isAdmin } from '@/lib/agenda/session'
import LoginForm from './LoginForm'
import AdminPanel from './AdminPanel'
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

export default function AgendaAdminPage({ searchParams }) {
  if (!adminConfigured()) {
    return (
      <div className="agadm">
        <div className="agadm-card agadm-narrow">
          <h1>Agenda</h1>
          <p>Configura <code>AGENDA_ADMIN_PASSWORD</code> y <code>AGENDA_SESSION_SECRET</code> en el servidor para activar este panel.</p>
        </div>
      </div>
    )
  }
  if (!isAdmin()) return <div className="agadm"><LoginForm /></div>
  const notice = OAUTH_MESSAGES[searchParams?.oauth] || null
  return (
    <div className="agadm">
      <AdminPanel missing={missingVars()} notice={notice} />
    </div>
  )
}
