/* eslint-disable import/first */
// redesign UC-B4 (decision 1, auditor #13): the Overview section of the customer panel. Dates and prices come out of the
// REAL UtilsProviders (parseDate, parsePrice); the contexts they read are mocked.
import React from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import moment from 'moment'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ configs: {} }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils
  }
})

import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { CustomerOverview } from '../CustomerOverview'

const CASH = { addon_cash_wallet_and_refunds: { value: '1' } }
const POINTS = { addon_points_and_levels: { value: '1' } }

const customer = {
  id: 41,
  name: 'Olivia',
  lastname: 'Bennett',
  email: 'olivia@example.com',
  cellphone: '5550100',
  country_phone_code: '1',
  email_verified: true,
  phone_verified: true,
  orders_count: 12,
  loyalty_level: { id: 3, name: 'Gold' },
  created_at: '2025-03-04 10:00:00',
  wallets: [
    { type: 'cash', balance: 12.5 },
    { type: 'credit_point', balance: 1250 }
  ]
}

const renderOverview = (props = {}) => {
  const onGoTo = vi.fn()
  const view = render(
    <UtilsProviders>
      <CustomerOverview user={customer} configs={{ ...CASH, ...POINTS }} onGoTo={onGoTo} {...props} />
    </UtilsProviders>
  )
  return { ...view, onGoTo }
}

const block = name => screen.getByRole('region', { name })

let writeText
beforeEach(() => {
  mocks.configs = {}
  writeText = vi.fn().mockResolvedValue(undefined)
})

// user-event installs its own clipboard on `setup()`, so the spy goes in after it
const start = (options) => {
  const user = userEvent.setup(options)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return user
}
afterEach(() => { cleanup() })

