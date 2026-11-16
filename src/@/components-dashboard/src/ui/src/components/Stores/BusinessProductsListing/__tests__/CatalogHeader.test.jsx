/* eslint-disable import/first */
// redesign SP-FA: the head of /stores/products. The title is the button of the store selector, the actions of the page
// are in the «More actions» menu (tanda AB, C-5), the primary «Add product» only has a place with a category chosen, and the search waits 750 ms like the old one.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useSession: () => [{ user: { level: 0 } }]
}))
// bugs E R-6: the Importers panel host, as S/StoresList/StoresHeader mounts it (no trigger of its own, controlled)
vi.mock('../../ImportersButton', () => ({
  ImportersButton: (props) => (
    <div
      data-testid='importers-host'
      data-hide-trigger={String(Boolean(props.hideTrigger))}
      data-open={String(props.open)}
    >
      <button type='button' onClick={() => props.onOpenChange(false)}>host-close</button>
      <button type='button' onClick={() => props.onImportSuccess()}>host-import-success</button>
      <button type='button' onClick={() => props.returnFocusRef.current?.focus()}>host-return-focus</button>
    </div>
  )
}))

import { CatalogHeader, CatalogSearch } from '../CatalogHeader'

const base = () => ({
  storeName: 'Tastewine',
  hasStore: true,
  selectorOpen: false,
  onToggleSelector: vi.fn(),
  canAddProduct: true,
  onAddProduct: vi.fn(),
  onAddCategory: vi.fn(),
  setOpenSidebar: vi.fn(),
  onImportSuccess: vi.fn(),
  onRefresh: vi.fn(),
  onOpenSite: vi.fn(),
  onOpenStore: vi.fn()
})

const draw = (props = {}) => {
  const all = { ...base(), ...props }
  return { ...render(<CatalogHeader {...all} />), ...all }
}

// the menu is driven with the keyboard: focus the trigger and press Enter
const openMore = async (user) => {
  screen.getByRole('button', { name: 'More actions' }).focus()
  await user.keyboard('{Enter}')
  return screen.findAllByRole('menuitem')
}

const titleButton = () => within(screen.getByRole('heading', { level: 1 })).getByRole('button')

