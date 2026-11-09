import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  updateBuilderProduct: vi.fn(),
  getBuilderThemeSchema: vi.fn(),
  listBuilderScopeBusinesses: vi.fn(),
  listBuilderScopeFranchises: vi.fn(),
  getBuilderScopeBusiness: vi.fn(),
  getBuilderScopeFranchise: vi.fn(),
  listBuilderThemes: vi.fn()
}))

vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'http://api/v400/en/development', appInternalName: 'dashboard' }]
}))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))
vi.mock('../builderApi', async () => {
  const actual = await vi.importActual('../builderApi')
  const mocked = Object.fromEntries(Object.keys(api).map(name => [name, (...args) => api[name](...args)]))
  return { ...actual, ...mocked }
})

import { BuilderSiteSettings } from '../BuilderSiteSettings'

const ok = (result, pagination) => ({ error: false, status: 200, result, errorCodes: [], pagination })
const page = (rows, current, totalPages, total) => ok(rows, { current_page: current, page_size: 20, total_pages: totalPages, total })
const deferred = () => {
  let resolve
  const promise = new Promise(_resolve => { resolve = _resolve })
  return { promise, resolve }
}
const product = { id: 45, name: 'Burger Town', business_id: null, franchise_id: null, settings: { name: 'Burger Town', description: 'Best burgers', tracking_only: false } }

const renderSettings = (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  const onProductChange = vi.fn()
  render(<BuilderSiteSettings UIComponent={UIComponent} productId={45} product={product} onProductChange={onProductChange} {...props} />)
  return { ui, onProductChange }
}

