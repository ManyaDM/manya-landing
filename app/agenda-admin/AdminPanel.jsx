'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SCHEDULE, staffPatch } from '@/lib/agenda/settings'

const DAYS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']]
// [key, label, help, min, max, unit]
const NUMBERS = [
  ['meeting_minutes', 'Duración (min)', 'Lo que dura cada reunión.', 5, 240, 'min'],
  ['slot_step_minutes', 'Intervalo entre inicios (min)', 'Cada cuánto puede empezar una reunión. Ej.: 30 → 9:00, 9:30, 10:00…', 5, 240, 'min'],
  ['min_notice_hours', 'Anticipación mínima (horas)', 'No se puede agendar con menos de este tiempo. Ej.: 12 → si son las 10:00, el primer horario será a las 22:00 o después.', 0, 720, 'h'],
  ['days_ahead', 'Ventana de reserva (días)', 'Hasta cuántos días en el futuro se pueden ver horarios.', 1, 60, 'd'],
  ['buffer_minutes', 'Descanso después de cada reunión (min)', 'Tiempo libre que se deja después de cada reunión o evento antes de ofrecer otro horario.', 0, 240, 'min'],
]
const POLICIES = [
  ['priority', 'Cascada (por prioridad)', 'Siempre intenta primero con la persona de mayor prioridad; si no está libre, pasa a la siguiente.'],
  ['round_robin', 'Intercalado (por turnos)', 'Reparte las reuniones para que no siempre las lleve la misma persona: va a quien lleva más tiempo sin recibir una.'],
]
const SECTIONS = [['personas', 'Personas'], ['general', 'Configuración general'], ['asignacion', 'Asignación'], ['reservas', 'Reservas']]
const STATUS = { confirmed: 'Confirmada', pending: 'Pendiente', cancelled: 'Cancelada' }
const ERRORS = {
  email_exists: 'Ese correo ya está registrado.',
  invalid: 'Revisa los datos: hay campos inválidos.',
  unauthorized: 'Tu sesión expiró. Recarga la página.',
  not_configured: 'Faltan variables de entorno en el servidor.',
  migration_required: 'Falta ejecutar supabase/agenda_002.sql en Supabase.',
  migration_required_003: 'Falta ejecutar supabase/agenda_003.sql en Supabase.',
}
const REFRESH_MIN_MS = 3000
const fmtWhen = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const withUnit = (n, unit) => {
  if (unit === 'h') return n + (Number(n) === 1 ? ' hora' : ' horas')
  if (unit === 'd') return n + (Number(n) === 1 ? ' día' : ' días')
  return n + ' min'
}

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
      {help && <span className="agadm-help">{help}</span>}
      {children}
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

/** A schedule field that inherits the global value until it is personalized for this person. */
function OverrideField({ id, field, value, inherited, onChange }) {
  const [k, label, help, min, max, unit] = field
  const custom = value !== null && value !== undefined
  const input = useRef(null)
  const focusNext = useRef(false)
  useEffect(() => { if (custom && focusNext.current) { focusNext.current = false; input.current?.focus() } }, [custom])
  const inputId = id + '-' + k
  return (
    <div className={'agadm-field agadm-ovr' + (custom ? ' is-custom' : '')}>
      <span className="agadm-ovr-top">
        <label className="agadm-label" htmlFor={custom ? inputId : undefined} id={inputId + '-l'}>{label}</label>
        {custom && <span className="agadm-tag">Personalizado</span>}
      </span>
      <span className="agadm-help">{help}</span>
      {custom ? (
        <div className="agadm-ovr-box">
          <input ref={input} id={inputId} type="number" inputMode="numeric" min={min} max={max} step="1" value={value} onChange={(e) => onChange(e.target.value)} />
          <span className="agadm-ovr-meta">
            <span className="agadm-muted">General: {withUnit(inherited, unit)}</span>
            <button type="button" className="agadm-link" onClick={() => onChange(null)}>Volver a la general</button>
          </span>
        </div>
      ) : (
        <div className="agadm-ovr-box is-inherited">
          <span className="agadm-inherit">Usa la general: <b>{withUnit(inherited, unit)}</b></span>
          <button type="button" className="agadm-btn quiet sm" aria-label={'Personalizar ' + label.toLowerCase()} onClick={() => { focusNext.current = true; onChange(String(inherited)) }}>Personalizar</button>
        </div>
      )}
    </div>
  )
}

