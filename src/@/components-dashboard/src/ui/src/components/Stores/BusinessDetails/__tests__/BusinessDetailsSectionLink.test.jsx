/* eslint-disable import/first */
// redesign SL-F1 (A3): the editor follows `?section=` while it is already open for the same store. The ⋯ menu of the list opens a store
// with `section=schedule` through the router (`history.replace`); if the editor is already open on that store, the section must
// open, not wait for the next time the store loads (the deep link used to be applied once, when the store loaded).
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useHistory } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  addQuery: vi.fn(),
  removeQuery: vi.fn(),
  history: null,
  user: { level: 0 }
}))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url }],
  useSession: () => [{ user: mocks.user }],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'ordering' }],
  useEvent: () => [{ emit: vi.fn() }],
  BusinessDetails: () => null
}))
vi.mock('../../../../hooks/useUserSelectedAccess', () => ({ useSelectedAccessRole: () => false }))
vi.mock('../../../../hooks/useWebsiteUrl', () => ({ useStoreWebsiteUrl: () => null }))
vi.mock('../../../../utils', () => ({ addQueryToUrl: mocks.addQuery, removeQueryToUrl: mocks.removeQuery }))
vi.mock('../../SnoozeComponent', () => ({ SnoozeComponent: () => null }))
vi.mock('../StoreSectionBody', async () => {
  const { createElement } = await import('react')
  return { StoreSectionBody: (props) => createElement('div', { 'data-testid': 'section-body', 'data-section': props.section }) }
})

import { BusinessDetailsUI } from '../index'
import { STORE_SECTION_QUERY_KEYS } from '../storeSections'

