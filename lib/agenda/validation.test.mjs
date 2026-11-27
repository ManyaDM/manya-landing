// Unit tests for the extra attribution cleaning used by /api/agenda/lead and /api/agenda/book.
// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanAttribution } from './validation.js'

const firstTouch = {
  utm_source: 'meta',
  utm_medium: 'paid_social',
  utm_campaign: 'mapa',
  utm_term: '',
  utm_content: '',
  landing_url: 'https://go.manya.pe/mapa-de-fugas?utm_source=meta&fbclid=TEST',
  referrer: '',
  at: '2026-11-27T23:06:19.097Z',
}

test('keeps only known click ids', () => {
  const out = cleanAttribution({ click_ids: { fbclid: 'TEST', gclid: 'G-1', evil: 'drop-me' } })
  assert.deepEqual(out.click_ids, { fbclid: 'TEST', gclid: 'G-1' })
})

test('drops unknown top-level and first_touch keys', () => {
  const out = cleanAttribution({ click_ids: {}, click_at: '', first_touch: { ...firstTouch, evil: 'drop-me' }, extra: 'drop-me' })
  assert.deepEqual(Object.keys(out).sort(), ['click_at', 'click_ids', 'first_touch'])
  assert.equal('evil' in out.first_touch, false)
  assert.deepEqual(Object.keys(out.first_touch).sort(), [
    'at', 'landing_url', 'referrer', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term',
  ])
})

test('truncates long strings', () => {
  const out = cleanAttribution({
    click_ids: { fbclid: 'a'.repeat(400) },
    click_at: 'b'.repeat(100),
    first_touch: { ...firstTouch, utm_source: 'c'.repeat(400), landing_url: 'https://go.manya.pe/' + 'd'.repeat(600) },
  })
  assert.equal(out.click_ids.fbclid.length, 300)
  assert.equal(out.click_at, '') // 100 chars is over the 40-char limit, so it is not a valid timestamp anymore
  assert.equal(out.first_touch.utm_source.length, 200)
  assert.ok(out.first_touch.landing_url.length <= 500)
  assert.ok(out.first_touch.landing_url.startsWith('https://go.manya.pe/'))
})

test('accepts first_touch null', () => {
  assert.deepEqual(cleanAttribution({ click_ids: {}, click_at: '', first_touch: null }), {
    click_ids: {},
    click_at: '',
    first_touch: null,
  })
})

test('handles missing or invalid input', () => {
  const empty = { click_ids: {}, click_at: '', first_touch: null }
  for (const input of [undefined, null, 'nope', 42, [], { first_touch: 'nope', click_ids: 'nope' }]) {
    assert.deepEqual(cleanAttribution(input), empty)
  }
})

test('only accepts http(s) urls and real timestamps', () => {
  const out = cleanAttribution({
    click_ids: {},
    click_at: 'not-a-date',
    first_touch: {
      ...firstTouch,
      landing_url: 'javascript:alert(1)',
      referrer: 'javascript:alert(1)',
      at: 'yesterday',
    },
  })
  assert.equal(out.first_touch.landing_url, '')
  assert.equal(out.first_touch.referrer, '')
  assert.equal(out.first_touch.at, '')
})
