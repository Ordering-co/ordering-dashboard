/* eslint-disable import/first */
// redesign UC-B4 (decisions 1 and 6; auditor #3, #10, #13, #15, #16): the customer panel, a RecordPanel with sections.
// The controller (K/UserDetails) and the legacy content pieces are stubs that record the props the panel gives them; the
// Product wrappers (RecordPanel, SectionNav, Menu, Dialog, ConfirmDialog, Switch) and the Overview are the real ones.
import React, { useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: {},
  sessionUser: { id: 1, level: 0 },
  userState: null,
  controllerProps: null,
  controllerMounts: 0,
  handleDeleteUser: null,
  handleSuccessUserUpdate: null,
  orders: null,
  addresses: null,
  profile: null,
  pushTokens: null,
  students: null,
  metaFields: null
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  const Controller = (props) => {
    const { UIComponent } = props
    React.useEffect(() => { mocks.controllerMounts += 1 }, [])
    mocks.controllerProps = props
    return (
      <UIComponent
        {...props}
        userState={mocks.userState}
        handleDeleteUser={mocks.handleDeleteUser}
        handleSuccessUserUpdate={mocks.handleSuccessUserUpdate}
      />
    )
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils,
    useConfig: () => [{ configs: mocks.configs }],
    useSession: () => [{ user: mocks.sessionUser }],
    UserDetails: Controller
  }
})
vi.mock('../../../Orders/OrdersManager', () => ({
  OrdersManager: (props) => { mocks.orders = props; return <div data-testid='orders' /> }
}))
vi.mock('../../../Delivery/AddressList', () => ({
  AddressList: (props) => { mocks.addresses = props; return <div data-testid='addresses' /> }
}))
vi.mock('../../UserProfileForm', () => ({
  UserProfileForm: (props) => {
    mocks.profile = props
    return (
      <div data-testid='profile' data-extra={props['data-extra']}>
        <input aria-label='Name' />
        <button type='button' onClick={() => props.onDirtyChange?.(true)}>make dirty</button>
        <button type='button' onClick={() => props.onDirtyChange?.(false)}>make clean</button>
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: 41, level: 1 })}>save profile</button>
      </div>
    )
  }
}))
vi.mock('../../UserMetaFields', () => ({
  UserMetaFields: (props) => { mocks.metaFields = props; return <div data-testid='meta-fields' /> }
}))
vi.mock('../../../Shared/PushTokens', () => ({
  PushTokens: (props) => { mocks.pushTokens = props; return <div data-testid='push-tokens' /> }
}))
vi.mock('../../../Schools/SchoolUserStudents', () => ({
  SchoolUserStudents: (props) => { mocks.students = props; return <div data-testid='students' /> }
}))

import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { CustomerPanel } from '../CustomerPanel'

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
  phone_verified: false,
  enabled: true,
  level: 3,
  orders_count: 12,
  loyalty_level: { id: 3, name: 'Gold' },
  created_at: '2025-03-04 10:00:00',
  addresses: [{ id: 5, address: '1 Main St' }],
  push_tokens: [{ id: 9, token: 'abc' }],
  wallets: [{ type: 'cash', balance: 12.5 }, { type: 'credit_point', balance: 300 }]
}

