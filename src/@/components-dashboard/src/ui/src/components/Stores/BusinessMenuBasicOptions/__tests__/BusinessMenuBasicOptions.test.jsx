/* eslint-disable import/first */
// redesign stores 5.5b: the «Basic» tab of a menu rebuilt on the Product pieces. One column: name, order types, schedule,
// comments and products (search, expand all, count). Saving is the P/SaveBar; a blank name or a new menu without products never reaches
// the API. The controller functions are stand-ins; the category tree node is the real one.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: { general_hour_format: { value: 'HH:mm' } } }]
}))
vi.mock('../../../../../../contexts/UtilsContext', () => ({
  useUtils: () => [{ parseDate: () => '' }]
}))

import { BusinessMenuBasicOptions } from '../index'

const lapse = (openHour, closeHour) => ({
  open: { hour: openHour, minute: 0 },
  close: { hour: closeHour, minute: closeHour === 23 ? 59 : 0 }
})
const week = (openHour = 9, closeHour = 17) => Array.from({ length: 7 }, () => ({ enabled: true, lapses: [lapse(openHour, closeHour)] }))
const defaultWeek = () => week(0, 23)

// Mains has rank 2 and comes first in the array on purpose: the tree sorts a COPY, so Drinks (rank 1) is drawn first.
const buildBusiness = () => ({
  id: 7,
  categories: [
    { id: 1, name: 'Mains', rank: 2, products: [{ id: 11, name: 'Cheese Burger' }, { id: 12, name: 'Pasta' }], subcategories: [] },
    { id: 2, name: 'Drinks', rank: 1, products: [{ id: 21, name: 'Cola' }], subcategories: [] }
  ]
})
const SUBCATEGORIES = [
  { id: 1, name: 'Mains', productIds: [11, 12], isChecked: false },
  { id: 2, name: 'Drinks', productIds: [21], isChecked: false }
]

const buildProps = (overrides = {}) => ({
  business: buildBusiness(),
  businessMenuState: { loading: false, error: null, menu: { id: 5, name: 'Lunch', comment: 'Weekdays', delivery: true, use_business_schedule: true, all_products: false, schedule: week() } },
  formState: { loading: false, changes: {}, error: null },
  pendingChangeKeys: [],
  isDirty: false,
  discardChanges: vi.fn(),
  handleChangeInput: vi.fn(),
  handleCheckOrderType: vi.fn(),
  handleChangeScheduleState: vi.fn(),
  handleUpdateBusinessMenuOption: vi.fn().mockResolvedValue({ ok: true }),
  handleAddBusinessMenuOption: vi.fn().mockResolvedValue({ ok: true }),
  selectedProductsIds: [],
  setSelectedProductsIds: vi.fn(),
  selectedProducts: [],
  setSelectedProducts: vi.fn(),
  subCategoriesList: SUBCATEGORIES,
  ...overrides
})

// a menu with unsaved changes
const dirtyProps = (changes = { name: 'Lunch 2' }, overrides = {}) => buildProps({
  formState: { loading: false, changes, error: null },
  pendingChangeKeys: Object.keys(changes),
  isDirty: true,
  ...overrides
})

// a menu that does not exist yet
const newMenuProps = (changes = { name: 'Brunch' }, overrides = {}) => buildProps({
  businessMenuState: { loading: false, error: null, menu: {} },
  formState: { loading: false, changes, error: null },
  pendingChangeKeys: Object.keys(changes),
  isDirty: true,
  ...overrides
})

const tree = (props) => (
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <BusinessMenuBasicOptions {...props} />
  </ThemeProvider>
)
const renderTab = (props) => {
  const view = render(tree(props))
  return { ...view, rerenderWith: (next) => view.rerender(tree(next)) }
}
const bar = () => screen.queryByRole('group', { name: 'Save changes' })
const nameInput = () => screen.getByRole('textbox', { name: /Menu name/ })
const expander = (name) => screen.getByRole('button', { name })

afterEach(() => cleanup())

