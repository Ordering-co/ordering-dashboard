/* eslint-disable import/first */
// redesign stores devices (D3-D7 | G5-34, G5-35, G5-37, DV-01, DV-04, DV-09, DV-10): the panel of a device on Product pieces.
// The controller (K/BusinessDeviceDetail) is played by `Host`: it keeps the draft (`formState.changes`) the way the real one does and
// hands the UI spies for the requests (each answers `{ ok }`). Everything from Product is the real one (RecordPanel, TextField,
// SelectField, Pagination, Menu, ConfirmDialog, AlertDialog, CopyButton, Button); the stores and owners are picked through the
// SelectField's combobox and listbox (lote C).
import React, { useRef, useState } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ logoutAll: true }))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url }],
  BusinessDeviceDetail: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../../utils', async (importOriginal) => ({
  ...(await importOriginal()),
  getFeatureFlags: (key) => key === 'dominos_enable_delete_all_sessions_by_user' && flags.logoutAll
}))
import { BusinessDeviceDetailUI } from '../index'

const ana = { id: 11, name: 'Ana', lastname: 'García' }
const bob = { id: 12, name: 'Bob', lastname: 'Stone' }
const downtown = { id: 1, name: 'Downtown', logo: null, address: '1 Main St', owners: [ana, bob] }
const uptown = { id: 2, name: 'Uptown', logo: null, address: '9 High Rd', owners: [bob] }
const DEVICE = { id: 34, name: 'Till 1', code: 'AB12-CD34', business_id: 1, business: downtown, user_id: 11, user: ana }

let spies
let panelRef
const baseProps = () => ({
  businessList: { loading: false, businesses: [downtown, uptown], error: null },
  businessPagination: { currentPage: 1, pageSize: 10, totalPages: 3, totalItems: 25 },
  handleChangeBusinessPage: vi.fn(),
  searchBusinesses: vi.fn(),
  logoutDeviceState: { loading: false, error: null }
})

const Host = ({ selectedDevice = null, loading = false, result = { error: null }, extra = {} }) => {
  const [changes, setChanges] = useState({})
  const [expanded, setExpanded] = useState(false)
  panelRef = useRef(null)
  return (
    <BusinessDeviceDetailUI
      {...baseProps()}
      selectedDevice={selectedDevice}
      devices={[]}
      formState={{ loading, changes, result }}
      handleChangeFormState={(next) => { spies.change(next); setChanges(prev => ({ ...prev, ...next })) }}
      clearFormChanges={() => { spies.clear(); setChanges({}) }}
      addDevice={spies.addDevice}
      updateDevice={spies.updateDevice}
      deleteDevice={spies.deleteDevice}
      logoutDevice={spies.logoutDevice}
      clearLogoutError={spies.clearLogoutError}
      panelRef={panelRef}
      expanded={expanded}
      onExpandedChange={(next) => { spies.expand(next); setExpanded(next) }}
      onClose={spies.onClose}
      {...extra}
    />
  )
}

const renderPanel = (props = {}) => render(<Host {...props} />)
const user = () => userEvent.setup()

beforeEach(() => {
  flags.logoutAll = true
  spies = {
    change: vi.fn(),
    clear: vi.fn(),
    addDevice: vi.fn(() => Promise.resolve({ ok: true })),
    updateDevice: vi.fn(() => Promise.resolve({ ok: true })),
    deleteDevice: vi.fn(() => Promise.resolve({ ok: true })),
    logoutDevice: vi.fn(() => Promise.resolve({ ok: true })),
    clearLogoutError: vi.fn(),
    expand: vi.fn(),
    onClose: vi.fn()
  }
})

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const saveButton = () => screen.getByRole('button', { name: 'Save' })
const combobox = (name) => screen.getByRole('combobox', { name: new RegExp(`^${name}`) })
// open the select named `name` and return its listbox
const openSelect = async (u, name) => {
  await u.click(combobox(name))
  return screen.findByRole('listbox', { hidden: true })
}
// the names of the rows of a listbox (without the initials of the avatar)
const namesOf = (box) => within(box).getAllByRole('option', { hidden: true }).map(option => option.querySelector('.odc-dp-option-name').textContent)
// open the select named `name` and pick the option whose name matches `option`
const pick = async (u, name, option) => {
  const box = await openSelect(u, name)
  await u.click(within(box).getByRole('option', { name: option, hidden: true }))
}

