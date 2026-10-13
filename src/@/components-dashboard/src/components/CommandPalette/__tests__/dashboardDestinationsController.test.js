import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSettingsHubEntries } from '../../../utils/commandPaletteCatalog'
import { buildPaletteStorePath } from '../../../utils/businessDetailSections'
import { buildDashboardDestinationCatalog } from '../../../utils/dashboardDestinations'
import { buildSettingsHub } from '../../../utils/settingsIa'
import { createDashboardDestinationsController } from '../dashboardDestinationsController'

const { fetchBusinessSearchRows, fetchRecordSearchRows, fetchRecordSearchWithSlowPolicy } = vi.hoisted(() => ({
  fetchBusinessSearchRows: vi.fn(),
  fetchRecordSearchRows: vi.fn(),
  fetchRecordSearchWithSlowPolicy: vi.fn()
}))

vi.mock('../dashboardSearchRequests', () => ({
  fetchBusinessSearchRows,
  fetchRecordSearchRows,
  fetchRecordSearchWithSlowPolicy
}))

const user = { id: 7, level: 0, user_system_id: 1 }
const t = (_key, fallback) => fallback

const makeSnapshot = (overrides = {}) => {
  const catalog = overrides.catalog || buildDashboardDestinationCatalog({
    user,
    configs: {},
    project: 'demo'
  })
  return {
    catalog,
    navCatalog: catalog,
    catalogErrors: [],
    ensureCatalogs: vi.fn(async () => ({ catalog, catalogErrors: [] })),
    locationSearch: '',
    ordering: { project: 'demo', root: 'https://api.test' },
    token: 'token-1',
    user,
    level: user.level,
    project: 'demo',
    configs: {},
    t,
    scope: 'scope-1',
    revision: 'revision-1',
    securityKey: 'security-1',
    navigate: vi.fn(),
    setAssistantOpen: vi.fn(),
    ...overrides
  }
}

const deferred = () => {
  let complete
  const promise = new Promise(resolve => { complete = resolve })
  return { promise, resolve: complete }
}

