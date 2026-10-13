import { applyMenuChange } from '../storeOnboarding'
import { describe, it, expect } from 'vitest'
import { isOnboardingEligible, draftKey, createDraft, validSchedule, validateStep, businessPayload, zonePayload, schedulePayload, getRestaurantUrl, readDraft } from '../storeOnboarding'

describe('local store onboarding contract', () => {
  it('requires development, a local host and a resolved project admin', () => {
    expect(isOnboardingEligible({ development: true, hostname: 'localhost', auth: true, level: 0, root: '/a', userId: 1 })).toBe(true)
    for (const change of [{ development: false }, { hostname: 'preview.workers.dev' }, { auth: false }, { level: 2 }, { root: '' }, { userId: null }]) {
      expect(isOnboardingEligible({ development: true, hostname: 'localhost', auth: true, level: 0, root: '/a', userId: 1, ...change })).toBe(false)
    }
  })
  it('separates progress by API project and user, and rejects corrupt progress', () => {
    expect(draftKey('https://api.example/v400/en/project', 1)).toBe(draftKey('https://api.example/v400/es/project', 1))
    expect(draftKey('/a', 1)).not.toBe(draftKey('/b', 1))
    expect(draftKey('/a', 1)).not.toBe(draftKey('/a', 2))
    expect(readDraft({ getItem: () => '{broken' }, 'key')).toBe(null)
    expect(readDraft({ getItem: () => JSON.stringify({ version: 1, step: 99 }) }, 'key')).toBe(null)
  })
  it('accepts free delivery and a zero minimum but rejects blank/negative costs', () => {
    const d = createDraft('owner@example.com'); d.form.orderTypes = [1]; d.form.zone = { type: 4, name: 'Main', minimum: '0', price: '0', data: null }
    expect(validateStep(d.form, 3)).toEqual([])
    d.form.zone.price = ''
    expect(validateStep(d.form, 3)).toContain('zonePrice')
    d.form.zone.price = '-1'
    expect(validateStep(d.form, 3)).toContain('zonePrice')
    d.form.orderTypes = [2]
    expect(validateStep(d.form, 3)).toEqual([])
  })
  it('validates selected zone geometry and omits stale geometry for Everywhere', () => {
    const f = createDraft('').form; f.orderTypes = [1]; f.zone.type = 1
    expect(validateStep(f, 3)).toContain('zoneGeometry')
    f.location = { lat: 0, lng: 0 }; f.zone.data = { center: { lat: 0, lng: 0 }, radio: 2 }
    expect(validateStep(f, 3)).not.toContain('zoneGeometry')
    f.zone.type = 2; f.zone.data = [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }]
    expect(validateStep(f, 3)).toContain('zoneGeometry')
    f.zone.type = 4
    expect(zonePayload(f).data).toBeUndefined()
  })
  it('creates a disabled restaurant with the owner and exact form fields', () => {
    const d = createDraft('owner@example.com'); Object.assign(d.form, { name: 'Test', phone: '1234567', address: 'Road', location: { lat: 0, lng: 0 } })
    const p = businessPayload(d, 9)
    expect(p).toMatchObject({ enabled: false, owner_id: 9, name: 'Test', email: 'owner@example.com', minimum: 0, service_fee: 0 })
    expect(JSON.parse(p.location)).toEqual({ lat: 0, lng: 0 })
    expect(p).not.toHaveProperty('types')
  })
  it('serializes seven days and prevents invalid hours', () => {
    const f = createDraft('').form
    expect(schedulePayload(f.hours)).toHaveLength(7)
    f.hours[0].close = f.hours[0].open
    expect(validateStep(f, 2)).toContain('hours')
    f.hours.forEach(h => { h.enabled = false })
    expect(validateStep(f, 2)).toContain('hours')
  })
  it('maps Monday to API index 1 and merges overnight overlaps into valid daily lapses', () => {
    const f = createDraft('').form
    f.hours[0] = { enabled: true, open: '20:00', close: '02:00' }
    f.hours[1] = { enabled: true, open: '01:00', close: '22:00' }
    const schedule = schedulePayload(f.hours)
    expect(schedule[1].lapses).toEqual([{ open: { hour: 20, minute: 0 }, close: { hour: 23, minute: 59 } }])
    expect(schedule[2].lapses).toEqual([{ open: { hour: 0, minute: 0 }, close: { hour: 22, minute: 0 } }])
  })
  it('requires a real menu and selects only offline payment gateways', () => {
    const f = createDraft('').form
    expect(validateStep(f, 5)).toContain('menu')
    f.categories = [{ key: 'c', name: 'Food', products: [{ key: 'p', name: 'Pizza', price: '0' }] }]
    expect(validateStep(f, 5)).toEqual([])
    f.payments = ['stripe']
    expect(validateStep(f, 4)).toContain('payments')
  })
  it('does not replace a missing franchise site with marketplace or invent a domain', () => {
    expect(getRestaurantUrl([{ code: 'website', domain: 'market.example' }], 'restaurant')).toBe(null)
    expect(getRestaurantUrl([{ type: 'franchiseweb', temporal_domain: 'test.franchises.example' }], 'restaurant', { websiteProduct: 'web_franchises_x' })).toBe('https://test.franchises.example/store/restaurant')
    expect(getRestaurantUrl([{ type: 'franchiseweb', domain: 'live.example', ssl_process_status: 'ended' }], 'restaurant', { websiteProduct: 'web_franchises_x' })).toBe('https://live.example/store/restaurant')
    expect(getRestaurantUrl([{ type: 'franchiseweb', temporal_domain: 'javascript:alert(1)' }], 'restaurant', { websiteProduct: 'web_franchises_x' })).toBe(null)
  })
})

