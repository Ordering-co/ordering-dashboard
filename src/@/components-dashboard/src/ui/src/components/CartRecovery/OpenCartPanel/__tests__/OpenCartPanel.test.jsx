/* eslint-disable import/first */
// redesign OC-E: the panel of an open cart (RecordPanel). The date comes out of the REAL UtilsProviders (parseDate);
// the sibling pieces it reuses as they are (ProductItemAccordion, OpenCartBill) and the contact actions of OC-C
// (useCartContact) are stubs, so this test pins what the panel passes to them, not what they paint.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import moment from 'moment'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ configs: {}, level: 0, actions: [], translations: {} }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [{ dictionary: {} }, (key, text) => mocks.translations[key] ?? text],
    useUtils,
    useConfig: () => [{ configs: mocks.configs }],
    useSession: () => [{ user: { level: mocks.level } }]
  }
})
vi.mock('../../ProductItemAccordion', () => ({
  ProductItemAccordion: ({ product, toppingsRemoved, isCartProduct }) => (
    <div
      data-testid='product'
      data-name={product.name}
      data-cart-product={String(!!isCartProduct)}
      data-removed={toppingsRemoved ? JSON.stringify(toppingsRemoved) : ''}
    />
  )
}))
vi.mock('../../OpenCartBill', () => ({
  OpenCartBill: ({ cart }) => <div data-testid='bill' data-total={cart?.total} />
}))
vi.mock('../../OpenCartsQueue/useCartContact', () => ({
  useCartContact: () => ({ actions: mocks.actions, contact: {} })
}))

import { stringToSlug } from '../../../../utils/stringToSlug'
import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { OpenCartPanel } from '../index'

const cart = {
  id: 18118,
  uuid: 'uuid-1',
  user_id: 77,
  status: 0,
  updated_at: '2026-10-09 14:05:00',
  business_id: 5,
  user: { name: 'Grace', lastname: 'Okafor', email: 'grace@example.com', cellphone: '555-0100' },
  business: { name: 'Panera' }
}
const detail = {
  ...cart,
  total: 34.2,
  user: { ...cart.user, address: '12 Pine St, Miami' },
  business: { name: 'Panera', logo: 'logo.png', phone: '555-0199', email: 'panera@example.com', address: '1 Ocean Dr' },
  products: [
    { id: 1, code: 'a1', name: 'Hamburger', quantity: 2 },
    { id: 2, code: 'b2', name: 'Fries', quantity: 1 }
  ],
  toppings_removed: { a1: [{ name: 'Onion' }] }
}

const renderPanel = (props = {}) => {
  const handlers = { onClose: vi.fn(), onRetry: vi.fn(), onDelete: vi.fn().mockResolvedValue({ ok: true, error: null }), onExpandedChange: vi.fn() }
  const view = render(
    <MemoryRouter>
      <UtilsProviders>
        <OpenCartPanel
          cart={cart}
          detail={detail}
          detailState={{ loading: false, error: null }}
          rules={{ loading: false, total: 8, enabled: 0 }}
          expanded={false}
          {...handlers}
          {...props}
        />
      </UtilsProviders>
    </MemoryRouter>
  )
  return { ...view, ...handlers }
}

beforeEach(() => { mocks.configs = {}; mocks.level = 0; mocks.actions = []; mocks.translations = {} })
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const block = name => screen.getByRole('region', { name })

