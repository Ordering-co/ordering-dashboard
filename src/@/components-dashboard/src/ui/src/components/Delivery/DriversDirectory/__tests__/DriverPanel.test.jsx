/* eslint-disable import/first */
// redesign DL-B3 (decisions 1, 2, 4, 6; M-DL2, M-DL4, M-DL13): the driver panel, a RecordPanel with sections.
// The controller (K/UserDetails) and the legacy content pieces are stubs that record the props the panel gives them; the
// Product wrappers (RecordPanel, SectionNav, Menu, Dialog, AlertDialog, Switch, ScheduleEditor) are the real ones.
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
  scheduleState: { loading: false, error: false, change: [] },
  liveSchedule: false,
  controllerProps: null,
  controllerMounts: 0,
  handleDeleteUser: null,
  handleSuccessUserUpdate: null,
  handleScheduleState: null,
  handleScheduleUpdateUser: null,
  parseDate: null,
  orders: null,
  addresses: null,
  profile: null,
  group: null,
  logs: null,
  advanced: null,
  pushTokens: null,
  metaFields: null,
  stripeAccount: null,
  payoutRule: null
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ user: mocks.sessionUser }]
}))
vi.mock('../../../../../../contexts/UtilsContext', () => ({
  useUtils: () => [{ parseDate: (...args) => mocks.parseDate(...args) }]
}))
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    React.useEffect(() => { mocks.controllerMounts += 1 }, [])
    // `liveSchedule` keeps the schedule's pending changes in state as K/UserDetails does (`handleScheduleState`)
    const [liveSchedule, setLiveSchedule] = React.useState(mocks.scheduleState)
    const onLiveSchedule = (changes) => { changes?.length > 0 && setLiveSchedule(state => ({ ...state, change: changes })) }
    mocks.controllerProps = props
    return (
      <UIComponent
        {...props}
        userState={mocks.userState}
        scheduleState={mocks.liveSchedule ? liveSchedule : mocks.scheduleState}
        handleDeleteUser={mocks.handleDeleteUser}
        handleSuccessUserUpdate={mocks.handleSuccessUserUpdate}
        handleScheduleState={mocks.liveSchedule ? onLiveSchedule : mocks.handleScheduleState}
        handleScheduleUpdateUser={mocks.handleScheduleUpdateUser}
      />
    )
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useConfig: () => [{ configs: mocks.configs }],
    useSession: () => [{ user: mocks.sessionUser }],
    UserDetails: Controller
  }
})
vi.mock('../../../Orders/OrdersManager', () => ({
  OrdersManager: (props) => { mocks.orders = props; return <div data-testid='orders' /> }
}))
vi.mock('../../AddressList', () => ({
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
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: 41, name: 'Dana S.' })}>save profile</button>
      </div>
    )
  }
}))
vi.mock('../../DriverGroupSetting', () => ({
  DriverGroupSetting: (props) => { mocks.group = props; return <div data-testid='driver-group' /> }
}))
vi.mock('../ManagedGroupsSection', () => ({
  ManagedGroupsSection: (props) => { mocks.managedGroups = props; return <div data-testid='managed-groups' /> }
}))
vi.mock('../../DriversLogs', () => ({
  DriversLogs: (props) => { mocks.logs = props; return <div data-testid='logs' /> }
}))
vi.mock('../../DriversAdvancedLogs', () => ({
  DriversAdvancedLogs: (props) => { mocks.advanced = props; return <div data-testid='advanced-logs' /> }
}))
vi.mock('../../DriversGroupLogs', () => ({
  DriversGroupLogsUI: function DriversGroupLogsUI () { return null }
}))
vi.mock('../../../Users/UserMetaFields', () => ({
  UserMetaFields: (props) => { mocks.metaFields = props; return <div data-testid='meta-fields' /> }
}))
vi.mock('../../../Shared/PushTokens', () => ({
  PushTokens: (props) => { mocks.pushTokens = props; return <div data-testid='push-tokens' /> }
}))
// main, main's two pieces of the Stripe Connect tab, mounted as they are
vi.mock('../../../Shared/StripeConnectAccount', () => ({
  StripeConnectAccount: (props) => { mocks.stripeAccount = props; return <div data-testid='stripe-account' /> }
}))
vi.mock('../../../Shared/PayoutRuleForm', () => ({
  PayoutRuleForm: (props) => { mocks.payoutRule = props; return <div data-testid='payout-rule' /> }
}))

import { DriversGroupLogsUI } from '../../DriversGroupLogs'
import { DriverPanel } from '../DriverPanel'

const lapse = () => ({ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } })
const week = () => Array.from({ length: 7 }, () => ({ enabled: true, lapses: [lapse()] }))

const driver = {
  id: 41,
  name: 'Dana',
  lastname: 'Ruiz',
  email: 'dana@example.com',
  cellphone: '5550100',
  country_phone_code: '1',
  enabled: true,
  available: true,
  busy: false,
  level: 4,
  schedule: week(),
  addresses: [{ id: 5, address: '1 Main St' }],
  push_tokens: [{ id: 9, token: 'abc' }]
}

let spies
// The page owns the URL state; this host owns it for the test
const Host = ({ initial = {}, ...props }) => {
  const [section, setSection] = useState(initial.section ?? 'profile')
  const [customFieldsOpen, setCustomFieldsOpen] = useState(Boolean(initial.customFieldsOpen))
  const [expanded, setExpanded] = useState(false)
  return (
    <DriverPanel
      userId={41}
      user={driver}
      configs={mocks.configs}
      section={section}
      onSectionChange={(id) => { spies.onSectionChange(id); setSection(id) }}
      customFieldsOpen={customFieldsOpen}
      onCustomFieldsOpenChange={(open) => { spies.onCustomFieldsOpenChange(open); setCustomFieldsOpen(open) }}
      expanded={expanded}
      onExpandedChange={(next) => { spies.onExpandedChange(next); setExpanded(next) }}
      onClose={spies.onClose}
      onToggle={spies.onToggle}
      pendingKeys={[]}
      handleSuccessUpdate={spies.handleSuccessUpdate}
      handleSuccessDeleteUser={spies.handleSuccessDeleteUser}
      {...props}
    />
  )
}

