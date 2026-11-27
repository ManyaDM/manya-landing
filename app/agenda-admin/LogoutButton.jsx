'use client'

export default function LogoutButton() {
  async function logout() {
    await fetch('/api/agenda/admin/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/agenda-admin'
  }
  return <button type="button" className="agadm-btn quiet sm" onClick={logout}>Cerrar sesión</button>
}
