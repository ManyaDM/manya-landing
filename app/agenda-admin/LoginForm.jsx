'use client'
import { useState } from 'react'

export default function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/agenda/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      })
      if (res.ok) { window.location.reload(); return }
      setError(res.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'Contraseña incorrecta.')
    } catch {
      setError('No hay conexión. Vuelve a intentar.')
    }
    setBusy(false)
  }

  return (
    <form className="agadm-card agadm-narrow" onSubmit={submit}>
      <h2>Ingresar</h2>
      <p className="agadm-muted">Panel interno para conectar calendarios, definir horarios y ver las reservas.</p>
      <label className="agadm-field">
        <span className="agadm-label">Contraseña</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
      </label>
      {error && <p className="agadm-error" role="alert">{error}</p>}
      <button className="agadm-btn" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  )
}
