'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SCHEDULE, staffPatch } from '@/lib/agenda/settings'

const DAYS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']]
// [key, label, help, min, max, unit]
const NUMBERS = [
  ['meeting_minutes', 'Duración (min)', 'Lo que dura cada reunión.', 5, 240, 'min'],
  ['slot_step_minutes', 'Intervalo (min)', 'Cada cuánto puede empezar una reunión (ej. 30 → 9:00, 9:30…).', 5, 240, 'min'],
  ['min_notice_hours', 'Anticipación (horas)', 'Mínimo de horas entre ahora y la reunión.', 0, 720, 'h'],
  ['days_ahead', 'Ventana (días)', 'Hasta cuántos días a futuro se muestran horarios.', 1, 60, 'd'],
  ['buffer_minutes', 'Descanso (min)', 'Minutos libres después de cada reunión.', 0, 240, 'min'],
]
const POLICIES = [
  ['priority', 'Cascada (por prioridad)', 'Siempre intenta primero con la persona de mayor prioridad; si no está libre, pasa a la siguiente.'],
  ['round_robin', 'Intercalado (por turnos)', 'Reparte las reuniones para que no siempre las lleve la misma persona: va a quien lleva más tiempo sin recibir una.'],
]
const SECTIONS = [['personas', 'Personas'], ['general', 'Configuración general'], ['asignacion', 'Asignación'], ['reservas', 'Reservas'], ['accesos', 'Accesos']]
const STATUS = { confirmed: 'Confirmada', pending: 'Pendiente', cancelled: 'Cancelada' }
const ERRORS = {
  email_exists: 'Ese correo ya está registrado.',
  invalid: 'Revisa los datos: hay campos inválidos.',
  unauthorized: 'Tu sesión expiró. Recarga la página.',
  not_configured: 'Faltan variables de entorno en el servidor.',
  migration_required: 'Falta ejecutar supabase/agenda_002.sql en Supabase.',
  migration_required_003: 'Falta ejecutar supabase/agenda_003.sql en Supabase.',
  migration_required_004: 'Falta ejecutar supabase/agenda_004.sql en Supabase.',
  invalid_admin_email: 'Usa una cuenta @manya.pe válida.',
  admin_exists: 'Esa cuenta ya tiene acceso.',
  cannot_remove_self: 'No puedes quitarte el acceso a ti mismo.',
  cannot_remove_fixed: 'Esa cuenta está fija en el servidor (AGENDA_ADMIN_EMAILS).',
  not_found: 'Ya no existe. Recarga la página.',
}
const REFRESH_MIN_MS = 3000
const fmtWhen = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

async function api(path, init) {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json' } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(ERRORS[data.error] || 'Error ' + res.status + (data.fields ? ' (' + data.fields.join(', ') + ')' : ''))
  return data
}

function Field({ label, help, children }) {
  return (
    <label className="agadm-field">
      <span className="agadm-label">{label}</span>
      {children}
      {help && <span className="agadm-help">{help}</span>}
    </label>
  )
}

function SectionHead({ id, title, intro, action }) {
  return (
    <header className="agadm-section-head">
      <div>
        <h2 id={id}>{title}</h2>
        {intro && <p className="agadm-muted">{intro}</p>}
      </div>
      {action}
    </header>
  )
}

/** A schedule field: empty = uses the global value (shown as placeholder); a number = personal value. */
function OverrideField({ id, field, value, inherited, onChange }) {
  const [k, label, help, min, max] = field
  const custom = value !== null && value !== undefined && value !== ''
  const input = useRef(null)
  const inputId = id + '-' + k
  return (
    <div className={'agadm-field agadm-ovr' + (custom ? ' is-custom' : '')}>
      <span className="agadm-ovr-top">
        <label className="agadm-label" htmlFor={inputId}>{label}</label>
        <span className={'agadm-tag' + (custom ? '' : ' is-general')}>{custom ? 'Personal' : 'General'}</span>
      </span>
      <span className="agadm-ovr-input">
        <input ref={input} id={inputId} type="number" inputMode="numeric" min={min} max={max} step="1" value={custom ? value : ''}
          placeholder={String(inherited)} aria-describedby={inputId + '-h'} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} />
        {custom && (
          <button type="button" className="agadm-reset" aria-label="Volver a la general" title={'Volver a la general (' + inherited + ')'}
            onClick={() => { onChange(null); input.current?.focus() }}>↺</button>
        )}
      </span>
      <span className="agadm-help" id={inputId + '-h'}>{help}</span>
    </div>
  )
}

