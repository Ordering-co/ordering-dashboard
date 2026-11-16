/* eslint-disable import/first */
// redesign F6c-1 (P3-05, Q2-28, Q2-10): the Date pill holds a custom range until «Done» and then writes it to the
// filter context in ONE call (one list request, never a request without dates), a preset still applies at
// once, and the fields and placeholder are in the project's date format (the pill value, in OrdersFilterBar.c3.test).
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ configs: {} }))
const controller = vi.hoisted(() => ({
  handleChangeBusinesses: vi.fn(),
  handleChangeDateType: vi.fn(),
  handleChangeFromDate: vi.fn(),
  handleChangeEndDate: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
  useConfig: () => [{ configs: mockState.configs }],
  OrdersFilter: ({ UIComponent, ...props }) => <UIComponent {...props} {...controller} />
}))

import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersDateBusinessPills } from '../DateBusinessPills'

const EMPTY = { dateType: null, deliveryFromDatetime: null, deliveryEndDatetime: null, businessIds: [] }
const month = dayjs().format('YYYY-MM')

const renderPills = (filters = EMPTY, dateValue = '') => {
  const handleFilterValues = vi.fn()
  render(
    <FilterValuesContext.Provider value={[filters, { handleFilterValues }]}>
      <OrdersDateBusinessPills dateValue={dateValue} businessValue='' businessesList={{ loading: false, businesses: [] }} />
    </FilterValuesContext.Provider>
  )
  return { handleFilterValues }
}

const openDate = async (user, name = 'Date') => {
  await user.click(screen.getByRole('button', { name }))
  return screen.findByRole('dialog', { name: 'Select a date' })
}
const day = (popup, n) => popup.querySelector(`[data-day="${month}-${String(n).padStart(2, '0')}"]`)
const noHandlerCalled = () => {
  expect(controller.handleChangeDateType).not.toHaveBeenCalled()
  expect(controller.handleChangeFromDate).not.toHaveBeenCalled()
  expect(controller.handleChangeEndDate).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('Date pill · a range is one write on «Done» (P3-05)', () => {
  it('the first day is not applied, and neither is the second until «Done»', async () => {
    const user = userEvent.setup()
    const { handleFilterValues } = renderPills()
    const popup = await openDate(user)
    await user.click(day(popup, 10))
    expect(handleFilterValues).not.toHaveBeenCalled()
    noHandlerCalled()
    // the field already shows the day while the range is a draft
    expect(within(popup).getByLabelText('From')).toHaveValue(`10-${dayjs().format('MM-YYYY')}`)
    await user.click(day(popup, 12))
    expect(handleFilterValues).not.toHaveBeenCalled()
    await user.click(within(popup).getByRole('button', { name: 'Done' }))
    expect(handleFilterValues).toHaveBeenCalledTimes(1)
    expect(handleFilterValues).toHaveBeenCalledWith({
      ...EMPTY,
      dateType: 'term',
      deliveryFromDatetime: `${month}-10 00:00:00`,
      deliveryEndDatetime: `${month}-12 23:59:59`
    })
    noHandlerCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), { timeout: 4000 })
  })

  it('«Done» with only the first day writes «from» once, with no end', async () => {
    const user = userEvent.setup()
    const { handleFilterValues } = renderPills()
    const popup = await openDate(user)
    await user.click(day(popup, 10))
    await user.click(within(popup).getByRole('button', { name: 'Done' }))
    expect(handleFilterValues).toHaveBeenCalledTimes(1)
    expect(handleFilterValues).toHaveBeenCalledWith({ ...EMPTY, dateType: 'term', deliveryFromDatetime: `${month}-10 00:00:00`, deliveryEndDatetime: null })
  })

  it('typing a range is a draft too: one write on «Done»', async () => {
    const user = userEvent.setup()
    const { handleFilterValues } = renderPills()
    const popup = await openDate(user)
    await user.type(within(popup).getByLabelText('From'), '10012026')
    await user.type(within(popup).getByLabelText('To'), '12012026')
    expect(handleFilterValues).not.toHaveBeenCalled()
    await user.click(within(popup).getByRole('button', { name: 'Done' }))
    expect(handleFilterValues).toHaveBeenCalledTimes(1)
    expect(handleFilterValues).toHaveBeenCalledWith({
      ...EMPTY,
      dateType: 'term',
      deliveryFromDatetime: '2026-01-10 00:00:00',
      deliveryEndDatetime: '2026-01-12 23:59:59'
    })
  })

  it('leaving without «Done» (Escape) applies nothing', async () => {
    const user = userEvent.setup()
    const { handleFilterValues } = renderPills()
    const popup = await openDate(user)
    await user.click(day(popup, 10))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), { timeout: 4000 })
    expect(handleFilterValues).not.toHaveBeenCalled()
    noHandlerCalled()
  })

  it('«Done» without a change writes nothing', async () => {
    const user = userEvent.setup()
    const { handleFilterValues } = renderPills()
    const popup = await openDate(user)
    await user.click(within(popup).getByRole('button', { name: 'Done' }))
    expect(handleFilterValues).not.toHaveBeenCalled()
  })

  it('clearing both fields of a range and pressing «Done» goes back to «Any» in one write', async () => {
    const user = userEvent.setup()
    const filters = { ...EMPTY, dateType: 'term', deliveryFromDatetime: '2026-01-10 00:00:00', deliveryEndDatetime: '2026-01-12 23:59:59' }
    const { handleFilterValues } = renderPills(filters, '10-01-2026 – 12-01-2026')
    const popup = await openDate(user, 'Date 10-01-2026 – 12-01-2026')
    await user.clear(within(popup).getByLabelText('From'))
    await user.clear(within(popup).getByLabelText('To'))
    await user.click(within(popup).getByRole('button', { name: 'Done' }))
    expect(handleFilterValues).toHaveBeenCalledTimes(1)
    expect(handleFilterValues).toHaveBeenCalledWith({ ...filters, dateType: 'default', deliveryFromDatetime: null, deliveryEndDatetime: null })
  })

  it('a preset still applies at once, through the controller handler', async () => {
    const user = userEvent.setup()
    const { handleFilterValues } = renderPills()
    const popup = await openDate(user)
    await user.click(day(popup, 10))
    await user.click(within(popup).getByRole('button', { name: 'Last 7 days' }))
    expect(controller.handleChangeDateType).toHaveBeenCalledExactlyOnceWith('last7')
    expect(handleFilterValues).not.toHaveBeenCalled()
  })
})

describe('Date pill · project date format (Q2-10)', () => {
  it('the placeholder, the fields and the mask follow the project format', async () => {
    mockState.configs = { dates_general_format: { value: 'MM/DD/YYYY hh:mm A' } }
    const user = userEvent.setup()
    renderPills()
    const popup = await openDate(user)
    const from = within(popup).getByLabelText('From')
    expect(from).toHaveAttribute('placeholder', 'mm/dd/yyyy')
    await user.type(from, '01102026')
    expect(from).toHaveValue('01/10/2026')
  })
})
