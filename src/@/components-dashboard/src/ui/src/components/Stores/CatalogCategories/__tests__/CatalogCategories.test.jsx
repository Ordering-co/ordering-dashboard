/* eslint-disable import/first */
// redesign SP-FB: the category tree of /stores/products, with the REAL SingleBusinessCategory controller (each row mounts
// one, as S/SingleBusinessSubCateogries did) over a simulated API. What the rows promise: «All products» first; categories and
// subcategories by rank; the name is a native button that selects and expands; a chevron expands without selecting; a drag handle
// on every row; the Enable switch is controlled, busy while it saves, and when the save fails goes back to the stored value and says
// why (M-12); no listener on `window` (SP-13); the chosen row is scrolled into view (SP-11).
import React, { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  saves: [], // { businessId, categoryId, params }
  response: null, // what save() resolves to: { content: { error, result } }; null = echo the params as a success
  throws: null,
  gate: null, // a promise the save waits for, to look at the switch while it is busy
  toasts: [],
  session: { loading: false }
}))

vi.mock('../../../../../../index', async () => {
  const { SingleBusinessCategory } = await vi.importActual('../../../../../../components/SingleBusinessCategory')
  return {
    SingleBusinessCategory,
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useToast: () => [{}, { showToast: (type, message) => mockState.toasts.push([type, message]), hideToast: () => mockState.toasts.push(['hide']) }]
  }
})
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [mockState.session] }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ dictionary: {} }, (_key, text) => text] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  useToast: () => [{}, { showToast: (type, message) => mockState.toasts.push([type, message]), hideToast: () => mockState.toasts.push(['hide']) }]
}))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{
    businesses: (businessId) => ({
      categories: (categoryId) => ({
        save: async (params) => {
          mockState.saves.push({ businessId, categoryId, params })
          if (mockState.gate) await mockState.gate
          if (mockState.throws) throw mockState.throws
          return mockState.response ?? { content: { error: false, result: { id: categoryId, ...params, name: findName(categoryId) } } }
        }
      })
    })
  }]
}))

import { CatalogCategories } from '../index'

const makeBusiness = () => ({
  id: 5,
  name: 'Sample Burgers',
  categories: [
    {
      id: 20,
      name: 'Drinks',
      rank: 2,
      enabled: true,
      subcategories: [
        { id: 202, name: 'Cold', rank: 2, enabled: true, subcategories: [] },
        { id: 201, name: 'Hot', rank: 1, enabled: true, subcategories: [{ id: 2011, name: 'Tea', rank: 1, enabled: true, subcategories: [] }] }
      ]
    },
    { id: 10, name: 'Burgers', rank: 1, enabled: true, subcategories: [] },
    { id: 30, name: 'Retired', rank: 3, enabled: false, subcategories: [{ id: 301, name: 'Old', rank: 1, enabled: true, subcategories: [] }] }
  ]
})

let findName
const names = (business) => {
  const walk = (list) => list.flatMap(c => [c, ...walk(c.subcategories || [])])
  const all = Object.fromEntries(walk(business.categories).map(c => [c.id, c.name]))
  findName = (id) => all[id]
}

// Page stand-in: owns the business and the selection like BusinessProductsListing does, and gives the tree its props.
const Page = ({ initialBusiness, initialSelected = null, loading = false, spies = {} }) => {
  const [business, setBusiness] = useState(initialBusiness)
  const [categorySelected, setSelected] = useState(initialSelected)
  return (
    <CatalogCategories
      businessState={{ loading, business }}
      categorySelected={categorySelected}
      onClickCategory={(event, category) => {
        spies.onClickCategory?.(event, category)
        setSelected(category)
      }}
      handleOpenCategoryDetails={(...args) => spies.handleOpenCategoryDetails?.(...args)}
      handleUpdateBusinessState={(next) => { spies.handleUpdateBusinessState?.(next); setBusiness(next) }}
      setCategorySelected={setSelected}
      setCurrentCategory={(category) => spies.setCurrentCategory?.(category)}
      openCategories={{ values: [] }}
    />
  )
}

