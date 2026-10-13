import React from 'react'
import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { vi, afterEach, beforeEach, it, expect } from 'vitest'
import { StoreOnboarding } from './index'
import { createDraft } from '../../utils/storeOnboarding'
const state = vi.hoisted(() => ({ props: null, publish: vi.fn(), bootstrap: vi.fn(), appearance: vi.fn(), refresh: vi.fn(), list: vi.fn(), websiteProduct: undefined, projectLoading: false, refreshProject: vi.fn(), root: 'https://test/project', commits: [] }))
vi.mock('../../contexts/ApiContext', () => ({ useApi: () => [{ root: state.root }] }))
vi.mock('../../contexts/SessionContext', () => ({ useSession: () => [{ user: { id: 1, email: 'owner@example.com' }, token: 'test' }, { logout: vi.fn() }] }))
vi.mock('../../contexts/ConfigContext', () => ({ useConfig: () => [{}, { refreshConfigs: state.refresh }] }))
vi.mock('../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback] }))
vi.mock('../../utils/storeOnboardingApi', () => ({ createOnboardingApi: () => ({ bootstrap: state.bootstrap, publish: state.publish, list: state.list, getWebsiteAppearance: state.appearance, getWebsiteSites: signal => state.list('/sites', signal) }) }))
vi.mock('../../ui/src/contexts/ProjectContext', () => ({ useProjectState: () => [{ websiteProduct: state.websiteProduct, loading: state.projectLoading }, { getProjectStatus: state.refreshProject }] }))
const View = props => { state.props = props; React.useLayoutEffect(() => { state.commits.push({ appearance: props.appearance, site: props.site }) }); return <button onClick={props.publish}>Publish</button> }
beforeEach(() => {
  localStorage.clear(); state.websiteProduct = 'web_marketplace_26'; state.projectLoading = false; state.refreshProject.mockReset(); state.root = 'https://test/project'; state.commits = []
  state.appearance.mockReset(); state.appearance.mockResolvedValue({ siteId: 1, themeId: 2, color: '#112233' })
  state.list.mockReset(); state.list.mockResolvedValue([])
  state.bootstrap.mockResolvedValue({ configs: {}, paymethods: [{ gateway: 'cash' }] })
  state.publish.mockReset()
  state.refresh.mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.useRealTimers() })
const mountValid = async () => {
  const d = createDraft('owner@example.com')
  Object.assign(d.form, { name: 'Restaurant', phone: '1234567890', address: 'Test address', location: { lat: 0, lng: 0 }, menuMode: 'manual', categories: [{ key: 'c', name: 'Food', products: [{ key: 'p', name: 'Pizza', price: '0' }] }] })
  d.form.zone.name = 'Delivery'
  d.step = 5
  localStorage.setItem('draft', JSON.stringify(d))
  const mounted = render(<StoreOnboarding storageKey='draft' UIComponent={View} onComplete={vi.fn()} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  return mounted
}
it('serializes double clicks and saves confirmed progress before showing success', async () => {
  let finish
  state.publish.mockImplementation(async (draft, owner, checkpoint) => {
    await new Promise(resolve => { finish = resolve })
    Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true })
    draft.step = 6
    checkpoint(draft)
  })
  await mountValid()
  fireEvent.click(screen.getByText('Publish'))
  fireEvent.click(screen.getByText('Publish'))
  await waitFor(() => expect(state.publish).toHaveBeenCalledTimes(1))
  finish()
  await waitFor(() => expect(state.props.draft.step).toBe(6))
  expect(JSON.parse(localStorage.getItem('draft')).journal.businessId).toBe(9)
})
it('freezes a partially published draft and resumes it on remount', async () => {
  state.publish.mockImplementation(async (draft, owner, checkpoint) => {
    Object.assign(draft.journal, { started: true, businessId: 9 })
    checkpoint(draft)
    throw new Error('offline')
  })
  await mountValid()
  fireEvent.click(screen.getByText('Publish'))
  await waitFor(() => expect(state.props.notice).toBe('publish'))
  act(() => state.props.update({ name: 'Changed' }))
  expect(state.props.draft.form.name).toBe('Restaurant')
  cleanup()
  render(<StoreOnboarding storageKey='draft' UIComponent={View} onComplete={vi.fn()} />)
  expect(state.props.draft.journal.businessId).toBe(9)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
})
it('does not undo confirmed success when refreshing project configs fails', async () => {
  state.refresh.mockRejectedValue(new Error('offline'))
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; checkpoint(draft) })
  await mountValid()
  fireEvent.click(screen.getByText('Publish'))
  await waitFor(() => expect(state.props.draft.step).toBe(6))
  expect(state.props.notice).toBe('')
})