describe('BusinessMenuBasicOptions · fields', () => {
  it('shows the saved name, the order types, the schedule heading, the comment and the products heading', () => {
    renderTab(buildProps())
    expect(nameInput().value).toBe('Lunch')
    expect(screen.getByRole('group', { name: 'Order types' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Comments' }).value).toBe('Weekdays')
    expect(screen.getByRole('heading', { name: 'Products' })).toBeTruthy()
  })

  it('marks the name as required for assistive tech', () => {
    renderTab(buildProps())
    expect(nameInput().getAttribute('aria-required')).toBe('true')
    expect(screen.getByText('Required')).toBeTruthy()
  })

  it('sends the name the user types to the controller', () => {
    const props = buildProps()
    renderTab(props)
    fireEvent.change(nameInput(), { target: { value: 'Dinner' } })
    expect(props.handleChangeInput).toHaveBeenCalledWith({ target: { name: 'name', value: 'Dinner' } })
  })

  it('prefers the pending name over the saved one', () => {
    renderTab(dirtyProps({ name: 'Lunch 2' }))
    expect(nameInput().value).toBe('Lunch 2')
  })

  it('lists the 8 order types as checkboxes with their state', () => {
    renderTab(buildProps())
    const group = screen.getByRole('group', { name: 'Order types' })
    const boxes = within(group).getAllByRole('checkbox')
    expect(boxes.map(box => box.textContent)).toEqual([
      'Delivery', 'Pickup', 'Eat in', 'Curbside', 'Drive thru', 'Catering delivery', 'Catering pickup', 'reservation'
    ])
    expect(within(group).getByRole('checkbox', { name: 'Delivery' }).getAttribute('aria-checked')).toBe('true')
    expect(within(group).getByRole('checkbox', { name: 'Pickup' }).getAttribute('aria-checked')).toBe('false')
  })

  it('unchecks a type that is checked on the menu with ONE click, through handleChangeInput', () => {
    const props = buildProps({
      businessMenuState: { loading: false, error: null, menu: { id: 5, name: 'Lunch', catering_delivery: true, use_business_schedule: true } }
    })
    renderTab(props)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Catering delivery' }))
    expect(props.handleChangeInput).toHaveBeenCalledTimes(1)
    expect(props.handleChangeInput).toHaveBeenCalledWith({ target: { name: 'catering_delivery', value: false } })
    expect(props.handleCheckOrderType).not.toHaveBeenCalled()
  })

  it('reads a pending type over the saved one', () => {
    renderTab(dirtyProps({ delivery: false }))
    expect(screen.getByRole('checkbox', { name: 'Delivery' }).getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the comment controlled: it shows what the form says and reports every edit', () => {
    const props = dirtyProps({ comment: 'Hello' })
    const { rerenderWith } = renderTab(props)
    const comment = screen.getByRole('textbox', { name: 'Comments' })
    expect(comment.value).toBe('Hello')
    expect(comment.getAttribute('placeholder')).toBe('Write here')
    fireEvent.change(comment, { target: { value: 'Hello!' } })
    expect(props.handleChangeInput).toHaveBeenCalledWith({ target: { name: 'comment', value: 'Hello!' } })
    rerenderWith(dirtyProps({ comment: 'Hello world' }))
    expect(screen.getByRole('textbox', { name: 'Comments' }).value).toBe('Hello world')
  })
})

describe('BusinessMenuBasicOptions · schedule', () => {
  const ownSchedule = (overrides = {}) => buildProps({
    businessMenuState: { loading: false, error: null, menu: { id: 5, name: 'Lunch', use_business_schedule: false, schedule: week(9, 17) } },
    ...overrides
  })
  const openHours = () => Array.from(document.querySelectorAll('select[data-boundary="open"][data-unit="hour"]')).map(select => Number(select.value))

  it('hides the editor while the menu uses the business schedule', () => {
    renderTab(buildProps())
    expect(screen.getByRole('checkbox', { name: 'Use business schedule' }).getAttribute('aria-checked')).toBe('true')
    expect(openHours()).toEqual([])
  })

  it('toggles the business schedule through handleChangeInput', () => {
    const props = buildProps()
    renderTab(props)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use business schedule' }))
    expect(props.handleChangeInput).toHaveBeenCalledWith({ target: { name: 'use_business_schedule', value: false } })
  })

  it('shows the editor with the saved week when the menu has its own schedule', () => {
    renderTab(ownSchedule())
    expect(openHours()).toEqual([9, 9, 9, 9, 9, 9, 9])
  })

  it('starts the editor from the pending schedule, so hiding and showing it again keeps the edits', () => {
    renderTab(ownSchedule({ formState: { loading: false, changes: { schedule: week(7, 20) }, error: null }, pendingChangeKeys: ['schedule'] }))
    expect(openHours()).toEqual([7, 7, 7, 7, 7, 7, 7])
  })

  it('reads the saved schedule again after Discard (the editor is remounted)', () => {
    const dirty = ownSchedule({ formState: { loading: false, changes: { schedule: week(7, 20) }, error: null }, pendingChangeKeys: ['schedule'], isDirty: true })
    const { rerenderWith } = renderTab(dirty)
    expect(openHours()[0]).toBe(7)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Discard' }))
    expect(dirty.discardChanges).toHaveBeenCalledTimes(1)
    rerenderWith(ownSchedule())
    expect(openHours()).toEqual([9, 9, 9, 9, 9, 9, 9])
  })
})

describe('BusinessMenuBasicOptions · saving', () => {
  it('has no save bar when a saved menu opens with nothing pending', () => {
    renderTab(buildProps())
    expect(bar()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('shows the bar with the count once something changes, and Save updates the menu', async () => {
    const props = dirtyProps({ name: 'Lunch 2' })
    const { rerenderWith } = renderTab(props)
    const group = bar()
    expect(within(group).getByText(/1 unsaved change/)).toBeTruthy()
    fireEvent.click(within(group).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(props.handleUpdateBusinessMenuOption).toHaveBeenCalledTimes(1))
    expect(props.handleAddBusinessMenuOption).not.toHaveBeenCalled()
    // the controller clears the changes once it has saved them: the bar then says «Saved»
    rerenderWith(buildProps())
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
  })

  it('counts every pending change of the menu, in the plural', () => {
    renderTab(dirtyProps({ name: 'Lunch 2', comment: 'x', pickup: true }))
    expect(within(bar()).getByText(/3 unsaved changes/)).toBeTruthy()
  })

  it('does not call the API with a blank name: it says so and puts the focus on the name', async () => {
    const props = dirtyProps({ name: '   ' })
    renderTab(props)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('The name is required.')).toBeTruthy())
    expect(props.handleUpdateBusinessMenuOption).not.toHaveBeenCalled()
    expect(props.handleAddBusinessMenuOption).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(nameInput())
    expect(nameInput().getAttribute('aria-invalid')).toBe('true')
  })

  it('shows no name error before an attempt, and clears it as soon as the name is not blank', async () => {
    const props = dirtyProps({ name: '' })
    const { rerenderWith } = renderTab(props)
    expect(screen.queryByText('The name is required.')).toBeNull()
    fireEvent.click(within(bar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('The name is required.')).toBeTruthy())
    rerenderWith(dirtyProps({ name: 'Dinner' }))
    expect(screen.queryByText('The name is required.')).toBeNull()
  })

  it('does not add a new menu without products: it shows the products notice', async () => {
    const props = newMenuProps({ name: 'Brunch' })
    renderTab(props)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByText('You have not selected any product for the menu')).toBeTruthy())
    expect(props.handleAddBusinessMenuOption).not.toHaveBeenCalled()
    expect(props.handleUpdateBusinessMenuOption).not.toHaveBeenCalled()
  })

  it('adds a new menu with a name and selected products', async () => {
    const props = newMenuProps({ name: 'Brunch', products: [11] }, { selectedProductsIds: [11] })
    renderTab(props)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(props.handleAddBusinessMenuOption).toHaveBeenCalledTimes(1))
    expect(props.handleUpdateBusinessMenuOption).not.toHaveBeenCalled()
    expect(screen.queryByText('You have not selected any product for the menu')).toBeNull()
  })

  it('adds a new menu with All products and no selection', async () => {
    const props = newMenuProps({ name: 'Brunch', all_products: true })
    renderTab(props)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(props.handleAddBusinessMenuOption).toHaveBeenCalledTimes(1))
  })

  it('does not count the schedule the editor seeds on a new menu, but counts one the user changed', () => {
    renderTab(newMenuProps({ name: 'Brunch', schedule: defaultWeek() }))
    expect(within(bar()).getByText(/1 unsaved change/)).toBeTruthy()
    cleanup()
    renderTab(newMenuProps({ name: 'Brunch', schedule: week(8, 12) }))
    expect(within(bar()).getByText(/2 unsaved changes/)).toBeTruthy()
  })

  it('counts the schedule on a saved menu even when it equals the default week', () => {
    renderTab(dirtyProps({ schedule: defaultWeek() }))
    expect(within(bar()).getByText(/1 unsaved change/)).toBeTruthy()
  })

  it('shows the error of a failed save with Retry, and Retry saves again', async () => {
    const props = dirtyProps({ name: 'Lunch 2' }, {
      handleUpdateBusinessMenuOption: vi.fn()
        .mockResolvedValueOnce({ ok: false, error: ['The menu is locked'] })
        .mockResolvedValueOnce({ ok: true })
    })
    const { rerenderWith } = renderTab(props)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The menu is locked'))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(props.handleUpdateBusinessMenuOption).toHaveBeenCalledTimes(2))
    rerenderWith(buildProps())
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
  })

  it('falls back to a generic message when the API gives none', async () => {
    const props = dirtyProps({ name: 'Lunch 2' }, { handleUpdateBusinessMenuOption: vi.fn().mockResolvedValue({ ok: false }) })
    renderTab(props)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("We couldn't save the change."))
  })

  it('turns a thrown error into the failed state', async () => {
    const props = dirtyProps({ name: 'Lunch 2' }, { handleUpdateBusinessMenuOption: vi.fn().mockRejectedValue(new Error('Network down')) })
    renderTab(props)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Network down'))
  })

  it('sends one request for a double click', async () => {
    let finish
    const pending = new Promise(resolve => { finish = resolve })
    const props = dirtyProps({ name: 'Lunch 2' }, { handleUpdateBusinessMenuOption: vi.fn().mockReturnValue(pending) })
    renderTab(props)
    const save = within(bar()).getByRole('button', { name: 'Save' })
    fireEvent.click(save)
    fireEvent.click(save)
    expect(props.handleUpdateBusinessMenuOption).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ok: true }) })
  })

  it('Discard asks the controller to drop the pending changes and clears the errors', async () => {
    const props = dirtyProps({ name: '' })
    renderTab(props)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('The name is required.')).toBeTruthy())
    fireEvent.click(within(bar()).getByRole('button', { name: 'Discard' }))
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('The name is required.')).toBeNull()
  })
})

