'use client'
import { useEffect, useRef } from 'react'
import { Poppins, DM_Mono, Caveat } from 'next/font/google'
import { captureUtms } from '@/lib/utm'
import { addMonths, compareMonths, monthGrid, monthOf, todayIn } from '@/lib/agenda/calendar'
import './mapa-de-fugas.css'

// Same families/weights the source landing loaded from Google Fonts, scoped to this page via CSS variables.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--mdf-poppins',
})
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--mdf-dmmono' })
const caveat = Caveat({ subsets: ['latin'], weight: ['700'], display: 'swap', variable: '--mdf-caveat' })

/* Configuración. La agenda y el envío a Make viven en el servidor (/api/agenda/*): el navegador no conoce esas URLs. */
const MANYA_CONFIG = {
  whatsappPhone: '51997510692',
}
const DEV_SKIP_VALIDATION = false // true = "Continuar" avanza sin completar campos (solo para pruebas locales)
const AGENDA_TZ = 'America/Lima'

/* Analítica: dataLayer (GTM lo carga el layout); los eventos de esta landing llevan el prefijo mdf_ */
const trackEvent = (event, data = {}) => {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(Object.assign({ event: 'mdf_' + event }, data))
}

const noSubmit = (e) => e.preventDefault()

// Without JS nothing stays hidden: reveal targets show and the five fugas panels stack (as in the source).
const NOSCRIPT_CSS =
  '<style>.mdf.js .mdf-reveal,.mdf.js .section-head.mdf-reveal>*,.mdf.js .cal .ev{opacity:1!important;translate:none!important;transform:none!important;filter:none!important}' +
  '.mdf.js .fugas-panels>.fuga-panel{grid-area:auto!important}.mdf.js .proof .cv-row i::before{width:var(--w)!important}' +
  '@media (max-width:900px){.mdf .fugas-tabs{display:none!important}}</style>'