// `initial` is the last server snapshot; `edits` holds only the fields the user changed. Untouched fields
// always show the latest snapshot and are never sent, so a stale tab cannot overwrite newer data.
function StaffCard({ initial, defaults, index, total, onSaved, onMove, expanded, onToggle }) {
  const [edits, setEdits] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const s = { ...initial, ...edits }
  const patch = staffPatch(initial, edits)
  const dirty = Object.keys(patch).length > 0
  const edit = (p) => { setEdits((cur) => ({ ...cur, ...p })); setMsg(null) }
  const hours = s.weekly_hours || {}
  const setDay = (d, list) => edit({ weekly_hours: { ...hours, [d]: list } })
  const panelId = 'staff-panel-' + s.id
  const connectUrl = '/api/agenda/oauth/start?staff=' + encodeURIComponent(s.id)

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
    setBusy(true); setMsg(null)
    try {
      const { staff } = await api('/api/agenda/admin/staff/' + s.id, { method: 'PATCH', body: JSON.stringify(patch) })
      applySaved(staff, Object.keys(edits)); setMsg(['ok', 'Guardado.'])
    } catch (e) { setMsg(['error', e.message]) }
    setBusy(false)
  }
  async function toggleActive(active) {
    edit({ active })
    try {
      const { staff } = await api('/api/agenda/admin/staff/' + s.id, { method: 'PATCH', body: JSON.stringify({ active }) })
      applySaved(staff, ['active'])
    } catch (e) { setMsg(['error', e.message]) }
  }
  async function disconnect() {
    if (!window.confirm('¿Desconectar el calendario de ' + s.name + '? Dejará de recibir reservas.')) return
    setBusy(true)
    try { const { staff } = await api('/api/agenda/admin/staff/' + s.id + '/disconnect', { method: 'POST' }); onSaved(staff) } catch (e) { setMsg(['error', e.message]) }
    setBusy(false)
  }
  const customCount = NUMBERS.filter(([k]) => initial[k] !== null && initial[k] !== undefined).length

  return (
    <article className="agadm-card agadm-staff" aria-labelledby={'staff-name-' + s.id}>
      <div className="agadm-staff-head">
        <div className="agadm-order" role="group" aria-label={'Prioridad de ' + initial.name}>
          <button type="button" className="agadm-icon" aria-label={'Subir prioridad de ' + initial.name} disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button>
          <span className="agadm-rank" title="Prioridad">{index + 1}</span>
          <button type="button" className="agadm-icon" aria-label={'Bajar prioridad de ' + initial.name} disabled={index === total - 1} onClick={() => onMove(index, 1)}>↓</button>
        </div>
        <div className="agadm-staff-id">
          <h3 id={'staff-name-' + s.id}>{initial.name}</h3>
          <p className="agadm-muted">{s.email}</p>
          <div className="agadm-badges">
            <span className={'agadm-badge ' + (s.connected ? 'is-on' : 'is-off')}>{s.connected ? 'Calendario conectado' : 'Sin conectar'}</span>
            {!initial.active && <span className="agadm-badge">Pausado</span>}
            {customCount > 0 && <span className="agadm-badge is-custom">{customCount === 1 ? '1 ajuste personalizado' : customCount + ' ajustes personalizados'}</span>}
          </div>
        </div>
        <div className="agadm-staff-actions">
          {s.connected
            ? <button type="button" className="agadm-btn quiet sm" onClick={disconnect} disabled={busy}>Desconectar</button>
            : <a className="agadm-btn sm" href={connectUrl}>Conectar Google Calendar</a>}
          <button type="button" className="agadm-btn quiet sm" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
            {expanded ? 'Cerrar' : 'Configurar'}
          </button>
        </div>
      </div>

      <div id={panelId} className="agadm-staff-body" hidden={!expanded}>
        <label className="agadm-check">
          <input type="checkbox" checked={Boolean(s.active)} onChange={(e) => toggleActive(e.target.checked)} />
          <span>
            <span className="agadm-label">Recibe reservas</span>
            <span className="agadm-help">Si lo desactivas, sus horarios dejan de mostrarse.</span>
          </span>
        </label>

        <div className="agadm-grid">
          <Field label="Nombre" help="Aparece en la invitación de Google Calendar.">
            <input value={s.name} maxLength={80} onChange={(e) => edit({ name: e.target.value })} />
          </Field>
          <Field label="Zona horaria" help="Se usa para interpretar su horario semanal.">
            <input value={s.timezone} maxLength={64} onChange={(e) => edit({ timezone: e.target.value })} placeholder="America/Lima" />
          </Field>
        </div>

        <fieldset className="agadm-hours agadm-ovr-set">
          <legend className="agadm-label">Reglas de agenda</legend>
          <p className="agadm-help">Por defecto usa la <b>Configuración general</b>. Personaliza solo lo que sea distinto para esta persona: su valor tiene prioridad.</p>
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

        <div className="agadm-row">
          <button type="button" className="agadm-btn" onClick={save} disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
          {dirty && <button type="button" className="agadm-btn quiet" onClick={() => { setEdits({}); setMsg(null) }} disabled={busy}>Descartar</button>}
          {dirty && !msg && <span className="agadm-muted">Cambios sin guardar</span>}
          {msg && <span className={msg[0] === 'ok' ? 'agadm-ok' : 'agadm-error'} role="status">{msg[1]}</span>}
        </div>
      </div>
    </article>
  )
}