describe('the add panel (G5-37)', () => {
  it('is titled «Add new device», has no subtitle, no code and no actions menu', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Add new device' })).toBeInTheDocument()
    expect(screen.queryByText('Device Code')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull()
  })

  it('Save with nothing filled in calls nothing and says what is missing under the name and under the store', async () => {
    renderPanel()
    await user().click(saveButton())
    expect(spies.addDevice).not.toHaveBeenCalled()
    expect(spies.updateDevice).not.toHaveBeenCalled()
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent('Name is required')
    expect(alerts[1]).toHaveTextContent('Store is required')
    expect(screen.getByRole('textbox', { name: /Name/ })).toBeInvalid()
    // the focus goes to the first thing that is missing
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveFocus()
  })

  it('a name alone is not enough: the store is still asked for, and the name error goes once it is typed', async () => {
    renderPanel()
    const u = user()
    await u.click(saveButton())
    await u.type(screen.getByRole('textbox', { name: /Name/ }), 'Till 9')
    expect(spies.change).toHaveBeenLastCalledWith({ name: 'Till 9' })
    await u.click(saveButton())
    expect(spies.addDevice).not.toHaveBeenCalled()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Store is required')
    // the focus moves at Save (to the store, now the first thing missing), never while the person types
    expect(screen.getByRole('textbox', { name: /Name/ })).not.toHaveFocus()
  })

  it('with a name and a store it calls addDevice once, even if Save is pressed twice (DV-09)', async () => {
    let finish
    spies.addDevice = vi.fn(() => new Promise(resolve => { finish = resolve }))
    renderPanel()
    const u = user()
    await u.type(screen.getByRole('textbox', { name: /Name/ }), 'Till 9')
    await pick(u, 'Store', /Downtown/)
    await pick(u, 'Owner', /Ana García/)
    await u.click(saveButton())
    await u.click(saveButton())
    expect(spies.addDevice).toHaveBeenCalledTimes(1)
    finish({ ok: true })
    await waitFor(() => expect(spies.addDevice).toHaveBeenCalledTimes(1))
  })

  it('Save is busy while the controller says it is saving, and a click does not send', async () => {
    renderPanel({ loading: true })
    expect(saveButton()).toHaveAttribute('aria-busy', 'true')
    await user().click(saveButton())
    expect(spies.addDevice).not.toHaveBeenCalled()
  })

  // tanda P: the store is required (Save asks for it) and its label says so before sending, as the name's does
  it('marks the store as required in its label, as the name', () => {
    const { container } = renderPanel()
    const marks = Array.from(container.querySelectorAll('.odc-field-required'))
    expect(marks).toHaveLength(2)
    expect(combobox('Store')).toHaveAccessibleName(/Store.*Required/)
  })

  it('shows the store select under a visible label, with a search and the pages of main, not locked', async () => {
    renderPanel()
    expect(combobox('Store')).toBeEnabled()
    const box = await openSelect(user(), 'Store')
    expect(screen.getByRole('searchbox', { name: 'Search Store', hidden: true })).toBeInTheDocument()
    expect(namesOf(box)).toEqual(['Downtown', 'Uptown'])
    const pages = screen.getByRole('navigation', { name: 'Pagination', hidden: true })
    expect(pages).toHaveTextContent('Showing 1–10 of 25')
    expect(pages).toHaveTextContent('Page 1 of 3')
  })

  it('has no pager when the stores fit one page', async () => {
    renderPanel({ extra: { businessPagination: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 2 } } })
    await openSelect(user(), 'Store')
    expect(screen.queryByRole('navigation', { name: 'Pagination', hidden: true })).toBeNull()
  })

  it('hands the search of the store to the server (searchBusinesses) and the pages to handleChangeBusinessPage', async () => {
    const props = baseProps()
    render(<Host extra={props} />)
    const u = user()
    await openSelect(u, 'Store')
    await u.type(screen.getByRole('searchbox', { name: 'Search Store', hidden: true }), 'down')
    // the legacy search bar waited 750 ms without typing (lazyLoad): one request for «down», never one per key
    await waitFor(() => expect(props.searchBusinesses).toHaveBeenLastCalledWith('down'), { timeout: 2000 })
    expect(props.searchBusinesses.mock.calls.filter(([text]) => text !== '')).toEqual([['down']])
    await u.click(screen.getByRole('button', { name: 'Next page', hidden: true }))
    expect(props.handleChangeBusinessPage).toHaveBeenCalledWith(2)
  })

  it('does not unmount the select while a search is loading with no stores (the skeleton is for the first load only)', async () => {
    const empty = { businessList: { loading: true, businesses: [], error: null } }
    const { rerender } = render(<Host extra={empty} />)
    expect(screen.queryByRole('combobox', { name: /^Store/ })).toBeNull() // first load: the skeleton
    const props = baseProps()
    rerender(<Host extra={props} />)
    const u = user()
    await openSelect(u, 'Store')
    await u.type(screen.getByRole('searchbox', { name: 'Search Store', hidden: true }), 'zz')
    await waitFor(() => expect(props.searchBusinesses).toHaveBeenLastCalledWith('zz'), { timeout: 2000 })
    rerender(<Host extra={{ ...props, ...empty }} />)
    expect(screen.getByRole('combobox', { name: /^Store/ })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search Store', hidden: true })).toHaveValue('zz')
    // redesign (review 2): emptying the search loads the first page with the list empty: the select stays, open
    await u.clear(screen.getByRole('searchbox', { name: 'Search Store', hidden: true }))
    expect(props.searchBusinesses).toHaveBeenLastCalledWith('')
    rerender(<Host extra={{ ...props, ...empty }} />)
    expect(screen.getByRole('combobox', { name: /^Store/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('searchbox', { name: 'Search Store', hidden: true })).toHaveFocus()
  })

  it('R-4: from the keyboard, ArrowDown on the Store opens it with the focus on the search and ArrowDown again enters the list', async () => {
    renderPanel()
    const u = user()
    combobox('Store').focus()
    await u.keyboard('{ArrowDown}')
    const search = await screen.findByRole('searchbox', { name: 'Search Store', hidden: true })
    await waitFor(() => expect(search).toHaveFocus())
    await u.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Downtown', hidden: true })).toHaveFocus()
  })

  it('searches the owners locally, by name, without asking the server', async () => {
    const props = baseProps()
    render(<Host selectedDevice={DEVICE} extra={props} />)
    const u = user()
    const box = await openSelect(u, 'Owner')
    expect(within(box).getAllByRole('option', { hidden: true })).toHaveLength(2)
    await u.type(screen.getByRole('searchbox', { name: 'Search Owner', hidden: true }), 'bob')
    expect(namesOf(box)).toEqual(['Bob Stone'])
    expect(props.searchBusinesses).not.toHaveBeenCalled()
    await u.clear(screen.getByRole('searchbox', { name: 'Search Owner', hidden: true }))
    await u.type(screen.getByRole('searchbox', { name: 'Search Owner', hidden: true }), 'zzz')
    expect(within(box).queryAllByRole('option', { hidden: true })).toHaveLength(0)
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('shows the owner field only once a store is chosen, with that store\'s owners and nothing pre-selected', async () => {
    renderPanel()
    const u = user()
    expect(screen.queryByRole('combobox', { name: /^Owner/ })).toBeNull()
    await pick(u, 'Store', /Uptown/)
    expect(combobox('Owner')).toHaveAccessibleName(/^Owner.*Required.*Select an option$/)
    let box = await openSelect(u, 'Owner')
    expect(namesOf(box)).toEqual(['Bob Stone'])
    await u.keyboard('{Escape}')
    // another store brings its own owners, not the list of the first one
    await pick(u, 'Store', /Downtown/)
    box = await openSelect(u, 'Owner')
    expect(within(box).getAllByRole('option', { hidden: true })).toHaveLength(2)
  })
})

describe('the payload of the selects (lote C)', () => {
  it('choosing a store and then an owner hands the controller exactly { business_id } and { user_id }, with the ids as numbers', async () => {
    renderPanel()
    const u = user()
    await pick(u, 'Store', /Uptown/)
    await pick(u, 'Owner', /Bob Stone/)
    expect(spies.change.mock.calls).toEqual([[{ business_id: 2 }], [{ user_id: 12 }]])
  })
})

describe('the panel of an existing device', () => {
  it('is titled with the name, has the store as subtitle and the code as text with a Copy button (DV-01)', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel({ selectedDevice: DEVICE })
    expect(screen.getByRole('heading', { name: 'Till 1' })).toBeInTheDocument()
    expect(container.querySelector('.odc-record-subtitle')).toHaveTextContent('Downtown')
    await user.click(screen.getByRole('button', { name: 'Show Device Code' }))
    const code = screen.getByText('AB12-CD34')
    expect(code).toHaveClass('odc-figure')
    expect(code.tagName).not.toBe('INPUT')
    expect(screen.getByRole('button', { name: 'Copy device code' })).toBeInTheDocument()
    expect(screen.queryByDisplayValue('AB12-CD34')).toBeNull()
    expect(container.querySelector('input:disabled')).toBeNull()
  })

  // P9: the code signs in as the device's user without a password (device_code_login_enabled), so it is a secret
  it('hides the code until «Show» and hides it again with «Hide»; Copy works while it is hidden', async () => {
    const user = userEvent.setup()
    renderPanel({ selectedDevice: DEVICE })
    expect(screen.queryByText('AB12-CD34')).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy device code' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show Device Code' }))
    expect(screen.getByText('AB12-CD34')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide Device Code' }))
    expect(screen.queryByText('AB12-CD34')).toBeNull()
  })

  it('locks the store (it cannot be changed after creating) and keeps the owner chosen', () => {
    renderPanel({ selectedDevice: DEVICE })
    expect(combobox('Store')).toBeDisabled()
    expect(combobox('Store')).toHaveAccessibleName('Store Downtown')
    expect(combobox('Owner')).toBeEnabled()
    expect(combobox('Owner')).toHaveAccessibleName(/^Owner.*Required.*Ana García$/)
  })

  it('Save with no change sends nothing new: the controller answers (it sends no request) and the panel does not complain', async () => {
    renderPanel({ selectedDevice: DEVICE })
    await user().click(saveButton())
    expect(spies.updateDevice).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renaming calls updateDevice; emptying the name does not and says so', async () => {
    renderPanel({ selectedDevice: DEVICE })
    const u = user()
    const name = screen.getByRole('textbox', { name: /Name/ })
    await u.clear(name)
    await u.click(saveButton())
    expect(spies.updateDevice).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
    await u.type(name, 'Till 1b')
    await u.click(saveButton())
    expect(spies.updateDevice).toHaveBeenCalledTimes(1)
    expect(spies.addDevice).not.toHaveBeenCalled()
  })

  it('a device whose owner no longer exists says so and pre-selects nothing (DV-04)', async () => {
    renderPanel({ selectedDevice: { ...DEVICE, user_id: 77, user: null } })
    expect(screen.getByText('The linked owner no longer exists. Choose another owner.')).toBeInTheDocument()
    const owner = combobox('Owner')
    expect(owner).toHaveAccessibleDescription('The linked owner no longer exists. Choose another owner.')
    expect(owner).toHaveAccessibleName(/^Owner.*Required.*Select an option$/)
    await pick(user(), 'Owner', /Bob Stone/)
    expect(screen.queryByText('The linked owner no longer exists. Choose another owner.')).toBeNull()
  })

  it('has the expand button (also in the add panel) that asks the list for a page and back', async () => {
    renderPanel({ selectedDevice: DEVICE })
    const u = user()
    await u.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.expand).toHaveBeenLastCalledWith(true)
    await u.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(spies.expand).toHaveBeenLastCalledWith(false)
    cleanup()
    renderPanel()
    expect(screen.getByRole('button', { name: 'Open as page' })).toBeInTheDocument()
  })
})

