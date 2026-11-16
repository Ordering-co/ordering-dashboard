/* eslint-disable import/first */
// redesign stores 5.5a: the list of menus of the store is the list of a P/SectionSplit and the menu editor is its detail.
// The controller is replaced by props (its contract: `businessMenusState { menus, menusShared, loading, error }`, `reloadMenus`,
// `handleChangeBusinessMenuActiveState(id, enabled)` → `{ ok } | { ok: false, error }`) and BusinessMenuOptions by a stub that
// paints the name of the menu it is given.
import React, { useState } from 'react'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { addQueryToUrl, removeQueryToUrl } = vi.hoisted(() => ({
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessMenu: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
// P/AsyncSwitch reads the language straight from its context
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../../../utils', () => ({ addQueryToUrl, removeQueryToUrl }))
// redesign stores 5.18: the room is a variable, so the phone (stacked) case can be drawn
const room = vi.hoisted(() => ({ width: 1280 }))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: room.width }) }))

vi.mock('../../BusinessMenuOptions', () => ({
  BusinessMenuOptions: ({ menu, onClose }) => (
    <div data-testid='menu-options' data-menu-id={String(menu?.id)}>
      <span>{menu?.name}</span>
      <button type='button' onClick={onClose}>Stub close</button>
    </div>
  )
}))

import { BusinessMenu } from '../index'

const OWN = [
  { id: 1, name: 'Lunch menu', enabled: true },
  { id: 2, name: 'Dinner menu', enabled: false }
]
const SHARED = [{ id: 11, name: 'Chain brunch', enabled: true }]
const LOADED = { loading: false, error: null, menus: OWN, menusShared: SHARED }

// The controller keeps the tab; the host does the same so «Add menu» in Shared can switch it.
const Host = ({ state = LOADED, extra = {} }) => {
  const [isShared, setShared] = useState(false)
  const props = {
    business: { id: 7 },
    setIsExtendExtraOpen: vi.fn(),
    handleSuccessBusinessMenu: vi.fn(),
    sitesState: { sites: [] },
    setBusinessMenusState: vi.fn(),
    reloadMenus: vi.fn(),
    handleChangeBusinessMenuActiveState: vi.fn().mockResolvedValue({ ok: true }),
    ...extra,
    businessMenusState: state,
    isSelectedSharedMenus: isShared,
    setIsSelectedSharedMenus: setShared
  }
  return <BusinessMenu {...props} />
}

// the tab comes from the URL, as on arrival to the section
const SHARED_URL = '/stores/list?id=7&section=menu&tab=shared_menus'

const mount = (hostProps = {}, url = '/stores/list?id=7&section=menu') => (
  renderWithProviders(<Host {...hostProps} />, { initialEntries: [url] })
)

beforeEach(() => {
  addQueryToUrl.mockClear()
  removeQueryToUrl.mockClear()
})
afterEach(() => cleanup())

describe('BusinessMenu · states of the list', () => {
  it('shows the skeleton only while it loads, and no rows or empty text then', () => {
    const { container, rerender } = mount({ state: { ...LOADED, loading: true, menus: [], menusShared: [] } })
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText('No menus yet.')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()

    rerender(<Host state={LOADED} />)
    expect(container.querySelectorAll('.odc-skeleton')).toHaveLength(0)
    expect(screen.getAllByRole('switch')).toHaveLength(2)
  })

  it('says why the list did not load and retries with the button, instead of showing an empty list', async () => {
    const reloadMenus = vi.fn()
    const user = userEvent.setup()
    mount({ state: { loading: false, error: ['Network down'], menus: [], menusShared: [] }, extra: { reloadMenus } })

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('Network down')).toBeTruthy()
    expect(screen.queryByText('No menus yet.')).toBeNull()

    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(reloadMenus).toHaveBeenCalledTimes(1)
  })

  it('falls back to its own text when the error has none', () => {
    mount({ state: { loading: false, error: [], menus: [], menusShared: [] } })
    expect(screen.queryByRole('alert')).toBeNull()
    cleanup()
    mount({ state: { loading: false, error: [{}], menus: [], menusShared: [] } })
    expect(within(screen.getByRole('alert')).getByText("We couldn't load the menus.")).toBeTruthy()
  })

  it('has an empty state for each tab', () => {
    mount({ state: { ...LOADED, menus: [], menusShared: [] } })
    expect(screen.getByText('No menus yet.')).toBeTruthy()
    cleanup()
    mount({ state: { ...LOADED, menus: [], menusShared: [] } }, SHARED_URL)
    expect(screen.getByText('No menus are shared with this store.')).toBeTruthy()
    expect(screen.queryByText('No menus yet.')).toBeNull()
  })

  it('filters by name without telling upper from lower case, and says when nothing matches', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'LUNCH')
    expect(screen.getByRole('button', { name: 'Lunch menu' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dinner menu' })).toBeNull()

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz')
    expect(screen.getByText('No results')).toBeTruthy()
    expect(screen.queryByText('No menus yet.')).toBeNull()
  })
})