it('refreshes a corrected Maps key while keeping the saved restaurant details', async () => {
  await mountValid()
  state.bootstrap.mockResolvedValue({ configs: { google_maps_api_key: { value: 'corrected-key' } }, paymethods: [{ gateway: 'cash' }] })
  act(() => state.props.retryMetadata())
  await waitFor(() => expect(state.props.meta.configs.google_maps_api_key?.value).toBe('corrected-key'))
  expect(state.props.draft.form.name).toBe('Restaurant')
  expect(JSON.parse(localStorage.getItem('draft')).form.name).toBe('Restaurant')
})
it('switches menu paths while preserving the edits in each local menu', async () => {
  await mountValid()
  act(() => state.props.chooseMenu(null))
  expect(state.props.draft.form.menuMode).toBe('')
  act(() => state.props.chooseMenu(true))
  expect(state.props.draft.form.categories[0].name).toBe('Pizzas')
  act(() => state.props.update({ categories: [{ key: 's', name: 'Edited sample', products: [{ key: 'sp', name: 'Sample', price: '7' }] }] }))
  act(() => state.props.chooseMenu(null))
  act(() => state.props.chooseMenu(false))
  expect(state.props.draft.form.categories[0].name).toBe('Food')
  expect(state.props.draft.form.categories[0].products[0].price).toBe('0')
  act(() => state.props.chooseMenu(null))
  act(() => state.props.chooseMenu(true))
  expect(state.props.draft.form.categories[0].name).toBe('Edited sample')
})

it('finds the direct restaurant link automatically on retry and stops polling', async () => {
  state.websiteProduct = 'web_franchises_x'
  await mountValid()
  vi.useFakeTimers()
  state.list.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 3, type: 'franchiseweb', url: 'https://ready.example' }])
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; checkpoint(draft) })
  await act(async () => { await state.props.publish() })
  expect(state.props.site.loading).toBe(true)
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(state.props.site.url).toBe('https://ready.example/store/restaurant')
  expect(state.list).toHaveBeenCalledTimes(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
  expect(state.list).toHaveBeenCalledTimes(2)
})
it('bounds missing-site polling and cancels the pending request on unmount', async () => {
  await mountValid(); vi.useFakeTimers()
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; checkpoint(draft) })
  await act(async () => { await state.props.publish() })
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(state.props.site.loading).toBe(false)
  expect(state.list.mock.calls.length).toBeLessThanOrEqual(5)
  let pendingSignal
  state.list.mockImplementation((path, signal) => { pendingSignal = signal; return new Promise(() => {}) })
  act(() => state.props.refreshSite())
  expect(pendingSignal.aborted).toBe(false)
  cleanup()
  expect(pendingSignal.aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('uses a ready franchise immediately without reading unrelated failing website themes', async () => {
  state.websiteProduct = 'web_franchises_x'
  await mountValid()
  state.list.mockImplementation(path => path === '/sites' ? Promise.resolve([{ id: 1, type: 'franchiseweb', url: 'https://ready.example' }, { id: 2, code: 'website' }]) : Promise.reject(new Error('unrelated theme offline')))
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; checkpoint(draft) })
  await act(async () => { await state.props.publish() })
  expect(state.props.site.url).toBe('https://ready.example/store/restaurant')
  expect(state.list).toHaveBeenCalledTimes(1)
})
it('uses the canonical installed franchise while unrelated site metadata cannot resolve', async () => {
  state.websiteProduct = 'web_franchises_x'
  await mountValid()
  state.list.mockResolvedValue([{ id: 1, websiteType: 'marketplace', url: 'https://market.example' }, { id: 2, code: 'website' }, { id: 3, code: 'web_franchises_x', url: 'https://franchise.example' }])
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; await checkpoint(draft) })
  await act(async () => { await state.props.publish() })
  expect(state.props.site.url).toBe('https://franchise.example/store/restaurant')
  expect(state.list).toHaveBeenCalledTimes(1)
})