const draw = (props = {}) => {
  const business = makeBusiness()
  names(business)
  return { business, ...render(<Page initialBusiness={business} {...props} />) }
}

beforeEach(() => {
  mockState.saves = []
  mockState.response = null
  mockState.throws = null
  mockState.gate = null
  mockState.toasts = []
  mockState.session = { loading: false }
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  delete Element.prototype.scrollIntoView
})

const rowOf = (name) => screen.getByRole('button', { name }).closest('.odc-cc-row')

describe('CatalogCategories — the tree', () => {
  it('heads the tree with «Categories», «Add new category» and «All products» as the first row, chosen when nothing is', () => {
    const handleOpenCategoryDetails = vi.fn()
    draw({ spies: { handleOpenCategoryDetails } })
    expect(screen.getByRole('heading', { level: 2, name: 'Categories' })).toBeInTheDocument()
    const first = screen.getAllByRole('button').find(button => button.classList.contains('odc-cc-name'))
    expect(first).toHaveTextContent('All products')
    expect(first).toHaveAttribute('aria-current', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Add new category' }))
    expect(handleOpenCategoryDetails).toHaveBeenCalledTimes(1)
    expect(handleOpenCategoryDetails).toHaveBeenCalledWith() // main called it with no argument
  })

  it('lists the categories by rank and the subcategories by rank under their parent, one level deeper', async () => {
    draw()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Expand Drinks' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Expand Hot' }))
    const labels = [...document.querySelectorAll('.odc-cc-label')].map(node => node.textContent)
    expect(labels).toEqual(['All products', 'Burgers', 'Drinks', 'Hot', 'Tea', 'Cold', 'Retired', 'Old'])
    const depth = (name) => rowOf(name).getAttribute('data-depth')
    expect([depth('Burgers'), depth('Hot'), depth('Tea')]).toEqual(['0', '1', '2'])
  })

  it('shows six skeleton rows while the business loads, announced, with no category button', () => {
    draw({ loading: true })
    expect(document.querySelectorAll('.odc-cc-item[data-skeleton]')).toHaveLength(6)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(document.querySelector('.odc-cc-list')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Burgers' })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })
})

describe('CatalogCategories — selecting', () => {
  it('selects with the click on the name, as the row did: onClickCategory(event, category) and setCurrentCategory(category)', async () => {
    const onClickCategory = vi.fn()
    const setCurrentCategory = vi.fn()
    const { business } = draw({ spies: { onClickCategory, setCurrentCategory } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Burgers' }))
    expect(onClickCategory).toHaveBeenCalledTimes(1)
    expect(onClickCategory.mock.calls[0][1]).toBe(business.categories[1])
    expect(onClickCategory.mock.calls[0][0]).toHaveProperty('target')
    expect(setCurrentCategory).toHaveBeenCalledWith(business.categories[1])
    expect(screen.getByRole('button', { name: 'Burgers' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'All products' })).not.toHaveAttribute('aria-current')
  })

  it('«All products» is onClickCategory(null, null), what a click on the margin did', async () => {
    const onClickCategory = vi.fn()
    draw({ initialSelected: { id: 10 }, spies: { onClickCategory } })
    expect(screen.getByRole('button', { name: 'Burgers' })).toHaveAttribute('aria-current', 'true')
    await userEvent.setup().click(screen.getByRole('button', { name: 'All products' }))
    expect(onClickCategory).toHaveBeenCalledWith(null, null)
    expect(screen.getByRole('button', { name: 'All products' })).toHaveAttribute('aria-current', 'true')
  })

  it('reaches every button with Tab, in reading order', async () => {
    const user = userEvent.setup()
    draw()
    const seen = []
    for (let i = 0; i < 4; i += 1) {
      await user.tab()
      seen.push(document.activeElement.getAttribute('aria-label') || document.activeElement.textContent)
    }
    expect(seen).toEqual(['Add new category', 'All products', 'Burgers', 'Enable Burgers'])
  })

  it('scrolls the chosen row into view, nearest, when the choice changes (SP-11)', async () => {
    draw()
    Element.prototype.scrollIntoView.mockClear()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Burgers' }))
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' }))
    expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(screen.getByRole('button', { name: 'Burgers' }))
  })

  it('listens to no click on window (SP-13): a click outside the tree changes nothing', async () => {
    const onClickCategory = vi.fn()
    draw({ initialSelected: { id: 10 }, spies: { onClickCategory } })
    await userEvent.setup().click(document.body)
    expect(onClickCategory).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Burgers' })).toHaveAttribute('aria-current', 'true')
  })
})

describe('CatalogCategories — subcategories', () => {
  it('starts folded; the chevron expands and folds without selecting, with aria-expanded and aria-controls', async () => {
    const onClickCategory = vi.fn()
    const user = userEvent.setup()
    draw({ spies: { onClickCategory } })
    const chevron = screen.getByRole('button', { name: 'Expand Drinks' })
    expect(chevron).toHaveAttribute('aria-expanded', 'false')
    const list = document.getElementById(chevron.getAttribute('aria-controls'))
    expect(list).toHaveAttribute('hidden')
    expect(screen.queryByRole('button', { name: 'Hot' })).toBeNull() // hidden rows are out of the tab order and of the tree
    await user.click(chevron)
    expect(screen.getByRole('button', { name: 'Collapse Drinks' })).toHaveAttribute('aria-expanded', 'true')
    expect(list).not.toHaveAttribute('hidden')
    expect(screen.getByRole('button', { name: 'Hot' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse Drinks' }))
    expect(list).toHaveAttribute('hidden')
    expect(onClickCategory).not.toHaveBeenCalled()
  })

  it('a click on the name of an enabled category selects it and expands it, as toggleAccordion did', async () => {
    draw()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Drinks' }))
    expect(screen.getByRole('button', { name: 'Drinks' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Collapse Drinks' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Hot' })).toBeInTheDocument()
  })

  it('a disabled category selects but does not expand, and its chevron is disabled', async () => {
    draw()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retired' }))
    expect(screen.getByRole('button', { name: 'Retired' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Expand Retired' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Old' })).toBeNull()
  })

  it('a chosen subcategory opens its parents, so its row can be scrolled to', () => {
    draw({ initialSelected: { id: 2011 } })
    expect(screen.getByRole('button', { name: 'Tea' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Collapse Drinks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse Hot' })).toBeInTheDocument()
  })
})

describe('CatalogCategories — drag to reorder (the controller of each row)', () => {
  it('every row, subcategories too, has the handle, the draggable-category class and the id', () => {
    draw()
    const expand = userEvent.setup()
    return expand.click(screen.getByRole('button', { name: 'Expand Drinks' })).then(() => {
      const rows = [...document.querySelectorAll('.odc-cc-row.draggable-category')]
      expect(rows.map(row => row.dataset.index)).toEqual(['10', '20', '201', '2011', '202', '30', '301'])
      rows.forEach(row => {
        const grip = row.querySelector('.odc-cc-grip')
        expect(grip).toHaveAttribute('draggable', 'true')
        expect(grip).toHaveAttribute('aria-hidden', 'true')
      })
    })
  })

  it('highlights the row being dragged over, and clears it at the end of the drag', () => {
    draw()
    const row = rowOf('Burgers')
    fireEvent.dragOver(row)
    expect(row).toHaveAttribute('data-accept')
    expect(rowOf('Drinks')).not.toHaveAttribute('data-accept')
    fireEvent.dragEnd(row)
    expect(row).not.toHaveAttribute('data-accept')
  })

  it('drops by saving the rank of the dragged category at the rank of the row (the controller keeps that behaviour)', async () => {
    const spies = { handleUpdateBusinessState: vi.fn() }
    draw({ spies })
    const burgers = rowOf('Burgers')
    const dataTransfer = { data: {}, setData (k, v) { this.data[k] = v }, getData (k) { return this.data[k] }, setDragImage: vi.fn() }
    fireEvent.dragStart(rowOf('Drinks').querySelector('.odc-cc-grip'), { dataTransfer })
    fireEvent.dragOver(burgers, { dataTransfer })
    fireEvent.drop(burgers, { dataTransfer })
    await waitFor(() => expect(mockState.saves).toHaveLength(1))
    // the drag started on Drinks (id 20) and dropped on Burgers (rank 1); the API echoes the params
    expect(mockState.saves[0]).toEqual({ businessId: 5, categoryId: 20, params: { rank: 1 } })
    fireEvent.dragEnd(burgers)
  })
})

describe('CatalogCategories — the Enable switch', () => {
  it('is named «Enable <category>» and shows the stored value', () => {
    draw()
    expect(screen.getByRole('switch', { name: 'Enable Burgers' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Enable Retired' })).not.toBeChecked()
  })

  it('saves {enabled} with the real controller, tells the page, and does not select the row', async () => {
    const spies = { onClickCategory: vi.fn(), handleUpdateBusinessState: vi.fn() }
    draw({ spies })
    const toggle = screen.getByRole('switch', { name: 'Enable Burgers' })
    await userEvent.setup().click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(mockState.saves).toEqual([{ businessId: 5, categoryId: 10, params: { enabled: false } }])
    expect(spies.handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    expect(spies.handleUpdateBusinessState.mock.calls[0][0].categories.find(c => c.id === 10).enabled).toBe(false)
    expect(spies.onClickCategory).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('is busy while it saves, shows the value being saved, and ignores a second press', async () => {
    const user = userEvent.setup()
    let release
    mockState.gate = new Promise(resolve => { release = resolve })
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Burgers' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(mockState.saves).toHaveLength(1)
    await act(async () => { release() })
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'))
    expect(toggle).not.toBeChecked()
  })

  it('folds an expanded category when it is disabled', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('button', { name: 'Drinks' }))
    expect(screen.getByRole('button', { name: 'Hot' })).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Enable Drinks' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hot' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Expand Drinks' })).toBeDisabled()
  })

  it('M-12: an API error goes back to the stored value and says why in the row, translated', async () => {
    const user = userEvent.setup()
    mockState.response = { content: { error: true, result: ['Internal error'] } }
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Burgers' })
    await user.click(toggle)
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Internal error')
    expect(toggle).toBeChecked() // back to the stored value, not left flipped
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(within(rowOf('Burgers').parentElement).getByRole('alert')).toBe(notice) // in the row of the category that failed
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('M-12: a request that throws says the short message of its own, and a new attempt clears the notice', async () => {
    const user = userEvent.setup()
    mockState.throws = new Error('')
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Burgers' })
    await user.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the change.")
    expect(toggle).toBeChecked()
    mockState.throws = null
    await user.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('M-12 on a subcategory: the notice is in its own row and its parent keeps its value', async () => {
    const user = userEvent.setup()
    mockState.response = { content: { error: true, result: ['Not allowed'] } }
    draw({ initialSelected: { id: 2011 } })
    await user.click(screen.getByRole('switch', { name: 'Enable Tea' }))
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Not allowed')
    expect(rowOf('Tea').parentElement).toContainElement(notice)
    expect(screen.getByRole('switch', { name: 'Enable Hot' })).toBeChecked()
  })
})

// redesign bugs F row 24: the Enable switch is the Product AsyncSwitch now (the row hand-rolled a copy of it).
describe('CatalogCategories — the Enable switch is the Product AsyncSwitch', () => {
  it('a network Error from the controller shows the failure text, not its raw message, and the switch goes back', async () => {
    const user = userEvent.setup()
    mockState.throws = new Error('Failed to fetch')
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Burgers' })
    await user.click(toggle)
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent("We couldn't save the change.")
    expect(notice).not.toHaveTextContent('Failed to fetch')
    expect(toggle).toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(rowOf('Burgers').parentElement).toContainElement(notice)
  })

  it('an API error text is still shown (translated), and a new press clears it', async () => {
    const user = userEvent.setup()
    mockState.response = { content: { error: true, result: ['Not allowed'] } }
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Burgers' })
    await user.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    mockState.response = null
    await user.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

// redesign bugs F, live check L-4: a failed Enable left the «Loading» toast up until it timed out (row 19's pattern); the
// row says the failure itself, so it takes «Loading» down. A success leaves the controller's «Category updated».
describe('CatalogCategories — the toast of the Enable switch (L-4)', () => {
  it('a refused save takes «Loading» down; the notice in the row says why', async () => {
    const user = userEvent.setup()
    mockState.toasts = []
    mockState.response = { content: { error: true, result: ['Not allowed'] } }
    draw()
    await user.click(screen.getByRole('switch', { name: 'Enable Burgers' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(mockState.toasts).toEqual([['info', 'Loading'], ['hide']])
  })

  it('a network error takes it down too; a success does not', async () => {
    const user = userEvent.setup()
    mockState.toasts = []
    mockState.throws = new Error('Failed to fetch')
    draw()
    await user.click(screen.getByRole('switch', { name: 'Enable Burgers' }))
    await screen.findByRole('alert')
    expect(mockState.toasts.at(-1)).toEqual(['hide'])
    mockState.throws = null
    mockState.response = null
    mockState.toasts = []
    await user.click(screen.getByRole('switch', { name: 'Enable Burgers' }))
    await waitFor(() => expect(mockState.toasts).toContainEqual(['success', 'Category updated']))
    expect(mockState.toasts).not.toContainEqual(['hide'])
  })
})

describe('CatalogCategories — the page changes the records (the assistant)', () => {
  it('redraws a row whose name, enabled or subcategories changed under it', () => {
    const business = makeBusiness()
    names(business)
    const props = { onClickCategory: () => {}, handleOpenCategoryDetails: () => {}, handleUpdateBusinessState: () => {}, setCategorySelected: () => {}, setCurrentCategory: () => {} }
    const { rerender } = render(<CatalogCategories {...props} businessState={{ business }} categorySelected={null} />)
    const next = {
      ...business,
      categories: business.categories.map(category => {
        if (category.id === 10) return { ...category, name: 'Smash burgers', enabled: false }
        if (category.id === 20) return { ...category, subcategories: [...category.subcategories, { id: 203, name: 'Juices', rank: 3, enabled: true, subcategories: [] }] }
        return category
      })
    }
    rerender(<CatalogCategories {...props} businessState={{ business: next }} categorySelected={null} />)
    expect(screen.queryByRole('button', { name: 'Burgers' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Smash burgers' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable Smash burgers' })).not.toBeChecked()
    expect(document.querySelectorAll('.odc-cc-sublist')[0].querySelectorAll(':scope > .odc-cc-item')).toHaveLength(3)
  })

  it('calls the latest handlers of the page, not the ones of the render the row was drawn in', async () => {
    const business = makeBusiness()
    names(business)
    const first = vi.fn()
    const second = vi.fn()
    const base = { handleOpenCategoryDetails: () => {}, handleUpdateBusinessState: () => {}, setCategorySelected: () => {}, setCurrentCategory: () => {} }
    const { rerender } = render(<CatalogCategories {...base} onClickCategory={first} businessState={{ business }} categorySelected={null} />)
    rerender(<CatalogCategories {...base} onClickCategory={second} businessState={{ business }} categorySelected={null} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Burgers' }))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

// redesign tanda AG ((b), «Decisión AG-1», pending the owner, built and reversible): on a phone the tree folds behind a
// button that names the chosen category, so the first product is in view without going through every category. Nothing is removed:
// opened, the tree is whole, in the flow of the page, with every action of its rows. Only choosing a leaf category or «All products»
// folds it again, and the focus goes back to the button, which now names the choice. A desktop has no button (the tests above).
describe('CatalogCategories — folded on a phone (tanda AG)', () => {
  const phone = (matches = true) => {
    window.matchMedia = vi.fn(() => ({ matches, addEventListener: () => {}, removeEventListener: () => {} }))
  }
  afterEach(() => { delete window.matchMedia })

  const list = () => document.getElementById(document.querySelector('.odc-cc-toggle').getAttribute('aria-controls'))

  it('starts folded behind a button that names «All products» and the number of categories', () => {
    phone()
    draw()
    const button = document.querySelector('.odc-cc-toggle')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveTextContent('All products')
    expect(button).toHaveTextContent('7 categories')
    expect(list()).toHaveAttribute('hidden')
    expect(screen.queryByRole('button', { name: 'Burgers' })).toBeNull()
    // the head stays: the title and «Add new category»
    expect(screen.getByRole('heading', { level: 2, name: 'Categories' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add new category' })).toBeInTheDocument()
  })

  it('names the category the page came in with (a category in the URL) and stays folded', () => {
    phone()
    const business = makeBusiness()
    names(business)
    render(<Page initialBusiness={business} initialSelected={business.categories[1]} />)
    const button = document.querySelector('.odc-cc-toggle')
    expect(button).toHaveTextContent('Burgers')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(list()).toHaveAttribute('hidden')
  })

  it('opens the whole tree with every action of its rows', async () => {
    phone()
    draw()
    const user = userEvent.setup()
    await user.click(document.querySelector('.odc-cc-toggle'))
    expect(document.querySelector('.odc-cc-toggle')).toHaveAttribute('aria-expanded', 'true')
    expect(list()).not.toHaveAttribute('hidden')
    for (const name of ['All products', 'Burgers', 'Drinks', 'Retired']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable Burgers' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Drinks' })).toBeInTheDocument()
    expect(rowOf('Burgers').querySelector('.odc-cc-grip')).not.toBeNull()
  })

  it('folds after choosing a leaf category, puts the focus back on the button and names the choice', async () => {
    phone()
    const onClickCategory = vi.fn()
    draw({ spies: { onClickCategory } })
    const user = userEvent.setup()
    await user.click(document.querySelector('.odc-cc-toggle'))
    await user.click(screen.getByRole('button', { name: 'Burgers' }))
    expect(onClickCategory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 10 }))
    const button = document.querySelector('.odc-cc-toggle')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveTextContent('Burgers')
    await waitFor(() => expect(button).toHaveFocus())
    expect(list()).toHaveAttribute('hidden')
  })

  it('folds after choosing «All products» too', async () => {
    phone()
    const business = makeBusiness()
    names(business)
    render(<Page initialBusiness={business} initialSelected={business.categories[1]} />)
    const user = userEvent.setup()
    await user.click(document.querySelector('.odc-cc-toggle'))
    await user.click(screen.getByRole('button', { name: 'All products' }))
    const button = document.querySelector('.odc-cc-toggle')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveTextContent('All products')
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('stays open when the chosen category has subcategories, and for the switch and the chevron', async () => {
    phone()
    draw()
    const user = userEvent.setup()
    await user.click(document.querySelector('.odc-cc-toggle'))
    await user.click(screen.getByRole('button', { name: 'Drinks' })) // a parent: it opens its subcategories
    expect(document.querySelector('.odc-cc-toggle')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Hot' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand Hot' }))
    expect(document.querySelector('.odc-cc-toggle')).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('switch', { name: 'Enable Burgers' }))
    await waitFor(() => expect(mockState.saves).toHaveLength(1))
    expect(document.querySelector('.odc-cc-toggle')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.dragStart(rowOf('Burgers').querySelector('.odc-cc-grip'), { dataTransfer: { setData: () => {}, getData: () => '', setDragImage: () => {} } })
    fireEvent.dragEnd(rowOf('Burgers'))
    expect(document.querySelector('.odc-cc-toggle')).toHaveAttribute('aria-expanded', 'true')
  })

  it('folds and opens again from the button', async () => {
    phone()
    draw()
    const user = userEvent.setup()
    await user.click(document.querySelector('.odc-cc-toggle'))
    await user.click(document.querySelector('.odc-cc-toggle'))
    expect(document.querySelector('.odc-cc-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(list()).toHaveAttribute('hidden')
  })

  it('has no button and no fold on a desktop', () => {
    phone(false)
    draw()
    expect(document.querySelector('.odc-cc-toggle')).toBeNull()
    expect(screen.getByRole('button', { name: 'Burgers' })).toBeInTheDocument()
  })
})
