/* eslint-disable import/first */
// redesign GC-B (| GC-02, GC-03, GC-14, GC-16 | D1, D4, D8, D9, D10, audit F7): the gift cards page. The controller
// (K/GiftCardsList) is played by `Host`: it hands the page the props the controller gives (`giftCards`, `paginationProps`,
// `activeStatus`, `setActiveStatus`, `getGiftCards`, `searchValue`, `onSearch`, `reload`, `isUseQuery`) as spies. The catalog sheet
// (the lote C's GiftCardsCatalog) is a stub. The table, the Product wrappers (PageHeader, Tabs, SearchField, Pagination) are real.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const ctl = vi.hoisted(() => ({ props: {} }))
const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: value => `date(${value})`, parsePrice: value => `$ ${Number(value).toFixed(2)}` }]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))
vi.mock('../../../Loyalty/GiftCards', () => ({
  GiftCardsCatalog: ({ open, onClose }) => (
    <div role='dialog' aria-label='Gift cards for sale' data-open={String(open)}>
      <button type='button' onClick={onClose}>Close catalog</button>
    </div>
  )
}))

import { GiftCardsListingUI } from '../GiftCardsListingUI'

const card = (id, extra = {}) => ({
  id,
  amount: 20,
  status: 'pending',
  code: `CODE-${id}`,
  password: `PIN-${id}`,
  user_name: null,
  user_email: null,
  created_at: '2026-10-03 14:05:00',
  activated_at: null,
  author: { name: `Buyer${id}`, lastname: 'Test', cellphone: `555 00${id}`, email: null, photo: null },
  activater: null,
  order_product: null,
  ...extra
})
const CARDS = Array.from({ length: 10 }, (_, index) => card(index + 1))

const pagination = (extra = {}) => ({ currentPage: 1, pageSize: 10, totalPages: 5, totalItems: 43, from: 1, to: 10, ...extra })

const baseCtl = (overrides = {}) => ({
  isUseQuery: true,
  giftCards: { loading: false, list: CARDS, error: null },
  paginationProps: pagination(),
  activeStatus: 'pending',
  setActiveStatus: vi.fn(),
  getGiftCards: vi.fn(),
  searchValue: null,
  onSearch: vi.fn(),
  reload: vi.fn(),
  ...overrides
})

const Host = () => <GiftCardsListingUI {...ctl.props} />

const ROUTE = '/gift-cards'
let view
const renderPage = (overrides = {}, route = ROUTE) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(overrides)
  const utils = renderWithProviders(<Host />, { initialEntries: [route] })
  view = {
    ...utils,
    // the controller answers with new props (a new list, a new state)
    update: (changes) => {
      Object.assign(ctl.props, changes)
      utils.rerender(<Host />)
    }
  }
  return view
}

const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))
const click = (name) => userEvent.click(screen.getByRole('button', { name }))
const searchbox = () => screen.getByRole('searchbox', { name: 'Search by code, buyer or recipient' })