describe('BusinessMenu · the Available switch', () => {
  it('names each switch with the menu and shows the stored value', () => {
    mount()
    expect(screen.getByRole('switch', { name: 'Available: Lunch menu' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Available: Dinner menu' }).getAttribute('aria-checked')).toBe('false')
  })

  it('saves through the controller and does not open the detail', async () => {
    const user = userEvent.setup()
    const handle = vi.fn().mockResolvedValue({ ok: true })
    mount({ extra: { handleChangeBusinessMenuActiveState: handle } })

    await user.click(screen.getByRole('switch', { name: 'Available: Dinner menu' }))

    expect(handle).toHaveBeenCalledWith(2, true)
    expect(screen.queryByTestId('menu-options')).toBeNull()
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  it('goes back and says why when the save fails', async () => {
    const user = userEvent.setup()
    const handle = vi.fn().mockResolvedValue({ ok: false, error: ['Menu is locked'] })
    mount({ extra: { handleChangeBusinessMenuActiveState: handle } })

    await user.click(screen.getByRole('switch', { name: 'Available: Dinner menu' }))

    expect(await screen.findByText('Menu is locked')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Available: Dinner menu' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByTestId('menu-options')).toBeNull()
  })

  it('does not swap the list for skeletons while it saves', async () => {
    const user = userEvent.setup()
    let release
    const handle = vi.fn(() => new Promise(resolve => { release = resolve }))
    const { container } = mount({ extra: { handleChangeBusinessMenuActiveState: handle } })

    await user.click(screen.getByRole('switch', { name: 'Available: Dinner menu' }))
    expect(container.querySelectorAll('.odc-skeleton')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Dinner menu' })).toBeTruthy()
    await act(async () => { release({ ok: true }) })
  })
})

describe('BusinessMenu · the URL', () => {
  it('opens a known ?menu= without rewriting the URL', async () => {
    mount({}, '/stores/list?id=7&section=menu&menu=2&setting_tab=logs')

    await waitFor(() => expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('2'))
    expect(within(screen.getByTestId('menu-options')).getByText('Dinner menu')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Dinner menu' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dinner menu' }).getAttribute('aria-current')).toBe('true')
    expect(addQueryToUrl).not.toHaveBeenCalled()
    expect(removeQueryToUrl).not.toHaveBeenCalled()
  })

  it('looks the menu up in the tab the URL names', async () => {
    mount({}, '/stores/list?id=7&section=menu&tab=shared_menus&menu=11')

    await waitFor(() => expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('11'))
    expect(screen.getByRole('tab', { name: 'Shared menus' }).getAttribute('aria-selected')).toBe('true')
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  it('says so, opens nothing and cleans the URL for an unknown ?menu=', async () => {
    mount({}, '/stores/list?id=7&section=menu&menu=999&setting_tab=logs')

    expect(await screen.findByText("This menu doesn't exist or was deleted.")).toBeTruthy()
    expect(screen.queryByTestId('menu-options')).toBeNull()
    expect(removeQueryToUrl).toHaveBeenCalledWith(['menu', 'product', 'setting_tab'])
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  it('waits for the list before it decides, and does not call a menu unknown while it loads', () => {
    mount({ state: { ...LOADED, loading: true, menus: [], menusShared: [] } }, '/stores/list?id=7&section=menu&menu=2')
    expect(screen.queryByText("This menu doesn't exist or was deleted.")).toBeNull()
    expect(removeQueryToUrl).not.toHaveBeenCalled()
  })

  it('drops the notice when another menu is opened', async () => {
    const user = userEvent.setup()
    mount({}, '/stores/list?id=7&section=menu&menu=999')
    await screen.findByText("This menu doesn't exist or was deleted.")

    await user.click(screen.getByRole('button', { name: 'Lunch menu' }))

    expect(screen.queryByText("This menu doesn't exist or was deleted.")).toBeNull()
    expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('1')
    expect(addQueryToUrl).toHaveBeenCalledWith({ menu: 1 })
  })

  // redesign stores 5.18 (R5.8-02): stacked, a menu opened low in the list starts at the top of its detail; side by side
  // nothing scrolls (P/SectionSplit's opt-in revealDetail)
  it('stacked, the opened menu is scrolled to the top of its detail; side by side it is not', async () => {
    const scrolled = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (options) { scrolled.push([this.className, options]) }
    try {
      const user = userEvent.setup()
      room.width = 390
      const view = mount()
      await user.click(screen.getByRole('button', { name: 'Lunch menu' }))
      await waitFor(() => expect(scrolled).toEqual([['odc-section-split-detail', { block: 'start' }]]))
      view.unmount()

      scrolled.length = 0
      room.width = 1280
      mount()
      await user.click(screen.getByRole('button', { name: 'Lunch menu' }))
      await new Promise(resolve => requestAnimationFrame(resolve))
      expect(scrolled).toEqual([])
    } finally {
      Element.prototype.scrollIntoView = original
      room.width = 1280
    }
  })

  it('writes the menu on a click, and nothing when the open one is clicked again', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Lunch menu' }))
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(addQueryToUrl).toHaveBeenCalledWith({ menu: 1 })

    await user.click(screen.getByRole('button', { name: 'Lunch menu' }))
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)
  })

  it('removes menu, product and setting_tab when the detail closes', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Dinner menu' }))
    expect(screen.getByTestId('menu-options')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByTestId('menu-options')).toBeNull()
    expect(removeQueryToUrl).toHaveBeenCalledWith(['menu', 'product', 'setting_tab'])
  })

  it('closes from the editor itself the same way', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Lunch menu' }))
    await user.click(screen.getByRole('button', { name: 'Stub close' }))

    expect(screen.queryByTestId('menu-options')).toBeNull()
    expect(removeQueryToUrl).toHaveBeenCalledWith(['menu', 'product', 'setting_tab'])
  })
})

describe('BusinessMenu · Add menu', () => {
  it('opens a new menu on the Menu tab, without the stale menu, tab or product of the URL', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Lunch menu' }))
    addQueryToUrl.mockClear()

    await user.click(screen.getAllByRole('button', { name: 'Add menu' })[0])

    expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('undefined')
    expect(screen.getByRole('heading', { level: 3, name: 'New menu' })).toBeTruthy()
    expect(removeQueryToUrl).toHaveBeenLastCalledWith(['menu', 'product', 'setting_tab'])
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  // J2 row 16 (stores-5-5a-menu, noted): the repeated «Add menu» at the foot of the Menu tab is gone; the one at the top stays
  it('has one «Add menu», at the top, and no link at the foot of the Menu tab', () => {
    const { container } = mount()
    expect(screen.getAllByRole('button', { name: 'Add menu' })).toHaveLength(1)
    expect(container.querySelector('.odc-menu-foot')).toBeNull()
  })

  it('takes the Shared menus tab to the Menu tab with the new menu open', async () => {
    const user = userEvent.setup()
    mount({}, SHARED_URL)
    expect(screen.getByRole('tab', { name: 'Shared menus' }).getAttribute('aria-selected')).toBe('true')
    // no link at the foot of the shared tab
    expect(screen.getAllByRole('button', { name: 'Add menu' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Add menu' }))

    expect(screen.getByRole('tab', { name: 'Menu' }).getAttribute('aria-selected')).toBe('true')
    expect(addQueryToUrl).toHaveBeenCalledWith({ tab: 'menu' })
    expect(screen.getByRole('heading', { level: 3, name: 'New menu' })).toBeTruthy()
    expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('undefined')
    expect(removeQueryToUrl).toHaveBeenLastCalledWith(['menu', 'product', 'setting_tab'])
  })

  it('changes tab by closing the detail first and writing the tab', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Lunch menu' }))

    await user.click(screen.getByRole('tab', { name: 'Shared menus' }))

    expect(screen.queryByTestId('menu-options')).toBeNull()
    expect(removeQueryToUrl).toHaveBeenCalledWith(['menu', 'product', 'setting_tab'])
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'shared_menus' })
    expect(screen.getByRole('button', { name: 'Chain brunch' })).toBeTruthy()
  })
})