it('takes the project timezone for a fresh draft even when phone validation autosaves before metadata resolves', async () => {
  let resolve
  state.bootstrap.mockReturnValueOnce(new Promise(_resolve => { resolve = _resolve }))
  render(<StoreOnboarding storageKey='fresh' UIComponent={View} onComplete={vi.fn()} />)
  act(() => state.props.update({ phoneValid: true }))
  await act(async () => { resolve({ configs: { timezone: { value: 'Europe/Paris' } }, paymethods: [] }) })
  expect(state.props.draft.form.timezone).toBe('Europe/Paris')
})
it('preserves an existing draft timezone across metadata refresh', async () => {
  const draft = createDraft('owner@example.com', 'Asia/Tokyo'); draft.defaultsPending = false; localStorage.setItem('existing', JSON.stringify(draft))
  state.bootstrap.mockResolvedValueOnce({ configs: { timezone: { value: 'Europe/Paris' } }, paymethods: [] })
  render(<StoreOnboarding storageKey='existing' UIComponent={View} onComplete={vi.fn()} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  expect(state.props.draft.form.timezone).toBe('Asia/Tokyo')
})

it('resolves the canonical marketplace without requesting unrelated website themes', async () => {
  state.websiteProduct = 'web_marketplace_26'
  await mountValid()
  state.list.mockResolvedValue([{ id: 1, code: 'web_marketplace_26', url: 'https://market.example' }, { id: 2, code: 'web_franchises_x' }])
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; await checkpoint(draft) })
  await act(async () => { await state.props.publish() })
  expect(state.props.site.url).toBe('https://market.example/store/restaurant')
  expect(state.list.mock.calls.map(([path]) => path)).toEqual(['/sites'])
})

it('preserves the started publication when an older tab attempts an edit or navigation', async () => {
  let first, second
  const First = props => { first = props; return null }
  const Second = props => { second = props; return null }
  await mountValid(); cleanup()
  render(<StoreOnboarding storageKey='draft' UIComponent={First} onComplete={vi.fn()} />)
  render(<StoreOnboarding storageKey='draft' UIComponent={Second} onComplete={vi.fn()} />)
  await waitFor(() => expect(first.meta.loading || second.meta.loading).toBe(false))
  state.publish.mockImplementation(async (draft, owner, checkpoint) => {
    Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant' }); checkpoint(draft)
    throw new Error('offline')
  })
  await act(async () => { await first.publish() })
  act(() => { second.update({ name: 'Older tab' }); second.move(0); second.chooseMenu(true) })
  expect(JSON.parse(localStorage.getItem('draft')).journal.businessId).toBe(9)
  expect(second.draft.journal.businessId).toBe(9)
  expect(second.draft.form.name).toBe('Restaurant')
})

it('adopts same-project storage updates but ignores other draft owners and removed progress', async () => {
  await mountValid()
  const next = JSON.parse(localStorage.getItem('draft')); next.form.name = 'Same browser'
  localStorage.setItem('draft', JSON.stringify(next))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'draft', newValue: JSON.stringify(next) })))
  expect(state.props.draft.form.name).toBe('Same browser')
  const other = { ...next, nonce: crypto.randomUUID() }; other.form = { ...next.form, name: 'Other owner' }
  localStorage.setItem('draft', JSON.stringify(other))
  act(() => state.props.update({ phone: '9999999999' }))
  expect(JSON.parse(localStorage.getItem('draft')).form.name).toBe('Other owner')
  expect(state.props.notice).toBe('storage')
})

