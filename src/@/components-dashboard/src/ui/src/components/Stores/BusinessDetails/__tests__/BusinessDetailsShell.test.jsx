/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route } from 'react-router-dom'

// redesign SL-F2 (B2)
const mocks = vi.hoisted(() => ({
  user: { level: 0 },
  configs: {},
  project: 'ordering',
  storeUrl: 'https://shop.test/store/fastbite',
  emit: vi.fn(),
  addQuery: vi.fn(),
  removeQuery: vi.fn(),
  bodies: [],
  withLegacySideBar: false,
  // redesign stores 2.A: a section with a nested guard of its own (P/SectionSplit, 2.B)
  nestedLeave: null
}))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url }],
  useSession: () => [{ user: mocks.user }],
  useConfig: () => [{ configs: mocks.configs }],
  useApi: () => [{ project: mocks.project }],
  useEvent: () => [{ emit: mocks.emit }],
  BusinessDetails: () => null
}))

vi.mock('../../../../hooks/useUserSelectedAccess', () => ({ useSelectedAccessRole: () => false }))
vi.mock('../../../../hooks/useWebsiteUrl', () => ({ useStoreWebsiteUrl: () => mocks.storeUrl }))
vi.mock('../../../../utils', () => ({ addQueryToUrl: mocks.addQuery, removeQueryToUrl: mocks.removeQuery }))
vi.mock('../../SnoozeComponent', async () => {
  const { createElement } = await import('react')
  return { SnoozeComponent: () => createElement('div', { 'data-testid': 'snooze' }, 'snooze body') }
})
// The sections are B1's: here they are a box that can open a legacy SideBar and ask for the whole width.
vi.mock('../StoreSectionBody', async () => {
  const { createElement, useState } = await import('react')
  const { SideBar } = await import('../../../Shared/UI/SideBar')
  const { useNestedLeaveGuard } = await import('../../../Shared/Product/LeaveGuard')
  return {
    StoreSectionBody: (props) => {
      mocks.bodies.push(props)
      useNestedLeaveGuard(mocks.nestedLeave)
      const [legacyOpen, setLegacyOpen] = useState(true)
      return createElement(
        'div',
        { 'data-testid': 'section-body', 'data-section': props.section },
        mocks.withLegacySideBar && legacyOpen
          ? createElement(SideBar, { open: true, onClose: () => setLegacyOpen(false) }, createElement('span', null, 'legacy side bar'))
          : null,
        createElement('button', { type: 'button', onClick: () => props.setIsExtendExtraOpen(true) }, 'Extend')
      )
    }
  }
})

import { BusinessDetailsUI, getPanelSize } from '../index'
import { STORE_SECTION_QUERY_KEYS } from '../storeSections'

const CSS = readFileSync(path.resolve(__dirname, '../store-editor.css'), 'utf8')

const makeBusiness = (over = {}) => ({
  id: 42,
  name: 'Fast Bite',
  slug: 'fastbite',
  enabled: true,
  logo: 'https://img.test/logo.png',
  header: 'https://img.test/header.jpg',
  description: 'A modern quick-service restaurant',
  configs: [],
  ...over
})

const makeProps = (over = {}) => ({
  open: true,
  businessId: 42,
  onClose: vi.fn(),
  businessState: { loading: false, business: makeBusiness(), error: null },
  handleChangeActiveBusiness: vi.fn(async () => ({ ok: true })),
  handleDuplicateBusiness: vi.fn(),
  handleDeleteBusiness: vi.fn(),
  formState: { loading: false, changes: {} },
  setFormState: vi.fn(),
  handleUpdateBusinessClick: vi.fn(),
  actionStatus: { loading: false, error: null },
  streamConnectionState: { enabled: false },
  ...over
})

const setWidth = (width) => {
  window.innerWidth = width
  window.dispatchEvent(new Event('resize'))
}

const shell = (props, url = '/stores/list?id=42') => (
  <MemoryRouter initialEntries={[url]}>
    <BusinessDetailsUI {...props} />
  </MemoryRouter>
)

const panel = () => document.getElementById('business_details_bar')
const nav = () => screen.queryByRole('navigation', { name: 'Store sections' })
const choose = async (user, name) => user.click(within(nav()).getByRole('button', { name }))
const escape = () => fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' })

