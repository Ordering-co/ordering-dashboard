/* eslint-disable import/first */
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign /intelligence/reviews, drivers / customers / professionals. With a search typed, a change of tab mounted the list,
// which asked for the users WITHOUT the filter and, one render later (when the list handed the search to the controller), asked
// again WITH it. These tests mount the real UsersList controller under the real UsersReviewList and count the GETs.
const mocks = vi.hoisted(() => ({
  chain: null,
  session: { token: 'token', user: { id: 1, level: 0 } },
  ordering: { root: 'https://api.test' },
  events: { on: vi.fn(), off: vi.fn() },
  socket: { on: vi.fn(), off: vi.fn() }
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }] }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: vi.fn() }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback] }))
vi.mock('../../../../../../contexts/EventContext', () => ({ useEvent: () => [mocks.events] }))
vi.mock('../../../../../../contexts/WebsocketContext', () => ({ useWebsocket: () => mocks.socket }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))

import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { UsersReviewList } from '../../UsersReviewList'

class FakeResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

class Cancel {}

const PAGINATION = { current_page: 1, total_pages: 1, total: 1, page_size: 10, from: 1, to: 1 }
const row = (id, name) => ({ id, name, lastname: 'Ruiz', email: `${name.toLowerCase()}@example.com`, photo: null, qualification: 4, enabled: true })

// A chainable fake of the SDK builder. Every `get` is held until the test answers it; `cancel` (set by the SDK on the token) rejects it.
const makeChain = () => {
  const chain = { calls: [], pendingWhere: null }
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.parameters = vi.fn(() => chain)
  chain.where = vi.fn((where) => { chain.pendingWhere = where; return chain })
  chain.get = vi.fn((options) => new Promise((resolve, reject) => {
    const call = { where: chain.pendingWhere, token: options.cancelToken, cancelled: false }
    chain.pendingWhere = null
    options.cancelToken.cancel = () => { call.cancelled = true; reject(new Cancel()) }
    call.answer = (users) => resolve({ content: { error: false, result: users, pagination: PAGINATION } })
    chain.calls.push(call)
  }))
  return chain
}

const searched = (call, text) => JSON.stringify(call.where ?? {}).includes(encodeURI(`%${text}%`))

const list = (props) => (
  <UtilsProviders>
    <UsersReviewList
      key={props.tab}
      parentSearchValue={props.search}
      isUseQuery={false}
      paginationSettings={{ initialPage: 1, pageSize: 10, controlType: 'pages' }}
      onOpenRow={vi.fn()}
      defaultUserTypesSelected={props.types}
    />
  </UtilsProviders>
)

describe('UsersReviewList: one request per action', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    mocks.chain = makeChain()
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  })

  it('a tab opened with a search typed asks once, with the filter', async () => {
    render(list({ tab: 'drivers', types: [4], search: 'ana' }))
    await waitFor(() => expect(mocks.chain.calls).toHaveLength(1))
    // give the effects a turn: a second request would have been issued by now
    await act(async () => { await Promise.resolve() })
    expect(mocks.chain.calls).toHaveLength(1)
    expect(searched(mocks.chain.calls[0], 'ana')).toBe(true)
  })

  it('changing tab with a search typed asks once for the new tab, with the filter', async () => {
    const { rerender } = render(list({ tab: 'drivers', types: [4], search: 'ana' }))
    await waitFor(() => expect(mocks.chain.calls).toHaveLength(1))
    await act(async () => { mocks.chain.calls[0].answer([row(7, 'Ana')]) })
    await screen.findByText('Ana Ruiz')

    mocks.chain.calls.length = 0
    rerender(list({ tab: 'customers', types: [3], search: 'ana' }))
    await waitFor(() => expect(mocks.chain.calls).toHaveLength(1))
    await act(async () => { await Promise.resolve() })
    expect(mocks.chain.calls).toHaveLength(1)
    expect(searched(mocks.chain.calls[0], 'ana')).toBe(true)
    expect(mocks.chain.calls[0].where.conditions).toContainEqual({ attribute: 'level', value: [3] })
  })

  it('a search that was typed and cleared does not ask twice when a tab opens', async () => {
    render(list({ tab: 'customers', types: [3], search: '' }))
    await waitFor(() => expect(mocks.chain.calls).toHaveLength(1))
    await act(async () => { await Promise.resolve() })
    expect(mocks.chain.calls).toHaveLength(1)
    expect(searched(mocks.chain.calls[0], 'ana')).toBe(false)
  })

  it('a tab opened with no search typed asks once', async () => {
    render(list({ tab: 'professionals', types: [8], search: null }))
    await waitFor(() => expect(mocks.chain.calls).toHaveLength(1))
    await act(async () => { await Promise.resolve() })
    expect(mocks.chain.calls).toHaveLength(1)
  })

  it('typing a new search asks once more and an old answer never replaces the new one', async () => {
    const { rerender } = render(list({ tab: 'drivers', types: [4], search: null }))
    await waitFor(() => expect(mocks.chain.calls).toHaveLength(1))
    await act(async () => { mocks.chain.calls[0].answer([row(1, 'Zed')]) })
    await screen.findByText('Zed Ruiz')

    rerender(list({ tab: 'drivers', types: [4], search: 'ana' }))
    await waitFor(() => expect(mocks.chain.calls).toHaveLength(2))
    expect(searched(mocks.chain.calls[1], 'ana')).toBe(true)

    rerender(list({ tab: 'drivers', types: [4], search: 'anabel' }))
    await waitFor(() => expect(mocks.chain.calls).toHaveLength(3))
    expect(mocks.chain.calls[1].cancelled).toBe(true)
    await act(async () => { mocks.chain.calls[2].answer([row(3, 'Anabel')]) })
    await screen.findByText('Anabel Ruiz')
    expect(screen.queryByText('Ana Ruiz')).toBeNull()
  })
})