it('validates payment selection when leaving combined delivery and payments', async () => {
  await mountValid()
  act(() => state.props.move(3))
  expect(state.props.draft.step).toBe(3)
  act(() => state.props.update({ payments: [] }))
  act(() => state.props.move(5))
  expect(state.props.draft.step).toBe(3)
  expect(state.props.errors).toContain('payments')
  act(() => state.props.update({ payments: ['cash'] }))
  act(() => state.props.move(5))
  expect(state.props.draft.step).toBe(5)
})
it('returns to the combined step when a recovered form is missing payment', async () => {
  await mountValid()
  act(() => state.props.update({ payments: [] }))
  await act(() => state.props.publish())
  expect(state.props.draft.step).toBe(3)
  expect(state.props.errors).toContain('payments')
  expect(state.publish).not.toHaveBeenCalled()
})
it('reuses regional project values without sending writes during bootstrap', async () => {
  state.bootstrap.mockResolvedValue({ configs: { country_autocomplete: { id: 1, value: 'CA' }, stripe_currency: { id: 2, value: '' }, distance_unit: { id: 3, value: '' } }, paymethods: [{ id: 4, gateway: 'cash' }] })
  render(<StoreOnboarding storageKey='fresh' UIComponent={View} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  expect(state.props.meta.configs.stripe_currency.value).toBe('CAD')
  expect(state.props.meta.configs.distance_unit.value).toBe('km')
  expect(state.props.draft.form.orderTypes).toEqual([1])
  expect(state.props.draft.form.zone.name).toBe('Delivery')
  expect(state.publish).not.toHaveBeenCalled()
})

it('initial project timezone survives phone autosave and reload while bootstrap is pending', async () => {
  state.bootstrap.mockReturnValueOnce(new Promise(() => {}))
  render(<StoreOnboarding storageKey='fresh' UIComponent={View} />)
  const deviceZone = state.props.draft.form.timezone
  const projectZone = deviceZone === 'Asia/Tokyo' ? 'Europe/Paris' : 'Asia/Tokyo'
  act(() => state.props.update({ phoneValid: true }))
  expect(JSON.parse(localStorage.getItem('fresh')).form.timezone).toBe(deviceZone)
  cleanup()
  state.bootstrap.mockResolvedValueOnce({ configs: { timezone: { value: projectZone } }, paymethods: [] })
  render(<StoreOnboarding storageKey='fresh' UIComponent={View} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  expect(state.props.draft.form.timezone).toBe(projectZone)
})

it('preserves an explicit timezone edit while initial metadata is pending, including after reload', async () => {
  state.bootstrap.mockReturnValueOnce(new Promise(() => {}))
  render(<StoreOnboarding storageKey='fresh' UIComponent={View} />)
  act(() => state.props.update({ timezone: 'Europe/Madrid' }))
  cleanup()
  state.bootstrap.mockResolvedValueOnce({ configs: { timezone: { value: 'Asia/Tokyo' } }, paymethods: [] })
  render(<StoreOnboarding storageKey='fresh' UIComponent={View} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  expect(state.props.draft.form.timezone).toBe('Europe/Madrid')
  expect(JSON.parse(localStorage.getItem('fresh')).defaultsPending).toBe(false)
})
it('preserves legacy draft timezones and completes pending defaults after a metadata retry', async () => {
  const legacy = createDraft('owner@example.com', 'Europe/Madrid')
  delete legacy.defaultsPending
  localStorage.setItem('legacy', JSON.stringify(legacy))
  state.bootstrap.mockResolvedValueOnce({ configs: { timezone: { value: 'Asia/Tokyo' } }, paymethods: [] })
  render(<StoreOnboarding storageKey='legacy' UIComponent={View} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  expect(state.props.draft.form.timezone).toBe('Europe/Madrid')
  cleanup()
  state.bootstrap.mockRejectedValueOnce(new Error('offline'))
  render(<StoreOnboarding storageKey='fresh' UIComponent={View} />)
  act(() => state.props.update({ phoneValid: false }))
  await waitFor(() => expect(state.props.meta.error).toBe(true))
  expect(JSON.parse(localStorage.getItem('fresh')).defaultsPending).toBe(true)
  state.bootstrap.mockResolvedValueOnce({ configs: { default_timezone: { value: 'Asia/Tokyo' } }, paymethods: [] })
  act(() => state.props.retryMetadata())
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  expect(state.props.draft.form.timezone).toBe('Asia/Tokyo')
  expect(JSON.parse(localStorage.getItem('fresh')).defaultsPending).toBe(false)
})

it('keeps completion independent of order lookup while the restaurant link is unavailable', async () => {
  const draft = createDraft('owner@example.com')
  draft.step = 6
  Object.assign(draft.journal, { started: true, published: true, resourcesComplete: true, businessId: 9, slug: 'restaurant' })
  Object.assign(draft.form, { name: 'Restaurant', phone: '1234567890', address: 'Test address', location: { lat: 0, lng: 0 }, menuMode: 'manual', categories: [{ key: 'c', name: 'Food', products: [{ key: 'p', name: 'Pizza', price: '0' }] }], orderTypes: [1], payments: ['cash'] })
  draft.form.zone.name = 'Delivery'
  localStorage.setItem('completed', JSON.stringify(draft))
  state.bootstrap.mockResolvedValue({ configs: {}, paymethods: [{ id: 4, gateway: 'cash' }] })
  const onComplete = vi.fn()
  render(<StoreOnboarding storageKey='completed' UIComponent={View} onComplete={onComplete} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  expect(state.props.site.url).toBeNull()
  expect(state.props.testOrder).toEqual({ enabled: true })
  state.props.onComplete('orders')
  expect(onComplete).toHaveBeenCalledWith('orders')
  expect(state.list.mock.calls.every(([path]) => !/^\/?orders(?:[/?]|$)/.test(path))).toBe(true)
})

it('merges queued zone patches with the latest stored geometry inside the edit lock', async () => {
  await mountValid()
  act(() => state.props.update({ zone: { ...state.props.draft.form.zone, type: 2, price: '7.50' } }))
  const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
  const pending = []
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: vi.fn((key, options, callback) => new Promise((resolve, reject) => { pending.push(() => { try { resolve(callback()) } catch (error) { reject(error) } }) })) } })
  const polygon = [{ lat: 19, lng: -99 }, { lat: 19.1, lng: -99 }, { lat: 19, lng: -99.1 }]
  try {
    act(() => {
      state.props.update({ zone: { data: polygon } })
      state.props.update({ zone: { name: 'Centro', minimum: '20' }, name: 'Renamed restaurant' })
    })
    expect(pending).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem('draft')).form.zone.data).toBeNull()
    await act(async () => { pending.shift()() })
    await act(async () => { pending.shift()() })
    const saved = JSON.parse(localStorage.getItem('draft'))
    expect(saved.form.zone).toEqual({ type: 2, name: 'Centro', minimum: '20', price: '7.50', data: polygon })
    expect(saved.form.name).toBe('Renamed restaurant')
    expect(saved.form.phone).toBe('1234567890')
    expect(state.props.draft.form.zone).toEqual(saved.form.zone)
  } finally {
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
    else delete navigator.locks
  }
})

