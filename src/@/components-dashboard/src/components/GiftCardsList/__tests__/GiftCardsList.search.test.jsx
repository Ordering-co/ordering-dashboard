import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { GiftCardsList } from '../index'

const mocks = vi.hoisted(() => ({
  session: [{ token: 'test-token', user: { id: 7, level: 0 } }],
  api: [{ root: 'https://api.test/v400/en/demo' }]
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => mocks.api }))

let controller
const UI = (props) => {
  controller = props
  return null
}

const pagination = { current_page: 1, page_size: 10, total_pages: 1, total: 0, from: 0, to: 0 }

describe('GiftCardsList search', () => {
  let fetchMock

  beforeEach(() => {
    controller = null
    fetchMock = vi.fn(() => Promise.resolve({ json: async () => ({ error: false, result: [], pagination }) }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('matches the purchaser by name or last name', async () => {
    render(<GiftCardsList UIComponent={UI} isSearchByAuthorName />)
    await waitFor(() => expect(controller).not.toBeNull())
    await act(async () => controller.onSearch('Seis'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const url = fetchMock.mock.calls[1][0]
    const where = JSON.parse(url.split('where=')[1])
    const search = where.conditions.find(condition => condition.conector === 'OR')
    const attributes = search.conditions.map(condition => condition.conditions[0].attribute)
    expect(attributes).toEqual(['name', 'lastname'])
    expect(search.conditions[1].conditions[0].value).toEqual({ condition: 'ilike', value: encodeURI('%Seis%') })
  })
})