beforeEach(() => {
  mocks.configs = {}
  mocks.stripeAccount = null
  mocks.payoutRule = null
  mocks.sessionUser = { id: 1, level: 0 }
  mocks.userState = { user: driver, loading: false, error: null }
  mocks.scheduleState = { loading: false, error: false, change: [] }
  mocks.liveSchedule = false
  mocks.controllerProps = null
  mocks.controllerMounts = 0
  mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: true, error: null })
  mocks.handleSuccessUserUpdate = vi.fn()
  mocks.handleScheduleState = vi.fn()
  mocks.handleScheduleUpdateUser = vi.fn()
  mocks.parseDate = vi.fn(() => 'Oct 12, 2026')
  spies = {
    onSectionChange: vi.fn(),
    onCustomFieldsOpenChange: vi.fn(),
    onExpandedChange: vi.fn(),
    onClose: vi.fn(),
    onToggle: vi.fn(),
    handleSuccessUpdate: vi.fn(),
    handleSuccessDeleteUser: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const nav = () => screen.getByRole('navigation', { name: 'Driver sections' })
const navLabels = () => [...nav().querySelectorAll('.odc-sectionnav-label')].map(node => node.textContent)

// What K/UserDetails asks for when nothing says otherwise (its `defaultProps`); the panel adds to it
const CONTROLLER_DEFAULT = [
  'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'country_phone_code', 'city_id', 'city', 'address', 'external_id',
  'addresses', 'address_notes', 'driver_zone_restriction', 'mono_session', 'dropdown_option_id', 'dropdown_option', 'location', 'loyalty_level',
  'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'phone_verified', 'email_verified', 'schedule', 'timezone', 'max_days_in_future',
  'occupation_id', 'occupation', 'session', 'push_tokens', 'businesses_agent', 'settings'
]

describe('DriverPanel wiring to the controller', () => {
  it('mounts K/UserDetails with the id, the row and the controller\'s own fields plus the status ones (auditor 4)', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.userId).toBe(41)
    expect(props.user).toBe(driver)
    expect(props.propsToFetch).toEqual(expect.arrayContaining([...CONTROLLER_DEFAULT, 'available', 'busy', 'enabled', 'phone_verified', 'email_verified']))
    expect(new Set(props.propsToFetch).size).toBe(props.propsToFetch.length)
  })

  it('the default list copied here is still the controller\'s (drift guard)', () => {
    const source = readFileSync(resolve(__dirname, '../../../../../../components/UserDetails/index.js'), 'utf8')
    const block = source.slice(source.indexOf('const defaultProps'))
    for (const name of CONTROLLER_DEFAULT) expect(block).toContain(`'${name}'`)
    const listed = block.match(/'[a-z_]+'/g) ?? []
    expect(listed).toHaveLength(CONTROLLER_DEFAULT.length)
  })

  it('gives the controller the way out of a delete, but not the list handler (the panel calls that one itself)', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.handleSuccessDeleteUser).toBe(spies.handleSuccessDeleteUser)
    expect(props.onClose).toBe(spies.onClose)
    expect(props.handleSuccessUpdate).toBeUndefined()
  })
})