describe('title: the store selector', () => {
  it('is a button with the name of the store inside the h1, announcing a dialog', () => {
    draw()
    const button = titleButton()
    expect(button).toHaveAccessibleName('Tastewine')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('says «Select a business» without a store', () => {
    draw({ storeName: undefined, hasStore: false })
    expect(titleButton()).toHaveAccessibleName('Select a business')
  })

  it('draws a skeleton, no button, while the store loads and has no name', () => {
    draw({ storeName: undefined, loadingStore: true })
    expect(within(screen.getByRole('heading', { level: 1 })).queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens with a click and with Enter and Space', async () => {
    const user = userEvent.setup()
    const { onToggleSelector } = draw()
    await user.click(titleButton())
    expect(onToggleSelector).toHaveBeenLastCalledWith(true)
    titleButton().focus()
    await user.keyboard('{Enter}')
    expect(onToggleSelector).toHaveBeenCalledTimes(2)
    await user.keyboard(' ')
    expect(onToggleSelector).toHaveBeenCalledTimes(3)
    expect(onToggleSelector).toHaveBeenLastCalledWith(true)
  })

  it('closes when it is open, and shows it open', async () => {
    const user = userEvent.setup()
    const { onToggleSelector } = draw({ selectorOpen: true })
    expect(titleButton()).toHaveAttribute('aria-expanded', 'true')
    await user.click(titleButton())
    expect(onToggleSelector).toHaveBeenLastCalledWith(false)
  })

  it('a click on it while the selector is open only leaves it closed: the mouseup outside already closed it', () => {
    // the pointer goes down with the selector open; the selector's own `mouseup` closes it (the page sets selectorOpen to false); then the click
    const { onToggleSelector, rerender, ...rest } = draw({ selectorOpen: true })
    fireEvent.pointerDown(titleButton())
    rerender(<CatalogHeader {...rest} selectorOpen={false} onToggleSelector={onToggleSelector} />)
    fireEvent.click(titleButton())
    expect(onToggleSelector).toHaveBeenCalledTimes(1)
    expect(onToggleSelector).toHaveBeenCalledWith(false)
  })

  it('a click with the selector closed after another one opens it again (the memory does not stay)', () => {
    const { onToggleSelector } = draw()
    fireEvent.pointerDown(titleButton())
    fireEvent.click(titleButton())
    fireEvent.pointerDown(titleButton())
    fireEvent.click(titleButton())
    expect(onToggleSelector.mock.calls).toEqual([[true], [true]])
  })

  it('a pointer that went down and left, then Enter, does not use the stale memory', () => {
    const { onToggleSelector, rerender, ...rest } = draw({ selectorOpen: true })
    fireEvent.pointerDown(titleButton())
    rerender(<CatalogHeader {...rest} selectorOpen={false} onToggleSelector={onToggleSelector} />)
    // no click followed (the pointer left); later the keyboard presses it
    fireEvent.keyDown(titleButton(), { key: 'Enter' })
    fireEvent.click(titleButton())
    expect(onToggleSelector).toHaveBeenCalledWith(true)
  })

  it('shows the selector under the head', () => {
    draw({ selectorOpen: true, selector: <div data-testid='selector' /> })
    expect(screen.getByTestId('selector')).toBeInTheDocument()
  })
})

// redesign tanda AB (C-5): off the phone too, Refresh, Importers, Add category, Use weekly template and Store website are items of the
// «More actions» menu; the primary «Add product» and Learn stay in view.
describe('actions', () => {
  it('has Refresh, Importers, Add category and Store website in the menu, and the primary Add product in view', async () => {
    const user = userEvent.setup()
    const { onRefresh, onAddCategory, onAddProduct, onOpenSite } = draw()
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    expect(onAddProduct).toHaveBeenCalledTimes(1)
    const items = await openMore(user)
    expect(items.map(item => item.textContent.trim())).toEqual(['Add category', 'Importers', 'Refresh', 'Store website'])
    await user.click(screen.getByRole('menuitem', { name: 'Refresh' }))
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Add category' }))
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Store website' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onAddCategory).toHaveBeenCalledTimes(1)
    expect(onOpenSite).toHaveBeenCalledTimes(1)
    ;['Refresh', 'Importers', 'Add category', 'Store website'].forEach(name => {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    })
  })

  // bugs E R-6: Importers is a P/Button like its neighbours; the panel host is mounted once, without trigger, and controlled
  describe('Importers (R-6)', () => {
    it('is a menu item with the Upload icon, like Refresh and Add category', async () => {
      const user = userEvent.setup()
      draw()
      await openMore(user)
      const importers = screen.getByRole('menuitem', { name: 'Importers' })
      const refresh = screen.getByRole('menuitem', { name: 'Refresh' })
      expect(importers.querySelector('svg')).toBeInTheDocument()
      // not the legacy trigger: a sibling of the other items, in the same menu
      expect(importers.parentElement).toBe(refresh.parentElement)
    })

    it('mounts the panel host once, without its own trigger and closed', () => {
      draw()
      const host = screen.getByTestId('importers-host')
      expect(host).toHaveAttribute('data-hide-trigger', 'true')
      expect(host).toHaveAttribute('data-open', 'false')
      expect(screen.queryByRole('button', { name: 'Importers' })).toBeNull()
    })

    it('the menu item opens the panel and tells the page, as the old trigger did (setOpenSidebar)', async () => {
      const user = userEvent.setup()
      const { setOpenSidebar } = draw()
      await openMore(user)
      await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
      expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'true')
      expect(setOpenSidebar).toHaveBeenCalledWith('importer')
    })

    it('opens without setOpenSidebar too', async () => {
      const user = userEvent.setup()
      draw({ setOpenSidebar: undefined })
      await openMore(user)
      await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
      expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'true')
    })

    it('the panel closing (onOpenChange) closes it', async () => {
      const user = userEvent.setup()
      draw()
      await openMore(user)
      await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
      await user.click(screen.getByRole('button', { name: 'host-close' }))
      expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'false')
    })

    it('a finished import goes to onImportSuccess (the page reloads the store)', async () => {
      const user = userEvent.setup()
      const { onImportSuccess } = draw()
      await user.click(screen.getByRole('button', { name: 'host-import-success' }))
      expect(onImportSuccess).toHaveBeenCalledTimes(1)
    })

    it('the focus goes back to the «More actions» button when the panel closes', async () => {
      const user = userEvent.setup()
      draw()
      await openMore(user)
      await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
      await user.click(screen.getByRole('button', { name: 'host-return-focus' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
    })

    it('has neither button nor host without a store', () => {
      draw({ hasStore: false, storeName: undefined })
      expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('importers-host')).not.toBeInTheDocument()
    })
  })

  it('has no actions and no breadcrumb without a store', () => {
    draw({ hasStore: false, storeName: undefined })
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add product' })).not.toBeInTheDocument()
  })

  it('Add product is only there with a category chosen, and disabled when the store has no categories', () => {
    const { rerender, ...rest } = draw({ canAddProduct: false })
    expect(screen.queryByRole('button', { name: 'Add product' })).not.toBeInTheDocument()
    rerender(<CatalogHeader {...rest} canAddProduct addProductDisabled />)
    expect(screen.getByRole('button', { name: 'Add product' })).toBeDisabled()
  })

  it('Store website is disabled in the menu without a URL', async () => {
    const user = userEvent.setup()
    draw({ siteDisabled: true })
    await openMore(user)
    expect(screen.getByRole('menuitem', { name: 'Store website' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('Refresh waits in the menu while the store loads', async () => {
    const user = userEvent.setup()
    draw({ refreshing: true })
    await openMore(user)
    expect(screen.getByRole('menuitem', { name: 'Refresh' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('Use weekly template is only there when the page says so, and is disabled while it works', async () => {
    const user = userEvent.setup()
    const { rerender, onUseTemplate, ...rest } = draw({ onUseTemplate: vi.fn() })
    await openMore(user)
    expect(screen.queryByRole('menuitem', { name: 'Use weekly template' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    const handler = vi.fn()
    rerender(<CatalogHeader {...rest} showWeeklyTemplate onUseTemplate={handler} />)
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Use weekly template' }))
    expect(handler).toHaveBeenCalledTimes(1)
    rerender(<CatalogHeader {...rest} showWeeklyTemplate templateLoading onUseTemplate={handler} />)
    await openMore(user)
    expect(screen.getByRole('menuitem', { name: 'Use weekly template' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('has the Learn menu of the page', () => {
    draw()
    expect(screen.getByRole('button', { name: /learn/i })).toBeInTheDocument()
  })

  it('shows «Open menu» before the title only with the sidebar collapsed', async () => {
    const user = userEvent.setup()
    const onOpenMenu = vi.fn()
    const { rerender, ...rest } = draw()
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
    rerender(<CatalogHeader {...rest} onOpenMenu={onOpenMenu} />)
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await user.click(opener)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
  })
})

// , P-1: on the phone the five secondary actions took three rows before the breadcrumb. Add category, Use weekly template, Importers,
// Refresh and Store website go to the «More actions» menu of the PageHeader (as S/StoresList/StoresHeader does); Learn and the primary
// «Add product» stay in view. Since tanda AB (C-5) the desktop does the same (the describe above).
describe('phone: secondary actions in the «More actions» menu', () => {
  it('has no Refresh, Importers, Add category or Store website button on the row', () => {
    draw({ isPhone: true })
    ;['Refresh', 'Importers', 'Add category', 'Store website', 'Use weekly template'].forEach(name => {
      expect(screen.queryByRole('button', { name })).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('the menu has Add category, Importers, Refresh and Store website, in that order', async () => {
    const user = userEvent.setup()
    draw({ isPhone: true })
    const items = await openMore(user)
    expect(items.map(item => item.textContent.trim())).toEqual(['Add category', 'Importers', 'Refresh', 'Store website'])
  })

  it('has Use weekly template second, only when the page says so, and it calls onUseTemplate', async () => {
    const user = userEvent.setup()
    const onUseTemplate = vi.fn()
    draw({ isPhone: true, showWeeklyTemplate: true, onUseTemplate })
    const items = await openMore(user)
    expect(items.map(item => item.textContent.trim())).toEqual(['Add category', 'Use weekly template', 'Importers', 'Refresh', 'Store website'])
    await user.click(screen.getByRole('menuitem', { name: 'Use weekly template' }))
    expect(onUseTemplate).toHaveBeenCalledTimes(1)
  })

  it('Use weekly template is disabled while it loads', async () => {
    const user = userEvent.setup()
    draw({ isPhone: true, showWeeklyTemplate: true, templateLoading: true, onUseTemplate: vi.fn() })
    await openMore(user)
    expect(screen.getByRole('menuitem', { name: 'Use weekly template' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('Add category, Refresh and Store website call their handlers', async () => {
    const user = userEvent.setup()
    const { onAddCategory, onRefresh, onOpenSite } = draw({ isPhone: true })
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Add category' }))
    expect(onAddCategory).toHaveBeenCalledTimes(1)
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Store website' }))
    expect(onOpenSite).toHaveBeenCalledTimes(1)
  })

  // tanda Y review (finding 4): the desktop Refresh is `busy` during a reload; the menu item waits too
  it('Refresh is disabled in the menu while the store reloads', async () => {
    const user = userEvent.setup()
    const { onRefresh } = draw({ isPhone: true, refreshing: true })
    await openMore(user)
    const item = screen.getByRole('menuitem', { name: 'Refresh' })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    await user.click(item)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('Store website is disabled in the menu without a URL', async () => {
    const user = userEvent.setup()
    const { onOpenSite } = draw({ isPhone: true, siteDisabled: true })
    await openMore(user)
    const item = screen.getByRole('menuitem', { name: 'Store website' })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    await user.click(item)
    expect(onOpenSite).not.toHaveBeenCalled()
  })

  it('Importers opens the panel and tells the page (setOpenSidebar); the host stays mounted outside the actions', async () => {
    const user = userEvent.setup()
    const { container, setOpenSidebar } = draw({ isPhone: true })
    const host = screen.getByTestId('importers-host')
    expect(host).toHaveAttribute('data-open', 'false')
    expect(container.querySelector('.odc-pagehead-actions').contains(host)).toBe(false)
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'true')
    expect(setOpenSidebar).toHaveBeenCalledWith('importer')
  })

  it('gives the host the «More actions» button as the place to give the focus back', async () => {
    const user = userEvent.setup()
    draw({ isPhone: true })
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
    await user.click(screen.getByRole('button', { name: 'host-return-focus' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
  })

  it('keeps Learn and the primary «Add product» in view', async () => {
    const user = userEvent.setup()
    const { onAddProduct } = draw({ isPhone: true })
    expect(screen.getByRole('button', { name: /learn/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    expect(onAddProduct).toHaveBeenCalledTimes(1)
  })

  it('has no menu and no host without a store', () => {
    draw({ isPhone: true, hasStore: false, storeName: undefined })
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.queryByTestId('importers-host')).toBeNull()
  })

  // redesign tanda AB (C-5): the desktop collects the secondary actions in the same «More actions» menu as the phone; none is dropped
  it('off the phone the same menu holds the secondary actions, and only Learn and Add product stay in view', async () => {
    const user = userEvent.setup()
    draw({ isPhone: false, showWeeklyTemplate: true, onUseTemplate: vi.fn() })
    ;['Refresh', 'Importers', 'Add category', 'Use weekly template', 'Store website'].forEach(name => {
      expect(screen.queryByRole('button', { name })).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Add product' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /learn/i })).toBeInTheDocument()
    const items = await openMore(user)
    expect(items.map(item => item.textContent.trim())).toEqual(['Add category', 'Use weekly template', 'Importers', 'Refresh', 'Store website'])
  })
})

describe('breadcrumb', () => {
  it('is «store › All products» with no category, and the store opens its editor', async () => {
    const user = userEvent.setup()
    const { onOpenStore } = draw()
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByText('All products')).toHaveAttribute('aria-current', 'page')
    await user.click(within(crumbs).getByRole('button', { name: 'Tastewine' }))
    expect(onOpenStore).toHaveBeenCalledTimes(1)
  })

  it('ends in the chosen category', () => {
    draw({ categoryName: 'Beer' })
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByText('Beer')).toHaveAttribute('aria-current', 'page')
    expect(within(crumbs).queryByText('All products')).not.toBeInTheDocument()
  })
})

describe('CatalogSearch', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const type = (input, value) => fireEvent.change(input, { target: { value } })

  it('asks on the last key plus 750 ms, not before', () => {
    const onSearch = vi.fn()
    render(<CatalogSearch value='' onSearch={onSearch} inCategory />)
    const input = screen.getByRole('searchbox', { name: 'Search in this category' })
    type(input, 'be')
    act(() => { vi.advanceTimersByTime(500) })
    type(input, 'beer')
    act(() => { vi.advanceTimersByTime(749) })
    expect(onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('beer')
  })

  it('names itself by the scope: a category or all the products', () => {
    const { rerender } = render(<CatalogSearch value='' onSearch={() => {}} inCategory={false} />)
    expect(screen.getByRole('searchbox', { name: 'Search all products' })).toHaveAttribute('placeholder', 'Search all products')
    rerender(<CatalogSearch value='' onSearch={() => {}} inCategory />)
    expect(screen.getByRole('searchbox', { name: 'Search in this category' })).toHaveAttribute('placeholder', 'Search in this category')
  })

  it('the clear button empties the search at once and cancels the wait', () => {
    const onSearch = vi.fn()
    render(<CatalogSearch value='' onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')
    type(input, 'beer')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('')
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('')
  })

  it('shows a search that changes from outside (Clear filters, switching store) when the person is not typing', () => {
    const { rerender } = render(<CatalogSearch value='beer' onSearch={() => {}} />)
    expect(screen.getByRole('searchbox')).toHaveValue('beer')
    rerender(<CatalogSearch value={null} onSearch={() => {}} />)
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('does not ask after it leaves the page', () => {
    const onSearch = vi.fn()
    const { unmount } = render(<CatalogSearch value='' onSearch={onSearch} />)
    type(screen.getByRole('searchbox'), 'beer')
    unmount()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSearch).not.toHaveBeenCalled()
  })
})

// redesign tanda AB (L-3): at 390 «Select a business» came out as «Изберете би…» (bg, de, el, es, fr, pt): the name in the title was
// nowrap with an ellipsis. On the phone it wraps by words (the h1's own clamp of two lines still holds); wide, nothing changes. jsdom does
// not lay out, so this pins the rules.
describe('title on the phone (L-3)', () => {
  const css = readFileSync(resolve(__dirname, '../catalog.css'), 'utf8')
  const phoneBlocks = [...css.matchAll(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/g)].map(match => match[1])
  const phoneRule = phoneBlocks.map(block => block.match(/\.odc-cat-title-text \{([^}]*)\}/)?.[1]).find(Boolean)

  it('the name of the store wraps on the phone instead of ending in an ellipsis, and a long word breaks', () => {
    expect(phoneRule).toBeDefined()
    expect(phoneRule).toMatch(/white-space:\s*normal/)
    expect(phoneRule).toMatch(/overflow-wrap:\s*anywhere/)
    expect(phoneRule).toMatch(/text-overflow:\s*clip/)
  })

  it('wide, it stays on one line with an ellipsis (nothing changes)', () => {
    const base = css.match(/^\.odc-cat-title-text \{([^}]*)\}/m)?.[1]
    expect(base).toMatch(/white-space:\s*nowrap/)
    expect(base).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('the text is the full name in the DOM (nothing is cut by the markup)', () => {
    draw({ storeName: undefined })
    expect(titleButton()).toHaveTextContent('Select a business')
  })
})
