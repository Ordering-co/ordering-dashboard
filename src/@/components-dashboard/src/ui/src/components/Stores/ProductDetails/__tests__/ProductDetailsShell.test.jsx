/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// redesign SP-F1 (D1)
const mocks = vi.hoisted(() => ({
  addQuery: vi.fn(),
  removeQuery: vi.fn(),
  bodies: [],
  mounts: 0,
  withLegacySideBar: false
}))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url, parsePrice: (value) => `$${Number(value).toFixed(2)}` }],
  ProductDetatils: () => null
}))
vi.mock('../../../../utils', () => ({ addQueryToUrl: mocks.addQuery, removeQueryToUrl: mocks.removeQuery }))
vi.mock('../../SnoozeComponent', async () => {
  const { createElement } = await import('react')
  return { SnoozeComponent: () => createElement('div', { 'data-testid': 'snooze' }, 'snooze body') }
})
vi.mock('../../ProductDesktopPreview', () => ({ ProductDesktopPreview: () => null }))
vi.mock('../../../Shared', async () => {
  const { createElement } = await import('react')
  return {
    Modal: () => null,
    ProgressRing: () => createElement('div', { 'data-testid': 'ring' })
  }
})
// The sections are D2's and the legacy components': here they are a box that can open a legacy SideBar and ask for the whole width.
vi.mock('../ProductSectionBody', async () => {
  const { createElement, useEffect, useState } = await import('react')
  const { SideBar } = await import('../../../Shared/UI/SideBar')
  return {
    ProductSectionBody: (props) => {
      mocks.bodies.push(props)
      useEffect(() => { mocks.mounts += 1 }, [])
      const [legacyOpen, setLegacyOpen] = useState(true)
      return createElement(
        'div',
        { 'data-testid': 'section-body', 'data-section': props.section, 'data-tab': props.tab ?? '' },
        mocks.withLegacySideBar && legacyOpen
          ? createElement(SideBar, { open: true, onClose: () => setLegacyOpen(false) }, createElement('span', null, 'legacy side bar'))
          : null,
        createElement('button', { type: 'button', onClick: () => props.setIsExtendExtraOpen(true) }, 'Extend'),
        createElement('button', { type: 'button', onClick: () => props.handleCloseExtraOpen() }, 'Done')
      )
    }
  }
})

import { ProductDetailsUI } from '../index'
import { PRODUCT_SECTION_QUERY_KEYS } from '../productSections'

const CSS = readFileSync(path.resolve(__dirname, '../product-editor.css'), 'utf8')

const makeProduct = (over = {}) => ({
  id: 7,
  name: 'Cheese Burger',
  type: 'product',
  enabled: true,
  category_id: 9,
  images: 'https://img.test/burger.png',
  price: 10,
  cost_price: 4,
  ...over
})

const makeProps = (over = {}) => {
  const product = over.product ?? makeProduct()
  return {
    open: true,
    onClose: vi.fn(),
    product,
    productId: product.id,
    categoryId: product.category_id,
    business: { id: 3 },
    productState: { loading: false, product, error: null },
    formState: { loading: false, changes: {} },
    handleChangeFormState: vi.fn(),
    handleUpdateClick: vi.fn(),
    handleSuccessUpdate: vi.fn(),
    handleChangeProductActiveState: vi.fn(async () => ({ ok: true })),
    handleDuplicateProduct: vi.fn(async () => ({ ok: true })),
    handleDeleteProduct: vi.fn(async () => undefined),
    duplicateState: { loading: false, error: null },
    productCart: { options: {} },
    showProductOption: vi.fn(() => true),
    getProduct: vi.fn(),
    ...over
  }
}

const setWidth = (width) => {
  window.innerWidth = width
  window.dispatchEvent(new Event('resize'))
}

const shell = (props, url = '/stores/products/fast-bite?category=9&product=7') => (
  <MemoryRouter initialEntries={[url]}>
    <ProductDetailsUI {...props} />
  </MemoryRouter>
)

const panel = () => document.getElementById('product_details')
const nav = () => screen.queryByRole('navigation', { name: 'Product sections' })
const choose = async (user, name) => user.click(within(nav()).getByRole('button', { name }))
const escape = () => fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' })
const body = () => screen.queryByTestId('section-body')

