/* eslint-disable import/first */
// redesign BO-B4 (decisions 1 and 3; auditor #3, #7d): the staff record panel, a RecordPanel with tabs (Profile, Saved places,
// Stores, Orders, …). The controller (K/UserDetails) and the legacy content pieces are stubs that record the props the panel gives
// them; the Product wrappers (RecordPanel, Tabs, Menu, Dialog, ConfirmDialog, Switch) are the real ones, and so is staffKinds.
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
  metaFields: null,
  // redesign (B1c): what K/UserDetails also brings for a professional, and the two sections of its record
  actionStatus: { loading: false, error: null },
  handleGoogleCalendarSync: null,
  handleGoogleAccountLink: null,
  split: null,
  schedule: null,
  services: null
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
        actionStatus={mocks.actionStatus}
        handleGoogleCalendarSync={mocks.handleGoogleCalendarSync}
        handleGoogleAccountLink={mocks.handleGoogleAccountLink}
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
        <button type='button' onClick={() => props.handleSuccessUpdate({ id: 41, level: 2 })}>save profile</button>
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
vi.mock('../ProfessionalScheduleSection', () => ({
  ProfessionalScheduleSection: (props) => {
    mocks.schedule = props
    return (
      <div data-testid='schedule'>
        <button type='button' onClick={() => props.onDirtyChange?.(true)}>schedule dirty</button>
        <button type='button' onClick={() => props.onDirtyChange?.(false)}>schedule clean</button>
      </div>
    )
  }
}))
vi.mock('../ProfessionalServicesSection', () => ({
  ProfessionalServicesSection: (props) => { mocks.services = props; return <div data-testid='services' /> }
}))
// The panel reads the viewport mode from the split view it sits in; a test sets `mocks.split` to be on a phone (`mode: 'full'`)
vi.mock('../../../Shared/Product', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useSplitView: () => {
      const real = actual.useSplitView()
      return mocks.split ?? real
    }
  }
})

import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { STAFF_KINDS } from '../staffKinds'
import { StaffPanel } from '../StaffPanel'

const kind = STAFF_KINDS.business_owner
const SCHOOLS = { school_module_enabled: { value: '1' } }

const owner = {
  id: 41,
  name: 'Olivia',
  lastname: 'Bennett',
  email: 'olivia@example.com',
  cellphone: '5550100',
  country_phone_code: '1',
  email_verified: true,
  phone_verified: false,
  enabled: true,
  level: 2,
  orders_count: 12,
  addresses: [{ id: 5, address: '1 Main St' }],
  push_tokens: [{ id: 9, token: 'abc' }],
  businesses: [{ id: 7, name: 'Fast Bite' }]
}

let spies
// The page owns the URL state; this host owns it for the test
const Host = ({ initial = {}, ...props }) => {
  const [section, setSection] = useState(initial.section ?? 'profile')
  const [customFieldsOpen, setCustomFieldsOpen] = useState(Boolean(initial.customFieldsOpen))
  const [expanded, setExpanded] = useState(false)
  return (
    <UtilsProviders>
      <StaffPanel
        kind={kind}
        userId={41}
        user={owner}
        configs={mocks.configs}
        section={section}
        onSectionChange={(id) => { spies.onSectionChange(id); setSection(id) }}
        customFieldsOpen={customFieldsOpen}
        onCustomFieldsOpenChange={(open) => { spies.onCustomFieldsOpenChange(open); setCustomFieldsOpen(open) }}
        expanded={expanded}
        onExpandedChange={(next) => { spies.onExpandedChange(next); setExpanded(next) }}
        onClose={spies.onClose}
        onToggleActive={spies.onToggleActive}
        pendingIds={[]}
        handleSuccessUpdate={spies.handleSuccessUpdate}
        handleSuccessDeleteUser={spies.handleSuccessDeleteUser}
        renderStores={spies.renderStores}
        {...props}
      />
    </UtilsProviders>
  )
}