describe('CustomerOverview contact', () => {
  it('shows the email and the phone, each marked Verified when it is', () => {
    renderOverview()
    const contact = block('Contact')
    expect(within(contact).getByText('olivia@example.com')).toBeInTheDocument()
    expect(within(contact).getByText('+1 5550100')).toBeInTheDocument()
    expect(within(contact).getAllByText('Verified')).toHaveLength(2)
  })

  it('marks only what is verified', () => {
    renderOverview({ user: { ...customer, email_verified: false } })
    const contact = block('Contact')
    expect(within(contact).getAllByText('Verified')).toHaveLength(1)
    const phoneRow = within(contact).getByText('+1 5550100').closest('.ucp-row')
    expect(within(phoneRow).getByText('Verified')).toBeInTheDocument()
  })

  it('a missing email or phone says so and has no copy button', () => {
    renderOverview({ user: { ...customer, email: '', cellphone: null, email_verified: false, phone_verified: false } })
    const contact = block('Contact')
    expect(within(contact).queryByText('Verified')).toBeNull()
    expect(within(contact).queryByRole('button', { name: 'Copy email' })).toBeNull()
    expect(within(contact).queryByRole('button', { name: 'Copy phone' })).toBeNull()
    expect(within(contact).getAllByText('—')).toHaveLength(2)
  })

  // redesign stores 5.18 (review F2): the copy buttons are P/CopyButton (iconOnly, `announce={false}`); the block says
  // the result in its own line, as before
  it('copies the email and the phone and says «Copied» in a status', async () => {
    const user = start()
    renderOverview()
    const contact = block('Contact')
    const status = within(contact).getByRole('status')
    expect(status).toHaveTextContent('')

    await user.click(within(contact).getByRole('button', { name: 'Copy email' }))
    expect(writeText).toHaveBeenLastCalledWith('olivia@example.com')
    expect(status).toHaveTextContent('Copied')

    await user.click(within(contact).getByRole('button', { name: 'Copy phone' }))
    expect(writeText).toHaveBeenLastCalledWith('+1 5550100')
    expect(status).toHaveTextContent('Copied')
  })

  it('says so when the clipboard refuses, instead of «Copied»', async () => {
    const user = start()
    writeText.mockRejectedValueOnce(new Error('denied'))
    renderOverview()
    const contact = block('Contact')
    await user.click(within(contact).getByRole('button', { name: 'Copy email' }))
    expect(within(contact).getByRole('status')).not.toHaveTextContent('Copied')
    expect(within(contact).getByRole('status')).toHaveTextContent("We couldn't copy")
  })

  it('forgets «Copied» after a moment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = start({ advanceTimers: vi.advanceTimersByTime })
      renderOverview()
      const contact = block('Contact')
      await user.click(within(contact).getByRole('button', { name: 'Copy email' }))
      expect(within(contact).getByRole('status')).toHaveTextContent('Copied')
      act(() => { vi.advanceTimersByTime(5000) })
      expect(within(contact).getByRole('status')).toHaveTextContent('')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('CustomerOverview figures', () => {
  it('shows the orders, the balances and the loyalty level, each figure in .odc-figure', () => {
    renderOverview()
    const account = block('Account')
    const orders = within(account).getByText('Orders').closest('.ucp-row')
    expect(orders.querySelector('.odc-figure')).toHaveTextContent('12')
    const cash = within(account).getByText('Cash balance').closest('.ucp-row')
    expect(cash.querySelector('.odc-figure')).toHaveTextContent('$ 12,50')
    const points = within(account).getByText('Points balance').closest('.ucp-row')
    expect(points.querySelector('.odc-figure')).toHaveTextContent(/^1.?250$/)
    const level = within(account).getByText('Loyalty level').closest('.ucp-row')
    expect(level).toHaveTextContent('Gold')
  })

  it('points are a number, never money', () => {
    renderOverview()
    const points = within(block('Account')).getByText('Points balance').closest('.ucp-row')
    expect(points.textContent).not.toMatch(/[$€£]/)
    expect(points.textContent).not.toMatch(/,00/)
  })

  it('a negative cash balance keeps its minus sign in front of the currency', () => {
    renderOverview({ user: { ...customer, wallets: [{ type: 'cash', balance: -5 }] }, configs: CASH })
    const cash = within(block('Account')).getByText('Cash balance').closest('.ucp-row')
    expect(cash.querySelector('.odc-figure')).toHaveTextContent('-$ 5,00')
  })

  it('no orders reads «New»', () => {
    renderOverview({ user: { ...customer, orders_count: 0 } })
    const orders = within(block('Account')).getByText('Orders').closest('.ucp-row')
    expect(orders.querySelector('.odc-figure')).toHaveTextContent('New')
  })

  it('a customer the API gave no count for reads «New» too', () => {
    renderOverview({ user: { ...customer, orders_count: undefined } })
    const orders = within(block('Account')).getByText('Orders').closest('.ucp-row')
    expect(orders.querySelector('.odc-figure')).toHaveTextContent('New')
  })

  // main (): both balances show in every project, whatever its add-ons
  it('both balance rows show with or without the add-ons', () => {
    renderOverview({ configs: {} })
    const account = block('Account')
    expect(within(account).getByText('Cash balance')).toBeInTheDocument()
    expect(within(account).getByText('Points balance')).toBeInTheDocument()
    expect(within(account).getAllByRole('button', { name: 'Adjust balance' })).toHaveLength(2)
  })

  it('a wallet the customer does not have yet is a dash, not a made-up zero', () => {
    renderOverview({ user: { ...customer, wallets: [] } })
    const cash = within(block('Account')).getByText('Cash balance').closest('.ucp-row')
    expect(cash).toHaveTextContent('—')
  })

  it('no loyalty level is a dash', () => {
    renderOverview({ user: { ...customer, loyalty_level: null } })
    const level = within(block('Account')).getByText('Loyalty level').closest('.ucp-row')
    expect(level).toHaveTextContent('—')
  })

  it('Member since goes through parseDate (never ISO) and is a figure', () => {
    renderOverview()
    const row = within(block('Account')).getByText('Member since').closest('.ucp-row')
    const expected = moment.utc('2025-03-04 10:00:00', 'YYYY-MM-DD HH:mm:ss').local().format('DD MMM YYYY')
    expect(row.querySelector('.odc-figure')).toHaveTextContent(expected)
    expect(row.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('without created_at there is no Member since row', () => {
    renderOverview({ user: { ...customer, created_at: undefined } })
    expect(within(block('Account')).queryByText('Member since')).toBeNull()
  })

  it('has nothing to edit: no input, no textbox', () => {
    renderOverview()
    expect(document.querySelector('input, textarea, select')).toBeNull()
  })
})

describe('CustomerOverview shortcuts', () => {
  it('View orders goes to the Orders section', async () => {
    const user = userEvent.setup()
    const { onGoTo } = renderOverview()
    await user.click(screen.getByRole('button', { name: 'View orders' }))
    expect(onGoTo).toHaveBeenCalledWith('orders')
  })

  it('Adjust balance goes to the wallet of its own balance', async () => {
    const user = userEvent.setup()
    const { onGoTo } = renderOverview()
    const account = block('Account')
    const cash = within(account).getByText('Cash balance').closest('.ucp-row')
    const points = within(account).getByText('Points balance').closest('.ucp-row')
    await user.click(within(cash).getByRole('button', { name: 'Adjust balance' }))
    expect(onGoTo).toHaveBeenLastCalledWith('wallet', { wallet: 'cash' })
    await user.click(within(points).getByRole('button', { name: 'Adjust balance' }))
    expect(onGoTo).toHaveBeenLastCalledWith('wallet', { wallet: 'points' })
  })

  // redesign apply-list row 20 (users-customers P-6, D-37): points in 5 clicks, with the same confirmation of the Wallet section
  it('the points row has «Add points», which opens the points wallet in Add mode; cash keeps only Adjust balance', async () => {
    const user = userEvent.setup()
    const { onGoTo } = renderOverview()
    const account = block('Account')
    const cash = within(account).getByText('Cash balance').closest('.ucp-row')
    const points = within(account).getByText('Points balance').closest('.ucp-row')
    expect(within(cash).queryByRole('button', { name: 'Add points' })).toBeNull()
    const add = within(points).getByRole('button', { name: 'Add points' })
    expect(add).toHaveAccessibleDescription(/Points balance/)
    expect(within(points).getByRole('button', { name: 'Adjust balance' })).toBeInTheDocument()
    await user.click(add)
    expect(onGoTo).toHaveBeenLastCalledWith('wallet', { wallet: 'points', mode: 'add' })
  })

  it('«Add points» is there without the points add-on too (main, )', () => {
    renderOverview({ configs: CASH })
    expect(screen.getByRole('button', { name: 'Add points' })).toBeInTheDocument()
  })

  it('the two Adjust balance buttons say which balance they are for', () => {
    renderOverview()
    const account = block('Account')
    const cash = within(account).getByText('Cash balance').closest('.ucp-row')
    const button = within(cash).getByRole('button', { name: 'Adjust balance' })
    expect(button).toHaveAccessibleDescription(/Cash balance/)
  })
})

describe('CustomerOverview photo (UC-R2, parity with main)', () => {
  it('starts with the customer photo, decorative because the name is the title', () => {
    const { container } = renderOverview({ user: { ...customer, photo: 'https://example.com/olivia.png' } })
    const avatar = container.querySelector('.ucp-overview > :first-child .odc-avatar')
    expect(avatar).not.toBeNull()
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(avatar.querySelector('img')).toHaveAttribute('src', 'https://example.com/olivia.png')
  })

  it('without a photo it falls back to the initials of the name', () => {
    const { container } = renderOverview()
    const avatar = container.querySelector('.ucp-overview > :first-child .odc-avatar')
    expect(avatar).toHaveTextContent('OB')
    expect(avatar.querySelector('img')).toBeNull()
  })

  it('a customer with neither photo nor name gets the glyph, never initials of «No name»', () => {
    const { container } = renderOverview({ user: { ...customer, name: '', lastname: '', photo: null } })
    const avatar = container.querySelector('.odc-avatar')
    expect(avatar.textContent).toBe('')
    expect(avatar.querySelector('svg')).not.toBeNull()
  })

  it('adds no accessible name of its own: the Contact and Account regions are still the only landmarks', () => {
    renderOverview({ user: { ...customer, photo: 'https://example.com/olivia.png' } })
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getAllByRole('region')).toHaveLength(2)
  })
})

describe('CustomerOverview definition lists (UC-R2 M3-1)', () => {
  it('every row is a div holding only dt and dd, and the buttons live inside a dd', () => {
    const { container } = renderOverview()
    const lists = container.querySelectorAll('dl')
    expect(lists).toHaveLength(2)
    for (const list of lists) {
      for (const row of list.children) {
        expect(row.tagName).toBe('DIV')
        expect([...row.children].map(child => child.tagName)).toEqual(['DT', 'DD'])
      }
    }
    for (const button of container.querySelectorAll('button')) {
      expect(button.closest('dd')).not.toBeNull()
      expect(button.parentElement.closest('dl')).not.toBeNull()
    }
    expect(container.querySelectorAll('dl button')).toHaveLength(container.querySelectorAll('button').length)
  })

  it('each dt has exactly one dd in its row, including the rows with a shortcut', () => {
    const { container } = renderOverview()
    for (const row of container.querySelectorAll('.ucp-row')) {
      expect(row.querySelectorAll(':scope > dt')).toHaveLength(1)
      expect(row.querySelectorAll(':scope > dd')).toHaveLength(1)
    }
  })
})
