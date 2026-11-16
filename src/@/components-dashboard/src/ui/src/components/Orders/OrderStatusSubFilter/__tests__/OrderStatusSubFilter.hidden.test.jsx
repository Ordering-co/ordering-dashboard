/* eslint-disable import/first */
// redesign deliveries-followups P2 (DV-11): /deliveries only asks for delivery_type 1 and 7, so the statuses of an order
// the customer picks up at the store leave its list empty. The page hides them from the Status pill with an opt-in prop; /orders
// (SubStatusPill through OrdersFilterBar) and /all-in-one (OrderStatusSubFilter) pass nothing and keep every status. The state the
// pill writes keeps its meaning: «all» is still every status of the tab, so the request does not change.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { CUSTOMER_PICKUP_STATUSES, OrderStatusSubFilter, SubStatusPill, getSubOrderStatuses } from '..'

afterEach(() => document.getElementById('app-modals')?.remove())

const t = (_key, text) => text
const STATUSES = getSubOrderStatuses(t)
const allKeys = group => STATUSES[group].map(status => status.key)
const allSelected = () => Object.fromEntries(Object.keys(STATUSES).map(group => [group, allKeys(group)]))

const rowNames = dialog => Array.from(dialog.querySelectorAll('button[role="checkbox"]')).map(row => row.textContent)
const open = async (user) => {
  await user.click(screen.getByRole('button', { name: /^Status/, hidden: true }))
  return screen.findByRole('dialog', { name: 'Status', hidden: true })
}

const Pill = ({ group, hiddenStatuses, onChange = () => {}, Component = SubStatusPill }) => {
  const [selected, setSelected] = useState(allSelected)
  return (
    <Component
      ordersStatusGroup={group}
      selectedSubOrderStatus={selected}
      handleSelectedSubOrderStatus={(next) => { onChange(next); setSelected(next) }}
      hiddenStatuses={hiddenStatuses}
    />
  )
}

describe('P2 · the customer pick-up statuses', () => {
  it('are the four statuses of an order the customer picks up at the store', () => {
    const names = CUSTOMER_PICKUP_STATUSES.map(key => Object.values(STATUSES).flat().find(status => status.key === key)?.value)
    expect(names).toEqual([
      'Pickup completed by customer',
      'Not picked by customer',
      'Customer almost arrived to business',
      'Customer arrived to business'
    ])
  })
})

describe('P2 · /deliveries hides them from the Status pill', () => {
  it.each([
    ['inProgress', ['Customer almost arrived to business', 'Customer arrived to business'], 13],
    ['completed', ['Pickup completed by customer'], 2],
    ['cancelled', ['Not picked by customer'], 6],
    ['pending', [], 2]
  ])('%s: without %j, %i rows', async (group, hidden, count) => {
    const user = userEvent.setup()
    render(<Pill group={group} hiddenStatuses={CUSTOMER_PICKUP_STATUSES} Component={OrderStatusSubFilter} />)
    const names = rowNames(await open(user))
    expect(names).toHaveLength(count)
    hidden.forEach(name => expect(names).not.toContain(name))
  })

  it('from «all», one press selects that one; «Clear» goes back to every status of the tab, hidden ones included', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Pill group='completed' hiddenStatuses={CUSTOMER_PICKUP_STATUSES} onChange={onChange} />)
    const dialog = await open(user)
    await user.click(within(dialog).getByRole('checkbox', { name: 'Completed by admin', hidden: true }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ completed: [1] }))
    await user.click(within(dialog).getByRole('button', { name: 'Clear', hidden: true }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ completed: allKeys('completed') }))
  })

  it('checking every status it shows is «all» again (no filter, the pill inactive), as checking all 3 is today', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Pill group='completed' hiddenStatuses={CUSTOMER_PICKUP_STATUSES} onChange={onChange} />)
    const dialog = await open(user)
    await user.click(within(dialog).getByRole('checkbox', { name: 'Completed by admin', hidden: true }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Delivery completed by driver', hidden: true }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ completed: allKeys('completed') }))
    dialog.querySelectorAll('button[role="checkbox"]').forEach(row => expect(row).toHaveAttribute('aria-checked', 'false'))
    expect(screen.getByRole('button', { name: /^Status/, hidden: true }).textContent).toBe('Status')
  })
})

describe('P2 · /orders and /all-in-one do not change', () => {
  it.each([
    ['SubStatusPill (/orders, through OrdersFilterBar)', SubStatusPill],
    ['OrderStatusSubFilter (/all-in-one)', OrderStatusSubFilter]
  ])('%s without the prop offers the 15 in-progress statuses, pick-up ones included', async (_name, Component) => {
    const user = userEvent.setup()
    render(<Pill group='inProgress' Component={Component} />)
    const names = rowNames(await open(user))
    expect(names).toHaveLength(15)
    expect(names).toContain('Customer arrived to business')
  })

  it('neither /orders nor /all-in-one passes hiddenStatuses', () => {
    const read = file => readFileSync(path.join(__dirname, '..', '..', file), 'utf8')
    expect(read('OrdersFilterBar/index.js')).not.toContain('hiddenStatuses')
    expect(read('AllInOne/index.js')).not.toContain('hiddenStatuses')
  })
})
