/* eslint-disable import/first */
// redesign (AD-1, AD-4, AD-6): the payment methods of a delivery group. The filtered list is derived from the
// methods and the search (it used to be recomputed only when the search changed, so a panel opened on this tab showed no rows
// until the methods had arrived AND the person typed), Select all / none never submit, and Save is a Product button.
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => fallback]
}))

import { DriversGroupPaymethods } from '..'

const PAYMETHODS = [
  { id: 1, name: 'Cash', gateway: 'cash' },
  { id: 2, name: 'Stripe', gateway: 'stripe' }
]

const baseProps = (props = {}) => ({
  driversGroupState: { driversGroup: { id: 3 } },
  paymethods: PAYMETHODS,
  actionState: { loading: false },
  changesState: {},
  selectedPaymethodIds: [],
  handleUpdateDriversGroup: vi.fn(),
  handleAddDriversGroup: vi.fn(),
  handleSelectPaymethod: vi.fn(),
  handleSelectAllPaymethod: vi.fn(),
  ...props
})

const draw = (props = {}) => {
  const all = baseProps(props)
  const view = render(<DriversGroupPaymethods {...all} />)
  return { ...view, props: all }
}

afterEach(cleanup)

describe('DriversGroupPaymethods', () => {
  it('shows the rows when the methods arrive after the panel mounted', () => {
    const all = baseProps({ paymethods: [] })
    const { rerender } = render(<DriversGroupPaymethods {...all} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    rerender(<DriversGroupPaymethods {...all} paymethods={PAYMETHODS} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByRole('checkbox', { name: 'Cash' })).toBeInTheDocument()
  })

  it('filters by name as the person types, and says so when nothing matches', async () => {
    draw()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search payment methods' }), 'stri')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search payment methods' }), 'zzz')
    expect(screen.getByText('Nothing matches your search')).toBeInTheDocument()
  })

  it('"Select all" and "Select none" call the controller and submit nothing', async () => {
    const onSubmit = vi.fn(event => event.preventDefault())
    const all = baseProps()
    render(<form onSubmit={onSubmit}><DriversGroupPaymethods {...all} /></form>)
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(all.handleSelectAllPaymethod).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(all.handleSelectAllPaymethod).toHaveBeenLastCalledWith(false)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(all.handleUpdateDriversGroup).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Select all' })).toHaveClass('odc-btn')
  })

  it('a row toggles through the controller', async () => {
    const { props } = draw({ selectedPaymethodIds: [2] })
    expect(screen.getByRole('checkbox', { name: 'Stripe' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cash' }))
    expect(props.handleSelectPaymethod).toHaveBeenCalledWith(1, true)
  })

  it('shows a busy status while the methods load, the error when they fail, and the empty state', () => {
    draw({ paymethods: [], pickLists: { paymethods: { loading: true, error: null } } })
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    cleanup()
    draw({ paymethods: [], pickLists: { paymethods: { loading: false, error: ['x'] } } })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the payment methods.")
    cleanup()
    draw({ paymethods: [] })
    expect(screen.getByText('No payment methods enabled')).toBeInTheDocument()
  })

  it('Save is a Product primary button, disabled without changes, with the same branches as before', async () => {
    draw()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    cleanup()
    const changes = { paymethods: [1] }
    const { props } = draw({ changesState: changes })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveClass('odc-btn')
    expect(save).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(save)
    expect(props.handleUpdateDriversGroup).toHaveBeenCalledWith(changes)
    cleanup()
    const added = draw({ driversGroupState: { driversGroup: null }, changesState: changes })
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(added.props.handleAddDriversGroup).toHaveBeenCalledTimes(1)
  })

  it('Save is busy while the action runs', () => {
    draw({ changesState: { paymethods: [1] }, actionState: { loading: true } })
    expect(within(document.body).getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
  })
})
