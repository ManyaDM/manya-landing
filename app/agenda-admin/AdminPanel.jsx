'use client'
import { useCallback, useEffect, useState } from 'react'

const DAYS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']]
const NUMBERS = [
  ['meeting_minutes', 'Duración (min)', 5, 240],
  ['slot_step_minutes', 'Cada (min)', 5, 240],
  ['min_notice_hours', 'Anticipación (h)', 0, 720],
  ['days_ahead', 'Días hacia adelante', 1, 60],
  ['buffer_minutes', 'Margen entre citas (min)', 0, 240],
]
const ERRORS = {
  email_exists: 'Ese correo ya está registrado.',
  invalid: 'Revisa los datos: hay campos inválidos.',
  unauthorized: 'Tu sesión expiró. Recarga la página.',
  not_configured: 'Faltan variables de entorno en el servidor.',
}

async function api(path, init) {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json' } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(ERRORS[data.error] || 'Error ' + res.status + (data.fields ? ' (' + data.fields.join(', ') + ')' : ''))
  return data
}

function StaffCard({ initial, onSaved }) {
  const [s, setS] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setS(initial); setDirty(false) }, [initial])

  const set = (patch) => { setS((cur) => ({ ...cur, ...patch })); setDirty(true); setMsg(null) }
  const hours = s.weekly_hours || {}
  const setDay = (d, list) => set({ weekly_hours: { ...hours, [d]: list } })

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const body = { name: s.name, active: s.active, timezone: s.timezone, weekly_hours: hours }
      for (const [k] of NUMBERS) body[k] = Number(s[k])
      const { staff } = await api('/api/agenda/admin/staff/' + s.id, { method: 'PATCH', body: JSON.stringify(body) })
      onSaved(staff); setMsg(['ok', 'Guardado.'])
    } catch (e) { setMsg(['error', e.message]) }
    setBusy(false)
  }
  async function toggleActive(active) {
    set({ active })
    try {
      const { staff } = await api('/api/agenda/admin/staff/' + s.id, { method: 'PATCH', body: JSON.stringify({ active }) })
      onSaved(staff)
    } catch (e) { setMsg(['error', e.message]) }
  }
  async function disconnect() {
    if (!window.confirm('¿Desconectar el calendario de ' + s.name + '? Dejará de recibir reservas.')) return
    setBusy(true)
    try { const { staff } = await api('/api/agenda/admin/staff/' + s.id + '/disconnect', { method: 'POST' }); onSaved(staff) } catch (e) { setMsg(['error', e.message]) }
    setBusy(false)
  }

  return (
    <article className="agadm-card agadm-staff">
      <header className="agadm-staff-head">
        <div>
          <h2>{initial.name}</h2>
          <p className="agadm-muted">{s.email}</p>
        </div>
        <div className="agadm-staff-actions">
          <span className={'agadm-badge ' + (s.connected ? 'is-on' : '')}>{s.connected ? 'Calendario conectado' : 'Sin conectar'}</span>
          <label className="agadm-switch">
            <input type="checkbox" checked={Boolean(s.active)} onChange={(e) => toggleActive(e.target.checked)} />
            <span>{s.active ? 'Recibe reservas' : 'Pausado'}</span>
          </label>
        </div>
      </header>

      <div className="agadm-row">
        {s.connected
          ? <button type="button" className="agadm-btn quiet" onClick={disconnect} disabled={busy}>Desconectar Google Calendar</button>
          : <a className="agadm-btn" href={'/api/agenda/oauth/start?staff=' + encodeURIComponent(s.id)}>Conectar Google Calendar</a>}
      </div>

      <div className="agadm-grid">
        <label className="agadm-field"><span>Nombre</span><input value={s.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="agadm-field"><span>Zona horaria</span><input value={s.timezone} maxLength={64} onChange={(e) => set({ timezone: e.target.value })} placeholder="America/Lima" /></label>
        {NUMBERS.map(([k, label, min, max]) => (
          <label className="agadm-field" key={k}><span>{label}</span>
            <input type="number" min={min} max={max} step="1" value={s[k]} onChange={(e) => set({ [k]: e.target.value })} />
          </label>
        ))}
      </div>

      <fieldset className="agadm-hours">
        <legend>Horario semanal <span className="agadm-muted">(en su zona horaria)</span></legend>
        {DAYS.map(([d, label]) => {
          const list = hours[d] || []
          return (
            <div className="agadm-day" key={d}>
              <span className="agadm-day-name">{label}</span>
              <div className="agadm-ranges">
                {!list.length && <span className="agadm-muted">No disponible</span>}
                {list.map((r, i) => (
                  <span className="agadm-range" key={i}>
                    <input type="time" step="900" value={r.start} aria-label={label + ' inicio'} onChange={(e) => setDay(d, list.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                    <span aria-hidden="true">–</span>
                    <input type="time" step="900" value={r.end} aria-label={label + ' fin'} onChange={(e) => setDay(d, list.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                    <button type="button" className="agadm-x" aria-label="Quitar franja" onClick={() => setDay(d, list.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
                <button type="button" className="agadm-link" onClick={() => setDay(d, [...list, list.length ? { start: '15:00', end: '18:00' } : { start: '09:00', end: '18:00' }])}>+ Franja</button>
              </div>
            </div>
          )
        })}
      </fieldset>

      <div className="agadm-row">
        <button type="button" className="agadm-btn" onClick={save} disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        {msg && <span className={msg[0] === 'ok' ? 'agadm-ok' : 'agadm-error'} role="status">{msg[1]}</span>}
      </div>
    </article>
  )
}

export default function AdminPanel({ missing, notice }) {
  const [staff, setStaff] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ name: '', email: '' })
  const [addMsg, setAddMsg] = useState('')

  const load = useCallback(async () => {
    setLoadError('')
    try { setStaff((await api('/api/agenda/admin/staff')).staff) } catch (e) { setLoadError(e.message); setStaff([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault(); setAddMsg('')
    try {
      const { staff: row } = await api('/api/agenda/admin/staff', { method: 'POST', body: JSON.stringify(form) })
      setStaff((cur) => [...(cur || []), row]); setForm({ name: '', email: '' })
    } catch (err) { setAddMsg(err.message) }
  }
  async function logout() {
    await fetch('/api/agenda/admin/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/agenda-admin'
  }
  const saved = (row) => setStaff((cur) => cur.map((x) => (x.id === row.id ? row : x)))

  return (
    <div className="agadm-wrap">
      <div className="agadm-top">
        <div>
          <h1>Agenda · Mapa de Fugas</h1>
          <p className="agadm-muted">Cada persona conecta su propio Google Calendar. Las reservas se reparten en orden (a quien le toca primero).</p>
        </div>
        <button type="button" className="agadm-btn quiet" onClick={logout}>Salir</button>
      </div>

      {missing.length > 0 && (
        <p className="agadm-alert">Faltan variables de entorno: {missing.map((m) => <code key={m}>{m}</code>)}</p>
      )}
      {notice && <p className={notice[0] === 'ok' ? 'agadm-alert is-ok' : 'agadm-alert'} role="status">{notice[1]}</p>}
      {loadError && <p className="agadm-alert">{loadError}</p>}

      {staff === null ? <p className="agadm-muted">Cargando…</p> : staff.map((s) => <StaffCard key={s.id} initial={s} onSaved={saved} />)}
      {staff && !staff.length && !loadError && <p className="agadm-muted">Aún no hay personas. Agrega la primera.</p>}

      <form className="agadm-card agadm-add" onSubmit={add}>
        <h2>Agregar persona</h2>
        <div className="agadm-grid">
          <label className="agadm-field"><span>Nombre</span><input value={form.name} maxLength={80} required onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="agadm-field"><span>Correo @manya.pe</span><input type="email" value={form.email} maxLength={120} required onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        </div>
        <div className="agadm-row">
          <button className="agadm-btn" type="submit">Agregar persona</button>
          {addMsg && <span className="agadm-error" role="alert">{addMsg}</span>}
        </div>
      </form>
    </div>
  )
}
