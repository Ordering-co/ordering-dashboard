/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// redesign AB-B1 (M-AB13, M-AB21): outcomes instead of silence, item delete without an echoed type, banner without items
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'token', user: { level: 0 } },
  ordering: { root: 'https://api.test' },
  fetch: null,
  response: null,
  pageBusinesses: null
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { BannerDetails } from '..'

const json = (body) => ({ json: async () => body })

// Business list (mount) is always fine; every other request answers with mocks.response().
const route = async (url, options = {}) => {
  if (url.includes('/backoffice/businesses')) return json({ error: false, result: mocks.pageBusinesses ?? [], pagination: { current_page: 1 } })
  return mocks.response(url, options)
}

const image = { id: 10, type: 'image', file: 'a.png' }
const video = { id: 11, type: 'video', file: 'b.mp4' }
const makeBanner = () => ({ id: 1, position: 'web_home_page', enabled: true, items: [image, video], sites: [], business: [] })

const renderDetails = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const banner = props.banner ?? makeBanner()
  render(<BannerDetails UIComponent={UIComponent} {...props} banner={banner} />)
  if (Object.keys(banner).length === 0) {
    await waitFor(() => expect(ui.current.isAddMode).toBe(true))
  } else {
    await waitFor(() => expect(ui.current.bannerState.banner.id).toBe(banner.id))
  }
  return ui
}

