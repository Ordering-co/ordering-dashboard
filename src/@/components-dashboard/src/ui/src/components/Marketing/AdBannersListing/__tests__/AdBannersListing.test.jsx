/* eslint-disable import/first */
// redesign AB-B5 (decision 1; defects M-AB05, M-AB06, M-AB10, M-AB11, M-AB17; auditor findings 4, 5 and 8): the ad banners page. The two
// controllers (K/AdBannersList and K/BannerDetails) are the REAL ones, over a mocked `fetch`, so what is tested is what the page really
// does with them: one GET for every position, the merge of an update into the list, the row and the panel showing the same value.
// The header, the grouped sections, the panel, the SplitView and the dialogs are real too. Only the image dialog (AB-B4, it mounts a
// third controller) is a stub that records its props. Nothing is ever sent: `fetch` is a spy.
import React from 'react'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  phone: false,
  showToast: vi.fn(),
  fetch: null,
  put: null,
  post: null,
  del: null,
  list: null,
  dialogProps: null
}))
const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'token', user: { id: 1, level: 0 } }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { AdBannersList } = await import('../../../../../../components/AdBannersList')
  const { BannerDetails } = await import('../../../../../../components/BannerDetails')
  return {
    AdBannersList,
    BannerDetails,
    useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
    useUtils: () => [{ optimizeImage: (url, options) => `${url}?${options}` }],
    useSession: () => [{ user: { level: 0 } }]
  }
})
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))
vi.mock('../../AdBannersDirectory/BannerImageDialog', () => ({
  BannerImageDialog: (props) => {
    mocks.dialogProps = props
    return props.open ? <div role='dialog' aria-label='Image dialog' /> : null
  }
}))

import { AdBannersListing } from '../index'

const ROUTE = '/marketing/ad-banners'
const image = (id, extra = {}) => ({ id, type: 'image', url: `https://img.test/${id}.png`, action: null, ...extra })

// what GET /banners answers: 4 of the 12 banners, as the API sends them (items and business). Fresh objects on every call.
const BANNERS = () => JSON.parse(JSON.stringify([
  { id: 1, name: 'Burger week', position: 'web_home_page', enabled: true, items: [image(11, { action: { type: 'business', url: '/store/kcf' } }), image(12)], business: [] },
  { id: 2, name: 'Pizza night', position: 'web_home_page', enabled: false, items: [image(21)], business: [] },
  { id: 3, name: 'Free delivery', position: 'web_business_page', enabled: false, items: [image(31)], business: [{ id: 5 }] },
  { id: 4, name: 'Summer', position: 'app_home_page', enabled: true, items: [], business: [] }
]))

const json = (body) => ({ json: async () => body })

const route = async (url, options = {}) => {
  const method = options.method ?? 'GET'
  const path = url.replace('https://api.test', '')
  const body = options.body ? JSON.parse(options.body) : undefined
  if (path === '/sites') return json({ error: false, result: [] })
  if (path.startsWith('/backoffice/businesses')) {
    return json({ error: false, result: [], pagination: { current_page: 1, total_pages: 1, page_size: 10, total: 0 } })
  }
  if (path.startsWith('/banners?where=')) return mocks.list()
  if (path === '/banners' && method === 'POST') return mocks.post(body)
  const one = path.match(/^\/banners\/(\d+)$/)
  if (one && method === 'PUT') return mocks.put(Number(one[1]), body)
  if (one && method === 'DELETE') return mocks.del(Number(one[1]))
  return json({ error: false, result: {} })
}

const calls = (matcher) => mocks.fetch.mock.calls.filter(([url, options]) => matcher(url.replace('https://api.test', ''), options?.method ?? 'GET'))
const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))

// The router's history, to play what the ⌘K palette does (navigate to a URL while the page is open)
const historyRef = { current: null }
const Capture = () => {
  historyRef.current = useHistory()
  return null
}

// jsdom answers matchMedia with `matches: false`: the split view reads (min|max)-width queries, so one is installed that evaluates them
// against a width (1440: the split mode, the panel sits beside the list)
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

const rowOf = (id) => document.querySelector(`tr[data-row-id="${id}"]`)
const panelTitle = () => document.querySelector('.odc-record-title')?.textContent
const panelHead = () => document.querySelector('.odc-record-head')
const panelSwitch = () => within(panelHead()).getByRole('switch')
const rowSwitch = (id) => within(rowOf(id)).getByRole('switch')
const nameBox = () => screen.getByRole('textbox', { name: /^Name/ })
const tiles = () => screen.queryAllByRole('button', { name: /^Edit image/ })

let restoreViewport
let user