describe('DriverPanel header', () => {
  it('names the driver, with the email and the #id as the subtitle', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Dana Ruiz')
    const subtitle = document.querySelector('.odc-record-subtitle')
    expect(subtitle).toHaveTextContent('dana@example.com · #41')
    expect(subtitle.querySelector('.odc-figure')).toHaveTextContent('#41')
  })

  it('without an email the subtitle is only the id', () => {
    render(<Host user={{ ...driver, email: null }} />)
    // redesign DL-R0 (live check): the subtitle's first line is the email and the id; the status strip is its second line
    expect(document.querySelector('.odc-record-subtitle .dlp-subtitle-line')).toHaveTextContent(/^#41$/)
  })

  it('the status strip is under the email, not beside the title', () => {
    render(<Host />)
    expect(document.querySelector('.odc-record-subtitle .dlp-status')).not.toBeNull()
    expect(document.querySelector('.odc-record-status .dlp-status')).toBeNull()
  })

  it('a driver without a name is named as such, never an empty title', () => {
    mocks.userState = { user: { ...driver, name: '', lastname: '' }, loading: false, error: null }
    render(<Host user={{ ...driver, name: '', lastname: '' }} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No name')
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

describe('DriverPanel status strip (decision 1, M-DL1)', () => {
  it('has Online and Active as named switches that show the state of the row', () => {
    render(<Host user={{ ...driver, available: true, enabled: false }} />)
    expect(screen.getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false')
  })

  // (main #479): admins and drivers managers can mark a driver busy, so Busy is there for every driver
  it('Busy is there for every driver, off or on as the driver is', () => {
    const { unmount } = render(<Host />)
    expect(screen.getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'false')
    unmount()
    render(<Host user={{ ...driver, busy: true }} />)
    expect(screen.getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'true')
  })

  it('each switch asks the host with the merged driver, the attribute and the next value', async () => {
    const user = userEvent.setup()
    const row = { ...driver, busy: true }
    render(<Host user={row} />)
    await user.click(screen.getByRole('switch', { name: 'Online' }))
    expect(spies.onToggle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 41, available: true }), 'available', false)
    await user.click(screen.getByRole('switch', { name: 'Busy' }))
    expect(spies.onToggle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 41, busy: true }), 'busy', false)
    await user.click(screen.getByRole('switch', { name: 'Active' }))
    expect(spies.onToggle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 41, enabled: true }), 'enabled', false)
    expect(spies.onToggle).toHaveBeenCalledTimes(3)
  })

  it('reads the freshest state: the detail, then the row, then the patch', () => {
    mocks.userState = { user: { ...driver, available: false, enabled: false }, loading: false, error: null }
    render(<Host user={{ ...driver, available: true, enabled: false }} patch={{ enabled: true }} />)
    expect(screen.getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'true')
  })

  it('without a row (opened by ?id=) it uses what the controller loaded, and the patch on top', () => {
    render(<Host user={null} patch={{ available: false }} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Dana Ruiz')
    expect(screen.getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'true')
  })

  // redesign DL-R1 (Q-1, Q-2): K/UsersList mutates the row object in place (`_user.available = …`, `Object.assign` on save); the same
  // reference comes back, so the strip and the title must read the values on every render, not on a changed identity
  it('shows what the row says after the controller changed it in place (Q-1): the next press sends the new value', async () => {
    const user = userEvent.setup()
    const row = { ...driver, available: true, enabled: true, busy: false }
    const { rerender } = render(<Host user={row} />)
    expect(screen.getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'true')
    row.available = false
    row.enabled = false
    row.busy = true
    rerender(<Host user={row} />)
    expect(screen.getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('switch', { name: 'Online' }))
    expect(spies.onToggle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 41, available: false }), 'available', true)
  })

  it('shows the new name in the title after the row was changed in place (Q-2)', () => {
    const row = { ...driver }
    const { rerender } = render(<Host user={row} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Dana Ruiz')
    row.name = 'Marco'
    row.email = 'marco@example.com'
    rerender(<Host user={row} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Marco Ruiz')
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('marco@example.com · #41')
  })

  it('a switch is busy while its key is pending, and ignores presses; the others stay free', async () => {
    const user = userEvent.setup()
    render(<Host pendingKeys={['41:available']} />)
    const online = screen.getByRole('switch', { name: 'Online' })
    expect(online).toHaveAttribute('aria-busy', 'true')
    await user.click(online)
    expect(spies.onToggle).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Active' })).not.toHaveAttribute('aria-busy')
  })

  it('accepts the pending keys as a Set', () => {
    render(<Host pendingKeys={new Set(['41:enabled'])} />)
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-busy', 'true')
  })

  it('actionDisabled disables the switches for real', async () => {
    const user = userEvent.setup()
    render(<Host user={{ ...driver, busy: true }} actionDisabled />)
    for (const name of ['Online', 'Busy', 'Active']) {
      const toggle = screen.getByRole('switch', { name })
      expect(toggle).toBeDisabled()
      await user.click(toggle)
    }
    expect(spies.onToggle).not.toHaveBeenCalled()
  })

  it('while the driver loads there is no strip to press', () => {
    mocks.userState = { user: null, loading: true, error: null }
    render(<Host user={null} />)
    expect(screen.queryByRole('switch')).toBeNull()
  })
})

describe('DriverPanel sections (decision 1)', () => {
  it('level 0 has the seven sections of main, in its order', () => {
    render(<Host />)
    expect(navLabels()).toEqual(['Profile', 'Driver group', 'Saved places', 'Schedule', 'Logs', 'Advanced logs', 'Push tokens'])
  })

  it.each([1, 2, 5])('level %s has no Advanced logs', (level) => {
    mocks.sessionUser = { id: 1, level }
    render(<Host />)
    expect(navLabels()).toEqual(['Profile', 'Driver group', 'Saved places', 'Schedule', 'Logs', 'Push tokens'])
  })

  it('opens in Profile', () => {
    render(<Host />)
    expect(within(nav()).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('profile')).toBeInTheDocument()
  })

  it('an unknown ?tab= is Profile', () => {
    render(<Host initial={{ section: 'nope' }} />)
    expect(within(nav()).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('profile')).toBeInTheDocument()
  })

  it('a section the level lacks (a link to Advanced logs at level 5) falls back to Profile', () => {
    mocks.sessionUser = { id: 1, level: 5 }
    render(<Host initial={{ section: 'advanced_logs' }} />)
    expect(within(nav()).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByTestId('advanced-logs')).toBeNull()
  })

  it('marks the current section and asks the host for another one', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(nav()).getByRole('button', { name: 'Logs' }))
    expect(spies.onSectionChange).toHaveBeenCalledWith('logs')
    expect(within(nav()).getByRole('button', { name: 'Logs' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('logs')).toBeInTheDocument()
    expect(screen.queryByTestId('profile')).toBeNull()
  })

  it('Driver group mounts the on-click setting for a driver, and a driver manager (level 5) gets the section with the save bar', () => {
    const { unmount } = render(<Host initial={{ section: 'driver_group' }} />)
    expect(mocks.group).toMatchObject({ userId: 41 })
    expect(screen.queryByTestId('managed-groups')).toBeNull()
    unmount()
    mocks.group = undefined
    mocks.userState = { user: { ...driver, level: 5 }, loading: false, error: null }
    render(<Host initial={{ section: 'driver_group' }} />)
    expect(mocks.managedGroups).toMatchObject({ userId: 41 })
    expect(mocks.group).toBeUndefined()
  })

  it('Saved places mounts AddressList with the props of main, inside the same wrapper', () => {
    render(<Host initial={{ section: 'saved_places' }} />)
    const props = mocks.addresses
    expect(props.isEmbedded).toBe(true)
    expect(props.isSeletectedUserAddresses).toBe(true)
    expect(props.userId).toBe(41)
    expect(props.addresses).toBe(driver.addresses)
    expect(props.userState).toBe(mocks.userState)
    expect(props.handleSuccessUpdate).toBe(mocks.handleSuccessUserUpdate)
    // main passed nothing for `setExtraOpen`: the form lives in the panel
    expect(props.setExtraOpen).toBeUndefined()
    expect(screen.getByTestId('addresses').closest('.odc-uf-saved-places')).not.toBeNull()
  })

  it('Logs and Advanced logs get the driver and the logs UI of the groups', () => {
    const { unmount } = render(<Host initial={{ section: 'logs' }} />)
    // the log dates go through parseDate (opt-in formatDates)
    expect(mocks.logs).toMatchObject({ userId: 41, UIComponent: DriversGroupLogsUI, formatDates: true })
    unmount()
    render(<Host initial={{ section: 'advanced_logs' }} />)
    expect(mocks.advanced).toMatchObject({ userId: 41, UIComponent: DriversGroupLogsUI, formatDates: true })
  })

  it('Push tokens gets the driver, and an empty list when there are none', () => {
    const { unmount } = render(<Host initial={{ section: 'push_tokens' }} />)
    expect(mocks.pushTokens).toMatchObject({ userId: 41, pushTokens: driver.push_tokens })
    unmount()
    mocks.userState = { user: { ...driver, push_tokens: undefined }, loading: false, error: null }
    render(<Host initial={{ section: 'push_tokens' }} />)
    expect(mocks.pushTokens.pushTokens).toEqual([])
  })

  it('only the current section is drawn', () => {
    render(<Host initial={{ section: 'logs' }} />)
    expect(screen.getByTestId('logs')).toBeInTheDocument()
    expect(screen.queryByTestId('profile')).toBeNull()
  })
})

// main, the «Stripe Connect» tab of the old driver detail, ported to the new panel
describe('DriverPanel Stripe Connect section (main )', () => {
  const payoutsOn = { stripe_connect_payouts_enabled: { value: '1' } }
  const withLabels = ['Profile', 'Driver group', 'Saved places', 'Schedule', 'Logs', 'Advanced logs', 'Push tokens']

  it('an admin with payouts on gets the section after Push tokens', () => {
    mocks.configs = payoutsOn
    render(<Host />)
    expect(navLabels()).toEqual([...withLabels, 'Stripe Connect'])
  })

  it('shows main\'s two pieces, in order, for the driver id', () => {
    mocks.configs = payoutsOn
    render(<Host initial={{ section: 'stripe_connect' }} />)
    expect(within(nav()).getByRole('button', { name: 'Stripe Connect' })).toHaveAttribute('aria-current', 'page')
    const account = screen.getByTestId('stripe-account')
    const rule = screen.getByTestId('payout-rule')
    expect(account.compareDocumentPosition(rule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mocks.stripeAccount).toEqual({ ownerType: 'driver', ownerId: 41 })
    expect(mocks.payoutRule).toEqual({ scope: 'driver', ownerId: 41 })
    expect(screen.queryByTestId('profile')).toBeNull()
  })

  it('goes there from the nav, asking the host for main\'s tab key', async () => {
    mocks.configs = payoutsOn
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(nav()).getByRole('button', { name: 'Stripe Connect' }))
    expect(spies.onSectionChange).toHaveBeenCalledWith('stripe_connect')
    expect(screen.getByTestId('stripe-account')).toBeInTheDocument()
  })

  it.each([
    ['payouts off', 0, {}],
    ['payouts set to 0', 0, { stripe_connect_payouts_enabled: { value: '0' } }],
    ['level 2', 2, payoutsOn],
    ['level 5', 5, payoutsOn]
  ])('%s: no section, and ?tab=stripe_connect is the Profile', (_name, level, configs) => {
    mocks.configs = configs
    mocks.sessionUser = { id: 1, level }
    render(<Host initial={{ section: 'stripe_connect' }} />)
    expect(navLabels()).not.toContain('Stripe Connect')
    expect(within(nav()).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('profile')).toBeInTheDocument()
    expect(screen.queryByTestId('stripe-account')).toBeNull()
    expect(screen.queryByTestId('payout-rule')).toBeNull()
    expect(mocks.stripeAccount).toBeNull()
    expect(mocks.payoutRule).toBeNull()
  })

  it('a driver manager panel never has it, even for an admin with payouts on, and not by URL', () => {
    mocks.configs = payoutsOn
    const manager = { ...driver, id: 52, level: 5 }
    mocks.userState = { user: manager, loading: false, error: null }
    render(<Host role='managers' userId={52} user={manager} initial={{ section: 'stripe_connect' }} />)
    const managerNav = screen.getByRole('navigation', { name: 'Driver manager sections' })
    expect([...managerNav.querySelectorAll('.odc-sectionnav-label')].map(node => node.textContent))
      .toEqual(['Profile', 'Saved places', 'Managed groups'])
    expect(screen.getByTestId('profile')).toBeInTheDocument()
    expect(screen.queryByTestId('stripe-account')).toBeNull()
    expect(mocks.stripeAccount).toBeNull()
  })

  it('without the flag the seven sections stay exactly as they were', () => {
    render(<Host />)
    expect(navLabels()).toEqual(withLabels)
  })
})

describe('DriverPanel URL-only tabs of main', () => {
  it('?tab=orders mounts OrdersManager for the driver as main does, with no section selected', () => {
    render(<Host initial={{ section: 'orders' }} />)
    expect(screen.getByTestId('orders')).toBeInTheDocument()
    expect(mocks.orders.isSelectedOrders).toBe(true)
    expect(mocks.orders.customerId).toBe(41)
    expect(typeof mocks.orders.handleCustomOrderDetail).toBe('function')
    expect(() => mocks.orders.handleCustomOrderDetail(true)).not.toThrow()
    expect(nav().querySelector('[aria-current="page"]')).toBeNull()
    expect(navLabels()).not.toContain('Orders')
  })

  it('?tab=metafields opens Custom fields once, over the Profile', async () => {
    render(<Host initial={{ section: 'metafields' }} />)
    expect(spies.onCustomFieldsOpenChange).toHaveBeenCalledWith(true)
    expect(spies.onCustomFieldsOpenChange).toHaveBeenCalledTimes(1)
    const dialog = await screen.findByRole('dialog', { name: 'Custom fields' })
    expect(within(dialog).getByTestId('meta-fields')).toBeInTheDocument()
    expect(screen.getByTestId('profile')).toBeInTheDocument()
    // closing it does not open it again
    const user = userEvent.setup()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(spies.onCustomFieldsOpenChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Custom fields' })).toBeNull())
    expect(spies.onCustomFieldsOpenChange).toHaveBeenCalledTimes(2)
  })

  it('?tab=personalization is the Profile', () => {
    render(<Host initial={{ section: 'personalization' }} />)
    expect(within(nav()).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('profile')).toBeInTheDocument()
  })
})

describe('DriverPanel profile', () => {
  it('Profile is the drivers form, on the controller\'s copy', () => {
    render(<Host />)
    expect(mocks.profile.isDriversPage).toBe(true)
    expect(mocks.profile.user).toBe(driver)
  })

  it('a saved profile updates the controller and then tells the list, with the same data', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'save profile' }))
    const updated = { id: 41, name: 'Dana S.' }
    expect(mocks.handleSuccessUserUpdate).toHaveBeenCalledWith(updated)
    expect(spies.handleSuccessUpdate).toHaveBeenCalledWith(updated)
    expect(mocks.handleSuccessUserUpdate.mock.invocationCallOrder[0]).toBeLessThan(spies.handleSuccessUpdate.mock.invocationCallOrder[0])
    expect(mocks.handleSuccessUserUpdate).toHaveBeenCalledTimes(1)
    expect(spies.handleSuccessUpdate).toHaveBeenCalledTimes(1)
  })

  it('forwards profileProps to the form and tells the host\'s onDirtyChange too', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Host profileProps={{ 'data-extra': 'yes', onDirtyChange }} />)
    expect(screen.getByTestId('profile')).toHaveAttribute('data-extra', 'yes')
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })
})