describe('BusinessMenuBasicOptions · products', () => {
  it('shows no tree and no toolbar with All products on, and toggles it through handleChangeInput', () => {
    const props = buildProps({
      businessMenuState: { loading: false, error: null, menu: { id: 5, name: 'Lunch', all_products: true, use_business_schedule: true } }
    })
    renderTab(props)
    expect(screen.getByRole('checkbox', { name: 'All products' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('searchbox', { name: 'Search products' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mains' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'All products' }))
    expect(props.handleChangeInput).toHaveBeenCalledWith({ target: { name: 'all_products', value: false } })
  })

  it('draws the categories sorted by rank without sorting the prop in place', () => {
    const props = buildProps()
    const before = props.business.categories.map(category => category.id)
    renderTab(props)
    expect(props.business.categories.map(category => category.id)).toEqual(before)
    expect(screen.getAllByRole('button', { name: /^(Mains|Drinks)$/ }).map(button => button.getAttribute('aria-label'))).toEqual(['Drinks', 'Mains'])
  })

  it('renders no tree and does not throw when the business has no categories', () => {
    expect(() => renderTab(buildProps({ business: { id: 7 }, subCategoriesList: [] }))).not.toThrow()
    expect(screen.queryByRole('button', { name: 'Mains' })).toBeNull()
    expect(screen.getByText('0 of 0 products selected')).toBeTruthy()
    cleanup()
    expect(() => renderTab(buildProps({ business: undefined, subCategoriesList: [] }))).not.toThrow()
  })

  it('counts the selected products that exist in the tree, in a polite live region', () => {
    renderTab(buildProps({ selectedProductsIds: [11, 21, 999] }))
    const count = screen.getByText('2 of 3 products selected')
    expect(count.closest('[aria-live="polite"]')).toBeTruthy()
  })

  it('starts collapsed and opens every category with Expand all, then closes them with Collapse all', () => {
    renderTab(buildProps())
    expect(expander('Mains').getAttribute('aria-expanded')).toBe('false')
    expect(expander('Drinks').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(expander('Mains').getAttribute('aria-expanded')).toBe('true')
    expect(expander('Drinks').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(expander('Mains').getAttribute('aria-expanded')).toBe('false')
    expect(expander('Drinks').getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeTruthy()
  })

  it('lets the user open one category on its own', () => {
    renderTab(buildProps())
    fireEvent.click(expander('Mains'))
    expect(expander('Mains').getAttribute('aria-expanded')).toBe('true')
    expect(expander('Drinks').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(expander('Mains'))
    expect(expander('Mains').getAttribute('aria-expanded')).toBe('false')
  })

  it('searches products ignoring case: only the matching products show and their category opens', () => {
    renderTab(buildProps())
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: '  BURG ' } })
    expect(screen.getByRole('checkbox', { name: 'Cheese Burger' })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Pasta' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Cola' })).toBeNull()
    expect(expander('Mains').getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Drinks' })).toBeNull()
    // searching opens what matches: no Expand all while it lasts
    expect(screen.queryByRole('button', { name: 'Expand all' })).toBeNull()
  })

  it('shows all the products of a category whose name matches', () => {
    renderTab(buildProps())
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: 'mains' } })
    expect(screen.getByRole('checkbox', { name: 'Cheese Burger' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Pasta' })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Cola' })).toBeNull()
  })

  it('says so when no product matches, and clearing the search brings the tree back collapsed', () => {
    renderTab(buildProps())
    const search = screen.getByRole('searchbox', { name: 'Search products' })
    fireEvent.change(search, { target: { value: 'sushi' } })
    expect(screen.getByText('No products match your search.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mains' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.queryByText('No products match your search.')).toBeNull()
    expect(expander('Mains').getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeTruthy()
  })

  it('clears the search on Discard', () => {
    const props = dirtyProps({ name: 'Lunch 2' })
    renderTab(props)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: 'sushi' } })
    fireEvent.click(within(bar()).getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('searchbox', { name: 'Search products' }).value).toBe('')
    expect(screen.queryByText('No products match your search.')).toBeNull()
  })
})

describe('BusinessMenuBasicOptions · the category index is its own (reload with ?menu=)', () => {
  it('draws the categories and counts them although the controller list is still empty', () => {
    renderTab(buildProps({ subCategoriesList: [] }))
    expect(expander('Mains')).toBeTruthy()
    expect(expander('Drinks')).toBeTruthy()
    expect(screen.getByText('0 of 3 products selected')).toBeTruthy()
  })

  it('opens every category with Expand all although the controller list is empty', () => {
    renderTab(buildProps({ subCategoriesList: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(expander('Mains').getAttribute('aria-expanded')).toBe('true')
    expect(expander('Drinks').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeTruthy()
  })

  it('draws the tree when the categories arrive after the first render', () => {
    const { rerenderWith } = renderTab(buildProps({ business: { id: 7 }, subCategoriesList: [] }))
    expect(screen.queryByRole('button', { name: 'Mains' })).toBeNull()
    rerenderWith(buildProps({ subCategoriesList: [] }))
    expect(expander('Mains')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(expander('Drinks').getAttribute('aria-expanded')).toBe('true')
  })

  it('selects a whole category from its own index, with the products of its subcategories', () => {
    const props = buildProps({
      subCategoriesList: [],
      business: {
        id: 7,
        categories: [{ id: 1, name: 'Mains', rank: 1, products: [{ id: 11, name: 'Burger' }], subcategories: [{ id: 3, name: 'Pasta', products: [{ id: 31, name: 'Penne' }] }] }]
      }
    })
    renderTab(props)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mains' }))
    expect(props.setSelectedProductsIds).toHaveBeenLastCalledWith([11, 31])
  })
})

describe('BusinessMenuBasicOptions · validationAttempt (the leave guard\'s Save)', () => {
  it('shows the name error and focuses the name when the counter goes up on a blank name', async () => {
    const props = dirtyProps({ name: '   ' })
    const { rerenderWith } = renderTab({ ...props, validationAttempt: 0 })
    expect(screen.queryByText('The name is required.')).toBeNull()
    rerenderWith({ ...props, validationAttempt: 1 })
    await waitFor(() => expect(screen.getByText('The name is required.')).toBeTruthy())
    await waitFor(() => expect(document.activeElement).toBe(nameInput()))
    expect(props.handleUpdateBusinessMenuOption).not.toHaveBeenCalled()
  })

  it('shows the products notice for a new menu without products, and does not focus a name that is fine', async () => {
    const props = newMenuProps({ name: 'Brunch' })
    const { rerenderWith } = renderTab({ ...props, validationAttempt: 0 })
    rerenderWith({ ...props, validationAttempt: 1 })
    await waitFor(() => expect(screen.getByText('You have not selected any product for the menu')).toBeTruthy())
    expect(screen.queryByText('The name is required.')).toBeNull()
    expect(document.activeElement).not.toBe(nameInput())
  })

  it('does nothing on mount or while the counter stays at 0', () => {
    renderTab({ ...dirtyProps({ name: '' }), validationAttempt: 0 })
    expect(screen.queryByText('The name is required.')).toBeNull()
    cleanup()
    renderTab(dirtyProps({ name: '' }))
    expect(screen.queryByText('The name is required.')).toBeNull()
  })

  it('marks again on every new attempt', async () => {
    const props = dirtyProps({ name: '' })
    const { rerenderWith } = renderTab({ ...props, validationAttempt: 1 })
    await waitFor(() => expect(screen.getByText('The name is required.')).toBeTruthy())
    fireEvent.click(within(bar()).getByRole('button', { name: 'Discard' }))
    expect(screen.queryByText('The name is required.')).toBeNull()
    rerenderWith({ ...props, validationAttempt: 2 })
    await waitFor(() => expect(screen.getByText('The name is required.')).toBeTruthy())
  })
})
