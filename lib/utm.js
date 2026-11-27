const STORAGE_KEY = 'manya_utms'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export const EMPTY_UTMS = {
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_term: '',
  utm_content: '',
}

function readFromUrl(search) {
  const params = new URLSearchParams(search)
  const gclid = params.get('gclid')
  const fbclid = params.get('fbclid')
  const ttclid = params.get('ttclid')

  let source = params.get('utm_source') || ''
  let medium = params.get('utm_medium') || ''

  if (!source) {
    if (gclid) { source = 'google'; medium = medium || 'cpc' }
    else if (fbclid) { source = 'meta'; medium = medium || 'paid_social' }
    else if (ttclid) { source = 'tiktok'; medium = medium || 'paid_social' }
  }

  return {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: params.get('utm_campaign') || '',
    utm_term: params.get('utm_term') || '',
    utm_content: params.get('utm_content') || '',
  }
}

function hasAny(utms) {
  return Object.values(utms).some(Boolean)
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { utms, savedAt } = JSON.parse(raw)
    if (!utms || Date.now() - savedAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { ...EMPTY_UTMS, ...utms }
  } catch {
    return null
  }
}

function store(utms) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ utms, savedAt: Date.now() }))
  } catch {
    // Storage unavailable (private mode, blocked cookies): URL values still apply.
  }
}

/**
 * Last-touch attribution: UTMs in the current URL win and are persisted;
 * otherwise the last stored UTMs (within TTL) are returned.
 */
export function captureUtms() {
  if (typeof window === 'undefined') return EMPTY_UTMS
  const fromUrl = readFromUrl(window.location.search)
  captureExtras(fromUrl) // click ids + first touch (side effect only; the return shape stays the same)
  if (hasAny(fromUrl)) {
    store(fromUrl)
    return fromUrl
  }
  return readStored() || EMPTY_UTMS
}

/* ---------- extra attribution: ad click ids and first touch ---------- */
// Kept apart from `manya_utms` so existing payloads (and the Make/Kommo mappings that read them) don't change.
const CLICK_KEY = 'manya_click_ids'
const FIRST_KEY = 'manya_first_touch'
const CLICK_TTL_MS = 90 * 24 * 60 * 60 * 1000 // Google click ids are importable for 90 days
const CLICK_PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid']

function readJson(key, ttl) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || (ttl && Date.now() - (data.savedAt || 0) > ttl)) { window.localStorage.removeItem(key); return null }
    return data
  } catch { return null }
}
function writeJson(key, data) {
  try { window.localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() })) } catch { /* storage blocked */ }
}

function captureExtras(fromUrl) {
  const params = new URLSearchParams(window.location.search)
  const clicks = {}
  for (const k of CLICK_PARAMS) { const v = params.get(k); if (v) clicks[k] = v.slice(0, 300) }
  // last click wins: a new ad click replaces the stored ids
  if (Object.keys(clicks).length) writeJson(CLICK_KEY, { ids: clicks, at: new Date().toISOString() })
  // first touch: written once (the first visit we ever see), never overwritten
  if (!readJson(FIRST_KEY)) {
    let referrer = ''
    try { referrer = document.referrer && new URL(document.referrer).host !== location.host ? document.referrer.slice(0, 300) : '' } catch { /* ignore */ }
    writeJson(FIRST_KEY, {
      utms: hasAny(fromUrl) ? fromUrl : EMPTY_UTMS,
      landing_url: (location.origin + location.pathname + location.search).slice(0, 500),
      referrer,
      at: new Date().toISOString(),
    })
  }
}

/** Extra attribution for lead payloads: { click_ids, click_at, first_touch }. Call after captureUtms(). */
export function readAttribution() {
  if (typeof window === 'undefined') return { click_ids: {}, click_at: '', first_touch: null }
  const c = readJson(CLICK_KEY, CLICK_TTL_MS)
  const f = readJson(FIRST_KEY)
  return {
    click_ids: c?.ids || {},
    click_at: c?.at || '',
    first_touch: f ? { ...EMPTY_UTMS, ...f.utms, landing_url: f.landing_url || '', referrer: f.referrer || '', at: f.at || '' } : null,
  }
}