describe('BannerDetails (AB-B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.response = vi.fn(async () => json({ error: false, result: {} }))
    mocks.fetch = vi.fn(route)
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('handleUpdateClick', () => {
    it('resolves { ok: true, error: null, result } and keeps the success path', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: { id: 1, enabled: false } }))
      const handleSuccessUpdate = vi.fn()
      const ui = await renderDetails({ handleSuccessUpdate })
      let outcome
      await act(async () => { outcome = await ui.current.handleUpdateClick({ enabled: false }) })
      expect(outcome).toEqual({ ok: true, error: null, result: { id: 1, enabled: false } })
      expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: 1, enabled: false })
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Banner saved')
      expect(ui.current.actionState).toEqual({ loading: false, error: null })
    })

    it('resolves { ok: false, error } on an API error and on a throw', async () => {
      mocks.response = vi.fn(async () => json({ error: true, result: ['Nope'] }))
      const ui = await renderDetails()
      let outcome
      await act(async () => { outcome = await ui.current.handleUpdateClick({ enabled: false }) })
      expect(outcome).toEqual({ ok: false, error: ['Nope'] })
      expect(ui.current.actionState).toEqual({ loading: false, error: ['Nope'] })

      mocks.response = vi.fn(async () => { throw new Error('Network down') })
      await act(async () => { outcome = await ui.current.handleUpdateClick({ enabled: false }) })
      expect(outcome).toEqual({ ok: false, error: 'Network down' })
      expect(ui.current.actionState).toEqual({ loading: false, error: 'Network down' })
    })
  })

  describe('handleAddBanner', () => {
    it('resolves the outcome, then calls handleSuccessAdd with enabled: true and onClose', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: { id: 7, position: 'web_home_page' } }))
      const handleSuccessAdd = vi.fn()
      const onClose = vi.fn()
      const ui = await renderDetails({ banner: {}, defaultPosition: 'web_home_page', handleSuccessAdd, onClose })
      let outcome
      await act(async () => { outcome = await ui.current.handleAddBanner() })
      expect(outcome).toEqual({ ok: true, error: null, result: { id: 7, position: 'web_home_page' } })
      expect(handleSuccessAdd).toHaveBeenCalledWith({ id: 7, position: 'web_home_page', enabled: true })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Banner added')
    })

    it('resolves { ok: false, error } and does not close on an API error or a throw', async () => {
      mocks.response = vi.fn(async () => json({ error: true, result: ['Invalid'] }))
      const handleSuccessAdd = vi.fn()
      const onClose = vi.fn()
      const ui = await renderDetails({ banner: {}, defaultPosition: 'web_home_page', handleSuccessAdd, onClose })
      let outcome
      await act(async () => { outcome = await ui.current.handleAddBanner() })
      expect(outcome).toEqual({ ok: false, error: ['Invalid'] })
      mocks.response = vi.fn(async () => { throw new Error('Network down') })
      await act(async () => { outcome = await ui.current.handleAddBanner() })
      expect(outcome).toEqual({ ok: false, error: 'Network down' })
      expect(handleSuccessAdd).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('handleDeleteBanner', () => {
    it('resolves the outcome, then calls handleSuccessDelete and onClose', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: { id: 1 } }))
      const handleSuccessDelete = vi.fn()
      const onClose = vi.fn()
      const ui = await renderDetails({ handleSuccessDelete, onClose })
      let outcome
      await act(async () => { outcome = await ui.current.handleDeleteBanner() })
      expect(outcome).toEqual({ ok: true, error: null, result: { id: 1 } })
      expect(handleSuccessDelete).toHaveBeenCalledWith(1)
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Banner deleted')
    })

    it('resolves { ok: false, error } and does not close on an API error or a throw', async () => {
      mocks.response = vi.fn(async () => json({ error: true, result: ['Locked'] }))
      const handleSuccessDelete = vi.fn()
      const onClose = vi.fn()
      const ui = await renderDetails({ handleSuccessDelete, onClose })
      let outcome
      await act(async () => { outcome = await ui.current.handleDeleteBanner() })
      expect(outcome).toEqual({ ok: false, error: ['Locked'] })
      mocks.response = vi.fn(async () => { throw new Error('Network down') })
      await act(async () => { outcome = await ui.current.handleDeleteBanner() })
      expect(outcome).toEqual({ ok: false, error: 'Network down' })
      expect(handleSuccessDelete).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('handleDeleteBannerItem', () => {
    it('removes the item although the response carries no type, and sends { ...banner, items } up', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: {} }))
      const handleSuccessUpdate = vi.fn()
      const banner = makeBanner()
      const ui = await renderDetails({ banner, handleSuccessUpdate })
      let outcome
      await act(async () => { outcome = await ui.current.handleDeleteBannerItem(10) })
      expect(outcome).toEqual({ ok: true, error: null, result: {} })
      expect(ui.current.bannerItemsState.items.map(item => item.id)).toEqual([11])
      expect(ui.current.bannerItemsState.images).toEqual([])
      expect(ui.current.bannerItemsState.videos.map(item => item.id)).toEqual([11])
      expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...banner, items: [video] })
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Banner item deleted')
    })

    it('removes a video item whatever the echoed type says', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: { type: 'image' } }))
      const ui = await renderDetails()
      await act(async () => { await ui.current.handleDeleteBannerItem(11) })
      expect(ui.current.bannerItemsState.items.map(item => item.id)).toEqual([10])
      expect(ui.current.bannerItemsState.videos).toEqual([])
      expect(ui.current.bannerItemsState.images.map(item => item.id)).toEqual([10])
    })

    it('resolves { ok: false, error } and keeps the items on an API error or a throw', async () => {
      mocks.response = vi.fn(async () => json({ error: true, result: ['Nope'] }))
      const handleSuccessUpdate = vi.fn()
      const ui = await renderDetails({ handleSuccessUpdate })
      let outcome
      await act(async () => { outcome = await ui.current.handleDeleteBannerItem(10) })
      expect(outcome).toEqual({ ok: false, error: ['Nope'] })
      mocks.response = vi.fn(async () => { throw new Error('Network down') })
      await act(async () => { outcome = await ui.current.handleDeleteBannerItem(10) })
      expect(outcome).toEqual({ ok: false, error: ['Network down'] })
      expect(ui.current.bannerItemsState.items).toHaveLength(2)
      expect(handleSuccessUpdate).not.toHaveBeenCalled()
    })
  })

  describe('banner without items, sites or business (M-AB21)', () => {
    it('does not throw and starts with empty lists', async () => {
      const ui = await renderDetails({ banner: { id: 3, position: 'app_home_page' } })
      expect(ui.current.bannerItemsState.items).toEqual([])
      expect(ui.current.bannerItemsState.images).toEqual([])
      expect(ui.current.bannerItemsState.videos).toEqual([])
      expect(ui.current.selectedSitesIds).toEqual([])
      expect(ui.current.selectedBusinessIds).toEqual([])
      expect(ui.current.isAddMode).toBe(false)
    })
  })

  // redesign AB-R1 (review r1 #1, #2): the host passes the list row, which becomes a NEW object on every update of the same banner
  describe('updates of the same banner (AB-R1)', () => {
    const Host = ({ banner, UIComponent, ...rest }) => <BannerDetails UIComponent={UIComponent} banner={banner} {...rest} />

    it('keeps an unsaved business selection when the same banner comes back as a new object', async () => {
      const ui = { current: null }
      const UIComponent = (uiProps) => { ui.current = uiProps; return null }
      const first = { ...makeBanner(), position: 'web_business_page', business: [{ id: 5 }, { id: 6 }] }
      const { rerender } = render(<Host UIComponent={UIComponent} banner={first} />)
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([5, 6]))
      act(() => { ui.current.handleSelectBusiness(7, true) })
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([5, 6, 7]))
      const updated = { ...first, enabled: false, items: [image] }
      rerender(<Host UIComponent={UIComponent} banner={updated} />)
      await waitFor(() => expect(ui.current.bannerItemsState.items).toEqual([image]))
      expect(ui.current.selectedBusinessIds).toEqual([5, 6, 7])
      expect(ui.current.bannerState.banner.enabled).toBe(false)
    })

    it('resets the selection when another banner opens', async () => {
      const ui = { current: null }
      const UIComponent = (uiProps) => { ui.current = uiProps; return null }
      const first = { ...makeBanner(), business: [{ id: 5 }] }
      const { rerender } = render(<Host UIComponent={UIComponent} banner={first} />)
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([5]))
      act(() => { ui.current.handleSelectBusiness(7, true) })
      rerender(<Host UIComponent={UIComponent} banner={{ ...makeBanner(), id: 2, business: [{ id: 9 }] }} />)
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([9]))
    })

    it('sends up the businesses it saved when the API answer has no business list', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: { id: 1, name: 'A' } }))
      const handleSuccessUpdate = vi.fn()
      const ui = await renderDetails({ handleSuccessUpdate })
      await act(async () => { await ui.current.handleUpdateClick({ businesses: [3, 4] }) })
      expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: 1, name: 'A', business: [{ id: 3 }, { id: 4 }] })
    })

    it('keeps the API business list when it has one', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: { id: 1, business: [{ id: 3, name: 'X' }] } }))
      const handleSuccessUpdate = vi.fn()
      const ui = await renderDetails({ handleSuccessUpdate })
      await act(async () => { await ui.current.handleUpdateClick({ businesses: [3] }) })
      expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: 1, business: [{ id: 3, name: 'X' }] })
    })
  })
  // redesign (row 49, M-AB20): a business search with &, # or % reaches the API as typed
  describe('business search encoding (M-AB20)', () => {
    const businessUrls = () => mocks.fetch.mock.calls.map(([url]) => url).filter(url => url.includes('/backoffice/businesses'))

    it('level 0: the where query survives & # % and carries the typed text', async () => {
      const ui = await renderDetails()
      await act(async () => { ui.current.searchBusinesses('a&b#c%') })
      const url = businessUrls().pop()
      expect(url).not.toContain('#')
      const query = new URL(url).searchParams
      expect(query.get('page')).toBe('1')
      expect(query.get('page_size')).toBe('10')
      expect(JSON.parse(query.get('where')).conditions[1].value).toEqual({ condition: 'ilike', value: '%a&b#c%%' })
    })

    it('other levels: the SDK where() gets the text encoded once, as the SDK does not encode', async () => {
      const where = vi.fn()
      const chain = { asDashboard: () => chain, select: () => chain, where: (value) => { where(value); return chain }, get: async () => ({ content: { error: false, result: [], pagination: {} } }) }
      mocks.ordering.businesses = () => chain
      mocks.session.user = { level: 2 }
      try {
        const ui = await renderDetails()
        await act(async () => { ui.current.searchBusinesses('a&b#c%') })
        const { conditions } = where.mock.calls.pop()[0]
        expect(conditions[1].value).toEqual({ condition: 'ilike', value: '%25a%26b%23c%25%25' })
      } finally {
        mocks.session.user = { level: 0 }
        delete mocks.ordering.businesses
      }
    })
  })

  // redesign (row 41, P-3): «Select all businesses» reads every enabled business that matches the search in ONE request
  // without `page` (the list answers 10 per page, but without `page` it answers them all) and selects them across the pages
  describe('select every business (row 41)', () => {
    const ids = (count) => Array.from({ length: count }, (_, index) => ({ id: index + 1 }))
    // every `ordering.businesses()` is a new chain, as in the SDK; the page reads (they carry `query`) get an empty list and are not
    // recorded: `calls` holds only the reads of ids that carry no query at all
    const withSdk = async (level, run, answer = async () => ({ content: { error: false, result: ids(35) } })) => {
      const calls = { select: [], where: [], get: [] }
      mocks.ordering.businesses = () => {
        const seen = { select: null, where: null }
        const chain = {
          asDashboard: () => chain,
          select: (value) => { seen.select = value; return chain },
          where: (value) => { seen.where = value; return chain },
          get: async (...args) => {
            if (args[0]?.query) return { content: { error: false, result: [], pagination: {} } }
            calls.select.push(seen.select)
            calls.where.push(seen.where)
            calls.get.push(args)
            return answer()
          }
        }
        return chain
      }
      mocks.session.user = { level }
      try {
        await run(calls)
      } finally {
        mocks.session.user = { level: 0 }
        delete mocks.ordering.businesses
      }
    }

    it.each([0, 2])('level %i: selects all 35 ids with one read of ids, no page, enabled only', async (level) => {
      await withSdk(level, async (calls) => {
        const ui = await renderDetails({ banner: { ...makeBanner(), business: [{ id: 5 }] } })
        let outcome
        await act(async () => { outcome = await ui.current.handleSelectEveryBusiness() })
        expect(outcome).toEqual({ ok: true, error: null, count: 35 })
        expect(calls.select).toEqual([['id']])
        expect(calls.where).toEqual([{ conditions: [{ attribute: 'enabled', value: true }], conector: 'AND' }])
        expect(calls.get).toHaveLength(1)
        // no `page` / `page_size` in the query: that is what makes the API answer every business
        expect(JSON.stringify(calls.get[0])).not.toMatch(/page/)
        expect(ui.current.selectedBusinessIds).toHaveLength(35)
        expect(ui.current.selectedBusinessIds).toEqual(expect.arrayContaining([1, 5, 35]))
        expect(JSON.parse(ui.current.changesState.business)).toHaveLength(35)
      })
    })

    it('keeps what was already selected (a business that is not in the answer stays) and does not repeat ids', async () => {
      await withSdk(2, async () => {
        const ui = await renderDetails({ banner: { ...makeBanner(), business: [{ id: 3 }, { id: 99 }] } })
        await act(async () => { await ui.current.handleSelectEveryBusiness() })
        expect(ui.current.selectedBusinessIds).toHaveLength(36)
        expect(ui.current.selectedBusinessIds.filter(id => id === 3)).toHaveLength(1)
        expect(ui.current.selectedBusinessIds).toContain(99)
      })
    })

    it('honours the current search: the text goes in the where, encoded once as the list does', async () => {
      await withSdk(2, async (calls) => {
        const ui = await renderDetails()
        await act(async () => { ui.current.searchBusinesses(' a&b ') })
        await act(async () => { await ui.current.handleSelectEveryBusiness() })
        expect(calls.where.pop()).toEqual({
          conditions: [
            { attribute: 'enabled', value: true },
            { attribute: 'name', value: { condition: 'ilike', value: '%25a%26b%25' } }
          ],
          conector: 'AND'
        })
      })
    })

    it('an API error is returned, nothing is selected and nothing is lost', async () => {
      await withSdk(2, async () => {
        const ui = await renderDetails({ banner: { ...makeBanner(), business: [{ id: 5 }] } })
        let outcome
        await act(async () => { outcome = await ui.current.handleSelectEveryBusiness() })
        expect(outcome).toEqual({ ok: false, error: ['Not allowed'] })
        expect(ui.current.selectedBusinessIds).toEqual([5])
      }, async () => ({ content: { error: true, result: ['Not allowed'] } }))
    })

    it('a throw is returned with its message and nothing is selected', async () => {
      await withSdk(0, async () => {
        const ui = await renderDetails()
        let outcome
        await act(async () => { outcome = await ui.current.handleSelectEveryBusiness() })
        expect(outcome).toEqual({ ok: false, error: ['Network down'] })
        expect(ui.current.selectedBusinessIds).toEqual([])
      }, async () => { throw new Error('Network down') })
    })

    it('an answer that is not a list is an error, not an empty selection', async () => {
      await withSdk(2, async () => {
        const ui = await renderDetails()
        let outcome
        await act(async () => { outcome = await ui.current.handleSelectEveryBusiness() })
        expect(outcome.ok).toBe(false)
        expect(ui.current.selectedBusinessIds).toEqual([])
      }, async () => ({ content: { error: false, result: null } }))
    })

    it('an answer that arrives after the search changed is not applied (it was for another search)', async () => {
      let release
      await withSdk(2, async () => {
        const ui = await renderDetails()
        let pending
        act(() => { pending = ui.current.handleSelectEveryBusiness() })
        await act(async () => { ui.current.searchBusinesses('pizza') })
        let outcome
        await act(async () => { release(); outcome = await pending })
        expect(outcome).toEqual({ ok: true, error: null, stale: true })
        expect(ui.current.selectedBusinessIds).toEqual([])
      }, () => new Promise(resolve => { release = () => resolve({ content: { error: false, result: ids(35) } }) }))
    })

    it('an empty answer is a success with count 0 and leaves the selection as it was', async () => {
      await withSdk(2, async () => {
        const ui = await renderDetails({ banner: { ...makeBanner(), business: [{ id: 5 }] } })
        let outcome
        await act(async () => { outcome = await ui.current.handleSelectEveryBusiness() })
        expect(outcome).toEqual({ ok: true, error: null, count: 0 })
        expect(ui.current.selectedBusinessIds).toEqual([5])
      }, async () => ({ content: { error: false, result: [] } }))
    })

    it('saving an existing banner then sends every id', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: { id: 1 } }))
      await withSdk(2, async () => {
        const ui = await renderDetails({ banner: { ...makeBanner(), business: [{ id: 5 }] } })
        await act(async () => { await ui.current.handleSelectEveryBusiness() })
        await act(async () => { await ui.current.handleUpdateClick({ businesses: ui.current.selectedBusinessIds }) })
        const put = mocks.fetch.mock.calls.find(([, options]) => options?.method === 'PUT')
        expect(JSON.parse(put[1].body).businesses).toHaveLength(35)
      })
    })

    it('creating a «Business page» banner sends every id', async () => {
      mocks.response = vi.fn(async () => json({ error: false, result: { id: 8, position: 'web_business_page' } }))
      await withSdk(2, async () => {
        const ui = await renderDetails({ banner: {}, defaultPosition: 'web_business_page', handleSuccessAdd: vi.fn(), onClose: vi.fn() })
        await act(async () => { await ui.current.handleSelectEveryBusiness() })
        await act(async () => { await ui.current.handleAddBanner() })
        const post = mocks.fetch.mock.calls.find(([, options]) => options?.method === 'POST')
        expect(JSON.parse(post[1].body).businesses).toHaveLength(35)
      })
    })
  })

  // redesign (row 49, M-AB23): a second update before the next render no longer drops the first
  // redesign (row 41, review F-2): with «Select all businesses» a selection spans pages, so the page buttons of the new list
  // ask for `pageOnly` and touch the visible page only; without it (the legacy editor) they keep main's replace and clear
  describe('the page buttons act on the page only (row 41, review F-2)', () => {
    afterEach(() => { mocks.pageBusinesses = null })

    it('pageOnly: «all» adds the page to the selection and «none» takes only the page out; without it, as main', async () => {
      mocks.pageBusinesses = [{ id: 1 }, { id: 2 }]
      const ui = await renderDetails({ banner: { ...makeBanner(), business: [{ id: 9 }] } })
      await waitFor(() => expect(ui.current.businessList.businesses.map(business => business.id)).toEqual([1, 2]))
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([9]))
      act(() => { ui.current.handleSelectAllBusiness(true, { pageOnly: true }) })
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([9, 1, 2]))
      expect(ui.current.changesState.business).toBe('[9,1,2]')
      act(() => { ui.current.handleSelectAllBusiness(false, { pageOnly: true }) })
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([9]))
      act(() => { ui.current.handleSelectAllBusiness(true) })
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([1, 2]))
      act(() => { ui.current.handleSelectAllBusiness(false) })
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([]))
    })
  })

  describe('lost updates (M-AB23)', () => {
    it('two business ticks before a render keep both', async () => {
      const ui = await renderDetails()
      act(() => {
        ui.current.handleSelectBusiness(7, true)
        ui.current.handleSelectBusiness(8, true)
      })
      await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([7, 8]))
      expect(ui.current.changesState.business).toBe('[7,8]')
    })

    it('two site ticks before a render keep both', async () => {
      const ui = await renderDetails()
      act(() => {
        ui.current.handleSelectSite(true, 1)
        ui.current.handleSelectSite(true, 2)
      })
      await waitFor(() => expect(ui.current.selectedSitesIds).toEqual([1, 2]))
      expect(ui.current.changesState.changes.sites).toEqual([1, 2])
    })

    it('two item uploads in flight keep both items and send up a banner with both', async () => {
      const added = [{ id: 20, type: 'image', file: 'x.png' }, { id: 21, type: 'image', file: 'y.png' }]
      mocks.response = vi.fn(async (_url, options) => json({ error: false, result: added[JSON.parse(options.body).n] }))
      const handleSuccessUpdate = vi.fn()
      const ui = await renderDetails({ handleSuccessUpdate, banner: { ...makeBanner(), items: [] } })
      await act(async () => {
        await Promise.all([ui.current.handleAddBannerItem({ n: 0 }), ui.current.handleAddBannerItem({ n: 1 })])
      })
      expect(ui.current.bannerItemsState.items.map(item => item.id)).toEqual([20, 21])
      expect(ui.current.bannerItemsState.images.map(item => item.id)).toEqual([20, 21])
      expect(handleSuccessUpdate.mock.calls.pop()[0].items.map(item => item.id)).toEqual([20, 21])
    })

    it('an item added right after another one by the dialog (handleSuccessBannerItemAdd) keeps both', async () => {
      const handleSuccessUpdate = vi.fn()
      const ui = await renderDetails({ handleSuccessUpdate, banner: { ...makeBanner(), items: [] } })
      act(() => {
        ui.current.handleSuccessBannerItemAdd({ id: 30, type: 'image' })
        ui.current.handleSuccessBannerItemAdd({ id: 31, type: 'video' })
      })
      await waitFor(() => expect(ui.current.bannerItemsState.items.map(item => item.id)).toEqual([30, 31]))
      expect(handleSuccessUpdate.mock.calls.pop()[0].items.map(item => item.id)).toEqual([30, 31])
    })
  })
})