// Renders the page and waits for the list to be there
const renderPage = async (route = ROUTE, { load = true } = {}) => {
  window.history.replaceState(null, '', route)
  const view = renderWithProviders(<><Capture /><AdBannersListing /></>, { initialEntries: [route] })
  if (load) await waitFor(() => expect(rowOf(1)).not.toBeNull())
  return view
}

const openRow = async (id) => {
  await user.click(within(rowOf(id)).getByRole('rowheader'))
  await waitFor(() => expect(panelTitle()).toBeTruthy())
}

beforeEach(() => {
  restoreViewport = installViewport(1440)
  user = userEvent.setup()
  mocks.phone = false
  mocks.dialogProps = null
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  mocks.showToast.mockClear()
  mocks.list = vi.fn(async () => json({ error: false, result: BANNERS() }))
  // the PUT answers with what was sent and no `items`, as the API may (auditor 4)
  mocks.put = vi.fn(async (id, body) => json({ error: false, result: { id, ...body } }))
  mocks.post = vi.fn(async (body) => json({ error: false, result: { id: 50, ...body } })) // no items, no business
  mocks.del = vi.fn(async () => json({ error: false, result: {} }))
  mocks.fetch = vi.fn(route)
  vi.stubGlobal('fetch', mocks.fetch)
  window.history.replaceState(null, '', ROUTE)
})

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
  vi.unstubAllGlobals()
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('composition and data', () => {
  it('asks for every banner in ONE request, with no position condition', async () => {
    await renderPage()
    const gets = calls((path, method) => path.startsWith('/banners?where=') && method === 'GET')
    expect(gets).toHaveLength(1)
    expect(gets[0][0]).toBe('https://api.test/banners?where=[]')
  })

  it('draws the header with the count, the six sections with their rows, and no panel', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Ad banners' })).toBeInTheDocument()
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('4 banners')
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent))
      .toEqual(['Web home', 'Web business listing', 'Web business page', 'App home page', 'App business listing', 'App business page'])
    expect(within(rowOf(1)).getByRole('rowheader')).toHaveTextContent('Burger week')
    expect(rowOf(3).closest('section')).toHaveAttribute('data-position', 'web_business_page')
    expect(panelTitle()).toBeUndefined()
  })

  it('the menu button shows while the sidebar is collapsed and opens it', async () => {
    infoShare.isCollapse = true
    await renderPage()
    const menu = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of its lead block
    expect(menu.closest('.odc-pagehead-lead')?.firstElementChild).toBe(menu)
    await user.click(menu)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('shows a failed load with Retry, and Retry asks again', async () => {
    mocks.list = vi.fn(async () => json({ error: true, result: ['Not allowed'] }))
    await renderPage(ROUTE, { load: false })
    await user.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
  })
})

describe('one panel and the URL (decision 1; M-AB10, M-AB11)', () => {
  it('opening a row opens that banner in the panel and writes ?position=<its position>&banner=<id>', async () => {
    await renderPage()
    await openRow(2)
    expect(panelTitle()).toBe('Pizza night')
    expect(urlParams()).toEqual({ position: 'web_home_page', banner: '2' })
    await openRow(3)
    expect(panelTitle()).toBe('Free delivery')
    expect(urlParams()).toEqual({ position: 'web_business_page', banner: '3' })
    // the rest of the page stays: the list is still there beside the panel
    expect(rowOf(1)).not.toBeNull()
  })

  it('closing removes ?banner and only that, and gives the focus back to the row', async () => {
    await renderPage()
    await openRow(2)
    await user.click(within(panelHead()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(panelTitle()).toBeUndefined())
    expect(urlParams()).toEqual({ position: 'web_home_page' })
    await waitFor(() => expect(rowOf(2)).toHaveFocus())
  })

  it('?banner=<id> opens that banner once the list has loaded', async () => {
    await renderPage(`${ROUTE}?position=web_business_page&banner=3`, { load: false })
    expect(panelTitle()).toBeUndefined() // nothing opens before the list is there
    await waitFor(() => expect(panelTitle()).toBe('Free delivery'))
    expect(urlParams()).toEqual({ position: 'web_business_page', banner: '3' })
  })

  it('a ?banner= that is not in the list is removed from the URL and opens nothing (M-AB11)', async () => {
    await renderPage(`${ROUTE}?position=web_home_page&banner=99`)
    await waitFor(() => expect(urlParams().banner).toBeUndefined())
    expect(urlParams().position).toBe('web_home_page')
    expect(panelTitle()).toBeUndefined()
  })

  it('?position= no longer opens a panel: it only points at a section', async () => {
    await renderPage(`${ROUTE}?position=app_home_page`)
    expect(panelTitle()).toBeUndefined()
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'App home page' })).toHaveFocus())
  })

  it('a ?position= that arrives while the page is open (⌘K) moves the focus to that section (M-AB11)', async () => {
    await renderPage()
    act(() => { historyRef.current.push(`${ROUTE}?position=web_business_page`) })
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Web business page' })).toHaveFocus())
    act(() => { historyRef.current.push(`${ROUTE}?position=app_home_page`) })
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'App home page' })).toHaveFocus())
    expect(panelTitle()).toBeUndefined()
  })

  it('«Add banner» of a position opens the create panel for it and never writes banner=undefined (M-AB10)', async () => {
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Add banner to Web business page' }))
    expect(panelTitle()).toBe('Add banner')
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('Web business page')
    expect(window.location.search).not.toMatch(/undefined/)
    expect(urlParams().banner).toBeUndefined()
  })

  it('opening a banner while another is open replaces the panel; the previous ?banner is replaced, not kept', async () => {
    await renderPage()
    await openRow(1)
    await user.click(screen.getByRole('button', { name: 'Add banner to App home page' }))
    expect(panelTitle()).toBe('Add banner')
    expect(urlParams().banner).toBeUndefined()
  })
})