beforeEach(() => {
  mocks.bodies = []
  mocks.mounts = 0
  mocks.withLegacySideBar = false
  mocks.addQuery.mockClear()
  mocks.removeQuery.mockClear()
  setWidth(1280)
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('ProductDetails shell · the panel', () => {
  it('is one fixed panel (#product_details) named by the product, with no width written on the node', () => {
    render(shell(makeProps()))
    expect(panel()).toHaveAttribute('data-open')
    expect(panel()).toHaveAttribute('data-size', 'base')
    expect(panel().getAttribute('style')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Cheese Burger' })).toBeInTheDocument()
    expect(panel()).toHaveAccessibleName('Cheese Burger')
  })

  it('stays closed (data-open absent) until `open`', () => {
    render(shell(makeProps({ open: false })))
    expect(panel()).not.toHaveAttribute('data-open')
  })

  it('is never a container, a containing block or a transform (legacy SideBars must paint over the page)', () => {
    const noComments = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/container-type|container-name|container:|contain:|transform|filter|will-change|perspective|translate:/)
    expect(noComments).toMatch(/\.odc-pe-panel\s*\{[^}]*position:\s*fixed/)
    expect(noComments).toMatch(/z-index:\s*calc\(var\(--od-x-layer-chrome\) \+ 5\)/)
  })

  it('does not write the width by id any more (no toggleMainContent, no expandSideBar)', () => {
    const source = readFileSync(path.resolve(__dirname, '../index.js'), 'utf8')
    expect(source).not.toMatch(/\.style\.width|getElementById/)
  })

  it('follows the window: Overview, a section at 1280, the same section at 800 and on a phone', async () => {
    const user = userEvent.setup()
    const { unmount } = render(shell(makeProps()))
    expect(panel()).toHaveAttribute('data-size', 'base')
    await choose(user, 'Information')
    expect(panel()).toHaveAttribute('data-size', 'wide')
    unmount()

    setWidth(800)
    const second = render(shell(makeProps()))
    await choose(user, 'Information')
    expect(panel()).toHaveAttribute('data-size', 'full')
    second.unmount()

    setWidth(390)
    render(shell(makeProps()))
    expect(panel()).toHaveAttribute('data-size', 'full')
  })

  // redesign SP-(R-3): as in main (ProductSummary:173-178) Expand is always offered, with a section open and on a narrow window
  it('Expand makes it full width and Collapse takes it back, also with a section open', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(panel()).toHaveAttribute('data-size', 'full')
    await user.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(panel()).toHaveAttribute('data-size', 'base')
    await choose(user, 'Information')
    expect(panel()).toHaveAttribute('data-size', 'wide')
    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(panel()).toHaveAttribute('data-size', 'full')
    await user.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(panel()).toHaveAttribute('data-size', 'wide')
  })

  it('offers Expand at 576px or less too, as main did', () => {
    setWidth(576)
    render(shell(makeProps()))
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
  })

  it('the close button closes the editor', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(shell(props))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ProductDetails shell · the list of sections', () => {
  it('lists a product in its order, under the group «Product details», with the Overview as the current one and above its content', () => {
    render(shell(makeProps()))
    const items = within(nav()).getAllByRole('button').map(button => button.textContent)
    expect(items).toEqual([
      'Overview', 'Information', 'Advanced', 'Labels', 'Categories', 'SEO Options',
      'Ingredients / Properties', 'Product options', 'Product images', 'Product video'
    ])
    expect(within(nav()).getByText('Product details')).toBeInTheDocument()
    expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    const main = panel().querySelector('.odc-pe-main')
    expect(main).toHaveAttribute('data-view', 'overview')
    expect(main.firstElementChild).toBe(nav().closest('.odc-pe-nav'))
    expect(body()).toBeNull()
    // the Overview content: the prices of the product
    expect(screen.getByText('Selling price')).toBeInTheDocument()
  })

  it('lists a service as ProductSummary did', () => {
    render(shell(makeProps({ product: makeProduct({ type: 'service', duration: 30 }) })))
    expect(within(nav()).getAllByRole('button').map(button => button.textContent)).toEqual([
      'Overview', 'Service details', 'Professionals', 'Product options', 'Product images'
    ])
  })

  it('does not list Custom fields or Personalization', () => {
    render(shell(makeProps()))
    expect(within(nav()).queryByRole('button', { name: 'Custom fields' })).toBeNull()
    expect(within(nav()).queryByRole('button', { name: 'Personalization' })).toBeNull()
  })

  it('opens a tab of Product details from the list: one handler writes `section` and `tab`, the body gets both and the controller props', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(shell(props))
    await choose(user, 'Advanced')
    expect(body()).toHaveAttribute('data-section', 'product_details')
    expect(body()).toHaveAttribute('data-tab', 'advanced')
    expect(mocks.addQuery).toHaveBeenCalledTimes(1)
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'product_details', tab: 'advanced' })
    expect(mocks.removeQuery).not.toHaveBeenCalled() // nothing to clear coming from the Overview
    const last = mocks.bodies.at(-1)
    expect(last.productState).toBe(props.productState)
    expect(last.business).toBe(props.business)
    expect(last.formState).toBe(props.formState)
    expect(last.isExtendExtraOpen).toBe(false)
    expect(typeof last.setIsExtendExtraOpen).toBe('function')
    expect(typeof last.handleCloseExtraOpen).toBe('function')
    // the list stays as a column beside it, with the entry as the current one
    expect(panel().querySelector('.odc-pe-main')).toHaveAttribute('data-view', 'section')
    expect(within(nav()).getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav()).getByRole('button', { name: 'Information' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByText('Selling price')).toBeNull()
  })

  it('opens another section from the list: only `section` goes to the address', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Ingredients / Properties')
    expect(body()).toHaveAttribute('data-section', 'ingredients')
    expect(body()).toHaveAttribute('data-tab', '')
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'ingredients' })
  })

  it('goes from one tab to another keeping the body mounted, clearing the keys of the first and writing the new ones, in that order', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Information')
    mocks.addQuery.mockClear()
    await choose(user, 'Labels')
    expect(body()).toHaveAttribute('data-tab', 'labels')
    expect(mocks.mounts).toBe(1) // ProductMainDetails is the same element for the five tabs: it stays mounted
    expect(mocks.removeQuery).toHaveBeenCalledTimes(1)
    expect(mocks.removeQuery).toHaveBeenCalledWith(PRODUCT_SECTION_QUERY_KEYS)
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'product_details', tab: 'labels' })
    expect(mocks.removeQuery.mock.invocationCallOrder[0]).toBeLessThan(mocks.addQuery.mock.invocationCallOrder[0])
  })

  it('Information → Ingredients → Advanced: each step leaves the keys of the one before and writes its own', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Information')
    await choose(user, 'Ingredients / Properties')
    expect(body()).toHaveAttribute('data-section', 'ingredients')
    await choose(user, 'Advanced')
    expect(body()).toHaveAttribute('data-section', 'product_details')
    expect(body()).toHaveAttribute('data-tab', 'advanced')
    expect(mocks.addQuery.mock.calls.map(([query]) => query)).toEqual([
      { section: 'product_details', tab: 'information' },
      { section: 'ingredients' },
      { section: 'product_details', tab: 'advanced' }
    ])
    expect(mocks.removeQuery).toHaveBeenCalledTimes(2)
  })

  it('pressing the entry that is open does nothing to the address', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Advanced')
    mocks.addQuery.mockClear()
    await choose(user, 'Advanced')
    expect(mocks.addQuery).not.toHaveBeenCalled()
    expect(mocks.removeQuery).not.toHaveBeenCalled()
  })

  it('Overview in the list closes the section and clears section, tab, tag, ingredient and extra', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Advanced')
    await choose(user, 'Overview')
    expect(body()).toBeNull()
    expect(mocks.removeQuery).toHaveBeenCalledWith(['section', 'tab', 'tag', 'ingredient', 'extra'])
    expect(panel()).toHaveAttribute('data-size', 'base')
  })

  it('a section can ask to go back to the Overview (Categories after it moved the product)', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Categories')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(body()).toBeNull()
    expect(mocks.removeQuery).toHaveBeenCalledWith(PRODUCT_SECTION_QUERY_KEYS)
  })

  it('«Custom fields» of the ⋯ menu opens that section (not in the list)', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
    expect(body()).toHaveAttribute('data-section', 'custom_fields')
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'custom_fields' })
    expect(nav().querySelector('[aria-current="page"]')).toBeNull()
  })

  it('a section that asks for the whole width hides the list and offers «All sections»; going back or changing section resets it', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Labels')
    await user.click(screen.getByRole('button', { name: 'Extend' }))
    expect(nav()).toBeNull()
    expect(panel()).toHaveAttribute('data-size', 'full')
    expect(panel().querySelector('.odc-pe-main')).toHaveAttribute('data-nav', 'hidden')
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

  it('goes back to the Overview when another product is shown', () => {
    const props = makeProps()
    const { rerender } = render(shell(props, '/stores/products/fast-bite?category=9&product=7&section=ingredients'))
    expect(body()).toHaveAttribute('data-section', 'ingredients')
    const other = makeProduct({ id: 8, name: 'Fries' })
    rerender(shell({ ...props, product: other, productState: { loading: false, product: other, error: null } }, '/stores/products/fast-bite?category=9&product=7&section=ingredients'))
    expect(body()).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Fries' })).toBeInTheDocument()
  })

  it('keeps the section when the same product is refreshed', () => {
    const props = makeProps()
    const { rerender } = render(shell(props, '/stores/products/fast-bite?section=ingredients'))
    const same = { ...props.product, price: 12 }
    rerender(shell({ ...props, product: same, productState: { loading: false, product: same, error: null } }, '/stores/products/fast-bite?section=ingredients'))
    expect(body()).toHaveAttribute('data-section', 'ingredients')
  })
})