let spies
// The page owns the URL state; this host owns it for the test
const Host = ({ initial = {}, ...props }) => {
  const [section, setSection] = useState(initial.section ?? 'overview')
  const [wallet, setWallet] = useState(initial.wallet ?? 'cash')
  const [customFieldsOpen, setCustomFieldsOpen] = useState(Boolean(initial.customFieldsOpen))
  const [expanded, setExpanded] = useState(false)
  return (
    <UtilsProviders>
      <CustomerPanel
        userId={41}
        user={customer}
        configs={mocks.configs}
        section={section}
        onSectionChange={(id) => { spies.onSectionChange(id); setSection(id) }}
        wallet={wallet}
        onWalletChange={(next) => { spies.onWalletChange(next); setWallet(next) }}
        customFieldsOpen={customFieldsOpen}
        onCustomFieldsOpenChange={(open) => { spies.onCustomFieldsOpenChange(open); setCustomFieldsOpen(open) }}
        expanded={expanded}
        onExpandedChange={(next) => { spies.onExpandedChange(next); setExpanded(next) }}
        onClose={spies.onClose}
        onToggleActive={spies.onToggleActive}
        pendingIds={[]}
        handleSuccessUpdate={spies.handleSuccessUpdate}
        handleSuccessDeleteUser={spies.handleSuccessDeleteUser}
        renderWallet={spies.renderWallet}
        {...props}
      />
    </UtilsProviders>
  )
}

beforeEach(() => {
  mocks.configs = {}
  mocks.sessionUser = { id: 1, level: 0 }
  mocks.userState = { user: customer, loading: false, error: null }
  mocks.controllerProps = null
  mocks.controllerMounts = 0
  mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: true, error: null })
  mocks.handleSuccessUserUpdate = vi.fn()
  spies = {
    onSectionChange: vi.fn(),
    onWalletChange: vi.fn(),
    onCustomFieldsOpenChange: vi.fn(),
    onExpandedChange: vi.fn(),
    onClose: vi.fn(),
    onToggleActive: vi.fn(),
    handleSuccessUpdate: vi.fn(),
    handleSuccessDeleteUser: vi.fn(),
    renderWallet: vi.fn(({ wallet }) => <div data-testid='wallet'>{wallet}</div>)
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const nav = () => screen.getByRole('navigation', { name: 'Customer sections' })
const navLabels = () => [...nav().querySelectorAll('.odc-sectionnav-label')].map(node => node.textContent)

describe('CustomerPanel wiring to the controller', () => {
  it('mounts K/UserDetails with the id, the row and the fields the panel needs (auditor #10)', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.userId).toBe(41)
    expect(props.user).toBe(customer)
    expect(props.propsToFetch).toEqual(expect.arrayContaining([
      'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'country_phone_code', 'addresses', 'push_tokens', 'enabled', 'level', 'timezone', 'loyalty_level',
      'orders_count', 'loyalty_level_id', 'wallets'
    ]))
    expect(new Set(props.propsToFetch).size).toBe(props.propsToFetch.length)
  })

  it('gives the controller the way out of a delete, but not the list handler (the panel calls that one itself)', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.handleSuccessDeleteUser).toBe(spies.handleSuccessDeleteUser)
    expect(props.onClose).toBe(spies.onClose)
    expect(props.handleSuccessUpdate).toBeUndefined()
  })
})