function Switch({ id, checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={Boolean(checked)} aria-labelledby={id + '-l'} className="agadm-switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="agadm-switch-track" aria-hidden="true"><span className="agadm-switch-thumb" /></span>
      <span className="agadm-switch-text">
        <span id={id + '-l'} className="agadm-switch-label">Recibe reservas</span>
        <span className="agadm-switch-state" aria-hidden="true">{checked ? 'Activo' : 'Inactivo'}</span>
      </span>
    </button>
  )
}

const connectUrlFor = (id) => '/api/agenda/oauth/start?staff=' + encodeURIComponent(id)

// `initial` is the last server snapshot; `edits` holds only the fields the user changed. Untouched fields
// always show the latest snapshot and are never sent, so a stale tab cannot overwrite newer data.
function StaffCard({ initial, defaults, index, total, onSaved, onMove, expanded, onToggle, isMe }) {
  const [edits, setEdits] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const s = { ...initial, ...edits }
  const patch = staffPatch(initial, edits)
  const dirty = Object.keys(patch).some((k) => k !== 'active')
  const edit = (p) => { setEdits((cur) => ({ ...cur, ...p })); setMsg(null) }
  const hours = s.weekly_hours || {}
  const setDay = (d, list) => edit({ weekly_hours: { ...hours, [d]: list } })
  const panelId = 'staff-panel-' + s.id

  function applySaved(row, keys) {
    onSaved(row)
    setEdits((cur) => {
      const next = { ...cur }
      for (const key of keys) delete next[key]
      return next
    })
  }
  async function save() {
    if (!dirty) return
    const { active: _a, ...body } = patch
    setBusy(true); setMsg(null)
    try {
      const { staff } = await api('/api/agenda/admin/staff/' + s.id, { method: 'PATCH', body: JSON.stringify(body) })
      applySaved(staff, Object.keys(edits).filter((k) => k !== 'active')); setMsg(['ok', 'Guardado'])
    } catch (e) { setMsg(['error', e.message]) }
    setBusy(false)
  }
  async function toggleActive(active) {
    edit({ active })
    try {
      const { staff } = await api('/api/agenda/admin/staff/' + s.id, { method: 'PATCH', body: JSON.stringify({ active }) })
      applySaved(staff, ['active'])
    } catch (e) {
      setEdits((cur) => { const { active: _a, ...rest } = cur; return rest })
      setMsg(['error', e.message])
    }
  }
  async function disconnect() {
    if (!window.confirm('¿Desconectar el calendario de ' + s.name + '? Dejará de recibir reservas.')) return
    setBusy(true)
    try { const { staff } = await api('/api/agenda/admin/staff/' + s.id + '/disconnect', { method: 'POST' }); onSaved(staff) } catch (e) { setMsg(['error', e.message]) }
    setBusy(false)
  }
  // Clicks on the header row toggle the card, except on its own controls (priority, switch, chevron).
  const headClick = (e) => { if (!e.target.closest('button, a, input, label')) onToggle() }
  const status = s.connected ? ['is-on', <><span className="agadm-wide">Calendario conectado</span><span className="agadm-narrow-only">Conectado</span></>] : ['is-off', 'Sin conectar']

  return (
    <article className={'agadm-card agadm-staff' + (expanded ? ' is-open' : '')} aria-labelledby={'staff-name-' + s.id}>
      <div className="agadm-staff-head" onClick={headClick}>
        <div className="agadm-order" role="group" aria-label={'Prioridad de ' + initial.name}>
          <button type="button" className="agadm-icon" aria-label={'Subir prioridad de ' + initial.name} disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button>
          <span className="agadm-rank" title="Prioridad">{index + 1}</span>
          <button type="button" className="agadm-icon" aria-label={'Bajar prioridad de ' + initial.name} disabled={index === total - 1} onClick={() => onMove(index, 1)}>↓</button>
        </div>
        <div className="agadm-staff-id">
          <h3 id={'staff-name-' + s.id}>{initial.name}{isMe && <span className="agadm-badge is-me">Tú</span>}</h3>
          <p className="agadm-muted">{s.email}</p>
        </div>
        <div className="agadm-staff-meta">
          <span className={'agadm-badge ' + status[0]}>{status[1]}</span>
          <Switch id={'staff-active-' + s.id} checked={s.active} onChange={toggleActive} />
        </div>
        <button type="button" className="agadm-chev" aria-expanded={expanded} aria-controls={panelId} aria-label={(expanded ? 'Contraer ' : 'Expandir ') + initial.name} onClick={onToggle}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {isMe && s.connected && !s.active && (
        <p className="agadm-hint">Tu calendario está conectado. Activa “Recibe reservas” cuando quieras empezar a recibir reuniones.</p>
      )}
      {msg?.[0] === 'error' && !expanded && <p className="agadm-hint is-error" role="alert">{msg[1]}</p>}

      <div id={panelId} className="agadm-staff-body" hidden={!expanded}>
        {!s.connected && (
          <div className="agadm-connect-note">
            <span>{isMe ? 'Tu calendario no está conectado.' : 'Aún no conecta su Google Calendar: hasta entonces no recibe reservas.'}</span>
            <a className="agadm-btn sm" href={connectUrlFor(s.id)}>Conectar Google Calendar</a>
          </div>
        )}
        <div className="agadm-grid">
          <Field label="Nombre" help="Aparece en la invitación de Google Calendar.">
            <input value={s.name} maxLength={80} onChange={(e) => edit({ name: e.target.value })} />
          </Field>
          <Field label="Zona horaria" help="Para interpretar su horario semanal.">
            <input value={s.timezone} maxLength={64} onChange={(e) => edit({ timezone: e.target.value })} placeholder="America/Lima" />
          </Field>
        </div>

        <fieldset className="agadm-hours agadm-ovr-set">
          <legend className="agadm-label">Reglas de agenda</legend>
          <p className="agadm-help">Vacío = usa la <b>Configuración general</b>. Escribe un valor solo si es distinto para esta persona.</p>
          <div className="agadm-grid">
            {NUMBERS.map((f) => (
              <OverrideField key={f[0]} id={'staff-' + s.id} field={f} value={s[f[0]]} inherited={defaults[f[0]]} onChange={(v) => edit({ [f[0]]: v })} />
            ))}
          </div>
        </fieldset>

        <fieldset className="agadm-hours">
          <legend className="agadm-label">Horario semanal <span className="agadm-muted">(en su zona horaria)</span></legend>
          <p className="agadm-help">Una franja es un bloque de atención dentro del día. Usa dos franjas para dejar libre el almuerzo, ej.: 09:00–13:30 y 14:30–18:00.</p>
          {DAYS.map(([d, label]) => {
            const list = hours[d] || []
            return (
              <div className="agadm-day" key={d}>
                <span className="agadm-day-name">{label}</span>
                <div className="agadm-ranges">
                  {!list.length && <span className="agadm-muted">No disponible</span>}
                  {list.map((r, i) => (
                    <span className="agadm-range" key={i}>
                      <input type="time" step="900" value={r.start} aria-label={label + ', franja ' + (i + 1) + ', inicio'} onChange={(e) => setDay(d, list.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                      <span aria-hidden="true">–</span>
                      <input type="time" step="900" value={r.end} aria-label={label + ', franja ' + (i + 1) + ', fin'} onChange={(e) => setDay(d, list.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                      <button type="button" className="agadm-x" aria-label={'Quitar franja ' + (i + 1) + ' del ' + label} onClick={() => setDay(d, list.filter((_, j) => j !== i))}>×</button>
                    </span>
                  ))}
                  <button type="button" className="agadm-link" onClick={() => setDay(d, [...list, list.length ? { start: '14:30', end: '18:00' } : { start: '09:00', end: '13:30' }])}>+ Agregar franja</button>
                </div>
              </div>
            )
          })}
        </fieldset>

        <div className="agadm-row agadm-staff-foot">
          <button type="button" className="agadm-btn" onClick={save} disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
          {dirty && <button type="button" className="agadm-btn quiet" onClick={() => { setEdits((cur) => ('active' in cur ? { active: cur.active } : {})); setMsg(null) }} disabled={busy}>Descartar</button>}
          {dirty && !msg && <span className="agadm-muted">Cambios sin guardar</span>}
          {msg && <span className={msg[0] === 'ok' ? 'agadm-saved' : 'agadm-error'} role="status">{msg[0] === 'ok' ? '✓ ' : ''}{msg[1]}</span>}
          {s.connected && <button type="button" className="agadm-danger-link" onClick={disconnect} disabled={busy}>Desconectar calendario</button>}
        </div>
      </div>
    </article>
  )
}

const OPEN_KEY = 'agadm-open-staff'
const MANYA_EMAIL = /^[^\s@]+@manya\.pe$/i
const nameFromEmail = (email) => String(email || '').split('@')[0].replace(/[._+-]+/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase()).trim()

/** "+ Conectar calendario": connect my own calendar, or invite someone else (staff row + panel access). */
function ConnectDialog({ open, onClose, me, myName, ownRow, onConnectMe, onInvited }) {
  const ref = useRef(null)
  const [step, setStep] = useState('choose')
  const [selfName, setSelfName] = useState('')
  const [form, setForm] = useState({ name: '', email: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { setStep('choose'); setErr(''); setDone(null); setCopied(false); setForm({ name: '', email: '' }); d.showModal() }
    if (!open && d.open) d.close()
  }, [open])

  async function connectMe(name) {
    setBusy(true); setErr('')
    try { await onConnectMe(name) } catch (e) { setErr(e.message); setBusy(false) }
  }
  function chooseSelf() {
    if (ownRow || myName) return connectMe(myName || undefined)
    setSelfName(nameFromEmail(me)); setStep('self')
  }
  async function invite(e) {
    e.preventDefault(); setErr('')
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    if (name.length < 2) return setErr('Escribe su nombre.')
    if (!MANYA_EMAIL.test(email)) return setErr('Usa una cuenta @manya.pe.')
    setBusy(true)
    try {
      const d = await api('/api/agenda/admin/staff/invite', { method: 'POST', body: JSON.stringify({ name, email }) })
      onInvited(d.staff)
      setDone({ name: d.staff.name, email: d.staff.email, access: d.access }); setStep('done')
    } catch (e2) { setErr(e2.message) }
    setBusy(false)
  }
  const instructions = done
    ? 'Pídele a ' + done.name + ' que entre a ' + (typeof window !== 'undefined' ? window.location.origin : '') + '/agenda-admin con su cuenta ' + done.email + ' y acepte el permiso de Google Calendar al iniciar sesión.'
    : ''
  async function copy() {
    try { await navigator.clipboard.writeText(instructions); setCopied(true) } catch { setCopied(false) }
  }
  const connected = Boolean(ownRow?.connected)

  return (
    <dialog ref={ref} className="agadm-dialog" aria-labelledby="connect-title" closedby="any" onClose={() => { setBusy(false); onClose() }}>
      <div className="agadm-dialog-head">
        <h1 id="connect-title">{step === 'done' ? 'Persona invitada' : step === 'invite' ? 'Invitar a otra persona' : 'Conectar calendario'}</h1>
        <button type="button" className="agadm-x" aria-label="Cerrar" onClick={onClose}>×</button>
      </div>

      {step === 'choose' && (
        <div className="agadm-options">
          {connected ? (
            <div className="agadm-option is-done">
              <span className="agadm-option-icon" aria-hidden="true">✓</span>
              <span><span className="agadm-option-title">Tu calendario ya está conectado</span><span className="agadm-help">{me}</span></span>
            </div>
          ) : (
            <button type="button" className="agadm-option" onClick={chooseSelf} disabled={busy} autoFocus>
              <span className="agadm-option-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg></span>
              <span>
                <span className="agadm-option-title">{ownRow ? 'Reconectar mi calendario' : 'Conectar mi calendario'}</span>
                <span className="agadm-help">Usa tu cuenta de Google ({me}). Te llevamos a Google para dar permiso a tu calendario.</span>
              </span>
            </button>
          )}
          <button type="button" className="agadm-option" onClick={() => { setErr(''); setStep('invite') }} autoFocus={connected}>
            <span className="agadm-option-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg></span>
            <span>
              <span className="agadm-option-title">Invitar a otra persona</span>
              <span className="agadm-help">Le das acceso al panel; al iniciar sesión con Google su calendario queda conectado.</span>
            </span>
          </button>
          {err && <p className="agadm-error" role="alert">{err}</p>}
        </div>
      )}

      {step === 'self' && (
        <form className="agadm-dialog-body" onSubmit={(e) => { e.preventDefault(); if (selfName.trim().length >= 2) connectMe(selfName.trim()) }}>
          <Field label="Tu nombre" help="Aparece en la invitación de Google Calendar.">
            <input value={selfName} maxLength={80} required minLength={2} autoFocus onChange={(e) => setSelfName(e.target.value)} />
          </Field>
          <div className="agadm-row">
            <button className="agadm-btn" type="submit" disabled={busy}>{busy ? 'Abriendo Google…' : 'Continuar con Google'}</button>
            <button className="agadm-btn quiet" type="button" onClick={() => setStep('choose')}>Volver</button>
          </div>
          {err && <p className="agadm-error" role="alert">{err}</p>}
        </form>
      )}

      {step === 'invite' && (
        <form className="agadm-dialog-body" onSubmit={invite} noValidate>
          <Field label="Nombre" help="Como aparecerá en la invitación.">
            <input value={form.name} maxLength={80} required autoFocus onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr('') }} />
          </Field>
          <Field label="Correo @manya.pe" help="Su cuenta de Google: con ella entrará al panel.">
            <input type="email" value={form.email} maxLength={120} required placeholder="nombre@manya.pe" pattern="[^\s@]+@manya\.pe"
              onChange={(e) => { setForm({ ...form, email: e.target.value }); setErr('') }} />
          </Field>
          <p className="agadm-help">Empieza inactiva, de lunes a viernes, con la configuración general.</p>
          <div className="agadm-row">
            <button className="agadm-btn" type="submit" disabled={busy}>{busy ? 'Invitando…' : 'Invitar'}</button>
            <button className="agadm-btn quiet" type="button" onClick={() => { setStep('choose'); setErr('') }}>Volver</button>
          </div>
          {err && <p className="agadm-error" role="alert">{err}</p>}
        </form>
      )}

      {step === 'done' && done && (
        <div className="agadm-dialog-body">
          <p className="agadm-alert is-ok" role="status">{done.name} ya está en la lista{done.access === 'added' ? ' y tiene acceso al panel.' : '.'}</p>
          {(done.access === 'already' || done.access === 'fixed') && <p className="agadm-help">Ya tenía acceso al panel.</p>}
          {done.access === 'migration_required' && <p className="agadm-alert is-warn">No se pudo darle acceso: falta ejecutar <code>supabase/agenda_004.sql</code>. Agrégala en <b>Accesos</b> cuando esté lista.</p>}
          {done.access === 'error' && <p className="agadm-alert">No se pudo darle acceso al panel. Agrégala en <b>Accesos</b>.</p>}
          <div className="agadm-copy">
            <p>{instructions}</p>
            <button type="button" className="agadm-btn quiet sm" onClick={copy}>{copied ? '✓ Copiado' : 'Copiar'}</button>
          </div>
          <div className="agadm-row">
            <button type="button" className="agadm-btn" onClick={onClose} autoFocus>Listo</button>
          </div>
        </div>
      )}
    </dialog>
  )
}

function PeopleSection({ staff, setStaff, loadError, defaults, me, myName }) {
  const [dialog, setDialog] = useState(false)
  const [orderMsg, setOrderMsg] = useState('')
  const [open, setOpen] = useState(() => new Set())
  useEffect(() => {
    try { setOpen(new Set(JSON.parse(sessionStorage.getItem(OPEN_KEY) || '[]'))) } catch { /* storage blocked */ }
  }, [])
  const toggle = (id) => setOpen((cur) => {
    const n = new Set(cur)
    n.has(id) ? n.delete(id) : n.add(id)
    try { sessionStorage.setItem(OPEN_KEY, JSON.stringify([...n])) } catch { /* storage blocked */ }
    return n
  })
  const ownRow = staff?.find((x) => x.email === me) || null

  async function connectMe(name) {
    const { staff: row } = await api('/api/agenda/admin/staff/me', { method: 'POST', body: JSON.stringify(name ? { name } : {}) })
    setStaff((cur) => (cur?.some((x) => x.id === row.id) ? cur : [...(cur || []), row]))
    if (!row.connected) window.location.assign(connectUrlFor(row.id))
  }
  async function move(i, dir) {
    const prev = staff
    const next = [...staff]
    const j = i + dir
    ;[next[i], next[j]] = [next[j], next[i]]
    setStaff(next); setOrderMsg('')
    try { await api('/api/agenda/admin/staff/order', { method: 'PUT', body: JSON.stringify({ ids: next.map((x) => x.id) }) }) } catch (e) { setStaff(prev); setOrderMsg(e.message) }
  }
  const saved = (row) => setStaff((cur) => cur.map((x) => (x.id === row.id ? row : x)))

  return (
    <section className="agadm-section" aria-labelledby="sec-personas">
      {ownRow && !ownRow.connected && (
        <div className="agadm-banner" role="region" aria-label="Conecta tu calendario">
          <span>
            <b>Conecta tu Google Calendar para empezar a recibir reservas</b>
            <span className="agadm-help">Solo se ofrecen tus espacios libres; nadie ve el detalle de tus eventos.</span>
          </span>
          <a className="agadm-btn" href={connectUrlFor(ownRow.id)}>Conectar Google Calendar</a>
        </div>
      )}
      <SectionHead
        id="sec-personas"
        title="Personas"
        intro="Cada persona conecta su propio Google Calendar. Sus horarios se cruzan en vivo con su calendario y solo se ofrecen los espacios libres. El orden de la lista es la prioridad de la asignación en cascada."
        action={<button type="button" className="agadm-btn" onClick={() => setDialog(true)}>+ Conectar calendario</button>}
      />
      <ConnectDialog open={dialog} onClose={() => setDialog(false)} me={me} myName={myName} ownRow={ownRow} onConnectMe={connectMe}
        onInvited={(row) => setStaff((cur) => [...(cur || []), row])} />
      {orderMsg && <p className="agadm-alert" role="alert">{orderMsg}</p>}
      {loadError && <p className="agadm-alert">{loadError}</p>}
      {staff === null
        ? <p className="agadm-muted">Cargando…</p>
        : staff.map((s, i) => (
          <StaffCard key={s.id} initial={s} defaults={defaults} index={i} total={staff.length} onSaved={saved} onMove={move}
            expanded={open.has(s.id)} onToggle={() => toggle(s.id)} isMe={s.email === me} />
        ))}
      {staff && !staff.length && !loadError && <p className="agadm-empty">Aún no hay personas. Pulsa “Conectar calendario” para agregar la primera.</p>}
    </section>
  )
}

function GeneralSection({ settings, onSaved }) {
  const saved = settings?.defaults || null
  const [draft, setDraft] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const value = { ...(saved || DEFAULT_SCHEDULE), ...draft }
  const changed = saved ? Object.fromEntries(Object.entries(draft).filter(([k, v]) => String(v) !== String(saved[k]))) : {}
  const dirty = Object.keys(changed).length > 0
  const locked = !settings || settings.defaults_missing

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const d = await api('/api/agenda/admin/settings', { method: 'PUT', body: JSON.stringify({ defaults: changed }) })
      onSaved(d.defaults); setDraft({}); setMsg(['ok', 'Guardado'])
    } catch (e) { setMsg(['error', e.message]) }
    setBusy(false)
  }

  return (
    <section className="agadm-section" aria-labelledby="sec-general">
      <SectionHead
        id="sec-general"
        title="Configuración general"
        intro="Reglas de agenda para todo el equipo. Cada persona las usa salvo que tenga un valor personalizado en su ficha de Personas: en ese caso, manda el suyo."
      />
      <div className="agadm-card">
        {settings?.defaults_missing && (
          <p className="agadm-alert is-warn">Falta ejecutar <code>supabase/agenda_003.sql</code>: mientras tanto se usan estos valores por defecto y no se pueden cambiar aquí.</p>
        )}
        <fieldset className="agadm-plain" disabled={locked}>
          <div className="agadm-grid">
            {NUMBERS.map(([k, label, help, min, max]) => (
              <Field key={k} label={label} help={help}>
                <input type="number" inputMode="numeric" min={min} max={max} step="1" value={value[k]} onChange={(e) => { setDraft((cur) => ({ ...cur, [k]: e.target.value })); setMsg(null) }} />
              </Field>
            ))}
          </div>
        </fieldset>
        <div className="agadm-row">
          <button type="button" className="agadm-btn" onClick={save} disabled={busy || !dirty || locked}>{busy ? 'Guardando…' : 'Guardar'}</button>
          {dirty && !msg && <span className="agadm-muted">Cambios sin guardar</span>}
          {msg && <span className={msg[0] === 'ok' ? 'agadm-saved' : 'agadm-error'} role="status">{msg[0] === 'ok' ? '✓ ' : ''}{msg[1]}</span>}
        </div>
      </div>
    </section>
  )
}