it('merges queued menu field changes by identity and preserves images through reload and menu switching', async () => {
  await mountValid()
  const image = 'data:image/png;base64,aW1hZ2U='
  const queue = []
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: vi.fn((key, options, run) => new Promise(resolve => queue.push(() => resolve(run())))) } })
  let first; let second
  try {
    act(() => {
      first = state.props.updateMenu({ mode: 'manual', kind: 'product', categoryKey: 'c', productKey: 'p', patch: { images: image } })
      second = state.props.updateMenu({ mode: 'manual', kind: 'product', categoryKey: 'c', productKey: 'p', patch: { name: 'Cheese pizza' } })
    })
    await act(async () => { queue.shift()(); await first; queue.shift()(); await second })
  } finally { delete navigator.locks }
  expect(state.props.draft.form.categories[0].products[0]).toMatchObject({ name: 'Cheese pizza', images: image, price: '0' })
  cleanup()
  render(<StoreOnboarding storageKey='draft' UIComponent={View} onComplete={vi.fn()} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  act(() => state.props.chooseMenu(null))
  act(() => state.props.chooseMenu(true))
  act(() => state.props.chooseMenu(null))
  act(() => state.props.chooseMenu(false))
  expect(state.props.draft.form.categories[0].products[0].images).toBe(image)
})
it('reports failed menu saves without replacing the last persisted draft', async () => {
  await mountValid()
  const before = localStorage.getItem('draft')
  const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  try {
    let result
    await act(async () => { result = await state.props.updateMenu({ mode: 'manual', kind: 'category', categoryKey: 'c', patch: { image: 'data:image/png;base64,aW1hZ2U=' } }) })
    expect(result).toBe(false)
    expect(localStorage.getItem('draft')).toBe(before)
    expect(state.props.notice).toBe('storage')
  } finally { set.mockRestore() }
})

