/* eslint-disable import/first */
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign PE-B2 (PE-03, PE-14, PE-15, inventory D6 and D16): the controller of the promotions list. The UI is a stub that records the
// props the controller gives it. Nothing is ever sent: `fetch` is a mock that answers by URL and method.
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  hideToast: vi.fn(),
  fetch: vi.fn(),
  session: { token: 'token', user: { id: 1, level: 0 } },
  ordering: { root: 'https://api.test' }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast, hideToast: mocks.hideToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { EnterprisePromotionList } from '..'

const ROWS = [
  { id: 1, name: 'Alpha', enabled: true, rank: 1 },
  { id: 2, name: 'Beta', enabled: false, rank: 2 }
]

const reply = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const page = (result, extra = {}) => ({
  error: false,
  result,
  pagination: { current_page: 1, page_size: 10, total_pages: 1, total: result.length, from: 1, to: result.length, ...extra }
})

const calls = (method, match) => mocks.fetch.mock.calls.filter(([url, options]) => (
  (options?.method ?? 'GET') === method && String(url).includes(match)
))
const listCalls = () => calls('GET', '/offers?')

const bodyOf = (fetchCall) => JSON.parse(fetchCall[1].body)

// `answers`: how each kind of request is answered, so a test changes only the one it is about
let answers

const defaultAnswers = () => ({
  list: () => reply(page(ROWS.map(row => ({ ...row })))),
  post: () => reply({ error: false, result: {} }),
  delete: () => reply({ error: false, result: {} }),
  businesses: () => reply({ error: false, result: [], pagination: {} })
})

const renderList = (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<EnterprisePromotionList UIComponent={UIComponent} paginationSettings={{ initialPage: 1, pageSize: 10, controlType: 'pages' }} {...props} />)
  return ui
}

const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