function AssignmentSection({ saved, onSaved, loadError }) {
  const [choice, setChoice] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const policy = choice ?? saved
  const dirty = choice !== null && choice !== saved

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const d = await api('/api/agenda/admin/settings', { method: 'PUT', body: JSON.stringify({ policy }) })
      onSaved(d.assignment.policy); setChoice(null); setMsg(['ok', 'Guardado.'])
    } catch (e) { setMsg(['error', e.message]) }
    setBusy(false)
  }

  return (
    <section className="agadm-section" aria-labelledby="sec-asignacion">
      <SectionHead
        id="sec-asignacion"
        title="Asignación"
        intro="El cliente ve un horario mientras al menos una persona activa y conectada esté libre a esa hora. Esta regla decide quién recibe la reunión cuando varias lo están. El cliente sabe quién lo atenderá recién en la invitación."
      />
      {loadError && <p className="agadm-alert">{loadError}</p>}
      <div className="agadm-card">
        <fieldset className="agadm-policies" disabled={!policy}>
          <legend className="agadm-label">Política de asignación</legend>
          {POLICIES.map(([value, label, help]) => (
            <label key={value} className={'agadm-policy' + (policy === value ? ' is-on' : '')}>
              <input type="radio" name="policy" value={value} checked={policy === value} onChange={() => { setChoice(value); setMsg(null) }} />
              <span>
                <span className="agadm-label">{label}</span>
                <span className="agadm-help">{help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="agadm-help">En cascada, la prioridad es el orden de la lista en <b>Personas</b> (cámbialo con ↑ ↓). Si una persona tiene otra duración personalizada, el horario dura lo que dura con quien lo recibiría.</p>
        <div className="agadm-row">
          <button type="button" className="agadm-btn" onClick={save} disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar'}</button>
          {dirty && !msg && <span className="agadm-muted">Cambios sin guardar</span>}
          {msg && <span className={msg[0] === 'ok' ? 'agadm-ok' : 'agadm-error'} role="status">{msg[1]}</span>}
        </div>
      </div>
    </section>
  )
}

function BookingsSection() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError('')
    try { setRows((await api('/api/agenda/admin/bookings')).bookings) } catch (e) { setError(e.message); setRows([]) }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <section className="agadm-section" aria-labelledby="sec-reservas">
      <SectionHead
        id="sec-reservas"
        title="Reservas"
        intro="Próximas reuniones agendadas desde el formulario, en hora de Lima. Solo lectura: para mover o cancelar una, hazlo desde Google Calendar."
        action={<button type="button" className="agadm-btn quiet" onClick={load}>Actualizar</button>}
      />
      {error && <p className="agadm-alert">{error}</p>}
      {rows === null ? <p className="agadm-muted">Cargando…</p> : !rows.length ? (
        !error && <p className="agadm-empty">No hay reservas próximas.</p>
      ) : (
        <div className="agadm-card agadm-table-wrap">
          <table className="agadm-table">
            <thead>
              <tr><th scope="col">Fecha y hora</th><th scope="col">Cliente</th><th scope="col">Asignada a</th><th scope="col">Meet</th><th scope="col">Estado</th></tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const d = new Date(b.starts_at)
                return (
                  <tr key={b.id}>
                    <td data-k="Fecha y hora"><b>{cap(fmtWhen.format(d))}</b><span className="agadm-mono">{fmtTime.format(d)}–{fmtTime.format(new Date(b.ends_at))}</span></td>
                    <td data-k="Cliente"><b>{b.lead.nombre || '—'}</b><span>{b.lead.empresa}</span>{b.lead.correo && <a href={'mailto:' + b.lead.correo}>{b.lead.correo}</a>}</td>
                    <td data-k="Asignada a">{b.staff?.name || '—'}</td>
                    <td data-k="Meet">{b.meet_link ? <a href={b.meet_link} target="_blank" rel="noopener noreferrer">Abrir Meet</a> : '—'}</td>
                    <td data-k="Estado"><span className={'agadm-badge st-' + b.status}>{STATUS[b.status] || b.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AccessSection({ me }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { setData(await api('/api/agenda/admin/admins')); setError('') } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault(); setMsg(null); setBusy(true)
    try {
      await api('/api/agenda/admin/admins', { method: 'POST', body: JSON.stringify({ email }) })
      setEmail(''); setMsg(['ok', 'Acceso agregado.']); await load()
    } catch (err) { setMsg(['error', err.message]) }
    setBusy(false)
  }
  async function remove(target) {
    if (!window.confirm('¿Quitar el acceso de ' + target + '?')) return
    setMsg(null)
    try { await api('/api/agenda/admin/admins', { method: 'DELETE', body: JSON.stringify({ email: target }) }); await load() } catch (err) { setMsg(['error', err.message]) }
  }
  const rows = data ? [
    ...data.fixed.map((e) => ({ email: e, fixed: true })),
    ...data.admins.map((a) => ({ email: a.email, added_by: a.added_by, fixed: false })),
  ] : null

  return (
    <section className="agadm-section" aria-labelledby="sec-accesos">
      <SectionHead
        id="sec-accesos"
        title="Accesos"
        intro="Cuentas @manya.pe que pueden ingresar a este panel con Google. Las cuentas fijas vienen de la configuración del servidor y no se pueden quitar desde aquí."
      />
      {error && <p className="agadm-alert">{error}</p>}
      {data?.migration_required && (
        <p className="agadm-alert is-warn">Falta ejecutar <code>supabase/agenda_004.sql</code> en Supabase: mientras tanto solo ingresan las cuentas fijas.</p>
      )}
      <div className="agadm-card">
        <form className="agadm-access-add" onSubmit={add}>
          <Field label="Agregar acceso" help="Debe ser una cuenta de Google @manya.pe.">
            <input type="email" value={email} maxLength={120} required placeholder="nombre@manya.pe" onChange={(e) => { setEmail(e.target.value); setMsg(null) }} disabled={data?.migration_required} />
          </Field>
          <button className="agadm-btn" type="submit" disabled={busy || data?.migration_required}>{busy ? 'Agregando…' : 'Agregar'}</button>
        </form>
        {msg && <p className={msg[0] === 'ok' ? 'agadm-ok' : 'agadm-error'} role="status">{msg[1]}</p>}
        {rows === null ? <p className="agadm-muted">Cargando…</p> : (
          <ul className="agadm-access">
            {rows.map((r) => (
              <li key={r.email}>
                <span className="agadm-access-id">
                  <b>{r.email}</b>
                  {r.email === me && <span className="agadm-badge is-on">Tú</span>}
                  {r.fixed && <span className="agadm-badge">Fijo</span>}
                  {!r.fixed && r.added_by && <span className="agadm-muted">Agregado por {r.added_by}</span>}
                </span>
                {!r.fixed && r.email !== me && <button type="button" className="agadm-btn quiet sm" onClick={() => remove(r.email)}>Quitar</button>}
              </li>
            ))}
            {!rows.length && <li className="agadm-muted">Aún no hay cuentas.</li>}
          </ul>
        )}
      </div>
    </section>
  )
}

export default function AdminPanel({ missing, notice, me, myName = '' }) {
  const [section, setSection] = useState('personas')
  const [staff, setStaff] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [migration, setMigration] = useState(false)
  const [settings, setSettings] = useState(null)
  const [settingsError, setSettingsError] = useState('')
  const lastLoad = useRef(0)

  useEffect(() => {
    const h = window.location.hash.slice(1)
    if (SECTIONS.some(([k]) => k === h)) setSection(h)
  }, [])
  const go = (k) => { setSection(k); try { history.replaceState(null, '', '#' + k) } catch { /* ignore */ } }

  const load = useCallback(async () => {
    lastLoad.current = Date.now()
    const [st, se] = await Promise.allSettled([api('/api/agenda/admin/staff'), api('/api/agenda/admin/settings')])
    if (st.status === 'fulfilled') { setStaff(st.value.staff); setMigration(Boolean(st.value.migration_required)); setLoadError('') }
    else { setLoadError(st.reason.message); setStaff((cur) => cur || []) }
    if (se.status === 'fulfilled') { setSettings(se.value); setSettingsError('') }
    else setSettingsError(se.reason.message)
  }, [])
  useEffect(() => { load() }, [load])

  // A tab left open goes stale (e.g. a migration rewrote the data): refetch when it regains focus.
  // Cards keep only the fields being edited, so this never discards unsaved changes.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REFRESH_MIN_MS) load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [load])

  const defaults = settings?.defaults || DEFAULT_SCHEDULE

  return (
    <div className="agadm-layout">
      <nav className="agadm-nav" aria-label="Secciones del panel">
        {SECTIONS.map(([k, label]) => (
          <button key={k} type="button" className="agadm-nav-item" aria-current={section === k ? 'page' : undefined} onClick={() => go(k)}>
            <span>{label}</span>
            {k === 'personas' && staff && <span className="agadm-count">{staff.length}</span>}
          </button>
        ))}
      </nav>
      <div className="agadm-content">
        {missing.length > 0 && (
          <p className="agadm-alert">Faltan variables de entorno: {missing.map((m) => <code key={m}>{m}</code>)}</p>
        )}
        {(migration || settings?.migration_required) && (
          <p className="agadm-alert is-warn">Falta ejecutar <code>supabase/agenda_002.sql</code> en Supabase: sin eso no se guardan la prioridad ni la política de asignación.</p>
        )}
        {settings?.defaults_missing && (
          <p className="agadm-alert is-warn">Falta ejecutar <code>supabase/agenda_003.sql</code> en Supabase: sin eso no hay configuración general y cada persona usa sus propios valores.</p>
        )}
        {notice && <p className={'agadm-alert' + (notice[0] === 'ok' ? ' is-ok' : notice[0] === 'warn' ? ' is-warn' : '')} role="status">{notice[1]}</p>}
        {section === 'personas' && <PeopleSection staff={staff} setStaff={setStaff} loadError={loadError} defaults={defaults} me={me} myName={myName} />}
        {section === 'general' && (
          <>
            {settingsError && <p className="agadm-alert">{settingsError}</p>}
            <GeneralSection settings={settings} onSaved={(d) => setSettings((cur) => ({ ...cur, defaults: d }))} />
          </>
        )}
        {section === 'asignacion' && (
          <AssignmentSection saved={settings?.assignment?.policy || null} loadError={settingsError}
            onSaved={(p) => setSettings((cur) => ({ ...cur, assignment: { policy: p } }))} />
        )}
        {section === 'reservas' && <BookingsSection />}
        {section === 'accesos' && <AccessSection me={me} />}
      </div>
    </div>
  )
}
