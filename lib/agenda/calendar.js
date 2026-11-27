// Month-grid helpers for the public date picker (pure, browser-safe). Dates are 'YYYY-MM-DD' strings;
// all arithmetic is done in UTC so the host's time zone never shifts a day.

const pad = (n) => String(n).padStart(2, '0')

export const ymd = (y, m, d) => y + '-' + pad(m) + '-' + pad(d)

/** { y, m } (m is 1-12) of a 'YYYY-MM-DD' string. */
export function monthOf(date) {
  const [y, m] = String(date).split('-').map(Number)
  return { y, m }
}

/** Month shifted by `n` (may cross years). */
export function addMonths({ y, m }, n) {
  const t = y * 12 + (m - 1) + n
  return { y: Math.floor(t / 12), m: (t % 12) + 1 }
}

/** -1, 0 or 1 comparing two { y, m }. */
export const compareMonths = (a, b) => Math.sign((a.y * 12 + a.m) - (b.y * 12 + b.m))

/**
 * Weeks of a month, Monday first. Each week has 7 cells: a 'YYYY-MM-DD' string for days of the month,
 * null for padding days before the 1st or after the last day.
 */
export function monthGrid({ y, m }) {
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // Monday = 0
  const cells = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) cells.push(ymd(y, m, d))
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Today's 'YYYY-MM-DD' in a time zone. */
export function todayIn(tz, now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(now)).map((x) => [x.type, x.value]))
  return p.year + '-' + p.month + '-' + p.day
}
