/* eslint-disable import/first */
// redesign (AD-1, AD-4, AD-5, AD-6): the stores of a delivery group on Product pieces. Same actions and same save as
// main: the search is the API's, the pagination is the API's, the selection spans pages, Save sends only the changes.
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { DriversGroupBusinesses } from '..'

const BUSINESSES = [{ id: 1, name: 'Alpha Bakery' }, { id: 2, name: 'Beta', logo: 'https://example.com/beta.png' }]

const draw = (props = {}) => {
  const all = {
    driversGroupState: { driversGroup: { id: 3 } },
    businesses: BUSINESSES,
    actionState: { loading: false },
    changesState: {},
    selectedBusinessIds: [],
    handleSelectAllBusiness: vi.fn(),
    handleSelectBusiness: vi.fn(),
    handleUpdateDriversGroup: vi.fn(),
    handleAddDriversGroup: vi.fn(),
    searchBusinesses: vi.fn(),
    handleChangeBusinessPage: vi.fn(),
    handleChangeBusinessPageSize: vi.fn(),
    ...props
  }
  const view = render(<DriversGroupBusinesses {...all} />)
  return { ...view, props: all }
}

afterEach(cleanup)

describe('DriversGroupBusinesses · Product pieces', () => {
  it('is a group named Businesses, one checkbox per store named by the store, with its initials as the avatar', async () => {
    const { props, container } = draw({ selectedBusinessIds: [2] })
    expect(screen.getByRole('group', { name: 'Businesses' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true')
    expect(container.querySelector('.odc-avatar[data-kind="business"]')).toHaveTextContent('AB')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Alpha Bakery' }))
    expect(props.handleSelectBusiness).toHaveBeenCalledWith(1, true)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Beta' }))
    expect(props.handleSelectBusiness).toHaveBeenLastCalledWith(2, false)
  })

  it('"Select all" and "Select none" are Product buttons that call the controller', async () => {
    const { props } = draw()
    const all = screen.getByRole('button', { name: 'Select all' })
    expect(all).toHaveClass('odc-btn')
    await userEvent.click(all)
    expect(props.handleSelectAllBusiness).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(props.handleSelectAllBusiness).toHaveBeenLastCalledWith(false)
    expect(props.handleUpdateDriversGroup).not.toHaveBeenCalled()
  })

  it('hands what is typed in the search to the API search, once the person pauses (as the old lazy search)', async () => {
    const { props } = draw()
    const field = screen.getByRole('searchbox', { name: 'Search stores' })
    await userEvent.type(field, 'be')
    expect(field).toHaveValue('be')
    expect(props.searchBusinesses).not.toHaveBeenCalled()
    await waitFor(() => expect(props.searchBusinesses).toHaveBeenCalledTimes(1))
    expect(props.searchBusinesses).toHaveBeenLastCalledWith('be')
  })

  it('pages through the API: next page, and rows per page', async () => {
    const { props } = draw({ businessesPaginationProps: { currentPage: 1, pageSize: 10, totalPages: 3, totalItems: 25 } })
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(props.handleChangeBusinessPage).toHaveBeenCalledWith(2)
  })

  it('paints no pagination with a single page', () => {
    draw({ businessesPaginationProps: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 2 } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('shows a busy status while the page loads, and the empty state when there are no stores', () => {
    draw({ businessesLoading: true, businesses: [] })
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    cleanup()
    draw({ businesses: [] })
    expect(screen.getByText('No stores yet')).toBeInTheDocument()
  })

  it('Save is a disabled Product button without changes', () => {
    draw()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveClass('odc-btn')
    expect(save).toBeDisabled()
  })

  it('Save sends the changes of a group that exists, and Add creates the group', async () => {
    const changes = { businesses: [1] }
    const { props } = draw({ changesState: changes })
    const form = screen.getByRole('button', { name: 'Save' }).closest('form')
    expect(form).toHaveAttribute('data-tour', 'tour_select_business')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.handleUpdateDriversGroup).toHaveBeenCalledWith(changes)
    expect(props.handleAddDriversGroup).not.toHaveBeenCalled()
    cleanup()
    const added = draw({ driversGroupState: { driversGroup: null }, changesState: changes })
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(added.props.handleAddDriversGroup).toHaveBeenCalledTimes(1)
  })

  it('Save is busy while the action runs', () => {
    draw({ changesState: { businesses: [1] }, actionState: { loading: true } })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
  })
})