describe('DriverPanel Schedule (decision 6, M-DL4)', () => {
  const editor = () => document.querySelector('[data-slot="schedule-editor"]')

  it('draws the Product editor with the driver\'s schedule and its change reporter', () => {
    render(<Host initial={{ section: 'schedule' }} />)
    expect(editor()).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="schedule-day"]')).toHaveLength(7)
    expect(screen.getByRole('switch', { name: 'Schedule: Sunday' })).toHaveAttribute('aria-checked', 'true')
  })

  it('the date of each day goes through parseDate, never an ISO string', () => {
    render(<Host initial={{ section: 'schedule' }} />)
    expect(mocks.parseDate).toHaveBeenCalled()
    for (const call of mocks.parseDate.mock.calls) expect(call[1]).toMatchObject({ dateOnly: true })
    const dates = [...document.querySelectorAll('.odc-sched-date')]
    expect(dates).toHaveLength(7)
    for (const node of dates) {
      expect(node).toHaveTextContent('Oct 12, 2026')
      expect(node.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    }
  })

  it('Update is there, disabled while nothing changed', () => {
    render(<Host initial={{ section: 'schedule' }} />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
  })

  it('with a pending change Update is enabled and saves through the controller', async () => {
    const user = userEvent.setup()
    mocks.scheduleState = { loading: false, error: false, change: [{ day: 1 }] }
    render(<Host initial={{ section: 'schedule' }} />)
    const update = screen.getByRole('button', { name: 'Update' })
    expect(update).toBeEnabled()
    await user.click(update)
    expect(mocks.handleScheduleUpdateUser).toHaveBeenCalledTimes(1)
  })

  it('while it saves the button is busy and a second press does nothing', async () => {
    const user = userEvent.setup()
    mocks.scheduleState = { loading: true, error: false, change: [{ day: 1 }] }
    render(<Host initial={{ section: 'schedule' }} />)
    const update = screen.getByRole('button', { name: 'Update' })
    expect(update).toHaveAttribute('aria-busy', 'true')
    await user.click(update)
    expect(mocks.handleScheduleUpdateUser).not.toHaveBeenCalled()
  })

  it.each([
    ['a driver manager when the project forbids it', { id: 1, level: 5 }, { allow_driver_manager_update_driver_schedule: { value: '0' } }],
    ['a read-only admin', { id: 1, level: 0, readOnlyAdmin: true }, {}],
    ['a read-only delivery manager', { id: 1, level: 5, readOnlyDeliveryManager: true }, {}]
  ])('%s has no Update button and a disabled editor', (_name, sessionUser, configs) => {
    mocks.sessionUser = sessionUser
    mocks.configs = configs
    mocks.scheduleState = { loading: false, error: false, change: [{ day: 1 }] }
    render(<Host initial={{ section: 'schedule' }} configs={configs} />)
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull()
    expect(editor()).toHaveAttribute('data-disabled')
  })

  it('a driver manager keeps it when the project allows it', () => {
    mocks.sessionUser = { id: 1, level: 5 }
    mocks.configs = { allow_driver_manager_update_driver_schedule: { value: '1' } }
    render(<Host initial={{ section: 'schedule' }} configs={mocks.configs} />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
    expect(editor()).not.toHaveAttribute('data-disabled')
  })

  it('a level 0 admin is not stopped by the manager flag', () => {
    mocks.configs = { allow_driver_manager_update_driver_schedule: { value: '0' } }
    render(<Host initial={{ section: 'schedule' }} configs={mocks.configs} />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('changes not saved yet count as dirty: closing asks first, and Schedule stays mounted elsewhere', async () => {
    const user = userEvent.setup()
    mocks.scheduleState = { loading: false, error: false, change: [{ day: 1 }] }
    render(<Host initial={{ section: 'schedule' }} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(spies.onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await user.click(within(nav()).getByRole('button', { name: 'Logs' }))
    expect(editor().closest('[hidden]')).not.toBeNull()
  })

  // K/Schedule reports the week it draws when the driver has none; that report is the baseline, not a change
  describe('a driver without a schedule (the editor reports its default week on mount)', () => {
    const blank = { ...driver, schedule: null }
    beforeEach(() => {
      mocks.liveSchedule = true
      mocks.userState = { user: blank, loading: false, error: null }
    })

    it('Update stays disabled and Close closes at once', async () => {
      const user = userEvent.setup()
      render(<Host initial={{ section: 'schedule' }} user={blank} />)
      expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(spies.onClose).toHaveBeenCalledTimes(1)
    })

    it('with the id from the URL (text) and the record\'s (a number) it is still one driver', () => {
      render(<Host initial={{ section: 'schedule' }} user={blank} userId='41' />)
      expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
    })

    it('a real edit still counts: Update is enabled and Close asks first', async () => {
      const user = userEvent.setup()
      render(<Host initial={{ section: 'schedule' }} user={blank} />)
      await user.click(screen.getByRole('switch', { name: 'Schedule: Sunday' }))
      expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
      expect(spies.onClose).not.toHaveBeenCalled()
    })
  })

  it('with nothing pending it closes at once', async () => {
    const user = userEvent.setup()
    render(<Host initial={{ section: 'schedule' }} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('DriverPanel unsaved changes', () => {
  it('asks before closing with changes in Profile: Keep editing stays, Discard closes', async () => {
    const user = userEvent.setup()
    render(<Host />)
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

  it('keeps a dirty Profile mounted (hidden) when the user goes to another section', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(within(nav()).getByRole('button', { name: 'Logs' }))
    expect(screen.getByTestId('logs')).toBeVisible()
    expect(screen.getByTestId('profile').closest('[hidden]')).not.toBeNull()
    await user.click(within(nav()).getByRole('button', { name: 'Profile' }))
    expect(screen.getByTestId('profile').closest('[hidden]')).toBeNull()
  })

  it('drops a clean Profile when the user goes to another section', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(nav()).getByRole('button', { name: 'Logs' }))
    expect(screen.queryByTestId('profile')).toBeNull()
  })
})

describe('DriverPanel ⋯ menu', () => {
  const openMenu = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
  }

  it('Custom fields opens a dialog with UserMetaFields for the driver', async () => {
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

  it('opens on the dialog when the host says so', async () => {
    render(<Host initial={{ customFieldsOpen: true }} />)
    expect(await screen.findByRole('dialog', { name: 'Custom fields' })).toBeInTheDocument()
  })

  // redesign D-4 (owner, 2026-10-19): ⋯ › Delete asks first (C8): ConfirmDialog tone danger, focus on Cancel
  const askDelete = async (user, title = 'Delete Dana Ruiz?') => {
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog', { name: title })
  }
  const confirmDelete = async (user, title, label = 'Delete driver') => {
    const dialog = await askDelete(user, title)
    await user.click(within(dialog).getByRole('button', { name: label }))
  }

  it('Delete asks first (C8): names the driver, says the consequence, focus on Cancel, nothing is called yet', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await askDelete(user)
    expect(dialog).toHaveTextContent("This can't be undone.")
    expect(within(dialog).getByRole('button', { name: 'Delete driver' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDeleteUser).not.toHaveBeenCalled()
  })

  it('Cancel writes nothing: the dialog closes, the controller is never called, the panel stays', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await askDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleDeleteUser).not.toHaveBeenCalled()
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Dana Ruiz')
  })

  it('confirming calls the controller once; while it runs the dialog is busy and cannot be repeated', async () => {
    const user = userEvent.setup()
    let finish
    mocks.handleDeleteUser = vi.fn(() => new Promise(resolve => { finish = resolve }))
    render(<Host />)
    const dialog = await askDelete(user)
    const confirm = within(dialog).getByRole('button', { name: 'Delete driver' })
    await user.click(confirm)
    expect(mocks.handleDeleteUser).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'))
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.click(confirm)
    expect(mocks.handleDeleteUser).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ok: true, error: null }) })
  })

  it('a delete that works leaves the closing to the controller: no alert, the panel does not close itself', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await confirmDelete(user)
    await waitFor(() => expect(mocks.handleDeleteUser).toHaveBeenCalled())
    await act(async () => {})
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(spies.handleSuccessDeleteUser).not.toHaveBeenCalled()
  })

  it('a failed delete closes the confirmation and says why in an alert; nothing closes', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: false, error: ['The driver has open orders'] })
    render(<Host />)
    await confirmDelete(user)
    const alert = await screen.findByRole('alertdialog', { name: "The driver wasn't deleted" })
    expect(alert).toHaveTextContent('The driver has open orders')
    expect(screen.queryByRole('alertdialog', { name: 'Delete Dana Ruiz?' })).toBeNull()
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(spies.handleSuccessDeleteUser).not.toHaveBeenCalled()
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a failed delete with no reason says something', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: false, error: null })
    render(<Host />)
    await confirmDelete(user)
    const alert = await screen.findByRole('alertdialog', { name: "The driver wasn't deleted" })
    expect(alert).toHaveTextContent("We couldn't delete this driver. Try again.")
  })

  it('a delete that throws says the same', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteUser = vi.fn().mockRejectedValue(new Error('Network down'))
    render(<Host />)
    await confirmDelete(user)
    const alert = await screen.findByRole('alertdialog', { name: "The driver wasn't deleted" })
    expect(alert).toHaveTextContent('Network down')
  })

  it('an admin cannot delete their own account from here (as main)', async () => {
    const user = userEvent.setup()
    mocks.sessionUser = { id: 41, level: 0 }
    render(<Host />)
    await openMenu(user)
    expect(await screen.findByRole('menuitem', { name: 'Custom fields' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })

  it('actionDisabled disables the ⋯ (as the former driver detail bar)', async () => {
    const user = userEvent.setup()
    render(<Host actionDisabled />)
    const more = screen.getByRole('button', { name: 'More actions' })
    expect(more).toBeDisabled()
    await user.click(more)
    expect(screen.queryByRole('menuitem')).toBeNull()
    expect(mocks.handleDeleteUser).not.toHaveBeenCalled()
  })
})

describe('DriverPanel loading and errors', () => {
  it('shows a skeleton, not a half-drawn panel, while the driver loads', () => {
    mocks.userState = { user: null, loading: true, error: null }
    render(<Host user={null} />)
    const body = screen.getByRole('status', { name: 'Loading' })
    expect(body).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('profile')).toBeNull()
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
    expect(alert).toHaveTextContent("We couldn't load this driver.")
    expect(alert).not.toHaveTextContent('Failed to fetch')
    expect(mocks.controllerMounts).toBe(1)
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(mocks.controllerMounts).toBe(2)
  })

  it('a driver that does not exist is not a loading one: says so, with Close, no Retry and no sections', async () => {
    const user = userEvent.setup()
    mocks.userState = { user: null, loading: true, error: null }
    const { rerender } = render(<Host user={null} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    mocks.userState = { user: null, loading: false, error: null }
    rerender(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("This driver doesn't exist or was deleted.")
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Driver sections' })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('the message the API leaves as `user` is not spread into a fake driver', () => {
    mocks.userState = { user: 'User does not exist', loading: false, error: null }
    render(<Host user={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent("This driver doesn't exist or was deleted.")
    expect(screen.queryByRole('switch')).toBeNull()
    expect(document.querySelector('.odc-record-subtitle')).toBeNull()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Driver')
  })
})

describe('DriverPanel sections follow the panel width', () => {
  // jsdom has no layout: the panel (.odc-record) and the nav's own root report different widths, as in the wide RecordPanel
  const withWidths = (record, own, check) => {
    const spy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.classList.contains('odc-record')) return record
      return this.classList.contains('odc-sectionnav') ? own : 0
    })
    try { check() } finally { spy.mockRestore() }
  }

  it('the threshold is 640px of panel', () => {
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

  it('the compact selector is named Section', () => {
    withWidths(520, 520, () => {
      render(<Host />)
      expect(screen.getByRole('button', { name: /Section/ })).toBeInTheDocument()
    })
  })
})

// redesign DM-B3 (decision 3 | M-DM1, M-DL19): the same panel for a driver manager, behind the opt-in `role='managers'`
describe('DriverPanel as the panel of a driver manager (role managers)', () => {
  const manager = { ...driver, id: 52, name: 'Marta', lastname: 'Gil', email: 'marta@example.com', level: 5, available: true, busy: true }
  const managerNav = () => screen.getByRole('navigation', { name: 'Driver manager sections' })
  const managerLabels = () => [...managerNav().querySelectorAll('.odc-sectionnav-label')].map(node => node.textContent)
  const ManagerHost = (props) => <Host role='managers' userId={52} user={manager} {...props} />

  beforeEach(() => {
    mocks.userState = { user: manager, loading: false, error: null }
  })

  it('forwards `role` to the UI through the controller props', () => {
    render(<ManagerHost />)
    expect(mocks.controllerProps.role).toBe('managers')
  })

  it('has three sections, in this order, the third one called Managed groups (every level)', () => {
    render(<ManagerHost />)
    expect(managerLabels()).toEqual(['Profile', 'Saved places', 'Managed groups'])
    cleanup()
    mocks.sessionUser = { id: 1, level: 5 }
    render(<ManagerHost />)
    expect(managerLabels()).toEqual(['Profile', 'Saved places', 'Managed groups'])
  })

  it('names the section nav with the managers\' text, and the compact selector Section', () => {
    render(<ManagerHost />)
    expect(screen.queryByRole('navigation', { name: 'Driver sections' })).toBeNull()
    expect(managerNav()).toBeInTheDocument()
  })

  it('Managed groups is still ?tab=driver_group: it asks the host for that id and mounts the section with the save bar', async () => {
    const user = userEvent.setup()
    render(<ManagerHost />)
    await user.click(within(managerNav()).getByRole('button', { name: 'Managed groups' }))
    expect(spies.onSectionChange).toHaveBeenCalledWith('driver_group')
    expect(within(managerNav()).getByRole('button', { name: 'Managed groups' })).toHaveAttribute('aria-current', 'page')
    expect(mocks.managedGroups).toMatchObject({ userId: 52, label: 'Managed groups' })
  })

  it('opens ?tab=driver_group on Managed groups', () => {
    render(<ManagerHost initial={{ section: 'driver_group' }} />)
    expect(within(managerNav()).getByRole('button', { name: 'Managed groups' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('managed-groups')).toBeInTheDocument()
  })

  it('unsaved Managed groups ask before closing and stay mounted (hidden) in another section', async () => {
    const user = userEvent.setup()
    render(<ManagerHost initial={{ section: 'driver_group' }} />)
    act(() => mocks.managedGroups.onDirtyChange(true))
    await user.click(within(managerNav()).getByRole('button', { name: 'Saved places' }))
    expect(screen.getByTestId('managed-groups')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  // redesign DM-B3 (audit 6): main's manager panel drew these by `?tab=` (the former driver detail bar does not look at the menu): URL-only, like orders
  it.each([
    ['schedule', () => document.querySelector('[data-slot="schedule-editor"]')],
    ['logs', () => screen.queryByTestId('logs')],
    ['advanced_logs', () => screen.queryByTestId('advanced-logs')],
    ['push_tokens', () => screen.queryByTestId('push-tokens')]
  ])('?tab=%s stays reachable by URL for a manager, and the nav names it while it is open (review r1, R1-1)', (tab, body) => {
    const names = { schedule: 'Schedule', logs: 'Logs', advanced_logs: 'Advanced logs', push_tokens: 'Push tokens' }
    render(<ManagerHost initial={{ section: tab }} />)
    expect(body()).not.toBeNull()
    expect(screen.queryByTestId('profile')).toBeNull()
    const buttons = within(managerNav()).getAllByRole('button').map(button => button.textContent)
    expect(buttons).toEqual(['Profile', 'Saved places', 'Managed groups', names[tab]])
    expect(within(managerNav()).getByRole('button', { name: names[tab] })).toHaveAttribute('aria-current', 'page')
  })

  it('a URL-only section leaves the nav once the manager goes to one of the three (R1-1)', async () => {
    const user = userEvent.setup()
    render(<ManagerHost initial={{ section: 'logs' }} />)
    await user.click(within(managerNav()).getByRole('button', { name: 'Profile' }))
    expect(within(managerNav()).getAllByRole('button').map(button => button.textContent)).toEqual(['Profile', 'Saved places', 'Managed groups'])
  })

  it('?tab=orders is named «Orders» in a manager\'s nav while it is open (R1-1)', () => {
    render(<ManagerHost initial={{ section: 'orders' }} />)
    expect(within(managerNav()).getByRole('button', { name: 'Orders' })).toHaveAttribute('aria-current', 'page')
  })

  it('a manager\'s schedule reached by URL has no dates, as main (isShowDate only on drivers)', () => {
    render(<ManagerHost initial={{ section: 'schedule' }} />)
    expect(document.querySelector('[data-slot="schedule-editor"]')).not.toBeNull()
    expect(document.querySelectorAll('.odc-sched-date')).toHaveLength(0)
  })

  it('an unknown ?tab= is the Profile', () => {
    render(<ManagerHost initial={{ section: 'nope' }} />)
    expect(within(managerNav()).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('profile')).toBeInTheDocument()
  })

  it('never draws a Schedule section or its button', () => {
    render(<ManagerHost />)
    expect(within(managerNav()).queryByRole('button', { name: 'Schedule' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull()
  })

  it('?tab=orders stays reachable, named in the nav while it is open (R1-1)', () => {
    render(<ManagerHost initial={{ section: 'orders' }} />)
    expect(screen.getByTestId('orders')).toBeInTheDocument()
    expect(mocks.orders.customerId).toBe(52)
    expect(managerNav().querySelector('[aria-current="page"]')).toHaveTextContent('Orders')
  })

  it('?tab=metafields opens Custom fields over the Profile', async () => {
    render(<ManagerHost initial={{ section: 'metafields' }} />)
    expect(spies.onCustomFieldsOpenChange).toHaveBeenCalledWith(true)
    const dialog = await screen.findByRole('dialog', { name: 'Custom fields' })
    expect(within(dialog).getByTestId('meta-fields')).toBeInTheDocument()
    expect(mocks.metaFields.userId).toBe(52)
    expect(screen.getByTestId('profile')).toBeInTheDocument()
  })

  it('the status strip is only Active, even when the manager has available and busy true', () => {
    render(<ManagerHost />)
    expect(screen.getAllByRole('switch')).toHaveLength(1)
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('switch', { name: 'Online' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Busy' })).toBeNull()
  })

  it('Active asks the host with the merged manager, and respects busy and disabled', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ManagerHost />)
    await user.click(screen.getByRole('switch', { name: 'Active' }))
    expect(spies.onToggle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 52, enabled: true }), 'enabled', false)
    unmount()
    render(<ManagerHost pendingKeys={['52:enabled']} actionDisabled />)
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('switch', { name: 'Active' })).toBeDisabled()
  })

  it('the profile is the managers\' form: isDriversManagersPage and not isDriversPage', () => {
    render(<ManagerHost />)
    expect(mocks.profile.isDriversManagersPage).toBe(true)
    expect(mocks.profile.isDriversPage).toBeUndefined()
    expect(mocks.profile.user).toBe(manager)
  })

  it('the drivers\' profile is unchanged: isDriversPage and not isDriversManagersPage, with or without the role', () => {
    mocks.userState = { user: driver, loading: false, error: null }
    const { unmount } = render(<Host />)
    expect(mocks.profile.isDriversPage).toBe(true)
    expect(mocks.profile.isDriversManagersPage).toBeUndefined()
    unmount()
    render(<Host role='drivers' />)
    expect(mocks.profile.isDriversPage).toBe(true)
    expect(mocks.profile.isDriversManagersPage).toBeUndefined()
  })

  it('the drivers\' panel with role drivers keeps its seven sections and its three switches', () => {
    mocks.userState = { user: { ...driver, busy: true }, loading: false, error: null }
    render(<Host role='drivers' user={{ ...driver, busy: true }} />)
    expect(navLabels()).toEqual(['Profile', 'Driver group', 'Saved places', 'Schedule', 'Logs', 'Advanced logs', 'Push tokens'])
    expect(screen.getAllByRole('switch')).toHaveLength(3)
  })

  it('a manager that does not exist says so with the managers\' text, with Close and no sections', async () => {
    const user = userEvent.setup()
    mocks.userState = { user: null, loading: true, error: null }
    const { rerender } = render(<ManagerHost user={null} />)
    mocks.userState = { user: null, loading: false, error: null }
    rerender(<ManagerHost user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("This driver manager doesn't exist or was deleted.")
    expect(alert).not.toHaveTextContent("This driver doesn't exist")
    expect(screen.queryByRole('navigation')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('a load error uses the managers\' text and keeps Retry', () => {
    mocks.userState = { user: null, loading: false, error: ['Failed to fetch'] }
    render(<ManagerHost user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this driver manager.")
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('the fallback name of a manager that is not there yet is Driver manager', () => {
    mocks.userState = { user: 'User does not exist', loading: false, error: null }
    render(<ManagerHost user={null} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Driver manager')
    expect(screen.getByRole('heading', { level: 2 })).not.toHaveTextContent(/^Driver$/)
  })

  // redesign D-4 (owner, 2026-10-19): the managers' confirmation uses the managers' texts
  const confirmManagerDelete = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Marta Gil?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete driver manager' }))
  }

  it('Delete asks first in the managers\' texts: «Delete driver manager», focus on Cancel, Cancel writes nothing', async () => {
    const user = userEvent.setup()
    render(<ManagerHost />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Marta Gil?' })
    expect(dialog).toHaveTextContent("This can't be undone.")
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDeleteUser).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleDeleteUser).not.toHaveBeenCalled()
  })

  it('confirming a manager delete calls the controller once', async () => {
    const user = userEvent.setup()
    render(<ManagerHost />)
    await confirmManagerDelete(user)
    await waitFor(() => expect(mocks.handleDeleteUser).toHaveBeenCalledTimes(1))
  })

  it('a failed delete says it in the managers\' texts (reasonless failure too)', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: false, error: null })
    render(<ManagerHost />)
    await confirmManagerDelete(user)
    const alert = await screen.findByRole('alertdialog', { name: "The driver manager wasn't deleted" })
    expect(alert).toHaveTextContent("We couldn't delete this driver manager. Try again.")
  })

  it('a failed delete with a reason from the API shows that reason under the managers\' title', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: false, error: ['The manager has groups'] })
    render(<ManagerHost />)
    await confirmManagerDelete(user)
    const alert = await screen.findByRole('alertdialog', { name: "The driver manager wasn't deleted" })
    expect(alert).toHaveTextContent('The manager has groups')
  })

  // jsdom has no layout: the panel (.odc-record) and the nav's own root report different widths, as in the wide RecordPanel
  const withWidths = (record, own, check) => {
    const spy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.classList.contains('odc-record')) return record
      return this.classList.contains('odc-sectionnav') ? own : 0
    })
    try { check() } finally { spy.mockRestore() }
  }

  // redesign DM-B3 (audit 4): the drivers' threshold: the docked panel shows the selector, the expanded one the list beside the body
  it('the three sections are a selector in the docked panel (~520px) and a list from 640px, as the drivers\'', () => {
    withWidths(520, 175, () => {
      render(<ManagerHost />)
      expect(document.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
    })
    cleanup()
    withWidths(640, 175, () => {
      render(<ManagerHost />)
      expect(document.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'list')
    })
  })

  it('the drivers\' threshold stays 640px', () => {
    withWidths(520, 175, () => {
      render(<Host role='drivers' />)
      expect(document.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
    })
  })
})

describe('DriverPanel source', () => {
  it('uses only tokens in its CSS and marks the batch', () => {
    // comments may talk about sizes, and a container query cannot take a variable (as customer-panel.css); the rules may not hold one
    const css = readFileSync(resolve(__dirname, '../driver-panel.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@container[^{]*/g, '@container ')
    expect(css).toMatch(/var\(--od-/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\brgba?\(/)
    expect(css).not.toMatch(/(^|[\s:(,*+/-])\d*\.?\d+(px|rem|em)\b/)
    const source = readFileSync(resolve(__dirname, '../DriverPanel.jsx'), 'utf8')
    expect(source).toMatch(/redesign DL-B3/)
    expect(source).toMatch(/redesign DM-B3 \(decision 3 \| M-DM1, M-DL19\)/)
  })
})