const makeProps = (over = {}) => ({
  open: true,
  businessId: 42,
  onClose: vi.fn(),
  businessState: { loading: false, business: { id: 42, name: 'Fast Bite', slug: 'fastbite', enabled: true, configs: [] }, error: null },
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

const HistoryProbe = () => {
  mocks.history = useHistory()
  return null
}

const shell = (props, url = '/stores/list?id=42') => (
  <MemoryRouter initialEntries={[url]}>
    <HistoryProbe />
    <BusinessDetailsUI {...props} />
  </MemoryRouter>
)

const goTo = (url) => act(() => { mocks.history.replace(url) })
const body = () => screen.queryByTestId('section-body')
const nav = () => screen.getByRole('navigation', { name: 'Store sections' })

beforeEach(() => {
  mocks.user = { level: 0 }
  mocks.addQuery.mockClear()
  mocks.removeQuery.mockClear()
  window.innerWidth = 1280
  window.dispatchEvent(new Event('resize'))
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('BusinessDetails shell · ?section= while the editor is open', () => {
  it('opens the section when the address gets ?section= and the store on screen has already loaded', async () => {
    render(shell(makeProps()))
    expect(body()).toBeNull()
    goTo('/stores/list?id=42&section=schedule')
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
  })

  // redesign stores 2.A (decision 4): like a click, it asks first when the form holds changes (it used to save them)
  it('changes from one section to another like a click: with changes it asks, saves on «Save and continue» and drops the keys of the section it leaves', async () => {
    const user = userEvent.setup()
    const props = makeProps({ handleUpdateBusinessClick: vi.fn(async () => ({ ok: true })) })
    const { rerender } = render(shell(props, '/stores/list?id=42&section=schedule'))
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
    rerender(shell({ ...props, formState: { loading: false, changes: { name: 'edited' } } }, '/stores/list?id=42&section=schedule'))
    props.handleUpdateBusinessClick.mockClear()

    goTo('/stores/list?id=42&section=delivery_pickup_more')
    const dialog = await screen.findByRole('alertdialog')
    expect(body()).toHaveAttribute('data-section', 'schedule')
    await user.click(within(dialog).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'delivery_pickup_more'))
    expect(props.handleUpdateBusinessClick).toHaveBeenCalledTimes(1)
    expect(mocks.removeQuery).toHaveBeenCalledWith(STORE_SECTION_QUERY_KEYS)
  })

  // redesign stores 4.A (decision 11)
  it('an address with a section the person may not open, while another is open, goes to the Overview with a notice (asking first)', async () => {
    const user = userEvent.setup()
    mocks.user = { level: 2 }
    const props = makeProps({ formState: { loading: false, changes: { name: 'edited' } } })
    render(shell(props, '/stores/list?id=42&section=schedule'))
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
    mocks.removeQuery.mockClear()

    goTo('/stores/list?id=42&section=business_fees')
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(body()).toBeNull())
    expect(screen.getByRole('alert')).toHaveTextContent("Your account can't open Business fees for this store, so this is its overview.")
    expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(mocks.removeQuery).toHaveBeenCalledWith(STORE_SECTION_QUERY_KEYS)
  })

  it('keeping editing after ⌘K changed the section puts the open one back in the address', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: { loading: false, changes: { name: 'edited' } } })
    render(shell(props, '/stores/list?id=42&section=schedule'))
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
    mocks.addQuery.mockClear()
    goTo('/stores/list?id=42&section=menu')
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(body()).toHaveAttribute('data-section', 'schedule')
    expect(mocks.addQuery).toHaveBeenLastCalledWith({ section: 'schedule' })
  })

  it('opens the section again when the router still holds the old address (a click inside the editor does not reach it)', async () => {
    const user = userEvent.setup()
    render(shell(makeProps(), '/stores/list?id=42&section=schedule'))
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
    await user.click(within(nav()).getByRole('button', { name: 'Overview' }))
    expect(body()).toBeNull()

    // the router's copy of the address says section=schedule still: the menu replaces it with the same address
    goTo('/stores/list?id=42&section=schedule')
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
  })

  it('leaves alone the section that is already open (no query written, no save)', async () => {
    const props = makeProps()
    render(shell(props, '/stores/list?id=42&section=schedule'))
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
    goTo('/stores/list?id=42&section=schedule')
    expect(body()).toHaveAttribute('data-section', 'schedule')
    expect(mocks.addQuery).not.toHaveBeenCalled()
    expect(props.handleUpdateBusinessClick).not.toHaveBeenCalled()
  })

  it('does not apply the link to the store that was open before the one it is for has loaded', async () => {
    const props = makeProps()
    const { rerender } = render(shell(props))
    // another store is chosen: the id changes first, its record has not arrived
    rerender(shell({ ...props, businessId: 43 }))
    goTo('/stores/list?id=43&section=schedule')
    expect(body()).toBeNull()
    expect(mocks.addQuery).not.toHaveBeenCalled()
    // and when it loads, the first-load effect applies the link as before
    rerender(shell({ ...props, businessId: 43, businessState: { loading: true, business: null, error: null } }))
    rerender(shell({ ...props, businessId: 43, businessState: { loading: false, business: { id: 43, name: 'KCF', slug: 'kcf', enabled: true, configs: [] }, error: null } }))
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
  })
})

// redesign stores 1.A (G1-26): `overview` is an entry of the section list, so `?section=overview` is a link someone
// can copy. It opened an empty body with nothing marked in the list; now it opens the Overview, as a click on it does.
describe('BusinessDetails shell · ?section=overview', () => {
  const current = () => within(nav()).getByRole('button', { name: 'Overview' })

  it('opens the Overview when the editor loads with ?section=overview', async () => {
    render(shell(makeProps(), '/stores/list?id=42&section=overview'))
    await waitFor(() => expect(current()).toHaveAttribute('aria-current'))
    expect(body()).toBeNull()
  })

  it('goes back to the Overview when the address gets ?section=overview with a section open', async () => {
    render(shell(makeProps(), '/stores/list?id=42&section=schedule'))
    await waitFor(() => expect(body()).toHaveAttribute('data-section', 'schedule'))
    goTo('/stores/list?id=42&section=overview')
    await waitFor(() => expect(body()).toBeNull())
    expect(current()).toHaveAttribute('aria-current')
    expect(mocks.removeQuery).toHaveBeenCalledWith(STORE_SECTION_QUERY_KEYS)
  })
})