describe('ProductDetails shell · the address when it opens', () => {
  it('?section=product_details&tab=advanced opens that entry, writes nothing', () => {
    render(shell(makeProps(), '/stores/products/fast-bite?category=9&product=7&section=product_details&tab=advanced'))
    expect(body()).toHaveAttribute('data-section', 'product_details')
    expect(body()).toHaveAttribute('data-tab', 'advanced')
    expect(within(nav()).getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-current', 'page')
    expect(mocks.addQuery).not.toHaveBeenCalled()
    expect(mocks.removeQuery).not.toHaveBeenCalled()
  })

  it('?section=product_details with no tab opens Information and completes the address with it, as ProductMainDetails did', () => {
    render(shell(makeProps(), '/stores/products/fast-bite?section=product_details'))
    expect(body()).toHaveAttribute('data-tab', 'information')
    expect(within(nav()).getByRole('button', { name: 'Information' })).toHaveAttribute('aria-current', 'page')
    expect(mocks.addQuery).toHaveBeenCalledTimes(1)
    expect(mocks.addQuery).toHaveBeenCalledWith({ tab: 'information' })
  })

  it('a tab that is not a tab is Information too', () => {
    render(shell(makeProps(), '/stores/products/fast-bite?section=product_details&tab=nope'))
    expect(body()).toHaveAttribute('data-tab', 'information')
  })

  it.each([
    ['custom_fields'],
    ['personalization'],
    ['ingredients'],
    ['product_images']
  ])('?section=%s paints that branch, with no tab', (section) => {
    render(shell(makeProps(), `/stores/products/fast-bite?section=${section}&tab=advanced`))
    expect(body()).toHaveAttribute('data-section', section)
    expect(body()).toHaveAttribute('data-tab', '')
    expect(mocks.addQuery).not.toHaveBeenCalled()
  })

  it('custom_fields and personalization open although they are not in the list (nothing in it is the current one)', () => {
    render(shell(makeProps(), '/stores/products/fast-bite?section=personalization'))
    expect(body()).toHaveAttribute('data-section', 'personalization')
    expect(nav().querySelector('[aria-current="page"]')).toBeNull()
  })

  it('opens the Overview with no section', () => {
    render(shell(makeProps()))
    expect(body()).toBeNull()
    expect(mocks.addQuery).not.toHaveBeenCalled()
  })
})

describe('ProductDetails shell · Escape', () => {
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
    await choose(user, 'Labels')
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

  it('the delete confirmation takes Escape too', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(shell(props))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    escape()
    expect(props.onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})

describe('ProductDetails shell · states', () => {
  it('shows skeletons and a busy panel while the product loads, with no list of sections', () => {
    const props = makeProps({ product: undefined, productState: { loading: true, product: null, error: null } })
    render(shell(props))
    expect(panel()).toHaveAttribute('aria-busy', 'true')
    expect(nav()).toBeNull()
    expect(panel().querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(panel()).toHaveAccessibleName('Loading')
  })

  it('treats a product that has not started loading as loading, not as missing', () => {
    render(shell(makeProps({ product: undefined, productState: { loading: false, product: null, error: null } })))
    expect(panel()).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText(/couldn.t load/)).toBeNull()
  })

  it('a deep link to a section waits for the product: the body is not painted without it', () => {
    const props = makeProps({ product: undefined, productState: { loading: true, product: null, error: null } })
    const { rerender } = render(shell(props, '/stores/products/fast-bite?section=product_images'))
    expect(body()).toBeNull()
    const product = makeProduct()
    rerender(shell({ ...props, product, productState: { loading: false, product, error: null } }, '/stores/products/fast-bite?section=product_images'))
    expect(body()).toHaveAttribute('data-section', 'product_images')
  })

  it('says it could not load the product, with a Retry that asks the controller again, and only the way out in the header', async () => {
    const user = userEvent.setup()
    const props = makeProps({ product: undefined, productState: { loading: false, product: null, error: ['Product not found'] } })
    render(shell(props))
    expect(screen.getByText('Product not found')).toBeInTheDocument()
    expect(nav()).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(props.getProduct).toHaveBeenCalledTimes(1)
  })

  it('says a generic line when the error has no text', () => {
    render(shell(makeProps({ product: undefined, productState: { loading: false, product: null, error: [] } })))
    expect(screen.getByText('We couldn\'t load this product.')).toBeInTheDocument()
  })

  it('a Reload over a loaded product keeps the editor and marks it busy', () => {
    const product = makeProduct()
    render(shell(makeProps({ productState: { loading: true, product, error: null } })))
    expect(panel()).toHaveAttribute('aria-busy', 'true')
    expect(nav()).not.toBeNull()
    expect(screen.getByRole('switch', { name: 'Enable Cheese Burger' })).toBeInTheDocument()
  })
})

describe('ProductDetails shell · on a phone', () => {
  const realMatchMedia = window.matchMedia
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

  beforeEach(() => {
    setWidth(390)
    window.matchMedia = (query) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 390 })
  })

  afterEach(() => {
    window.matchMedia = realMatchMedia
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
    else delete HTMLElement.prototype.clientWidth
  })

  it('the Overview keeps the whole list of sections (not a selector)', () => {
    render(shell(makeProps()))
    expect(panel().querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'list')
    expect(within(nav()).getByRole('button', { name: 'Product video' })).toBeInTheDocument()
  })

  it('with a section open the list becomes the compact selector, and the tabs of Product details are a row of buttons above the content', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Information')
    expect(panel().querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
    const tabs = screen.getByRole('navigation', { name: 'Product details' })
    expect(within(tabs).getAllByRole('button').map(button => button.textContent)).toEqual(['Information', 'Advanced', 'Labels', 'Categories', 'SEO Options'])
    expect(within(tabs).getByRole('button', { name: 'Information' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('button', { name: 'Advanced' })).not.toHaveAttribute('aria-current')
    // the row is above the body
    expect(tabs.compareDocumentPosition(body()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(within(tabs).getByRole('button', { name: 'Labels' }))
    expect(body()).toHaveAttribute('data-tab', 'labels')
    expect(within(screen.getByRole('navigation', { name: 'Product details' })).getByRole('button', { name: 'Labels' })).toHaveAttribute('aria-current', 'page')
    expect(mocks.addQuery).toHaveBeenLastCalledWith({ section: 'product_details', tab: 'labels' })
  })

  it('has no row of tabs for the other sections, and none on a wider window', () => {
    render(shell(makeProps(), '/stores/products/fast-bite?section=ingredients'))
    expect(screen.queryByRole('navigation', { name: 'Product details' })).toBeNull()
    expect(body()).toHaveAttribute('data-section', 'ingredients')
    window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })
    act(() => setWidth(1280))
    const wide = render(shell(makeProps(), '/stores/products/fast-bite?section=product_details&tab=advanced'))
    expect(wide.container.querySelector('.odc-pe-tabs')).toBeNull()
  })
})

// redesign bugs T (Q-T5): at 390 the panel covers the catalogue, so what is behind it is out of the tab order
describe('ProductDetails shell · modal when it covers the screen', () => {
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
    expect(panel()).toHaveAttribute('data-size', 'full')
    expect(behind).toHaveAttribute('inert')
    expect(panel()).toHaveAttribute('role', 'dialog')
    expect(panel()).toHaveAttribute('aria-modal', 'true')
    unmount()
    expect(behind).not.toHaveAttribute('inert')
  })

  it('at 1440 the Overview is not modal', () => {
    setWidth(1440)
    render(shell(makeProps()))
    expect(panel()).toHaveAttribute('data-size', 'base')
    expect(behind).not.toHaveAttribute('inert')
    expect(panel()).not.toHaveAttribute('aria-modal')
    expect(panel()).not.toHaveAttribute('role', 'dialog')
  })
})
