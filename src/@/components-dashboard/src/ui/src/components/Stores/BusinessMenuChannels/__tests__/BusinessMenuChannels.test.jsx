/* eslint-disable import/first */
// redesign stores 5.5a (S7, G3-15, G3-17): the Channels tab of a menu. The search ignores case, the sites are Product
// checkboxes, and saving is the P/SaveBar of the section: with nothing to save there is no Save, a failed save shows its error with
// Retry. The controller functions are stand-ins.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('../../../Shared', () => ({
  SearchBar: ({ placeholder, search, onSearch }) => (
    <input aria-label={placeholder} value={search} onChange={event => onSearch(event.target.value)} />
  )
}))

import { BusinessMenuChannels } from '../index'

const SITES = [
  { id: 1, name: 'Main site' },
  { id: 2, name: 'Branch app' },
  { id: 3, name: 'KIOSK' }
]

const buildProps = (overrides = {}) => ({
  menu: { id: 11, name: 'Lunch', sites: [{ id: 1 }] },
  sitesState: { sites: SITES },
  formState: { loading: false, changes: {}, error: null },
  pendingChangeKeys: [],
  discardChanges: vi.fn(),
  handleChangeMenuSite: vi.fn(),
  handleSelectAllChannels: vi.fn(),
  handleSelectNoneChannels: vi.fn(),
  handleUpdateBusinessMenuOption: vi.fn().mockResolvedValue({ ok: true }),
  ...overrides
})

const dirtyProps = (overrides = {}) => buildProps({
  formState: { loading: false, changes: { sites: [1, 2] }, error: null },
  pendingChangeKeys: ['sites'],
  ...overrides
})

const renderTab = (props) => render(<BusinessMenuChannels {...props} />)
const siteNames = () => screen.getAllByRole('checkbox').map(box => box.textContent)
const bar = () => screen.queryByRole('group', { name: 'Save changes' })

afterEach(() => cleanup())

describe('BusinessMenuChannels · search (G3-15)', () => {
  it('finds «Main site» typing MAIN', () => {
    renderTab(buildProps())
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'MAIN' } })
    expect(siteNames()).toEqual(['Main site'])
  })

  it('finds an upper-case name typing it in lower case', () => {
    renderTab(buildProps())
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'kiosk' } })
    expect(siteNames()).toEqual(['KIOSK'])
  })

  it('lists every site with an empty search', () => {
    renderTab(buildProps())
    expect(siteNames()).toEqual(['Main site', 'Branch app', 'KIOSK'])
  })
})

describe('BusinessMenuChannels · the sites', () => {
  it('checks the saved sites, and a menu without sites list does not break', () => {
    renderTab(buildProps())
    const [main, branch] = screen.getAllByRole('checkbox')
    expect(main.getAttribute('aria-checked')).toBe('true')
    expect(branch.getAttribute('aria-checked')).toBe('false')
    cleanup()
    renderTab(buildProps({ menu: { id: 12, name: 'New' } }))
    expect(screen.getAllByRole('checkbox').every(box => box.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('checks what the form asks for over what is saved', () => {
    renderTab(dirtyProps())
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes.map(box => box.getAttribute('aria-checked'))).toEqual(['true', 'true', 'false'])
  })

  it('hands a click on a site, Select all and Select none to the controller', () => {
    const props = buildProps()
    renderTab(props)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Branch app' }))
    expect(props.handleChangeMenuSite).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(props.handleSelectAllChannels).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(props.handleSelectNoneChannels).toHaveBeenCalledTimes(1)
  })
})

describe('BusinessMenuChannels · saving (S7, G3-17)', () => {
  it('has no Save without changes', () => {
    renderTab(buildProps())
    expect(bar()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('shows the bar with the count once the sites change', () => {
    renderTab(dirtyProps())
    const group = bar()
    expect(within(group).getByText(/1 unsaved change/)).toBeTruthy()
    expect(within(group).getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(within(group).getByRole('button', { name: 'Discard' })).toBeTruthy()
  })

  it('counts a change on its own when the controller gives no pending keys', () => {
    renderTab(buildProps({
      pendingChangeKeys: undefined,
      formState: { loading: false, changes: { sites: [1, 3] }, error: null }
    }))
    expect(bar()).toBeTruthy()
    cleanup()
    renderTab(buildProps({
      pendingChangeKeys: undefined,
      formState: { loading: false, changes: { sites: [1] }, error: null }
    }))
    expect(bar()).toBeNull()
  })

  // Save sends every pending change of the menu (the form spans its tabs, as in main), so the bar counts them all
  it('counts every pending change of the menu, not only the sites', () => {
    renderTab(buildProps({ pendingChangeKeys: ['name', 'sites'] }))
    expect(within(bar()).getByText(/2 unsaved changes/)).toBeTruthy()
  })

  it('saves through the controller and says Saved', async () => {
    const props = dirtyProps()
    const view = renderTab(props)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(props.handleUpdateBusinessMenuOption).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateBusinessMenuOption).toHaveBeenCalledWith()
    expect(screen.queryByRole('alert')).toBeNull()
    // the controller clears the pending changes when the save lands
    view.rerender(<BusinessMenuChannels {...buildProps({ handleUpdateBusinessMenuOption: props.handleUpdateBusinessMenuOption })} />)
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('discards through the controller', () => {
    const props = dirtyProps()
    renderTab(props)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
  })

  it('shows the error of a failed save, with Retry that tries again', async () => {
    const update = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['Sites are not valid'] })
      .mockResolvedValueOnce({ ok: true })
    const props = dirtyProps({ handleUpdateBusinessMenuOption: update })
    renderTab(props)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Sites are not valid')
    expect(bar()).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })) })
    expect(update).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('falls back to its own text when the API gave no message', async () => {
    const props = dirtyProps({ handleUpdateBusinessMenuOption: vi.fn().mockResolvedValue({ ok: false }) })
    renderTab(props)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't save the change.")
  })

  it('takes the error away when the sites change again', async () => {
    const props = dirtyProps({ handleUpdateBusinessMenuOption: vi.fn().mockResolvedValue({ ok: false, error: 'No' }) })
    renderTab(props)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('checkbox', { name: 'KIOSK' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