describe('BuilderSiteSettings controller', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    // The schema stays loading unless a test needs it
    api.getBuilderThemeSchema.mockReturnValue(new Promise(() => {}))
    // So is a picked store or franchise read by its id
    api.getBuilderScopeBusiness.mockReturnValue(new Promise(() => {}))
    api.getBuilderScopeFranchise.mockReturnValue(new Promise(() => {}))
    api.listBuilderThemes.mockReturnValue(new Promise(() => {}))
    global.fetch = vi.fn()
  })

  it.each([
    ['one of its themes is active', ok([{ id: 1, active: false }, { id: 2, active: true }]), true],
    ['none of its themes is active', ok([{ id: 1, active: false }]), false],
    ['it has no themes', ok([]), false],
    ['its themes don’t load', { error: true, status: 500, result: ['Server error'], errorCodes: [] }, null]
  ])('knows whether the website has an active theme when %s', async (_case, response, expected) => {
    api.listBuilderThemes.mockResolvedValue(response)
    const { ui } = renderSettings()
    expect(ui.current.hasActiveTheme).toBe(null)
    expect(api.listBuilderThemes).toHaveBeenCalledWith(expect.anything(), 'tok', 45)
    await act(async () => {})
    expect(ui.current.hasActiveTheme).toBe(expected)
  })

  it('loads the website’s schema, and reads the product’s settings under site and its scope', async () => {
    api.getBuilderThemeSchema.mockResolvedValue(ok({ schema: { editor: { sections: [] } }, format: { fonts: {} } }))
    const { ui } = renderSettings({ product: { ...product, business_id: 7 } })
    await waitFor(() => expect(ui.current.schemaState.loading).toBe(false))
    expect(api.getBuilderThemeSchema).toHaveBeenCalledWith(expect.anything(), 'tok', 45)
    expect(ui.current.schemaState.schema).toEqual({ editor: { sections: [] } })
    expect(ui.current.current).toEqual({ site: product.settings })
    expect(ui.current.scope).toEqual({ mode: 'single_store', businessId: 7, franchiseId: null })
    expect(ui.current.hasEdits).toBe(false)
  })

  it('keeps changes until saved, and drops one that goes back to what is saved', () => {
    const { ui } = renderSettings()
    act(() => ui.current.setValue(['site', 'name'], 'Burger Town Online'))
    expect(ui.current.edits).toEqual({ site: { name: 'Burger Town Online' } })
    act(() => ui.current.setValue(['site', 'name'], 'Burger Town'))
    expect(ui.current.edits).toEqual({})
    act(() => ui.current.setScope({ franchiseId: 3 }))
    expect(ui.current.scope).toEqual({ mode: 'franchise', businessId: null, franchiseId: 3 })
    act(() => ui.current.setScope({}))
    expect(ui.current.scopeChanged).toBe(false)
  })

  it('saves the scope and the changed settings with the product’s name', async () => {
    api.updateBuilderProduct.mockResolvedValue(ok({ ...product, business_id: 7, settings: { ...product.settings, tracking_only: true }, apps: [] }))
    const { ui, onProductChange } = renderSettings()
    act(() => { ui.current.setScope({ businessId: 7 }); ui.current.setValue(['site', 'tracking_only'], true); ui.current.setValue(['site', 'description'], null) })
    let answer
    await act(async () => { answer = await ui.current.save() })
    expect(answer.ok).toBe(true)
    expect(api.updateBuilderProduct).toHaveBeenCalledWith(expect.anything(), 'tok', 45, {
      name: 'Burger Town',
      businessId: 7,
      franchiseId: null,
      settings: { tracking_only: true, description: null }
    })
    expect(onProductChange).toHaveBeenCalledWith(expect.objectContaining({ business_id: 7 }))
    expect(onProductChange.mock.calls[0][0]).not.toHaveProperty('apps')
    expect(ui.current.hasEdits).toBe(false)
  })

  it('keeps the changes and marks each refused setting by its path', async () => {
    api.updateBuilderProduct.mockResolvedValue({ error: true, status: 422, result: ['x'], errorCodes: ['settings.invalid'], errors: [{ path: 'site.name', code: 'site.name.too_long' }] })
    const { ui } = renderSettings()
    act(() => ui.current.setValue(['site', 'name'], 'x'.repeat(300)))
    await act(async () => { await ui.current.save() })
    expect(ui.current.errorCodes).toEqual(['settings.invalid'])
    expect(ui.current.fieldErrors).toEqual({ 'site.name': 'site.name.too_long' })
    expect(ui.current.hasEdits).toBe(true)
    act(() => ui.current.setValue(['site', 'name'], 'Short'))
    expect(ui.current.fieldErrors).toEqual({})
  })

  it('loads the stores a page at a time, searched on the server, and the next page added', async () => {
    api.listBuilderScopeBusinesses
      .mockResolvedValueOnce(page([{ id: 7, name: 'Burger Town Centro', slug: 'centro' }, { id: 8, name: 'Burger Town Norte' }], 1, 2, 3))
      .mockResolvedValueOnce(page([{ id: 8, name: 'Burger Town Norte' }, { id: 9, name: 'Burger Town Sur' }], 2, 2, 3))
    const { ui } = renderSettings()
    await act(async () => { await ui.current.loadScopeOptions('stores') })
    expect(api.listBuilderScopeBusinesses).toHaveBeenLastCalledWith(expect.anything(), 'tok', { page: 1, pageSize: 20, search: '' })
    expect(ui.current.scopeOptions.stores).toMatchObject({ page: 1, totalPages: 2, total: 3, loaded: true, loading: false })
    // The same first page isn't asked again
    await act(async () => { await ui.current.loadScopeOptions('stores') })
    expect(api.listBuilderScopeBusinesses).toHaveBeenCalledTimes(1)
    await act(async () => { await ui.current.loadScopeOptions('stores', { more: true }) })
    expect(api.listBuilderScopeBusinesses).toHaveBeenLastCalledWith(expect.anything(), 'tok', { page: 2, pageSize: 20, search: '' })
    // A row already shown isn't repeated
    expect(ui.current.scopeOptions.stores.items.map(item => item.id)).toEqual([7, 8, 9])
    // The last page: nothing more to ask for
    await act(async () => { await ui.current.loadScopeOptions('stores', { more: true }) })
    expect(api.listBuilderScopeBusinesses).toHaveBeenCalledTimes(2)
    expect(api.listBuilderScopeFranchises).not.toHaveBeenCalled()

    api.listBuilderScopeBusinesses.mockResolvedValueOnce(page([{ id: 9, name: 'Burger Town Sur' }], 1, 1, 1))
    await act(async () => { await ui.current.loadScopeOptions('stores', { search: ' sur ' }) })
    expect(api.listBuilderScopeBusinesses).toHaveBeenLastCalledWith(expect.anything(), 'tok', { page: 1, pageSize: 20, search: 'sur' })
    expect(ui.current.scopeOptions.stores).toMatchObject({ search: 'sur', items: [{ id: 9, name: 'Burger Town Sur' }], page: 1, totalPages: 1 })
  })

  it('keeps the newest search when an older answer comes last', async () => {
    const first = deferred()
    api.listBuilderScopeFranchises
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(page([{ id: 4, name: 'Pizza Group' }], 1, 1, 1))
    const { ui } = renderSettings()
    act(() => { ui.current.loadScopeOptions('franchises', { search: 'b' }) })
    await act(async () => { await ui.current.loadScopeOptions('franchises', { search: 'pi' }) })
    await act(async () => { first.resolve(page([{ id: 3, name: 'Burger Group' }], 1, 1, 1)) })
    expect(ui.current.scopeOptions.franchises).toMatchObject({ search: 'pi', items: [{ id: 4, name: 'Pizza Group' }] })
  })

  it('marks a list that can’t load, and loads it again when asked', async () => {
    api.listBuilderScopeBusinesses.mockResolvedValueOnce({ error: true, status: 500, result: ['x'], errorCodes: [] })
    const { ui } = renderSettings()
    await act(async () => { await ui.current.loadScopeOptions('stores') })
    expect(ui.current.scopeOptions.stores).toMatchObject({ error: true, loading: false })
    api.listBuilderScopeBusinesses.mockResolvedValueOnce(page([{ id: 7, name: 'Burger Town Centro' }], 1, 1, 1))
    await act(async () => { await ui.current.loadScopeOptions('stores', { force: true }) })
    expect(ui.current.scopeOptions.stores).toMatchObject({ error: false, loaded: true, items: [{ id: 7, name: 'Burger Town Centro' }] })
  })

  it('reads the picked store by its id when no loaded page has it', async () => {
    api.getBuilderScopeBusiness.mockResolvedValue(ok({ id: 70, name: 'Burger Town Airport', enabled: false }))
    const { ui } = renderSettings({ product: { ...product, business_id: 70 } })
    await waitFor(() => expect(ui.current.scopeSelection.item).toEqual({ id: 70, name: 'Burger Town Airport', enabled: false }))
    expect(api.getBuilderScopeBusiness).toHaveBeenCalledWith(expect.anything(), 'tok', 70)
    expect(api.getBuilderScopeBusiness).toHaveBeenCalledTimes(1)
  })

  it('shows the picked one from a loaded page without reading it again', async () => {
    api.listBuilderScopeFranchises.mockResolvedValue(page([{ id: 3, name: 'Burger Group' }], 1, 1, 1))
    const { ui } = renderSettings()
    await act(async () => { await ui.current.loadScopeOptions('franchises') })
    act(() => ui.current.setScope({ mode: 'franchise', franchiseId: 3, item: { id: 3, name: 'Burger Group' } }))
    expect(ui.current.scopeSelection).toMatchObject({ item: { id: 3, name: 'Burger Group' }, loading: false })
    // Another search drops it from the list; the picked row stays
    api.listBuilderScopeFranchises.mockResolvedValue(page([], 1, 0, 0))
    await act(async () => { await ui.current.loadScopeOptions('franchises', { search: 'zzz' }) })
    expect(ui.current.scopeSelection.item).toEqual({ id: 3, name: 'Burger Group' })
    expect(api.getBuilderScopeFranchise).not.toHaveBeenCalled()
  })

  it('tells a picked one that is gone from one that couldn’t be read, and reads it again', async () => {
    api.getBuilderScopeFranchise.mockResolvedValueOnce({ error: true, status: 404, result: ['ERROR_FRANCHISE_FIND'], errorCodes: [] })
    const gone = renderSettings({ product: { ...product, franchise_id: 99 } })
    await waitFor(() => expect(gone.ui.current.scopeSelection).toMatchObject({ missing: true, loading: false, item: null }))

    api.getBuilderScopeBusiness
      .mockResolvedValueOnce({ status: 0, error: true, result: ['Failed to fetch'], errorCodes: [] })
      .mockResolvedValueOnce(ok({ id: 71, name: 'Burger Town Mall' }))
    const offline = renderSettings({ product: { ...product, business_id: 71 } })
    await waitFor(() => expect(offline.ui.current.scopeSelection).toMatchObject({ error: true, missing: false }))
    await act(async () => { await offline.ui.current.reloadScopeSelection() })
    await waitFor(() => expect(offline.ui.current.scopeSelection.item).toEqual({ id: 71, name: 'Burger Town Mall' }))
  })

  it('drops the id another website type doesn’t take, and brings the saved one back', () => {
    const { ui } = renderSettings({ product: { ...product, business_id: 7 } })
    act(() => ui.current.setScopeMode('franchise'))
    expect(ui.current.scope).toEqual({ mode: 'franchise', businessId: null, franchiseId: null })
    expect(ui.current.scopeIncomplete).toBe(true)
    expect(ui.current.hasEdits).toBe(true)
    act(() => ui.current.setScopeMode('marketplace'))
    expect(ui.current.scope).toEqual({ mode: 'marketplace', businessId: null, franchiseId: null })
    expect(ui.current.scopeIncomplete).toBe(false)
    act(() => ui.current.setScopeMode('single_store'))
    expect(ui.current.scope).toEqual({ mode: 'single_store', businessId: 7, franchiseId: null })
    expect(ui.current.scopeChanged).toBe(false)
    // A picked store and a picked franchise never go together
    act(() => ui.current.setScope({ mode: 'franchise', businessId: 7, franchiseId: 3 }))
    expect(ui.current.scope).toEqual({ mode: 'franchise', businessId: null, franchiseId: 3 })
    act(() => ui.current.discard())
    expect(ui.current.scope).toEqual({ mode: 'single_store', businessId: 7, franchiseId: null })
  })

  it.each([
    ['single_store', {}, { businessId: 7 }, { businessId: 7, franchiseId: null }],
    ['franchise', { business_id: 8 }, { franchiseId: 3 }, { businessId: null, franchiseId: 3 }],
    ['marketplace', { business_id: 8 }, {}, { businessId: null, franchiseId: null }]
  ])('saves %s as product scope, never as a setting', async (mode, saved, selection, expected) => {
    api.updateBuilderProduct.mockResolvedValue(ok(product))
    const { ui } = renderSettings({ product: { ...product, ...saved } })
    expect(ui.current.scope.mode).not.toBe(mode)
    act(() => ui.current.setScopeMode(mode))
    expect(ui.current.scope.mode).toBe(mode)
    if (mode !== 'marketplace') act(() => ui.current.setScope({ mode, ...selection }))
    act(() => ui.current.setValue(['site', 'description'], 'Updated description'))
    await act(async () => { await ui.current.save() })
    expect(api.updateBuilderProduct).toHaveBeenCalledWith(expect.anything(), 'tok', 45, {
      name: product.name,
      ...expected,
      settings: { description: 'Updated description' }
    })
    expect(ui.current.hasEdits).toBe(false)
    expect(ui.current.errorCodes).toEqual([])
  })

  it('doesn’t save a website type with nothing picked', async () => {
    const { ui } = renderSettings()
    act(() => ui.current.setScopeMode('single_store'))
    let answer
    await act(async () => { answer = await ui.current.save() })
    expect(answer).toEqual({ ok: false, errorCodes: ['scope.incomplete'] })
    expect(ui.current.errorCodes).toEqual(['scope.incomplete'])
    expect(api.updateBuilderProduct).not.toHaveBeenCalled()
    // Picking one clears the error
    act(() => ui.current.setScope({ mode: 'single_store', businessId: 7 }))
    expect(ui.current.errorCodes).toEqual([])
  })
})