describe('Delete (decision 6, C8)', () => {
  const askDelete = async (u) => {
    await u.click(screen.getByRole('button', { name: 'Actions' }))
    await u.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog')
  }

  it('asks first, naming the device and its store, and calls nothing until confirmed', async () => {
    const u = user()
    renderPanel({ selectedDevice: DEVICE })
    const dialog = await askDelete(u)
    expect(within(dialog).getByRole('heading', { name: 'Delete Till 1?' })).toBeInTheDocument()
    expect(within(dialog).getByText("The device is removed from Downtown. This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete device' })).toBeInTheDocument()
    expect(spies.deleteDevice).not.toHaveBeenCalled()
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(spies.deleteDevice).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Delete device calls deleteDevice once', async () => {
    const u = user()
    renderPanel({ selectedDevice: DEVICE })
    const dialog = await askDelete(u)
    await u.click(within(dialog).getByRole('button', { name: 'Delete device' }))
    await waitFor(() => expect(spies.deleteDevice).toHaveBeenCalledTimes(1))
  })

  it('a delete that fails closes the question and leaves the reason to the alert of the controller', async () => {
    const u = user()
    spies.deleteDevice = vi.fn(() => Promise.resolve({ ok: false, error: ['The device is in use'] }))
    const { rerender } = renderPanel({ selectedDevice: DEVICE })
    const dialog = await askDelete(u)
    await u.click(within(dialog).getByRole('button', { name: 'Delete device' }))
    await waitFor(() => expect(spies.deleteDevice).toHaveBeenCalledTimes(1))
    rerender(<Host selectedDevice={DEVICE} result={{ error: true, result: ['The device is in use'] }} />)
    expect(await screen.findByText('The device is in use')).toBeInTheDocument()
  })
})

describe('Log out all devices (decision 6, C8; DV-10)', () => {
  const openMenu = async (u) => {
    await u.click(screen.getByRole('button', { name: 'Actions' }))
    return screen.findByRole('menu')
  }

  it('is not in the menu without the feature flag', async () => {
    flags.logoutAll = false
    const u = user()
    renderPanel({ selectedDevice: DEVICE })
    const menu = await openMenu(u)
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: /Log out all devices/ })).toBeNull()
  })

  it('is disabled, with the reason, when the device has no owner', async () => {
    const u = user()
    renderPanel({ selectedDevice: { ...DEVICE, user_id: null, user: null } })
    const menu = await openMenu(u)
    const item = within(menu).getByRole('menuitem', { name: /Log out all devices/ })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveAccessibleDescription('This device has no owner')
    await u.click(item)
    expect(spies.logoutDevice).not.toHaveBeenCalled()
  })

  it('asks first, naming the owner and saying what ends, and only then calls logoutDevice', async () => {
    const u = user()
    renderPanel({ selectedDevice: DEVICE })
    const menu = await openMenu(u)
    await u.click(within(menu).getByRole('menuitem', { name: /Log out all devices/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Log out Ana García?' })).toBeInTheDocument()
    expect(within(dialog).getByText(
      "This ends every session of Ana García, the owner linked to this device, not only this device's. They will need to sign in again."
    )).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent(/apps|code stops/i)
    expect(spies.logoutDevice).not.toHaveBeenCalled()
    await u.click(within(dialog).getByRole('button', { name: 'Log out everywhere' }))
    await waitFor(() => expect(spies.logoutDevice).toHaveBeenCalledTimes(1))
  })

  it('names the device when the owner has no name the API returns', async () => {
    const u = user()
    renderPanel({ selectedDevice: { ...DEVICE, user_id: 77, user: null } })
    const menu = await openMenu(u)
    await u.click(within(menu).getByRole('menuitem', { name: /Log out all devices/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Log out the owner of Till 1?' })).toBeInTheDocument()
  })

  it('shows the error of the logout in an alert, and closing it clears the error', async () => {
    const u = user()
    render(<Host selectedDevice={DEVICE} extra={{ logoutDeviceState: { loading: false, error: { error: true, result: ['Session service down'] } } }} />)
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText('Session service down')).toBeInTheDocument()
    await u.click(within(alert).getByRole('button', { name: 'Accept' }))
    expect(spies.clearLogoutError).toHaveBeenCalledTimes(1)
  })
})

describe('errors of the request and the discard guard', () => {
  it('a failed save shows the API message in an alert dialog titled «Devices»', async () => {
    render(<Host result={{ error: true, result: ['The code is already taken'] }} />)
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
    expect(within(alert).getByText('The code is already taken')).toBeInTheDocument()
  })

  it('closing a clean panel closes at once', async () => {
    renderPanel({ selectedDevice: DEVICE })
    await user().click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('closing a panel with changes asks; Keep editing stays, Discard clears the draft and closes', async () => {
    const u = user()
    renderPanel({ selectedDevice: DEVICE })
    await u.type(screen.getByRole('textbox', { name: /Name/ }), 'x')
    await u.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(spies.onClose).not.toHaveBeenCalled()
    await u.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(spies.onClose).not.toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Close' }))
    await u.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(spies.clear).toHaveBeenCalledTimes(1)
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('exposes requestClose(proceed) to the list through panelRef', async () => {
    const u = user()
    renderPanel({ selectedDevice: DEVICE })
    const proceed = vi.fn()
    panelRef.current.requestClose(proceed)
    expect(proceed).toHaveBeenCalledTimes(1)
    await u.type(screen.getByRole('textbox', { name: /Name/ }), 'x')
    panelRef.current.requestClose(proceed)
    expect(proceed).toHaveBeenCalledTimes(1)
    await u.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(proceed).toHaveBeenCalledTimes(2)
  })
})

// (main #486): a device needs its business owner. Save asks for one under the field, a store with no owners says what to do
// first, another store drops the owner of the one before, and the API's «The User ID field is required» is said as the missing owner.
describe('the business owner', () => {
  const lonely = { id: 3, name: 'Lonely', logo: null, address: '3 Side St', owners: [] }

  it('Save without an owner sends nothing and says the owner is required', async () => {
    renderPanel()
    const u = user()
    await u.type(screen.getByRole('textbox', { name: /Name/ }), 'Till 9')
    await pick(u, 'Store', /Downtown/)
    await u.click(saveButton())
    expect(spies.addDevice).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Business owner user is required')
    await pick(u, 'Owner', /Bob Stone/)
    await u.click(saveButton())
    expect(spies.addDevice).toHaveBeenCalledTimes(1)
  })

  it('a store with no owners says to create or assign one first', async () => {
    render(<Host extra={{ businessList: { loading: false, businesses: [downtown, lonely], error: null } }} />)
    await pick(user(), 'Store', /Lonely/)
    expect(screen.getByText(/This business has no active Business Owner users/)).toBeInTheDocument()
  })

  it('another store drops the owner chosen for the one before', async () => {
    renderPanel()
    const u = user()
    await pick(u, 'Store', /Downtown/)
    await pick(u, 'Owner', /Ana García/)
    await pick(u, 'Store', /Uptown/)
    expect(spies.change).toHaveBeenLastCalledWith({ business_id: 2, user_id: undefined })
  })

  it('says the API user id error as the missing owner', () => {
    renderPanel({ result: { error: true, result: ['The User ID field is required.'] } })
    expect(screen.getByText('Business owner user is required')).toBeInTheDocument()
    expect(screen.queryByText('The User ID field is required.')).toBeNull()
  })
})

describe('an administrator for a store with no owners', () => {
  const lonely = { id: 3, name: 'Lonely', logo: null, address: '3 Side St', owners: [] }
  const root = { id: 21, name: 'Rita', lastname: 'Root' }
  const sam = { id: 22, name: 'Sam', lastname: 'Super' }
  const stores = { loading: false, businesses: [downtown, lonely], error: null }
  const withAdmins = (adminList) => render(<Host extra={{ businessList: stores, adminList }} />)
  const ADMINS_HINT = /so you can choose an administrator\. The device signs in as the user you choose\./
  const NO_OWNERS_HINT = /Create one in Users > Business Owners/

  it('lists the administrators in the Owner select, says why, and saves the one chosen', async () => {
    withAdmins({ loading: false, users: [root, sam], error: null })
    const u = user()
    await u.type(screen.getByRole('textbox', { name: /Name/ }), 'Till 9')
    await pick(u, 'Store', /Lonely/)
    expect(screen.getByText(ADMINS_HINT)).toBeInTheDocument()
    expect(screen.queryByText(NO_OWNERS_HINT)).toBeNull()
    const box = await openSelect(u, 'Owner')
    expect(namesOf(box)).toEqual(['Rita Root', 'Sam Super'])
    await u.click(within(box).getByRole('option', { name: /Sam Super/, hidden: true }))
    expect(spies.change).toHaveBeenLastCalledWith({ user_id: 22 })
    await u.click(saveButton())
    expect(spies.addDevice).toHaveBeenCalledTimes(1)
  })

  it('still asks for a user: Save without choosing an administrator sends nothing', async () => {
    withAdmins({ loading: false, users: [root, sam], error: null })
    const u = user()
    await u.type(screen.getByRole('textbox', { name: /Name/ }), 'Till 9')
    await pick(u, 'Store', /Lonely/)
    await u.click(saveButton())
    expect(spies.addDevice).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Business owner user is required')
  })

  it('a store with owners keeps its owners, whatever the administrators are', async () => {
    withAdmins({ loading: false, users: [root, sam], error: null })
    const u = user()
    await pick(u, 'Store', /Downtown/)
    expect(screen.queryByText(ADMINS_HINT)).toBeNull()
    expect(namesOf(await openSelect(u, 'Owner'))).toEqual(['Ana García', 'Bob Stone'])
  })

  it('says neither message while the administrators load', async () => {
    withAdmins({ loading: true, users: null, error: null })
    await pick(user(), 'Store', /Lonely/)
    expect(combobox('Owner')).toBeInTheDocument()
    expect(screen.queryByText(ADMINS_HINT)).toBeNull()
    expect(screen.queryByText(NO_OWNERS_HINT)).toBeNull()
  })

  it.each([
    ['could not be loaded', { loading: false, users: null, error: ['Forbidden'] }],
    ['are none', { loading: false, users: [], error: null }],
    ['are not offered to this user', null]
  ])('says to create or assign a business owner when the administrators %s', async (_case, adminList) => {
    withAdmins(adminList)
    await pick(user(), 'Store', /Lonely/)
    expect(screen.getByText(NO_OWNERS_HINT)).toBeInTheDocument()
    expect(screen.queryByText(ADMINS_HINT)).toBeNull()
  })

  it('a device linked to an administrator shows that administrator chosen', async () => {
    const device = { id: 35, name: 'Till 2', code: 'ZZ99', business_id: 3, business: lonely, user_id: 22, user: sam }
    render(<Host selectedDevice={device} extra={{ businessList: stores, adminList: { loading: false, users: [root, sam], error: null } }} />)
    expect(combobox('Owner')).toHaveTextContent('Sam Super')
  })
})