describe('OpenCartPanel header', () => {
  it('names the cart, shows its status and the last activity with the business', () => {
    renderPanel()
    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveTextContent('Cart #18118')
    expect(title.querySelector('.odc-figure')).toHaveTextContent('18118')
    const status = document.querySelector('.odc-status')
    expect(status).toHaveTextContent('Open')
    expect(status).toHaveAttribute('data-family', 'pending')
    const when = moment.utc('2026-10-09 14:05:00', 'YYYY-MM-DD HH:mm:ss').local().format('DD MMM YYYY HH:mm')
    const subtitle = document.querySelector('.odc-record-subtitle')
    expect(subtitle).toHaveTextContent(`Last activity ${when} · Panera`)
    expect(subtitle.querySelector('.odc-figure')).toHaveTextContent(when)
    expect(subtitle.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('a failed payment is the cancel family', () => {
    renderPanel({ cart: { ...cart, status: 4 }, detail: { ...detail, status: 4 } })
    const status = document.querySelector('.odc-status')
    expect(status).toHaveTextContent('Payment failed')
    expect(status).toHaveAttribute('data-family', 'cancel')
  })

  it('closes from the close button', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('expands and collapses through onExpandedChange (parity with the old Expand button)', async () => {
    const user = userEvent.setup()
    const { onExpandedChange, rerender } = renderPanel()
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(onExpandedChange).toHaveBeenCalledWith(true)
    rerender(
      <MemoryRouter>
        <UtilsProviders>
          <OpenCartPanel cart={cart} detail={detail} detailState={{ loading: false }} expanded onExpandedChange={onExpandedChange} />
        </UtilsProviders>
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(false)
  })
})

describe('OpenCartPanel customer', () => {
  it('shows name, email, phone and address', () => {
    renderPanel()
    const customer = block('Customer')
    expect(within(customer).getByText('Grace Okafor')).toBeInTheDocument()
    expect(within(customer).getByText('grace@example.com')).toBeInTheDocument()
    expect(within(customer).getByText('555-0100')).toBeInTheDocument()
    expect(within(customer).getByText('12 Pine St, Miami')).toBeInTheDocument()
  })

  it('a guest is named as one and has no contact lines', () => {
    renderPanel({
      cart: { ...cart, user: { name: null } },
      detail: { ...detail, user: { name: null, email: null, cellphone: null, phone: null } }
    })
    const customer = block('Customer')
    expect(within(customer).getByText('Guest · no contact details')).toBeInTheDocument()
    expect(customer.querySelector('.ocp-lines')).toBeNull()
  })

  it('draws the actions of useCartContact as buttons, the first one primary', async () => {
    const user = userEvent.setup()
    const email = vi.fn()
    const copy = vi.fn()
    mocks.actions = [
      { key: 'email', label: 'Email customer', onSelect: email },
      { key: 'copy-phone', label: 'Copy phone', onSelect: copy }
    ]
    renderPanel()
    const customer = block('Customer')
    const first = within(customer).getByRole('button', { name: 'Email customer' })
    expect(first).toHaveAttribute('data-variant', 'primary')
    expect(within(customer).getByRole('button', { name: 'Copy phone' })).toHaveAttribute('data-variant', 'secondary')
    await user.click(first)
    expect(email).toHaveBeenCalledTimes(1)
    await user.click(within(customer).getByRole('button', { name: 'Copy phone' }))
    expect(copy).toHaveBeenCalledTimes(1)
  })
})

describe('OpenCartPanel business', () => {
  it('shows name, phone, email and address, and Call business dials the phone', () => {
    renderPanel()
    const business = block('Business')
    expect(within(business).getByText('Panera')).toBeInTheDocument()
    expect(within(business).getByText('555-0199')).toBeInTheDocument()
    expect(within(business).getByText('panera@example.com')).toBeInTheDocument()
    expect(within(business).getByText('1 Ocean Dr')).toBeInTheDocument()
    expect(within(business).getByRole('link', { name: 'Call business' })).toHaveAttribute('href', 'tel:555-0199')
  })

  it('falls back to the cellphone for Call business', () => {
    renderPanel({ detail: { ...detail, business: { ...detail.business, phone: null, cellphone: '555-0123' } } })
    expect(within(block('Business')).getByRole('link', { name: 'Call business' })).toHaveAttribute('href', 'tel:555-0123')
  })

  it('without a phone there is no Call business', () => {
    renderPanel({ detail: { ...detail, business: { name: 'Panera', phone: null, cellphone: null } } })
    const business = block('Business')
    expect(within(business).getByText('Panera')).toBeInTheDocument()
    expect(within(business).queryByRole('link', { name: 'Call business' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Call business' })).toBeNull()
  })

  it('stays out of the way of a business owner (level 2), as the old panel did', () => {
    mocks.level = 2
    renderPanel()
    expect(screen.queryByRole('region', { name: 'Business' })).toBeNull()
  })
})

describe('OpenCartPanel items and bill', () => {
  it('lists every product with its removed toppings and then the bill of the detail', () => {
    renderPanel()
    const items = screen.getByRole('region', { name: 'In the cart · 2 items' })
    const products = within(items).getAllByTestId('product')
    expect(products.map(node => node.dataset.name)).toEqual(['Hamburger', 'Fries'])
    expect(products[0]).toHaveAttribute('data-cart-product', 'true')
    expect(products[0].dataset.removed).toBe(JSON.stringify([{ name: 'Onion' }]))
    expect(products[1].dataset.removed).toBe('')
    expect(within(items).getByTestId('bill')).toHaveAttribute('data-total', '34.2')
    expect(items.querySelector('.odc-figure')).toHaveTextContent('2')
  })

  // main the same product twice (two lines with other options) is two lines, each with its own key (the line's code)
  it('keeps two lines of the same product apart, with a key per line', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      renderPanel({
        detail: {
          ...detail,
          products: [
            { id: 1, code: 'a1', name: 'Hamburger', quantity: 1 },
            { id: 1, code: 'a2', name: 'Hamburger', quantity: 1 }
          ]
        }
      })
      expect(within(screen.getByRole('region', { name: 'In the cart · 2 items' })).getAllByTestId('product')).toHaveLength(2)
      expect(errors.mock.calls.some(args => args.join(' ').includes('same key'))).toBe(false)
    } finally {
      errors.mockRestore()
    }
  })

  it('says one item in the singular and never paints a bare 0 for an empty cart (M-13)', () => {
    const { rerender } = renderPanel({ detail: { ...detail, products: [detail.products[0]] } })
    expect(screen.getByRole('region', { name: 'In the cart · 1 item' })).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <UtilsProviders>
          <OpenCartPanel cart={cart} detail={{ ...detail, products: [] }} detailState={{ loading: false }} />
        </UtilsProviders>
      </MemoryRouter>
    )
    const items = screen.getByRole('region', { name: 'In the cart · 0 items' })
    expect(within(items).getByText('No items in this cart.')).toBeInTheDocument()
    expect(within(items).queryAllByTestId('product')).toHaveLength(0)
  })
})

describe('OpenCartPanel recovery', () => {
  it('says automatic recovery is off when no rule is on, with the way to the rules', () => {
    renderPanel({ rules: { loading: false, total: 8, enabled: 0 } })
    const recovery = block('Recovery')
    expect(recovery).toHaveTextContent('Automatic recovery is off for this project (0 of 8 rules on).')
    expect(within(recovery).getByRole('link', { name: 'Manage rules' })).toHaveAttribute('href', '/cart-recovery/recovery-actions')
  })

  it('counts the rules that are on', () => {
    renderPanel({ rules: { loading: false, total: 8, enabled: 3 } })
    const recovery = block('Recovery')
    expect(recovery).toHaveTextContent('3 of 8 rules on')
    expect(recovery).not.toHaveTextContent('is off')
    expect(recovery.querySelectorAll('.odc-figure')).toHaveLength(2)
    expect(within(recovery).getByRole('link', { name: 'Manage rules' })).toBeInTheDocument()
  })

  it('keeps the link while the rules load, without a count', () => {
    renderPanel({ rules: { loading: true, total: 0, enabled: 0 } })
    const recovery = block('Recovery')
    expect(recovery).not.toHaveTextContent('rules on')
    expect(within(recovery).getByRole('link', { name: 'Manage rules' })).toBeInTheDocument()
  })
})

describe('OpenCartPanel loading and error', () => {
  it('paints skeleton blocks while the detail loads, never the not-found message (M-7)', () => {
    renderPanel({ detail: undefined, detailState: { loading: true, error: null } })
    expect(document.querySelector('[aria-busy="true"] .odc-skeleton')).not.toBeNull()
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/couldn't find|not found|Go to Orders/i)
    expect(screen.queryByTestId('bill')).toBeNull()
    // the header is already the cart's own
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Cart #18118')
  })

  it('a detail that has not been asked for yet is loading too, not missing', () => {
    renderPanel({ detail: undefined, detailState: undefined })
    expect(document.querySelector('[aria-busy="true"] .odc-skeleton')).not.toBeNull()
    expect(document.body).not.toHaveTextContent(/couldn't find|not found/i)
  })

  it('keeps the detail on screen while it reloads', () => {
    renderPanel({ detailState: { loading: true, error: null } })
    expect(screen.getByTestId('bill')).toBeInTheDocument()
    expect(document.querySelector('.odc-skeleton')).toBeNull()
  })

  it('an error says so inside the panel and Retry asks again', async () => {
    const user = userEvent.setup()
    const { onRetry } = renderPanel({ detail: undefined, detailState: { loading: false, error: ['Network down'] } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this cart.")
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('bill')).toBeNull()
  })
})

// redesign OC-F2 (OC-Q1-09): a detail that fails takes away the items and the bill, not what the row already knows
describe('OpenCartPanel when the detail fails', () => {
  const failedProps = (error = ['Network down']) => ({ detail: undefined, detailState: { loading: false, error } })

  it('still shows the customer, their contact lines and the contact buttons from the row', async () => {
    const user = userEvent.setup()
    const email = vi.fn()
    mocks.actions = [{ key: 'email', label: 'Email customer', onSelect: email }]
    renderPanel(failedProps())
    const customer = block('Customer')
    expect(within(customer).getByText('Grace Okafor')).toBeInTheDocument()
    expect(within(customer).getByText('grace@example.com')).toBeInTheDocument()
    expect(within(customer).getByText('555-0100')).toBeInTheDocument()
    await user.click(within(customer).getByRole('button', { name: 'Email customer' }))
    expect(email).toHaveBeenCalledTimes(1)
  })

  it('still shows the business the row knows', () => {
    renderPanel({ ...failedProps(), cart: { ...cart, business: { name: 'Panera', phone: '555-0199' } } })
    const business = block('Business')
    expect(within(business).getByText('Panera')).toBeInTheDocument()
    expect(within(business).getByRole('link', { name: 'Call business' })).toHaveAttribute('href', 'tel:555-0199')
  })

  it('puts the error and Retry where the items and the bill go, and nowhere else', async () => {
    const user = userEvent.setup()
    const { onRetry } = renderPanel(failedProps())
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this cart.")
    expect(block('Customer')).not.toContainElement(alert)
    expect(block('Business')).not.toContainElement(alert)
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('bill')).toBeNull()
    expect(screen.queryByTestId('product')).toBeNull()
    // the recovery block and the header are still there
    expect(screen.getByRole('region', { name: 'Recovery' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Cart #18118')
  })

  it('never shows the raw text of a network failure: it says what it can say', () => {
    renderPanel(failedProps(['Failed to fetch']))
    expect(document.body).not.toHaveTextContent('Failed to fetch')
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load this cart.")
  })

  it('says what the API said when the project has it translated', () => {
    mocks.translations = { [stringToSlug('Cart not found').toUpperCase()]: 'This cart no longer exists.' }
    renderPanel(failedProps(['Cart not found']))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this cart.")
    expect(alert).toHaveTextContent('This cart no longer exists.')
    expect(alert).not.toHaveTextContent('Cart not found')
  })

  it('says nothing at all of an error without text', () => {
    renderPanel(failedProps(undefined))
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load this cart.")
  })
})

describe('OpenCartPanel delete', () => {
  const openDialog = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete cart' }))
    return screen.findByRole('alertdialog')
  }

  it('«Delete cart» is a danger item of the ⋯ menu and asks first, naming the cart', async () => {
    const user = userEvent.setup()
    const { onDelete } = renderPanel()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Delete cart' })).toHaveAttribute('data-tone', 'danger')
    await user.click(screen.getByRole('menuitem', { name: 'Delete cart' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Delete cart #18118?' })).toBeInTheDocument()
    expect(within(dialog).getByText("This empties the customer's cart. This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete cart' })).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('Cancel leaves the cart alone', async () => {
    const user = userEvent.setup()
    const { onDelete, onClose } = renderPanel()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('confirming deletes the cart, then closes the panel', async () => {
    const user = userEvent.setup()
    const { onDelete, onClose } = renderPanel()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete cart' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(cart)
  })

  it('is busy while deleting: nothing can be repeated or cancelled', async () => {
    const user = userEvent.setup()
    let finish
    const onDelete = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const { onClose } = renderPanel({ onDelete })
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete cart' }))
    await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete cart' })).toHaveAttribute('aria-busy', 'true'))
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(onDelete).toHaveBeenCalledTimes(1)
    finish({ ok: true, error: null })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('an API error is shown inside the dialog, which stays open and can try again', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['The cart could not be cleared'] })
      .mockResolvedValueOnce({ ok: true, error: null })
    const { onClose } = renderPanel({ onDelete })
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete cart' }))
    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert')
    expect(alert).toHaveTextContent('The cart could not be cleared')
    expect(onClose).not.toHaveBeenCalled()
    const again = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete cart' })
    expect(again).not.toHaveAttribute('aria-busy', 'true')
    await user.click(again)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onDelete).toHaveBeenCalledTimes(2)
  })

  it('an error without text says something instead of nothing', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue({ ok: false, error: null })
    renderPanel({ onDelete })
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete cart' }))
    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert')
    expect(alert).toHaveTextContent("We couldn't delete this cart. Try again.")
  })

  it('a request that throws is an error too, not an unhandled rejection', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockRejectedValue(new Error('boom'))
    const { onClose } = renderPanel({ onDelete })
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete cart' }))
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('reopening the dialog starts without the old error', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue({ ok: false, error: ['Nope'] })
    renderPanel({ onDelete })
    let dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete cart' }))
    await within(screen.getByRole('alertdialog')).findByRole('alert')
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    dialog = await openDialog(user)
    expect(within(dialog).queryByRole('alert')).toBeNull()
  })
})