beforeEach(() => {
  window.history.replaceState(null, '', ROUTE)
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('the header', () => {
  it('draws the title, the count of the tab, the tabs, the search, the table and the pagination', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /Gift card manager/ })).toBeInTheDocument()
    expect(screen.getByText('43 gift cards')).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Gift card status' })).toBeInTheDocument()
    expect(searchbox()).toHaveAttribute('placeholder', 'Search by code, buyer or recipient')
    expect(screen.getByRole('table', { name: 'Gift Cards' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–10 of 43')
  })

  it('says «1 gift card» for one', () => {
    renderPage({ giftCards: { loading: false, list: [card(1)], error: null }, paginationProps: pagination({ totalItems: 1, totalPages: 1, to: 1 }) })
    expect(screen.getByText('1 gift card')).toBeInTheDocument()
  })

  it('has no count while it loads, nor after a failure', () => {
    const loading = renderPage({ giftCards: { loading: true, list: [], error: null } })
    expect(screen.queryByText(/^\d+ gift cards?$/)).toBeNull()
    loading.unmount()
    renderPage({ giftCards: { loading: false, list: [], error: ['Internal error'] } })
    expect(screen.queryByText(/^\d+ gift cards?$/)).toBeNull()
  })

  it('«Gift card settings» is a link to the settings hub, not an editor (D8)', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Gift card settings' })).toHaveAttribute('href', '/settings?group=payments&category=addon_gift_cards')
  })

  it('«Open menu» only with the sidebar collapsed, and it opens it', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    cleanup()
    infoShare.isCollapse = true
    renderPage()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await click('Open menu')
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('«Set up gift cards» is the primary action, a button', () => {
    renderPage()
    const button = screen.getByRole('button', { name: 'Set up gift cards' })
    expect(button).toHaveAttribute('data-variant', 'primary')
  })
})

describe('the tabs (GC-14, D9)', () => {
  it('Pending and Redeemed are tabs; the active status is the selected one', () => {
    renderPage({ activeStatus: 'activated' })
    expect(screen.getByRole('tab', { name: 'Pending' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Redeemed' })).toHaveAttribute('aria-selected', 'true')
  })

  it('choosing a tab sets the status and writes ?status= (isUseQuery)', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Redeemed' }))
    expect(ctl.props.setActiveStatus).toHaveBeenCalledWith('activated')
    expect(urlParams().status).toBe('activated')
  })

  it('without isUseQuery it sets the status and leaves the URL alone', async () => {
    renderPage({ isUseQuery: false })
    await userEvent.click(screen.getByRole('tab', { name: 'Redeemed' }))
    expect(ctl.props.setActiveStatus).toHaveBeenCalledWith('activated')
    expect(urlParams()).toEqual({})
  })

  it('mounting with ?status= uses it', () => {
    renderPage({}, `${ROUTE}?status=activated`)
    expect(ctl.props.setActiveStatus).toHaveBeenCalledWith('activated')
  })

  it('mounting without it writes ?status=pending and does not set a status', () => {
    renderPage()
    expect(urlParams().status).toBe('pending')
    expect(ctl.props.setActiveStatus).not.toHaveBeenCalled()
  })

  it('a ?status= that is not a tab (sent) is passed on as main did: no tab marked, nothing thrown', () => {
    renderPage({ activeStatus: 'sent' }, `${ROUTE}?status=sent`)
    expect(ctl.props.setActiveStatus).toHaveBeenCalledWith('sent')
    expect(screen.getAllByRole('tab').map(tab => tab.getAttribute('aria-selected'))).toEqual(['false', 'false'])
    expect(screen.getByRole('table', { name: 'Gift Cards' })).toBeInTheDocument()
  })
})

describe('the search (750ms like main)', () => {
  beforeEach(() => { vi.useFakeTimers() })

  const type = (text) => fireEvent.change(searchbox(), { target: { value: text } })
  const wait = (ms) => act(() => { vi.advanceTimersByTime(ms) })

  it('waits 750ms after the last key before it asks', () => {
    renderPage()
    type('an')
    wait(500)
    type('ana')
    wait(500)
    expect(ctl.props.onSearch).not.toHaveBeenCalled()
    wait(250)
    expect(ctl.props.onSearch).toHaveBeenCalledTimes(1)
    expect(ctl.props.onSearch).toHaveBeenCalledWith('ana')
  })

  it('the box shows what is typed at once', () => {
    renderPage()
    type('ana')
    expect(searchbox()).toHaveValue('ana')
  })

  it('does not ask for the spaces around the text', () => {
    renderPage()
    type('  ana ')
    wait(750)
    expect(ctl.props.onSearch).toHaveBeenCalledWith('ana')
    expect(searchbox()).toHaveValue('  ana ')
  })

  it('clearing is immediate, drops the pending wait and empties the box', () => {
    renderPage({ searchValue: 'ana' })
    expect(searchbox()).toHaveValue('ana')
    type('anabel')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(ctl.props.onSearch).toHaveBeenCalledTimes(1)
    expect(ctl.props.onSearch).toHaveBeenCalledWith('')
    expect(searchbox()).toHaveValue('')
    wait(1000)
    expect(ctl.props.onSearch).toHaveBeenCalledTimes(1)
  })

  it('does not ask again for the search it already has (the controller reloads on every change)', () => {
    renderPage({ searchValue: 'ana' })
    type('ana')
    wait(750)
    expect(ctl.props.onSearch).not.toHaveBeenCalled()
  })

  it('a change from outside (the controller, or the empty state) is shown in the box', () => {
    renderPage({ searchValue: 'ana' })
    view.update({ searchValue: 'bruno' })
    expect(searchbox()).toHaveValue('bruno')
  })
})

describe('the pagination (GC-16)', () => {
  it('Next page asks for page 2 at the same size', async () => {
    renderPage()
    await click('Next page')
    expect(ctl.props.getGiftCards).toHaveBeenCalledWith(2, 10)
  })

  it('a new page size asks for the page that keeps the first item in view', async () => {
    renderPage({ paginationProps: pagination({ currentPage: 3, from: 21, to: 30 }) })
    await userEvent.click(screen.getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(ctl.props.getGiftCards).toHaveBeenCalledWith(1, 25)
  })

  it('offers 10, 25 and 50, and the size of the URL when it is another', async () => {
    renderPage({ paginationProps: pagination({ pageSize: 30, totalPages: 2 }) })
    await userEvent.click(screen.getByRole('button', { name: /Items per page/ }))
    expect((await screen.findAllByRole('menuitemradio')).map(item => item.textContent)).toEqual(['10', '25', '30', '50'])
  })

  it('writes ?page and ?pageSize (isUseQuery), and nothing without it', () => {
    const first = renderPage()
    expect(urlParams()).toMatchObject({ page: '1', pageSize: '10' })
    first.update({ paginationProps: pagination({ currentPage: 2, from: 11, to: 20 }) })
    expect(urlParams()).toMatchObject({ page: '2', pageSize: '10' })
    first.unmount()
    renderPage({ isUseQuery: false })
    expect(urlParams()).toEqual({})
  })

  // redesign GC-D (R1): `main` painted the page buttons, so a person could jump to the last page in one click; the foot keeps that with the page field
  it('has a page field to jump to a page, as main had its page buttons (R1)', async () => {
    renderPage()
    const field = within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('textbox', { name: 'Page' })
    expect(field).toHaveValue('1')
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('of 5')
    await userEvent.type(field, '4{Enter}')
    expect(ctl.props.getGiftCards).toHaveBeenCalledWith(4, 10)
  })

  // redesign GC-D (R2): the foot used to leave the page while a page loaded, and the button that had just been pressed went with
  // it (the focus fell to <body>). It stays mounted and `busy` (the pattern of the other lists); it is hidden only when there is
  // nothing to page: a failure, an empty list, or the first load (no data yet).
  it('stays on the page, busy, while another page loads (R2)', async () => {
    const view = renderPage()
    const nav = () => screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav()).not.toHaveAttribute('aria-busy')
    view.update({ giftCards: { loading: true, list: CARDS, error: null } })
    expect(nav()).toHaveAttribute('aria-busy', 'true')
    // busy: a press does nothing (no second request)
    await click('Next page')
    expect(ctl.props.getGiftCards).not.toHaveBeenCalled()
  })

  it('keeps the focus on «Next page» from the press to the new page (R2)', async () => {
    const view = renderPage()
    const next = screen.getByRole('button', { name: 'Next page' })
    await userEvent.click(next)
    expect(ctl.props.getGiftCards).toHaveBeenCalledWith(2, 10)
    view.update({ giftCards: { loading: true, list: CARDS, error: null } })
    expect(document.activeElement).toBe(next)
    view.update({ giftCards: { loading: false, list: CARDS, error: null }, paginationProps: pagination({ currentPage: 2, from: 11, to: 20 }) })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next page' }))
  })

  it('keeps the focus on the page-size button when the size changes (R2)', async () => {
    const view = renderPage()
    const trigger = screen.getByRole('button', { name: /Items per page/ })
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    view.update({ giftCards: { loading: true, list: CARDS, error: null } })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Items per page/ })))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('is hidden on the first load, after a failure and with an empty list', () => {
    const loading = renderPage({ giftCards: { loading: true, list: [], error: null } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    loading.unmount()
    const failed = renderPage({ giftCards: { loading: false, list: [], error: ['Internal error'] } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    failed.unmount()
    renderPage({ giftCards: { loading: false, list: [], error: null }, paginationProps: pagination({ totalItems: 0, totalPages: 0, from: 0, to: 0 }) })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('a page past the end (?page=99) asks for the last page once and never says «empty» (audit F7)', async () => {
    const empty = { loading: false, list: [], error: null }
    renderPage({ giftCards: empty, paginationProps: pagination({ currentPage: 99, totalPages: 5, from: null, to: null }) }, `${ROUTE}?page=99`)
    expect(ctl.props.getGiftCards).toHaveBeenCalledTimes(1)
    expect(ctl.props.getGiftCards).toHaveBeenCalledWith(5, 10)
    expect(screen.queryByText('No pending gift cards')).toBeNull()
    expect(document.querySelectorAll('tr[data-skeleton]').length).toBeGreaterThan(0)
    // the request runs, then comes back with the last page
    view.update({ giftCards: { loading: true, list: [], error: null } })
    view.update({ giftCards: { loading: false, list: CARDS.slice(0, 3), error: null }, paginationProps: pagination({ currentPage: 5, from: 41, to: 43 }) })
    expect(screen.getByRole('table', { name: 'Gift Cards' })).toHaveTextContent('Buyer1 Test')
    expect(ctl.props.getGiftCards).toHaveBeenCalledTimes(1)
  })

  it('if the last page is empty too it asks no more and says so', () => {
    const empty = { loading: false, list: [], error: null }
    renderPage({ giftCards: empty, paginationProps: pagination({ currentPage: 99, from: null, to: null }) })
    expect(ctl.props.getGiftCards).toHaveBeenCalledTimes(1)
    view.update({ giftCards: { loading: true, list: [], error: null } })
    view.update({ giftCards: { loading: false, list: [], error: null } })
    expect(ctl.props.getGiftCards).toHaveBeenCalledTimes(1)
    expect(screen.getByText('No pending gift cards')).toBeInTheDocument()
  })
})

describe('the states (GC-02, GC-03, D10)', () => {
  it('a failure replaces the list with the message, and «Retry» reloads and gives the focus to the list', async () => {
    renderPage({ giftCards: { loading: false, list: [], error: ['Internal error'] } })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the gift cards.")
    ctl.props.reload = vi.fn(() => view.update({ giftCards: { loading: true, list: [], error: null } }))
    view.update({})
    await click('Retry')
    expect(ctl.props.reload).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('.odc-table-scroll')))
  })

  it('an empty tab says which one is empty', () => {
    const pending = renderPage({ giftCards: { loading: false, list: [], error: null }, paginationProps: pagination({ totalItems: 0, totalPages: 0, from: 0, to: 0 }) })
    expect(screen.getByText('No pending gift cards')).toBeInTheDocument()
    pending.unmount()
    renderPage({ activeStatus: 'activated', giftCards: { loading: false, list: [], error: null }, paginationProps: pagination({ totalItems: 0, totalPages: 0, from: 0, to: 0 }) })
    expect(screen.getByText('No redeemed gift cards')).toBeInTheDocument()
  })

  it('no match: «Look in Redeemed» changes the tab and keeps the search', async () => {
    renderPage({ searchValue: 'zzz', giftCards: { loading: false, list: [], error: null }, paginationProps: pagination({ totalItems: 0, totalPages: 0, from: 0, to: 0 }) })
    expect(screen.getByText('No gift cards match')).toBeInTheDocument()
    await click('Look in Redeemed')
    expect(ctl.props.setActiveStatus).toHaveBeenCalledWith('activated')
    expect(urlParams().status).toBe('activated')
    expect(ctl.props.onSearch).not.toHaveBeenCalled()
    expect(searchbox()).toHaveValue('zzz')
  })

  // redesign GC-D (R2): the empty state, and its button, go away when the other tab loads; the focus goes to the tab that was chosen
  it('no match: «Look in Redeemed» puts the focus on the Redeemed tab, never on <body> (R2)', async () => {
    renderPage({ searchValue: 'zzz', giftCards: { loading: false, list: [], error: null }, paginationProps: pagination({ totalItems: 0, totalPages: 0, from: 0, to: 0 }) })
    await click('Look in Redeemed')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Redeemed' }))
    view.update({ activeStatus: 'activated', giftCards: { loading: true, list: [], error: null } })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Redeemed' }))
  })

  it('no match in Redeemed: «Look in Pending» puts the focus on the Pending tab (R2)', async () => {
    renderPage({ activeStatus: 'activated', searchValue: 'zzz', giftCards: { loading: false, list: [], error: null }, paginationProps: pagination({ totalItems: 0, totalPages: 0, from: 0, to: 0 }) })
    await click('Look in Pending')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Pending' }))
  })

  it('no match: «Clear search» clears at once and puts the focus in the search box', async () => {
    renderPage({ searchValue: 'zzz', giftCards: { loading: false, list: [], error: null }, paginationProps: pagination({ totalItems: 0, totalPages: 0, from: 0, to: 0 }) })
    const empty = screen.getByText('No gift cards match').closest('.odc-state')
    await userEvent.click(within(empty).getByRole('button', { name: 'Clear search' }))
    expect(ctl.props.onSearch).toHaveBeenCalledWith('')
    expect(document.activeElement).toBe(searchbox())
  })
})

describe('the catalog (D8, GC-05)', () => {
  it('«Set up gift cards» opens it, and closing it gives the focus back to the button', async () => {
    renderPage()
    expect(screen.queryByRole('dialog', { name: 'Gift cards for sale' })).toBeNull()
    await click('Set up gift cards')
    expect(screen.getByRole('dialog', { name: 'Gift cards for sale' })).toHaveAttribute('data-open', 'true')
    await click('Close catalog')
    expect(screen.queryByRole('dialog', { name: 'Gift cards for sale' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Set up gift cards' })))
  })

  // redesign GC-D (R5): opened with `?setup=1` (⌘K) there is no opener, so the sheet hands the focus to the first link of the document
  // («Skip to content»), not to the button. The stub of the catalog plays that: it focuses the skip link as it goes.
  it('opened with ?setup=1, closing it puts the focus on «Set up gift cards», not on the skip link (R5)', async () => {
    const skip = document.createElement('a')
    skip.href = '#main'
    skip.textContent = 'Skip to content'
    document.body.prepend(skip)
    try {
      renderPage({}, `${ROUTE}?setup=1`)
      await screen.findByRole('dialog', { name: 'Gift cards for sale' })
      await click('Close catalog')
      act(() => skip.focus())
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Set up gift cards' })))
    } finally {
      skip.remove()
    }
  })

  it('?setup=1 opens it, as main, and the param is dropped from the URL', async () => {
    renderPage({}, `${ROUTE}?setup=1`)
    expect(await screen.findByRole('dialog', { name: 'Gift cards for sale' })).toBeInTheDocument()
    expect(urlParams().setup).toBeUndefined()
  })

  it('opening it does not touch the status or the page of the list', async () => {
    renderPage({ activeStatus: 'activated', paginationProps: pagination({ currentPage: 2, from: 11, to: 20 }) }, `${ROUTE}?status=activated&page=2&pageSize=10`)
    await click('Set up gift cards')
    expect(urlParams()).toMatchObject({ status: 'activated', page: '2', pageSize: '10' })
  })
})

// redesign GC-D (R9): on a phone the card shows the recipient's email (or the buyer's) whole: it breaks into lines (`overflow-wrap: anywhere`)
// where it used to end in an ellipsis with the full text only in a `title` that a phone cannot show. jsdom has no layout, so the rule is read
// from the stylesheet: the declarations that win for `.odc-gc-cards .odc-gc-name` (the only line of a person with no name).
const cssRules = (css, selector) => {
  const declarations = {}
  for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').map(item => item.trim().replace(/\s+/g, ' ')).includes(selector)) continue
    body.split(';').map(item => item.trim()).filter(Boolean).forEach(item => {
      const index = item.indexOf(':')
      declarations[item.slice(0, index).trim()] = item.slice(index + 1).trim()
    })
  }
  return declarations
}

describe('the phone cards (R9)', () => {
  const css = readFileSync(resolve(__dirname, '../gift-cards.css'), 'utf8')
  it.each(['.odc-gc-cards .odc-gc-name', '.odc-gc-cards .odc-gc-sub'])('%s breaks into lines and is never cut with an ellipsis', (selector) => {
    const rule = cssRules(css, selector)
    expect(rule['overflow-wrap']).toBe('anywhere')
    expect(rule['white-space']).toBe('normal')
    expect(rule['text-overflow']).not.toBe('ellipsis')
  })
})