describe('EnterprisePromotionList controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    answers = defaultAnswers()
    mocks.fetch.mockImplementation((url, options = {}) => {
      const method = options.method ?? 'GET'
      const target = String(url)
      if (method === 'GET' && target.includes('/offers?')) return answers.list(target)
      if (method === 'GET' && target.includes('/backoffice/businesses')) return answers.businesses(target)
      if (method === 'GET') return reply({ error: false, result: [], pagination: {} })
      if (method === 'POST') return answers.post(target, options)
      if (method === 'DELETE') return answers.delete(target, options)
      return reply({ error: false, result: {} })
    })
    global.fetch = mocks.fetch
  })
  afterEach(() => cleanup())

  describe('enable switch (PE-03)', () => {
    it('resolves { ok: true } and updates the record without mutating the one in the list', async () => {
      const ui = renderList()
      await settle()
      const before = ui.current.promotionListState.promotions[1]
      answers.post = () => reply({ error: false, result: { id: 2, enabled: true } })

      let outcome
      await act(async () => { outcome = await ui.current.handleEnablePromotion(2, true) })

      expect(outcome).toEqual({ ok: true })
      expect(calls('POST', '/offers/2')).toHaveLength(1)
      expect(bodyOf(calls('POST', '/offers/2')[0])).toEqual({ enabled: true })
      const after = ui.current.promotionListState.promotions.find(row => row.id === 2)
      expect(after.enabled).toBe(true)
      expect(after).not.toBe(before)
      expect(before.enabled).toBe(false) // the record that was in the list is not touched
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Changes saved')
    })

    it('resolves { ok: false, error } on an API error, leaves the record as it was and replaces the Loading toast', async () => {
      const ui = renderList()
      await settle()
      const before = ui.current.promotionListState.promotions[1]
      answers.post = () => reply({ error: true, result: ['Not allowed'] })

      let outcome
      await act(async () => { outcome = await ui.current.handleEnablePromotion(2, true) })

      expect(outcome.ok).toBe(false)
      expect(outcome.error).toEqual(['Not allowed'])
      expect(ui.current.promotionListState.promotions[1]).toBe(before)
      expect(mocks.showToast).toHaveBeenLastCalledWith('ERROR', 'Not allowed')
    })

    it('resolves { ok: false, error } when the request throws', async () => {
      const ui = renderList()
      await settle()
      answers.post = () => Promise.reject(new Error('Network down'))

      let outcome
      await act(async () => { outcome = await ui.current.handleEnablePromotion(1, false) })

      expect(outcome).toEqual({ ok: false, error: ['Network down'] })
      expect(ui.current.promotionListState.promotions[0].enabled).toBe(true)
      expect(mocks.showToast).toHaveBeenLastCalledWith('ERROR', 'Network down')
    })
  })

  describe('priority by drag (PE-14, inventory D16)', () => {
    const dropEvent = (transferId) => ({ preventDefault: vi.fn(), dataTransfer: { getData: () => String(transferId) } })

    it('a drop still sends POST offers/:id { rank } with the rank of the row it lands on', async () => {
      const ui = renderList()
      await settle()
      await act(async () => { ui.current.handleDrop(dropEvent(1), ui.current.promotionListState.promotions[1]) })
      await settle()

      const posts = calls('POST', '/offers/1')
      expect(posts).toHaveLength(1)
      expect(bodyOf(posts[0])).toEqual({ rank: 2 })
    })

    it('a drop with both ranks null sends rank 1', async () => {
      answers.list = () => reply(page([{ id: 1, name: 'Alpha', rank: null }, { id: 2, name: 'Beta', rank: null }]))
      const ui = renderList()
      await settle()
      await act(async () => { ui.current.handleDrop(dropEvent(1), ui.current.promotionListState.promotions[1]) })
      await settle()

      expect(bodyOf(calls('POST', '/offers/1')[0])).toEqual({ rank: 1 })
    })

    it('on success it says «Priority updated» and asks for the current page again so every row shows its rank', async () => {
      const ui = renderList()
      await settle()
      expect(listCalls()).toHaveLength(1)
      answers.post = () => reply({ error: false, result: { id: 1, rank: 2 } })
      answers.list = () => reply(page([{ id: 2, name: 'Beta', enabled: false, rank: 1 }, { id: 1, name: 'Alpha', enabled: true, rank: 2 }]))

      let outcome
      await act(async () => { outcome = await ui.current.handleChangeCategoryRank(1, { rank: 2 }) })

      expect(outcome).toEqual({ ok: true })
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Priority updated')
      expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Category updated')
      expect(listCalls()).toHaveLength(2)
      expect(listCalls()[1][0]).toContain('page=1&page_size=10')
      expect(ui.current.promotionListState.promotions.map(row => [row.id, row.rank])).toEqual([[2, 1], [1, 2]])
    })

    it('on an API error it resolves { ok: false, error }, does not re-fetch and replaces the Loading toast', async () => {
      const ui = renderList()
      await settle()
      answers.post = () => reply({ error: true, result: ['Rank not valid'] })

      let outcome
      await act(async () => { outcome = await ui.current.handleChangeCategoryRank(1, { rank: 2 }) })

      expect(outcome.ok).toBe(false)
      expect(outcome.error).toEqual(['Rank not valid'])
      expect(listCalls()).toHaveLength(1)
      expect(mocks.showToast).toHaveBeenLastCalledWith('ERROR', 'Rank not valid')
    })
  })

  describe('delete from the list (PE-07)', () => {
    it('sends DELETE offers/:id, takes the record out, asks for the page again and says «Offer deleted»', async () => {
      const ui = renderList()
      await settle()
      answers.list = () => reply(page([{ id: 2, name: 'Beta', rank: 2 }]))

      let outcome
      await act(async () => { outcome = await ui.current.handleDeletePromotionFromList(ui.current.promotionListState.promotions[0]) })

      expect(outcome).toEqual({ ok: true })
      expect(calls('DELETE', '/offers/1')).toHaveLength(1)
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Offer deleted')
      expect(listCalls()).toHaveLength(2)
      expect(ui.current.promotionListState.promotions.map(row => row.id)).toEqual([2])
      expect(ui.current.paginationProps.totalItems).toBe(1)
    })

    it('goes to the previous page when the deleted record was the only one of the last page', async () => {
      answers.list = () => reply(page([{ id: 3, name: 'Gamma', rank: 1 }], { current_page: 2, total_pages: 2, total: 11, from: 11, to: 11 }))
      const ui = renderList({ paginationSettings: { initialPage: 2, pageSize: 10, controlType: 'pages' } })
      await settle()
      expect(ui.current.paginationProps.currentPage).toBe(2)
      answers.list = () => reply(page([{ id: 9, name: 'Previous page', rank: 1 }], { current_page: 1, total_pages: 1, total: 10 }))

      await act(async () => { await ui.current.handleDeletePromotionFromList({ id: 3, name: 'Gamma' }) })
      await settle()

      expect(listCalls().pop()[0]).toContain('page=1&page_size=10')
    })

    it('resolves { ok: false, error } on an API error and keeps the list', async () => {
      const ui = renderList()
      await settle()
      answers.delete = () => reply({ error: true, result: ['This offer is in use'] })

      let outcome
      await act(async () => { outcome = await ui.current.handleDeletePromotionFromList(ui.current.promotionListState.promotions[0]) })

      expect(outcome).toEqual({ ok: false, error: ['This offer is in use'] })
      expect(ui.current.promotionListState.promotions.map(row => row.id)).toEqual([1, 2])
      expect(listCalls()).toHaveLength(1)
    })

    // redesign (row 81, review r1 R10): a failed delete left the «Loading» toast on screen (the toggle and the drag replace it)
    it('takes the «Loading» toast down when the delete fails, by an API error or by a throw', async () => {
      const ui = renderList()
      await settle()
      mocks.hideToast.mockClear()
      answers.delete = () => reply({ error: true, result: ['This offer is in use'] })
      await act(async () => { await ui.current.handleDeletePromotionFromList(ui.current.promotionListState.promotions[0]) })
      expect(mocks.showToast).toHaveBeenCalledWith('INFO', 'Loading')
      expect(mocks.hideToast).toHaveBeenCalledTimes(1)

      answers.delete = () => Promise.reject(new Error('Network down'))
      await act(async () => { await ui.current.handleDeletePromotionFromList({ id: 1, name: 'Alpha' }) })
      expect(mocks.hideToast).toHaveBeenCalledTimes(2)
    })

    it('does not take a toast down when the delete works', async () => {
      const ui = renderList()
      await settle()
      mocks.hideToast.mockClear()
      await act(async () => { await ui.current.handleDeletePromotionFromList(ui.current.promotionListState.promotions[0]) })
      expect(mocks.hideToast).not.toHaveBeenCalled()
    })

    it('resolves { ok: false, error } when the request throws', async () => {
      const ui = renderList()
      await settle()
      answers.delete = () => Promise.reject(new Error('Network down'))

      let outcome
      await act(async () => { outcome = await ui.current.handleDeletePromotionFromList({ id: 1, name: 'Alpha' }) })

      expect(outcome).toEqual({ ok: false, error: ['Network down'] })
    })
  })

  describe('totals (inventory D16)', () => {
    it('adding and deleting from the editor change totalItems, the field the pager reads', async () => {
      const ui = renderList()
      await settle()
      expect(ui.current.paginationProps.totalItems).toBe(2)

      act(() => { ui.current.handleSuccessAddPromotion({ id: 3, name: 'Gamma', rank: 3 }) })
      expect(ui.current.paginationProps.totalItems).toBe(3)
      expect(ui.current.paginationProps.to).toBe(3)

      act(() => { ui.current.handleSuccessDeletePromotion(3) })
      expect(ui.current.paginationProps.totalItems).toBe(2)
    })
  })

  describe('search while a request is in flight (inventory D6)', () => {
    it('applies the latest search after the current request finishes instead of dropping it', async () => {
      let release
      answers.list = () => new Promise(resolve => { release = () => resolve({ json: () => Promise.resolve(page(ROWS)) }) })
      const ui = renderList({ isSearchByPromotionName: true, isSearchByPromotionDescription: true })
      await settle()
      expect(ui.current.promotionListState.loading).toBe(true)
      expect(listCalls()).toHaveLength(1)

      act(() => { ui.current.onSearch('summer') })
      act(() => { ui.current.onSearch('summer sale') })
      expect(listCalls()).toHaveLength(1) // nothing goes while the first one is out

      answers.list = () => reply(page([ROWS[0]]))
      await act(async () => { release() })
      await settle()

      expect(listCalls()).toHaveLength(2)
      const url = decodeURIComponent(listCalls()[1][0])
      expect(url).toContain('%summer sale%')
      expect(url).toContain('page=1&page_size=10')
      expect(ui.current.promotionListState.promotions.map(row => row.id)).toEqual([1])
    })
  })

  // owner decision 14 B: «Select all» of the editor reads EVERY business of the project (or every match of the search),
  // not the loaded page. Ids only, at the API maximum of 50 per page, with the same filter as the paged list.
  describe('getAllBusinessIds (owner decision 14 B)', () => {
    const businessesPage = (total, url) => {
      const query = new URL(url).searchParams
      const current = Number(query.get('page'))
      const size = Number(query.get('page_size'))
      const first = (current - 1) * size
      const result = Array.from({ length: Math.max(0, Math.min(size, total - first)) }, (_, index) => ({ id: first + index + 1 }))
      return reply({ error: false, result, pagination: { current_page: current, page_size: size, total_pages: Math.ceil(total / size), total } })
    }
    const idCalls = () => calls('GET', '/backoffice/businesses').filter(([url]) => new URL(url).searchParams.get('params') === 'id')

    afterEach(() => {
      mocks.session.user.level = 0
      delete mocks.ordering.setAccessToken
    })

    it('without a search reads every page (ids only, 50 per page, no filter) and answers every id', async () => {
      answers.businesses = (url) => businessesPage(120, url)
      const ui = renderList()
      await settle()

      let ids
      await act(async () => { ids = await ui.current.getAllBusinessIds() })

      expect(ids).toEqual(Array.from({ length: 120 }, (_, index) => index + 1))
      const urls = idCalls().map(([url]) => new URL(url))
      expect(urls.map(url => url.searchParams.get('page')).sort()).toEqual(['1', '2', '3'])
      expect(urls.every(url => url.searchParams.get('page_size') === '50')).toBe(true)
      expect(urls.every(url => !url.searchParams.has('where'))).toBe(true)
    })

    it('with a search it sends the same name filter as the paged list and answers only what the search finds', async () => {
      answers.businesses = (url) => businessesPage(new URL(url).searchParams.has('where') ? 7 : 120, url)
      const ui = renderList()
      await settle()
      await act(async () => { ui.current.searchBusinesses('  Pizza ') })
      await settle()

      let ids
      await act(async () => { ids = await ui.current.getAllBusinessIds() })

      expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7])
      expect(idCalls()[0][0]).toContain('%25Pizza%25') // encoded exactly like the paged list's filter
      const where = JSON.parse(new URL(idCalls()[0][0]).searchParams.get('where'))
      expect(where).toEqual({ conditions: [{ attribute: 'name', value: { condition: 'ilike', value: '%Pizza%' } }], conector: 'AND' })
    })

    it('rejects when a page fails, so the caller can keep the selection it had', async () => {
      answers.businesses = (url) => (new URL(url).searchParams.get('params') === 'id' && new URL(url).searchParams.get('page') === '2'
        ? reply({ error: true, result: ['Businesses unavailable'] })
        : businessesPage(120, url))
      const ui = renderList()
      await settle()

      await expect(ui.current.getAllBusinessIds()).rejects.toThrow('Businesses unavailable')
    })

    it('reads the same way through the SDK for the other user levels (same filter semantics, ids only)', async () => {
      mocks.session.user.level = 2
      const chain = {}
      chain.businesses = vi.fn(() => chain)
      chain.select = vi.fn(() => chain)
      chain.asDashboard = vi.fn(() => chain)
      chain.where = vi.fn(() => chain)
      chain.get = vi.fn(async ({ query }) => {
        const body = await (await businessesPage(120, `https://api.test/x?page=${query.page}&page_size=${query.page_size}`)).json()
        return { content: body }
      })
      mocks.ordering.setAccessToken = vi.fn(() => chain)
      const ui = renderList()
      await settle()
      await act(async () => { ui.current.searchBusinesses('Pizza') })
      await settle()
      chain.select.mockClear()
      chain.where.mockClear()
      chain.get.mockClear()

      let ids
      await act(async () => { ids = await ui.current.getAllBusinessIds() })

      expect(ids).toEqual(Array.from({ length: 120 }, (_, index) => index + 1))
      expect(chain.select).toHaveBeenCalledWith(['id'])
      expect(chain.where).toHaveBeenCalledWith({ conditions: [{ attribute: 'name', value: { condition: 'ilike', value: encodeURI('%Pizza%') } }], conector: 'AND' })
      expect(chain.get.mock.calls.map(([options]) => options.query.page).sort()).toEqual([1, 2, 3])
      expect(chain.get.mock.calls.every(([options]) => options.query.page_size === 50)).toBe(true)
    })
  })

  describe('list errors (PE-15)', () => {
    it('keeps the error in the state and lets getPromotions try again', async () => {
      answers.list = () => reply({ error: true, result: ['Offers are not available'] })
      const ui = renderList()
      await settle()
      expect(ui.current.promotionListState.error).toEqual(['Offers are not available'])

      answers.list = () => reply(page(ROWS))
      await act(async () => { await ui.current.getPromotions(1, 10) })
      expect(ui.current.promotionListState.error).toBe(null)
      expect(ui.current.promotionListState.promotions).toHaveLength(2)
    })
  })
})
