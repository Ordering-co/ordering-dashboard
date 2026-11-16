/* eslint-disable import/first */
import React from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  api: null,
  socket: { on: vi.fn(), off: vi.fn() },
  events: { on: vi.fn(), off: vi.fn() },
  session: { token: 'test-token', loading: false, user: { id: 1, level: 0 } },
  config: { loading: false, configs: {} }
}))

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.api] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/WebsocketContext', () => ({ useWebsocket: () => mocks.socket }))
vi.mock('../../../contexts/EventContext', () => ({ useEvent: () => [mocks.events] }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => [mocks.config] }))
vi.mock('../../../utils', () => ({ isOrderStatusRegressionError: vi.fn() }))

import { DashboardOrdersList } from '..'
import { FilterValuesProvider, useFilterValues } from '../../../ui/src/contexts/FilterValuesContext'

let initialFilters
const Defaults = () => { [initialFilters] = useFilterValues(); return null }

const Probe = () => null

const searchGroup = () => {
  const where = mocks.api.where.mock.lastCall[0]
  return where.conditions.find(group =>
    group.conector === 'OR' && group.conditions.some(condition => condition.attribute === 'external_id')
  )
}

beforeEach(() => {
  mocks.api = {
    setAccessToken: vi.fn().mockReturnThis(),
    orders: vi.fn().mockReturnThis(),
    asDashboard: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(options => {
      options.cancelToken.cancel = vi.fn()
      return Promise.resolve({
        content: {
          error: false,
          result: [],
          pagination: { current_page: 1, page_size: 10, total_pages: 0, total: 0, from: 0, to: 0 }
        }
      })
    })
  }
  render(<FilterValuesProvider><Defaults /></FilterValuesProvider>)
})

afterEach(cleanup)

const renderSearch = (searchValue) => render(
  <DashboardOrdersList
    UIComponent={Probe}
    filterValues={initialFilters}
    orderStatus={[1, 11, 15]}
    useDefualtSessionManager
    searchValue={searchValue}
    isSearchByOrderId
    isSearchByCustomerName
    isSearchByCustomerEmail
    isSearchByCustomerPhone
    isSearchByBusinessName
    isSearchByDriverName
  />
)

describe('orders list search', () => {
  it('does not search the order id when the text is not a number', async () => {
    renderSearch('katie')
    await waitFor(() => expect(mocks.api.get).toHaveBeenCalled())

    const conditions = searchGroup().conditions
    expect(conditions.some(condition => condition.attribute === 'id')).toBe(false)
    expect(conditions).toContainEqual({
      attribute: 'external_id',
      value: { condition: 'ilike', value: encodeURIComponent('%katie%') }
    })
    expect(conditions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        attribute: 'customer',
        conditions: [expect.objectContaining({ attribute: 'name' })]
      })
    ]))
  })

  it('does not search the order id when the number does not fit exactly', async () => {
    renderSearch('99999999999999999999999999990012312312312312863781263812312312')
    await waitFor(() => expect(mocks.api.get).toHaveBeenCalled())

    expect(searchGroup().conditions.some(condition => condition.attribute === 'id')).toBe(false)
  })

  it('searches a numeric id with ilike', async () => {
    renderSearch('822')
    await waitFor(() => expect(mocks.api.get).toHaveBeenCalled())

    expect(searchGroup().conditions).toContainEqual({
      attribute: 'id',
      value: { condition: 'ilike', value: encodeURIComponent('%822%') }
    })
  })
})