it('keeps bundled onboarding copy equal to the canonical translation catalog', async () => {
  const { default: copy } = await import('virtual:store-onboarding-translations')
  const { default: catalog } = await import('../../../../../../i18n/translations.json')
  for (const [key, translations] of Object.entries(copy)) expect(translations).toEqual(catalog[key])
})
it('preserves the native schedule with multiple periods and rejects overlaps before publication', () => {
  const d = createDraft('owner@example.com')
  d.form.schedule = Array.from({ length: 7 }, () => ({ enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 12, minute: 0 } }, { open: { hour: 14, minute: 0 }, close: { hour: 22, minute: 0 } }] }))
  expect(JSON.parse(businessPayload(d, 1).schedule)).toEqual(d.form.schedule)
  expect(validateStep(d.form, 2)).toEqual([])
  d.form.schedule[1].lapses[1].open.hour = 11
  expect(validateStep(d.form, 2)).toContain('hours')
})

it('uses the real site url and never returns its homepage instead of the restaurant', () => {
  expect(getRestaurantUrl([{ type: 'franchiseweb', url: 'https://ready.example' }], 'my_restaurant', { websiteProduct: 'web_franchises_x' })).toBe('https://ready.example/store/my_restaurant')
  expect(getRestaurantUrl([{ type: 'franchiseweb', url: 'https://ready.example' }], '', { websiteProduct: 'web_franchises_x' })).toBe(null)
})

it('opens the restaurant directly on the current website only when marketplace use is explicit', () => {
  const sites = [{ code: 'website', websiteType: 'marketplace', url: 'https://current.example/' }]
  expect(getRestaurantUrl(sites, 'restaurant')).toBe(null)
  expect(getRestaurantUrl(sites, 'restaurant', { websiteProduct: 'web_marketplace_26' })).toBe('https://current.example/store/restaurant')
})

it('rejects malformed native schedules without crashing validation', () => {
  expect(validSchedule([null, ...Array.from({ length: 6 }, () => ({ enabled: false, lapses: [] }))])).toBe(false)
  const schedule = Array.from({ length: 7 }, () => ({ enabled: true, lapses: [null] }))
  expect(validSchedule(schedule)).toBe(false)
  const draft = createDraft('owner@example.com'); draft.form.schedule = schedule
  expect(readDraft({ getItem: () => JSON.stringify(draft) }, 'draft')).toBeNull()
})

it('rejects corrupt inactive menu drafts before the menu can switch into them', () => {
  const draft = createDraft('owner@example.com')
  draft.form.menuDrafts = { sample: 'broken' }
  expect(readDraft({ getItem: () => JSON.stringify(draft) }, 'draft')).toBeNull()
})
it('uses one canonical marketplace and rejects multiple franchise candidates', () => {
  const sites = [{ type: 'franchiseweb' }, { type: 'franchiseweb', url: 'http://insecure.example' }, { code: 'website', websiteType: 'marketplace', url: 'https://live.example' }]
  expect(getRestaurantUrl(sites, 'restaurant', { websiteProduct: 'web_marketplace_26' })).toBe('https://live.example/store/restaurant')
  expect(getRestaurantUrl([...sites, { type: 'franchiseweb', url: 'https://franchise.example' }], 'restaurant', { websiteProduct: 'web_franchises_x' })).toBeNull()
})

