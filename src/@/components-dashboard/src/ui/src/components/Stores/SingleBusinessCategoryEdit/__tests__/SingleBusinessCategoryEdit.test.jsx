/* eslint-disable import/first */
// redesign SP-F3 (C): the head of the chosen category on /stores/products. Image, name as an h2 (or «All»), the pencil with a name, and
// the bar of the list that the page gives as props: its search, List / Spreadsheet and, on the sheet, the batch of images and the
// columns of the sheet. Without those props there is no bar. The autosave on a click outside (a global listener per mount that never
// had anything to save) is gone.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ formState: null }))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils: () => [{ optimizeImage: src => src }],
    // the controller of the category: it hands the UI its form state
    SingleBusinessCategory: ({ UIComponent, ...props }) => react.createElement(UIComponent, {
      ...props,
      categoryFormState: mockState.formState,
      handleUpdateClick: vi.fn(),
      isEditMode: false
    })
  }
})
vi.mock('../../../Shared', () => ({
  Alert: ({ open, content, title }) => (open ? <div role='alertdialog' aria-label={title}>{[].concat(content).join(' ')}</div> : null),
  ColumnAllowSettingPopover: ({ allowColumns, optionsDefault, handleChangeAllowColumns }) => (
    <div data-testid='sheet-columns'>
      {optionsDefault.map(option => (
        <button key={option.value} type='button' aria-pressed={Boolean(allowColumns[option.value])} onClick={() => handleChangeAllowColumns(option.value)}>
          {option.content}
        </button>
      ))}
    </div>
  )
}))

import { SingleBusinessCategoryEdit } from '../index'

const CATEGORY = { id: 3, name: 'Mains' }

const draw = (props = {}) => render(
  <SingleBusinessCategoryEdit
    categorySelected={CATEGORY}
    handleOpenCategoryDetails={vi.fn()}
    {...props}
  />
)

const BAR = () => ({
  viewMethod: 'list',
  onViewMethodChange: vi.fn(),
  searchSlot: <input aria-label='Search in this category' />,
  onOpenBatchImages: vi.fn(),
  allowSpreadColumns: { cost_price: true, inventoried: false, quantity: true },
  spreadColumnOptions: [
    { value: 'cost_price', content: 'Product cost' },
    { value: 'inventoried', content: 'Inventory' },
    { value: 'quantity', content: 'Quantity' }
  ],
  handleChangeAllowSpreadColumns: vi.fn()
})

beforeEach(() => {
  mockState.formState = { changes: { image: 'mains.png' }, loading: false, result: { error: false } }
})

describe('SingleBusinessCategoryEdit — the head', () => {
  it('names the category in an h2, with its image, and the pencil opens it', async () => {
    const user = userEvent.setup()
    const handleOpenCategoryDetails = vi.fn()
    const { container } = draw({ handleOpenCategoryDetails })
    expect(screen.getByRole('heading', { level: 2, name: 'Mains' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(container.querySelector('.odc-ch-image img')).toHaveAttribute('src', 'mains.png')
    await user.click(screen.getByRole('button', { name: 'Edit Mains' }))
    expect(handleOpenCategoryDetails).toHaveBeenCalledWith(CATEGORY)
  })

  it('draws an icon, not a broken image, for a category without one', () => {
    mockState.formState = { changes: {}, loading: false, result: { error: false } }
    const { container } = draw()
    expect(container.querySelector('.odc-ch-image img')).toBeNull()
    expect(container.querySelector('.odc-ch-image svg')).not.toBeNull()
  })

  // bugs E R-5: the «all» entry is called «All products» here too, as in the tree and the catalog head
  it('with «All» (no category) it says «All products» and the pencil opens the form to add one, as in main', async () => {
    const user = userEvent.setup()
    const handleOpenCategoryDetails = vi.fn()
    draw({ categorySelected: null, handleOpenCategoryDetails })
    expect(screen.getByRole('heading', { level: 2, name: 'All products' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    expect(handleOpenCategoryDetails).toHaveBeenCalledWith(null)
  })

  it('keeps the error alert of main when the controller reports one', () => {
    mockState.formState = { changes: {}, loading: false, result: { error: true, result: ['Category not found'] } }
    draw()
    expect(screen.getByRole('alertdialog', { name: 'Category' })).toHaveTextContent('Category not found')
  })

  it('draws a skeleton and no controls while it loads', () => {
    const { container } = draw({ isSkeleton: true, ...BAR() })
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.odc-ch-bar')).toBeNull()
  })

  it('has no global click listener (the autosave of main never had anything to save)', () => {
    const add = vi.spyOn(document, 'addEventListener')
    draw()
    expect(add.mock.calls.filter(([type]) => type === 'click')).toEqual([])
    add.mockRestore()
  })
})

describe('SingleBusinessCategoryEdit — the bar of the list', () => {
  it('has no bar when the page gives nothing for it', () => {
    const { container } = draw()
    expect(container.querySelector('.odc-ch-bar')).toBeNull()
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull()
  })

  it('draws the page\'s search where the page put it', () => {
    draw({ searchSlot: BAR().searchSlot })
    expect(screen.getByRole('textbox', { name: 'Search in this category' }).closest('.odc-ch-search')).not.toBeNull()
  })

  it('switches between List and Spreadsheet, with the current one pressed', async () => {
    const user = userEvent.setup()
    const { viewMethod, onViewMethodChange } = BAR()
    draw({ viewMethod, onViewMethodChange })
    const group = screen.getByRole('group', { name: 'View' })
    expect(within(group).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Spreadsheet' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(group).getByRole('button', { name: 'Spreadsheet' }))
    expect(onViewMethodChange).toHaveBeenCalledWith('spreedsheet') // the value the listing already uses
  })

  it('on the list there is no batch of images and no columns of the sheet', () => {
    draw({ ...BAR(), viewMethod: 'list' })
    expect(screen.queryByRole('button', { name: 'Upload images in batch' })).toBeNull()
    expect(screen.queryByTestId('sheet-columns')).toBeNull()
  })

  it('on the sheet it adds «Upload images in batch» (a button with text) and the columns of the sheet', async () => {
    const user = userEvent.setup()
    const props = { ...BAR(), viewMethod: 'spreedsheet' }
    draw(props)
    await user.click(screen.getByRole('button', { name: 'Upload images in batch' }))
    expect(props.onOpenBatchImages).toHaveBeenCalledTimes(1)
    const columns = screen.getByTestId('sheet-columns')
    expect(within(columns).getAllByRole('button').map(button => button.textContent)).toEqual(['Product cost', 'Inventory', 'Quantity'])
    expect(within(columns).getByRole('button', { name: 'Inventory' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(columns).getByRole('button', { name: 'Inventory' }))
    expect(props.handleChangeAllowSpreadColumns).toHaveBeenCalledWith('inventoried')
  })

  it('on the sheet, a control the page did not give is not drawn', () => {
    const { onOpenBatchImages, ...rest } = BAR()
    draw({ ...rest, viewMethod: 'spreedsheet' })
    expect(screen.queryByRole('button', { name: 'Upload images in batch' })).toBeNull()
    expect(screen.getByTestId('sheet-columns')).toBeInTheDocument()
    expect(onOpenBatchImages).toBeTypeOf('function')
  })
})