beforeEach(() => {
  mocks.user = { level: 0 }
  mocks.configs = {}
  mocks.project = 'ordering'
  mocks.storeUrl = 'https://shop.test/store/fastbite'
  mocks.bodies = []
  mocks.withLegacySideBar = false
  mocks.nestedLeave = null
  mocks.emit.mockClear()
  mocks.addQuery.mockClear()
  mocks.removeQuery.mockClear()
  setWidth(1280)
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('BusinessDetails shell · the panel', () => {
  it('is one fixed panel named by the store, with no width written on the node', () => {
    render(shell(makeProps()))
    expect(panel()).toHaveAttribute('data-open')
    expect(panel()).toHaveAttribute('data-size', 'base')
    expect(panel().getAttribute('style')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Fast Bite' })).toBeInTheDocument()
    expect(panel()).toHaveAccessibleName('Fast Bite')
  })

  it('stays closed (data-open absent) until `open`', () => {
    render(shell(makeProps({ open: false })))
    expect(panel()).not.toHaveAttribute('data-open')
  })

  it('is never a container, a containing block or a transform (legacy SideBars must paint over the page)', () => {
    const noComments = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/container-type|container-name|container:|contain:|transform|filter|will-change|perspective|translate:/)
    expect(noComments).toMatch(/\.odc-se-panel\s*\{[^}]*position:\s*fixed/)
    expect(noComments).toMatch(/z-index:\s*calc\(var\(--od-x-layer-chrome\) \+ 5\)/)
  })

  it.each([
    ['the Overview', { width: 1280, sectionOpen: false }, 'base'],
    ['a section from 1000px', { width: 1000, sectionOpen: true }, 'wide'],
    ['a section on a wide window', { width: 1600, sectionOpen: true }, 'wide'],
    ['a section between 500 and 999px (inside the same panel, full width)', { width: 999, sectionOpen: true }, 'full'],
    ['a section just above 500px', { width: 501, sectionOpen: true }, 'full'],
    ['the Overview at 501px', { width: 501, sectionOpen: false }, 'base'],
    ['a window of 500px or less', { width: 500, sectionOpen: false }, 'full'],
    ['Expand', { width: 1280, sectionOpen: false, isExpand: true }, 'full'],
    ['a section that asks for the whole width', { width: 1280, sectionOpen: true, isExtendExtraOpen: true }, 'full'],
    ['isExtendExtraOpen with no section (nothing to extend)', { width: 1280, sectionOpen: false, isExtendExtraOpen: true }, 'base']
  ])('picks the width for %s', (_, state, expected) => {
    expect(getPanelSize(state)).toBe(expected)
  })

  it('follows the window: Overview, a section at 1280, the same section at 800 and on a phone', async () => {
    const user = userEvent.setup()
    const { unmount } = render(shell(makeProps()))
    expect(panel()).toHaveAttribute('data-size', 'base')
    await choose(user, 'Schedule')
    expect(panel()).toHaveAttribute('data-size', 'wide')
    unmount()

    setWidth(800)
    const second = render(shell(makeProps()))
    await choose(user, 'Schedule')
    expect(panel()).toHaveAttribute('data-size', 'full')
    second.unmount()

    setWidth(390)
    render(shell(makeProps()))
    expect(panel()).toHaveAttribute('data-size', 'full')
  })

  it('Expand makes it full width and Collapse takes it back; it is not offered with a section open or on a narrow window', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(panel()).toHaveAttribute('data-size', 'full')
    await user.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(panel()).toHaveAttribute('data-size', 'base')
    await choose(user, 'Schedule')
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull()
  })

  it('does not offer Expand at 576px or less', () => {
    setWidth(576)
    render(shell(makeProps()))
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull()
  })

  it('the close button closes the editor', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(shell(props))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('BusinessDetails shell · sections', () => {
  it('lists the enabled sections in a navigation, with the Overview as the current one and below its summary', () => {
    render(shell(makeProps()))
    const list = within(nav())
    expect(list.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(list.getByRole('button', { name: 'Store details' })).toBeInTheDocument()
    expect(list.getByRole('button', { name: 'Business fees' })).toBeInTheDocument()
    // `personalization` and `places` are off, and so is a section whose config is missing
    expect(list.queryByRole('button', { name: 'Personalization' })).toBeNull()
    expect(list.queryByRole('button', { name: 'Places' })).toBeNull()
    expect(list.queryByRole('button', { name: 'Custom fields' })).toBeNull()
    // (G1-32): preorder no longer needs addon_catering, as in main
    expect(list.getByRole('button', { name: 'Preorders and lead times' })).toBeInTheDocument()
    expect(panel().querySelector('.odc-se-main')).toHaveAttribute('data-view', 'overview')
    // redesign stores 4.B (decision 3, G1-29): the summary comes first and the nav after it, in the same column
    const main = panel().querySelector('.odc-se-main')
    expect(main.firstElementChild).toHaveClass('odc-se-content')
    expect(main.lastElementChild).toBe(nav().closest('.odc-se-nav'))
    expect(screen.queryByTestId('section-body')).toBeNull()
  })

  it('opens a section from the list: the body gets the section and the controller props, the query gets `section`', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(shell(props))
    await choose(user, 'Schedule')
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'schedule')
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'schedule' })
    expect(mocks.removeQuery).not.toHaveBeenCalled() // nothing to clear coming from the Overview
    const body = mocks.bodies.at(-1)
    expect(body.businessState).toBe(props.businessState)
    expect(body.formState).toBe(props.formState)
    expect(body.isAdmin).toBe(true)
    expect(body.isExtendExtraOpen).toBe(false)
    expect(typeof body.setIsExtendExtraOpen).toBe('function')
    // the list stays as a column beside it, with the section as the current one
    expect(panel().querySelector('.odc-se-main')).toHaveAttribute('data-view', 'section')
    expect(within(nav()).getByRole('button', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByText('A modern quick-service restaurant')).toBeNull()
  })

  it('Overview in the list closes the section and clears the section query keys', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Schedule')
    await choose(user, 'Overview')
    expect(screen.queryByTestId('section-body')).toBeNull()
    expect(mocks.removeQuery).toHaveBeenCalledWith(STORE_SECTION_QUERY_KEYS)
    expect(panel()).toHaveAttribute('data-size', 'base')
  })

  // redesign stores 2.A (decision 4): it used to save what the form held without a word; now it asks first
  it('goes from a section to another clearing the keys of the first; with a pending form it asks first and saves on «Save and continue»', async () => {
    const user = userEvent.setup()
    const props = makeProps({
      formState: { loading: false, changes: { name: 'Fast Bite 2' } },
      handleUpdateBusinessClick: vi.fn(async () => ({ ok: true }))
    })
    render(shell(props, '/stores/list?id=42&section=schedule'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'schedule'))
    props.handleUpdateBusinessClick.mockClear() // the Overview's autosave on mount is not what is under test
    mocks.addQuery.mockClear()
    await choose(user, 'Menu')
    const dialog = await screen.findByRole('alertdialog')
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'schedule')
    await user.click(within(dialog).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'menu'))
    expect(props.handleUpdateBusinessClick).toHaveBeenCalledTimes(1)
    expect(mocks.removeQuery).toHaveBeenCalledWith(STORE_SECTION_QUERY_KEYS)
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'menu' })
    const [save, clear, add] = [
      props.handleUpdateBusinessClick.mock.invocationCallOrder[0],
      mocks.removeQuery.mock.invocationCallOrder.at(-1),
      mocks.addQuery.mock.invocationCallOrder.at(-1)
    ]
    expect(save).toBeLessThan(clear)
    expect(clear).toBeLessThan(add)
  })

  it('does not save when switching sections with nothing pending, or while the form is already saving', async () => {
    const user = userEvent.setup()
    const clean = makeProps()
    const first = render(shell(clean))
    await choose(user, 'Schedule')
    await choose(user, 'Menu')
    expect(clean.handleUpdateBusinessClick).not.toHaveBeenCalled()
    first.unmount()

    const saving = makeProps({ formState: { loading: true, changes: { name: 'x' } } })
    render(shell(saving))
    await choose(user, 'Schedule')
    await choose(user, 'Menu')
    expect(saving.handleUpdateBusinessClick).not.toHaveBeenCalled()
  })

  it('applies the ?section= deep link once, when the store has loaded, without writing the query', async () => {
    const loadingProps = makeProps({ businessState: { loading: true, business: null, error: null } })
    const { rerender } = render(shell(loadingProps, '/stores/list?id=42&section=delivery_pickup_more'))
    expect(screen.queryByTestId('section-body')).toBeNull()
    rerender(shell(makeProps(), '/stores/list?id=42&section=delivery_pickup_more'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'delivery_pickup_more'))
    expect(mocks.addQuery).not.toHaveBeenCalled()
  })

  it('a deep link is not checked against the config rules (as today)', async () => {
    render(shell(makeProps(), '/stores/list?id=42&section=places'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'places'))
  })

  // tanda P: Places stays reachable by URL only (decision 8 of Stores, ); the rule that lists the open section
  // (G1-26, for Custom fields) put it in the menu while it was open. It stays out of the menu, as in main.
  it('?section=places opens Places without listing it in the menu', async () => {
    render(shell(makeProps(), '/stores/list?id=42&section=places'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'places'))
    expect(within(nav()).queryByRole('button', { name: 'Places' })).toBeNull()
  })

  // `support` and `personalization` were deleted as dead code (decision 8, n.º 22). An old link lands on the
  // Overview, not on an empty body, and the section keys leave the address; so does any key the editor does not have.
  it.each(['support', 'personalization', 'no_such_section'])('?section=%s opens the Overview and clears the section keys', async (section) => {
    render(shell(makeProps(), `/stores/list?id=42&section=${section}`))
    await waitFor(() => expect(mocks.removeQuery).toHaveBeenCalledWith(STORE_SECTION_QUERY_KEYS))
    expect(screen.queryByTestId('section-body')).toBeNull()
    expect(panel().querySelector('.odc-se-main')).toHaveAttribute('data-view', 'overview')
    expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(mocks.addQuery).not.toHaveBeenCalled()
  })

  // redesign stores 4.A (decision 2)
  it('groups the sections under five titles, in order, with Notifications among orders and the admin sections under payments', () => {
    render(shell(makeProps()))
    const titles = [...nav().querySelectorAll('.odc-sectionnav-group')].map(node => node.textContent)
    expect(titles).toEqual(['Store', 'Orders & delivery', 'Payments & fees', 'Channels', 'Integrations & activity'])
    const groupOf = (name) => within(nav()).getByRole('button', { name }).closest('ul').getAttribute('aria-labelledby')
    const titleOf = (name) => document.getElementById(groupOf(name)).textContent
    expect(titleOf('Overview')).toBe('Store')
    expect(titleOf('Notifications')).toBe('Orders & delivery')
    expect(titleOf('Markups')).toBe('Payments & fees')
    expect(titleOf('QR Codes')).toBe('Channels')
    expect(titleOf('Logs')).toBe('Integrations & activity')
  })

  // redesign stores 4.A (decision 11): the body follows the menu's level and role rules
  it.each([
    ['markups', 'Markups'],
    ['business_fees', 'Business fees'],
    ['publishing', 'QR Codes']
  ])('a store owner who follows ?section=%s gets the Overview with a notice, and the section leaves the address', async (section, label) => {
    mocks.user = { level: 2 }
    render(shell(makeProps(), `/stores/list?id=42&section=${section}`))
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(`Your account can't open ${label} for this store, so this is its overview.`)
    expect(screen.queryByTestId('section-body')).toBeNull()
    expect(panel().querySelector('.odc-se-main')).toHaveAttribute('data-view', 'overview')
    expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(mocks.removeQuery).toHaveBeenCalledWith(STORE_SECTION_QUERY_KEYS)
    expect(mocks.addQuery).not.toHaveBeenCalled()
  })

  // main hides White Label for every project; an old link to it is an old link, not a missing permission
  it.each([[0], [2]])('level %s following ?section=white_label gets the Overview without a notice while White Label is hidden', async (level) => {
    mocks.user = { level }
    render(shell(makeProps(), '/stores/list?id=42&section=white_label'))
    await waitFor(() => expect(mocks.removeQuery).toHaveBeenCalledWith(STORE_SECTION_QUERY_KEYS))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByTestId('section-body')).toBeNull()
    expect(panel().querySelector('.odc-se-main')).toHaveAttribute('data-view', 'overview')
  })

  it('level 0 still opens those sections by address', async () => {
    render(shell(makeProps(), '/stores/list?id=42&section=markups'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'markups'))
    expect(screen.queryByText(/Your account can't open/)).toBeNull()
  })

  it('a store owner opens the sections the menu gives them by address, as before', async () => {
    mocks.user = { level: 2 }
    render(shell(makeProps(), '/stores/list?id=42&section=business_payment_account'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'business_payment_account'))
  })

  it('a tab with its own rule follows it: level 2 gets the Overview for ?tab=owner, and the section with any other tab', async () => {
    mocks.user = { level: 2 }
    const { unmount } = render(shell(makeProps(), '/stores/list?id=42&section=store_details&tab=owner'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Store details › Owner')
    expect(screen.queryByTestId('section-body')).toBeNull()
    unmount()

    render(shell(makeProps(), '/stores/list?id=42&section=store_details&tab=location'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'store_details'))
  })

  // redesign bugs C: the sections its menu hides are closed by address too
  // main an EatStreet owner opens the driver group tab and Logs, Tax & fees, Layout and Webhooks as any owner
  it('an EatStreet owner opens the driver group tab and the sections other owners open', async () => {
    mocks.user = { level: 2 }
    mocks.project = 'eatstreet'
    for (const section of ['logs', 'tax_fees', 'layout', 'webhooks']) {
      const view = render(shell(makeProps(), `/stores/list?id=42&section=${section}`))
      await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', section))
      expect(screen.queryByRole('alert')).toBeNull()
      view.unmount()
    }
  })

  it('the selected access role gets the Overview for a section its menu does not give it', async () => {
    mocks.user = { level: 2, selected_access: true }
    render(shell(makeProps(), '/stores/list?id=42&section=store_details'))
    expect(await screen.findByRole('alert')).toHaveTextContent("Your account can't open Store details for this store, so this is its overview.")
    expect(screen.queryByTestId('section-body')).toBeNull()
  })

  it('the notice goes away when a section is chosen, or with its close button', async () => {
    const user = userEvent.setup()
    mocks.user = { level: 2 }
    const { unmount } = render(shell(makeProps(), '/stores/list?id=42&section=markups'))
    await screen.findByRole('alert')
    await choose(user, 'Schedule')
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'schedule')
    await choose(user, 'Overview')
    expect(screen.queryByText(/Your account can't open/)).toBeNull()
    unmount()

    render(shell(makeProps(), '/stores/list?id=42&section=markups'))
    const notice = await screen.findByRole('alert')
    await user.click(within(notice).getByRole('button', { name: 'Close' }))
    expect(screen.queryByText(/Your account can't open/)).toBeNull()
  })

  // redesign bugs E (R-1): Duplicate follows the one rule of the list (canRegisterStores); it used to need '1'
  it('the ⋯ menu offers «Duplicate» to a store owner unless the project turned owner registration off', async () => {
    const user = userEvent.setup()
    const duplicateOffered = async (configs) => {
      mocks.user = { level: 2 }
      mocks.configs = configs
      const view = render(shell(makeProps()))
      await user.click(screen.getByRole('button', { name: 'More actions' }))
      await screen.findByRole('menu')
      const offered = !!screen.queryByRole('menuitem', { name: 'Duplicate' })
      view.unmount()
      return offered
    }
    expect(await duplicateOffered({})).toBe(true)
    expect(await duplicateOffered({ allow_business_owner_register_business: { value: true } })).toBe(true)
    expect(await duplicateOffered({ allow_business_owner_register_business: { value: '1' } })).toBe(true)
    expect(await duplicateOffered({ allow_business_owner_register_business: { value: '0' } })).toBe(false)
  })

  // redesign bugs C: it used to open the section for a role whose menu has no Custom fields
  it('the ⋯ menu does not offer «Custom fields» to the selected access role', async () => {
    const user = userEvent.setup()
    mocks.user = { level: 2, selected_access: true }
    mocks.configs = { show_metafields: { value: '1' } }
    render(shell(makeProps()))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await screen.findByRole('menu')
    expect(screen.queryByRole('menuitem', { name: 'Custom fields' })).toBeNull()
  })

  // redesign bugs C: a project with show_metafields = '0' sees no Custom fields in the list nor in the ⋯ menu
  it('with show_metafields = \'0\' neither the list nor the ⋯ menu offers «Custom fields»; with \'1\' both do', async () => {
    const user = userEvent.setup()
    mocks.configs = { show_metafields: { value: '0' } }
    const { unmount } = render(shell(makeProps()))
    expect(within(nav()).queryByRole('button', { name: 'Custom fields' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await screen.findByRole('menu')
    expect(screen.queryByRole('menuitem', { name: 'Custom fields' })).toBeNull()
    unmount()

    mocks.configs = { show_metafields: { value: '1' } }
    render(shell(makeProps()))
    expect(within(nav()).getByRole('button', { name: 'Custom fields' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Custom fields' })).toBeInTheDocument()
  })

  it('the body gets the access of the session (the second lock)', async () => {
    mocks.user = { level: 2, selected_access: true }
    render(shell(makeProps(), '/stores/list?id=42&section=payment_methods'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'payment_methods'))
    expect(mocks.bodies.at(-1).sectionAccess).toMatchObject({ isAdmin: false, isSelectedAccessRole: true, level: 2 })
  })

  it('«Custom fields» of the ⋯ menu opens that section', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'custom_fields')
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'custom_fields' })
    // redesign stores 4.A (G1-26): the menu hides it without show_metafields, but the open section is listed and marked
    expect(within(nav()).getByRole('button', { name: 'Custom fields' })).toHaveAttribute('aria-current', 'page')
  })

  it('a section that asks for the whole width hides the list and offers «All sections»; going back or changing section resets it', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Schedule')
    await user.click(screen.getByRole('button', { name: 'Extend' }))
    expect(nav()).toBeNull()
    expect(panel()).toHaveAttribute('data-size', 'full')
    expect(panel().querySelector('.odc-se-main')).toHaveAttribute('data-nav', 'hidden')
    expect(mocks.bodies.at(-1).isExtendExtraOpen).toBe(true)

    await user.click(screen.getByRole('button', { name: 'All sections' }))
    expect(nav()).not.toBeNull()
    expect(panel()).toHaveAttribute('data-size', 'wide')
    expect(screen.queryByRole('button', { name: 'All sections' })).toBeNull()

    // extended again, then another section from the ⋯ menu: the width is reset
    await user.click(screen.getByRole('button', { name: 'Extend' }))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
    expect(mocks.bodies.at(-1).isExtendExtraOpen).toBe(false)
    expect(nav()).not.toBeNull()
  })

  // redesign bugs F row 20 (R-6b of 2.B): «All sections» goes away with its click, and the focus fell to <body>; it goes to
  // the entry of the open section in the list that comes back
  it('«All sections» gives the focus to the open section in the list, not to <body>', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Schedule')
    await user.click(screen.getByRole('button', { name: 'Extend' }))
    await user.click(screen.getByRole('button', { name: 'All sections' }))
    expect(within(nav()).getByRole('button', { name: 'Schedule' })).toHaveFocus()
  })

  // live check L-2 (390): the section that goes away hands its focus back a frame later, to <body>; the entry takes it again
  it('«All sections»: a focus dropped to <body> right after goes back to the open section\'s entry', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Schedule')
    await user.click(screen.getByRole('button', { name: 'Extend' }))
    await user.click(screen.getByRole('button', { name: 'All sections' }))
    act(() => { document.activeElement.blur() })
    expect(document.body).toHaveFocus()
    await waitFor(() => expect(within(nav()).getByRole('button', { name: 'Schedule' })).toHaveFocus())
  })

  it('goes back to the Overview when another store is opened', async () => {
    const props = makeProps()
    const { rerender } = render(shell(props, '/stores/list?id=42&section=schedule'))
    await waitFor(() => expect(screen.getByTestId('section-body')).toBeInTheDocument())
    rerender(shell({ ...props, businessId: 43, businessState: { loading: true, business: null, error: null } }, '/stores/list?id=43'))
    expect(screen.queryByTestId('section-body')).toBeNull()
  })
})

// redesign stores 4.B (decision 4, G1-28): the slug has its own «Save»; nothing is sent as it is typed
describe('BusinessDetails shell · no autosave of the shared form', () => {
  it('does not send the slug (or anything the form holds) by itself, with or without a section open', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    const { rerender } = render(shell(props))
    rerender(shell({ ...props, formState: { loading: false, changes: { slug: 'new-slug' } } }))
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()

    // a section is open: going back to the Overview with changes asks (2.A) instead of sending them
    rerender(shell({ ...props, formState: { loading: false, changes: {} } }))
    await choose(user, 'Schedule')
    rerender(shell({ ...props, formState: { loading: false, changes: { name: 'edited' } } }))
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()
    await choose(user, 'Overview')
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()
    expect(screen.getByTestId('section-body')).toBeInTheDocument()
  })
})

// redesign stores 2.A (decision 4)
describe('BusinessDetails shell · leave guard', () => {
  const dirty = (over = {}) => makeProps({
    formState: { loading: false, changes: { front_layout: 'groceries' } },
    handleUpdateBusinessClick: vi.fn(async () => ({ ok: true })),
    ...over
  })
  // opens a section and forgets the Overview's autosave of the mount
  const inSection = async (props, section = 'layout') => {
    const view = render(shell(props, `/stores/list?id=42&section=${section}`))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', section))
    props.handleUpdateBusinessClick.mockClear()
    props.setFormState.mockClear()
    mocks.addQuery.mockClear()
    mocks.removeQuery.mockClear()
    return view
  }
  const dialog = () => screen.findByRole('alertdialog')

  // redesign stores 5.18 (; 5.13 noted it, the coordinator ruled it is not a defect): «All sections» only shows the list of
  // sections again. The open section, its unsaved change and the address stay as they were, so it does not ask; choosing another
  // section from that list is a way out and asks.
  it('«All sections» with unsaved changes keeps the section, the change and the address; another section then asks', async () => {
    const user = userEvent.setup()
    const props = dirty()
    await inSection(props, 'business_fees')
    await user.click(screen.getByRole('button', { name: 'Extend' }))
    const body = screen.getByTestId('section-body')
    await user.click(screen.getByRole('button', { name: 'All sections' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('section-body')).toBe(body)
    expect(body).toHaveAttribute('data-section', 'business_fees')
    expect(props.setFormState).not.toHaveBeenCalled()
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()
    expect(mocks.addQuery).not.toHaveBeenCalled()
    expect(mocks.removeQuery).not.toHaveBeenCalled()
    await choose(user, 'Menu')
    expect(await dialog()).toHaveAccessibleName('Save your changes?')
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'business_fees')
  })

  it('asks with three choices, the focus on «Keep editing», naming the section', async () => {
    const user = userEvent.setup()
    await inSection(dirty())
    await choose(user, 'Menu')
    const box = await dialog()
    expect(box).toHaveAccessibleName('Save your changes?')
    expect(box).toHaveTextContent('You have unsaved changes in Layout. Save them before you leave, or discard them.')
    expect(within(box).getAllByRole('button').map(b => b.textContent).filter(Boolean)).toEqual(['Keep editing', 'Save and continue', 'Discard'])
    await waitFor(() => expect(within(box).getByRole('button', { name: 'Keep editing' })).toHaveFocus())
  })

  // review F3-R2: the panel had the focus (Escape from it); «Keep editing» gives it back, not to the first control of the header
  it('«Keep editing» gives the focus back to where it was when it asked, the panel included', async () => {
    const user = userEvent.setup()
    await inSection(dirty())
    panel().focus()
    escape()
    await user.click(within(await dialog()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(panel()).toHaveFocus())
  })

  it('a palette navigation (⌘K, Mia) asks the open editor first; keeping editing leaves the page as it was', async () => {
    const { requestRouteLeave } = await import('../../../../utils/routeLeaveGuard')
    const user = userEvent.setup()
    const props = dirty()
    await inSection(props)
    const go = vi.fn()
    React.act(() => { requestRouteLeave(go) })
    await user.click(within(await dialog()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(go).not.toHaveBeenCalled()
    React.act(() => { requestRouteLeave(go) })
    await user.click(within(await dialog()).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(go).toHaveBeenCalledTimes(1))
  })

  // redesign bugs E: the sidebar, links and back/forward ask too (useRouteLeaveGuard), not only ⌘K and Mia
  it('a route change to another page asks while the shared form holds changes, and goes at once when it holds none', async () => {
    const user = userEvent.setup()
    const route = {}
    const tree = (props) => (
      <MemoryRouter initialEntries={['/stores/list?id=42&section=layout']}>
        <BusinessDetailsUI {...props} />
        <Route path='*' render={({ history, location }) => { route.history = history; route.path = location.pathname; return null }} />
      </MemoryRouter>
    )
    const view = render(tree(dirty()))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'layout'))
    act(() => { route.history.push('/orders') })
    await user.click(within(await dialog()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(route.path).toBe('/stores/list')
    view.unmount()

    render(tree(makeProps({ formState: { loading: false, changes: {} } })))
    await waitFor(() => expect(screen.getByTestId('section-body')).toBeInTheDocument())
    act(() => { route.history.push('/orders') })
    expect(route.path).toBe('/orders')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  // review E2-5: the shared form registers by hand; it tells the host when it becomes dirty after the mount
  it('a shared form that becomes dirty after the mount holds the page too', async () => {
    const route = {}
    const tree = (props) => (
      <MemoryRouter initialEntries={['/stores/list?id=42&section=layout']}>
        <BusinessDetailsUI {...props} />
        <Route path='*' render={({ history, location }) => { route.history = history; route.path = location.pathname; return null }} />
      </MemoryRouter>
    )
    const clean = makeProps({ formState: { loading: false, changes: {} } })
    const view = render(tree(clean))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'layout'))
    view.rerender(tree({ ...clean, formState: { loading: false, changes: { front_layout: 'groceries' } } }))
    act(() => { route.history.push('/orders') })
    expect(await dialog()).toBeInTheDocument()
    expect(route.path).toBe('/stores/list')
  })

  it('«Keep editing» stays, writes nothing and puts the open section back in the address', async () => {
    const user = userEvent.setup()
    const props = dirty()
    await inSection(props)
    await choose(user, 'Menu')
    await user.click(within(await dialog()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'layout')
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()
    expect(props.setFormState).not.toHaveBeenCalled()
    expect(mocks.addQuery).toHaveBeenLastCalledWith({ section: 'layout' })
  })

  it('«Discard» empties the shared form and leaves without writing', async () => {
    const user = userEvent.setup()
    const props = dirty()
    await inSection(props)
    await choose(user, 'Menu')
    await user.click(within(await dialog()).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'menu'))
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()
    expect(props.setFormState).toHaveBeenCalledTimes(1)
    expect(props.setFormState.mock.calls[0][0]({ loading: false, changes: { front_layout: 'groceries' } })).toEqual({ loading: false, changes: {} })
  })

  it('a «Save and continue» that fails stays on the section', async () => {
    const user = userEvent.setup()
    const props = dirty({ handleUpdateBusinessClick: vi.fn(async () => ({ ok: false, error: ['Slug already in use'] })) })
    await inSection(props)
    await choose(user, 'Menu')
    await user.click(within(await dialog()).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(props.handleUpdateBusinessClick).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'layout')
  })

  it('the Overview, «Categories & products», the close button and Escape ask too', async () => {
    const user = userEvent.setup()
    const props = dirty()
    await inSection(props)

    await choose(user, 'Overview')
    await user.click(within(await dialog()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('section-body')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Categories & products' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.emit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(props.onClose).not.toHaveBeenCalled()

    panel().focus()
    escape()
    await user.click(within(await dialog()).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()
  })

  it('«Categories & products» with «Save and continue» saves and then goes (G5-48)', async () => {
    const user = userEvent.setup()
    const props = dirty()
    await inSection(props)
    await user.click(screen.getByRole('link', { name: 'Categories & products' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(mocks.emit).toHaveBeenCalledWith('go_to_page', { page: 'store', params: { store: 'fastbite' } }))
    expect(props.handleUpdateBusinessClick.mock.invocationCallOrder[0]).toBeLessThan(mocks.emit.mock.invocationCallOrder[0])
  })

  it('without changes, or while the form is saving, every way out goes at once', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    await inSection(props)
    await choose(user, 'Menu')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'menu')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('the list asks through `leaveGuardRef`; keeping editing puts the section back and calls its onCancel', async () => {
    const leaveGuardRef = React.createRef()
    const props = dirty({ leaveGuardRef })
    await inSection(props)
    const go = vi.fn()
    const onCancel = vi.fn()
    let asked
    React.act(() => { asked = leaveGuardRef.current.requestLeave(go, onCancel) })
    expect(asked).toBe(true)
    const user = userEvent.setup()
    await user.click(within(await dialog()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
    expect(go).not.toHaveBeenCalled()
    expect(mocks.addQuery).toHaveBeenLastCalledWith({ section: 'layout' })
  })

  it('a nested guard of the section (P/SectionSplit) answers first on every way out of the shell', async () => {
    const user = userEvent.setup()
    let keep = true
    mocks.nestedLeave = vi.fn(proceed => { if (!keep) proceed() })
    const leaveGuardRef = React.createRef()
    const props = makeProps({ leaveGuardRef })
    await inSection(props)

    await choose(user, 'Menu')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    panel().focus()
    escape()
    React.act(() => { leaveGuardRef.current.requestLeave(vi.fn()) })
    expect(mocks.nestedLeave).toHaveBeenCalledTimes(4)
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'layout')
    expect(props.onClose).not.toHaveBeenCalled()

    keep = false
    await choose(user, 'Overview')
    expect(screen.queryByTestId('section-body')).toBeNull()
  })

  it('an address for another store (⌘K) is left to the list: the editor does not change section', async () => {
    const props = makeProps()
    const { rerender } = await inSection(props)
    rerender(shell(props, '/stores/list?id=43&section=menu'))
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'layout')
  })
})

describe('BusinessDetails shell · Escape', () => {
  it('closes the editor on Escape, at any width', () => {
    setWidth(600)
    const props = makeProps()
    render(shell(props))
    escape()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('does nothing after it is unmounted or while it is not `open`', () => {
    const props = makeProps({ open: false })
    const { unmount } = render(shell(props))
    escape()
    expect(props.onClose).not.toHaveBeenCalled()
    unmount()

    const other = makeProps()
    const second = render(shell(other))
    second.unmount()
    escape()
    expect(other.onClose).not.toHaveBeenCalled()
  })

  it('a legacy SideBar open over the editor closes first; then Escape closes the editor', async () => {
    mocks.withLegacySideBar = true
    const user = userEvent.setup()
    const props = makeProps()
    render(shell(props))
    await choose(user, 'Schedule')
    expect(screen.getByText('legacy side bar')).toBeInTheDocument()

    escape()
    expect(props.onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('legacy side bar')).toBeNull())

    escape()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('an open dialog takes Escape: the Snooze dialog is closed by it and the editor stays', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(shell(props))
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    escape()
    expect(props.onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    escape()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('an error alert takes Escape too', async () => {
    const props = makeProps({ actionStatus: { loading: false, error: ['Something failed'] } })
    render(shell(props))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    escape()
    expect(props.onClose).not.toHaveBeenCalled()
  })
})

describe('BusinessDetails shell · states and alerts', () => {
  it('shows the errors of an action and of the store in an alert dialog', async () => {
    const props = makeProps({ actionStatus: { loading: false, error: ['Not allowed'] } })
    const { rerender } = render(shell(props))
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText('Not allowed')).toBeInTheDocument()
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    rerender(shell({ ...props, actionStatus: { loading: false, error: null }, businessState: { ...props.businessState, error: ['Store failed to load'] } }))
    expect(within(await screen.findByRole('alertdialog')).getByText('Store failed to load')).toBeInTheDocument()
  })

  it('shows skeletons and a busy panel while loading, with no list of sections', () => {
    render(shell(makeProps({ businessState: { loading: true, business: null, error: null } })))
    expect(panel()).toHaveAttribute('aria-busy', 'true')
    expect(nav()).toBeNull()
    expect(panel().querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByText('Fast Bite')).toBeNull()
    expect(panel()).toHaveAccessibleName('Loading')
  })

  it('shows «not found» with a way back to the stores', async () => {
    const user = userEvent.setup()
    const props = makeProps({ businessState: { loading: false, business: null, error: null } })
    render(shell(props))
    expect(screen.getByText('Sorry, we couldn\'t find the requested business.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to Stores' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(nav()).toBeNull()
  })
})

describe('BusinessDetails shell · Overview', () => {
  // redesign stores 4.B (decision 3): the header image is edited in Store details › Information and no longer drawn here
  it('draws the summary, the slug and the description, and no header image', () => {
    render(shell(makeProps()))
    expect(panel().querySelector('img[src="https://img.test/header.jpg"]')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Slug' })).toHaveValue('fastbite')
    expect(screen.getByText('A modern quick-service restaurant')).toBeInTheDocument()
  })

  it('a figure opens its section the way the list does, and has no link when the menu does not offer that section', async () => {
    const user = userEvent.setup()
    const business = makeBusiness({ menus_count: 2, available_menus_count: 1, paymethods: [{ enabled: true }, { enabled: false }] })
    render(shell(makeProps({ businessState: { loading: false, business, error: null } })))
    // only the numbers are figures, so the phrase is split in elements
    expect(screen.getByText('Menus available').closest('.odc-se-fact')).toHaveTextContent('1 of 2')
    await user.click(screen.getByRole('button', { name: 'Open Menu' }))
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'menu' })
    expect(mocks.bodies.at(-1).section).toBe('menu')
  })

  // review 4.B #1: the slug waits for its «Save» in the shared form, so opening a section from the Overview asks first
  it('opening a section from the Overview with the slug unsaved asks first, naming the Overview', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: { loading: false, changes: { slug: 'quick' } } })
    render(shell(props))
    await choose(user, 'Schedule')
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/unsaved changes in Overview/)).toBeInTheDocument()
    expect(screen.queryByTestId('section-body')).toBeNull()
  })

  it('a section chosen in the list takes the focus to its entry, though the list moves beside it', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Schedule')
    await waitFor(() => expect(within(nav()).getByRole('button', { name: 'Schedule' })).toHaveFocus())
    await choose(user, 'Overview')
    await waitFor(() => expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveFocus())
  })

  it('the slug typed goes to the shared form (so leaving asks) and is saved alone with «Save»', async () => {
    const user = userEvent.setup()
    const props = makeProps({ handleUpdateBusinessClick: vi.fn(async () => ({ ok: true })) })
    render(shell(props))
    fireEvent.change(screen.getByRole('textbox', { name: 'Slug' }), { target: { value: 'quick' } })
    const update = props.setFormState.mock.calls.at(-1)[0]
    expect(update({ loading: false, changes: { other: 1 } })).toEqual({ loading: false, changes: { other: 1, slug: 'quick' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.handleUpdateBusinessClick).toHaveBeenCalledWith({ slug: 'quick' }, { keepPendingChanges: true })
  })

  // main 4b7ff4f9 + owner decision 1A: Clover is connected from Connect › POS, not from the store
  it('has no Clover button, not even for an admin', () => {
    render(shell(makeProps()))
    expect(screen.queryByRole('button', { name: /clover/i })).toBeNull()
  })

  // main the slug is everyone's on every project
  it('shows the slug to a non-admin of an EatStreet project too', () => {
    mocks.project = 'eatstreet'
    mocks.user = { level: 2 }
    render(shell(makeProps()))
    expect(screen.getByRole('textbox', { name: 'Slug' })).toBeInTheDocument()
  })

  it('the open-site icon is there unless the white label module is on, and is off without a store URL', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const first = render(shell(makeProps()))
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(open).toHaveBeenCalledWith('https://shop.test/store/fastbite', '_blank', 'noopener,noreferrer')
    first.unmount()

    mocks.storeUrl = null
    const second = render(shell(makeProps()))
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
    second.unmount()

    mocks.storeUrl = 'https://shop.test/store/fastbite'
    mocks.configs = { white_label_module: { value: true } }
    render(shell(makeProps()))
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
    open.mockRestore()
  })

  it('«Categories & products» goes to the store products page of the slug', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await user.click(screen.getByRole('link', { name: 'Categories & products' }))
    expect(mocks.emit).toHaveBeenCalledWith('go_to_page', { page: 'store', params: { store: 'fastbite' } })
  })

  // redesign bugs Q: at 390 the panel covers the screen, so what is behind it is out of the tab order
  describe('modal when it covers the screen', () => {
    // the editor decides it from its own panel size (`full`), not from a media query: matchMedia is not even there
    const realMatchMedia = window.matchMedia
    const behind = document.createElement('div')
    beforeEach(() => {
      window.matchMedia = undefined
      document.body.appendChild(behind)
    })
    afterEach(() => {
      window.matchMedia = realMatchMedia
      behind.remove()
    })

    it('at 390 the page behind is inert and the aside is a modal dialog', () => {
      setWidth(390)
      const { unmount } = render(shell(makeProps()))
      expect(behind).toHaveAttribute('inert')
      expect(panel()).toHaveAttribute('role', 'dialog')
      expect(panel()).toHaveAttribute('aria-modal', 'true')
      unmount()
      expect(behind).not.toHaveAttribute('inert')
    })

    it('at 800 with a section open the panel is full, so it is modal too (it covers the list)', async () => {
      const user = userEvent.setup()
      setWidth(800)
      render(shell(makeProps()))
      expect(panel()).toHaveAttribute('data-size', 'base')
      expect(behind).not.toHaveAttribute('inert')
      await choose(user, 'Schedule')
      expect(panel()).toHaveAttribute('data-size', 'full')
      expect(behind).toHaveAttribute('inert')
      expect(panel()).toHaveAttribute('role', 'dialog')
      expect(panel()).toHaveAttribute('aria-modal', 'true')
      await user.click(within(nav()).getByRole('button', { name: 'Overview' }))
      expect(panel()).toHaveAttribute('data-size', 'base')
      expect(behind).not.toHaveAttribute('inert')
      expect(panel()).not.toHaveAttribute('aria-modal')
    })

    it('at 1280 the Overview stays a non-modal panel beside the list', () => {
      setWidth(1280)
      render(shell(makeProps()))
      expect(panel()).toHaveAttribute('data-size', 'base')
      expect(behind).not.toHaveAttribute('inert')
      expect(panel()).not.toHaveAttribute('aria-modal')
    })

    it('at 1440 the Overview is not modal either', () => {
      setWidth(1440)
      render(shell(makeProps()))
      expect(behind).not.toHaveAttribute('inert')
      expect(panel()).not.toHaveAttribute('role', 'dialog')
    })
  })

  // redesign bugs Q
  it('«Categories & products» is a real link, and a Cmd + click leaves the shell out of it', () => {
    render(shell(makeProps()))
    const link = screen.getByRole('link', { name: 'Categories & products' })
    expect(link).toHaveAttribute('href', '/stores/products/fastbite')
    expect(fireEvent.click(link, { metaKey: true })).toBe(true)
    expect(mocks.emit).not.toHaveBeenCalled()
  })
})

// redesign SL-(R-04, R-06, R-01): found by the phase 3 review
describe('BusinessDetails shell · review fixes', () => {
  it('takes the focus when it opens and gives it back to the opener when it closes (R-04)', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(shell(makeProps()))
    expect(document.activeElement).toBe(panel())
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  // R-01, then (O-7): P/Menu mounts on the overlay role (overlay + 9), above the panel (chrome + 5) and above the
  // dialog host; the old chrome + 6 lift while the panel was open now pulled the menus under a dialog, so it is gone
  it('keeps the action menus on their own overlay layer, above the open panel (R-01, O-7)', () => {
    expect(CSS).toMatch(/\.odc-se-panel \{[^}]*z-index: calc\(var\(--od-x-layer-chrome\) \+ 5\)/)
    expect(CSS).not.toMatch(/\.odc-menu-positioner \{[^}]*z-index/)
  })
})

// redesign tanda AB (): with the Overview docked beside the list, the panel starts under the page header
// (the list tells it where, `dockTop`) instead of at y = 0, so opening or closing it never moves the header. jsdom does no layout:
// these pin the attributes the node gets and the rule that reads them.
describe('BusinessDetails shell · docked under the page header', () => {
  it('takes the top the list measured: data-docked and --odc-se-dock-top, with no width on the node', () => {
    render(shell(makeProps({ dockTop: 92 })))
    expect(panel()).toHaveAttribute('data-docked')
    expect(panel()).toHaveAttribute('data-size', 'base')
    expect(panel().style.getPropertyValue('--odc-se-dock-top')).toBe('92px')
    expect(panel().style.inlineSize).toBe('')
    expect(panel().style.width).toBe('')
  })

  it('stays as it is (y = 0, full height) without a dockTop', () => {
    const first = render(shell(makeProps()))
    expect(panel()).not.toHaveAttribute('data-docked')
    expect(panel().getAttribute('style')).toBeNull()
    first.unmount()
    render(shell(makeProps({ dockTop: null })))
    expect(panel()).not.toHaveAttribute('data-docked')
    expect(panel().getAttribute('style')).toBeNull()
  })

  it('does not dock a section (wide) or Expand (full), even if a dockTop is still on the way', async () => {
    const user = userEvent.setup()
    render(shell(makeProps({ dockTop: 92 })))
    expect(panel()).toHaveAttribute('data-docked')
    await choose(user, 'Schedule')
    expect(panel()).toHaveAttribute('data-size', 'wide')
    expect(panel()).not.toHaveAttribute('data-docked')
    expect(panel().style.getPropertyValue('--odc-se-dock-top')).toBe('')
  })

  it('reads the top in CSS only for the docked Overview, and keeps y = 0 for every other state', () => {
    const noComments = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const rule = noComments.match(/\.odc-se-panel\[data-open\]\[data-size='base'\]\[data-docked\]\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/inset-block-start:\s*var\(--odc-se-dock-top, 0\)/)
    expect(rule[1]).toMatch(/block-size:\s*calc\(var\(--vh, 1vh\) \* 100 - var\(--odc-se-dock-top\)\)/)
    // the base rule is still y = 0 and the full height
    expect(noComments).toMatch(/\.odc-se-panel\s*\{[^}]*inset-block-start:\s*0;[^}]*block-size:\s*calc\(var\(--vh, 1vh\) \* 100\)/)
    // no rule other than the docked one reads the variable
    expect(noComments.match(/--odc-se-dock-top/g)).toHaveLength(2)
  })
})
