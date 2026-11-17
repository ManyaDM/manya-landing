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
  if (hasAny(fromUrl)) {
    store(fromUrl)
    return fromUrl
  }
  return readStored() || EMPTY_UTMS
}