describe('CustomerPanel header', () => {
  it('names the customer, with the email and the #id as the subtitle', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Olivia Bennett')
    const subtitle = document.querySelector('.odc-record-subtitle')
    expect(subtitle).toHaveTextContent('olivia@example.com · #41')
    expect(subtitle.querySelector('.odc-figure')).toHaveTextContent('#41')
  })

  it('without an email the subtitle is only the id', () => {
    render(<Host user={{ ...customer, email: null }} />)
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent(/^#41$/)
  })

  it('a customer without a name is named as such, never an empty title', () => {
    mocks.userState = { user: { ...customer, name: '', lastname: '' }, loading: false, error: null }
    render(<Host user={{ ...customer, name: '', lastname: '' }} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No name')
  })

  it('the status switch is the one of the row: Active, and it asks the host to toggle', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const toggle = screen.getByRole('switch', { name: 'Active' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    expect(spies.onToggleActive).toHaveBeenCalledWith(customer, false)
  })

  it('reads the row, not the copy the controller loaded earlier (the list changed it)', () => {
    render(<Host user={{ ...customer, enabled: false }} />)
    const toggle = screen.getByRole('switch', { name: 'Inactive' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('the switch is busy while its id is pending', async () => {
    const user = userEvent.setup()
    render(<Host pendingIds={[41]} />)
    const toggle = screen.getByRole('switch', { name: 'Active' })
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    await user.click(toggle)
    expect(spies.onToggleActive).not.toHaveBeenCalled()
  })

  it('without a row (opened by ?id=) it uses what the controller loaded', () => {
    render(<Host user={null} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Olivia Bennett')
    expect(screen.getByRole('switch', { name: 'Active' })).toBeInTheDocument()
  })

  it('closes from the close button', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('opens as a page and goes back through onExpandedChange', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onExpandedChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(spies.onExpandedChange).toHaveBeenLastCalledWith(false)
  })
})

describe('CustomerPanel sections', () => {
  // main (): Wallet does not depend on the cash or points add-on
  it('without add-ons: Overview, Orders (with its count), Wallet, Saved places, Profile, Push tokens', () => {
    render(<Host />)
    expect(navLabels()).toEqual(['Overview', 'Orders', 'Wallet', 'Saved places', 'Profile', 'Push tokens'])
    const orders = within(nav()).getByRole('button', { name: /Orders/ })
    expect(orders).toHaveTextContent('12')
  })

  it.each([
    ['cash', CASH],
    ['points', POINTS],
    ['both', { ...CASH, ...POINTS }]
  ])('the %s add-on keeps Wallet', (_name, configs) => {
    mocks.configs = configs
    render(<Host />)
    expect(navLabels()).toEqual(['Overview', 'Orders', 'Wallet', 'Saved places', 'Profile', 'Push tokens'])
  })

  it('the Schools module brings School students at the end', () => {
    mocks.configs = { school_module_enabled: { value: '1' } }
    render(<Host />)
    expect(navLabels()).toEqual(['Overview', 'Orders', 'Wallet', 'Saved places', 'Profile', 'Push tokens', 'School students'])
  })

  it('marks the current section and asks the host for another one', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    await user.click(within(nav()).getByRole('button', { name: 'Profile' }))
    expect(spies.onSectionChange).toHaveBeenCalledWith('profile')
    expect(within(nav()).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('profile')).toBeInTheDocument()
  })

  it('a section the project does not have (a link to School students without the module) falls back to the Overview', () => {
    render(<Host initial={{ section: 'school_students' }} />)
    expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByTestId('students')).toBeNull()
    expect(screen.getByRole('region', { name: 'Contact' })).toBeInTheDocument()
  })

  it('only the current section is rendered', () => {
    render(<Host initial={{ section: 'orders' }} />)
    expect(screen.getByTestId('orders')).toBeInTheDocument()
    expect(screen.queryByTestId('profile')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Contact' })).toBeNull()
  })

  it('the Overview shows the customer and its shortcuts move the panel', async () => {
    const user = userEvent.setup()
    mocks.configs = { ...CASH, ...POINTS }
    render(<Host />)
    expect(screen.getByRole('region', { name: 'Contact' })).toHaveTextContent('olivia@example.com')
    await user.click(screen.getByRole('button', { name: 'View orders' }))
    expect(spies.onSectionChange).toHaveBeenLastCalledWith('orders')
    expect(screen.getByTestId('orders')).toBeInTheDocument()
  })

  it('«Adjust balance» opens the Wallet section on the balance it belongs to', async () => {
    const user = userEvent.setup()
    mocks.configs = { ...CASH, ...POINTS }
    render(<Host />)
    const points = within(screen.getByRole('region', { name: 'Account' })).getByText('Points balance').closest('.ucp-row')
    await user.click(within(points).getByRole('button', { name: 'Adjust balance' }))
    expect(spies.onWalletChange).toHaveBeenLastCalledWith('points')
    expect(spies.onSectionChange).toHaveBeenLastCalledWith('wallet')
    expect(screen.getByTestId('wallet')).toHaveTextContent('points')
  })

  it('Orders mounts OrdersManager as main does, and opens on Completed (decision 6)', () => {
    render(<Host initial={{ section: 'orders' }} />)
    expect(mocks.orders.isSelectedOrders).toBe(true)
    expect(mocks.orders.customerId).toBe(41)
    expect(mocks.orders.statusGroup).toBe('completed')
    expect(typeof mocks.orders.handleCustomOrderDetail).toBe('function')
  })

  it('«Add points» opens the points wallet with a one-shot add intent that the wallet consumes; «Adjust balance» carries none', async () => {
    const user = userEvent.setup()
    mocks.configs = { ...CASH, ...POINTS }
    render(<Host />)
    const points = within(screen.getByRole('region', { name: 'Account' })).getByText('Points balance').closest('.ucp-row')
    await user.click(within(points).getByRole('button', { name: 'Add points' }))
    expect(spies.onWalletChange).toHaveBeenLastCalledWith('points')
    expect(spies.onSectionChange).toHaveBeenLastCalledWith('wallet')
    const args = spies.renderWallet.mock.calls.at(-1)[0]
    expect(args.wallet).toBe('points')
    expect(args.intent).toMatchObject({ mode: 'add' })
    expect(typeof args.onIntentConsumed).toBe('function')
    act(() => args.onIntentConsumed(args.intent))
    expect(spies.renderWallet.mock.calls.at(-1)[0].intent).toBeNull()
    // later navigation into the Wallet behaves as today
    await user.click(within(nav()).getByRole('button', { name: /Overview/ }))
    const cash = within(screen.getByRole('region', { name: 'Account' })).getByText('Cash balance').closest('.ucp-row')
    await user.click(within(cash).getByRole('button', { name: 'Adjust balance' }))
    expect(spies.renderWallet.mock.calls.at(-1)[0].intent).toBeNull()
  })

  it('an intent nobody consumed does not survive leaving the Wallet', async () => {
    const user = userEvent.setup()
    mocks.configs = { ...CASH, ...POINTS }
    render(<Host />)
    const points = within(screen.getByRole('region', { name: 'Account' })).getByText('Points balance').closest('.ucp-row')
    await user.click(within(points).getByRole('button', { name: 'Add points' }))
    expect(spies.renderWallet.mock.calls.at(-1)[0].intent).toMatchObject({ mode: 'add' })
    await user.click(within(nav()).getByRole('button', { name: /Overview/ }))
    await user.click(within(nav()).getByRole('button', { name: /Wallet/ }))
    expect(spies.renderWallet.mock.calls.at(-1)[0].intent).toBeNull()
  })

  it('Wallet is drawn by the host, with the customer, the wallet and the dirty report', () => {
    mocks.configs = CASH
    render(<Host initial={{ section: 'wallet', wallet: 'cash' }} />)
    expect(screen.getByTestId('wallet')).toHaveTextContent('cash')
    const args = spies.renderWallet.mock.calls.at(-1)[0]
    expect(args.user).toMatchObject({ id: 41 })
    expect(args.wallet).toBe('cash')
    expect(typeof args.onWalletChange).toBe('function')
    expect(typeof args.onDirtyChange).toBe('function')
  })

  it('Saved places mounts AddressList with the props of main, inside the panel', () => {
    render(<Host initial={{ section: 'addresses' }} />)
    const props = mocks.addresses
    expect(props.isSeletectedUserAddresses).toBe(true)
    expect(props.userId).toBe(41)
    expect(props.addresses).toBe(customer.addresses)
    expect(props.userState).toBe(mocks.userState)
    // redesign (row 90, M-UF21): it is the panel's `saved`, not the bare controller callback, so the row refreshes too
    expect(props.handleSuccessUpdate).not.toBe(mocks.handleSuccessUserUpdate)
    expect(typeof props.handleSuccessUpdate).toBe('function')
    expect(props.isEmbedded).toBe(true)
    expect(() => props.setExtraOpen(true)).not.toThrow()
  })

  it('a saved address updates the controller and the list row (redesign row 90, M-UF21)', () => {
    render(<Host initial={{ section: 'addresses' }} />)
    const updated = { id: 41, addresses: [{ id: 7 }] }
    mocks.addresses.handleSuccessUpdate(updated)
    expect(mocks.handleSuccessUserUpdate).toHaveBeenCalledWith(updated)
    expect(spies.handleSuccessUpdate).toHaveBeenCalledWith(updated)
    expect(mocks.handleSuccessUserUpdate.mock.invocationCallOrder[0]).toBeLessThan(spies.handleSuccessUpdate.mock.invocationCallOrder[0])
  })

  it('Push tokens and School students get the customer', () => {
    mocks.configs = { school_module_enabled: { value: '1' } }
    const { unmount } = render(<Host initial={{ section: 'push_tokens' }} />)
    expect(mocks.pushTokens).toMatchObject({ userId: 41, pushTokens: customer.push_tokens })
    unmount()
    render(<Host initial={{ section: 'school_students' }} />)
    expect(mocks.students).toMatchObject({ userId: 41 })
  })

  it('a customer with no push tokens gives an empty list, not undefined', () => {
    mocks.userState = { user: { ...customer, push_tokens: undefined }, loading: false, error: null }
    render(<Host initial={{ section: 'push_tokens' }} />)
    expect(mocks.pushTokens.pushTokens).toEqual([])
  })
})

describe('CustomerPanel profile (auditor #15)', () => {
  it('a saved profile updates the controller and then tells the list, with the same data', async () => {
    const user = userEvent.setup()
    render(<Host initial={{ section: 'profile' }} />)
    expect(mocks.profile.user).toBe(customer)
    await user.click(screen.getByRole('button', { name: 'save profile' }))
    const updated = { id: 41, level: 1 }
    expect(mocks.handleSuccessUserUpdate).toHaveBeenCalledWith(updated)
    expect(spies.handleSuccessUpdate).toHaveBeenCalledWith(updated)
    expect(mocks.handleSuccessUserUpdate.mock.invocationCallOrder[0]).toBeLessThan(spies.handleSuccessUpdate.mock.invocationCallOrder[0])
    expect(mocks.handleSuccessUserUpdate).toHaveBeenCalledTimes(1)
    expect(spies.handleSuccessUpdate).toHaveBeenCalledTimes(1)
  })

  it('forwards profileProps to the form', () => {
    render(<Host initial={{ section: 'profile' }} profileProps={{ 'data-extra': 'yes' }} />)
    expect(screen.getByTestId('profile')).toHaveAttribute('data-extra', 'yes')
  })

  it('tells the host\'s onDirtyChange too', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Host initial={{ section: 'profile' }} profileProps={{ onDirtyChange }} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })
})

describe('CustomerPanel unsaved changes (auditor #16)', () => {
  it('closes at once when nothing is dirty', async () => {
    const user = userEvent.setup()
    render(<Host initial={{ section: 'profile' }} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks before closing with changes in Profile: Keep editing stays, Discard closes', async () => {
    const user = userEvent.setup()
    render(<Host initial={{ section: 'profile' }} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(spies.onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(spies.onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    const again = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(again).getByRole('button', { name: 'Discard' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('a wallet draft guards the close too, and clears when the draft does', async () => {
    const user = userEvent.setup()
    mocks.configs = CASH
    let report
    spies.renderWallet = vi.fn(({ onDirtyChange }) => { report = onDirtyChange; return <div data-testid='wallet' /> })
    render(<Host initial={{ section: 'wallet' }} />)
    const { act } = await import('@testing-library/react')
    act(() => report(true))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    act(() => report(false))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps a dirty section mounted (hidden) when the user goes to another one', async () => {
    const user = userEvent.setup()
    render(<Host initial={{ section: 'profile' }} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(within(nav()).getByRole('button', { name: /^Orders/ }))
    expect(screen.getByTestId('orders')).toBeVisible()
    const profile = screen.getByTestId('profile')
    expect(profile.closest('[hidden]')).not.toBeNull()
    await user.click(within(nav()).getByRole('button', { name: 'Profile' }))
    expect(screen.getByTestId('profile').closest('[hidden]')).toBeNull()
  })

  it('drops a clean section when the user goes to another one', async () => {
    const user = userEvent.setup()
    render(<Host initial={{ section: 'profile' }} />)
    await user.click(within(nav()).getByRole('button', { name: /^Orders/ }))
    expect(screen.queryByTestId('profile')).toBeNull()
  })
})

describe('CustomerPanel ⋯ menu', () => {
  const openMenu = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
  }

  it('Custom fields opens a dialog with UserMetaFields for the customer', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(screen.queryByTestId('meta-fields')).toBeNull()
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
    expect(spies.onCustomFieldsOpenChange).toHaveBeenLastCalledWith(true)
    const dialog = await screen.findByRole('dialog', { name: 'Custom fields' })
    expect(within(dialog).getByTestId('meta-fields')).toBeInTheDocument()
    expect(mocks.metaFields.userId).toBe(41)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(spies.onCustomFieldsOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('opens on the dialog when the host says so (main\'s ?section=metafields link)', async () => {
    render(<Host initial={{ customFieldsOpen: true }} />)
    expect(await screen.findByRole('dialog', { name: 'Custom fields' })).toBeInTheDocument()
  })

  it('Delete asks first, names the customer, focuses Cancel and calls nothing before the confirm', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Olivia Bennett?' })
    expect(dialog).toHaveTextContent("This can't be undone.")
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDeleteUser).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(mocks.handleDeleteUser).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Olivia Bennett?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete customer' }))
    expect(mocks.handleDeleteUser).toHaveBeenCalledTimes(1)
  })

  it('a delete that works leaves the closing to the controller (no alert, the panel does not close itself)', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Olivia Bennett?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete customer' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a failed delete says why in an alert and nothing closes', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: false, error: ['The customer has open orders'] })
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Olivia Bennett?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete customer' }))
    const alert = await screen.findByRole('alertdialog', { name: "The customer wasn't deleted" })
    expect(alert).toHaveTextContent('The customer has open orders')
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(spies.handleSuccessDeleteUser).not.toHaveBeenCalled()
  })

  it('a failed delete with no reason says something', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: false, error: null })
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Olivia Bennett?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete customer' }))
    const alert = await screen.findByRole('alertdialog', { name: "The customer wasn't deleted" })
    expect(alert).toHaveTextContent("We couldn't delete this customer. Try again.")
  })

  it('an admin cannot delete their own account from here (as main)', async () => {
    const user = userEvent.setup()
    mocks.sessionUser = { id: 41, level: 0 }
    render(<Host />)
    await openMenu(user)
    expect(await screen.findByRole('menuitem', { name: 'Custom fields' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })
})

describe('CustomerPanel loading and errors', () => {
  it('shows a skeleton, not a half-drawn panel, while the customer loads', () => {
    mocks.userState = { user: null, loading: true, error: null }
    render(<Host user={null} />)
    const body = screen.getByRole('status', { name: 'Loading' })
    expect(body).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('profile')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Contact' })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('before the controller starts to load it is loading too, not empty', () => {
    mocks.userState = { user: null, loading: false, error: null }
    render(<Host user={null} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('a load error is an alert with Retry, which asks the controller again', async () => {
    const user = userEvent.setup()
    mocks.userState = { user: null, loading: false, error: ['Failed to fetch'] }
    render(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this customer.")
    expect(alert).not.toHaveTextContent('Failed to fetch')
    expect(mocks.controllerMounts).toBe(1)
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(mocks.controllerMounts).toBe(2)
  })
})

describe('CustomerPanel customer that does not exist (UC-R2 Q-01)', () => {
  // K/UserDetails leaves the API's message («User does not exist») as `user` when the id is unknown
  const gone = () => {
    mocks.userState = { user: 'User does not exist', loading: false, error: null }
  }

  it('is an error state, not an endless skeleton: says the customer does not exist, with Close and no Retry', async () => {
    const user = userEvent.setup()
    gone()
    render(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("This customer doesn't exist or was deleted.")
    expect(alert).not.toHaveTextContent('User does not exist')
    // redesign UC-R2 (Q-01): no sections to go to
    expect(screen.queryByRole('navigation', { name: 'Customer sections' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Section/ })).toBeNull()
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  // Measured live: `?id=99999999` is `400 {"error":true,"result":["User does not exist"]}`; the controller keeps `user: null`, `error: null`
  it('the real shape: a load that started and ended with no customer and no error is not-found (an array result becomes null)', async () => {
    const user = userEvent.setup()
    mocks.userState = { user: null, loading: true, error: null }
    const { rerender } = render(<Host user={null} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    mocks.userState = { user: null, loading: false, error: null }
    rerender(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("This customer doesn't exist or was deleted.")
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('a load error after the load started is a network error, with Retry (not not-found)', () => {
    mocks.userState = { user: null, loading: true, error: null }
    const { rerender } = render(<Host user={null} />)
    mocks.userState = { user: null, loading: false, error: ['Failed to fetch'] }
    rerender(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this customer.")
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('does not spread the message into a fake customer: no switch, no subtitle, the generic title', () => {
    gone()
    render(<Host user={null} />)
    expect(screen.queryByRole('switch')).toBeNull()
    expect(document.querySelector('.odc-record-subtitle')).toBeNull()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Customer')
  })

  it('a network error keeps its Retry (the id may exist)', () => {
    mocks.userState = { user: null, loading: false, error: ['Failed to fetch'] }
    render(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this customer.")
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('a customer that did load is untouched by the not-found state', () => {
    render(<Host />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('switch', { name: 'Active' })).toBeInTheDocument()
  })
})

describe('CustomerPanel sections follow the panel width (UC-R2 Q-02)', () => {
  // jsdom has no layout: the panel (.odc-record) and the nav's own root report different widths, as in the wide RecordPanel
  const withWidths = (record, own, check) => {
    const spy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.classList.contains('odc-record')) return record
      return this.classList.contains('odc-sectionnav') ? own : 0
    })
    try { check() } finally { spy.mockRestore() }
  }

  it('a 720px panel whose nav column is 175px shows the vertical list', () => {
    withWidths(720, 175, () => {
      render(<Host />)
      expect(document.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'list')
    })
  })

  it('a 520px panel whose nav fills the row shows the selector', () => {
    withWidths(520, 520, () => {
      render(<Host />)
      expect(document.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
    })
  })

  it('the threshold stays 640px', () => {
    withWidths(640, 175, () => {
      render(<Host />)
      expect(document.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'list')
    })
    cleanup()
    withWidths(639, 175, () => {
      render(<Host />)
      expect(document.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
    })
  })
})

describe('CustomerPanel header status row (UC-R2 M3-4)', () => {
  it('the status switch sits in its own wrapper, so the narrow header can give it room', () => {
    render(<Host />)
    const wrapper = screen.getByRole('switch', { name: 'Active' }).closest('.ucp-status')
    expect(wrapper).not.toBeNull()
    expect(wrapper.closest('.odc-record-status')).not.toBeNull()
  })

  it('customer-panel.css spaces that row with a spacing token inside the narrow header container, not a literal', () => {
    const css = readFileSync(resolve(__dirname, '../customer-panel.css'), 'utf8')
    const block = css.match(/@container odc-record \(max-width: 480px\) \{[\s\S]*?\.ucp-status\s*\{([^}]*)\}/)
    expect(block).not.toBeNull()
    expect(block[1]).toMatch(/margin-block-start:\s*var\(--od-(x-)?space-[\w-]+\)/)
  })
})
