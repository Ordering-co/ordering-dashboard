/* eslint-disable import/first */
// redesign fix-qa E7 (parity audit, main: OrdersDashboardList:25-30): «In progress» lists the earliest
// delivery first only on /orders. The lateral lists of a customer or a driver, /all-in-one, /deliveries
// and /messages keep the order they had (newest first).
import React from 'react'
import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ lists: [] }))

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: {} }],
  DashboardOrdersList: (props) => { runtime.lists.push(props); return null }
}))
vi.mock('../../OrdersListing', () => ({ OrdersListing: () => null }))

import { OrdersDashboardList } from '..'

const baseProps = { setOrdersAmountByStatus: vi.fn(), selectedSubOrderStatus: {} }

const renderList = (props) => {
  runtime.lists = []
  render(<MemoryRouter><OrdersDashboardList {...baseProps} {...props} /></MemoryRouter>)
  return Object.fromEntries(runtime.lists.map(list => [list.groupStatus, list]))
}

beforeEach(() => {
  runtime.lists = []
  window.localStorage.clear()
})

describe('OrdersDashboardList · order of the in-progress tab', () => {
  it('on /orders (the page that asks for «Select all N») in progress goes by delivery, earliest first', () => {
    const lists = renderList({ canSelectAllMatching: true })
    expect(lists.inProgress.orderBy).toBe('delivery_datetime')
    expect(lists.inProgress.orderDirection).toBe('asc')
    expect(lists.pending.orderBy).toBe('id')
    expect(lists.completed.orderDirection).toBe('desc')
  })

  it('in the lateral lists of a customer or a driver it keeps the newest-first order', () => {
    const lists = renderList({ canSelectAllMatching: false, isSelectedOrders: true })
    expect(lists.inProgress.orderBy).toBe('id')
    expect(lists.inProgress.orderDirection).toBe('desc')
  })

  it('in /all-in-one, which never asks for it, it keeps the newest-first order', () => {
    const lists = renderList({ hidePhoto: true })
    expect(lists.inProgress.orderBy).toBe('id')
    expect(lists.inProgress.orderDirection).toBe('desc')
  })

  it('even a lateral list that is told it can select all keeps the newest-first order', () => {
    const lists = renderList({ canSelectAllMatching: true, isSelectedOrders: true })
    expect(lists.inProgress.orderBy).toBe('id')
  })
})

// (owner decision 2 of the parity audit, 2026-10-27): main listed in progress newest first; /orders keeps the
// earliest delivery as its default and offers newest first again, remembered on this browser.
describe('OrdersDashboardList · the reader chooses the order of in progress on /orders', () => {
  const lastInProgress = () => runtime.lists.filter(list => list.groupStatus === 'inProgress').at(-1)

  it('hands the in-progress list the current choice and a way to change it, only on /orders', () => {
    const lists = renderList({ canSelectAllMatching: true })
    expect(lists.inProgress.inProgressSort).toBe('delivery')
    expect(typeof lists.inProgress.onInProgressSortChange).toBe('function')
    expect(lists.pending.onInProgressSortChange).toBeUndefined()
    const lateral = renderList({ canSelectAllMatching: false, isSelectedOrders: true })
    expect(lateral.inProgress.onInProgressSortChange).toBeUndefined()
  })

  it('«newest» asks for -id, and the choice is remembered for the next visit', () => {
    renderList({ canSelectAllMatching: true })
    act(() => lastInProgress().onInProgressSortChange('newest'))
    expect(lastInProgress().orderBy).toBe('id')
    expect(lastInProgress().orderDirection).toBe('desc')
    expect(lastInProgress().inProgressSort).toBe('newest')
    const again = renderList({ canSelectAllMatching: true })
    expect(again.inProgress.orderBy).toBe('id')
    expect(again.inProgress.inProgressSort).toBe('newest')
  })

  it('a value it does not know, or storage that throws, falls back to the earliest delivery', () => {
    window.localStorage.setItem('odc-orders-in-progress-sort', 'sideways')
    expect(renderList({ canSelectAllMatching: true }).inProgress.orderBy).toBe('delivery_datetime')
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(renderList({ canSelectAllMatching: true }).inProgress.orderBy).toBe('delivery_datetime')
    spy.mockRestore()
  })
})
