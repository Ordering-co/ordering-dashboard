/* eslint-disable import/first */
// redesign stores 5.6 (G3-04, decisions 4 and 5): the products of a shared menu are the list of a nested P/SectionSplit and
// the product is its detail (no 500px SideBar, no Modal over the list). The controllers are replaced by props (contract of
// C/BusinessSharedMenuProducts: `menuState.menu.products`, `handleUpdateBusinessSharedMenuProduct(id, changes)` → `{ ok } | { ok: false,
// error }`, `patchProduct`); the controller of the detail gives the form state from `mocks.detail`.
import React, { createRef } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn(),
  width: 1920,
  detail: { dirty: false, keys: [] },
  saveChanges: vi.fn(),
  discardChanges: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessSharedMenuProducts: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  BusinessSharedMenuProductDetails: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      productState={{ product: props.product }}
      formState={{ changes: {}, saving: false, error: null }}
      isDirty={mocks.detail.dirty}
      pendingChangeKeys={mocks.detail.keys}
      handleChangeField={vi.fn()}
      saveChanges={mocks.saveChanges}
      discardChanges={mocks.discardChanges}
      handleToggleProperty={vi.fn().mockResolvedValue({ ok: true })}
      handleUpdateExtra={vi.fn().mockResolvedValue({ ok: true })}
      handleUpdateOption={vi.fn().mockResolvedValue({ ok: true })}
      handleUpdateSuboption={vi.fn().mockResolvedValue({ ok: true })}
    />
  )
}))
// P/AsyncSwitch reads the language straight from its context
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../../utils', () => ({
  addQueryToUrl: mocks.addQueryToUrl,
  removeQueryToUrl: mocks.removeQueryToUrl
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: mocks.width }) }))
// the legacy modal must not be what shows the product
vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => (open ? <div data-testid='modal'>{children}</div> : null),
  SideBar: ({ open, children }) => (open ? <div data-testid='sidebar'>{children}</div> : null)
}))

import { LeaveGuardContext, SectionSplit } from '../../../Shared/Product'
import { BusinessSharedMenuProducts } from '../index'

const PRODUCTS = [
  { id: 1, name: 'Burger', enabled: true, featured: false, upselling: false, inventoried: false, price: 10, extras: [] },
  { id: 2, name: 'Fries', enabled: false, featured: false, upselling: false, inventoried: false, price: 3, extras: [] },
  { id: 3, name: 'COLA light', enabled: true, featured: false, upselling: false, inventoried: false, price: 2, extras: [] }
]

const buildProps = (overrides = {}) => ({
  business: { id: 7 },
  menuState: { menu: { id: 5, name: 'Brand menu', products: PRODUCTS } },
  handleUpdateBusinessSharedMenuProduct: vi.fn().mockResolvedValue({ ok: true }),
  patchProduct: vi.fn(),
  setIsOpenSharedProduct: vi.fn(),
  handleUpdateBusinessState: vi.fn(),
  menuList: { menus: [], menusShared: [] },
  setMenuList: vi.fn(),
  ...overrides
})

const mount = (overrides, url = '/stores/list?id=7&section=menu') => {
  const props = buildProps(overrides)
  const view = renderWithProviders(<BusinessSharedMenuProducts {...props} />, { initialEntries: [url] })
  return { props, ...view }
}

const row = (container, id) => container.querySelector(`[data-section-split-key="${id}"]`)
const detailHeading = name => screen.queryByRole('heading', { level: 3, name })

beforeEach(() => {
  mocks.addQueryToUrl.mockClear()
  mocks.removeQueryToUrl.mockClear()
  mocks.saveChanges.mockReset().mockResolvedValue({ ok: true })
  mocks.discardChanges.mockClear()
  mocks.width = 1920
  mocks.detail.dirty = false
  mocks.detail.keys = []
})
afterEach(() => cleanup())