it('starts the manual menu with no automatically inserted category or product', async () => {
  await mountValid()
  act(() => state.props.chooseMenu(null))
  const draft = JSON.parse(localStorage.getItem('draft')); delete draft.form.menuDrafts.manual
  localStorage.setItem('draft', JSON.stringify(draft))
  act(() => state.props.chooseMenu(false))
  expect(state.props.draft.form.categories).toEqual([])
})

it('retries website appearance without replacing a color selected in the saved draft', async () => {
  state.appearance.mockRejectedValueOnce(new Error('offline'))
  await mountValid()
  await waitFor(() => expect(state.props.appearance.error).toBe(true))
  act(() => state.props.update({ websiteColor: '#abcdef', websiteAppearanceTarget: { siteId: 1, themeId: 2 } }))
  act(() => state.props.retryAppearance())
  await waitFor(() => expect(state.props.appearance.color).toBe('#112233'))
  expect(state.props.draft.form.websiteColor).toBe('#abcdef')
  expect(JSON.parse(localStorage.getItem('draft')).form.websiteColor).toBe('#abcdef')
})

it('starts a fresh sample menu with3categories and10unique editable products', async () => {
  await mountValid()
  act(() => state.props.chooseMenu(true))
  const categories = state.props.draft.form.categories
  expect(categories).toHaveLength(3)
  expect(categories.map(category => category.products.length)).toEqual([4, 3, 3])
  const products = categories.flatMap(category => category.products)
  expect(products).toHaveLength(10)
  expect(new Set([...categories, ...products].map(item => item.key)).size).toBe(13)
  expect(products.slice(0, 2).map(product => [product.name, product.price])).toEqual([['Margherita pizza', '12'], ['Pepperoni pizza', '15']])
})

it('opens the installed franchise business URL even without site URL fields and never reads marketplace themes', async () => {
  state.root = 'https://api.orderingplus.com/v400/en/tenant'; state.websiteProduct = 'web_franchises_x'
  await mountValid()
  state.list.mockResolvedValue([{ id: 34, code: 'website', url: 'https://tenant.orderingplus.com' }, { id: 133, type: 'franchiseweb', code: 'web_franchises_x' }])
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; checkpoint(draft) })
  await act(async () => { await state.props.publish() })
  expect(state.props.site.url).toBe('https://tenant.franchises.orderingplus.com/store/restaurant')
  expect(state.list).toHaveBeenCalledTimes(1)
})
it('waits for the franchise install instead of falling back to a marketplace business URL', async () => {
  state.websiteProduct = 'web_franchises_x'
  await mountValid(); vi.useFakeTimers()
  state.list.mockResolvedValue([{ id: 34, code: 'web_marketplace_26', url: 'https://market.example' }])
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; checkpoint(draft) })
  await act(async () => { await state.props.publish() })
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(state.props.site.url).toBeNull()
  expect(state.props.site.loading).toBe(false)
  expect(state.list.mock.calls.length).toBeLessThanOrEqual(5)
})
it('does not select a preview while subscription identity is unresolved and lets the user retry it', async () => {
  state.websiteProduct = null; state.projectLoading = true
  await mountValid()
  expect(state.appearance).not.toHaveBeenCalled()
  expect(state.props.appearance.loading).toBe(true)
  act(() => state.props.retryAppearance())
  expect(state.refreshProject).toHaveBeenCalledTimes(1)
})
it('retargets the chosen draft color to the actual installed site while retaining unrelated edits', async () => {
  const draft = createDraft('owner@example.com')
  Object.assign(draft.form, { name: 'My edited name', websiteColor: '#abcdef', websiteAppearanceTarget: { siteId: 34, themeId: 1 } })
  localStorage.setItem('draft', JSON.stringify(draft)); state.websiteProduct = 'web_franchises_x'
  state.appearance.mockResolvedValue({ siteId: 133, themeId: 1, color: '#112233' })
  render(<StoreOnboarding storageKey='draft' UIComponent={View} onComplete={vi.fn()} />)
  await waitFor(() => expect(state.props.appearance.loading).toBe(false))
  expect(state.props.draft.form).toMatchObject({ name: 'My edited name', websiteColor: '#abcdef', websiteAppearanceTarget: { siteId: 133, themeId: 1 } })
  expect(JSON.parse(localStorage.getItem('draft')).form.websiteAppearanceTarget.siteId).toBe(133)
  expect(state.publish).not.toHaveBeenCalled()
})