function PeopleSection({ staff, setStaff, loadError, defaults }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [addMsg, setAddMsg] = useState('')
  const [orderMsg, setOrderMsg] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const toggle = (id) => setOpen((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function add(e) {
    e.preventDefault(); setAddMsg('')
    try {
      const { staff: row } = await api('/api/agenda/admin/staff', { method: 'POST', body: JSON.stringify(form) })
      setStaff((cur) => [...(cur || []), row]); setForm({ name: '', email: '' }); setAdding(false)
      setOpen((cur) => new Set(cur).add(row.id))
    } catch (err) { setAddMsg(err.message) }
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
      <SectionHead
        id="sec-personas"
        title="Personas"
        intro="Cada persona conecta su propio Google Calendar. Sus horarios se cruzan en vivo con su calendario y solo se ofrecen los espacios libres. El orden de la lista es la prioridad de la asignación en cascada."
        action={!adding && <button type="button" className="agadm-btn" onClick={() => setAdding(true)}>Agregar persona</button>}
      />
      {adding && (
        <form className="agadm-card agadm-add" onSubmit={add}>
          <h3>Agregar persona</h3>
          <div className="agadm-grid">
            <Field label="Nombre" help="Como aparecerá en la invitación.">
              <input value={form.name} maxLength={80} required autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Correo @manya.pe" help="Su cuenta de Google: con ella conectará el calendario.">
              <input type="email" value={form.email} maxLength={120} required onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <p className="agadm-help">Empieza de lunes a viernes, 09:00–13:30 y 14:30–18:00, con la configuración general. Puedes personalizarlo después.</p>
          <div className="agadm-row">
            <button className="agadm-btn" type="submit">Agregar</button>
            <button className="agadm-btn quiet" type="button" onClick={() => { setAdding(false); setAddMsg('') }}>Cancelar</button>
            {addMsg && <span className="agadm-error" role="alert">{addMsg}</span>}
          </div>
        </form>
      )}
      {orderMsg && <p className="agadm-alert" role="alert">{orderMsg}</p>}
      {loadError && <p className="agadm-alert">{loadError}</p>}
      {staff === null
        ? <p className="agadm-muted">Cargando…</p>
        : staff.map((s, i) => (
          <StaffCard key={s.id} initial={s} defaults={defaults} index={i} total={staff.length} onSaved={saved} onMove={move}
            expanded={open.has(s.id) || staff.length === 1} onToggle={() => toggle(s.id)} />
        ))}
      {staff && !staff.length && !loadError && <p className="agadm-empty">Aún no hay personas. Agrega la primera.</p>}
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
      onSaved(d.defaults); setDraft({}); setMsg(['ok', 'Guardado.'])
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
          {msg && <span className={msg[0] === 'ok' ? 'agadm-ok' : 'agadm-error'} role="status">{msg[1]}</span>}
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

export default function AdminPanel({ missing, notice }) {
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
        {section === 'personas' && <PeopleSection staff={staff} setStaff={setStaff} loadError={loadError} defaults={defaults} />}
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
      </div>
    </div>
  )
}