describe('BusinessSharedMenuProducts · the list', () => {
  it('has a named Available switch and a name button on each row', () => {
    mount()
    expect(screen.getByRole('switch', { name: 'Available: Burger' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Available: Fries' }).getAttribute('aria-checked')).toBe('false')
    for (const name of ['Burger', 'Fries', 'COLA light']) {
      expect(screen.getByRole('button', { name }).getAttribute('type')).toBe('button')
    }
  })

  it('saves the switch through the controller and does not open the product', async () => {
    const user = userEvent.setup()
    const { props } = mount()
    await user.click(screen.getByRole('switch', { name: 'Available: Fries' }))
    expect(props.handleUpdateBusinessSharedMenuProduct).toHaveBeenCalledWith(2, { enabled: true })
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    expect(detailHeading('Fries')).toBeNull()
  })

  it('puts the switch back and says why when the save fails, and leaves the other rows alone', async () => {
    const user = userEvent.setup()
    mount({ handleUpdateBusinessSharedMenuProduct: vi.fn().mockResolvedValue({ ok: false, error: ['Nope'] }) })
    await user.click(screen.getByRole('switch', { name: 'Available: Fries' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Nope')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Available: Fries' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('switch', { name: 'Available: Burger' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Available: COLA light' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('says when the menu has no products, and when the search finds none', async () => {
    const user = userEvent.setup()
    mount({ menuState: { menu: { id: 5, products: [] } } })
    expect(screen.getByText('This menu has no products.')).toBeTruthy()
    cleanup()
    mount()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz')
    expect(screen.getByText('No results')).toBeTruthy()
    expect(screen.queryByText('This menu has no products.')).toBeNull()
  })

  it('searches without telling upper from lower case, on both sides', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'BURG')
    expect(screen.getByRole('button', { name: 'Burger' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Fries' })).toBeNull()
    await user.clear(screen.getByRole('searchbox', { name: 'Search' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'cola')
    expect(screen.getByRole('button', { name: 'COLA light' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Burger' })).toBeNull()
  })
})

describe('BusinessSharedMenuProducts · the product is the detail of the piece', () => {
  it('opens in the piece, with no sidebar, no modal and no id of its own, and writes ?product=', async () => {
    const user = userEvent.setup()
    const { props } = mount()
    await user.click(screen.getByRole('button', { name: 'Burger' }))

    expect(detailHeading('Burger')).toBeTruthy()
    expect(document.getElementById('shared_product_details')).toBeNull()
    expect(screen.queryByTestId('modal')).toBeNull()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Burger' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: 'Fries' }).getAttribute('aria-current')).toBeNull()
    expect(mocks.addQueryToUrl).toHaveBeenCalledWith({ product: 1 })
    expect(props.setIsOpenSharedProduct).toHaveBeenLastCalledWith(true)
  })

  it('also opens with a click on the row, and the switch is not that click', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    expect(row(container, 2).getAttribute('tabindex')).toBe('-1')
    await user.click(row(container, 2))
    expect(detailHeading('Fries')).toBeTruthy()
    expect(mocks.addQueryToUrl).toHaveBeenCalledWith({ product: 2 })
  })

  it('closes with the X, takes ?product= off and tells the menu', async () => {
    const user = userEvent.setup()
    const { props } = mount()
    await user.click(screen.getByRole('button', { name: 'Burger' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(detailHeading('Burger')).toBeNull()
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['product'])
    expect(props.setIsOpenSharedProduct).toHaveBeenLastCalledWith(false)
  })

  it('swaps to another product from the list', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Burger' }))
    await user.click(screen.getByRole('button', { name: 'Fries' }))
    expect(detailHeading('Fries')).toBeTruthy()
    expect(detailHeading('Burger')).toBeNull()
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ product: 2 })
  })

  it('stacks in a narrow dashboard: the product replaces the list and «‹ Products» goes back', async () => {
    mocks.width = 600
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Burger' }))
    expect(detailHeading('Burger')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Fries' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Products' }))
    expect(detailHeading('Burger')).toBeNull()
    expect(screen.getByRole('button', { name: 'Fries' })).toBeTruthy()
  })
})

describe('BusinessSharedMenuProducts · ?product= on arrival', () => {
  it('opens that product and does not rewrite the URL', () => {
    const { props } = mount({}, '/stores/list?id=7&menu=5&product=2')
    expect(detailHeading('Fries')).toBeTruthy()
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
    expect(props.setIsOpenSharedProduct).toHaveBeenCalledWith(true)
  })

  it('takes an unknown product off the URL and opens nothing', () => {
    mount({}, '/stores/list?id=7&menu=5&product=99')
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['product'])
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('writes nothing without a ?product=', () => {
    mount()
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
  })

  // redesign bugs F row 29: the shared products can arrive after the component mounted (the menu opens, then
  // `getSharedMenuProducts` answers), so the id is resolved when the list is known, not on mount
  describe('when the list arrives late', () => {
    const lateProps = (products) => buildProps({ menuState: { menu: { id: 5, name: 'Brand menu', ...(products ? { products } : {}) } } })
    const url = '/stores/list?id=7&menu=5&product=2'

    it('waits for the list, then opens the product and keeps ?product= in the URL', () => {
      const props = lateProps()
      const { rerender } = renderWithProviders(<BusinessSharedMenuProducts {...props} />, { initialEntries: [url] })
      expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
      expect(detailHeading('Fries')).toBeNull()

      rerender(<BusinessSharedMenuProducts {...lateProps(PRODUCTS)} />)
      expect(detailHeading('Fries')).toBeTruthy()
      expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
      expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
      expect(props.setIsOpenSharedProduct).not.toHaveBeenCalledWith(false)
    })

    it('tells the menu that a product is open once it resolves', () => {
      const first = lateProps()
      const { rerender } = renderWithProviders(<BusinessSharedMenuProducts {...first} />, { initialEntries: [url] })
      const second = { ...lateProps(PRODUCTS), setIsOpenSharedProduct: vi.fn() }
      rerender(<BusinessSharedMenuProducts {...second} />)
      expect(second.setIsOpenSharedProduct).toHaveBeenCalledWith(true)
    })

    it('takes an id that is not in the list off the URL, once the list is known', () => {
      const { rerender } = renderWithProviders(<BusinessSharedMenuProducts {...lateProps()} />, { initialEntries: ['/stores/list?id=7&menu=5&product=99'] })
      expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()

      rerender(<BusinessSharedMenuProducts {...lateProps(PRODUCTS)} />)
      expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['product'])
      expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    })

    it('does not take the id off while the menu only carries product ids (not the list yet)', () => {
      // bare ids draw rows without a key/name: that is how the menu looked before, and it is not what this test is about
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { rerender } = renderWithProviders(<BusinessSharedMenuProducts {...lateProps([1, 2, 3])} />, { initialEntries: [url] })
      expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
      rerender(<BusinessSharedMenuProducts {...lateProps(PRODUCTS)} />)
      expect(detailHeading('Fries')).toBeTruthy()
      expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('resolves the URL only once: a later change of the list does not reopen a product the user closed', async () => {
      const user = userEvent.setup()
      const { rerender } = renderWithProviders(<BusinessSharedMenuProducts {...lateProps()} />, { initialEntries: [url] })
      rerender(<BusinessSharedMenuProducts {...lateProps(PRODUCTS)} />)
      expect(detailHeading('Fries')).toBeTruthy()
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(detailHeading('Fries')).toBeNull()
      rerender(<BusinessSharedMenuProducts {...lateProps(PRODUCTS.map(product => ({ ...product })))} />)
      expect(detailHeading('Fries')).toBeNull()
    })
  })
})

describe('BusinessSharedMenuProducts · inside the outer detail of the menu', () => {
  // the host asks and holds the way out (default) or, with `letGo`, lets it go
  const makeHost = (letGo = false) => ({
    register: vi.fn(() => () => {}),
    registerNested: vi.fn(() => () => {}),
    requestLeave: vi.fn((proceed) => {
      if (letGo) proceed()
      return true
    })
  })

  const mountInOuter = (host, onOuterClose = vi.fn()) => {
    const props = buildProps()
    const outerRef = createRef()
    const tree = (
      <LeaveGuardContext.Provider value={host}>
        <SectionSplit
          ref={outerRef}
          open
          detailKey='5'
          detailTitle='Brand menu'
          closeLabel='Close menu'
          backLabel='Menus'
          splitFrom={1}
          onClose={onOuterClose}
          list={<div>the menus</div>}
          detail={<BusinessSharedMenuProducts {...props} />}
        />
      </LeaveGuardContext.Provider>
    )
    renderWithProviders(tree)
    return { props, outerRef, onOuterClose }
  }

  it('Escape closes the product first and the menu on the next one', async () => {
    const user = userEvent.setup()
    const { onOuterClose } = mountInOuter(makeHost())
    await user.click(screen.getByRole('button', { name: 'Burger' }))
    expect(detailHeading('Burger')).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(detailHeading('Burger')).toBeNull()
    expect(detailHeading('Brand menu')).toBeTruthy()
    expect(onOuterClose).not.toHaveBeenCalled()
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['product'])

    await user.keyboard('{Escape}')
    expect(onOuterClose).toHaveBeenCalledTimes(1)
  })

  it('leaving the menu with nothing open does not ask', () => {
    const host = makeHost()
    const { outerRef } = mountInOuter(host)
    const proceed = vi.fn()
    act(() => outerRef.current.requestLeave(proceed))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(host.requestLeave).not.toHaveBeenCalled()
  })

  it('leaving the menu with a clean product open goes on', async () => {
    const user = userEvent.setup()
    const host = makeHost()
    const { outerRef } = mountInOuter(host)
    await user.click(screen.getByRole('button', { name: 'Burger' }))
    const proceed = vi.fn()
    act(() => outerRef.current.requestLeave(proceed))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(host.requestLeave).not.toHaveBeenCalled()
  })

  it('leaving the menu with a dirty product open asks first and does not go on', async () => {
    mocks.detail.dirty = true
    mocks.detail.keys = ['price']
    const user = userEvent.setup()
    const host = makeHost()
    const { outerRef } = mountInOuter(host)
    await user.click(screen.getByRole('button', { name: 'Burger' }))
    const proceed = vi.fn()
    act(() => outerRef.current.requestLeave(proceed))
    expect(host.requestLeave).toHaveBeenCalledTimes(1)
    expect(host.requestLeave.mock.calls[0][0]).toBe(proceed)
    expect(proceed).not.toHaveBeenCalled()
  })

  it('stops asking about the product once it is closed', async () => {
    mocks.detail.dirty = true
    const user = userEvent.setup()
    const host = makeHost(true)
    const { outerRef } = mountInOuter(host)
    await user.click(screen.getByRole('button', { name: 'Burger' }))
    mocks.detail.dirty = false
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(detailHeading('Burger')).toBeNull()
    host.requestLeave.mockClear()
    const proceed = vi.fn()
    act(() => outerRef.current.requestLeave(proceed))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(host.requestLeave).not.toHaveBeenCalled()
  })

  it('opening another product asks first when the open one is dirty', async () => {
    mocks.detail.dirty = true
    const user = userEvent.setup()
    const host = makeHost()
    mountInOuter(host)
    await user.click(screen.getByRole('button', { name: 'Burger' }))
    mocks.addQueryToUrl.mockClear()
    // on wide screens the list stays beside the open product
    await user.click(screen.getByRole('button', { name: 'Fries' }))
    expect(host.requestLeave).toHaveBeenCalled()
    expect(mocks.addQueryToUrl).not.toHaveBeenCalledWith({ product: 2 })
    expect(detailHeading('Burger')).toBeTruthy()
  })
})

describe('BusinessSharedMenuProducts · source', () => {
  const source = readFileSync(path.resolve(__dirname, '../index.js'), 'utf8')

  it('has no sidebar, modal or width branch, and no legacy styles', () => {
    expect(source).not.toMatch(/import[^\n]*(SideBar|Modal|useWindowSize)/)
    expect(source).not.toMatch(/<(SideBar|Modal)/)
    expect(source).not.toMatch(/react-bootstrap/)
    expect(source).not.toMatch(/from '\.\/styles'/)
    expect(source).not.toMatch(/shared_product_details/)
  })
})