it('hides the prior marketplace preview and final URL in the first committed render after product identity changes', async () => {
  state.websiteProduct = 'web_marketplace_26'
  state.appearance.mockResolvedValue({ siteId: 34, themeId: 1, preview: { url: 'https://market.example' } })
  const mounted = await mountValid()
  await waitFor(() => expect(state.props.appearance.siteId).toBe(34))
  state.list.mockResolvedValue([{ id: 34, code: 'web_marketplace_26', url: 'https://market.example' }])
  state.publish.mockImplementation(async (draft, owner, checkpoint) => { Object.assign(draft.journal, { started: true, businessId: 9, slug: 'restaurant', resourcesComplete: true, published: true }); draft.step = 6; checkpoint(draft) })
  await act(async () => { await state.props.publish() })
  expect(state.props.site.url).toBe('https://market.example/store/restaurant')
  const before = state.commits.length
  state.websiteProduct = 'web_franchises_x'
  state.appearance.mockReturnValue(new Promise(() => {}))
  state.list.mockReturnValue(new Promise(() => {}))
  await act(async () => { mounted.rerender(<StoreOnboarding storageKey='draft' UIComponent={View} onComplete={vi.fn()} />) })
  expect(state.commits[before].appearance.siteId).toBeUndefined()
  expect(state.commits[before].appearance.loading).toBe(true)
  expect(state.commits[before].site.url).toBeNull()
})

it('keeps successfully loaded settings when autosaving hydration exceeds storage quota', async () => {
  state.bootstrap.mockResolvedValue({ configs: { timezone: { value: 'America/Mexico_City' } }, paymethods: [{ id: 1, gateway: 'cash' }] })
  const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  try {
    render(<StoreOnboarding storageKey='empty' UIComponent={View} onComplete={vi.fn()} />)
    await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
    expect(state.props.meta.error).not.toBe(true)
    expect(state.props.meta.configs.timezone.value).toBe('America/Mexico_City')
    expect(state.props.meta.paymethods).toEqual([{ id: 1, gateway: 'cash' }])
    expect(state.props.notice).toBe('storage')
  } finally { set.mockRestore() }
})

it('saves large logo and menu images outside the small text draft and restores them on reload', async () => {
  await mountValid()
  const image = `data:image/png;base64,${'a'.repeat(3 * 1024 * 1024)}`
  const productImage = `data:image/png;base64,${'b'.repeat(3 * 1024 * 1024)}`
  await act(async () => { expect(await state.props.update({ logo: image })).toBe(true) })
  await act(async () => { expect(await state.props.updateMenu({ mode: 'manual', kind: 'product', categoryKey: 'c', productKey: 'p', patch: { images: productImage } })).toBe(true) })
  expect(localStorage.getItem('draft').length).toBeLessThan(20000)
  expect(state.props.draft.form.logo).toBe(image)
  expect(state.props.draft.form.categories[0].products[0].images).toBe(productImage)
  cleanup()
  render(<StoreOnboarding storageKey='draft' UIComponent={View} onComplete={vi.fn()} />)
  await waitFor(() => { expect(state.props.meta.loading).toBe(false); expect(state.props.mediaReady).toBe(true) })
  expect(state.props.draft.form.logo).toBe(image)
  expect(state.props.draft.form.categories[0].products[0].images).toBe(productImage)
})