describe('Dashboard destinations controller', () => {
  beforeEach(() => {
    fetchBusinessSearchRows.mockReset()
    fetchRecordSearchRows.mockReset().mockResolvedValue([])
    fetchRecordSearchWithSlowPolicy.mockReset().mockResolvedValue([])
    window.innerWidth = 1024
  })

  it('feature intent returns only destinations, without remote records or an implicit page store', async () => {
    const snapshot = makeSnapshot({ locationSearch: '?business_id=199' })
    const result = await createDashboardDestinationsController({ current: snapshot }).search({ query: 'schedule', intent: 'feature' })
    expect(result.items.find(item => item.id === 'action:business-schedule')).toMatchObject({ requires_business: true, kind: 'section' })
    expect(result.items.every(item => !/^(business|user|order|handoff):/.test(item.id))).toBe(true)
    expect(fetchBusinessSearchRows).not.toHaveBeenCalled()
    expect(fetchRecordSearchWithSlowPolicy).not.toHaveBeenCalled()
  })

  it('business intent returns only homonymous store identities, never store subpanels', async () => {
    fetchBusinessSearchRows.mockResolvedValue([{ id: 1, name: "McDonald's" }, { id: 199, name: "McDonald's" }])
    const result = await createDashboardDestinationsController({ current: makeSnapshot({ locationSearch: '?business_id=42' }) }).search({ query: '', business_query: "McDonald's", intent: 'business' })
    expect(result.items.map(item => item.id)).toEqual(['business:1', 'business:199'])
    expect(result.items.map(item => item.subtitle)).toEqual(['#1', '#199'])
    expect(fetchRecordSearchWithSlowPolicy).not.toHaveBeenCalled()
  })

  it('feature intent uses the page store only when explicitly requested', async () => {
    fetchBusinessSearchRows.mockResolvedValue([{ id: 199, name: 'Current', slug: 'current' }])
    const result = await createDashboardDestinationsController({ current: makeSnapshot({ locationSearch: '?business_id=199' }) }).search({ query: 'schedule', intent: 'feature', use_current_business: true })
    expect(result.items.find(item => item.id === 'action:business-schedule::business:199')).toMatchObject({ params: { business_id: 199 } })
    expect(fetchRecordSearchWithSlowPolicy).not.toHaveBeenCalled()
  })

  it('resolves named stores on the first generic search and preserves homonymous business IDs', async () => {
    const rows = [
      { id: 11, name: 'Pizza Centro', slug: 'pizza-centro', enabled: true },
      { id: 12, name: 'Pizza Centro', slug: 'pizza-centro-north', enabled: true }
    ]
    fetchBusinessSearchRows.mockResolvedValue(rows)
    const snapshot = makeSnapshot({ locationSearch: '?business_id=99' })
    const controller = createDashboardDestinationsController({ current: snapshot })

    const result = await controller.search({ query: 'schedule', business_query: 'Pizza Centro' })
    const stores = result.items.filter(item => item.id.startsWith('action:business-schedule::business:'))

    expect(fetchBusinessSearchRows).toHaveBeenCalledWith(expect.objectContaining({
      term: 'Pizza Centro',
      limit: 8
    }))
    expect(stores.map(item => item.params.business_id)).toEqual([11, 12])
    expect(stores.map(item => item.id)).toEqual([
      'action:business-schedule::business:11',
      'action:business-schedule::business:12'
    ])
    expect(stores[0].title).toBe('Schedule · Pizza Centro')
    expect(stores[1].title).toBe(stores[0].title)
    expect(stores[0]).not.toHaveProperty('path')
  })

  it('authorizes a page business ID and opens through the canonical slug-aware shared path', async () => {
    const business = { id: 11, name: 'Pizza Centro', slug: 'pizza-centro', enabled: true }
    fetchBusinessSearchRows.mockResolvedValue([business])
    const snapshot = makeSnapshot({ locationSearch: '?business_id=11' })
    const controller = createDashboardDestinationsController({ current: snapshot })
    const result = await controller.search({ query: 'schedule' })
    const item = result.items.find(candidate => candidate.id === 'action:business-schedule::business:11')
    const entry = snapshot.catalog.byId.get('action:business-schedule')

    expect(fetchBusinessSearchRows).toHaveBeenCalledWith(expect.objectContaining({ term: '11' }))
    expect(item).toBeDefined()
    await expect(controller.open(item, { scope: result.scope, revision: result.revision }))
      .resolves.toMatchObject({ status: 'opened' })
    expect(snapshot.navigate).toHaveBeenCalledWith(buildPaletteStorePath(entry, business), { remount: false })
    expect(snapshot.navigate.mock.calls[0][0]).toContain('id=11')
    expect(snapshot.navigate.mock.calls[0][0]).toContain('section=schedule')
    expect(snapshot.setAssistantOpen).toHaveBeenCalledWith(true)
  })

  it('returns no old search data after the security generation changes despite an uncancellable request', async () => {
    const businessSearch = deferred()
    fetchBusinessSearchRows.mockReturnValue(businessSearch.promise)
    const latestRef = { current: makeSnapshot() }
    const controller = createDashboardDestinationsController(latestRef)
    const promise = controller.search({ query: 'schedule', business_query: 'Pizza Centro' })

    await vi.waitFor(() => expect(fetchBusinessSearchRows).toHaveBeenCalled())
    latestRef.current = { ...latestRef.current, token: 'token-2', securityKey: 'security-2' }
    businessSearch.resolve([{ id: 11, name: 'Pizza Centro', slug: 'pizza-centro' }])

    const result = await promise
    expect(result).toMatchObject({ status: 'unavailable', items: [], errors: ['STALE_SEARCH'] })
  })

  it('does not navigate if an authorization lookup resolves after the security generation changes', async () => {
    const businessSearch = deferred()
    fetchBusinessSearchRows.mockReturnValue(businessSearch.promise)
    const latestRef = { current: makeSnapshot() }
    const controller = createDashboardDestinationsController(latestRef)
    const item = {
      id: 'action:business-schedule::business:11',
      title: 'Schedule · Pizza Centro',
      params: { business_id: 11 }
    }
    const promise = controller.open(item, { scope: 'scope-1', revision: 'revision-1' })

    await vi.waitFor(() => expect(fetchBusinessSearchRows).toHaveBeenCalled())
    latestRef.current = { ...latestRef.current, token: 'token-2', securityKey: 'security-2' }
    businessSearch.resolve([{ id: 11, name: 'Pizza Centro', slug: 'pizza-centro' }])

    await expect(promise).resolves.toEqual({ status: 'unavailable' })
    expect(latestRef.current.navigate).not.toHaveBeenCalled()
  })

  it('does not navigate if the underlying authorized lookup ignores cancellation', async () => {
    const businessSearch = deferred()
    fetchBusinessSearchRows.mockReturnValue(businessSearch.promise)
    const snapshot = makeSnapshot()
    const controller = createDashboardDestinationsController({ current: snapshot })
    const abort = new AbortController()
    const item = {
      id: 'action:business-schedule::business:11',
      title: 'Schedule · Pizza Centro',
      params: { business_id: 11 }
    }
    const promise = controller.open(item, { scope: 'scope-1', revision: 'revision-1', signal: abort.signal })

    await vi.waitFor(() => expect(fetchBusinessSearchRows).toHaveBeenCalled())
    abort.abort()
    businessSearch.resolve([{ id: 11, name: 'Pizza Centro', slug: 'pizza-centro' }])

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(snapshot.navigate).not.toHaveBeenCalled()
  })

  it('keeps completed record results when another provider reaches the global timeout', async () => {
    vi.useFakeTimers()
    try {
      const pendingBusinessSearch = deferred()
      fetchBusinessSearchRows.mockReturnValue(pendingBusinessSearch.promise)
      fetchRecordSearchWithSlowPolicy.mockResolvedValue([{ id: 123, status: 1 }])
      const snapshot = makeSnapshot()
      const controller = createDashboardDestinationsController({ current: snapshot })
      const promise = controller.search({ query: 'schedule' })

      await vi.advanceTimersByTimeAsync(8000)
      const result = await promise

      expect(result.status).toBe('partial')
      expect(result.errors).toContain('SEARCH_TIMEOUT')
      expect(result.items).toContainEqual(expect.objectContaining({
        id: 'order:123',
        title: 'Order #123'
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('refuses required-business targets when current permissions disallow stores', async () => {
    const snapshot = makeSnapshot({
      navCatalog: { ...makeSnapshot().navCatalog, businessesAllowed: false }
    })
    const controller = createDashboardDestinationsController({ current: snapshot })

    await expect(controller.open({
      id: 'action:business-schedule::business:11',
      title: 'Schedule',
      params: { business_id: 11 }
    }, { scope: 'scope-1', revision: 'revision-1' })).resolves.toEqual({ status: 'unavailable' })
    expect(fetchBusinessSearchRows).not.toHaveBeenCalled()
  })

  it('returns at most eight authorized stores for a destination chooser', async () => {
    fetchBusinessSearchRows.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      name: `Store ${index + 1}`,
      slug: `store-${index + 1}`,
      enabled: true
    })))
    const snapshot = makeSnapshot()
    const controller = createDashboardDestinationsController({ current: snapshot })

    const result = await controller.search({
      query: '',
      destination_id: 'action:business-schedule',
      business_query: ''
    })

    expect(fetchBusinessSearchRows).toHaveBeenCalledWith(expect.objectContaining({ term: '', limit: 8 }))
    expect(result.items).toHaveLength(8)
    expect(result.items.map(item => item.params.business_id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('does not expose user email or phone in model-visible destination labels', async () => {
    fetchBusinessSearchRows.mockResolvedValue([])
    fetchRecordSearchWithSlowPolicy.mockImplementation(({ entity }) => Promise.resolve(entity === 'users'
      ? [{ id: 13, name: 'private@example.com', lastname: '5551234567', email: 'private@example.com', cellphone: '5551234567', level: 3 }]
      : []))
    const controller = createDashboardDestinationsController({ current: makeSnapshot() })

    const result = await controller.search({ query: 'private@example.com' })
    const userItem = result.items.find(item => item.id === 'user:13')

    expect(userItem).toMatchObject({ title: '#13' })
    expect(JSON.stringify(userItem)).not.toMatch(/private@example\.com|5551234567/)
  })

  it('loads a dynamic Settings field lazily and revalidates the shared CommandK entry on every click', async () => {
    const hub = buildSettingsHub({
      categoryLists: {
        key_basic: [{
          id: 9,
          key: 'stripe',
          name: 'Stripe',
          configs: [{ key: 'sample_dynamic_field', name: 'Sample Dynamic Field' }]
        }]
      },
      configs: {}
    })
    const id = 'settings-field:sample_dynamic_field'
    const commandKEntry = buildSettingsHubEntries({ hub }).find(entry => entry.id === id)
    const dynamicCatalog = buildDashboardDestinationCatalog({
      user,
      configs: {},
      project: 'demo',
      settingsHub: hub
    })
    const ready = deferred()
    const ensureCatalogs = vi.fn(async ({ force = false } = {}) => {
      if (!force) await ready.promise
      return { catalog: dynamicCatalog, catalogErrors: [] }
    })
    const snapshot = makeSnapshot({
      catalog: buildDashboardDestinationCatalog({ user, configs: {}, project: 'demo' }),
      revision: 'revision-current',
      ensureCatalogs
    })
    snapshot.navCatalog = dynamicCatalog
    const latestRef = { current: snapshot }
    const controller = createDashboardDestinationsController(latestRef)
    const searchPromise = controller.search({ query: '', destination_id: id })

    await vi.waitFor(() => expect(ensureCatalogs).toHaveBeenCalled())
    ready.resolve()
    const result = await searchPromise
    const item = result.items[0]

    expect(item.id).toBe(id)
    expect(commandKEntry.path).toBe('/settings?group=payments&category=stripe&focus=sample_dynamic_field')
    expect(ensureCatalogs.mock.calls.filter(([options]) => options.force)).toHaveLength(0)
    await expect(controller.open(item, { scope: result.scope, revision: snapshot.revision }))
      .resolves.toMatchObject({ status: 'opened' })
    await expect(controller.open(item, { scope: result.scope, revision: 'old-revision' }))
      .resolves.toMatchObject({ status: 'opened' })
    expect(ensureCatalogs.mock.calls.filter(([options]) => options.force)).toHaveLength(2)
    expect(snapshot.navigate).toHaveBeenCalledWith(commandKEntry.path, { remount: false })
    ensureCatalogs.mockImplementation(async ({ force } = {}) => ({
      catalog: force ? snapshot.catalog : dynamicCatalog,
      catalogErrors: []
    }))
    await expect(controller.open(item, { scope: result.scope, revision: 'old-revision' }))
      .resolves.toEqual({ status: 'unavailable' })
    expect(snapshot.navigate).toHaveBeenCalledTimes(2)
  })

  it('rejects a dynamic destination that disappears during stale refresh', async () => {
    const hub = buildSettingsHub({
      categoryLists: {
        key_basic: [{
          id: 9,
          key: 'stripe',
          name: 'Stripe',
          configs: [{ key: 'sample_removed_field', name: 'Sample Removed Field' }]
        }]
      },
      configs: {}
    })
    const initialCatalog = buildDashboardDestinationCatalog({
      user,
      configs: {},
      project: 'demo',
      settingsHub: hub
    })
    const emptyCatalog = buildDashboardDestinationCatalog({ user, configs: {}, project: 'demo' })
    const ensureCatalogs = vi.fn(async ({ force = false } = {}) => ({
      catalog: force ? emptyCatalog : initialCatalog,
      catalogErrors: []
    }))
    const snapshot = makeSnapshot({
      catalog: initialCatalog,
      revision: 'revision-current',
      ensureCatalogs
    })
    const controller = createDashboardDestinationsController({ current: snapshot })

    await expect(controller.open({
      id: 'settings-field:sample_removed_field',
      title: 'Sample Removed Field'
    }, { scope: snapshot.scope, revision: 'old-revision' }))
      .resolves.toEqual({ status: 'unavailable' })
    expect(ensureCatalogs.mock.calls.filter(([options]) => options.force)).toHaveLength(1)
    expect(snapshot.navigate).not.toHaveBeenCalled()
  })
})