export default function MapaDeFugas() {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    // ---- lifecycle helpers: everything registered here is torn down on unmount (strict-mode safe)
    let alive = true
    const cleanups = []
    const rafIds = new Set()
    const timers = new Set()
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts)
      cleanups.push(() => target.removeEventListener(type, fn, opts))
    }
    const raf = (fn) => {
      const id = requestAnimationFrame((t) => { rafIds.delete(id); if (alive) fn(t) })
      rafIds.add(id)
      return id
    }
    const caf = (id) => { cancelAnimationFrame(id); rafIds.delete(id) }
    const later = (fn, ms) => {
      const id = setTimeout(() => { timers.delete(id); if (alive) fn() }, ms)
      timers.add(id)
      return id
    }
    const clearLater = (id) => { clearTimeout(id); timers.delete(id) }
    const observe = (Ctor, cb, opts) => {
      const o = new Ctor(cb, opts)
      cleanups.push(() => o.disconnect())
      return o
    }
    const $ = (sel) => root.querySelector(sel)
    const $$ = (sel) => [...root.querySelectorAll(sel)]
    const byId = (id) => root.querySelector('[id="' + id + '"]')
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

    /* red de seguridad: si algo falla, nada queda oculto */
    let revealReady = false
    later(() => { if (!revealReady) $$('.mdf-reveal,[data-anim]').forEach((e) => e.classList.add('is-in')) }, 2500)

    /* CTA: un solo listener para todos los enlaces al formulario (incluye el CTA del header del sitio) */
    on(document, 'click', (e) => {
      const a = e.target.closest && e.target.closest('a[href="#agendar"]')
      if (a) trackEvent('cta_click', { location: a.dataset.cta || 'sin-etiqueta' })
    })

    /* ---------- pestañas de las cinco fugas ---------- */
    ;(() => {
      const tabs = $$('.fugas-tabs [role="tab"]')
      const panels = $$('.fuga-panel')
      if (!tabs.length || !panels.length) return
      const flow = $$('[data-flow-step]')
      const flowLoss = $('[data-flow-loss]')
      const LOSS = ['start', '−36', '−59', '−72', '−88']
      let active = 0

      // contador de la derecha: baja de etapa en etapa
      const COUNTS = [100, 64, 41, 28, 12]
      const countBox = $('.fugas-count'), countNum = $('[data-count]'), countLabel = $('[data-count-label]')
      const still = !matchMedia('(prefers-reduced-motion: no-preference)').matches
      let shown = 100, cRaf = 0
      function countTo(to) {
        if (!countNum) return
        if (countBox) countBox.style.setProperty('--v', to)
        caf(cRaf)
        if (still) { shown = to; countNum.textContent = to; return }
        const from = shown, t0 = performance.now()
        const tick = (now) => {
          const q = Math.min(1, (now - t0) / 600), e = 1 - Math.pow(1 - q, 3)
          shown = Math.round(from + (to - from) * e); countNum.textContent = shown
          if (q < 1) cRaf = raf(tick)
        }
        cRaf = raf(tick)
      }

      // Pestañas en todos los anchos: un panel visible a la vez (sin JS, los paneles se apilan).
      const tabList = tabs[0].parentElement
      function paint() {
        tabs.forEach((t, k) => {
          const isOn = k === active
          t.setAttribute('aria-selected', String(isOn))
          t.tabIndex = isOn ? 0 : -1
        })
        // en móvil la fila de pestañas se desplaza sola (sólo en horizontal) para mostrar la activa
        if (tabList.scrollWidth > tabList.clientWidth) {
          const t = tabs[active]
          tabList.scrollTo({ left: t.offsetLeft - (tabList.clientWidth - t.offsetWidth) / 2, behavior: still ? 'auto' : 'smooth' })
        }
        panels.forEach((p, k) => {
          const off = k !== active
          p.hidden = false
          p.classList.toggle('is-off', off)
          p.inert = off
          p.setAttribute('role', 'tabpanel')
          p.setAttribute('aria-labelledby', tabs[k].id)
        })
        flow.forEach((el, k) => el.classList.toggle('is-on', k === active))
        countTo(COUNTS[active])
        if (countLabel) { const sp = panels[active].querySelector('.fuga-fig span'); if (sp) countLabel.textContent = sp.textContent }
        if (flowLoss) {
          const start = active === 0
          flowLoss.dataset.state = start ? 'start' : 'loss'
          flowLoss.textContent = start ? 'Punto de partida' : LOSS[active] + ' acumulados'
        }
      }
      function activate(i, track = true) {
        active = i
        paint()
        if (track) trackEvent('stage_tab_view', { stage: panels[i].dataset.stage || 'etapa-' + (i + 1) })
      }
      tabs.forEach((tab, i) => {
        on(tab, 'click', () => activate(i))
        on(tab, 'keydown', (e) => {
          let n = null
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length
          if (e.key === 'Home') n = 0
          if (e.key === 'End') n = tabs.length - 1
          if (n === null) return
          e.preventDefault()
          activate(n)
          tabs[n].focus()
        })
      })
      // Avance automático: sólo con movimiento permitido. Se detiene con hover/foco
      // y queda detenido para siempre en cuanto alguien elige una pestaña.
      ;(() => {
        const shell = $('.fugas-shell')
        const top = $('.fugas-top')
        if (!shell || !top || still) return
        const DUR = 6000
        let p = 0, last = 0, hover = false, focus = false, visible = false, paused = false
        const bars = tabs.map((t) => {
          const i = document.createElement('i'); i.className = 'tab-prog'; i.setAttribute('aria-hidden', 'true'); t.append(i)
          cleanups.push(() => i.remove())
          return i
        })
        // Sin botón: avanza solo hasta que alguien elige una pestaña; desde ahí se queda quieto.
        const setPaused = (v) => { paused = v; if (v) bars.forEach((b) => b.style.setProperty('--p', 0)) }
        on(shell, 'pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true })
        on(shell, 'pointerleave', () => { hover = false })
        on(shell, 'focusin', () => { focus = true })
        on(shell, 'focusout', (e) => { if (!shell.contains(e.relatedTarget)) focus = false })
        tabs.forEach((t) => {
          on(t, 'click', () => { p = 0; setPaused(true) })
          on(t, 'keydown', () => setPaused(true))
        })
        on(tabList, 'touchstart', () => setPaused(true), { passive: true })
        observe(IntersectionObserver, ([e]) => { visible = e.isIntersecting }, { threshold: 0.35 }).observe(shell)
        const loop = (now) => {
          const dt = last ? now - last : 0; last = now
          if (!paused && visible && !hover && !focus && !document.hidden) {
            p += dt / DUR
            if (p >= 1) { p = 0; activate((active + 1) % tabs.length, false) }
          }
          if (!paused) bars.forEach((b, k) => b.style.setProperty('--p', k === active ? p.toFixed(3) : 0))
          raf(loop)
        }
        raf(loop)
      })()

      // La primera etapa visible cuenta como vista una sola vez.
      if ('IntersectionObserver' in window) {
        const shell = $('.fugas-shell')
        if (shell) {
          observe(IntersectionObserver, ([en], o) => {
            if (!en.isIntersecting) return
            o.disconnect()
            trackEvent('stage_tab_view', { stage: panels[active].dataset.stage || 'etapa' })
          }, { threshold: 0.2 }).observe(shell)
        }
      }
      paint()
    })()

    /* ---------- 100 puntos del cierre ---------- */
    ;(() => {
      const dots = $('[data-dots]')
      if (!dots) return
      for (let i = 0; i < 100; i++) {
        const d = document.createElement('i')
        d.className = i < 12 ? 's' : 'l'
        dots.append(d)
      }
      cleanups.push(() => dots.replaceChildren())
    })()

    /* ---------- calculadora ---------- */
    ;(() => {
      const leads = byId('c-leads'), close = byId('c-close'), ticket = byId('c-ticket')
      const big = byId('calc-big')
      if (!leads || !close || !ticket || !big) return
      const fmt = (n) => 'S/ ' + Math.round(n).toLocaleString('en-US')
      let shown = 7200, anim = 0, timer = 0, first = true, target = 7200
      // primera vez que la cifra entra en pantalla: cuenta desde 0; luego, actualización en vivo normal
      let revealed = reduceMotion || !('IntersectionObserver' in window)

      function sync(s) {
        s.style.setProperty('--attr-min', s.min)
        s.style.setProperty('--attr-max', s.max)
        s.style.setProperty('--control-value', s.value)
      }
      function tween(to, dur = 650) {
        caf(anim)
        if (reduceMotion) { shown = to; big.textContent = fmt(to); return }
        const from = shown, t0 = performance.now()
        const tick = () => {
          const p = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - p, 4)
          shown = from + (to - from) * e; big.textContent = fmt(shown)
          if (p < 1) anim = raf(tick)
        }
        anim = raf(tick)
      }
      function update() {
        ;[leads, close, ticket].forEach(sync)
        const P = +root.querySelector('input[name="scen"]:checked').value / 100
        const L = +leads.value, C = +close.value / 100, T = +ticket.value
        const lost = L * P, sales = lost * C, money = sales * T
        byId('o-leads').textContent = L.toLocaleString('en-US')
        byId('o-close').textContent = close.value + '%'
        byId('o-ticket').textContent = fmt(T)
        leads.setAttribute('aria-valuetext', L + ' leads')
        close.setAttribute('aria-valuetext', close.value + ' por ciento')
        ticket.setAttribute('aria-valuetext', T + ' soles')
        byId('k-lost').textContent = Math.round(lost).toLocaleString('en-US')
        byId('k-sales').textContent = (Math.round(sales * 10) / 10).toLocaleString('en-US')
        byId('k-year').textContent = fmt(money * 12)
        target = money
        if (revealed) tween(money)
        if (first) { first = false; return }
        clearLater(timer)
        timer = later(() => trackEvent('calculator_change', {
          leads: L,
          close_rate: +close.value,
          ticket: T,
          scenario: +root.querySelector('input[name="scen"]:checked').value,
          monthly_loss: Math.round(money),
        }), 600)
      }
      const reveal = () => { if (revealed) return; revealed = true; tween(target, 1100) }
      on(byId('calc'), 'input', () => { if (!revealed) { revealed = true } update() })
      update()
      if (!revealed) {
        shown = 0; big.textContent = fmt(0)
        observe(IntersectionObserver, ([e], o) => { if (!e.isIntersecting) return; o.disconnect(); reveal() }, { threshold: 0.6 }).observe(big)
      }
    })()

    /* ---------- validación accesible + formulario por pasos ---------- */
    ;(() => {
      const form = byId('leadForm')
      if (!form) return
      const steps = { 1: byId('step1'), 2: byId('step2'), 3: byId('step3') }
      const step4 = byId('step4')
      const stepNoFit = byId('stepNoFit')
      const bar = byId('barFill')
      const stepLabel = byId('stepLabel')
      const statusBox = byId('status')
      const submitBtn = byId('submitBtn')

      form.classList.toggle('dev-skip', DEV_SKIP_VALIDATION) // en modo dev no se muestran errores ni bordes rojos
      const supportsUserInvalid = CSS.supports('selector(:user-invalid)')
      const touched = new WeakSet()
      const FIELD_SEL = '#leadForm input, #leadForm select'
      /* un campo tocado (blur o "Continuar") muestra su error aunque :user-invalid no aplique (botones type=button) */
      function isUserInvalid(el) {
        return (touched.has(el) && !el.validity.valid) || (supportsUserInvalid && el.matches(':user-invalid'))
      }
      function syncAria(el) {
        if (!el.matches || !el.matches(FIELD_SEL)) return
        const bad = !DEV_SKIP_VALIDATION && isUserInvalid(el)
        el.classList.toggle('user-invalid-fallback', bad)
        el.setAttribute('aria-invalid', bad ? 'true' : 'false')
        const ids = [el.dataset.hint, bad ? el.dataset.error : ''].filter(Boolean).join(' ')
        ids ? el.setAttribute('aria-describedby', ids) : el.removeAttribute('aria-describedby')
      }
      $$(FIELD_SEL).forEach(syncAria)
      on(root, 'blur', (e) => { if (e.target.matches?.(FIELD_SEL)) { touched.add(e.target); syncAria(e.target) } }, true)
      on(root, 'input', (e) => syncAria(e.target))
      on(root, 'change', (e) => { if (e.target.matches?.('#leadForm select')) touched.add(e.target); syncAria(e.target) }, true)
      on(root, 'invalid', (e) => { touched.add(e.target); syncAria(e.target) }, true)

      const LABELS = {
        1: ['Paso 1 de 4 · Tus datos', '25%'],
        2: ['Paso 2 de 4 · Tu negocio', '50%'],
        3: ['Paso 3 de 4 · Tu operación', '75%'],
        4: ['Paso 4 de 4 · Tu horario', '100%'],
        0: ['Resultado de tu evaluación', '100%'],
      }

      let step1Tracked = false
      function show(view) {
        if (view === 1) step1Tracked = true
        trackEvent('form_step', { step: typeof view === 'number' ? view : (view === 'agenda' ? 4 : 0) })
        Object.values(steps).forEach((s) => s.classList.add('hidden'))
        step4.classList.add('hidden')
        stepNoFit.classList.add('hidden')
        form.classList.remove('hidden')
        statusBox.classList.add('hidden')

        if (view === 'agenda') { step4.classList.remove('hidden'); form.classList.add('hidden'); setHead(4) }
        else if (view === 'nofit') { stepNoFit.classList.remove('hidden'); form.classList.add('hidden'); setHead(0) }
        else {
          steps[view].classList.remove('hidden'); setHead(view)
          const firstEl = steps[view].querySelector('input:not([type=hidden]),select,button')
          if (firstEl) firstEl.focus({ preventScroll: true })
        }
        byId('agendar').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
      }
      function setHead(n) { stepLabel.textContent = LABELS[n][0]; bar.style.width = LABELS[n][1] }

      // La primera interacción con el paso 1 también cuenta como paso visto.
      const firstField = byId('nombre')
      if (firstField) on(firstField, 'focus', () => {
        if (step1Tracked) return
        step1Tracked = true
        trackEvent('form_step', { step: 1 })
      }, { once: true })

      $$('.chip-btn').forEach((chip) => {
        on(chip, 'click', () => {
          const isOn = chip.getAttribute('aria-pressed') === 'true'
          chip.setAttribute('aria-pressed', String(!isOn))
          const field = root.querySelector('[data-field="' + chip.dataset.channel + '"]')
          field.classList.toggle('hidden', isOn)
          if (!isOn) field.querySelector('input').focus()
          else field.querySelector('input').value = ''
          byId('channelError').classList.add('hidden')
        })
      })

      /* cada campo acepta solo los caracteres que le corresponden */
      /* WhatsApp: el +51 es fijo (adorno); el campo recibe solo el celular peruano: 9 dígitos que empiezan con 9 */
      const phoneDigits = (v) => { let d = v.replace(/\D/g, ''); if (d.length > 9 && d.startsWith('51')) d = d.slice(2); return d.slice(0, 9) }
      const phoneOk = (v) => /^9\d{8}$/.test(phoneDigits(v))
      const phoneMask = (v) => (phoneDigits(v).match(/\d{1,3}/g) || []).join(' ') // 9XX XXX XXX
      const FIELD_RULES = {
        nombre: { strip: /[^\p{L}\p{M}\s'’\-]/gu, check: (v) => (v.match(/\p{L}/gu) || []).length >= 2 },
        empresa: { strip: /[\u0000-\u001f<>]/g, check: (v) => /[\p{L}\p{N}]/u.test(v) && v.trim().length >= 2 },
        correo: { strip: /[\s\u0000-\u001f<>()[\],;:"\\]/g, check: (v) => /^[^@\s]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v) },
        telefono: { strip: /[^\d\s+]/g, fix: phoneMask, check: phoneOk },
        web: { strip: /[^A-Za-z0-9\-._~:/?#@!$&'()*+,;=%]/g },
        facebook: { strip: /[^A-Za-z0-9\-._~:/?#@!$&'()*+,;=%]/g },
        linkedin: { strip: /[^A-Za-z0-9\-._~:/?#@!$&'()*+,;=%]/g },
        instagram: { strip: /[^A-Za-z0-9._@]/g, fix: (v) => v.replace(/(?!^)@/g, '') },
        tiktok: { strip: /[^A-Za-z0-9._@]/g, fix: (v) => v.replace(/(?!^)@/g, '') },
      }
      Object.entries(FIELD_RULES).forEach(([id, r]) => {
        const el = byId(id); if (!el) return
        const run = () => {
          let v = el.value.replace(r.strip, '')
          if (r.fix) v = r.fix(v)
          if (el.maxLength > 0) v = v.slice(0, el.maxLength)
          v = v.replace(/\s{2,}/g, ' ').replace(/^\s+/, '')
          if (v !== el.value) { const pos = el.selectionStart - (el.value.length - v.length); el.value = v; try { el.setSelectionRange(pos, pos) } catch (_) { /* tipo sin selección */ } }
          if (r.check) el.setCustomValidity(!v.trim() || r.check(v) ? '' : 'formato')
        }
        on(el, 'input', run); run()
        on(el, 'blur', () => { // al salir: sin espacios sobrantes y, si aplica, con formato
          let v = el.value.trim()
          if (r.blur && v) v = r.blur(v)
          if (v !== el.value) { el.value = v; run(); syncAria(el) }
        })
      })

      function validRequired(node) {
        let firstBad = null
        for (const el of node.querySelectorAll('input[required],select[required]')) {
          touched.add(el)
          if (!el.value.trim() || !el.checkValidity()) { el.checkValidity(); if (!firstBad) firstBad = el }
          syncAria(el)
        }
        if (firstBad) { firstBad.focus(); return false }
        return true
      }
      function validChannels() {
        const w = byId('web').value.trim(), ig = byId('instagram').value.trim()
        const okW = !w || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([\/?#].*)?$/i.test(w), okI = !ig || /^@?[\w.]{1,30}$/.test(ig)
        const ok = Boolean((w || ig) && okW && okI)
        byId('channelError').classList.toggle('hidden', ok)
        return ok
      }

      /* valida un paso; con DEV_SKIP_VALIDATION nunca bloquea (la validación real queda intacta) */
      function stepOk(n) {
        if (DEV_SKIP_VALIDATION) return true
        if (!validRequired(steps[n])) return false
        if (n === 2 && !validChannels()) return false
        return true
      }
      $$('[data-next]').forEach((b) => on(b, 'click', () => {
        const from = Number(b.dataset.next) - 1
        if (!stepOk(from)) return
        show(Number(b.dataset.next))
      }))
      $$('[data-back]').forEach((b) => on(b, 'click', () => show(Number(b.dataset.back))))

      on(byId('modelo'), 'change', (e) => {
        byId('equipoLabel').textContent =
          e.target.value === 'ecommerce' ? '¿Quién gestiona hoy la tienda y sus oportunidades?' : '¿Quién atiende hoy las oportunidades que llegan?'
      })

      ;(() => { // encaje en vivo junto al formulario
        const box = $('.fit-live'); if (!box) return
        const MSG = {
          pauta: { nada: ['no', 'Aún no inviertes en pauta.'], bajo: ['no', 'Menos de USD 500 al mes: poca evidencia que revisar.'], _: ['ok', 'Inviertes lo suficiente para tener evidencia.'] },
          equipo: { nadie: ['no', 'Hoy nadie atiende de forma consistente.'], _: ['ok', 'Hay quien atiende las oportunidades.'] },
          urgencia: { ya: ['ok', 'Es prioridad este mes.'], pronto: ['ok', 'Lo quieres listo el próximo mes.'], validar: ['warn', 'Lo validamos contigo en la evaluación.'], explorando: ['warn', 'Estás explorando: la evaluación te aclara el alcance.'] },
        }
        const base = {}
        box.querySelectorAll('[data-fit]').forEach((li) => { base[li.dataset.fit] = li.querySelector('em').textContent })
        const verdict = box.querySelector('.fit-verdict')
        function update() {
          const st = []
          box.querySelectorAll('[data-fit]').forEach((li) => {
            const k = li.dataset.fit, v = byId(k).value
            const [state, msg] = v ? (MSG[k][v] || MSG[k]._) : ['wait', base[k]]
            li.dataset.state = state; li.querySelector('em').textContent = msg; st.push(state)
          })
          const [vs, vt] = st.includes('no') ? ['no', 'Por ahora no encaja. Al final te decimos por qué y qué te falta.']
            : st.includes('wait') ? ['wait', st.every((x) => x === 'wait') ? 'Aquí verás si el Mapa de Fugas encaja contigo.' : 'Vas bien. Completa las preguntas para ver el resultado.']
              : st.includes('warn') ? ['warn', 'Encaja, con un punto que vemos en la evaluación.']
                : ['ok', 'Encaja. Al terminar eliges tu horario con Maddy.']
          verdict.dataset.state = vs; verdict.textContent = vt
        }
        ;['pauta', 'equipo', 'urgencia'].forEach((id) => on(byId(id), 'change', update))
      })()

      function qualify(v) {
        if (['nada', 'bajo'].includes(v.pauta)) return { level: 'no_apto', reason: 'pauta' }
        if (v.equipo === 'nadie') return { level: 'no_apto', reason: 'equipo' }
        if (['validar', 'explorando'].includes(v.urgencia)) return { level: 'pendiente_validacion', reason: '' }
        return { level: 'precalificado', reason: '' }
      }
      const NO_FIT_COPY = {
        pauta: 'El diagnóstico analiza un recorrido comercial que ya está recibiendo inversión. Con la pauta que manejas hoy, no habría suficiente evidencia que revisar.',
        equipo: 'El diagnóstico revisa cómo se atienden y se cierran las oportunidades. Si hoy nadie las atiende de forma consistente, el problema está antes del análisis.',
      }
      function waLink(text, msg) {
        const phone = MANYA_CONFIG.whatsappPhone.replace(/[^0-9]/g, '')
        const a = document.createElement('a')
        a.href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg)
        a.target = '_blank'; a.rel = 'noopener'; a.className = 'link'; a.textContent = text
        return a
      }
      function renderNoFit(reason, lead) {
        byId('noFitReason').textContent = NO_FIT_COPY[reason] || NO_FIT_COPY.pauta
        const alt = byId('noFitAlt')
        alt.textContent = ''
        if (MANYA_CONFIG.whatsappPhone) {
          alt.append('¿Crees que tu caso es distinto? ',
            waLink('Cuéntanos por WhatsApp', 'Hola, soy ' + lead.nombre + ' de ' + lead.empresa + '. Vi que el Mapa de Fugas no encaja con mi situación actual y quiero saber por dónde empezar.'), '.')
        }
      }
      /* ---------- paso 4: agenda nativa (horarios desde /api/agenda/slots; el servidor asigna a la persona) ---------- */
      const slotPicker = byId('slotPicker')
      const slotsBody = byId('slotsBody')
      const slotsHead = byId('slotsHead')
      const slotsDur = byId('slotsDur')
      const mk = (tag, cls, text) => {
        const n = document.createElement(tag)
        if (cls) n.className = cls
        if (text != null) n.textContent = text
        return n
      }
      const button = (cls, text, data) => {
        const b = mk('button', cls, text); b.type = 'button'
        Object.entries(data || {}).forEach(([k, v]) => { b.dataset[k] = v })
        return b
      }
      const fmtDay = new Intl.DateTimeFormat('es-PE', { timeZone: AGENDA_TZ, weekday: 'short', day: 'numeric', month: 'short' })
      const fmtLong = new Intl.DateTimeFormat('es-PE', { timeZone: AGENDA_TZ, weekday: 'long', day: 'numeric', month: 'long' })
      const fmtTime = new Intl.DateTimeFormat('es-PE', { timeZone: AGENDA_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      const partsOf = (fmt, d) => Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value.replace(/\.$/, '')]))
      const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
      const dayDate = (ymd) => new Date(ymd + 'T12:00:00-05:00') // mediodía en Lima (sin horario de verano)
      const newId = () => {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID()
        const b = window.crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128
        const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
        return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20)
      }
      const leadId = newId() // une el lead y la reserva en Make
      const agenda = { lead: null, utms: null, honeypot: '', days: [], day: -1, slot: null, view: 'calendar', month: null, booking: false, seq: 0, minutes: 20 }
      const WEEKDAYS = [['Lu', 'lunes'], ['Ma', 'martes'], ['Mi', 'miércoles'], ['Ju', 'jueves'], ['Vi', 'viernes'], ['Sá', 'sábado'], ['Do', 'domingo']]
      const fmtMonth = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', month: 'long', year: 'numeric' })
      const monthLabel = (mo) => cap(fmtMonth.format(new Date(Date.UTC(mo.y, mo.m - 1, 15))).replace(/ de /, ' '))
      const longDay = (ymdStr) => { const p = partsOf(fmtLong, dayDate(ymdStr)); return cap(p.weekday) + ' ' + p.day + ' de ' + p.month }
      const shortDay = (ymdStr) => { const p = partsOf(fmtDay, dayDate(ymdStr)); return cap(p.weekday) + ' ' + p.day + ' ' + p.month }
      const slotTime = (s) => s.time || fmtTime.format(new Date(s.start))
      /* Duración de un horario: la de la persona que lo recibiría (puede diferir de la general). */
      const slotMinutes = (s) => {
        const m = Number(s.minutes) || Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60000)
        return m > 0 ? m : agenda.minutes
      }
      const odd = (s) => slotMinutes(s) !== agenda.minutes

      function waAgenda(text) {
        const l = agenda.lead || {}
        return waLink(text, 'Hola, soy ' + (l.nombre || '') + ' de ' + (l.empresa || '') + '. Completé el formulario del Mapa de Fugas y quiero coordinar la evaluación.')
      }
      function renderAgendaAlt() {
        const alt = byId('agendaAlt')
        alt.textContent = ''
        if (MANYA_CONFIG.whatsappPhone) alt.append('¿Ningún horario te sirve? ', waAgenda('Escríbenos por WhatsApp'), '.')
      }
      function setBusy(v) { v ? slotPicker.setAttribute('aria-busy', 'true') : slotPicker.removeAttribute('aria-busy') }
      function renderSkeleton() {
        setBusy(true)
        const first = mk('span', 'sk sk-first'), head = mk('span', 'sk sk-month'), grid = mk('div', 'dp-grid is-skel')
        for (let i = 0; i < 35; i++) grid.append(mk('span', 'sk sk-cell'))
        slotsBody.replaceChildren(mk('span', 'visually-hidden', 'Cargando horarios…'), first, head, grid)
      }
      function renderMessage(kind, title, text, action) {
        setBusy(false)
        const box = mk('div', 'slots-msg')
        box.dataset.kind = kind
        box.append(mk('b', '', title), mk('p', '', text))
        if (action) box.append(action)
        slotsBody.replaceChildren(box)
      }
      const waButton = () => {
        const a = waAgenda('Escríbenos por WhatsApp')
        a.className = 'btn wide'
        return a
      }
      function renderUnavailable() {
        renderMessage('off', 'La agenda en línea no está disponible ahora.', 'Escríbenos por WhatsApp y coordinamos tu evaluación en minutos.', MANYA_CONFIG.whatsappPhone ? waButton() : null)
        byId('agendaAlt').textContent = ''
      }
      function renderEmpty() {
        renderMessage('empty', 'No hay horarios disponibles en los próximos días.', 'Escríbenos por WhatsApp y buscamos un espacio para ti.', MANYA_CONFIG.whatsappPhone ? waButton() : null)
        byId('agendaAlt').textContent = ''
      }
      function renderError() {
        renderMessage('error', 'No pudimos cargar los horarios.', 'Revisa tu conexión e inténtalo de nuevo.', button('btn quiet wide', 'Reintentar', { action: 'retry' }))
      }

      /* Paso a paso: (1) día en un calendario mensual → (2) hora de ese día → confirmar. */
      const dayIndex = (date) => agenda.days.findIndex((d) => d.date === date)
      const firstMonth = () => monthOf(agenda.days[0].date)
      const lastMonth = () => monthOf(agenda.days[agenda.days.length - 1].date)

      function renderReady(focus) {
        setBusy(false)
        const view = mk('div', 'dp-view')
        view.id = 'dpView'
        const err = mk('p', 'inline-error hidden', '')
        err.id = 'bookError'; err.setAttribute('role', 'alert')
        slotsBody.replaceChildren(view, err)
        agenda.view === 'times' ? renderTimesView(focus) : renderCalendarView(focus)
      }

      function renderCalendarView(focus) {
        const view = byId('dpView')
        const first = agenda.days[0], s0 = first.slots[0]
        const shortcut = button('dp-first', null, { action: 'first' })
        shortcut.append(mk('span', 'dp-first-k', 'Primer horario disponible'), mk('span', 'dp-first-v', shortDay(first.date) + ' · ' + slotTime(s0)))
        const arrow = mk('span', 'dp-first-go', '→'); arrow.setAttribute('aria-hidden', 'true')
        shortcut.append(arrow)
        shortcut.setAttribute('aria-label', 'Primer horario disponible: ' + longDay(first.date) + ' a las ' + slotTime(s0) + '. Elegirlo')

        const mo = agenda.month
        const head = mk('div', 'dp-head')
        const prev = button('dp-nav', '‹', { action: 'prev-month' })
        prev.setAttribute('aria-label', 'Mes anterior')
        prev.disabled = compareMonths(mo, firstMonth()) <= 0
        const next = button('dp-nav', '›', { action: 'next-month' })
        next.setAttribute('aria-label', 'Mes siguiente')
        next.disabled = compareMonths(mo, lastMonth()) >= 0
        const title = mk('p', 'dp-month', monthLabel(mo))
        title.id = 'dpMonth'; title.setAttribute('aria-live', 'polite')
        head.append(prev, title, next)

        const grid = mk('div', 'dp-grid')
        grid.setAttribute('role', 'group'); grid.setAttribute('aria-labelledby', 'dpMonth')
        WEEKDAYS.forEach(([abbr]) => { const w = mk('span', 'dp-wd', abbr); w.setAttribute('aria-hidden', 'true'); grid.append(w) })
        const today = todayIn(AGENDA_TZ)
        const chosen = agenda.day >= 0 ? agenda.days[agenda.day].date : ''
        monthGrid(mo).flat().forEach((date, i) => {
          if (!date) { grid.append(mk('span', 'dp-pad')); return }
          const idx = dayIndex(date)
          const b = button('dp-day', String(Number(date.slice(8))), idx >= 0 ? { date } : null)
          const n = idx >= 0 ? agenda.days[idx].slots.length : 0
          b.setAttribute('aria-label', cap(WEEKDAYS[i % 7][1]) + ' ' + Number(date.slice(8)) + (n ? ', ' + n + (n === 1 ? ' horario' : ' horarios') : ', sin horarios'))
          if (idx < 0) b.disabled = true
          else { b.classList.add('is-open'); b.setAttribute('aria-pressed', String(date === chosen)) }
          if (date === today) { b.classList.add('is-today'); b.setAttribute('aria-current', 'date') }
          grid.append(b)
        })
        const hint = mk('p', 'dp-hint')
        const dot = mk('span', 'dp-dot'); dot.setAttribute('aria-hidden', 'true')
        hint.append(dot, 'Días con horarios libres · hora de Lima')
        view.replaceChildren(shortcut, head, grid, hint)
        if (focus === 'month') (prev.disabled ? next : prev).focus({ preventScroll: true })
        else if (focus === 'day') (grid.querySelector('.dp-day[aria-pressed="true"]') || shortcut).focus({ preventScroll: true })
      }

      function renderTimesView(focus) {
        const view = byId('dpView')
        const d = agenda.days[agenda.day]
        const back = button('dp-back', null, { action: 'back' })
        const arrow = mk('span', '', '←'); arrow.setAttribute('aria-hidden', 'true')
        back.append(arrow, ' Cambiar día')
        const title = mk('p', 'dp-date', longDay(d.date))
        title.id = 'dpDate'; title.tabIndex = -1
        const k = mk('p', 'slots-k', 'Elige la hora · Lima')
        k.id = 'dpTimesK'
        const grid = mk('div', 'slots-grid')
        grid.setAttribute('role', 'group'); grid.setAttribute('aria-labelledby', 'dpDate dpTimesK')
        d.slots.forEach((s, i) => {
          const b = button('slot-time', slotTime(s), { slot: String(i) })
          if (odd(s)) {
            b.classList.add('has-dur')
            b.append(mk('small', 'slot-dur', slotMinutes(s) + ' min'))
            b.setAttribute('aria-label', slotTime(s) + ', ' + slotMinutes(s) + ' minutos')
          }
          b.setAttribute('aria-pressed', String(agenda.slot === s))
          grid.append(b)
        })
        const confirm = mk('div', 'slots-confirm')
        const pick = mk('p', 'slots-pick', '')
        pick.id = 'slotsPick'
        const btn = button('btn wide', 'Confirmar horario', { action: 'book' })
        confirm.append(pick, btn)
        view.replaceChildren(back, title, k, grid, confirm)
        updatePick()
        if (focus === 'confirm') btn.focus({ preventScroll: true })
        else if (focus) title.focus({ preventScroll: true })
      }

      function slotText(s) {
        const p = partsOf(fmtLong, new Date(s.start))
        return cap(p.weekday) + ' ' + p.day + ' de ' + p.month + ' · ' + slotTime(s) + (odd(s) ? ' · ' + slotMinutes(s) + ' min' : '')
      }
      function updatePick() {
        const pick = byId('slotsPick'), btn = slotsBody.querySelector('[data-action="book"]')
        if (!pick || !btn) return
        pick.textContent = agenda.slot ? slotText(agenda.slot) : 'Elige una hora.'
        pick.classList.toggle('is-on', Boolean(agenda.slot))
        btn.disabled = !agenda.slot || agenda.booking
      }
      function showBookError(msg) {
        const err = byId('bookError')
        if (!err) return
        err.textContent = msg
        err.classList.toggle('hidden', !msg)
      }

      async function loadSlots() {
        const seq = ++agenda.seq
        agenda.slot = null
        renderSkeleton()
        let res = null, data = {}
        try {
          res = await fetch('/api/agenda/slots', { cache: 'no-store', headers: { Accept: 'application/json' } })
          data = await res.json().catch(() => ({}))
        } catch (_) { res = null }
        if (!alive || seq !== agenda.seq) return
        if (res && res.status === 503 && data.error === 'not_configured') { renderUnavailable(); return }
        if (!res || !res.ok || !Array.isArray(data.days)) { renderError(); return }
        agenda.days = data.days.filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Array.isArray(d.slots) && d.slots.length)
          .sort((a, b) => a.date.localeCompare(b.date))
        const total = agenda.days.reduce((n, d) => n + d.slots.length, 0)
        trackEvent('slots_loaded', { days: agenda.days.length, slots: total })
        if (!total) { renderEmpty(); return }
        agenda.day = -1
        agenda.view = 'calendar'
        agenda.month = firstMonth()
        // Subtítulo: duración general (meeting_minutes); servidores antiguos no la envían → la del primer horario.
        const first = agenda.days[0].slots[0]
        const general = Number(data.meeting_minutes)
        agenda.minutes = general > 0 ? general : Math.round((Date.parse(first.end) - Date.parse(first.start)) / 60000) || 20
        slotsDur.textContent = agenda.minutes + ' min'
        renderAgendaAlt()
        renderReady()
      }

      function renderSuccess(data, slot) {
        setBusy(false)
        slotsHead.classList.add('hidden')
        const start = new Date(data.start || slot.start)
        const p = partsOf(fmtLong, start)
        const box = mk('div', 'slots-done')
        const ic = mk('span', 'done-ic')
        ic.setAttribute('aria-hidden', 'true')
        ic.innerHTML = '<svg><use href="#i-check" /></svg>'
        const firstName = (agenda.lead.nombre || '').split(' ')[0]
        const h = mk('h3', 'h3', '¡Listo' + (firstName ? ', ' + firstName : '') + '! Tu evaluación quedó agendada.')
        h.tabIndex = -1
        const when = mk('p', 'done-when')
        // Duración real: la de la persona asignada (el servidor la devuelve; puede cambiar si se ocupó quien se mostraba).
        const endMs = Date.parse(data.end)
        const mins = Number(data.minutes) || (Number.isFinite(endMs) ? Math.round((endMs - start.getTime()) / 60000) : slotMinutes(slot))
        when.append(mk('span', 'done-day', cap(p.weekday) + ' ' + p.day + ' de ' + p.month), mk('span', 'done-time', fmtTime.format(start)), mk('small', '', mins + ' min · hora de Lima'))
        box.append(ic, h, when, mk('p', '', 'Te enviamos la invitación a tu correo con el link de Meet.'))
        if (typeof data.meet_link === 'string' && data.meet_link.startsWith('https://meet.google.com/')) {
          const a = mk('a', 'link', 'Abrir el link de Meet')
          a.href = data.meet_link; a.target = '_blank'; a.rel = 'noopener'
          box.append(a)
        }
        slotsBody.replaceChildren(box)
        byId('agendaAlt').textContent = ''
        stepLabel.textContent = 'Evaluación agendada'
        h.focus({ preventScroll: true })
      }

      async function book() {
        if (agenda.booking || !agenda.slot) return
        agenda.booking = true
        const slot = agenda.slot
        const date = agenda.days[agenda.day]?.date || ''
        const btn = slotsBody.querySelector('[data-action="book"]')
        btn.disabled = true
        btn.textContent = 'Agendando…'
        showBookError('')
        let res = null, data = {}
        try {
          res = await fetch('/api/agenda/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start: slot.start, lead: agenda.lead, utms: agenda.utms, page_url: location.href, honeypot: agenda.honeypot }),
          })
          data = await res.json().catch(() => ({}))
        } catch (_) { res = null }
        if (!alive) return
        agenda.booking = false
        if (res && res.ok && data.ok) {
          trackEvent('booking_success', { date, time: slot.time || '' })
          renderSuccess(data, slot)
          return
        }
        const code = data.error || (res ? 'http_' + res.status : 'network')
        trackEvent('booking_error', { reason: code })
        if (code === 'not_configured') { renderUnavailable(); return }
        if (code === 'slot_taken' || code === 'slot_unavailable') {
          // Todas las personas libres a esa hora se ocuparon: recarga los horarios y vuelve al día si aún tiene cupos.
          await loadSlots()
          if (!alive || !agenda.days.length) return
          const idx = dayIndex(date)
          if (idx >= 0) { agenda.day = idx; agenda.view = 'times'; agenda.month = monthOf(date); renderReady('title') }
          showBookError('Ese horario acaba de ocuparse. Elige otro, por favor.')
          return
        }
        btn.textContent = 'Confirmar horario'
        updatePick()
        showBookError(code === 'rate_limited'
          ? 'Hiciste varios intentos seguidos. Espera unos minutos o escríbenos por WhatsApp.'
          : 'No pudimos agendar tu horario. Inténtalo de nuevo o escríbenos por WhatsApp.')
      }

      function openDay(idx, slot) {
        agenda.day = idx
        agenda.slot = slot || null
        agenda.view = 'times'
        agenda.month = monthOf(agenda.days[idx].date)
        showBookError('')
        renderTimesView(slot ? 'confirm' : 'title')
      }

      on(slotsBody, 'click', (e) => {
        const t = e.target.closest && e.target.closest('button')
        if (!t || t.disabled || !slotsBody.contains(t)) return
        const action = t.dataset.action
        if (action === 'retry') { loadSlots(); return }
        if (action === 'book') { book(); return }
        if (action === 'first') {
          const s = agenda.days[0].slots[0]
          openDay(0, s)
          trackEvent('slot_selected', { date: agenda.days[0].date, time: s.time || '', via: 'first' })
          return
        }
        if (action === 'prev-month' || action === 'next-month') {
          agenda.month = addMonths(agenda.month, action === 'next-month' ? 1 : -1)
          renderCalendarView('month')
          return
        }
        if (action === 'back') {
          agenda.view = 'calendar'
          showBookError('')
          renderCalendarView('day')
          return
        }
        if (t.dataset.date) {
          openDay(dayIndex(t.dataset.date))
          return
        }
        if (t.dataset.slot != null) {
          agenda.slot = agenda.days[agenda.day].slots[Number(t.dataset.slot)]
          slotsBody.querySelectorAll('.slot-time').forEach((b) => b.setAttribute('aria-pressed', String(b === t)))
          showBookError('')
          updatePick()
          trackEvent('slot_selected', { date: agenda.days[agenda.day].date, time: agenda.slot.time || '' })
        }
      })

      function startAgenda(lead, utms, honeypot) {
        Object.assign(agenda, { lead, utms, honeypot })
        slotsHead.classList.remove('hidden')
        slotsDur.textContent = '20 min'
        byId('agendaAlt').textContent = ''
        loadSlots()
      }

      let sending = false
      function enviarLead() {
        if (sending) return
        if (!stepOk(3)) return
        sending = true
        const v = Object.fromEntries(new FormData(form).entries())
        const honeypot = v.sitio || ''
        delete v.sitio
        if (v.telefono) v.telefono = '+51' + phoneDigits(v.telefono) // se guarda como +519XXXXXXXX
        if (v.correo) v.correo = v.correo.trim().toLowerCase()
        const { level, reason } = qualify(v)
        trackEvent('form_qualified', { level })
        const lead = { ...v, lead_id: leadId }
        // UTMs: los de la URL actual o, si no hay, los guardados por el sitio (last touch, 30 días)
        const utms = captureUtms()
        // Todo formulario completo llega a Make vía el servidor (encaje o no); la reserva llega aparte con el mismo lead_id.
        fetch('/api/agenda/lead', {
          method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead, utms, page_url: location.href, honeypot }),
        }).catch(() => { /* el registro no bloquea la agenda */ })
        if (level === 'no_apto') { renderNoFit(reason, lead); show('nofit') }
        else { show('agenda'); startAgenda(lead, utms, honeypot) }
        sending = false
      }
      on(submitBtn, 'click', enviarLead)
      on(form, 'submit', (e) => { e.preventDefault(); enviarLead() })
      /* Enter ("siguiente" en el teclado del celular): pasa al próximo campo; en el último, continúa */
      on(form, 'keydown', (e) => {
        if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return
        e.preventDefault()
        const n = [1, 2, 3].find((k) => !steps[k].classList.contains('hidden'))
        const fields = [...steps[n].querySelectorAll('input, select')].filter((el) => el.offsetParent !== null)
        const next = fields[fields.indexOf(e.target) + 1]
        if (next) { next.focus(); return }
        if (n === 3) enviarLead(); else if (stepOk(n)) show(n + 1)
      })
    })()

    /* ---------- cifras de casos: conteo suave ---------- */
    ;(() => {
      if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return
      $$('.pcase-n, .pcase-auth b, .plan.is-featured .plan-price b').forEach((el) => {
        const m = el.textContent.match(/^([^\d]*)([\d.,]+)(.*)$/); if (!m) return
        const [, pre, num, post] = m, dec = (num.split('.')[1] || '').length, to = parseFloat(num.replace(/,/g, ''))
        const original = el.textContent
        cleanups.push(() => { el.textContent = original })
        let done = false
        observe(IntersectionObserver, ([e], o) => {
          if (!e.isIntersecting || done) return; done = true; o.disconnect()
          const t0 = performance.now(), D = 1100
          const tick = (now) => {
            const q = Math.min(1, (now - t0) / D), v = to * (1 - Math.pow(1 - q, 3))
            el.textContent = pre + v.toFixed(dec) + post; if (q < 1) raf(tick)
          }
          raf(tick)
        }, { threshold: 0.6 }).observe(el)
      })
    })()

    /* ---------- entrada suave al entrar en pantalla ---------- */
    ;(() => {
      revealReady = true
      const items = $$('.mdf-reveal,[data-anim]')
      if (!items.length) return
      if (reduceMotion || !('IntersectionObserver' in window)) {
        items.forEach((el) => el.classList.add('is-in'))
        return
      }
      const io = observe(IntersectionObserver, (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return
          en.target.classList.add('is-in')
          io.unobserve(en.target)
        })
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
      items.forEach((el) => io.observe(el))
    })()

    /* ---------- casos en móvil: carrusel con puntos sincronizados ---------- */
    ;(() => {
      const track = $('.case-grid'), dots = $$('.case-dots i')
      if (!track || !dots.length) return
      let id = 0
      on(track, 'scroll', () => {
        caf(id)
        id = raf(() => {
          const cards = track.querySelectorAll('.case'); if (cards.length < 2) return
          const step = cards[1].offsetLeft - cards[0].offsetLeft || 1
          const i = Math.max(0, Math.min(dots.length - 1, Math.round(track.scrollLeft / step)))
          dots.forEach((d, k) => d.classList.toggle('is-on', k === i))
        })
      }, { passive: true })
    })()

    /* ---------- tubería viva: entran 100, 88 se fugan en el quiebre, 12 compran ---------- */
    ;(() => {
      const svg = $('.hero-art .pipe'), layer = byId('pipeFlow'), drop = byId('pipeDrop')
      const rig = byId('pipeRig')
      if (!svg || !layer || !drop || !rig || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return
      const NS = 'http://www.w3.org/2000/svg'
      const tIn = byId('pv-in'), tOut = byId('pv-out'), tLeak = byId('pv-leak')
      const texts = [tIn.textContent, tOut.textContent, tLeak.textContent]
      const TOTAL = 100, SOLD = 12, EVERY = 85, CUT = 288, EXIT = 660, FLOOR = 470
      const TILT = Math.tan(7 * Math.PI / 180), A = (+rig.dataset.angle || 0) * Math.PI / 180, CA = Math.cos(A), SA = Math.sin(A)
      const toWorld = (x, y) => [320 + (x - 320) * CA - (y - 245) * SA, 245 + (x - 320) * SA + (y - 245) * CA]
      let fate = [], spawned = 0, sold = 0, leaked = 0, since = 0, hold = 0, last = 0, id = 0, running = false
      const balls = []

      function deal() { // exactamente 12 de cada 100 llegan a comprar
        fate = Array.from({ length: TOTAL }, (_, i) => i < SOLD)
        for (let i = fate.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fate[i], fate[j]] = [fate[j], fate[i]] }
        spawned = sold = leaked = 0; paint()
      }
      function paint() { tIn.textContent = spawned; tOut.textContent = sold; tLeak.textContent = leaked ? '−' + leaked : '0' }
      function spawn() {
        const c = document.createElementNS(NS, 'circle')
        c.setAttribute('r', 9); c.setAttribute('fill', '#DEEAFB'); c.setAttribute('stroke', '#0b63b8'); c.setAttribute('stroke-width', 2.5)
        layer.append(c)
        balls.push({ el: c, x: -14, y: 204 + Math.random() * 52, vx: 135 + Math.random() * 45, vy: 0, keep: fate[spawned], state: 'flow' })
        spawned++; paint()
      }
      function step(now) {
        const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now
        if (spawned < TOTAL) { since += dt * 1000; while (since >= EVERY && spawned < TOTAL) { since -= EVERY; spawn() } }
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i]
          if (b.state === 'flow' && b.x >= CUT) {
            if (b.keep) { b.state = 'kept' }
            else { // sale del tubo: pasa a coordenadas del mundo y cae en vertical
              [b.x, b.y] = toWorld(b.x, b.y)
              b.state = 'fall'; b.vx = (Math.random() - 0.5) * 40; b.vy = 20 + Math.random() * 40
              b.el.setAttribute('fill', '#FF006E'); b.el.setAttribute('stroke', '#ff4d94')
              drop.append(b.el); leaked++; paint()
            }
          }
          if (b.state === 'fall') { b.vy += 620 * dt; b.y += b.vy * dt; b.x += b.vx * dt }
          else { b.x += b.vx * dt }
          let o = 1
          if (b.state === 'fall') o = Math.max(0, 1 - (b.y - 380) / (FLOOR - 380))
          const dy = b.state === 'kept' && b.x > 340 ? (b.x - 352) * TILT + 8 : 0 // el tramo derecho baja 7°
          b.el.setAttribute('cx', b.x.toFixed(1)); b.el.setAttribute('cy', (b.y + dy).toFixed(1)); b.el.setAttribute('opacity', o.toFixed(2))
          const gone = (b.state === 'fall' && b.y >= FLOOR) || (b.state === 'kept' && b.x >= EXIT)
          if (gone) { if (b.state === 'kept') { sold++; paint() } b.el.remove(); balls.splice(i, 1) }
        }
        if (spawned >= TOTAL && !balls.length) { hold += dt; if (hold > 1.6) { hold = 0; since = 0; deal() } }
        id = raf(step)
      }
      function start() { if (running) return; running = true; last = 0; id = raf(step) }
      function stop() { running = false; caf(id) }

      svg.classList.add('is-live'); deal()
      cleanups.push(() => {
        stop(); balls.forEach((b) => b.el.remove()); balls.length = 0
        svg.classList.remove('is-live'); [tIn.textContent, tOut.textContent, tLeak.textContent] = texts
      })
      observe(IntersectionObserver, ([e]) => { e.isIntersecting && !document.hidden ? start() : stop() }, { threshold: 0.1 }).observe(svg)
      on(document, 'visibilitychange', () => { document.hidden ? stop() : start() })
    })()

    /* ---------- lente flotante: el círculo y las etiquetas flotan y siguen al mouse; la tubería queda quieta ---------- */
    ;(() => {
      const svg = $('.hero-art .pipe')
      const lens = ['lensBg', 'lensClip', 'lensRing'].map(byId)
      if (!svg || lens.some((c) => !c) || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return
      const mid = [...svg.querySelectorAll('.px-mid')], far = [...svg.querySelectorAll('.px-far')]
      const hero = svg.closest('.hero') || document
      const fine = matchMedia('(pointer: fine)').matches
      let tx = 0, ty = 0, mx = 0, my = 0, id = 0, running = false
      if (fine) {
        on(hero, 'pointermove', (e) => {
          tx = Math.max(-1, Math.min(1, (e.clientX / innerWidth) * 2 - 1))
          ty = Math.max(-1, Math.min(1, (e.clientY / innerHeight) * 2 - 1))
        })
        on(hero, 'pointerleave', () => { tx = ty = 0 })
      }
      const frame = (now) => {
        mx += (tx - mx) * 0.04; my += (ty - my) * 0.04 // seguimiento suave
        const t = now / 1000
        const fx = Math.sin(t * 2 * Math.PI / 4.2) * 2, fy = Math.sin(t * 2 * Math.PI / 3.6) * 4 // flota algo menos que "la fuga"
        const cx = 320 + fx + mx * 3.5, cy = 245 + fy + my * 3
        lens.forEach((c) => { c.setAttribute('cx', cx.toFixed(2)); c.setAttribute('cy', cy.toFixed(2)) })
        mid.forEach((g) => g.setAttribute('transform', `translate(${(mx * 3).toFixed(2)} ${(my * 2.5).toFixed(2)})`))
        far.forEach((g) => g.setAttribute('transform', `translate(${(mx * 4).toFixed(2)} ${(my * 3.5).toFixed(2)})`))
        id = raf(frame)
      }
      const start = () => { if (!running) { running = true; id = raf(frame) } }
      const stop = () => { running = false; caf(id) }
      cleanups.push(stop)
      observe(IntersectionObserver, ([e]) => { e.isIntersecting && !document.hidden ? start() : stop() }, { threshold: 0.1 }).observe(svg)
      on(document, 'visibilitychange', () => { document.hidden ? stop() : start() })
    })()

    /* ---------- calculadora: la fórmula en vivo ---------- */
    ;(() => {
      const form = byId('calc'); if (!form) return
      const m = (k) => root.querySelector('[data-m="' + k + '"]')
      const paint = () => {
        const P = (form.querySelector('input[name="scen"]:checked') || { value: 30 }).value
        m('leads').textContent = (+byId('c-leads').value).toLocaleString('en-US')
        m('loss').textContent = P + '%'
        m('close').textContent = byId('c-close').value + '%'
        m('ticket').textContent = 'S/ ' + (+byId('c-ticket').value).toLocaleString('en-US')
      }
      on(form, 'input', paint); on(form, 'change', paint); paint()
    })()

    /* ---------- tuberías de la calculadora: bajan con el scroll de la sección ---------- */
    ;(() => {
      const sec = byId('calculadora')
      if (!sec || !sec.querySelector('.drip-pipe') || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return
      let id = 0
      const update = () => {
        id = 0
        const r = sec.getBoundingClientRect(), vh = innerHeight
        const p = Math.min(1, Math.max(0, (vh * 0.5 - r.top) / r.height)) // 0 cuando la sección llega a media pantalla, 1 cuando su final pasa por ahí
        sec.style.setProperty('--drift', p.toFixed(3))
      }
      on(window, 'scroll', () => { if (!id) id = raf(update) }, { passive: true })
      on(window, 'resize', update)
      update()
    })()

    return () => {
      alive = false
      rafIds.forEach((id) => cancelAnimationFrame(id)); rafIds.clear()
      timers.forEach((id) => clearTimeout(id)); timers.clear()
      cleanups.splice(0).reverse().forEach((fn) => fn())
    }
  }, [])

  return (
    <div
      ref={rootRef}
      id="contenido"
      className={`mdf js ${poppins.variable} ${dmMono.variable} ${caveat.variable}`}
    >
      <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT_CSS }} />
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      {/* iconos de etapa: trazo azul (currentColor) + un acento rosa */}
      <symbol id="s-atraer" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3.5l12.5 6-5.3 1.8L10.4 17z" /><path d="M12.6 11.6l5.4 5.4" /></g><circle cx="19" cy="18.5" r="2.6" fill="#FF006E" /></symbol>
      <symbol id="s-captar" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h8" /><path d="M12.5 16.5h3.5" strokeDasharray="1.5 2.2" /></g><circle cx="9" cy="16.5" r="2" fill="#FF006E" /></symbol>
      <symbol id="s-atender" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 6H4v10h2.5v3.5L11 16h9v-5" /></g><circle cx="18" cy="5.5" r="3.3" fill="#FF006E" /><path d="M18 4v1.6l1 .8" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" /></symbol>
      <symbol id="s-acompanar" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3.5l3 3-3 3" /><path d="M20 6.5H9a5 5 0 0 0-5 5" /><path d="M7 20.5l-3-3 3-3" /><path d="M4 17.5h11a5 5 0 0 0 5-5" /></g><circle cx="12" cy="12" r="2.4" fill="#FF006E" /></symbol>
      <symbol id="s-cerrar" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.8" /></g><circle cx="12" cy="12" r="2" fill="#FF006E" /></symbol>
      <symbol id="s-chart" viewBox="0 0 24 24"><path d="M5 20v-7M10 20V9M15 20v-5M3 20.5h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M20 20V5" stroke="#FF006E" strokeWidth="2.4" strokeLinecap="round" /></symbol>
      <symbol id="s-store" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M7 7V5h10v2" /></g><circle cx="12" cy="13" r="2.8" fill="#FF006E" /></symbol>
      <symbol id="s-form" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3.5" y="4" width="17" height="6" rx="1.5" /><rect x="3.5" y="14" width="17" height="6" rx="1.5" /></g><path d="M7 17h4" stroke="#FF006E" strokeWidth="2.4" strokeLinecap="round" /></symbol>
      <symbol id="s-speed" viewBox="0 0 24 24"><path d="M3.5 17a8.5 8.5 0 0 1 17 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M12 17l4.5-5.5" stroke="#FF006E" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="17" r="1.8" fill="#FF006E" /></symbol>
      <symbol id="s-wa" viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.2" fill="#FF006E" /></symbol>
      <symbol id="s-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 7v5l3.5 2" fill="none" stroke="#FF006E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="s-chat" viewBox="0 0 24 24"><path d="M4 5h16v11H11l-4.5 3.5V16H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 10.5h8" stroke="#FF006E" strokeWidth="2.4" strokeLinecap="round" /></symbol>
      <symbol id="s-bell" viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="20.5" r="2" fill="#FF006E" /></symbol>
      <symbol id="s-doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 12h6M9 16h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="17" cy="17" r="3" fill="#FF006E" /></symbol>
      <symbol id="s-megaphone" viewBox="0 0 24 24"><path d="M3.5 10v4h3l7 4.5v-13l-7 4.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M17 9.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M20 3v5M17.5 5.5h5" stroke="#FF006E" strokeWidth="2.2" strokeLinecap="round" /></symbol>
      <symbol id="s-refresh" viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19.5 3.5v4h-4" fill="none" stroke="#FF006E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="s-bot" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V5.5" strokeLinecap="round" /><path d="M9 13.5v1M15 13.5v1" strokeLinecap="round" /></g><circle cx="12" cy="4" r="2.2" fill="#FF006E" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-yes" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="currentColor" /><path d="M8.5 14.5l3.8 3.8 7.4-8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <filter id="to-navy" colorInterpolationFilters="sRGB"><feFlood floodColor="#182345" /><feComposite in2="SourceAlpha" operator="in" /></filter>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></symbol>
      <symbol id="i-no" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="currentColor" /><path d="M9.5 9.5l9 9M18.5 9.5l-9 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></symbol>
      <symbol id="i-ticks" viewBox="0 0 30 20"><path d="M2 10.5l5 5L17 4.5M13 15.5L24 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></symbol>
      <symbol id="i-map" viewBox="0 0 24 24"><path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z M9 4.5v13 M15 6.5v13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-wrench" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0 5 5L20.5 12a5.5 5.5 0 0 1-6.9 1.6L7 20.2a2 2 0 0 1-2.9-2.9l6.6-6.6A5.5 5.5 0 0 1 12.3 3.5l.7.8a4 4 0 0 0 1.7 2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-cycle" viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M18.5 3.5v3.8h-3.8M5.5 20.5v-3.8h3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-cal" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></g></symbol>
      <symbol id="i-tag" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-7 7a1.5 1.5 0 0 1-2.1 0z" /><circle cx="8.3" cy="8.3" r="1.4" /></g></symbol>
      <symbol id="i-file" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M14 3v4h4M9 13h6M9 17h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></symbol>
      </svg>
      {/* ================= 1 · HERO ESTÁTICO ================= */}
      <section className="hero navy" id="inicio" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <ul className="price-pills is-dark" aria-label="Precio">
            <li className="pill pill-free"><svg aria-hidden="true"><use href="#i-check" /></svg><span>Evaluación gratis<span className="pill-sep">{" "}·{" "}</span><b>20 min</b></span></li>
            <li className="pill pill-price"><span>Mapa de Fugas<span className="pill-sep">{" "}·{" "}</span><b>USD 600 + IGV</b></span></li>
          </ul>
          <h1 id="hero-title"><span className="ln">No te faltan leads.</span>{" "}<span className="hot">Te sobran{" "}<mark className="hl">fugas.</mark></span></h1>
          <p className="lead">En{" "}<strong>7 días</strong>{" "}encontramos dónde se escapan tus ventas y qué corregir primero.</p>
          <div className="blind-wrap">
            <p className="blind-k">Antes de</p>
            <ul className="blind">
              <li><span className="blind-ico"><svg aria-hidden="true"><use href="#s-megaphone" /></svg></span><s>subir la pauta</s></li>
              <li><span className="blind-ico"><svg aria-hidden="true"><use href="#s-refresh" /></svg></span><s>volver a optimizar</s></li>
              <li><span className="blind-ico"><svg aria-hidden="true"><use href="#s-bot" /></svg></span><s>sumar un CRM o un bot</s></li>
            </ul>
          </div>
          <div className="hero-ctas">{" "}
            <a className="btn hero-btn" href="#agendar" data-cta="hero">Agendar evaluación gratis</a>{" "}
            <a className="text-link" href="#fugas">Ver cómo funciona{" "}<svg aria-hidden="true"><use href="#i-arrow" /></svg></a>{" "}
          </div>
          <ul className="trust" aria-label="Credenciales de Manya">
            <li><b>+16</b><span>años</span></li>
            <li><b>+800</b><span>clientes</span></li>
            <li><b>Kommo</b><span>partner certificado</span></li>
          </ul>
        </div>
        <figure className="hero-art">{" "}
          <svg className="pipe" viewBox="36 0 572 492" role="img" aria-labelledby="heroArtTitle heroArtDesc" xmlns="http://www.w3.org/2000/svg">
            <title id="heroArtTitle">La tubería de ventas, cortada en dos</title>
            <desc id="heroArtDesc">Entran 100 oportunidades por una tubería azul. Dentro avanzan los leads azules; por el corte se escapan 88 leads rojos y solo 12 llegan a comprar.</desc>
            <defs>
              <radialGradient id="pipeHeat" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#FF006E" stopOpacity=".3" />
                <stop offset="1" stopColor="#FF006E" stopOpacity="0" />
              </radialGradient>
              <clipPath id="pipeL"><path d="M-30 184H286L297 199L284 213L299 229L286 244L301 261L290 276H-30Z" /></clipPath>
              <clipPath id="pipeR"><path d="M352 184L341 199L356 214L343 230L358 246L345 262L356 276H700V184Z" /></clipPath>
              <clipPath id="pipeLens"><circle id="lensClip" cx="320" cy="245" r="230" /></clipPath>
              <marker id="leakArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0l10 5-10 5z" fill="#FF006E" />
              </marker>
              <marker id="pipeArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0l10 5-10 5z" fill="#8fd0ff" />
              </marker>
            </defs>
            <g className="px-near">
            <circle id="lensBg" cx="320" cy="245" r="232" fill="#ffffff" />
            <g clipPath="url(#pipeLens)">
              <g id="pipeRig" data-angle="6" transform="rotate(6 320 245)">
                {/* 1 · interior del tubo */}
                <path d="M-30 184H286L297 199L284 213L299 229L286 244L301 261L290 276H-30Z" fill="#0d55ad" />
                <g transform="rotate(7 352 230) translate(-5 8)"><path d="M352 184L341 199L356 214L343 230L358 246L345 262L356 276H700V184Z" fill="#0d55ad" /></g>
                {/* 2 · leads dentro del tubo (los dibuja el script) */}
                <g className="pipe-static" fill="#DEEAFB" stroke="#0b63b8" strokeWidth="2.5">
                  <circle cx="176" cy="214" r="9" /><circle cx="204" cy="244" r="9" /><circle cx="232" cy="220" r="9" /><circle cx="258" cy="246" r="9" />
                  <g transform="rotate(7 352 230) translate(-5 8)"><circle cx="430" cy="218" r="9" /><circle cx="476" cy="244" r="9" /></g>
                </g>
                <g id="pipeFlow" />
                {/* 3 · pared frontal translúcida, quiebre y bridas */}
                <g clipPath="url(#pipeL)">
                  <rect x="-40" y="184" width="760" height="92" fill="#2396FE" opacity=".48" />
                  <rect x="-40" y="184" width="760" height="6" fill="#0b63b8" />
                  <rect x="-40" y="195" width="760" height="9" fill="#DEEAFB" opacity=".45" />
                  <rect x="-40" y="208" width="760" height="3" fill="#DEEAFB" opacity=".25" />
                  <rect x="-40" y="256" width="760" height="14" fill="#0b63b8" opacity=".45" />
                  <rect x="-40" y="270" width="760" height="6" fill="#0b63b8" />
                  <path d="M270 184H286L297 199L284 213L299 229L286 244L301 261L290 276H272L284 261L269 244L282 229L267 213L280 199Z" fill="#0f1830" />
                </g>
                <path d="M286 184L297 199L284 213L299 229L286 244L301 261L290 276" fill="none" stroke="#DEEAFB" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M284 213l-22-7-12 5M286 244l-26 6-9-4M280 199l-18-9" fill="none" stroke="#0f1830" strokeWidth="2" strokeLinecap="round" opacity=".75" />
                <g>
                  <rect x="150" y="166" width="30" height="128" rx="3" fill="#0b63b8" />
                  <rect x="154" y="166" width="7" height="128" fill="#8fd0ff" opacity=".35" />
                  <g><g transform="translate(165 178)"><path d="M-5 0L-2.5 -4.33H2.5L5 0L2.5 4.33H-2.5Z" fill="#8fd0ff" stroke="#0f1830" strokeWidth="1.2" /><circle r="1.9" fill="#0f1830" /></g><g transform="translate(165 210)"><path d="M-5 0L-2.5 -4.33H2.5L5 0L2.5 4.33H-2.5Z" fill="#8fd0ff" stroke="#0f1830" strokeWidth="1.2" /><circle r="1.9" fill="#0f1830" /></g><g transform="translate(165 250)"><path d="M-5 0L-2.5 -4.33H2.5L5 0L2.5 4.33H-2.5Z" fill="#8fd0ff" stroke="#0f1830" strokeWidth="1.2" /><circle r="1.9" fill="#0f1830" /></g><g transform="translate(165 282)"><path d="M-5 0L-2.5 -4.33H2.5L5 0L2.5 4.33H-2.5Z" fill="#8fd0ff" stroke="#0f1830" strokeWidth="1.2" /><circle r="1.9" fill="#0f1830" /></g></g>
                </g>
                <g transform="rotate(7 352 230) translate(-5 8)">
                  <g clipPath="url(#pipeR)">
                    <rect x="330" y="184" width="760" height="92" fill="#2396FE" opacity=".48" />
                  <rect x="330" y="184" width="760" height="6" fill="#0b63b8" />
                  <rect x="330" y="195" width="760" height="9" fill="#DEEAFB" opacity=".45" />
                  <rect x="330" y="208" width="760" height="3" fill="#DEEAFB" opacity=".25" />
                  <rect x="330" y="256" width="760" height="14" fill="#0b63b8" opacity=".45" />
                  <rect x="330" y="270" width="760" height="6" fill="#0b63b8" />
                    <path d="M352 184L368 184L357 199L372 214L359 230L374 246L361 262L372 276L356 276L345 262L358 246L343 230L356 214L341 199Z" fill="#0f1830" />
                  </g>
                  <path d="M352 184L341 199L356 214L343 230L358 246L345 262L356 276" fill="none" stroke="#DEEAFB" strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M356 214l24-6 10 6M358 246l22 4M352 184l20 8" fill="none" stroke="#0f1830" strokeWidth="2" strokeLinecap="round" opacity=".75" />
                  <g>
                  <rect x="462" y="166" width="30" height="128" rx="3" fill="#0b63b8" />
                  <rect x="466" y="166" width="7" height="128" fill="#8fd0ff" opacity=".35" />
                  <g><g transform="translate(477 178)"><path d="M-5 0L-2.5 -4.33H2.5L5 0L2.5 4.33H-2.5Z" fill="#8fd0ff" stroke="#0f1830" strokeWidth="1.2" /><circle r="1.9" fill="#0f1830" /></g><g transform="translate(477 210)"><path d="M-5 0L-2.5 -4.33H2.5L5 0L2.5 4.33H-2.5Z" fill="#8fd0ff" stroke="#0f1830" strokeWidth="1.2" /><circle r="1.9" fill="#0f1830" /></g><g transform="translate(477 250)"><path d="M-5 0L-2.5 -4.33H2.5L5 0L2.5 4.33H-2.5Z" fill="#8fd0ff" stroke="#0f1830" strokeWidth="1.2" /><circle r="1.9" fill="#0f1830" /></g><g transform="translate(477 282)"><path d="M-5 0L-2.5 -4.33H2.5L5 0L2.5 4.33H-2.5Z" fill="#8fd0ff" stroke="#0f1830" strokeWidth="1.2" /><circle r="1.9" fill="#0f1830" /></g></g>
                </g>
                </g>
                <g fill="#9fb3d6" opacity=".9">
                  <path d="M318 196l7-5 2 8z" /><path d="M326 262l8 2-5 6z" /><path d="M312 230l5-3 1 6z" />
                </g>
              </g>
              {/* lo que cae: en vertical, fuera del giro */}
              <g id="pipeDrop" />
            </g>
            <circle id="lensRing" cx="320" cy="245" r="232" fill="none" stroke="#3a5088" strokeWidth="2" />
            </g>
            {/* fuga: lo que cae por el quiebre */}
            <g>
              <g className="pipe-static" fill="#FF006E">
                <circle cx="298" cy="318" r="10" />
                <circle cx="314" cy="374" r="11" />
                <circle cx="330" cy="420" r="9" />
              </g>
              <g className="pipe-static" fill="#ffd6e7" opacity=".9">
                <circle cx="295" cy="315" r="3" /><circle cx="311" cy="371" r="3.4" /><circle cx="327" cy="417" r="2.6" />
              </g>
            </g>
            <g className="px-mid"><g className="leak-note">
              <path d="M426 134C420 166 372 186 326 200" fill="none" stroke="#FF006E" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 6" markerEnd="url(#leakArrow)" />
              <text x="402" y="114" fontSize="32" fontWeight="700" fill="#FF006E" transform="rotate(-8 402 114)" style={{ fontFamily: "var(--mdf-caveat), cursive" }}>la fuga</text>
            </g></g>
            {/* etiquetas */}
            <g className="px-far"><g>
              <rect x="62" y="330" width="104" height="58" rx="12" fill="#0f1830" stroke="#2396FE" strokeWidth=".75" />
              <text x="114" y="359" textAnchor="middle" fontSize="25" fontWeight="800" fill="#fff" id="pv-in" style={{ fontFamily: "var(--mdf-poppins), sans-serif" }}>100</text>
              <text x="114" y="376" textAnchor="middle" fontSize="9" letterSpacing="1.6" fill="#8fd0ff" style={{ fontFamily: "var(--mdf-dmmono), monospace" }}>ENTRAN</text>
            </g></g>
            <g className="px-far"><g>
              <rect x="474" y="384" width="104" height="58" rx="12" fill="#0f1830" stroke="#2396FE" strokeWidth=".75" />
              <text x="526" y="413" textAnchor="middle" fontSize="25" fontWeight="800" fill="#fff" id="pv-out" style={{ fontFamily: "var(--mdf-poppins), sans-serif" }}>12</text>
              <text x="526" y="430" textAnchor="middle" fontSize="9" letterSpacing="1.6" fill="#8fd0ff" style={{ fontFamily: "var(--mdf-dmmono), monospace" }}>COMPRAN</text>
            </g></g>
            <g className="px-far"><g transform="translate(268 80)">
              <rect width="104" height="52" rx="11" fill="#FF006E" />
              <text x="52" y="24" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff" id="pv-leak" style={{ fontFamily: "var(--mdf-poppins), sans-serif" }}>−88</text>
              <text x="52" y="40" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill="#ffe1ee" style={{ fontFamily: "var(--mdf-dmmono), monospace" }}>SE FUGAN</text>
            </g></g>
          </svg>{" "}
        </figure>
      </div>
      </section>
      {/* ================= 2 · LAS CINCO FUGAS ================= */}
      <section className="section" id="fugas" aria-labelledby="fugas-title">
      <div className="wrap">
        <div className="section-head mdf-reveal">
          <p className="kicker">El problema</p>
          <h2 className="h2" id="fugas-title">No se fugan todas juntas.{" "}<span className="lite">Se fugan en cinco lugares.</span></h2>
          <p className="lead">Sobre 100 oportunidades que ya pagaste: así se van cayendo, etapa por etapa.</p>
        </div>
        <div className="fugas-shell">
          <div className="fugas-top">
          <div className="fugas-tabs" role="tablist" aria-label="Etapas del recorrido">{" "}
            <button type="button" role="tab" id="tab-atraer" aria-controls="panel-atraer" aria-selected="true" tabIndex="0" data-stage="atraer"><small aria-hidden="true">01</small>Atraer</button>{" "}
            <button type="button" role="tab" id="tab-captar" aria-controls="panel-captar" aria-selected="false" tabIndex="-1" data-stage="captar"><small aria-hidden="true">02</small>Captar</button>{" "}
            <button type="button" role="tab" id="tab-atender" aria-controls="panel-atender" aria-selected="false" tabIndex="-1" data-stage="atender"><small aria-hidden="true">03</small>Atender</button>{" "}
            <button type="button" role="tab" id="tab-acompanar" aria-controls="panel-acompanar" aria-selected="false" tabIndex="-1" data-stage="acompanar"><small aria-hidden="true">04</small>Acompañar</button>{" "}
            <button type="button" role="tab" id="tab-cerrar" aria-controls="panel-cerrar" aria-selected="false" tabIndex="-1" data-stage="cerrar"><small aria-hidden="true">05</small>Cerrar</button>{" "}
          </div>
          <div className="fugas-count" aria-hidden="true" style={{ "--v": "100" }}>
            <p className="fc-row"><b data-count="">100</b><span data-count-label="">hacen clic en tu anuncio</span></p>{" "}
            <i className="fc-bar" />{" "}
            <span className="fc-loss" data-flow-loss="" data-state="start">Punto de partida</span>{" "}
          </div>
          </div>
          <div className="fugas-panels">
            <article className="fuga-panel" id="panel-atraer" data-stage="atraer" aria-labelledby="fuga-atraer">
              <div className="fuga-head">{" "}
                <span className="fuga-ico" aria-hidden="true"><svg><use href="#s-atraer" /></svg></span>{" "}
                <h3 id="fuga-atraer">Atraer</h3>{" "}
                <span className="fuga-step">1 de 5</span>{" "}
                <span className="fuga-loss is-start">100 entran</span>{" "}
              </div>
              <div className="fuga-body">
                <div className="fuga-copy">
                  <p className="fuga-fig"><b>100</b><span>hacen clic en tu anuncio</span></p>
                  <p className="fuga-leak">Tu plataforma solo mide hasta aquí.</p>
                  <p className="fuga-say">100 personas hacen clic. La plataforma te dice que la campaña va bien, pero solo mide hasta aquí.</p>
                </div>
                <figure className="mock mock-ad fuga-mock" aria-label="Ejemplo ilustrativo de anuncio de búsqueda">
                  <p className="mk-hand" aria-hidden="true"><span className="mh-say">100 clics… ¿y después?</span></p>
                  <div className="ad-search"><svg aria-hidden="true"><use href="#i-search" /></svg><span className="ad-q">implantes dentales lima precio</span></div>
                  <div className="ad-card">{" "}
                    <span className="ad-tag">Patrocinado</span>{" "}
                    <span className="ad-url">tunegocio.pe › implantes</span>{" "}
                    <b className="ad-title">Implantes dentales en Lima | Evaluación gratis</b>{" "}
                  </div>
                  <div className="ad-metrics mono"><span>Clics{" "}<b>100</b></span><span>CTR{" "}<b>6.2%</b></span><span>CPC{" "}<b>S/ 2.40</b></span><span className="mk-miss">Ventas{" "}<b>?</b></span></div>
                  <p className="mk-flag">La plataforma no ve qué pasa después del clic.</p>
                </figure>
              </div>
              <ul className="fuga-table" aria-label="Lo que revisamos y lo que encontramos">
                <li className="fuga-thead" aria-hidden="true"><span>Revisamos</span><span>Encontramos</span></li>
                <li><svg aria-hidden="true"><use href="#s-chart" /></svg>Lo que reporta la pauta<em className="chip-f">100 clics</em></li>
                <li><svg aria-hidden="true"><use href="#s-store" /></svg>Lo que entra a tu negocio<em className="chip-f">sin medir</em></li>
              </ul>
            </article>
            <article className="fuga-panel" id="panel-captar" data-stage="captar" aria-labelledby="fuga-captar">
              <div className="fuga-head">{" "}
                <span className="fuga-ico" aria-hidden="true"><svg><use href="#s-captar" /></svg></span>{" "}
                <h3 id="fuga-captar">Captar</h3>{" "}
                <span className="fuga-step">2 de 5</span>{" "}
                <span className="fuga-loss"><b>−36</b>{" "}acumulados</span>{" "}
              </div>
              <div className="fuga-body">
                <div className="fuga-copy">
                  <p className="fuga-fig"><b>64</b><span>de 100 siguen</span></p>
                  <p className="fuga-leak"><b>36</b>{" "}se van sin dejar sus datos</p>
                  <p className="fuga-say">Llegan a la landing, empiezan el formulario o el WhatsApp, y lo abandonan. Fricción, campos de más, una página lenta.</p>
                </div>
                <figure className="mock mock-form fuga-mock" aria-label="Ejemplo ilustrativo de formulario abandonado">
                  <p className="mk-hand" aria-hidden="true"><span className="mh-loss">−36<svg viewBox="0 0 120 64" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M26 10 C52 0 100 2 113 22 C124 40 100 60 60 61 C24 62 3 50 7 31 C10 18 26 8 52 5" /></svg></span><span className="mh-say">¡formulario eterno!</span></p>
                  <div className="mf-top mono"><span>Paso 1 de 3</span><span className="mk-slow">Cargando… 6.4 s</span></div>
                  <div className="mf-row"><span>Nombre</span><i>María T.</i></div>
                  <div className="mf-row"><span>Teléfono</span><i>+51 98</i></div>
                  <div className="mf-row mk-bad"><span>Distrito</span><i /></div>
                  <div className="mf-more mono">+ 6 campos obligatorios más</div>
                  <p className="mk-flag">9 campos y una página lenta: se van antes de enviar.</p>
                </figure>
              </div>
              <ul className="fuga-table" aria-label="Lo que revisamos y lo que encontramos">
                <li className="fuga-thead" aria-hidden="true"><span>Revisamos</span><span>Encontramos</span></li>
                <li><svg aria-hidden="true"><use href="#s-form" /></svg>Formulario<em className="chip-f">9 campos</em></li>
                <li><svg aria-hidden="true"><use href="#s-speed" /></svg>Velocidad<em className="chip-f">6.4 s</em></li>
                <li><svg aria-hidden="true"><use href="#s-wa" /></svg>WhatsApp<em className="chip-f">lo abandonan</em></li>
              </ul>
            </article>
            <article className="fuga-panel" id="panel-atender" data-stage="atender" aria-labelledby="fuga-atender">
              <div className="fuga-head">{" "}
                <span className="fuga-ico" aria-hidden="true"><svg><use href="#s-atender" /></svg></span>{" "}
                <h3 id="fuga-atender">Atender</h3>{" "}
                <span className="fuga-step">3 de 5</span>{" "}
                <span className="fuga-loss"><b>−59</b>{" "}acumulados</span>{" "}
              </div>
              <div className="fuga-body">
                <div className="fuga-copy">
                  <p className="fuga-fig"><b>41</b><span>de 100 siguen</span></p>
                  <p className="fuga-leak"><b>23</b>{" "}se enfrían esperando respuesta</p>
                  <p className="fuga-say">Escriben con ganas de comprar. La respuesta llega horas después, o no resuelve su duda real. Para entonces ya le escribieron a otro.</p>
                </div>
                <figure className="mock mock-chat fuga-mock" aria-label="Ejemplo ilustrativo de conversación de WhatsApp con respuesta tardía">
                  <p className="mk-hand" aria-hidden="true"><span className="mh-loss">−23<svg viewBox="0 0 120 64" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M26 10 C52 0 100 2 113 22 C124 40 100 60 60 61 C24 62 3 50 7 31 C10 18 26 8 52 5" /></svg></span><span className="mh-say">¡4 horas!</span></p>
                  <div className="chat-head"><span className="avatar">M</span><b>María T.</b><span className="mono">en línea</span></div>
                  <div className="bubble in">Hola, ¿cuánto cuesta el implante? ¿Tienen cita esta semana?<time>10:02</time></div>
                  <div className="chat-gap mono"><svg aria-hidden="true"><use href="#i-clock" /></svg>{" "}4 h 45 min sin respuesta</div>
                  <div className="bubble out mk-bad">Hola, gracias por escribir 😊 ¿En qué podemos ayudarte?<time>14:47</time></div>
                  <div className="bubble in late">Ya encontré otra clínica, gracias.<time>14:52</time></div>
                  <p className="mk-flag">Tarde y sin precio ni cita: no respondió lo que preguntó.</p>
                </figure>
              </div>
              <ul className="fuga-table" aria-label="Lo que revisamos y lo que encontramos">
                <li className="fuga-thead" aria-hidden="true"><span>Revisamos</span><span>Encontramos</span></li>
                <li><svg aria-hidden="true"><use href="#s-clock" /></svg>Tiempo de respuesta<em className="chip-f">4 h 45 min</em></li>
                <li><svg aria-hidden="true"><use href="#s-chat" /></svg>Calidad de respuesta<em className="chip-f">sin precio</em></li>
              </ul>
            </article>
            <article className="fuga-panel" id="panel-acompanar" data-stage="acompanar" aria-labelledby="fuga-acompanar">
              <div className="fuga-head">{" "}
                <span className="fuga-ico" aria-hidden="true"><svg><use href="#s-acompanar" /></svg></span>{" "}
                <h3 id="fuga-acompanar">Acompañar</h3>{" "}
                <span className="fuga-step">4 de 5</span>{" "}
                <span className="fuga-loss"><b>−72</b>{" "}acumulados</span>{" "}
              </div>
              <div className="fuga-body">
                <div className="fuga-copy">
                  <p className="fuga-fig"><b>28</b><span>de 100 siguen</span></p>
                  <p className="fuga-leak"><b>13</b>{" "}cotizaciones quedan en visto</p>
                  <p className="fuga-say">Se envía la cotización y nadie vuelve a escribir. Sin seguimiento, sin recordatorio, sin reactivación.</p>
                </div>
                <figure className="mock mock-quote fuga-mock" aria-label="Ejemplo ilustrativo de cotización sin seguimiento">
                  <p className="mk-hand" aria-hidden="true"><span className="mh-loss">−13<svg viewBox="0 0 120 64" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M26 10 C52 0 100 2 113 22 C124 40 100 60 60 61 C24 62 3 50 7 31 C10 18 26 8 52 5" /></svg></span><span className="mh-say">nadie insistió</span></p>
                  <div className="q-doc">{" "}
                    <span className="q-file"><svg aria-hidden="true"><use href="#i-file" /></svg>Cotizacion_implante.pdf</span>{" "}
                    <span className="q-meta mono">Enviado lun 10:15 · Visto{" "}<svg className="ticks" aria-label="leído"><use href="#i-ticks" /></svg></span>{" "}
                  </div>
                  <ol className="q-days mono">
                    <li><b>Lun</b>Enviada</li><li className="miss"><b>Mar</b>✕</li><li className="miss"><b>Mié</b>✕</li><li className="miss"><b>Jue</b>✕</li><li className="miss"><b>Vie</b>✕</li><li className="cold"><b>+15 d</b>Perdida</li>
                  </ol>
                  <p className="mk-flag">0 mensajes de seguimiento en 15 días. La vio y nadie volvió a escribir.</p>
                </figure>
              </div>
              <ul className="fuga-table" aria-label="Lo que revisamos y lo que encontramos">
                <li className="fuga-thead" aria-hidden="true"><span>Revisamos</span><span>Encontramos</span></li>
                <li><svg aria-hidden="true"><use href="#s-acompanar" /></svg>Seguimiento<em className="chip-f">0 en 15 días</em></li>
                <li><svg aria-hidden="true"><use href="#s-bell" /></svg>Recordatorios<em className="chip-f">ninguno</em></li>
              </ul>
            </article>
            <article className="fuga-panel" id="panel-cerrar" data-stage="cerrar" aria-labelledby="fuga-cerrar">
              <div className="fuga-head">{" "}
                <span className="fuga-ico" aria-hidden="true"><svg><use href="#s-cerrar" /></svg></span>{" "}
                <h3 id="fuga-cerrar">Cerrar</h3>{" "}
                <span className="fuga-step">5 de 5</span>{" "}
                <span className="fuga-loss"><b>−88</b>{" "}acumulados</span>{" "}
              </div>
              <div className="fuga-body">
                <div className="fuga-copy">
                  <p className="fuga-fig"><b>12</b><span>de 100 compran</span></p>
                  <p className="fuga-leak"><b>16</b>{" "}se caen y nadie sabe por qué</p>
                  <p className="fuga-say">Y de los 16 que se cayeron al final, nadie registró por qué. Sin ese dato, la próxima decisión vuelve a ser a ciegas.</p>
                </div>
                <figure className="mock mock-close fuga-mock" aria-label="Ejemplo ilustrativo: 12 ventas de 100 clics">
                  <p className="mk-hand" aria-hidden="true"><span className="mh-loss">−16<svg viewBox="0 0 120 64" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M26 10 C52 0 100 2 113 22 C124 40 100 60 60 61 C24 62 3 50 7 31 C10 18 26 8 52 5" /></svg></span><span className="mh-say">¿por qué? ni idea</span></p>
                  <div className="dots" data-dots="" aria-hidden="true" />
                  <div className="close-legend mono"><span><i className="k-sold" />12 ventas</span><span><i className="k-lost" />88 se fugaron</span></div>
                  <div className="mf-top mono close-why"><span>Motivo de pérdida</span><span className="mk-slow">— sin registrar</span></div>
                  <p className="mk-flag">Nadie anotó por qué se cayeron. La próxima decisión vuelve a ser a ciegas.</p>
                </figure>
              </div>
              <ul className="fuga-table" aria-label="Lo que revisamos y lo que encontramos">
                <li className="fuga-thead" aria-hidden="true"><span>Revisamos</span><span>Encontramos</span></li>
                <li><svg aria-hidden="true"><use href="#s-cerrar" /></svg>Motivos de pérdida<em className="chip-f">sin anotar</em></li>
                <li><svg aria-hidden="true"><use href="#s-doc" /></svg>Registro de ventas<em className="chip-f">a medias</em></li>
              </ul>
            </article>
          </div>
        </div>
      </div>
      </section>
      {/* ================= 3 · CALCULADORA ================= */}
      <section className="section navy" id="calculadora" aria-labelledby="calc-title">{" "}
      <svg className="drip-pipe" viewBox="0 0 260 260" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(9 0 60)">
          {/* tubo translúcido que entra desde el borde y termina quebrado */}
          <path d="M-20 34H170L180 47L168 59L182 72L170 86H-20Z" fill="#0d55ad" />
          <path d="M-20 34H170L180 47L168 59L182 72L170 86H-20Z" fill="#2396FE" opacity=".5" />
          <rect x="-20" y="34" width="200" height="5" fill="#0b63b8" />
          <rect x="-20" y="43" width="190" height="7" fill="#DEEAFB" opacity=".42" />
          <rect x="-20" y="81" width="190" height="5" fill="#0b63b8" />
          <path d="M158 34H170L180 47L168 59L182 72L170 86H158L169 72L156 59L168 47Z" fill="#0f1830" />
          <path d="M170 34L180 47L168 59L182 72L170 86" fill="none" stroke="#DEEAFB" strokeWidth="2" strokeLinejoin="round" />
          <path d="M168 59l-18-5-9 4M170 86l-14-6" fill="none" stroke="#0f1830" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
          {/* brida con pernos */}
          <rect x="76" y="20" width="22" height="80" rx="3" fill="#0b63b8" />
          <rect x="79" y="20" width="5" height="80" fill="#8fd0ff" opacity=".35" />
          <circle cx="87" cy="30" r="2.6" fill="#8fd0ff" /><circle cx="87" cy="50" r="2.6" fill="#8fd0ff" />
          <circle cx="87" cy="70" r="2.6" fill="#8fd0ff" /><circle cx="87" cy="90" r="2.6" fill="#8fd0ff" />
        </g>
        {/* gotas que se escapan por el quiebre */}
        <circle className="drop" cx="172" cy="108" r="7" fill="#FF006E" />
        <circle className="drop" cx="168" cy="108" r="5.5" fill="#FF006E" />
        <circle className="drop" cx="176" cy="108" r="6" fill="#ff4d94" />
      </svg>{" "}
      <svg className="drip-pipe is-right" viewBox="0 0 260 260" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(9 0 60)">
          {/* tubo translúcido que entra desde el borde y termina quebrado */}
          <path d="M-20 34H170L180 47L168 59L182 72L170 86H-20Z" fill="#0d55ad" />
          <path d="M-20 34H170L180 47L168 59L182 72L170 86H-20Z" fill="#2396FE" opacity=".5" />
          <rect x="-20" y="34" width="200" height="5" fill="#0b63b8" />
          <rect x="-20" y="43" width="190" height="7" fill="#DEEAFB" opacity=".42" />
          <rect x="-20" y="81" width="190" height="5" fill="#0b63b8" />
          <path d="M158 34H170L180 47L168 59L182 72L170 86H158L169 72L156 59L168 47Z" fill="#0f1830" />
          <path d="M170 34L180 47L168 59L182 72L170 86" fill="none" stroke="#DEEAFB" strokeWidth="2" strokeLinejoin="round" />
          <path d="M168 59l-18-5-9 4M170 86l-14-6" fill="none" stroke="#0f1830" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
          {/* brida con pernos */}
          <rect x="76" y="20" width="22" height="80" rx="3" fill="#0b63b8" />
          <rect x="79" y="20" width="5" height="80" fill="#8fd0ff" opacity=".35" />
          <circle cx="87" cy="30" r="2.6" fill="#8fd0ff" /><circle cx="87" cy="50" r="2.6" fill="#8fd0ff" />
          <circle cx="87" cy="70" r="2.6" fill="#8fd0ff" /><circle cx="87" cy="90" r="2.6" fill="#8fd0ff" />
        </g>
        {/* gotas que se escapan por el quiebre */}
        <circle className="drop" cx="172" cy="108" r="7" fill="#FF006E" />
        <circle className="drop" cx="168" cy="108" r="5.5" fill="#FF006E" />
        <circle className="drop" cx="176" cy="108" r="6" fill="#ff4d94" />
      </svg>{" "}
      <div className="wrap">
        <div className="calc-card">
          <div className="section-head mdf-reveal">
            <p className="kicker">Calculadora</p>
          <h2 className="h2 calc-title" id="calc-title">¿Y en tu negocio,{" "}<span className="lite">cuánto se escapa?</span></h2>
            <p className="lead">Tres de estos datos los conoces. El cuarto no, y ese es justamente el problema: es lo que el Mapa mide.</p>
          </div>
          <div className="calc mdf-reveal">
            <form className="calc-controls" id="calc" aria-labelledby="calc-title" onSubmit={noSubmit}>
              <div className="ctrl"><div className="ctrl-top"><label htmlFor="c-leads">Leads al mes</label><output htmlFor="c-leads" id="o-leads">300</output></div><input type="range" id="c-leads" min="50" max="2000" step="10" defaultValue="300" /></div>
              <div className="ctrl"><div className="ctrl-top"><label htmlFor="c-close">Tasa de cierre</label><output htmlFor="c-close" id="o-close">10%</output></div><input type="range" id="c-close" min="1" max="50" step="1" defaultValue="10" /></div>
              <div className="ctrl"><div className="ctrl-top"><label htmlFor="c-ticket">Ticket promedio</label><output htmlFor="c-ticket" id="o-ticket">S/ 800</output></div><input type="range" id="c-ticket" min="50" max="10000" step="50" defaultValue="800" /></div>
              <fieldset className="ctrl">
                <legend>¿Cuántos leads se pierden por fugas?</legend>
                <div className="scen">{" "}
                  <label><input type="radio" name="scen" value="15" />Conservador{" "}<b>15%</b></label>{" "}
                  <label><input type="radio" name="scen" value="30" defaultChecked />Típico{" "}<b>30%</b></label>{" "}
                  <label><input type="radio" name="scen" value="45" />Alto{" "}<b>45%</b></label>{" "}
                </div>
              </fieldset>
            </form>
            <div className="leak-card" aria-live="polite" aria-atomic="true">{" "}
              <span className="lc-k">Ventas que se escapan al mes</span>{" "}
              <span className="lc-big" id="calc-big">S/ 7,200</span>{" "}
              <span className="lc-unit">de leads que ya pagaste con tu pauta.</span>{" "}
              <div className="lc-math" aria-hidden="true">{" "}
                <span className="lm-k">Así se calcula</span>{" "}
                <p className="lm-row"><span><b data-m="leads">300</b><small>leads al mes</small></span><i>×</i><span className="is-loss"><b data-m="loss">30%</b><small>se fugan</small></span><i>×</i><span><b data-m="close">10%</b><small>cierre</small></span><i>×</i><span><b data-m="ticket">S/ 800</b><small>ticket</small></span></p>
              </div>
              <dl className="lc-stats">
                <div><dt>Leads perdidos</dt><dd id="k-lost">90</dd></div>
                <div><dt>Ventas que no ocurren</dt><dd id="k-sales">9</dd></div>
                <div><dt>Al año</dt><dd id="k-year">S/ 86,400</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>
      </section>
      {/* ================= 4 · CRONOGRAMA ================= */}
      <section className="section" id="metodo" aria-labelledby="metodo-title">
      <div className="wrap">
        <div className="section-head mdf-reveal">
          <p className="kicker">Cómo lo hacemos</p>
          <h2 className="h2" id="metodo-title">En 7 días hábiles,{" "}<span className="lite">de la sospecha a tres decisiones.</span></h2>
          <p className="lead">Los datos muestran la fuga. El contexto revela la causa. Cruzamos datos, comportamiento y tecnología, y cada hallazgo sale clasificado como confirmado, probable o pendiente.</p>
        </div>
        <div className="cal mdf-reveal">
          <div className="cal-bar">{" "}
            <span className="cal-ttl"><b>Cronograma del Mapa</b><span>Mapa de Fugas · tu negocio</span></span>{" "}
            <span className="cal-views" aria-hidden="true"><span>Día</span><span className="on">Semana</span><span>Mes</span></span>{" "}
            <span className="cal-pill">7 días hábiles</span>{" "}
          </div>
          <div className="cal-body">
            <div className="cal-head" aria-hidden="true"><span><small>Antes</small><em>—</em></span><span><small>Lun</small><em>Día 1</em></span><span><small>Mar</small><em>Día 2</em></span><span><small>Mié</small><em>Día 3</em></span><span><small>Jue</small><em>Día 4</em></span><span><small>Vie</small><em>Día 5</em></span><span><small>Lun</small><em>Día 6</em></span><span className="is-end"><small>Mar</small><em>Día 7</em></span></div>
            <div className="cal-grid" aria-hidden="true"><i /><i className="kick"><span>Kickoff</span></i><i /><i /><i /><i /><i className="wkd" /><i className="due"><span>Entrega</span></i></div>
            <ol className="cal-rows">
              <li className="ev ev0" style={{ gridColumn: "1 / 2", gridRow: "1" }}><span className="ev-top"><span className="ev-when">Antes</span><span className="ev-dur">1 lote</span></span><b>Calificar</b><span className="ev-txt">Alcance e información en un solo lote.</span><span className="ev-who" aria-label="Responsables"><i className="av av-t" title="Tú">Tú</i><i className="av av-m" title="Manya">M</i></span></li>
              <li className="ev ev1" style={{ gridColumn: "2 / 4", gridRow: "2" }}><span className="ev-tags"><span>Mapa visual</span></span><span className="ev-top"><span className="ev-when">Días 1–2</span><span className="ev-dur">2 días</span></span><b>Mapear</b><span className="ev-txt">Las cinco etapas y las dos prioritarias.</span><span className="ev-who" aria-label="Responsables"><i className="av av-m" title="Manya">M</i></span></li>
              <li className="ev ev2" style={{ gridColumn: "4 / 6", gridRow: "3" }}><span className="ev-top"><span className="ev-when">Días 3–4</span><span className="ev-dur">2 días</span></span><b>Profundizar</b><span className="ev-txt">A fondo en las dos etapas con más oportunidad.</span><span className="ev-who" aria-label="Responsables"><i className="av av-m" title="Manya">M</i></span></li>
              <li className="ev ev3" style={{ gridColumn: "6 / 7", gridRow: "4" }}><span className="ev-tags"><span>Matriz ejecutiva</span></span><span className="ev-top"><span className="ev-when">Día 5</span><span className="ev-dur">1 día</span></span><b>Priorizar</b><span className="ev-txt">Matriz y tres correcciones.</span><span className="ev-who" aria-label="Responsables"><i className="av av-m" title="Manya">M</i></span></li>
              <li className="ev ev4" style={{ gridColumn: "7 / 9", gridRow: "5" }}><span className="ev-tags"><span>Tres correcciones</span></span><span className="ev-top"><span className="ev-when">Días 6–7</span><span className="ev-dur">2 días</span></span><b>Entregar</b><span className="ev-txt">Presentación ejecutiva y propuesta de corrección.</span><span className="ev-who" aria-label="Responsables"><i className="av av-t" title="Tú">Tú</i><i className="av av-m" title="Manya">M</i></span></li>
            </ol>
          </div>
          <div className="cal-foot">{" "}
            <span className="cal-legend"><i className="lg-m" />Manya trabaja</span>{" "}
                    <span className="cal-legend"><i className="lg-d" />Entrega</span>{" "}
            <span className="cal-note">Los 7 días empiezan tras el pago, con toda la información en un solo lote.</span>{" "}
          </div>
        </div>
      </div>
      </section>
      {/* ================= 5 · PRUEBA SOCIAL ================= */}
      <section className="section navy" id="prueba" aria-labelledby="prueba-title">
      <div className="wrap">
        <div className="section-head mdf-reveal">
          <p className="kicker">Casos</p>
          <h2 className="h2" id="prueba-title">Lo hemos hecho antes.{" "}<span className="lite">Y los números lo dicen.</span></h2>
          <p className="lead">Resultados de proyectos Manya. Los casos son evidencia, no una promesa para tu negocio.</p>
        </div>
        <div className="proof mdf-reveal">
          <div className="case-grid" role="region" aria-label="Casos de clientes" tabIndex="0">
            <article className="case">
              <header className="case-top">{" "}
                <img className="case-logo-img" src="/mapa-de-fugas/logo-storange.png" alt="Storange" width="1000" height="148" />{" "}
                <span className="case-tag">Venta asistida · 2025–2026</span>{" "}
              </header>
              <p className="case-fig"><b className="pcase-n">5.4x</b><span>más oportunidades desde Meta Ads</span></p>
              <div className="case-viz" role="img" aria-label="Conversaciones por WhatsApp: 1,471 desde Meta Ads frente a 270 desde Google Ads">{" "}
                <span className="cv-k">Conversaciones por WhatsApp</span>{" "}
                <div className="cv-row"><span>Meta Ads</span><i style={{ "--w": "100%" }} /><b>1,471</b></div>
                <div className="cv-row is-low"><span>Google Ads</span><i style={{ "--w": "18.4%" }} /><b>270</b></div>
              </div>
              <ul className="case-more">
                <li><b>+34%</b>{" "}crecimiento mensual promedio</li>
                <li><b>+62%</b>{" "}clientes nuevos desde el 2.º mes</li>
              </ul>
              <figure className="case-quote">{" "}
                <span className="cq-mark" aria-hidden="true">“</span>{" "}
                <blockquote>Creíamos que el problema era la pauta. El diagnóstico nos mostró que los leads se enfriaban esperando respuesta. Lo corregimos primero y las conversaciones se multiplicaron.</blockquote>
                <figcaption>{" "}
                  {/* Reemplazar por <img class="case-photo" src="foto-cliente.jpg" alt="Nombre del cliente"> */}{" "}
                  <span className="case-photo" role="img" aria-label="Foto del cliente pendiente">GC</span>{" "}
                  <span className="cq-who"><b>G. C.</b><small>Gerencia comercial · Storange</small></span>{" "}
                  {/* PENDIENTE: testimonio de ejemplo · reemplazar con texto real del cliente antes de publicar */}{" "}
                </figcaption>
              </figure>
            </article>
            <article className="case">
              <header className="case-top">{" "}
                <img className="case-logo-img case-logo-navy" src="/mapa-de-fugas/logo-rovcal.webp" alt="ROVCAL" width="337" height="116" />{" "}
                <span className="case-tag">Venta conversacional · Proyecto Toquepala</span>{" "}
              </header>
              <p className="case-fig"><b className="pcase-n">−61.8%</b><span>costo por lead</span></p>
              <div className="case-viz" role="img" aria-label="Costo por lead: S/ 10.20 antes y S/ 3.90 después">{" "}
                <span className="cv-k">Costo por lead</span>{" "}
                <div className="cv-row is-before"><span>Antes</span><i style={{ "--w": "100%" }} /><b>S/ 10.20</b></div>
                <div className="cv-row"><span>Después</span><i style={{ "--w": "38.2%" }} /><b>S/ 3.90</b></div>
              </div>
              <ul className="case-more">
                <li><b>13</b>{" "}propiedades vendidas</li>
              </ul>
              <figure className="case-quote">{" "}
                <span className="cq-mark" aria-hidden="true">“</span>{" "}
                <blockquote>Bajamos el costo por lead a menos de la mitad, pero lo que más valoramos fue saber qué arreglar primero. Nada de reportes eternos: tres decisiones claras.</blockquote>
                <figcaption>{" "}
                  {/* Reemplazar por <img class="case-photo" src="foto-cliente.jpg" alt="Nombre del cliente"> */}{" "}
                  <span className="case-photo" role="img" aria-label="Foto del cliente pendiente">GP</span>{" "}
                  <span className="cq-who"><b>G. P.</b><small>Gerencia de proyecto · ROVCAL</small></span>{" "}
                  {/* PENDIENTE: testimonio de ejemplo · reemplazar con texto real del cliente antes de publicar */}{" "}
                </figcaption>
              </figure>
            </article>
          </div>
          <div className="case-dots" aria-hidden="true"><i className="is-on" /><i /></div>
        </div>
      </div>
      </section>
      {/* ================= 6 · INVERSIÓN ================= */}
      <section className="section" id="inversion" aria-labelledby="inv-title">
      <div className="wrap">
        <div className="section-head mdf-reveal">
          <p className="kicker">Inversión</p>
          <h2 className="h2" id="inv-title">USD 600.{" "}<span className="lite">Y si corriges con nosotros, vuelven a ti.</span></h2>
          <p className="lead">Precio cerrado, alcance cerrado. Sabes dónde pierdes ventas antes de comprometerte con un servicio mensual.</p>
        </div>
        <div className="plans">
          <article className="plan is-featured" aria-labelledby="plan-1">
            <header className="plan-head">
              <div className="plan-top"><span className="plan-ico" aria-hidden="true"><svg><use href="#i-map" /></svg></span><h3 id="plan-1">Mapa de Fugas</h3></div>
              <p className="plan-desc">Dónde pierdes ventas y qué corregir primero.</p>
            </header>
            <div className="plan-sec plan-sec-price">
              <p className="plan-price"><span className="plan-cur">USD</span><b>600</b><span className="plan-per"><span>+ IGV</span><span>pago único</span></span></p>
            </div>
            <div className="plan-sec plan-sec-feats">
              <p className="plan-label">Qué incluye</p>
              <ul className="plan-feats">
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Entrega en 7 días hábiles</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Cinco etapas evaluadas, dos a fondo</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Mapa visual del recorrido</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Matriz ejecutiva de hallazgos</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Tres correcciones priorizadas</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Kickoff y presentación ejecutiva</li>
              </ul>
            </div>
            <div className="plan-end">
              <p className="plan-credit"><svg aria-hidden="true"><use href="#i-check" /></svg><span>Se acredita al 100% si corriges con nosotros<span className="credit-cond">Es crédito, no devolución de efectivo, si contratas la corrección dentro de los 15 días posteriores a la entrega.</span></span></p>{" "}
              <a className="btn wide" href="#agendar" data-cta="inversion">Agendar evaluación gratis{" "}<svg aria-hidden="true"><use href="#i-arrow" /></svg></a>{" "}
            </div>
          </article>
          <article className="plan" aria-labelledby="plan-2">
            <header className="plan-head">
              <div className="plan-top"><span className="plan-ico is-rose" aria-hidden="true"><svg><use href="#i-wrench" /></svg></span><h3 id="plan-2">Corrección prioritaria</h3></div>
              <p className="plan-desc">Intervenimos la fuga priorizada, implementamos y validamos.</p>
            </header>
            <div className="plan-sec plan-sec-price">
              <p className="plan-price is-quote"><b>A medida</b><span className="plan-per">según el Mapa</span></p>
            </div>
            <div className="plan-sec plan-sec-feats">
              <p className="plan-label">Qué incluye</p>
              <ul className="plan-feats">
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Parte de las tres correcciones priorizadas del Mapa</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Corrección de la fuga priorizada</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Implementación y validación</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Validamos con lo que entra al negocio, no solo con lo que reporta la plataforma</li>
              </ul>
            </div>
            <div className="plan-end">
              <p className="plan-credit is-soft"><span className="plan-minus">− USD 600</span>si la contratas dentro de 15 días</p>{" "}
              <a className="plan-link" href="#agendar">Empieza por el Mapa{" "}<span aria-hidden="true">→</span></a>{" "}
            </div>
          </article>
          <article className="plan" aria-labelledby="plan-3">
            <header className="plan-head">
              <div className="plan-top"><span className="plan-ico" aria-hidden="true"><svg><use href="#i-cycle" /></svg></span><h3 id="plan-3">Gestión continua</h3></div>
              <p className="plan-desc">Marketing y ventas optimizados, mes a mes.</p>
            </header>
            <div className="plan-sec plan-sec-price">
              <p className="plan-price is-quote"><b>Mensual</b><span className="plan-per">plan a medida</span></p>
            </div>
            <div className="plan-sec plan-sec-feats">
              <p className="plan-label">Qué incluye</p>
              <ul className="plan-feats">
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Optimización mes a mes</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Marketing y ventas en un mismo recorrido</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Seguimiento con tus datos reales</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Medimos leads, no likes: datos y contexto, no solo reportes</li>
                <li><svg aria-hidden="true"><use href="#i-check" /></svg>Partner certificado de Kommo</li>
              </ul>
            </div>
            <div className="plan-end">
              <p className="plan-credit is-ghost">Después de corregir</p>{" "}
              <a className="plan-link" href="#agendar">Empieza por el Mapa{" "}<span aria-hidden="true">→</span></a>{" "}
            </div>
          </article>
        </div>{" "}
        {/* Letra chica (oculta a pedido; la condición ya se lee en el plan): Se aplica como crédito, no como devolución de efectivo, si contratas la corrección dentro de los 15 días posteriores a la entrega. Aplican condiciones comerciales. */}{" "}
      </div>
      </section>
      {/* ================= 7 · FAQ + CUALIFICACIÓN ================= */}
      <section className="section navy" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <div className="section-head mdf-reveal">
          <p className="kicker">Preguntas frecuentes</p>
          <h2 className="h2" id="faq-title">Antes de{" "}<span className="lite">agendar.</span></h2>
        </div>
      <div className="faq">
        <div className="faq-list">
          <details>
            <summary>¿La evaluación es lo mismo que el Mapa de Fugas?</summary>
            <p>No. La evaluación es una reunión gratuita de 20 minutos para entender tu negocio y ver si el alcance encaja. El Mapa es el diagnóstico de USD 600 + IGV.</p>
          </details>
          <details>
            <summary>¿Por qué pagar si otras agencias lo dan gratis?</summary>
            <p>Un diagnóstico gratuito suele ser una presentación de ventas. Este tiene alcance definido, horas asignadas y cada hallazgo clasificado por evidencia. Y si corriges con nosotros, se acredita al 100%.</p>
          </details>
          <details>
            <summary>¿Necesito CRM o cambiar de agencia?</summary>
            <p>No. Revisamos exportaciones de WhatsApp Business si no tienes CRM, y el diagnóstico es independiente de tu proveedor actual.</p>
          </details>
          <details>
            <summary>¿Qué necesito entregar y cuándo empiezan los 7 días?</summary>
            <p>Datos del negocio, acceso de lectura a la pauta, el punto de conversión, CRM o hasta 20 conversaciones, y tus ventas. Los 7 días hábiles empiezan tras el pago y con todo en un solo lote.</p>
          </details>
          <details>
            <summary>¿Garantizan resultados?</summary>
            <p>No prometemos resultados sin evidencia. Te decimos qué tan firme es cada hallazgo: confirmado, probable o pendiente de validación.</p>
          </details>
        </div>
      </div>
      </div>
      </section>
      {/* ================= 8 · FORMULARIO ================= */}
      <section className="section" id="agendar-sec" aria-labelledby="agendar-form-title">
      <div className="wrap capture" id="agendar">
        <div>
          <p className="kicker">Evaluación gratuita</p>
          <h2 className="h2" id="agendar-form-title">¿Es para ti?{" "}<span className="lite">Responde y agenda con{" "}<mark className="hl">Maddy.</mark></span></h2>
          <p className="lead">Si encaja, eliges tu horario en la misma pantalla. Si no, te lo decimos ahora y no pierdes una reunión.</p>
          <div className="fit-live" aria-live="polite">
            <p className="fit-verdict" data-state="wait">Aquí verás si el Mapa de Fugas encaja contigo.</p>
            <ul className="fit-checks">
              <li data-fit="pauta" data-state="wait"><span className="fit-ic" aria-hidden="true"><span className="fit-n">1</span><svg className="ic-ok"><use href="#i-check" /></svg><svg className="ic-no"><use href="#i-x" /></svg></span><span><b>Inversión en pauta</b><em>Desde USD 500 al mes.</em></span></li>
              <li data-fit="equipo" data-state="wait"><span className="fit-ic" aria-hidden="true"><span className="fit-n">2</span><svg className="ic-ok"><use href="#i-check" /></svg><svg className="ic-no"><use href="#i-x" /></svg></span><span><b>Quién atiende</b><em>Alguien atiende las oportunidades que llegan.</em></span></li>
              <li data-fit="urgencia" data-state="wait"><span className="fit-ic" aria-hidden="true"><span className="fit-n">3</span><svg className="ic-ok"><use href="#i-check" /></svg><svg className="ic-no"><use href="#i-x" /></svg></span><span><b>Momento</b><em>Quieres evidencia antes de decidir.</em></span></li>
            </ul>
          </div>
        </div>
        <div className="formbox">
          <div className="form-head">{" "}
            {/* Foto del equipo (opcional): descomentar y completar.
            <div class="form-person">
              <img src="foto-maddy.jpg" alt="Maddy" width="48" height="48">
              <span><b>Maddy</b><small>Consultora comercial · Manya</small></span>
            </div> */}{" "}
            <b>Agenda tu evaluación gratuita</b>{" "}
            <ul className="price-pills" aria-label="Precio">
              <li className="pill pill-free"><svg aria-hidden="true"><use href="#i-check" /></svg>Evaluación gratis · 20 min</li>
              <li className="pill pill-price">Mapa de Fugas · USD 600 + IGV</li>
            </ul>{" "}
            <span>Respondes unas preguntas y eliges tu horario al final.</span>{" "}
          </div>
          <div className="stepper">{" "}
            <span className="step-label" id="stepLabel">Paso 1 de 4 · Tus datos</span>{" "}
            <div className="bar" aria-hidden="true"><i id="barFill" /></div>
          </div>
          <form id="leadForm" noValidate>
            <div id="step1" className="fieldset">
              <div className="field">{" "}
                <label htmlFor="nombre">Tu nombre</label>{" "}
                <input id="nombre" name="nombre" type="text" autoComplete="name" autoCapitalize="words" spellCheck="false" enterKeyHint="next" maxLength="60" required placeholder="Nombre y apellido" data-error="e-nombre" />{" "}
                <span className="err" id="e-nombre">Escribe tu nombre con letras (al menos 2).</span>{" "}
              </div>
              <div className="field">{" "}
                <label htmlFor="empresa">Nombre de la empresa</label>{" "}
                <input id="empresa" name="empresa" type="text" autoComplete="organization" autoCapitalize="words" enterKeyHint="next" maxLength="80" required placeholder="Nombre comercial" data-error="e-empresa" />{" "}
                <span className="err" id="e-empresa">Escribe el nombre de tu empresa (al menos 2 caracteres).</span>{" "}
              </div>
              <div className="field">{" "}
                <label htmlFor="correo">Correo</label>{" "}
                <input id="correo" name="correo" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck="false" enterKeyHint="next" maxLength="120" required placeholder="nombre@empresa.com" data-error="e-correo" data-hint="h-correo" />{" "}
                <span className="hint" id="h-correo">Aquí te llega la invitación con el link de Meet.</span>{" "}
                <span className="err" id="e-correo">Escribe un correo válido (ej.: nombre@empresa.com).</span>{" "}
              </div>
              {/* Campo trampa para bots: las personas no lo ven ni lo completan */}
              <div className="hp" aria-hidden="true"><label htmlFor="sitio">No completar</label><input id="sitio" name="sitio" type="text" tabIndex={-1} autoComplete="off" /></div>
              <div className="row2">
                <div className="field">{" "}
                  <label htmlFor="telefono">WhatsApp{" "}<span className="visually-hidden">(Perú, +51)</span></label>{" "}
                  <div className="tel-wrap"><span className="tel-cc" aria-hidden="true">+51</span><input id="telefono" name="telefono" type="tel" inputMode="numeric" autoComplete="tel-national" enterKeyHint="next" maxLength="11" required placeholder="9XX XXX XXX" data-error="e-tel" data-hint="h-tel" /></div>{" "}
                  <span className="hint" id="h-tel">Tu número de 9 dígitos, sin el +51.</span>{" "}
                  <span className="err" id="e-tel">Escribe tu celular: 9 dígitos que empiezan con 9 (9XX XXX XXX).</span>{" "}
                </div>
                <div className="field">{" "}
                  <label htmlFor="cargo">Tu rol</label>{" "}
                  <select id="cargo" name="cargo" required data-error="e-cargo">
                    <option value="">Selecciona</option>
                    <option>Dueño/a o socio/a</option>
                    <option>Gerencia general o comercial</option>
                    <option>Líder de marketing</option>
                    <option>Líder de ecommerce</option>
                    <option>Otro rol</option>
                  </select>{" "}
                  <span className="err" id="e-cargo">Elige tu rol en la empresa.</span>{" "}
                </div>
              </div>
              <div className="actions-row">{" "}
                <button className="btn wide" type="button" data-next="2">Continuar{" "}<svg aria-hidden="true"><use href="#i-arrow" /></svg></button>{" "}
              </div>
              <p className="privacy">Al continuar aceptas que Manya use estos datos para contactarte sobre esta evaluación. No los compartimos con terceros.</p>
            </div>
            <div id="step2" className="fieldset hidden">
              <div className="row2">
                <div className="field">{" "}
                  <label htmlFor="rubro">Rubro</label>{" "}
                  <select id="rubro" name="rubro" required data-error="e-rubro">
                    <option value="">Selecciona</option>
                    <option value="salud">Salud o clínica</option>
                    <option value="inmobiliaria">Inmobiliaria o construcción</option>
                    <option value="educacion">Educación</option>
                    <option value="b2b">Servicios a empresas (B2B)</option>
                    <option value="retail">Ecommerce o retail</option>
                    <option value="otro">Otro rubro</option>
                  </select>{" "}
                  <span className="err" id="e-rubro">Elige el rubro de tu negocio.</span>{" "}
                </div>
                <div className="field">{" "}
                  <label htmlFor="ticket">Valor de una venta</label>{" "}
                  <select id="ticket" name="ticket" required data-error="e-ticket" data-hint="h-ticket">
                    <option value="">Selecciona un rango</option>
                    <option value="lt100">Menos de S/ 100</option>
                    <option value="100">S/ 100 – 499</option>
                    <option value="500">S/ 500 – 1,999</option>
                    <option value="2000">S/ 2,000 – 9,999</option>
                    <option value="10000">S/ 10,000 o más</option>
                  </select>{" "}
                  <span className="hint" id="h-ticket">Ticket promedio por venta.</span>{" "}
                  <span className="err" id="e-ticket">Elige un rango aproximado.</span>{" "}
                </div>
              </div>
              <div className="field">{" "}
                <label htmlFor="modelo">¿Cómo vendes principalmente?</label>{" "}
                <select id="modelo" name="modelo" required data-error="e-modelo">
                  <option value="">Selecciona</option>
                  <option value="b2b">Venta asistida: un asesor cotiza o se reúne</option>
                  <option value="whatsapp">Por WhatsApp: consultas, citas o pedidos</option>
                  <option value="ecommerce">Ecommerce: compran y pagan en tu web</option>
                </select>{" "}
                <span className="err" id="e-modelo">Elige cómo vendes.</span>{" "}
              </div>
              <div className="field">{" "}
                <span className="flabel" id="canales-label">¿Dónde podemos conocer tu negocio?</span>{" "}
                <span className="hint">Necesitamos al menos tu web o tu Instagram.</span>{" "}
                <div className="chips" role="group" aria-labelledby="canales-label">{" "}
                  <button type="button" className="chip-btn" data-channel="web" aria-pressed="false"><span className="dot"><svg aria-hidden="true"><use href="#i-check" /></svg></span>Página web</button>{" "}
                  <button type="button" className="chip-btn" data-channel="instagram" aria-pressed="false"><span className="dot"><svg aria-hidden="true"><use href="#i-check" /></svg></span>Instagram</button>{" "}
                  <button type="button" className="chip-btn" data-channel="facebook" aria-pressed="false"><span className="dot"><svg aria-hidden="true"><use href="#i-check" /></svg></span>Facebook</button>{" "}
                  <button type="button" className="chip-btn" data-channel="tiktok" aria-pressed="false"><span className="dot"><svg aria-hidden="true"><use href="#i-check" /></svg></span>TikTok</button>{" "}
                  <button type="button" className="chip-btn" data-channel="linkedin" aria-pressed="false"><span className="dot"><svg aria-hidden="true"><use href="#i-check" /></svg></span>LinkedIn</button>{" "}
                </div>
              </div>
              <div className="chip-fields">
                <div className="field hidden" data-field="web"><label htmlFor="web">Tu página web</label><input id="web" name="web" type="text" inputMode="url" autoComplete="url" autoCapitalize="off" spellCheck="false" enterKeyHint="next" maxLength="200" placeholder="tunegocio.com" /></div>
                <div className="field hidden" data-field="instagram"><label htmlFor="instagram">Tu Instagram</label><input id="instagram" name="instagram" type="text" autoCapitalize="off" spellCheck="false" enterKeyHint="next" maxLength="31" placeholder="@tunegocio" /></div>
                <div className="field hidden" data-field="facebook"><label htmlFor="facebook">Tu Facebook</label><input id="facebook" name="facebook" type="text" inputMode="url" autoCapitalize="off" spellCheck="false" enterKeyHint="next" maxLength="200" placeholder="facebook.com/tunegocio" /></div>
                <div className="field hidden" data-field="tiktok"><label htmlFor="tiktok">Tu TikTok</label><input id="tiktok" name="tiktok" type="text" autoCapitalize="off" spellCheck="false" enterKeyHint="next" maxLength="31" placeholder="@tunegocio" /></div>
                <div className="field hidden" data-field="linkedin"><label htmlFor="linkedin">Tu LinkedIn</label><input id="linkedin" name="linkedin" type="text" inputMode="url" autoCapitalize="off" spellCheck="false" enterKeyHint="next" maxLength="200" placeholder="linkedin.com/company/tunegocio" /></div>
              </div>
              <p className="inline-error hidden" id="channelError" role="alert">Marca y completa tu web (ej.: tunegocio.com) o tu Instagram (ej.: @tunegocio).</p>
              <div className="actions-row">{" "}
                <button type="button" className="btn quiet" data-back="1">Atrás</button>{" "}
                <button type="button" className="btn" data-next="3">Continuar{" "}<svg aria-hidden="true"><use href="#i-arrow" /></svg></button>{" "}
              </div>
            </div>
            <div id="step3" className="fieldset hidden">
              <div className="field">{" "}
                <label htmlFor="pauta">¿Cuánto inviertes en publicidad digital al mes?</label>{" "}
                <select id="pauta" name="pauta" required data-error="e-pauta">
                  <option value="">Selecciona un rango</option>
                  <option value="nada">Aún no invertimos en publicidad</option>
                  <option value="bajo">Menos de USD 500</option>
                  <option value="500">USD 500 – 999</option>
                  <option value="1000">USD 1,000 – 1,999</option>
                  <option value="2000">USD 2,000 – 4,999</option>
                  <option value="5000">USD 5,000 o más</option>
                </select>{" "}
                <span className="err" id="e-pauta">Elige un rango de inversión mensual.</span>{" "}
              </div>
              <div className="field">{" "}
                <label htmlFor="equipo" id="equipoLabel">¿Quién atiende hoy las oportunidades que llegan?</label>{" "}
                <select id="equipo" name="equipo" required data-error="e-equipo">
                  <option value="">Selecciona</option>
                  <option value="equipo">Un equipo comercial</option>
                  <option value="persona">Una persona dedicada</option>
                  <option value="mixto">Lo atiendo yo, entre otras cosas</option>
                  <option value="nadie">Hoy nadie de forma consistente</option>
                </select>{" "}
                <span className="err" id="e-equipo">Elige quién atiende las oportunidades.</span>{" "}
              </div>
              <div className="field">{" "}
                <label htmlFor="medicion">¿Dónde registras hoy tus leads y ventas?</label>{" "}
                <select id="medicion" name="medicion" required data-error="e-medicion">
                  <option value="">Selecciona</option>
                  <option value="kommo">En Kommo</option>
                  <option value="crm">En otro CRM</option>
                  <option value="excel">En Excel o en el mismo WhatsApp</option>
                  <option value="nada">No lo registramos</option>
                </select>{" "}
                <span className="err" id="e-medicion">Elige dónde registras tus leads hoy.</span>{" "}
              </div>
              <div className="field">{" "}
                <label htmlFor="urgencia">¿Cuándo te gustaría tener el diagnóstico listo?</label>{" "}
                <select id="urgencia" name="urgencia" required data-error="e-urgencia">
                  <option value="">Selecciona</option>
                  <option value="ya">Este mes, es prioridad</option>
                  <option value="pronto">El próximo mes</option>
                  <option value="validar">Depende de validarlo internamente</option>
                  <option value="explorando">Solo estoy explorando</option>
                </select>{" "}
                <span className="err" id="e-urgencia">Elige un plazo.</span>{" "}
              </div>
              <div className="actions-row">{" "}
                <button type="button" className="btn quiet" data-back="2">Atrás</button>{" "}
                <button type="button" className="btn" id="submitBtn">Ver horarios{" "}<svg aria-hidden="true"><use href="#i-arrow" /></svg></button>{" "}
              </div>
            </div>
          </form>
          <div id="step4" className="hidden">
            <div className="slots" id="slotPicker">
              <div className="slots-head" id="slotsHead">
                <h3 className="h3" id="slotsTitle" tabIndex={-1}>Elige tu horario</h3>
                <p className="slots-sub">Videollamada por Google Meet{" "}·{" "}<span id="slotsDur">20 min</span>{" "}·{" "}hora de Lima</p>
              </div>
              <div className="slots-body" id="slotsBody" aria-live="polite" />
            </div>
            <p className="agenda-alt" id="agendaAlt" />
          </div>
          <div id="stepNoFit" className="nofit hidden">
            <h3 className="h3">Por ahora el Mapa de Fugas{" "}<em>no es tu siguiente paso.</em></h3>
            <p id="noFitReason">El diagnóstico analiza un recorrido comercial que ya está en marcha. Sin eso, no habría evidencia que revisar.</p>
            <div className="reqs">{" "}
              <span className="reqs-k">Para que tenga sentido necesitas</span>{" "}
              <ul>
                <li>Invertir desde{" "}<strong>USD 500 al mes</strong>{" "}en publicidad digital.</li>
                <li><strong>Al menos una persona</strong>{" "}atendiendo las oportunidades que llegan.</li>
              </ul>
            </div>
            <p>Cuando lo tengas andando, vuelve a esta página y lo revisamos.</p>
            <div className="actions-row"><button type="button" className="btn quiet wide" data-back="3">Cambiar mis respuestas</button></div>
            <p className="alt" id="noFitAlt" />
          </div>
          <div className="status hidden" id="status" aria-live="polite" />
        </div>
      </div>
      </section>
    </div>
  )
}
