// redesign stores 2.H: the «Share with» picker shows what failed (G3-05): a list that did not load, with
// Retry, and a save that failed, under Save, which is usable again.
// redesign the list is P/SelectableList (it was Shared/UI SelectBusinesses); the same actions reach the
// StoreSharePicker controller: pick, all, none, search, page and page size, save.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback ?? key],
  useUtils: () => [{ optimizeImage: (src, params) => `${src}?${params}` }]
}))

import { StoreSharePickerUI } from '../index'

const stores = [
  { id: 4, name: 'Burger Town', logo: 'https://img.test/4.png' },
  { id: 5, name: 'Pizza Hub', logo: null }
]

const baseProps = (overrides = {}) => ({
  actionState: { loading: false, result: { error: false } },
  businessesState: { businesses: stores, loading: false, error: null },
  businessesPaginationProps: { currentPage: 1, pageSize: 10, totalPages: 3, totalItems: 23 },
  selectedBusinessIds: [5],
  handleSelectBusiness: vi.fn(),
  handleSelectAllBusiness: vi.fn(),
  handleShareBusinesses: vi.fn(),
  searchBusinesses: vi.fn(),
  handleChangeBusinessPage: vi.fn(),
  handleChangeBusinessPageSize: vi.fn(),
  reloadBusinesses: vi.fn(),
  ...overrides
})

describe('StoreSharePickerUI', () => {
  it('shows no notice when nothing failed', () => {
    render(<StoreSharePickerUI {...baseProps()} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('lists the stores as named checkboxes with the logo, or the initials when there is none', () => {
    const { container } = render(<StoreSharePickerUI {...baseProps()} />)
    expect(screen.getByRole('list', { name: 'Stores' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Burger Town' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('checkbox', { name: 'Pizza Hub' })).toHaveAttribute('aria-checked', 'true')
    const avatars = container.querySelectorAll('.odc-avatar[data-kind="business"]')
    expect(avatars[0].querySelector('img')).toHaveAttribute('src', 'https://img.test/4.png?h_50,c_limit')
    expect(avatars[1]).toHaveTextContent('PH')
    // nothing of the legacy picker is left
    expect(container.querySelector('.odc-selectable')).not.toBeNull()
  })

  it('a row shares or unshares that store', async () => {
    const props = baseProps()
    render(<StoreSharePickerUI {...props} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Burger Town' }))
    expect(props.handleSelectBusiness).toHaveBeenLastCalledWith(4, true)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pizza Hub' }))
    expect(props.handleSelectBusiness).toHaveBeenLastCalledWith(5, false)
  })

  it('«Select all» and «Select none» are Product buttons that ask the controller for all and for none', async () => {
    const props = baseProps()
    render(<StoreSharePickerUI {...props} />)
    const all = screen.getByRole('button', { name: 'Select all' })
    expect(all).toHaveClass('odc-btn')
    await userEvent.click(all)
    expect(props.handleSelectAllBusiness).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(props.handleSelectAllBusiness).toHaveBeenLastCalledWith(false)
  })

  it('the search has its own label and reaches the controller', async () => {
    const props = baseProps()
    render(<StoreSharePickerUI {...props} />)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search stores' }), 'piz{Enter}')
    expect(props.searchBusinesses).toHaveBeenCalledWith('piz')
  })

  it('pages and page sizes reach the controller', async () => {
    const props = baseProps()
    render(<StoreSharePickerUI {...props} />)
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–10 of 23')
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(props.handleChangeBusinessPage).toHaveBeenCalledWith(2)
    await userEvent.click(within(nav).getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(props.handleChangeBusinessPageSize).toHaveBeenCalledWith(25)
  })

  it('Save sends the share', async () => {
    const props = baseProps()
    render(<StoreSharePickerUI {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.handleShareBusinesses).toHaveBeenCalledTimes(1)
  })

  it('says the list did not load and Retry asks again', async () => {
    const props = baseProps({ businessesState: { businesses: [], loading: false, error: ['Boom'] } })
    render(<StoreSharePickerUI {...props} />)
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn\'t load the stores.')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(props.reloadBusinesses).toHaveBeenCalledTimes(1)
  })

  it('says why a save failed, brings it into view and leaves Save usable', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(<StoreSharePickerUI {...baseProps({ actionState: { loading: false, result: { error: true, result: ['Zone locked'] } } })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Zone locked')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    delete Element.prototype.scrollIntoView
  })

  it('falls back to the generic text when the API gives no message', () => {
    render(<StoreSharePickerUI {...baseProps({ actionState: { loading: false, result: { error: true, result: undefined } } })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn\'t save the change.')
  })

  it('keeps Save disabled while saving or loading', () => {
    const { rerender } = render(<StoreSharePickerUI {...baseProps({ actionState: { loading: true, result: { error: false } } })} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    rerender(<StoreSharePickerUI {...baseProps({ businessesState: { businesses: [], loading: true, error: null } })} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  // redesign bugs F while saving the checkboxes and bulk buttons are locked too, not only Save
  it('locks the selection controls only while saving', () => {
    const { rerender } = render(<StoreSharePickerUI {...baseProps({ actionState: { loading: true, result: { error: false } } })} />)
    expect(screen.getByRole('checkbox', { name: 'Burger Town' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select none' })).toBeDisabled()
    rerender(<StoreSharePickerUI {...baseProps()} />)
    expect(screen.getByRole('checkbox', { name: 'Burger Town' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeEnabled()
  })
})
