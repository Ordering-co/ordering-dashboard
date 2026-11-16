import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SelectableList } from '../SelectableList'

// redesign the selectable list promoted from Users/StaffDirectory/StaffStoresSection (the catalog block), for
// «Share with» of menus and zones, and next for and . It has no text of its own: every string is a prop.

const items = [
  { id: 1, name: 'Burger Town', photo: 'https://img.test/1.png' },
  { id: 2, name: 'Pizza Hub' },
  { id: 3, name: 'Taco Spot' }
]

const pagination = {
  page: 1,
  pageSize: 10,
  total: 23,
  pageSizeOptions: [10, 25, 50],
  label: 'Pagination',
  previousLabel: 'Previous page',
  nextLabel: 'Next page',
  pageSizeLabel: 'Items per page',
  pageLabel: 'Page',
  rangeLabel: (from, to, total) => `Showing ${from}–${to} of ${total}`,
  pageStatusLabel: (page, totalPages) => `Page ${page} of ${totalPages}`
}

const baseProps = (overrides = {}) => ({
  label: 'Stores',
  items,
  selectedIds: [],
  onToggle: vi.fn(),
  loadingLabel: 'Loading',
  emptyTitle: 'No stores match this search',
  onSearch: vi.fn(),
  searchLabel: 'Search stores',
  clearSearchLabel: 'Clear search',
  onSelectAll: vi.fn(),
  selectAllLabel: 'Select all',
  onSelectNone: vi.fn(),
  selectNoneLabel: 'Select none',
  ...overrides
})

afterEach(() => vi.useRealTimers())

describe('SelectableList', () => {
  it('lists each item as a checkbox named by its item, with its avatar or its initials, and the given ones ticked', () => {
    const { container } = render(<SelectableList {...baseProps({ selectedIds: [2], avatars: 'business' })} />)
    const list = screen.getByRole('list', { name: 'Stores' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('checkbox', { name: 'Burger Town' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('checkbox', { name: 'Pizza Hub' })).toHaveAttribute('aria-checked', 'true')
    const avatars = container.querySelectorAll('.odc-avatar[data-kind="business"]')
    expect(avatars).toHaveLength(3)
    expect(avatars[0].querySelector('img')).toHaveAttribute('src', 'https://img.test/1.png')
    expect(avatars[1]).toHaveTextContent('PH')
  })

  it('draws no avatar unless asked', () => {
    const { container } = render(<SelectableList {...baseProps()} />)
    expect(container.querySelector('.odc-avatar')).toBeNull()
  })

  it('a click or Space on a row reports the item and its next state once', async () => {
    const props = baseProps({ selectedIds: [2] })
    render(<SelectableList {...props} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Burger Town' }))
    expect(props.onToggle).toHaveBeenLastCalledWith(1, true)
    screen.getByRole('checkbox', { name: 'Pizza Hub' }).focus()
    await userEvent.keyboard(' ')
    expect(props.onToggle).toHaveBeenLastCalledWith(2, false)
    expect(props.onToggle).toHaveBeenCalledTimes(2)
  })

  it('the keyboard goes search, Select all, Select none and then each row', async () => {
    render(<SelectableList {...baseProps({ selectedIds: [1] })} />)
    await userEvent.tab()
    expect(screen.getByRole('searchbox', { name: 'Search stores' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Select all' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Select none' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('checkbox', { name: 'Burger Town' })).toHaveFocus()
  })

  it('Select all and Select none report once; Select none is off with nothing selected, Select all with nothing listed', async () => {
    const props = baseProps({ selectedIds: [1] })
    const view = render(<SelectableList {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(props.onSelectAll).toHaveBeenCalledTimes(1)
    expect(props.onSelectNone).toHaveBeenCalledTimes(1)
    view.rerender(<SelectableList {...baseProps({ selectedIds: [] })} />)
    expect(screen.getByRole('button', { name: 'Select none' })).toBeDisabled()
    view.rerender(<SelectableList {...baseProps({ items: [], selectedIds: [1] })} />)
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
  })

  it('locked: the rows and both bulk buttons do nothing; the search still works', async () => {
    const props = baseProps({ selectedIds: [1], locked: true })
    render(<SelectableList {...props} />)
    expect(screen.getByRole('checkbox', { name: 'Burger Town' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select none' })).toBeDisabled()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search stores' }), 'piz{Enter}')
    expect(props.onSearch).toHaveBeenCalledWith('piz')
  })

  it('typing waits 500 ms and sends once; Enter sends at once; the clear button sends an empty search', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const props = baseProps()
    render(<SelectableList {...props} />)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByRole('searchbox', { name: 'Search stores' }), 'bur')
    expect(props.onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(500) })
    expect(props.onSearch).toHaveBeenCalledTimes(1)
    expect(props.onSearch).toHaveBeenLastCalledWith('bur')
    await user.type(screen.getByRole('searchbox', { name: 'Search stores' }), 'g{Enter}')
    expect(props.onSearch).toHaveBeenLastCalledWith('burg')
    act(() => { vi.advanceTimersByTime(500) })
    expect(props.onSearch).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(props.onSearch).toHaveBeenLastCalledWith('')
    expect(props.onSearch).toHaveBeenCalledTimes(3)
  })

  it('while loading: a busy status with skeleton rows and no checkboxes', () => {
    render(<SelectableList {...baseProps({ loading: true, skeletonRows: 4, avatars: 'business' })} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Loading')
    expect(status.querySelectorAll('.odc-selectable-skeleton-row')).toHaveLength(4)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
  })

  it('a failure says so with Retry, and hides the pagination', async () => {
    const onRetry = vi.fn()
    render(<SelectableList {...baseProps({ error: true, errorTitle: "We couldn't load the stores.", retryLabel: 'Retry', onRetry, pagination })} />)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the stores.")
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('nothing listed says the empty title', () => {
    render(<SelectableList {...baseProps({ items: [] })} />)
    expect(screen.getByText('No stores match this search')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('paginates: next page and page size reach the owner', async () => {
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()
    render(<SelectableList {...baseProps({ pagination: { ...pagination, onPageChange, onPageSizeChange } })} />)
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–10 of 23')
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    await userEvent.click(within(nav).getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(onPageSizeChange).toHaveBeenCalledWith(25, 1)
  })

  it('leaves out the search, the bulk buttons and the pagination when not given', () => {
    render(<SelectableList label='Stores' items={items} selectedIds={[]} onToggle={vi.fn()} loadingLabel='Loading' emptyTitle='None' />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('a missing name throws; an empty one paints empty', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<SelectableList {...baseProps({ label: undefined })} />)).toThrow('SelectableList needs a label')
    expect(() => render(<SelectableList {...baseProps({ selectAllLabel: undefined })} />)).toThrow('SelectableList needs a selectAllLabel')
    expect(() => render(<SelectableList {...baseProps({ error: true, onRetry: vi.fn() })} />)).toThrow('SelectableList needs an errorTitle')
    error.mockRestore()
    render(<SelectableList {...baseProps({ label: '' })} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
  })
})
