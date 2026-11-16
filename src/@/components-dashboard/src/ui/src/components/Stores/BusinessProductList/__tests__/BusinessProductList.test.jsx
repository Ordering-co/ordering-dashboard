/* eslint-disable import/first */
// redesign SP-F3 (C): the products of /stores/products. A table with one <tbody> per product (the controller of each row wraps it), the
// cards of a phone, the column manager, the Enabled switch of M-12 (busy, back and a notice when it fails), the thumbnail as a button
// with the filter of main, the drag only with a category chosen, the states of today and Product's Pagination. The controller of the
// row is a stand-in with the contract that matters here (it hands the UI the product, the form state and the handlers); the rest is real.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  phone: false,
  toggle: null,
  update: null,
  changeImage: null,
  saveImage: null, // J2 row 12: the controller's save-on-pick (null: a controller without it)
  drop: null,
  dragStart: null,
  editId: null, // the product whose image waits to be saved
  gate: null
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils: () => [{ parsePrice: value => `$${Number(value).toFixed(2)}`, optimizeImage: src => src }],
    // the controller of a row: the product, the form state (`changes` is filled from the product) and the handlers
    SingleBusinessProduct: ({ UIComponent, ...props }) => react.createElement(UIComponent, {
      ...props,
      productFormState: { changes: { ...props.product }, loading: false, result: { error: false } },
      handleChangeProductActive: (value) => mockState.toggle(value, props.product),
      handleUpdateClick: () => mockState.update(),
      handlechangeImage: (file) => mockState.changeImage(file, props.product),
      handleSaveImage: mockState.saveImage ? (file) => mockState.saveImage(file, props.product) : undefined,
      isEditMode: mockState.editId === props.product.id,
      handleDragStart: mockState.dragStart,
      handleDragOver: (event) => {
        event.preventDefault()
        const element = event.target.closest('.draggable-product')
        if (element) props.setDataSelected(element.dataset.index)
      },
      handleDrop: (event) => mockState.drop(event, props.product),
      handleDragEnd: () => props.setDataSelected(''),
      handleMoveProduct: async () => ({ ok: true }),
      isProductsBottom: false
    })
  }
})
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))
vi.mock('../../../Shared', () => ({
  SideBar: ({ children }) => <div data-testid='product-add-sidebar'>{children}</div>
}))
vi.mock('../../BusinessSpreadSheet', () => ({ BusinessSpreadSheet: () => <div data-testid='sheet' /> }))
vi.mock('../../BusinessProductAddForm', () => ({ BusinessProductAddForm: () => <div data-testid='add-form' /> }))

import { BusinessProductList } from '../index'

const BURGER = { id: 5, category_id: 3, name: 'Burger', description: 'Beef, cheese and pickles', price: 9.5, cost_price: 4, enabled: true, rank: 1, images: 'burger.png', fee: { fixed: 1, percentage: 5 }, tax: { rate: 7, type: 1 } }
const FRIES = { id: 6, category_id: 3, name: 'Fries', description: '', price: 3, enabled: false, rank: 2, fee: { fixed: 0, percentage: 0 }, tax: { rate: 7, type: 2 } }

const BUSINESS = { id: 1, service_fee: 10, categories: [{ id: 3, name: 'Mains' }] }
const CATEGORY_STATE = (products = [BURGER, FRIES], extra = {}) => ({
  loading: false,
  products,
  pagination: { currentPage: 1, totalItems: 34, ...extra }
})

const draw = (props = {}) => {
  const handlers = {
    handleOpenProductDetails: vi.fn(),
    handleParentProductAdd: vi.fn(),
    handleChangeSearch: vi.fn(),
    handleSearchRedirect: vi.fn(),
    getPageProducts: vi.fn(),
    setProductsPerPage: vi.fn()
  }
  const all = {
    viewMethod: 'list',
    businessState: { loading: false, business: BUSINESS },
    categoryState: CATEGORY_STATE(),
    categorySelected: { id: 3, name: 'Mains', subcategories: [] },
    productsPerPage: 10,
    searchValue: '',
    errorQuantityProducts: false,
    ...handlers,
    ...props
  }
  const utils = render(<BusinessProductList {...all} />)
  return { ...utils, ...handlers, props: all, rerenderWith: (next) => utils.rerender(<BusinessProductList {...all} {...next} />) }
}

const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent.trim())
const rowOf = (name) => screen.getByRole('row', { name: new RegExp(name) })

beforeEach(() => {
  mockState.saveImage = null
  mockState.phone = false
  mockState.editId = null
  mockState.gate = null
  mockState.toggle = vi.fn(async () => ({ ok: true }))
  mockState.update = vi.fn(async () => ({ ok: true }))
  mockState.changeImage = vi.fn()
  mockState.drop = vi.fn(async () => ({ ok: true }))
  mockState.dragStart = vi.fn()
})

