// (frontend part): the GET to /business_types left without Authorization, while the other requests of
// the same controllers send the session's Bearer. Same URL, same query, same handling of the answer.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { BusinessProductsListing } from '../index'
import { BusinessTypeFilter } from '../../BusinessTypeFilter'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))

vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ on: vi.fn(), off: vi.fn() }]
}))

vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))

global.IS_REACT_ACT_ENVIRONMENT = true

const TYPES_URL = 'https://api.test/business_types?where=[{"attribute":"enabled","value":true}]'

const mount = async (element) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(element) })
  return root
}

const typesCall = (fetchMock) => fetchMock.mock.calls.find(([url]) => String(url).includes('/business_types'))

describe('GET /business_types carries the session token', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('BusinessTypeFilter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: false, result: [{ id: 3, enabled: true, name: 'Food' }], pagination: null })
    })
    vi.stubGlobal('fetch', fetchMock)
    let controllerProps
    const root = await mount(
      <BusinessTypeFilter onChangeBusinessType={() => {}} UIComponent={props => { controllerProps = props; return null }} />
    )

    await vi.waitFor(() => expect(typesCall(fetchMock)).toBeTruthy())
    const [url, options] = typesCall(fetchMock)
    expect(url).toBe(TYPES_URL)
    expect(options).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }
    })
    // the answer is handled as before: «All» first, then the types
    await vi.waitFor(() => expect(controllerProps.typesState.types.map(type => type.name)).toEqual(['All', 'Food']))

    act(() => root.unmount())
  })

  test('BusinessProductsListing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: false, result: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const businessResource = {
      asDashboard: vi.fn(() => ({
        select: vi.fn(() => ({
          parameters: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ content: { result: { id: 10, categories: [] } } }) }))
        }))
      })),
      products: vi.fn(() => ({
        parameters: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ content: { error: false, result: [], pagination: { page_size: 10, current_page: 1, total: 0, total_pages: 1 } } })
        }))
      }))
    }
    const ordering = { root: 'https://api.test', businesses: vi.fn(() => businessResource) }
    const root = await mount(
      <BusinessProductsListing ordering={ordering} slug='test-business' propsToFetch={['id', 'categories']} UIComponent={() => null} />
    )

    await vi.waitFor(() => expect(typesCall(fetchMock)).toBeTruthy())
    const [url, options] = typesCall(fetchMock)
    expect(url).toBe(TYPES_URL)
    expect(options).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }
    })

    act(() => root.unmount())
  })
})