beforeEach(() => {
  mocks.configs = {}
  mocks.sessionUser = { id: 1, level: 0 }
  mocks.userState = { user: owner, loading: false, error: null }
  mocks.controllerProps = null
  mocks.controllerMounts = 0
  mocks.orders = null
  mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: true, error: null })
  mocks.handleSuccessUserUpdate = vi.fn()
  mocks.actionStatus = { loading: false, error: null }
  mocks.handleGoogleCalendarSync = vi.fn().mockResolvedValue(undefined)
  mocks.handleGoogleAccountLink = vi.fn()
  mocks.split = null
  mocks.schedule = null
  mocks.services = null
  spies = {
    onSectionChange: vi.fn(),
    onCustomFieldsOpenChange: vi.fn(),
    onExpandedChange: vi.fn(),
    onClose: vi.fn(),
    onToggleActive: vi.fn(),
    handleSuccessUpdate: vi.fn(),
    handleSuccessDeleteUser: vi.fn(),
    renderStores: vi.fn(() => <div data-testid='stores' />)
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const tablist = () => screen.getByRole('tablist', { name: 'Business owner sections' })
const tabLabels = () => within(tablist()).getAllByRole('tab').map(node => node.textContent)
const tab = (name) => within(tablist()).getByRole('tab', { name })
// (R3, decision 35): more than four sections is a SectionNav (a `nav` of buttons), not tabs
const sectionNav = (name = 'Business owner sections') => screen.getByRole('navigation', { name })
const navLabels = (name) => within(sectionNav(name)).getAllByRole('button').map(node => node.textContent)
const navRow = (label, name) => within(sectionNav(name)).getByRole('button', { name: label })
const agentKind = STAFF_KINDS.callcenter_agent
const agent = { ...owner, level: 9 }

describe('StaffPanel wiring to the controller', () => {
  it('mounts K/UserDetails with the id, the row and the fields the panel needs, the stores among them (auditor #10)', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.userId).toBe(41)
    expect(props.user).toBe(owner)
    expect(props.propsToFetch).toEqual(expect.arrayContaining([
      'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'country_phone_code', 'addresses', 'push_tokens', 'enabled', 'level',
      'timezone', 'email_verified', 'phone_verified', 'businesses', 'businesses_agent'
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

  it('mounts the controller again on Retry, and for another record', () => {
    const { rerender } = render(<Host />)
    expect(mocks.controllerMounts).toBe(1)
    rerender(<Host userId={42} user={{ ...owner, id: 42 }} />)
    expect(mocks.controllerMounts).toBe(2)
  })
})

describe('StaffPanel header', () => {
  it('names the business owner, with «email · phone · #id» as the subtitle', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Olivia Bennett')
    const subtitle = document.querySelector('.odc-record-subtitle')
    expect(subtitle).toHaveTextContent('olivia@example.com · +1 5550100 · #41')
    expect(subtitle.querySelector('.odc-figure')).toHaveTextContent('#41')
  })

  it('a verified email or phone carries a check with an accessible name, an unverified one does not', () => {
    const { unmount } = render(<Host />)
    const subtitle = () => document.querySelector('.odc-record-subtitle')
    // only the email is verified in the fixture
    expect(within(subtitle()).getAllByRole('img', { name: 'Verified' })).toHaveLength(1)
    expect(within(subtitle()).getByText('olivia@example.com').parentElement).toContainElement(within(subtitle()).getByRole('img', { name: 'Verified' }))
    unmount()
    render(<Host user={{ ...owner, phone_verified: true }} />)
    expect(within(subtitle()).getAllByRole('img', { name: 'Verified' })).toHaveLength(2)
    cleanup()
    render(<Host user={{ ...owner, email_verified: false, phone_verified: false }} />)
    expect(within(subtitle()).queryByRole('img', { name: 'Verified' })).toBeNull()
  })

  it('without an email or a phone the subtitle skips them: only the id is left', () => {
    render(<Host user={{ ...owner, email: null, cellphone: null }} />)
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent(/^#41$/)
  })

  it('an owner without a name is named as such, never an empty title', () => {
    mocks.userState = { user: { ...owner, name: '', lastname: '' }, loading: false, error: null }
    render(<Host user={{ ...owner, name: '', lastname: '' }} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No name')
  })

  it('the status switch is the one of the row: Active, and it asks the host to toggle', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const toggle = screen.getByRole('switch', { name: 'Active' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    expect(spies.onToggleActive).toHaveBeenCalledWith(owner, false)
  })

  it('reads the row, not the copy the controller loaded earlier (the list changed it)', () => {
    render(<Host user={{ ...owner, enabled: false }} />)
    expect(screen.getByRole('switch', { name: 'Inactive' })).toHaveAttribute('aria-checked', 'false')
  })

  // R2-2 (review r1, finding 2): K/UserDetails and K/UsersList change the user object IN PLACE when the profile saves, so its identity
  // does not change; the title must follow the new name anyway
  it('the title follows a record the controller changes in place (an opened row)', () => {
    const record = { ...owner }
    mocks.userState = { user: record, loading: false, error: null }
    const { rerender } = render(<Host user={record} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Olivia Bennett')

    record.name = 'Olivia'
    record.lastname = 'Bennett-Cruz'
    rerender(<Host user={record} />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Olivia Bennett-Cruz')
  })

  it('the title follows a record the controller changes in place (opened by ?id=, no row)', () => {
    const record = { ...owner }
    mocks.userState = { user: record, loading: false, error: null }
    const { rerender } = render(<Host user={null} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Olivia Bennett')

    Object.assign(record, { name: 'Olive', lastname: 'Branch' })
    rerender(<Host user={null} />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Olive Branch')
  })

  it('the switch is busy while its id is pending, and does not toggle', async () => {
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

describe('StaffPanel tabs', () => {
  it('opens in Profile, as main does, with the tabs as the navigation (not a SectionNav)', () => {
    render(<Host />)
    expect(tab('Profile')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('profile')).toBeVisible()
    expect(document.querySelector('.odc-sectionnav')).toBeNull()
    expect(document.querySelector('.odc-record')).toHaveAttribute('data-layout', 'tabs')
  })

  // redesign (row 91 O1): at 390 the fourth tab («Push tokens» on an admin) was off view; the tabs wrap instead of scrolling
  it('the tabs wrap into lines instead of scrolling sideways (the fourth one is never off view at 390)', () => {
    render(<Host />)
    expect(document.querySelector('.odc-record-tabs')).toHaveAttribute('data-wrap', 'true')
    expect(tablist()).not.toHaveClass('odc-fade-x')
  })

  it('a business owner (level 2) has four: Profile, Saved places, Stores, Orders', () => {
    render(<Host />)
    expect(tabLabels()).toEqual(['Profile', 'Saved places', 'Stores', 'Orders'])
  })

  it('a level 3 record has no Stores: four tabs, Profile, Saved places, Orders, Push tokens (with Schools it is five: a SectionNav)', () => {
    const user3 = { ...owner, level: 3 }
    mocks.userState = { user: user3, loading: false, error: null }
    render(<Host user={user3} />)
    expect(tabLabels()).toEqual(['Profile', 'Saved places', 'Orders', 'Push tokens'])
  })

  it('the tabs follow the level of the RECORD, not the kind of the page: a level change shows the new ones', () => {
    const { rerender } = render(<Host />)
    expect(tabLabels()).toContain('Stores')
    mocks.userState = { user: { ...owner, level: 3 }, loading: false, error: null }
    rerender(<Host user={{ ...owner, level: 3 }} />)
    expect(tabLabels()).not.toContain('Stores')
  })

  it('marks the current section and asks the host for another one', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(tab('Saved places'))
    expect(spies.onSectionChange).toHaveBeenCalledWith('saved_places')
    expect(tab('Saved places')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('addresses')).toBeVisible()
  })

  it('the Stores tab asks the section id main uses in ?tab=: businesses', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(tab('Stores'))
    expect(spies.onSectionChange).toHaveBeenCalledWith('businesses')
  })

  it('a section the record does not have (a ?tab= from another list) falls back to Profile', () => {
    render(<Host initial={{ section: 'push_tokens' }} />)
    expect(tab('Profile')).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('push-tokens')).toBeNull()
    expect(screen.getByTestId('profile')).toBeVisible()
  })

  it('an unknown section is Profile too', () => {
    render(<Host initial={{ section: 'nope' }} />)
    expect(tab('Profile')).toHaveAttribute('aria-selected', 'true')
  })

  it('opens on the section the host asks for', () => {
    render(<Host initial={{ section: 'businesses' }} />)
    expect(tab('Stores')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('stores')).toBeVisible()
  })
})

// (R3, decision 35): the choice is by the NUMBER of sections of the record, not by the kind of the page. Four or fewer are
// tabs (the owner, level 2); more than four are a vertical SectionNav (a selector in a narrow panel), never a scrolling strip of tabs.
describe('StaffPanel section navigation (more than four sections)', () => {
  it('a level 9 record is a SectionNav, not a tablist, with its five sections in main order', () => {
    render(<Host kind={agentKind} user={agent} />)
    expect(navLabels('Call center agent sections')).toEqual(['Profile', 'Saved places', 'Orders', 'Stores', 'Push tokens'])
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(document.querySelector('.odc-record')).toHaveAttribute('data-layout', 'nav')
    expect(document.querySelector('.odc-record .odc-sectionnav')).not.toBeNull()
  })

  it('the choice is by the number of sections, not the kind: a level 9 record opened with the owners kind is a SectionNav too', () => {
    render(<Host kind={STAFF_KINDS.business_owner} user={agent} />)
    expect(navLabels('Business owner sections')).toEqual(['Profile', 'Saved places', 'Orders', 'Stores', 'Push tokens'])
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('with the Schools module a level 9 record has six, School students last', () => {
    mocks.configs = SCHOOLS
    render(<Host kind={agentKind} user={agent} />)
    expect(navLabels('Call center agent sections')).toEqual(['Profile', 'Saved places', 'Orders', 'Stores', 'Push tokens', 'School students'])
  })

  it('a level 3 record with the Schools module has five: a SectionNav too', () => {
    mocks.configs = SCHOOLS
    const user3 = { ...owner, level: 3 }
    mocks.userState = { user: user3, loading: false, error: null }
    render(<Host user={user3} />)
    expect(navLabels()).toEqual(['Profile', 'Saved places', 'Orders', 'Push tokens', 'School students'])
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('a level 2 record keeps its four tabs, and no SectionNav', () => {
    render(<Host />)
    expect(tabLabels()).toEqual(['Profile', 'Saved places', 'Stores', 'Orders'])
    expect(screen.queryByRole('navigation', { name: 'Business owner sections' })).toBeNull()
    expect(document.querySelector('.odc-sectionnav')).toBeNull()
    expect(document.querySelector('.odc-record')).toHaveAttribute('data-layout', 'tabs')
  })

  it('opens in Profile, marks the current section, and mounts only that one', () => {
    render(<Host kind={agentKind} user={agent} />)
    expect(navRow('Profile', 'Call center agent sections')).toHaveAttribute('aria-current', 'page')
    expect(navRow('Stores', 'Call center agent sections')).not.toHaveAttribute('aria-current')
    expect(screen.getByTestId('profile')).toBeVisible()
    expect(screen.queryByTestId('orders')).toBeNull()
    expect(screen.queryByTestId('stores')).toBeNull()
    expect(spies.renderStores).not.toHaveBeenCalled()
  })

  it('choosing Stores asks the host for businesses and draws the stores; Profile stays mounted, hidden', async () => {
    const user = userEvent.setup()
    render(<Host kind={agentKind} user={agent} />)
    await user.click(navRow('Stores', 'Call center agent sections'))
    expect(spies.onSectionChange).toHaveBeenCalledWith('businesses')
    expect(navRow('Stores', 'Call center agent sections')).toHaveAttribute('aria-current', 'page')
    expect(navRow('Profile', 'Call center agent sections')).not.toHaveAttribute('aria-current')
    expect(screen.getByTestId('stores')).toBeVisible()
    expect(screen.getByTestId('stores').closest('[hidden]')).toBeNull()
    expect(screen.getByTestId('profile').closest('[hidden]')).not.toBeNull()
    expect(spies.renderStores.mock.calls.at(-1)[0]).toMatchObject({ level: 9 })
  })

  it('a visited section stays mounted (hidden) and shows again when chosen, without being drawn twice', async () => {
    const user = userEvent.setup()
    render(<Host kind={agentKind} user={agent} />)
    await user.click(navRow('Orders', 'Call center agent sections'))
    await user.click(navRow('Profile', 'Call center agent sections'))
    expect(screen.getByTestId('orders').closest('[hidden]')).not.toBeNull()
    expect(screen.getByTestId('profile')).toBeVisible()
    await user.click(navRow('Orders', 'Call center agent sections'))
    expect(screen.getByTestId('orders').closest('[hidden]')).toBeNull()
    expect(screen.getAllByTestId('profile')).toHaveLength(1)
    expect(screen.getAllByTestId('orders')).toHaveLength(1)
  })

  it('a section never visited is not in the page at all, School students included', async () => {
    const user = userEvent.setup()
    mocks.configs = SCHOOLS
    render(<Host kind={agentKind} user={agent} />)
    await user.click(navRow('Push tokens', 'Call center agent sections'))
    expect(screen.getByTestId('push-tokens')).toBeVisible()
    expect(screen.queryByTestId('students')).toBeNull()
    expect(screen.queryByTestId('orders')).toBeNull()
    expect(screen.queryByTestId('addresses')).toBeNull()
    expect(screen.queryByTestId('stores')).toBeNull()
  })

  // main's ?tab= values keep working with the nav (the page maps them to the section; `metafields` is the dialog, over Profile)
  it.each([
    ['profile', 'Profile', 'profile'],
    ['saved_places', 'Saved places', 'addresses'],
    ['orders', 'Orders', 'orders'],
    ['businesses', 'Stores', 'stores'],
    ['push_tokens', 'Push tokens', 'push-tokens']
  ])('a level 9 record opened with ?tab=%s opens in %s', (id, label, testId) => {
    render(<Host kind={agentKind} user={agent} initial={{ section: id }} />)
    expect(navRow(label, 'Call center agent sections')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId(testId)).toBeVisible()
    expect(screen.getByTestId(testId).closest('[hidden]')).toBeNull()
  })

  it('a level 9 record opened with ?tab=metafields is in Profile with the Custom fields dialog open', async () => {
    render(<Host kind={agentKind} user={agent} initial={{ customFieldsOpen: true }} />)
    expect(await screen.findByRole('dialog', { name: 'Custom fields' })).toBeInTheDocument()
    expect(mocks.metaFields.userId).toBe(41)
    // the dialog hides the rest of the page from the accessibility tree: the current row is read from the DOM
    expect(document.querySelector('.odc-sectionnav [aria-current="page"]')).toHaveTextContent('Profile')
  })

  it('a section the record does not have (a ?tab= school_students without the module) falls back to Profile', () => {
    render(<Host kind={agentKind} user={agent} initial={{ section: 'school_students' }} />)
    expect(navRow('Profile', 'Call center agent sections')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByTestId('students')).toBeNull()
    expect(screen.getByTestId('profile')).toBeVisible()
  })

  it('a profile draft survives a visit to another section and still guards the close', async () => {
    const user = userEvent.setup()
    render(<Host kind={agentKind} user={agent} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(navRow('Orders', 'Call center agent sections'))
    expect(screen.getByTestId('profile').closest('[hidden]')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a stores draft guards the close, and clears when the draft does', async () => {
    const user = userEvent.setup()
    let report
    spies.renderStores = vi.fn(({ onDirtyChange }) => { report = onDirtyChange; return <div data-testid='stores' /> })
    render(<Host kind={agentKind} user={agent} initial={{ section: 'businesses' }} />)
    act(() => report(true))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    act(() => report(false))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('the navigation follows the level of the RECORD: saving a profile with a level of four sections turns the nav into tabs', () => {
    const { rerender } = render(<Host kind={agentKind} user={agent} />)
    expect(navLabels('Call center agent sections')).toContain('Stores')
    expect(screen.queryByRole('tablist')).toBeNull()
    mocks.userState = { user: { ...owner, level: 3 }, loading: false, error: null }
    rerender(<Host kind={agentKind} user={{ ...owner, level: 3 }} />)
    expect(screen.queryByRole('navigation', { name: 'Call center agent sections' })).toBeNull()
    expect(screen.getByRole('tablist', { name: 'Call center agent sections' })).toBeInTheDocument()
  })

  it('has no navigation while there is no record: loading, load error or not found', () => {
    mocks.userState = { user: null, loading: true, error: null }
    const { rerender } = render(<Host kind={agentKind} user={null} />)
    expect(document.querySelector('.odc-sectionnav')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()

    mocks.userState = { user: null, loading: false, error: ['Failed to fetch'] }
    rerender(<Host kind={agentKind} user={null} />)
    expect(document.querySelector('.odc-sectionnav')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load this call center agent.")

    mocks.userState = { user: 'User does not exist', loading: false, error: null }
    rerender(<Host kind={agentKind} user={null} />)
    expect(document.querySelector('.odc-sectionnav')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent("This call center agent doesn't exist or was deleted.")
  })

  it('shows a skeleton in the current section while only the row is there (the detail has not loaded)', () => {
    mocks.userState = { user: null, loading: true, error: null }
    render(<Host kind={agentKind} user={agent} initial={{ section: 'orders' }} />)
    expect(navRow('Orders', 'Call center agent sections')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByTestId('orders')).toBeNull()
  })
})

describe('StaffPanel content is mounted when visited (and stays)', () => {
  it('Orders is not mounted, nor asked for, until its tab is visited', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(screen.queryByTestId('orders')).toBeNull()
    expect(mocks.orders).toBeNull()
    expect(screen.queryByTestId('addresses')).toBeNull()
    expect(spies.renderStores).not.toHaveBeenCalled()
    await user.click(tab('Orders'))
    expect(screen.getByTestId('orders')).toBeVisible()
  })

  it('Stores is drawn by the host only when visited, with the record and the dirty report', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(spies.renderStores).not.toHaveBeenCalled()
    await user.click(tab('Stores'))
    expect(screen.getByTestId('stores')).toBeVisible()
    const args = spies.renderStores.mock.calls.at(-1)[0]
    expect(args.user).toMatchObject({ id: 41 })
    expect(typeof args.onDirtyChange).toBe('function')
  })

  // (CA-3): the host draws the Stores section for the level that decided the tabs, not for the kind it was opened from
  it('Stores gets the level of the record: the row of the list over the detail', () => {
    mocks.userState = { user: { ...owner, level: 2 }, loading: false, error: null }
    render(<Host initial={{ section: 'businesses' }} user={{ ...owner, level: 9 }} />)
    expect(spies.renderStores).toHaveBeenCalled()
    expect(spies.renderStores.mock.calls.at(-1)[0]).toMatchObject({ level: 9 })
  })

  it('Stores gets the level of the detail when the row says none', () => {
    const { level, ...withoutLevel } = owner
    mocks.userState = { user: { ...withoutLevel, level: 9 }, loading: false, error: null }
    render(<Host initial={{ section: 'businesses' }} user={withoutLevel} />)
    expect(spies.renderStores.mock.calls.at(-1)[0]).toMatchObject({ level: 9 })
  })

  it('Stores gets the level of the kind when neither the row nor the detail say one', () => {
    const { level, ...withoutLevel } = owner
    mocks.userState = { user: withoutLevel, loading: false, error: null }
    render(<Host initial={{ section: 'businesses' }} user={withoutLevel} />)
    expect(spies.renderStores.mock.calls.at(-1)[0]).toMatchObject({ level: kind.level })
  })

  it('a visited section stays mounted (hidden) when the user goes elsewhere, so a draft survives', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(tab('Orders'))
    await user.click(tab('Profile'))
    const orders = screen.getByTestId('orders')
    expect(orders.closest('[hidden]')).not.toBeNull()
    expect(screen.getByTestId('profile')).toBeVisible()
    await user.click(tab('Orders'))
    expect(screen.getByTestId('orders').closest('[hidden]')).toBeNull()
  })

  it('a section the user never went to is not in the page at all', async () => {
    const user = userEvent.setup()
    const user3 = { ...owner, level: 3 }
    mocks.userState = { user: user3, loading: false, error: null }
    render(<Host user={user3} />)
    await user.click(tab('Push tokens'))
    expect(screen.getByTestId('push-tokens')).toBeVisible()
    expect(screen.queryByTestId('students')).toBeNull()
    expect(screen.queryByTestId('orders')).toBeNull()
    expect(screen.queryByTestId('addresses')).toBeNull()
  })
})

describe('StaffPanel sections', () => {
  it('Orders mounts OrdersManager as main does (the owner as the customer), with no status group', async () => {
    render(<Host initial={{ section: 'orders' }} />)
    expect(mocks.orders.isSelectedOrders).toBe(true)
    expect(mocks.orders.customerId).toBe(41)
    expect(mocks.orders.statusGroup).toBeUndefined()
    expect(typeof mocks.orders.handleCustomOrderDetail).toBe('function')
  })

  it('Saved places mounts AddressList with the props of main, inside the panel', () => {
    render(<Host initial={{ section: 'saved_places' }} />)
    const props = mocks.addresses
    expect(props.isSeletectedUserAddresses).toBe(true)
    expect(props.userId).toBe(41)
    expect(props.addresses).toBe(owner.addresses)
    expect(props.userState).toBe(mocks.userState)
    expect(props.handleSuccessUpdate).toBe(mocks.handleSuccessUserUpdate)
    expect(props.isEmbedded).toBe(true)
    expect(() => props.setExtraOpen(true)).not.toThrow()
  })

  it('Push tokens and School students get the record, and no tokens is an empty list', () => {
    mocks.configs = SCHOOLS
    const user3 = { ...owner, level: 3, push_tokens: undefined }
    mocks.userState = { user: user3, loading: false, error: null }
    const { unmount } = render(<Host user={user3} initial={{ section: 'push_tokens' }} />)
    expect(mocks.pushTokens).toMatchObject({ userId: 41, pushTokens: [] })
    unmount()
    render(<Host user={user3} initial={{ section: 'school_students' }} />)
    expect(mocks.students).toMatchObject({ userId: 41 })
  })

  it('shows a skeleton in a section while only the row is there (the detail has not loaded)', () => {
    mocks.userState = { user: null, loading: true, error: null }
    render(<Host initial={{ section: 'orders' }} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByTestId('orders')).toBeNull()
  })
})

describe('StaffPanel profile', () => {
  it('a saved profile updates the controller and then tells the list, with the same data', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(mocks.profile.user).toBe(owner)
    await user.click(screen.getByRole('button', { name: 'save profile' }))
    const updated = { id: 41, level: 2 }
    expect(mocks.handleSuccessUserUpdate).toHaveBeenCalledWith(updated)
    expect(spies.handleSuccessUpdate).toHaveBeenCalledWith(updated)
    expect(mocks.handleSuccessUserUpdate.mock.invocationCallOrder[0]).toBeLessThan(spies.handleSuccessUpdate.mock.invocationCallOrder[0])
    expect(mocks.handleSuccessUserUpdate).toHaveBeenCalledTimes(1)
    expect(spies.handleSuccessUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('StaffPanel unsaved changes', () => {
  it('closes at once when nothing is dirty', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('the profile reporting changes turns the guard on: Keep editing stays, Discard closes', async () => {
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

  it('the host hears the profile draft through profileProps.onDirtyChange (its guard when switching record)', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Host profileProps={{ onDirtyChange }} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'make clean' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('a profile that goes clean again lets the panel close at once', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'make clean' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a stores draft guards the close too, and clears when the draft does', async () => {
    const user = userEvent.setup()
    let report
    spies.renderStores = vi.fn(({ onDirtyChange }) => { report = onDirtyChange; return <div data-testid='stores' /> })
    render(<Host initial={{ section: 'businesses' }} />)
    act(() => report(true))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    act(() => report(false))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('a profile draft survives a visit to another tab (the section stays mounted) and still guards the close', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(tab('Orders'))
    expect(screen.getByTestId('profile').closest('[hidden]')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
  })
})

describe('StaffPanel ⋯ menu', () => {
  const openMenu = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
  }

  it('Custom fields opens a dialog with UserMetaFields for the owner', async () => {
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

  it('opens on the Custom fields dialog when the host says so (main\'s ?tab=metafields link)', async () => {
    render(<Host initial={{ customFieldsOpen: true }} />)
    expect(await screen.findByRole('dialog', { name: 'Custom fields' })).toBeInTheDocument()
    expect(mocks.metaFields.userId).toBe(41)
  })

  it('Delete asks first, names the owner, focuses Cancel and calls nothing before the confirm', async () => {
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
    await user.click(within(confirm).getByRole('button', { name: 'Delete business owner' }))
    expect(mocks.handleDeleteUser).toHaveBeenCalledTimes(1)
  })

  it('a delete that works leaves the closing to the controller (no alert, the panel does not close itself)', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Olivia Bennett?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete business owner' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a failed delete says why in an alert and nothing closes', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteUser = vi.fn().mockResolvedValue({ ok: false, error: ['The owner still has stores'] })
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Olivia Bennett?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete business owner' }))
    const alert = await screen.findByRole('alertdialog', { name: "The business owner wasn't deleted" })
    expect(alert).toHaveTextContent('The owner still has stores')
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
    await user.click(within(dialog).getByRole('button', { name: 'Delete business owner' }))
    const alert = await screen.findByRole('alertdialog', { name: "The business owner wasn't deleted" })
    expect(alert).toHaveTextContent("We couldn't delete this business owner. Try again.")
  })

  it('an admin cannot delete their own account from here (as main)', async () => {
    const user = userEvent.setup()
    mocks.sessionUser = { id: 41, level: 0 }
    render(<Host />)
    await openMenu(user)
    expect(await screen.findByRole('menuitem', { name: 'Custom fields' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })

  // redesign D-3 (owner, 2026-10-19): the switch of your own record stays, disabled, with the reason
  it('the status switch of the signed-in person\'s own record is disabled and says why', async () => {
    const user = userEvent.setup()
    mocks.sessionUser = { id: 41, level: 0 }
    render(<Host />)
    const toggle = screen.getByRole('switch', { name: 'Active' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAccessibleDescription("You can't deactivate your own account.")
    expect(screen.getByTitle("You can't deactivate your own account.")).toContainElement(toggle)
    await user.click(toggle)
    expect(spies.onToggleActive).not.toHaveBeenCalled()
  })

  // redesign R-4: on a phone nothing shows a title, so the own record says the reason in a visible line beside the switch
  it('the own record shows the reason as a visible line next to the disabled switch', () => {
    mocks.sessionUser = { id: 41, level: 0 }
    render(<Host />)
    const note = screen.getByText("You can't deactivate or delete your own account.")
    expect(note).toHaveClass('sdp-self-note')
    expect(note).not.toHaveClass('odc-sr-only')
    const wrapper = screen.getByRole('switch', { name: 'Active' }).closest('.sdp-status')
    expect(wrapper).toContainElement(note)
    // the switch keeps its accessible description
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAccessibleDescription("You can't deactivate your own account.")
  })

  it('a protected account has no Delete and its switch is disabled with the reason', async () => {
    const user = userEvent.setup()
    mocks.userState = { user: { ...owner, protected: true }, loading: false, error: null }
    render(<Host user={{ ...owner, protected: true }} />)
    const toggle = screen.getByRole('switch', { name: 'Active' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAccessibleDescription("You can't deactivate a protected account.")
    const note = screen.getByText("This account is protected. You can't deactivate or delete it.")
    expect(note).toHaveClass('sdp-self-note')
    await user.click(toggle)
    expect(spies.onToggleActive).not.toHaveBeenCalled()
    await openMenu(user)
    expect(await screen.findByRole('menuitem', { name: 'Custom fields' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })

  it('an inactive protected account can be activated from its record', async () => {
    const user = userEvent.setup()
    const inactive = { ...owner, protected: true, enabled: false }
    mocks.userState = { user: inactive, loading: false, error: null }
    render(<Host user={inactive} />)
    const toggle = screen.getByRole('switch', { name: 'Inactive' })
    expect(toggle).not.toBeDisabled()
    await user.click(toggle)
    expect(spies.onToggleActive).toHaveBeenCalledWith(expect.objectContaining({ id: 41 }), true)
  })

  it('the switch of another person\'s record is as before', () => {
    render(<Host />)
    const toggle = screen.getByRole('switch', { name: 'Active' })
    expect(toggle).not.toBeDisabled()
    expect(toggle).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByText("You can't deactivate or delete your own account.")).toBeNull()
  })
})

describe('StaffPanel loading and errors', () => {
  it('shows a skeleton, not a half-drawn panel, while the record loads', () => {
    mocks.userState = { user: null, loading: true, error: null }
    render(<Host user={null} />)
    const body = screen.getByRole('status', { name: 'Loading' })
    expect(body).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('profile')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    // the title is a skeleton until there is a name to paint
    expect(screen.getByRole('heading', { level: 2 }).querySelector('.sdp-title-skeleton')).not.toBeNull()
  })

  it('before the controller starts to load it is loading too, not empty', () => {
    mocks.userState = { user: null, loading: false, error: null }
    render(<Host user={null} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('a load error is an alert with the words of the kind and Retry, which asks the controller again', async () => {
    const user = userEvent.setup()
    mocks.userState = { user: null, loading: false, error: ['Failed to fetch'] }
    render(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this business owner.")
    expect(alert).not.toHaveTextContent('Failed to fetch')
    expect(mocks.controllerMounts).toBe(1)
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(mocks.controllerMounts).toBe(2)
  })
})

describe('StaffPanel business owner that does not exist', () => {
  // K/UserDetails leaves the API's message («User does not exist») as `user` when the id is unknown
  const gone = () => {
    mocks.userState = { user: 'User does not exist', loading: false, error: null }
  }

  it('is an error state, not an endless skeleton: says it does not exist, with Close, no Retry and no tabs', async () => {
    const user = userEvent.setup()
    gone()
    render(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("This business owner doesn't exist or was deleted.")
    expect(alert).not.toHaveTextContent('User does not exist')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('the real shape: a load that started and ended with no record and no error is not-found', () => {
    mocks.userState = { user: null, loading: true, error: null }
    const { rerender } = render(<Host user={null} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    mocks.userState = { user: null, loading: false, error: null }
    rerender(<Host user={null} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("This business owner doesn't exist or was deleted.")
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('does not spread the message into a fake record: no switch, no subtitle, the generic title, no ⋯ Delete', () => {
    gone()
    render(<Host user={null} />)
    expect(screen.queryByRole('switch')).toBeNull()
    expect(document.querySelector('.odc-record-subtitle')).toBeNull()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Business owner')
  })

  it('a record that did load is untouched by the not-found state', () => {
    render(<Host />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('switch', { name: 'Active' })).toBeInTheDocument()
  })
})

describe('StaffPanel header status row', () => {
  it('the status switch sits in its own wrapper, so the narrow header can give it room', () => {
    render(<Host />)
    const wrapper = screen.getByRole('switch', { name: 'Active' }).closest('.sdp-status')
    expect(wrapper).not.toBeNull()
    expect(wrapper.closest('.odc-record-status')).not.toBeNull()
  })
})

describe('staff-panel.css', () => {
  const css = readFileSync(resolve(__dirname, '../staff-panel.css'), 'utf8')

  it('spaces the narrow status row with a spacing token inside the narrow header container, not a literal', () => {
    const block = css.match(/@container odc-record \(max-width: 480px\) \{[\s\S]*?\.sdp-status\s*\{([^}]*)\}/)
    expect(block).not.toBeNull()
    expect(block[1]).toMatch(/margin-block-start:\s*var\(--od-(x-)?space-[\w-]+\)/)
  })

  it('styles the own-record note with tokens', () => {
    expect(css).toMatch(/\.sdp-self-note\s*\{[^}]*var\(--od-/)
  })

  it('has no literal colour, font size or physical-side property', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
    expect(css).not.toMatch(/font-size:\s*[\d.]+(px|rem|em)/)
    expect(css).not.toMatch(/\b(margin|padding)-(left|right|top|bottom)\b/)
  })

  // (R3), as the customers' panel (`ucp-section[hidden]`): a visited section that is not the current one is hidden, whatever its display
  it('hides a section kept mounted for its draft, with its own rule', () => {
    expect(css).toMatch(/\.sdp-section\[hidden\]\s*\{\s*display:\s*none;?\s*\}/)
  })

  it('prefixes its classes with sdp-', () => {
    // only the selectors: the comments name files («candidates.css») and the values hold no class
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}')
    const classes = [...selectors.matchAll(/\.([a-z][\w-]*)/g)].map(match => match[1]).filter(name => !/^odc-/.test(name))
    expect(classes.length).toBeGreaterThan(0)
    for (const name of classes) expect(name).toMatch(/^sdp-/)
  })
})

// redesign (B1c, decisions 6, 9 and 12): the professional's record. Three tabs (Profile, Schedule, Business & Services), the
// Calendar sync action of main's header, and «Delete» only for a level 0 session. The two sections are stubs here: they have their own tests.
describe('StaffPanel professional', () => {
  const proKind = STAFF_KINDS.professional
  const pro = { ...owner, level: 8, businesses: undefined }
  const proTablist = () => screen.getByRole('tablist', { name: 'Professional sections' })
  const proTab = (name) => within(proTablist()).getByRole('tab', { name })
  const renderPro = (props = {}) => {
    mocks.userState = { user: pro, loading: false, error: null }
    return render(<Host kind={proKind} user={pro} {...props} />)
  }
  const openMenu = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
  }

  describe('sections', () => {
    it('shows Profile, Schedule and Business & Services as tabs, in that order', () => {
      renderPro()
      expect(within(proTablist()).getAllByRole('tab').map(node => node.textContent)).toEqual(['Profile', 'Schedule', 'Business & Services'])
      expect(document.querySelector('.odc-sectionnav')).toBeNull()
      expect(proTab('Profile')).toHaveAttribute('aria-selected', 'true')
    })

    it('asks the host for the ids main uses in ?tab=: schedule and business_services', async () => {
      const user = userEvent.setup()
      renderPro()
      await user.click(proTab('Schedule'))
      expect(spies.onSectionChange).toHaveBeenLastCalledWith('schedule')
      await user.click(proTab('Business & Services'))
      expect(spies.onSectionChange).toHaveBeenLastCalledWith('business_services')
    })

    it('section schedule opens Schedule and mounts the schedule section with the record', () => {
      renderPro({ initial: { section: 'schedule' } })
      expect(proTab('Schedule')).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('schedule')).toBeVisible()
      expect(mocks.schedule.user).toBe(pro)
      expect(screen.queryByTestId('services')).toBeNull()
    })

    it('section business_services opens Business & Services with the record', () => {
      renderPro({ initial: { section: 'business_services' } })
      expect(proTab('Business & Services')).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('services')).toBeVisible()
      expect(mocks.services.user).toBe(pro)
      expect(screen.queryByTestId('schedule')).toBeNull()
    })

    it('a saved schedule updates the controller and then tells the list, as the profile does', async () => {
      renderPro({ initial: { section: 'schedule' } })
      const updated = { id: 41, max_days_in_future: 30 }
      act(() => mocks.schedule.handleSuccessUpdate(updated))
      expect(mocks.handleSuccessUserUpdate).toHaveBeenCalledWith(updated)
      expect(spies.handleSuccessUpdate).toHaveBeenCalledWith(updated)
    })

    it('a section is not mounted until it is visited', async () => {
      const user = userEvent.setup()
      renderPro()
      expect(mocks.schedule).toBeNull()
      expect(mocks.services).toBeNull()
      await user.click(proTab('Schedule'))
      expect(screen.getByTestId('schedule')).toBeVisible()
      expect(mocks.services).toBeNull()
    })

    it('the schedule draft guards the close: Keep editing stays, Discard closes', async () => {
      const user = userEvent.setup()
      renderPro({ initial: { section: 'schedule' } })
      await user.click(screen.getByRole('button', { name: 'schedule dirty' }))
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

    it('a schedule that goes clean again lets the panel close at once', async () => {
      const user = userEvent.setup()
      renderPro({ initial: { section: 'schedule' } })
      await user.click(screen.getByRole('button', { name: 'schedule dirty' }))
      await user.click(screen.getByRole('button', { name: 'schedule clean' }))
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(spies.onClose).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('a schedule draft survives a visit to another tab and still guards the close', async () => {
      const user = userEvent.setup()
      renderPro({ initial: { section: 'schedule' } })
      await user.click(screen.getByRole('button', { name: 'schedule dirty' }))
      await user.click(proTab('Profile'))
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
    })

    it('the profile of a professional still guards the close', async () => {
      const user = userEvent.setup()
      renderPro()
      await user.click(screen.getByRole('button', { name: 'make dirty' }))
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
    })
  })

  describe('Calendar sync', () => {
    // review r1 #2: in the split view a text button left the record's name 133px and it broke in two lines; the icon keeps its name
    // and its tooltip, and the text comes back when the record is open as a page
    it('in the split view is an icon button with its name and tooltip, before the ⋯ menu', () => {
      renderPro()
      const sync = screen.getByRole('button', { name: 'Calendar sync' })
      expect(sync).toHaveAttribute('data-icon-only')
      expect(sync).toHaveAttribute('title', 'Calendar sync')
      expect(sync.querySelector('svg')).not.toBeNull()
      const more = screen.getByRole('button', { name: 'More actions' })
      expect(sync.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(sync.closest('.odc-record-header, header, .odc-record')).not.toBeNull()
    })

    it('open as a page it is a button with its text', async () => {
      const user = userEvent.setup()
      renderPro()
      await user.click(screen.getByRole('button', { name: 'Open as page' }))
      const sync = screen.getByRole('button', { name: 'Calendar sync' })
      expect(sync).toHaveTextContent('Calendar sync')
      expect(sync).not.toHaveAttribute('data-icon-only')
    })

    // phase 3 F3: on a phone its 44px area crossed the one of «More actions»; the icon keeps a space after it
    it('the icon button keeps the space its 44px area needs from the ⋯ menu', async () => {
      const { readFileSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      renderPro()
      expect(screen.getByRole('button', { name: 'Calendar sync' })).toHaveClass('sdp-sync')
      const css = readFileSync(resolve(__dirname, '../staff-panel.css'), 'utf8')
      expect(css).toMatch(/\.sdp-sync\s*\{[^}]*margin-inline-end:\s*var\(--od-space-3\)/)
    })

    it('on a phone it is an icon button with the same name', () => {
      mocks.split = { mode: 'full', open: true, expanded: false, onClose: () => {}, requestClose: () => {}, registerCloseGuard: () => () => {}, getEscapedField: () => null }
      renderPro()
      const sync = screen.getByRole('button', { name: 'Calendar sync' })
      expect(sync).toHaveAttribute('data-icon-only')
      expect(sync).toHaveAttribute('title', 'Calendar sync')
      expect(sync.querySelector('svg')).not.toBeNull()
    })

    it('calls the controller once and never the Google account link', async () => {
      const user = userEvent.setup()
      renderPro()
      await user.click(screen.getByRole('button', { name: 'Calendar sync' }))
      expect(mocks.handleGoogleCalendarSync).toHaveBeenCalledTimes(1)
      expect(mocks.handleGoogleAccountLink).not.toHaveBeenCalled()
    })

    it('is busy from its own state while the request runs, and not again once it ends', async () => {
      const user = userEvent.setup()
      let release
      mocks.handleGoogleCalendarSync = vi.fn(() => new Promise((resolve) => { release = resolve }))
      renderPro()
      expect(screen.getByRole('button', { name: 'Calendar sync' })).not.toHaveAttribute('aria-busy')
      await user.click(screen.getByRole('button', { name: 'Calendar sync' }))
      expect(screen.getByRole('button', { name: 'Calendar sync' })).toHaveAttribute('aria-busy', 'true')
      // a second press while it runs asks nothing more
      await user.click(screen.getByRole('button', { name: 'Calendar sync' }))
      expect(mocks.handleGoogleCalendarSync).toHaveBeenCalledTimes(1)

      await act(async () => { release() })
      await waitFor(() => expect(screen.getByRole('button', { name: 'Calendar sync' })).not.toHaveAttribute('aria-busy'))
    })

    it('does not wait for the controller status: it stays loading after a success and the button is free anyway', async () => {
      const user = userEvent.setup()
      mocks.actionStatus = { loading: true, error: null }
      renderPro()
      expect(screen.getByRole('button', { name: 'Calendar sync' })).not.toHaveAttribute('aria-busy')
      await user.click(screen.getByRole('button', { name: 'Calendar sync' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Calendar sync' })).not.toHaveAttribute('aria-busy'))
    })

    it('is busy on a phone too, and free again when the request fails', async () => {
      const user = userEvent.setup()
      mocks.split = { mode: 'full', open: true, expanded: false, onClose: () => {}, requestClose: () => {}, registerCloseGuard: () => () => {}, getEscapedField: () => null }
      let fail
      mocks.handleGoogleCalendarSync = vi.fn(() => new Promise((_resolve, reject) => { fail = reject }))
      renderPro()
      await user.click(screen.getByRole('button', { name: 'Calendar sync' }))
      expect(screen.getByRole('button', { name: 'Calendar sync' })).toHaveAttribute('aria-busy', 'true')
      await act(async () => { fail(new Error('network')) })
      await waitFor(() => expect(screen.getByRole('button', { name: 'Calendar sync' })).not.toHaveAttribute('aria-busy'))
    })

    it('shows the error the controller leaves in an alert, with Calendar sync as its title', async () => {
      const user = userEvent.setup()
      const { rerender } = renderPro()
      expect(screen.queryByRole('alertdialog')).toBeNull()
      mocks.actionStatus = { loading: false, error: ['The Google account is not linked'] }
      rerender(<Host kind={proKind} user={pro} />)
      const alert = await screen.findByRole('alertdialog', { name: 'Calendar sync' })
      expect(alert).toHaveTextContent('The Google account is not linked')
      await user.click(within(alert).getByRole('button', { name: 'OK' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    })

    it('says something when the error has no text', async () => {
      const { rerender } = renderPro()
      mocks.actionStatus = { loading: false, error: true }
      rerender(<Host kind={proKind} user={pro} />)
      const alert = await screen.findByRole('alertdialog', { name: 'Calendar sync' })
      expect(alert).toHaveTextContent("We couldn't sync the calendar. Try again.")
    })
  })

  describe('Delete', () => {
    it('is hidden with a session of level 2, Custom fields stays', async () => {
      const user = userEvent.setup()
      mocks.sessionUser = { id: 1, level: 2 }
      renderPro()
      await openMenu(user)
      expect(await screen.findByRole('menuitem', { name: 'Custom fields' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
    })

    it('is hidden with a session of any level other than 0', async () => {
      const user = userEvent.setup()
      mocks.sessionUser = { id: 1, level: 5 }
      renderPro()
      await openMenu(user)
      await screen.findByRole('menuitem', { name: 'Custom fields' })
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
    })

    it('is there with a session of level 0 and asks first', async () => {
      const user = userEvent.setup()
      renderPro()
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete Olivia Bennett?' })
      await user.click(within(dialog).getByRole('button', { name: 'Delete professional' }))
      expect(mocks.handleDeleteUser).toHaveBeenCalledTimes(1)
    })

    it('is hidden on the own account even for level 0 (as today)', async () => {
      const user = userEvent.setup()
      mocks.sessionUser = { id: 41, level: 0 }
      renderPro()
      await openMenu(user)
      await screen.findByRole('menuitem', { name: 'Custom fields' })
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
    })
  })

  describe('other kinds', () => {
    it('a business owner shows no Calendar sync', () => {
      render(<Host />)
      expect(screen.queryByRole('button', { name: 'Calendar sync' })).toBeNull()
    })

    it('a call center agent and an admin show no Calendar sync either', () => {
      const { unmount } = render(<Host kind={agentKind} user={agent} />)
      expect(screen.queryByRole('button', { name: 'Calendar sync' })).toBeNull()
      unmount()
      const admin = { ...owner, level: 0 }
      mocks.userState = { user: admin, loading: false, error: null }
      render(<Host kind={STAFF_KINDS.admin} user={admin} />)
      expect(screen.queryByRole('button', { name: 'Calendar sync' })).toBeNull()
    })

    it('their Delete does not depend on the level of the session', async () => {
      const user = userEvent.setup()
      mocks.sessionUser = { id: 1, level: 2 }
      render(<Host />)
      await openMenu(user)
      expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    })

    it('their error status shows no alert: only the professional has a Calendar sync', () => {
      mocks.actionStatus = { loading: false, error: ['Something'] }
      render(<Host />)
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('their tabs are the same as before', () => {
      render(<Host />)
      expect(tabLabels()).toEqual(['Profile', 'Saved places', 'Stores', 'Orders'])
    })
  })
})