describe('create (decision 2)', () => {
  const fill = async (name) => {
    await user.type(nameBox(), name)
    await user.click(screen.getByRole('button', { name: 'Create banner' }))
  }

  it('on success the new banner OPENS (it does not close), the URL names it, and a response without items does not crash', async () => {
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Add banner to Web home' }))
    await fill('Spring')
    await waitFor(() => expect(panelTitle()).toBe('Spring'))
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post).toHaveBeenCalledWith({ name: 'Spring', position: 'web_home_page' })
    expect(urlParams()).toEqual({ position: 'web_home_page', banner: '50' })
    // it is a row of its section, on, with the defaults the response lacked
    expect(rowOf(50).closest('section')).toHaveAttribute('data-position', 'web_home_page')
    expect(rowSwitch(50)).toHaveAttribute('aria-checked', 'true')
    expect(within(rowOf(50)).getByText('0', { selector: '.odc-figure' })).toBeInTheDocument()
    // ready for its first image
    expect(screen.getByRole('button', { name: 'Add image' })).toBeInTheDocument()
    expect(tiles()).toHaveLength(0)
    expect(document.querySelector('.odc-record-title')).toHaveTextContent('Spring')
    expect(mocks.post).toHaveBeenCalledTimes(1) // onCreated after onClose opened nothing twice
  })

  it('a create that fails stays in the create form, says why and adds no row', async () => {
    mocks.post = vi.fn(async () => json({ error: true, result: ['Name already used'] }))
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Add banner to Web home' }))
    await fill('Spring')
    expect(await screen.findByText('Name already used')).toBeInTheDocument()
    expect(panelTitle()).toBe('Add banner')
    expect(document.querySelectorAll('tr[data-row-id]')).toHaveLength(4)
  })

  it('«Cancel» of a clean create form closes it', async () => {
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Add banner to Web home' }))
    await user.click(within(document.querySelector('.odc-record-foot')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(panelTitle()).toBeUndefined())
  })
})

