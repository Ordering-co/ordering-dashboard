/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import stylesSource from './styles.js?raw'

// redesign deliveries F2-B1: the card's rules moved to CSS, which vitest does not hand over as text, so the file is read
const cardCss = readFileSync(path.resolve(__dirname, 'delivery-card.css'), 'utf8')

const translate = vi.fn((_key, fallback) => fallback)

vi.mock('../../../../../index', () => ({
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [{ dictionary: {} }, (key, fallback) => translate(key, fallback)],
  useUtils: () => [{
    optimizeImage: value => value,
    parseDate: value => value
  }]
}))

vi.mock('../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 390 }) }))
vi.mock('../../../utils', () => ({
  addQueryToUrl: vi.fn(),
  getOrderStatusPrefix: () => 'Pending'
}))

import { OrdersCards } from '.'

const order = {
  id: 910001,
  status: 0,
  delivery_type: 1,
  delivery_datetime: '2026-09-15 08:30:00',
  time_status: 'in_time',
  business: { name: 'Synthetic Store Alpha', city: { name: 'Fixture City' } }
}

const Wrapper = ({ children }) => (
  <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
    {children}
  </ConfigFileContext.Provider>
)

const renderCards = (props = {}) => {
  const handlers = {
    handleOpenOrderDetail: vi.fn(),
    handleOrderCardClick: vi.fn(),
    getPageOrders: vi.fn()
  }
  const view = renderWithProviders(
    <OrdersCards
      orderList={{ loading: false, orders: [order] }}
      franchisesList={{ loading: false, franchises: [] }}
      {...handlers}
      {...props}
    />,
    { wrapper: Wrapper }
  )
  return { ...view, ...handlers }
}

const cardOf = () => document.querySelector('[data-delivery-card]')

describe('OrdersCards interactions', () => {
  it('opens details from the tactile action without selecting its parent card', async () => {
    const user = userEvent.setup()
    const { handleOpenOrderDetail, handleOrderCardClick } = renderCards()

    await user.click(screen.getByRole('button', { name: 'View details' }))

    expect(handleOpenOrderDetail).toHaveBeenCalledOnce()
    expect(handleOpenOrderDetail).toHaveBeenCalledWith(order)
    expect(handleOrderCardClick).not.toHaveBeenCalled()

    // redesign tramo B r1 fixes (W1-QB1-03): the mouse acts on the card itself
    await user.click(cardOf())
    expect(handleOrderCardClick).toHaveBeenCalledWith(order)
  })

  // redesign W1-3 (T1-3-4): the card no longer is a role=button with a button inside (axe nested-interactive).
  it('has no interactive control nested inside another', () => {
    const { container } = renderCards()

    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0)
    const buttons = [...container.querySelectorAll('button')]
    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button.querySelector('button, a, [role="button"], [tabindex]')).toBeNull()
    // the two controls are siblings: neither one contains the other
    expect(buttons[0].contains(buttons[1])).toBe(false)
    expect(buttons[1].contains(buttons[0])).toBe(false)
  })

  it('selects for the map with a pressed button that keeps the keyboard (Enter and Space)', async () => {
    const user = userEvent.setup()
    const { handleOrderCardClick, handleOpenOrderDetail } = renderCards({ selectedOrderCard: { id: 1 } })

    const select = screen.getByRole('button', { name: /Order number 910001/ })
    expect(select).toHaveAttribute('aria-pressed', 'false')
    expect(select).toHaveAttribute('type', 'button')

    select.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(handleOrderCardClick).toHaveBeenCalledTimes(2)
    expect(handleOrderCardClick).toHaveBeenCalledWith(order)

    await user.tab()
    expect(screen.getByRole('button', { name: 'View details' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(handleOpenOrderDetail).toHaveBeenCalledOnce()
    expect(handleOrderCardClick).toHaveBeenCalledTimes(2)
  })

  it('marks the selected card as pressed', () => {
    renderCards({ selectedOrderCard: order })
    expect(screen.getByRole('button', { name: /Order number 910001/ })).toHaveAttribute('aria-pressed', 'true')
  })

  // W1-D-1 (decision 11): only the figure of the order number is set in mono, not the whole heading.
  // redesign deliveries F2-B1 (decision 4, DV-03): the figure is `.odc-figure` in a bdi, after «#»; «Order number» stays for assistive technology.
  it('sets only the figure of the order number in mono', () => {
    const { container } = renderCards()

    const heading = container.querySelector('h2')
    expect(heading).not.toHaveClass('odc-figure')
    const mono = heading.querySelectorAll('.odc-figure')
    expect(mono).toHaveLength(1)
    expect(mono[0].tagName).toBe('BDI')
    expect(mono[0].textContent).toBe('910001')
    expect(heading.textContent).toMatch(/Order number\s+#910001/)
  })

  // W1-A0-02: every datum of the card stays after the compaction
  it('keeps every datum of the card', () => {
    renderCards({
      orderList: {
        loading: false,
        orders: [{
          ...order,
          codigoPod: 'POD-77',
          driver: { name: 'Fixture Driver', cellphone: '5550101' }
        }]
      }
    })

    const card = screen.getByRole('button', { name: /Order number 910001/ }).closest('[data-delivery-card]')
    expect(card).not.toBeNull()
    const scope = within(card)
    // redesign deliveries F2-B1 (decision 4, DV-10): «Timer» is no longer a label (its figure is the ETA), the phone is a call link, the
    // status bar is gone (its datum is the SLA badge in text)
    for (const text of [/910001/, 'Pending', '2026-09-15 08:30:00', 'Synthetic Store Alpha', 'Fixture City', 'Fixture Driver', /POD-77/]) {
      expect(scope.getAllByText(text, { exact: false }).length).toBeGreaterThan(0)
    }
    // (T10, decision X-2): this open order's ETA has passed, so its in_time is not painted as «On time» (the timer says it)
    expect(scope.queryByText('On time')).toBeNull()
    expect(scope.queryByText('Timer')).toBeNull()
    expect(scope.getByRole('link', { name: 'Call Fixture Driver' })).toHaveAttribute('href', 'tel:5550101')
    expect(scope.getByRole('button', { name: 'View details' })).toBeInTheDocument()
    expect(card.querySelector('[data-status-bar]')).toBeNull()
  })

  // redesign deliveries F2-B1 (decision 4): «No Driver» is now «Unassigned» (the key the orders table already uses)
  it('says Unassigned when the order has no driver', () => {
    renderCards()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  // redesign W1-3: the texts that had no key go through t()
  // redesign deliveries F2-B1 (DV-10): the «Timer» label is gone; its figure is named ETA
  it('translates the ETA name and the day suffix', () => {
    translate.mockClear()
    const late = { ...order, delivery_datetime: '2000-01-01 00:00:00', delivery_datetime_utc: '2000-01-01 00:00:00' }
    renderCards({ orderList: { loading: false, orders: [late] } })

    expect(translate).toHaveBeenCalledWith('ETA', 'ETA')
    expect(translate).not.toHaveBeenCalledWith('TIMER', 'Timer')
    expect(translate).toHaveBeenCalledWith('ETA_TIMER_DAYS', '_count_ days') // (T10): the number travels in the text
    expect(screen.queryByText(/\dday/)).toBeNull()
  })

  it('paints the loading cards with the product skeleton, not the third-party one', () => {
    const { container } = renderCards({ orderList: { loading: true, orders: [] } })

    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('.react-loading-skeleton')).toBeNull()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('pages with the product pagination and the same request as before', async () => {
    const user = userEvent.setup()
    const { getPageOrders } = renderCards({
      pagination: { currentPage: 1, pageSize: 10, total: 35, totalPages: 4 }
    })

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(getPageOrders).toHaveBeenCalledWith(10, 2)
  })

  // redesign tramo B r1 fixes (W1-QB1-03, W1-PB1-02): the text of the card can be selected and copied again, as in main.
  describe('text selection', () => {
    const selectTextIn = (element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    }
    afterEach(() => window.getSelection().removeAllRanges())

    // redesign deliveries F2-B1: the rules are in delivery-card.css (jsdom does not load the file), so they are read from its source
    it('lets the pointer through the selection button, so it does not cover the text', () => {
      renderCards()
      const select = screen.getByRole('button', { name: /Order number 910001/ })
      expect(select).toHaveClass('odc-dcard-select')
      expect(cardCss).toMatch(/\.odc-dcard-select \{[^}]*pointer-events: none;/)
      // the card is what the mouse and the touch act on
      expect(cardOf()).toHaveClass('odc-dcard')
      expect(cardCss).toMatch(/\.odc-dcard:not\(\[data-skeleton\]\) \{ cursor: pointer; \}/)
    })

    it('does not select the card with the click that ends a text selection inside it', () => {
      const { handleOrderCardClick } = renderCards()
      const text = screen.getByText('Synthetic Store Alpha')

      // a drag ends with a click on the common ancestor while the dragged text is still selected (detail 1: a pointer click)
      selectTextIn(text)
      fireEvent.click(text, { detail: 1 })
      expect(handleOrderCardClick).not.toHaveBeenCalled()

      // the same click with nothing selected (a plain click) is the selection of the card
      window.getSelection().removeAllRanges()
      fireEvent.click(text, { detail: 1 })
      expect(handleOrderCardClick).toHaveBeenCalledOnce()
    })

    it('selects the card when the selected text is elsewhere on the page', () => {
      const { handleOrderCardClick } = renderCards()
      const elsewhere = document.createElement('p')
      elsewhere.textContent = 'text of the chat'
      document.body.appendChild(elsewhere)
      selectTextIn(elsewhere)

      fireEvent.click(screen.getByText('Synthetic Store Alpha'), { detail: 1 })
      expect(handleOrderCardClick).toHaveBeenCalledOnce()
      elsewhere.remove()
    })

    it('keeps the keyboard working while text is selected in the card', async () => {
      const user = userEvent.setup()
      const { handleOrderCardClick } = renderCards()
      selectTextIn(screen.getByText('Synthetic Store Alpha'))

      screen.getByRole('button', { name: /Order number 910001/ }).focus()
      await user.keyboard('{Enter}')
      expect(handleOrderCardClick).toHaveBeenCalledOnce()
      await user.keyboard(' ')
      expect(handleOrderCardClick).toHaveBeenCalledTimes(2)
    })

    it('does not select the card when «View details» is used', async () => {
      const user = userEvent.setup()
      const { handleOrderCardClick, handleOpenOrderDetail } = renderCards()
      await user.click(screen.getByRole('button', { name: 'View details' }))
      expect(handleOpenOrderDetail).toHaveBeenCalledOnce()
      expect(handleOrderCardClick).not.toHaveBeenCalled()
    })
  })

  // redesign tramo B r1 fixes (W1-QB1-05): the unread count is part of the name of the card's button.
  describe('unread count in the name', () => {
    const unread = (count) => ({ isMessagesView: true, orderList: { loading: false, orders: [{ ...order, unread_count: count }] } })

    it('says how many messages are unread, in the name of the selection button', () => {
      renderCards(unread(2))
      expect(screen.getByRole('button', { name: /^Order number 910001 Pending 2 unread messages$/ })).toBeInTheDocument()
    })

    it('says «1 unread message» for one', () => {
      renderCards(unread(1))
      expect(screen.getByRole('button', { name: /^Order number 910001 Pending 1 unread message$/ })).toBeInTheDocument()
    })

    it('keeps the pill for the eye only, so it is not read twice', () => {
      const { container } = renderCards(unread(3))
      const pill = container.querySelector('.odc-dcard-unread')
      expect(pill).toHaveAttribute('aria-hidden', 'true')
      expect(pill).toHaveTextContent('3')
    })

    it('adds nothing to a card with no unread messages, or outside Messages', () => {
      renderCards({ isMessagesView: true })
      expect(screen.getByRole('button', { name: /^Order number 910001 Pending$/ })).toBeInTheDocument()
      renderCards({ orderList: { loading: false, orders: [{ ...order, id: 910002, unread_count: 4 }] } })
      expect(screen.getByRole('button', { name: /^Order number 910002 Pending$/ })).toBeInTheDocument()
    })
  })

  // redesign tramo B r1 fixes (W1-QB1-04, decision 30): the tenant's colour is for the primary action only.
  it('does not paint «View details» or the unread pill in the tenant colour', () => {
    const tenant = '#2c7be5'
    renderCards({ isMessagesView: true, orderList: { loading: false, orders: [{ ...order, unread_count: 2 }] } })
    // (a theme that carries a tenant override must not reach the text)
    // redesign deliveries F2-B1: «View details» is a P/Button link (its colour is --od-action-content in product.css) and the pill's rule is in the card CSS
    expect(getComputedStyle(screen.getByRole('button', { name: 'View details' })).color).not.toBe(tenant)
    expect(screen.getByRole('button', { name: 'View details' })).toHaveAttribute('data-variant', 'link')
    expect(stylesSource).not.toMatch(/actionOverride/)
    expect(cardCss).not.toMatch(/actionOverride|tenant-action/)
    expect(cardCss).toMatch(/\.odc-dcard-unread \{[^}]*color: var\(--od-action-content\);/)
  })

  // redesign tramo B r1 fixes (W1-PB1-03): when the total drops under the page held, DashboardOrdersList steps back by itself.
  it('does not ask again for the page the controller already steps back to', async () => {
    const user = userEvent.setup()
    const getPageOrders = vi.fn()
    const base = { orderList: { loading: false, orders: [order] }, getPageOrders }
    const pagination = total => ({ currentPage: 3, pageSize: 10, total })
    const { rerender } = renderCards({ ...base, pagination: pagination(21) })
    expect(getPageOrders).not.toHaveBeenCalled()

    rerender(
      <OrdersCards
        {...base}
        franchisesList={{ loading: false, franchises: [] }}
        handleOpenOrderDetail={vi.fn()}
        handleOrderCardClick={vi.fn()}
        pagination={pagination(20)}
      />
    )
    // P/Pagination painted page 2 and asked for it; the controller is the one that fetches it
    expect(getPageOrders).not.toHaveBeenCalled()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 11–20 of 20')

    // once the controller has stepped back, a person using the pager still gets one request per action
    rerender(
      <OrdersCards
        {...base}
        franchisesList={{ loading: false, franchises: [] }}
        handleOpenOrderDetail={vi.fn()}
        handleOrderCardClick={vi.fn()}
        pagination={{ currentPage: 2, pageSize: 10, total: 20 }}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(getPageOrders).toHaveBeenCalledOnce()
    expect(getPageOrders).toHaveBeenCalledWith(10, 1)
  })

  // redesign tramo B r1 fixes (W1-PB1-04): no «Showing 1–10 of » while the total is on its way.
  it('paints no range, and reads no «Page 1 of null», while the total is not known', () => {
    renderCards({ pagination: { currentPage: 1, pageSize: 10 } })
    const foot = screen.getByRole('navigation', { name: 'Pagination' })
    expect(foot).not.toHaveTextContent(/Showing/)
    expect(foot).not.toHaveTextContent(/null/)
    expect(foot.querySelector('.odc-pagination-range')).toBeEmptyDOMElement()
  })

  it('paints the range once the total arrives', () => {
    renderCards({ pagination: { currentPage: 1, pageSize: 10, total: 35, totalPages: 4 } })
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–10 of 35')
  })

  it('has no literal colour left in its styles', () => {
    expect(stylesSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(cardCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