it('serializes project-default hydration with an image save already in flight', async () => {
  let finish
  state.bootstrap.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  render(<StoreOnboarding storageKey='fresh-media' UIComponent={View} />)
  let saving
  act(() => { saving = state.props.update({ logo: 'data:image/png;base64,aW1hZ2U=' }) })
  await act(async () => {
    finish({ configs: { timezone: { value: 'Europe/Madrid' } }, paymethods: [] })
    expect(await saving).toBe(true)
  })
  await waitFor(() => expect(state.props.draft.defaultsPending).toBe(false))
  expect(state.props.draft.form.logo).toBe('data:image/png;base64,aW1hZ2U=')
  expect(state.props.draft.form.timezone).toBe('Europe/Madrid')
})

it('preserves its draft owner and loaded settings when metadata refresh sees another tab replacing the draft', async () => {
  await mountValid()
  const nonce = state.props.draft.nonce
  localStorage.setItem('draft', JSON.stringify(createDraft('other@example.com')))
  act(() => state.props.retryMetadata())
  await waitFor(() => expect(state.props.notice).toBe('storage'))
  expect(state.props.meta.error).not.toBe(true)
  expect(state.props.draft.nonce).toBe(nonce)
  expect(state.props.draft.form.email).toBe('owner@example.com')
})

it('validates the latest locked draft instead of overwriting a completed edit from another tab', async () => {
  await mountValid()
  act(() => state.props.update({ name: '' }))
  const latest = JSON.parse(localStorage.getItem('draft'))
  latest.form.name = 'Latest completed restaurant'
  localStorage.setItem('draft', JSON.stringify(latest))
  await act(async () => { await state.props.publish() })
  expect(state.publish).toHaveBeenCalledOnce()
  expect(state.publish.mock.calls[0][0].form.name).toBe('Latest completed restaurant')
  expect(JSON.parse(localStorage.getItem('draft')).form.name).toBe('Latest completed restaurant')
})

const mediaKeys = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('ordering-store-onboarding-media', 1)
  request.onsuccess = () => {
    const db = request.result; const tx = db.transaction('media', 'readonly'); const get = tx.objectStore('media').getAllKeys()
    get.onsuccess = () => { db.close(); resolve(get.result.filter(key => key.startsWith(`draft:${state.props.draft.nonce}:`))) }
    get.onerror = () => { db.close(); reject(get.error) }
  }
  request.onerror = () => reject(request.error)
})
it('removes a replaced logo after committing its replacement', async () => {
  await mountValid()
  await act(async () => { await state.props.update({ logo: 'data:image/png;base64,YQ==' }) })
  const old = JSON.parse(localStorage.getItem('draft'))
  await act(async () => { await state.props.update({ logo: 'data:image/png;base64,Yg==' }) })
  expect(await mediaKeys()).toHaveLength(1)
  const { createDraftMedia } = await import('../../utils/storeOnboardingDraftMedia')
  await expect(createDraftMedia('draft').load(old)).rejects.toThrow('missing_draft_media')
})
it('keeps the alternative menu image and removes only the replaced active-menu image', async () => {
  await mountValid()
  await act(async () => { await state.props.updateMenu({ mode: 'manual', kind: 'product', categoryKey: 'c', productKey: 'p', patch: { images: 'data:image/png;base64,YQ==' } }) })
  act(() => state.props.chooseMenu(true))
  const sampleCategory = state.props.draft.form.categories[0]; const sampleProduct = sampleCategory.products[0]
  await act(async () => { await state.props.updateMenu({ mode: 'sample', kind: 'product', categoryKey: sampleCategory.key, productKey: sampleProduct.key, patch: { images: 'data:image/png;base64,Yg==' } }) })
  act(() => state.props.chooseMenu(false))
  await act(async () => { await state.props.updateMenu({ mode: 'manual', kind: 'product', categoryKey: 'c', productKey: 'p', patch: { images: 'data:image/png;base64,Yw==' } }) })
  expect(await mediaKeys()).toHaveLength(2)
  act(() => state.props.chooseMenu(true))
  expect(state.props.draft.form.categories[0].products[0].images).toBe('data:image/png;base64,Yg==')
})