it('rejects booleans or objects as numeric amounts and corrupt cost drafts', () => {
  for (const value of [false, true, [], [0], {}, null]) {
    const d = createDraft('owner@example.com'); d.form.zone.name = 'Delivery'; d.form.zone.minimum = value
    expect(validateStep(d.form, 3)).toContain('zoneMinimum')
    if (value !== null) expect(readDraft({ getItem: () => JSON.stringify(d) }, 'draft')).toBeNull()
  }
})

it('rejects a radius that becomes an infinite number of meters', () => {
  const d = createDraft('owner@example.com'); d.form.zone = { type: 1, name: 'Delivery', minimum: '0', price: '0', data: { center: { lat: 1, lng: 2 }, radio: '1e308' } }
  expect(validateStep(d.form, 3)).toContain('zoneGeometry')
})

it('resumes the previous payments step in the combined delivery step without losing values', () => {
  const draft = createDraft('owner@example.com')
  draft.step = 4
  draft.form.payments = ['card_delivery']
  draft.form.orderTypes = [2, 3]
  const saved = JSON.stringify(draft)
  const restored = readDraft({ getItem: () => saved }, 'draft')
  expect(restored.step).toBe(3)
  expect(restored.form.payments).toEqual(['card_delivery'])
  expect(restored.form.orderTypes).toEqual([2, 3])
})

it('preserves menu media across serialization and unrelated atomic edits', () => {
  const image = 'data:image/png;base64,aW1hZ2U='
  const draft = createDraft('owner@example.com')
  draft.form.menuMode = 'manual'
  draft.form.categories = [{ key: 'category', name: 'Food', image, header: image, description: 'Category', products: [{ key: 'product', name: 'Pizza', price: 0, images: image, description: 'Product' }] }]
  draft.form.categories = applyMenuChange(draft.form, { mode: 'manual', kind: 'product', categoryKey: 'category', productKey: 'product', patch: { price: 5, enabled: false, key: 'injected' } })
  const restored = readDraft({ getItem: () => JSON.stringify(draft) }, 'draft')
  expect(restored.form.categories[0]).toMatchObject({ image, header: image, description: 'Category' })
  expect(restored.form.categories[0].products[0]).toEqual({ key: 'product', name: 'Pizza', price: 5, images: image, description: 'Product' })
})
it('rejects edits to removed items or a different menu path, and rejects malformed media', () => {
  const draft = createDraft('owner@example.com'); draft.form.menuMode = 'manual'
  const change = { mode: 'manual', kind: 'category', categoryKey: 'c', patch: { name: 'Food' } }
  expect(() => applyMenuChange(draft.form, change)).toThrow('menu_changed')
  expect(() => applyMenuChange(draft.form, { ...change, isNew: true, mode: 'sample' })).toThrow('menu_changed')
  expect(() => applyMenuChange(draft.form, { ...change, isNew: true, patch: { name: 'Food', image: 'javascript:alert(1)' } })).toThrow('invalid_menu')
  draft.form.categories = [{ key: 'c', name: 'Food', image: {}, products: [] }]
  expect(readDraft({ getItem: () => JSON.stringify(draft) }, 'draft')).toBeNull()
})

it('removes untouched legacy placeholder rows while retaining real products and media', () => {
  const draft = createDraft('owner@example.com'); draft.form.menuMode = 'manual'
  const image = 'data:image/png;base64,aW1hZ2U='
  draft.form.categories = [
    { key: 'c-empty', name: '', products: [{ key: 'p-empty', name: '', price: '' }] },
    { key: 'c-real', name: '', products: [{ key: 'p-blank', name: '', price: '' }, { key: 'p-real', name: 'Test product', price: '10', images: image }] }
  ]
  const restored = readDraft({ getItem: () => JSON.stringify(draft) }, 'draft')
  expect(restored.form.categories).toEqual([{ key: 'c-real', name: '', products: [{ key: 'p-real', name: 'Test product', price: '10', images: image }] }])
})

it('does not choose the first franchise when its subscription product is unresolved', () => {
  expect(getRestaurantUrl([{ id: 1, type: 'franchiseweb', url: 'https://franchise.example' }], 'restaurant')).toBeNull()
})