describe('BusinessProductList — the table', () => {
  // J2 row 11 (stores-products P-13, D-46 b): Price comes before Description, so the price is in view at 1024 without scrolling
  it('is a named region that scrolls, with the six columns of main and Enabled, and one <tbody> per product', () => {
    const { container } = draw()
    const region = screen.getByRole('region', { name: 'Products' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(within(region).getByRole('table', { name: 'Products' })).toBeInTheDocument()
    expect(headers()).toEqual(['Products', 'Enabled', 'Price', 'Description', 'Product cost', 'Tax', 'Fee'])
    expect(container.querySelectorAll('table > tbody')).toHaveLength(2)
    expect(container.querySelectorAll('table > thead')).toHaveLength(1)
  })

  it('draws the product: name as a button, description in one line with its title, price and cost as figures, tax and fee as in main', () => {
    draw()
    const row = rowOf('Burger')
    expect(within(row).getByRole('button', { name: 'Burger' })).toBeInTheDocument()
    const description = within(row).getByText('Beef, cheese and pickles')
    expect(description).toHaveAttribute('title', 'Beef, cheese and pickles')
    expect(within(row).getByText('$9.50')).toHaveClass('odc-figure')
    expect(within(row).getByText('$4.00')).toHaveClass('odc-figure')
    expect(within(row).getByText('7%')).toHaveClass('odc-figure')
    expect(row).toHaveTextContent('(Included on price)')
    expect(within(row).getByText('$1.00 + 5%')).toHaveClass('odc-figure')
    expect(within(rowOf('Fries'))).toBeTruthy()
    expect(rowOf('Fries')).toHaveTextContent('(Not included on price)')
  })

  // redesign tanda AE (owner decision 37): Enabled pinned at the end covered whatever column ran under it at scroll 0
  // (Tax at 1440, Description at 912). It now sits right after Products and is pinned with it, so nothing is covered.
  it('pins Products and then Enabled at the start while the rest scrolls, with nothing pinned at the end (decision 37)', () => {
    const { container } = draw()
    expect(screen.getByRole('columnheader', { name: 'Products' })).toHaveAttribute('data-sticky', 'start')
    expect(screen.getByRole('columnheader', { name: 'Enabled' })).toHaveAttribute('data-sticky', 'status')
    expect(screen.getAllByRole('columnheader').map(cell => cell.textContent.trim()).slice(0, 3)).toEqual(['Products', 'Enabled', 'Price'])
    const row = rowOf('Burger')
    expect(within(row).getByRole('rowheader')).toHaveAttribute('data-sticky', 'start')
    const status = within(row).getAllByRole('cell')[0]
    expect(status).toHaveAttribute('data-sticky', 'status')
    expect(within(status).getByRole('switch')).toBeInTheDocument()
    expect(container.querySelector("[data-sticky='end']")).toBeNull()
  })

  it('reads and tabs in the order it is drawn: the product, its switch and its menu, then the other columns (decision 37)', () => {
    draw()
    const row = rowOf('Burger')
    const focusable = [...row.querySelectorAll('button, input, [role="switch"]')].filter(element => !element.closest('[aria-hidden="true"]'))
    const cellOf = element => element.closest('th, td')
    const cells = [...new Set(focusable.map(cellOf))]
    // the product cell (thumbnail, name), then the status cell (switch, menu); nothing of the other columns comes before them
    expect(cells[0]).toBe(within(row).getByRole('rowheader'))
    expect(cells[1]).toHaveAttribute('data-sticky', 'status')
    expect(within(cells[1]).getByRole('switch')).toBeInTheDocument()
    expect(within(cells[1]).getAllByRole('button').length).toBeGreaterThanOrEqual(1)
  })

  it('keeps the end shadow off a classic scrollbar: the frame learns the scrollbar sizes of the region (review finding 4)', () => {
    const size = (name, value) => vi.spyOn(HTMLElement.prototype, name, 'get').mockImplementation(function () {
      return this.classList?.contains('odc-cp-scroll') ? value : 0
    })
    const spies = [size('offsetWidth', 1015), size('clientWidth', 1000), size('offsetHeight', 515), size('clientHeight', 500)]
    try {
      const { container } = draw()
      const frame = container.querySelector('.odc-cp-frame')
      expect(frame.style.getPropertyValue('--odc-cp-bar-inline')).toBe('15px')
      expect(frame.style.getPropertyValue('--odc-cp-bar-block')).toBe('15px')
    } finally {
      spies.forEach(spy => spy.mockRestore())
    }
    const css = readFileSync(resolve(__dirname, '../catalog-products.css'), 'utf8')
    const edge = css.match(/\.odc-cp-frame:has\(> \.odc-cp-scroll\[data-overflow-end\]\)::after \{([^}]*)\}/g).join('\n')
    expect(edge).toMatch(/inset-inline-end:\s*var\(--odc-cp-bar-inline, 0\)/)
    expect(edge).toMatch(/inset-block-end:\s*var\(--odc-cp-bar-block, 0\)/)
  })

  it('starts Enabled where Products ends, measured from the pinned header (decision 37)', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const width = this.matches?.("th[data-sticky='start']") ? 342 : 0
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }
    })
    try {
      draw()
      expect(screen.getByRole('table').style.getPropertyValue('--odc-cp-pin')).toBe('342px')
    } finally {
      rect.mockRestore()
    }
  })

  it('sorts by rank, as main did, without changing the array the controller holds', () => {
    const products = [FRIES, BURGER]
    draw({ categoryState: CATEGORY_STATE(products) })
    const names = screen.getAllByRole('rowheader').map(cell => cell.textContent.trim())
    expect(names).toEqual(['Burger', 'Fries'])
    expect(products[0]).toBe(FRIES)
  })
})