describe('website type pickers (builderApi)', () => {
  const ordering = { root: 'http://api/v400/en/development', appInternalName: 'dashboard' }
  const paged = { error: false, result: [{ id: 7, name: 'Burger Town Centro' }], pagination: { current_page: 1, page_size: 20, total_pages: 1, total: 1 } }

  const lastUrl = () => new URL(global.fetch.mock.calls[global.fetch.mock.calls.length - 1][0])

  it('lists the stores from the backoffice, paged, by name, the enabled ones', async () => {
    const { listBuilderScopeBusinesses } = await vi.importActual('../builderApi')
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => paged }))
    const answer = await listBuilderScopeBusinesses(ordering, 'tok', { page: 2, pageSize: 500 })
    const url = lastUrl()
    expect(url.pathname).toBe('/v400/en/development/dashboard/businesses')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      params: 'id,name,slug,logo,enabled',
      page: '2',
      // Never more than a picker's page
      page_size: '20',
      orderBy: 'name',
      where: JSON.stringify({ conditions: [{ attribute: 'enabled', value: true }], conector: 'AND' })
    })
    expect(global.fetch.mock.calls[0][1]).toEqual({ method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' } })
    expect(answer).toMatchObject({ error: false, result: paged.result, pagination: paged.pagination })
  })

  it('searches the name and the slug, and the id when the search is one', async () => {
    const { listBuilderScopeBusinesses, buildScopeWhere } = await vi.importActual('../builderApi')
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => paged }))
    await listBuilderScopeBusinesses(ordering, 'tok', { search: '50% off' })
    expect(JSON.parse(lastUrl().searchParams.get('where'))).toEqual({
      conditions: [
        { attribute: 'enabled', value: true },
        {
          conditions: [
            { attribute: 'name', value: { condition: 'ilike', value: '%50% off%' } },
            { attribute: 'slug', value: { condition: 'ilike', value: '%50% off%' } }
          ],
          conector: 'OR'
        }
      ],
      conector: 'AND'
    })
    expect(buildScopeWhere(' 42 ').conditions[1].conditions).toContainEqual({ attribute: 'id', value: 42 })
  })

  it('reads one store by its id from the backoffice', async () => {
    const { getBuilderScopeBusiness } = await vi.importActual('../builderApi')
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ error: false, result: { id: 7 } }) }))
    await getBuilderScopeBusiness(ordering, 'tok', 7)
    expect(lastUrl().pathname).toBe('/v400/en/development/dashboard/businesses/7')
    expect(lastUrl().searchParams.get('params')).toBe('id,name,slug,logo,enabled')
  })

  it('lists and reads the franchises with the same params, at their own URL', async () => {
    const { listBuilderScopeFranchises, getBuilderScopeFranchise, getBuilderScopeFranchisesUrl } = await vi.importActual('../builderApi')
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => paged }))
    expect(getBuilderScopeFranchisesUrl(ordering)).toBe('http://api/v400/en/development/dashboard/franchises')
    await listBuilderScopeFranchises(ordering, 'tok', { page: 3, search: 'burger' })
    expect(lastUrl().pathname).toBe('/v400/en/development/dashboard/franchises')
    expect(Object.fromEntries(lastUrl().searchParams)).toMatchObject({ params: 'id,name,slug,logo,enabled', page: '3', page_size: '20', orderBy: 'name' })
    await getBuilderScopeFranchise(ordering, 'tok', 3)
    expect(lastUrl().pathname).toBe('/v400/en/development/dashboard/franchises/3')
  })
})

describe('updateBuilderProduct', () => {
  it('sends only what is given, the name always', async () => {
    const { updateBuilderProduct: realUpdate } = await vi.importActual('../builderApi')
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ error: false, result: {} }) }))
    const ordering = { root: 'http://api/v400/en/development', appInternalName: 'dashboard' }
    await realUpdate(ordering, 'tok', 45, { name: 'Burger Town' })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ name: 'Burger Town' })
    await realUpdate(ordering, 'tok', 45, { name: 'Burger Town', businessId: null, franchiseId: 3, settings: { name: null } })
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ name: 'Burger Town', business_id: null, franchise_id: 3, settings: { name: null } })
  })
})