describe('the list and the panel are one value (M-AB05; auditor findings 4 and 5)', () => {
  it('after a toggle in the row, the panel header shows the same; after one in the panel, the row does (round trip)', async () => {
    await renderPage()
    await openRow(1)
    expect(rowSwitch(1)).toHaveAttribute('aria-checked', 'true')
    expect(panelSwitch()).toHaveAttribute('aria-checked', 'true')
    await user.click(rowSwitch(1))
    await waitFor(() => expect(rowSwitch(1)).toHaveAttribute('aria-checked', 'false'))
    expect(panelSwitch()).toHaveAttribute('aria-checked', 'false')
    await user.click(panelSwitch())
    await waitFor(() => expect(panelSwitch()).toHaveAttribute('aria-checked', 'true'))
    expect(rowSwitch(1)).toHaveAttribute('aria-checked', 'true')
    expect(mocks.put).toHaveBeenNthCalledWith(1, 1, { enabled: false })
    expect(mocks.put).toHaveBeenNthCalledWith(2, 1, { enabled: true })
  })

  it('a PUT that answers without items keeps the images of the banner, in the panel and in the row', async () => {
    await renderPage()
    await openRow(1)
    expect(tiles()).toHaveLength(2)
    await user.click(rowSwitch(1))
    await waitFor(() => expect(rowSwitch(1)).toHaveAttribute('aria-checked', 'false'))
    expect(tiles()).toHaveLength(2)
    expect(within(rowOf(1)).getByText('2', { selector: '.odc-figure' })).toBeInTheDocument()
  })

  it('renaming from the panel merges the answer (it has no items): the name changes in the list and the images stay', async () => {
    await renderPage()
    await openRow(1)
    await user.clear(nameBox())
    await user.type(nameBox(), 'Burger month')
    await waitFor(() => expect(within(rowOf(1)).getByRole('rowheader')).toHaveTextContent('Burger month'), { timeout: 4000 })
    expect(mocks.put).toHaveBeenCalledWith(1, { name: 'Burger month' })
    expect(panelTitle()).toBe('Burger month')
    expect(tiles()).toHaveLength(2)
  })

  it('a failed toggle puts the switch back and says why under THAT switch, with no dialog (follow-up B2-B4)', async () => {
    mocks.put = vi.fn(async () => json({ error: true, result: ['Not allowed'] }))
    await renderPage()
    await user.click(rowSwitch(2))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(rowSwitch(2)).toHaveAttribute('aria-checked', 'false')
    expect(document.querySelectorAll('.odc-async-switch[data-failed]')).toHaveLength(1)
  })

  it('a failed toggle from the panel says why in the panel header only', async () => {
    mocks.put = vi.fn(async () => json({ error: true, result: ['Not allowed'] }))
    await renderPage()
    await openRow(2)
    await user.click(panelSwitch())
    expect(await within(panelHead()).findByRole('alert')).toHaveTextContent('Not allowed')
    expect(within(rowOf(2)).queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('the image dialog is told the name of the banner (its delete text names it)', async () => {
    await renderPage()
    await openRow(1)
    await user.click(screen.getByRole('button', { name: 'Edit image 1 of Burger week' }))
    expect(mocks.dialogProps.open).toBe(true)
    expect(mocks.dialogProps.bannerName).toBe('Burger week')
    expect(mocks.dialogProps.bannerId).toBe(1)
  })
})

describe('delete (decision 4) and focus', () => {
  const confirmDelete = async (name) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete banner' }))
    const dialog = await screen.findByRole('alertdialog', { name: `Delete "${name}"?` })
    await user.click(within(dialog).getByRole('button', { name: 'Delete banner' }))
  }

  it('deleting removes the banner from the list, closes the panel and takes ?banner out of the URL', async () => {
    await renderPage()
    await openRow(1)
    await confirmDelete('Burger week')
    await waitFor(() => expect(panelTitle()).toBeUndefined())
    expect(rowOf(1)).toBeNull()
    expect(mocks.del).toHaveBeenCalledWith(1)
    expect(urlParams().banner).toBeUndefined()
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('3 banners')
  })

  it('after a delete the focus goes to the next row of the same position', async () => {
    await renderPage()
    await openRow(1)
    await confirmDelete('Burger week')
    await waitFor(() => expect(rowOf(2)).toHaveFocus())
  })

  it('with no next row in the position, the focus goes to that position\'s «Add banner»', async () => {
    await renderPage()
    await openRow(2)
    await confirmDelete('Pizza night')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add banner to Web home' })).toHaveFocus())
  })
})

describe('unsaved create form (discard guard)', () => {
  const startDraft = async (text = 'Draft') => {
    await user.click(screen.getByRole('button', { name: 'Add banner to Web home' }))
    await user.type(nameBox(), text)
  }

  it('opening another row with text in the create form asks first; «Keep editing» stays', async () => {
    await renderPage()
    await startDraft()
    await user.click(within(rowOf(2)).getByRole('rowheader'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(panelTitle()).toBe('Add banner')
    expect(nameBox()).toHaveValue('Draft')
    expect(urlParams().banner).toBeUndefined()
  })

  // redesign (row 49, Q-08): «Keep editing» puts the focus back where the person was typing, not on the row they clicked
  it('«Keep editing» returns the focus to the Name field, not to the clicked row', async () => {
    await renderPage()
    await startDraft()
    await user.click(within(rowOf(2)).getByRole('rowheader'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(nameBox()).toHaveFocus())
  })

  it('«Discard» opens the row that was asked for', async () => {
    await renderPage()
    await startDraft()
    await user.click(within(rowOf(2)).getByRole('rowheader'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(panelTitle()).toBe('Pizza night'))
    expect(urlParams()).toEqual({ position: 'web_home_page', banner: '2' })
  })

  it('going to the «Add banner» of another position asks too, and a discarded draft starts a new form', async () => {
    await renderPage()
    await startDraft()
    await user.click(screen.getByRole('button', { name: 'Add banner to App home page' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('App home page'))
    expect(nameBox()).toHaveValue('')
  })

  it('a clean create form is replaced with no question', async () => {
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Add banner to Web home' }))
    await user.click(within(rowOf(2)).getByRole('rowheader'))
    await waitFor(() => expect(panelTitle()).toBe('Pizza night'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