describe('BusinessProductList — opening a product', () => {
  it('opens from the name button once, and from the rest of the row', async () => {
    const user = userEvent.setup()
    const { handleOpenProductDetails } = draw()
    await user.click(within(rowOf('Burger')).getByRole('button', { name: 'Burger' }))
    expect(handleOpenProductDetails).toHaveBeenCalledTimes(1)
    expect(handleOpenProductDetails).toHaveBeenCalledWith(BURGER)
    await user.click(within(rowOf('Fries')).getAllByRole('cell')[0])
    expect(handleOpenProductDetails).toHaveBeenCalledTimes(2)
    expect(handleOpenProductDetails).toHaveBeenLastCalledWith(FRIES)
  })

  it('does not open from the Enabled switch, the thumbnail or the notice of a failed save', async () => {
    const user = userEvent.setup()
    mockState.toggle = vi.fn(async () => ({ ok: false, error: ['Nope'] }))
    const { handleOpenProductDetails } = draw()
    const row = rowOf('Burger')
    await user.click(within(row).getByRole('switch', { name: 'Enable Burger' }))
    await user.click(within(row).getByRole('button', { name: 'Change image of Burger' }))
    await user.click(await screen.findByRole('alert'))
    expect(handleOpenProductDetails).not.toHaveBeenCalled()
  })

  it('marks the open product: the row, and the name as the current one', () => {
    const { container } = draw({ productDetailsId: 6 })
    expect(container.querySelector('tbody[data-index="6"]')).toHaveAttribute('data-active')
    expect(container.querySelector('tbody[data-index="5"]')).not.toHaveAttribute('data-active')
    expect(within(rowOf('Fries')).getByRole('button', { name: 'Fries' })).toHaveAttribute('aria-current', 'true')
  })
})

describe('BusinessProductList — the Enabled switch (M-12)', () => {
  it('is named «Enable <product>» and shows the stored value', () => {
    draw()
    expect(screen.getByRole('switch', { name: 'Enable Burger' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Enable Fries' })).not.toBeChecked()
  })

  it('is busy while it saves, shows the value being saved, and ignores a second press', async () => {
    const user = userEvent.setup()
    let release
    mockState.toggle = vi.fn(() => new Promise(resolve => { release = () => resolve({ ok: true }) }))
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Burger' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(mockState.toggle).toHaveBeenCalledTimes(1)
    expect(mockState.toggle).toHaveBeenCalledWith(false, BURGER)
    await act(async () => { release() })
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'))
  })

  it('shows the new value once the page holds the product that changed', async () => {
    const user = userEvent.setup()
    const view = draw()
    await user.click(screen.getByRole('switch', { name: 'Enable Burger' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable Burger' })).not.toHaveAttribute('aria-busy'))
    view.rerenderWith({ categoryState: CATEGORY_STATE([{ ...BURGER, enabled: false }, FRIES]) })
    expect(screen.getByRole('switch', { name: 'Enable Burger' })).not.toBeChecked()
  })

  it('goes back to the stored value and says why in the row when the save fails', async () => {
    const user = userEvent.setup()
    mockState.toggle = vi.fn(async () => ({ ok: false, error: ['The product cannot be disabled'] }))
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Burger' })
    await user.click(toggle)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The product cannot be disabled')
    expect(toggle).toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy')
  })

  it('says the generic sentence when the API gave no text, and clears it on the next try', async () => {
    const user = userEvent.setup()
    mockState.toggle = vi.fn(async () => ({ ok: false }))
    draw()
    await user.click(screen.getByRole('switch', { name: 'Enable Burger' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the change.")
    mockState.toggle = vi.fn(async () => ({ ok: true }))
    await user.click(screen.getByRole('switch', { name: 'Enable Burger' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

describe('BusinessProductList — the thumbnail', () => {
  const fileInput = (row) => row.querySelector('input[type="file"]')

  it('is a button named after the product; it opens the file chooser, which takes png and jpg', async () => {
    const user = userEvent.setup()
    draw()
    const row = rowOf('Burger')
    const button = within(row).getByRole('button', { name: 'Change image of Burger' })
    expect(button.querySelector('img')).toHaveAttribute('src', 'burger.png')
    expect(fileInput(row)).toHaveAttribute('accept', 'image/png, image/jpeg, image/jpg')
    const click = vi.spyOn(fileInput(row), 'click')
    await user.click(button)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('draws an icon, not a broken image, for a product without one', () => {
    draw()
    const button = within(rowOf('Fries')).getByRole('button', { name: 'Change image of Fries' })
    expect(button.querySelector('img')).toBeNull()
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('hands a png to the controller', () => {
    draw()
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(fileInput(rowOf('Burger')), { target: { files: [file] } })
    expect(mockState.changeImage).toHaveBeenCalledWith(file, BURGER)
  })

  it('refuses a file that is not an image, in the row', () => {
    draw()
    const file = new File(['x'], 'notes.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput(rowOf('Burger')), { target: { files: [file] } })
    expect(mockState.changeImage).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Only images can be accepted')
  })

  it('refuses an image over 2 MB, in the row', () => {
    draw()
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 })
    fireEvent.change(fileInput(rowOf('Burger')), { target: { files: [big] } })
    expect(mockState.changeImage).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('The maximum image size is 2 megabytes')
  })

  it('takes a file dropped on it', () => {
    draw()
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.drop(within(rowOf('Burger')).getByRole('button', { name: 'Change image of Burger' }), { dataTransfer: { files: [file] } })
    expect(mockState.changeImage).toHaveBeenCalledWith(file, BURGER)
  })

  // J2 row 12 (stores-products P-10, D-56 d): with the controller's save-on-pick the image is saved when it is chosen
  it('saves the image when it is chosen, not with a later click, and says why in the row when it fails', async () => {
    mockState.saveImage = vi.fn(async () => ({ ok: false, error: ['Image is too large'] }))
    const { container } = draw()
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(fileInput(rowOf('Burger')), { target: { files: [file] } })
    expect(mockState.saveImage).toHaveBeenCalledWith(file, BURGER)
    expect(mockState.changeImage).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Image is too large')
    expect(container.querySelector('tbody[data-index="5"]')).toContainElement(screen.getByRole('alert'))
  })

  it('saves with the next click outside the row, as main did, and says so when it fails', async () => {
    const user = userEvent.setup()
    mockState.editId = 5
    mockState.update = vi.fn(async () => ({ ok: false, error: ['Image is too large'] }))
    const { container } = draw()
    await user.click(document.body)
    expect(mockState.update).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('alert')).toHaveTextContent('Image is too large')
    expect(container.querySelector('tbody[data-index="5"]')).toContainElement(screen.getByRole('alert')) // under the product, not elsewhere
  })

  it('does not listen to clicks while nothing waits to be saved', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    draw()
    expect(add.mock.calls.filter(([type]) => type === 'click')).toEqual([])
    add.mockRestore()
  })
})

describe('BusinessProductList — the column manager', () => {
  const openManager = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    return screen.findByRole('dialog')
  }

  it('offers the six columns of main, all shown, and not Enabled', async () => {
    const user = userEvent.setup()
    draw()
    const dialog = await openManager(user)
    expect(within(dialog).getAllByRole('checkbox').map(box => box.getAttribute('aria-checked') ?? String(box.checked))).toEqual(Array(6).fill('true'))
    expect(within(dialog).getAllByRole('checkbox').map(box => box.closest('li').textContent)).toEqual([
      expect.stringContaining('Products'),
      expect.stringContaining('Price'),
      expect.stringContaining('Description'),
      expect.stringContaining('Product cost'),
      expect.stringContaining('Tax'),
      expect.stringContaining('Fee')
    ])
  })

  it('locks Products, which holds the way to open a product (n.º 12, D-46 a): always shown, its box cannot change', async () => {
    const user = userEvent.setup()
    draw()
    const dialog = await openManager(user)
    const products = within(dialog).getByRole('checkbox', { name: 'Products' })
    expect(products).toBeDisabled()
    expect(products.closest('li')).toHaveTextContent('Always shown')
    expect(within(dialog).getAllByText('Always shown')).toHaveLength(1)
    await user.click(products)
    expect(headers()[0]).toBe('Products')
  })

  it('hides a column in the header and in every row, and Reset brings it back', async () => {
    const user = userEvent.setup()
    draw()
    const dialog = await openManager(user)
    await user.click(within(dialog).getByRole('checkbox', { name: 'Tax' }))
    expect(headers()).toEqual(['Products', 'Enabled', 'Price', 'Description', 'Product cost', 'Fee'])
    expect(rowOf('Burger')).not.toHaveTextContent('Included on price')
    await user.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers()).toEqual(['Products', 'Enabled', 'Price', 'Description', 'Product cost', 'Tax', 'Fee'])
  })

  it('follows the order the manager sets', async () => {
    const user = userEvent.setup()
    draw()
    const dialog = await openManager(user)
    await user.click(within(dialog).getByRole('button', { name: 'Move Fee up' }))
    expect(headers()).toEqual(['Products', 'Enabled', 'Price', 'Description', 'Product cost', 'Fee', 'Tax'])
    expect(within(rowOf('Burger')).getAllByRole('cell').map(cell => cell.textContent.trim()).slice(-2)[0]).toContain('$1.00 + 5%')
  })

  it('with Products no longer first, nothing is pinned to the start', async () => {
    const user = userEvent.setup()
    draw()
    const dialog = await openManager(user)
    await user.click(within(dialog).getByRole('button', { name: 'Move Products down' }))
    expect(screen.getByRole('columnheader', { name: 'Products' })).not.toHaveAttribute('data-sticky')
    expect(screen.getByRole('columnheader', { name: 'Description' })).not.toHaveAttribute('data-sticky')
    // decision 37: Enabled goes with Products wherever it is, unpinned with it
    expect(headers()).toEqual(['Price', 'Products', 'Enabled', 'Description', 'Product cost', 'Tax', 'Fee'])
    expect(screen.getByRole('columnheader', { name: 'Enabled' })).not.toHaveAttribute('data-sticky')
  })
})

describe('BusinessProductList — dragging to sort', () => {
  it('draws the grip only with a category chosen and no subcategory that holds products', () => {
    const { container, unmount } = draw()
    expect(container.querySelectorAll('.odc-cp-grip')).toHaveLength(2)
    expect(container.querySelector('tbody.draggable-product')).not.toBeNull()
    unmount()

    const all = draw({ categorySelected: null })
    expect(all.container.querySelectorAll('.odc-cp-grip')).toHaveLength(0) // «All products»: the rank would be written among categories
    expect(all.container.querySelector('tbody.draggable-product')).toBeNull()
    all.unmount()

    const withSub = draw({ categorySelected: { id: 3, subcategories: [{ id: 4, products: [{ id: 9 }] }] } })
    expect(withSub.container.querySelectorAll('.odc-cp-grip')).toHaveLength(0)
  })

  it('starts the drag on the grip with the product, and a drop on a row goes to the controller', async () => {
    const { container } = draw()
    const grip = container.querySelector('tbody[data-index="5"] .odc-cp-grip')
    fireEvent.dragStart(grip, { dataTransfer: { setData: () => {} } })
    expect(mockState.dragStart).toHaveBeenCalledWith(expect.anything(), BURGER)
    fireEvent.drop(container.querySelector('tbody[data-index="6"]'), { dataTransfer: { getData: () => '' } })
    await waitFor(() => expect(mockState.drop).toHaveBeenCalledWith(expect.anything(), FRIES))
  })

  it('says in the target row why a drop did not go through', async () => {
    mockState.drop = vi.fn(async () => ({ ok: false, error: ['Rank is not valid'] }))
    const { container } = draw()
    fireEvent.drop(container.querySelector('tbody[data-index="6"]'), { dataTransfer: { getData: () => '' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Rank is not valid')
  })

  it('marks the row a product is dragged over, and clears it when the drag ends', () => {
    const { container } = draw()
    const target = container.querySelector('tbody[data-index="6"]')
    fireEvent.dragOver(target.querySelector('td'))
    expect(target).toHaveAttribute('data-accept')
    expect(container.querySelector('tbody[data-index="5"]')).not.toHaveAttribute('data-accept')
    fireEvent.dragEnd(target)
    expect(target).not.toHaveAttribute('data-accept')
  })

  it('a row that cannot be a target does not take drops (a file dragged over «All products»)', () => {
    const { container } = draw({ categorySelected: null })
    fireEvent.drop(container.querySelector('tbody[data-index="6"]'), { dataTransfer: { getData: () => '' } })
    expect(mockState.drop).not.toHaveBeenCalled()
  })
})

describe('BusinessProductList — the states', () => {
  it('draws skeleton rows while it loads', () => {
    const { container } = draw({ categoryState: { ...CATEGORY_STATE(), loading: true } })
    expect(container.querySelectorAll('tbody[data-skeleton]')).toHaveLength(10)
    expect(screen.getByText('Loading')).toHaveClass('odc-sr-only')
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
  })

  it('with no category yet, says to create one, and offers neither the table nor «Add new product»', () => {
    draw({ businessState: { loading: false, business: { ...BUSINESS, categories: [] } }, categoryState: CATEGORY_STATE([]), categorySelected: null })
    expect(screen.getByText('Please create a category before adding your products.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add new product' })).toBeNull()
  })

  it('with categories and none chosen, keeps the message of main under the list', () => {
    draw({ categorySelected: null })
    expect(screen.getByText('Please select a category before adding your products.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add new product' })).toBeNull()
  })

  it('says there are no products, and with a search offers to clear it', async () => {
    const user = userEvent.setup()
    const view = draw({ categoryState: CATEGORY_STATE([]) })
    expect(screen.getByText('No products found at this time')).toBeInTheDocument()
    view.unmount()

    const searched = draw({ categoryState: CATEGORY_STATE([]), searchValue: 'pizza' })
    expect(screen.getByText('No products found, please change filters.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(searched.handleChangeSearch).toHaveBeenCalledWith('')
  })

  it('«Add new product» is there with a category chosen and at least one category, and starts the form', async () => {
    const user = userEvent.setup()
    const { handleParentProductAdd } = draw()
    await user.click(screen.getByRole('button', { name: 'Add new product' }))
    expect(handleParentProductAdd).toHaveBeenCalledWith(true)
  })

  it('mounts the form of a new product in a side bar when the page asks for it', () => {
    draw({ isParentProductAdd: true })
    expect(screen.getByTestId('product-add-sidebar')).toContainElement(screen.getByTestId('add-form'))
  })
})

describe('BusinessProductList — pages', () => {
  it('shows «Showing 1–10 of 34» and asks for the next page of the same size', async () => {
    const user = userEvent.setup()
    const { getPageProducts } = draw()
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–10 of 34')
    expect(within(nav).getByText('34')).toHaveClass('odc-figure')
    await user.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(getPageProducts).toHaveBeenCalledWith(true, 2, 10)
  })

  it('changes the size and keeps the first product in view (10, 25 or 50)', async () => {
    const user = userEvent.setup()
    const { getPageProducts, setProductsPerPage } = draw({ categoryState: CATEGORY_STATE(undefined, { currentPage: 3 }), productsPerPage: 10 })
    await user.click(screen.getByRole('button', { name: 'Items per page 10' }))
    expect((await screen.findAllByRole('menuitemradio')).map(item => item.textContent)).toEqual(['10', '25', '50'])
    await user.click(screen.getByRole('menuitemradio', { name: '25' }))
    expect(setProductsPerPage).toHaveBeenCalledWith(25)
    expect(getPageProducts).toHaveBeenCalledWith(true, 1, 25) // item 21 of 34 sits on page 1 of 25
  })

  it('draws no pages when there are no products, and none while the store loads', () => {
    const view = draw({ categoryState: CATEGORY_STATE([]) })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    view.unmount()
    draw({ businessState: { loading: true, business: BUSINESS } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })
})

describe('BusinessProductList — a phone', () => {
  beforeEach(() => { mockState.phone = true })

  it('draws one card per product with what the row shows, and no table or column manager', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
    const list = screen.getByRole('list', { name: 'Products' })
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    const burger = cards[0]
    expect(within(burger).getByRole('button', { name: 'Burger' })).toBeInTheDocument()
    expect(within(burger).getByRole('button', { name: 'Change image of Burger' })).toBeInTheDocument()
    expect(within(burger).getByText('Beef, cheese and pickles')).toBeInTheDocument()
    const facts = Object.fromEntries([...burger.querySelectorAll('dl > div')].map(item => [item.querySelector('dt').textContent, item.querySelector('dd').textContent]))
    expect(facts).toEqual({ Price: '$9.50', 'Product cost': '$4.00', Tax: '7% (Included on price)', Fee: '$1.00 + 5%' })
    // (tanda AK): the visible text is the state, «Enabled», as the column of the table and the stores cards (AB S-4)
    expect(within(burger).getByRole('switch', { name: 'Enable Burger' })).toHaveTextContent(/^Enabled$/)
    expect(container.querySelector('.odc-cp-grip')).toBeNull() // dragging does not work by touch
    // a product without cost shows no cost line
    expect(within(cards[1]).queryByText('Product cost')).toBeNull()
  })

  it('opens from the name and from the card, but not from the switch', async () => {
    const user = userEvent.setup()
    const { handleOpenProductDetails } = draw()
    const burger = screen.getAllByRole('listitem')[0]
    await user.click(within(burger).getByRole('button', { name: 'Burger' }))
    expect(handleOpenProductDetails).toHaveBeenCalledTimes(1)
    await user.click(within(burger).getByText('Beef, cheese and pickles'))
    expect(handleOpenProductDetails).toHaveBeenCalledTimes(2)
    await user.click(within(burger).getByRole('switch', { name: 'Enable Burger' }))
    expect(handleOpenProductDetails).toHaveBeenCalledTimes(2)
  })

  it('says a failed save inside the card, and keeps the pages under the cards', async () => {
    const user = userEvent.setup()
    mockState.toggle = vi.fn(async () => ({ ok: false, error: ['Nope'] }))
    draw()
    await user.click(screen.getByRole('switch', { name: 'Enable Burger' }))
    expect(within(screen.getAllByRole('listitem')[0]).getByRole('alert')).toHaveTextContent('Nope')
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  })

  it('draws skeleton cards while it loads', () => {
    const { container } = draw({ categoryState: { ...CATEGORY_STATE(), loading: true } })
    expect(container.querySelectorAll('li[data-skeleton]')).toHaveLength(10)
  })
})

describe('BusinessProductList — the spreadsheet', () => {
  it('keeps BusinessSpreadSheet in its place, with no table, no column manager and no pages of the list', () => {
    draw({ viewMethod: 'spreedsheet', allowSpreadColumns: { cost_price: true } })
    expect(screen.getByTestId('sheet')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Products' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('«Go to Businesses» is drawn only when the page gave a way to go (D14)', async () => {
    const user = userEvent.setup()
    const empty = { viewMethod: 'spreedsheet', categoryState: CATEGORY_STATE([]), errorQuantityProducts: true }
    const withRedirect = draw(empty)
    expect(screen.getByText('No products found at this time')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to Businesses' }))
    expect(withRedirect.handleSearchRedirect).toHaveBeenCalledTimes(1)
    withRedirect.unmount()

    draw({ ...empty, handleSearchRedirect: undefined })
    expect(screen.getByText('No products found at this time')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go to Businesses' })).toBeNull()
  })

  it('with a search, offers «Clear filters»', async () => {
    const user = userEvent.setup()
    const view = draw({ viewMethod: 'spreedsheet', categoryState: CATEGORY_STATE([]), searchValue: 'pizza', errorQuantityProducts: false })
    expect(screen.getByText('No products found, please change filters.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(view.handleChangeSearch).toHaveBeenCalledWith('')
  })
})

// J2 review H2 / H3 (row 9): Move up / Move down only know the products of the page that is loaded, and only the results of a search
describe('BusinessProductList — Move up / Move down at the edges of a page and with a search', () => {
  const openActions = async (user, name) => {
    await user.click(screen.getByRole('button', { name: `More actions for ${name}` }))
    return screen.findByRole('menu')
  }

  it('the first product of page 2 cannot move up and says why; the last of a page with more after it, the same down', async () => {
    const user = userEvent.setup()
    draw({ categoryState: { ...CATEGORY_STATE(), pagination: { currentPage: 2, pageSize: 2, totalItems: 6, totalPages: 3 } }, productsPerPage: 2 })
    let menu = await openActions(user, 'Burger')
    const up = within(menu).getByRole('menuitem', { name: /Move up/ })
    expect(up).toHaveAttribute('aria-disabled', 'true')
    expect(up).toHaveAccessibleDescription('It is the first on this page. Show more per page to move it up.')
    await user.keyboard('{Escape}')
    menu = await openActions(user, 'Fries')
    const down = within(menu).getByRole('menuitem', { name: /Move down/ })
    expect(down).toHaveAttribute('aria-disabled', 'true')
    expect(down).toHaveAccessibleDescription('It is the last on this page. Show more per page to move it down.')
  })

  it('on a single page the first and the last just cannot move, with no note', async () => {
    const user = userEvent.setup()
    draw()
    const menu = await openActions(user, 'Burger')
    expect(within(menu).getByRole('menuitem', { name: 'Move up' })).not.toHaveAccessibleDescription()
  })

  it('while the category is searched there is no Move up / Move down: the results are not the whole order', () => {
    draw({ searchValue: 'bur' })
    expect(screen.queryByRole('button', { name: 'More actions for Burger' })).toBeNull()
  })
})

// Products and Enabled are pinned; the middle scrolls under them. Under Enabled, «Tax» was half covered and «Fee» unseen, with
// no sign that the region scrolls (the native bar shows only after a touch). The region says on which side there is more (the overflow
// edges every sideways scroller of Product reports) and the pinned column draws its inner edge then; a cell that does not fit ends in «…».
describe('BusinessProductList — the pinned columns and the sideways scroll', () => {
  const css = readFileSync(resolve(__dirname, '../catalog-products.css'), 'utf8')

  const scrollGeometry = (region, { scrollWidth, clientWidth, scrollLeft }) => {
    Object.defineProperty(region, 'scrollWidth', { configurable: true, value: scrollWidth })
    Object.defineProperty(region, 'clientWidth', { configurable: true, value: clientWidth })
    Object.defineProperty(region, 'scrollLeft', { configurable: true, value: scrollLeft })
    fireEvent.scroll(region)
  }

  it('marks the region with the side that has more to show, as the user scrolls (and clears it at the end)', () => {
    draw()
    const region = screen.getByRole('region', { name: 'Products' })
    scrollGeometry(region, { scrollWidth: 1500, clientWidth: 1000, scrollLeft: 0 })
    expect(region).toHaveAttribute('data-overflow-end')
    expect(region).not.toHaveAttribute('data-overflow-start')
    scrollGeometry(region, { scrollWidth: 1500, clientWidth: 1000, scrollLeft: 200 })
    expect(region).toHaveAttribute('data-overflow-start')
    expect(region).toHaveAttribute('data-overflow-end')
    scrollGeometry(region, { scrollWidth: 1500, clientWidth: 1000, scrollLeft: 500 })
    expect(region).toHaveAttribute('data-overflow-start')
    expect(region).not.toHaveAttribute('data-overflow-end')
    scrollGeometry(region, { scrollWidth: 1000, clientWidth: 1000, scrollLeft: 0 })
    expect(region).not.toHaveAttribute('data-overflow-start')
    expect(region).not.toHaveAttribute('data-overflow-end')
  })

  it('the pinned column draws its inner edge only on the side with hidden content, in logical directions (right-to-left needs no second set)', () => {
    // decision 37: the start edge is drawn by the last pinned cell (Enabled); the end edge by the frame of the region, since nothing is
    // pinned at the end any more
    expect(css).toMatch(/\.odc-cp-scroll\[data-overflow-start\] \[data-sticky='status'\]::after/)
    expect(css).toMatch(/\.odc-cp-frame:has\(> \.odc-cp-scroll\[data-overflow-end\]\)::after/)
    expect(css).not.toMatch(/\[data-sticky='end'\]/)
    expect(css).toMatch(/\.odc-cp-frame:dir\(rtl\)/)
    expect(css).toMatch(/inset-inline-(start|end):\s*100%/)
    expect(css).toMatch(/var\(--od-x-edge-shadow\)/)
  })

  it('a plain cell that does not fit ends in an ellipsis, and the notice row (which sticks) is not clipped', () => {
    const rule = css.match(/\.odc-cp-row > tr:not\(\.odc-cp-notice-row\) > td:not\(\[data-sticky\]\):not\(:has\(button, input, a\)\) \{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/text-overflow:\s*ellipsis/)
    expect(rule[1]).toMatch(/overflow:\s*hidden/)
    expect(rule[1]).toMatch(/max-inline-size:/)
  })
})

// redesign tanda AB (C-4): /stores/products at 1440 had the column manager flush to the right edge of the viewport, and the
// pinned «Enabled» column covered the text of «Tax» with nothing that set it apart. jsdom does not lay out, so this pins the rules.
describe('BusinessProductList — the right margin and the pinned column apart (C-4)', () => {
  const css = readFileSync(resolve(__dirname, '../catalog-products.css'), 'utf8')
  const rule = (selector) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1]

  it('the column manager keeps the same margin as the content has at its start (the page gutter), not the edge of the viewport', () => {
    expect(rule('.odc-cp-tools')).toMatch(/padding-inline-end:\s*var\(--od-x-page-gutter\)/)
  })

  it('the pinned Enabled column is opaque and always draws its inner edge, so it reads as a column of its own', () => {
    // tanda AE (decision 37): pinned after Products, at the width Products measures, with its edge on the scrolling side
    const status = rule(".odc-cp-table [data-sticky='status']")
    expect(status).toMatch(/position:\s*sticky/)
    expect(status).toMatch(/inset-inline-start:\s*var\(--odc-cp-pin, 0\)/)
    expect(status).toMatch(/border-inline-end:\s*var\(--od-x-hairline\) solid var\(--od-border\)/)
    expect(rule('.odc-cp-row')).toMatch(/--odc-cp-row-bg:\s*var\(--od-bg\)/)
  })

  it('the column after the pinned ones keeps room from them, so its text does not start on the pinned edge', () => {
    expect(rule(".odc-cp-table [data-sticky='status'] + :where(th, td)")).toMatch(/padding-inline-start:\s*var\(--od-x-page-gutter\)/)
  })
})
