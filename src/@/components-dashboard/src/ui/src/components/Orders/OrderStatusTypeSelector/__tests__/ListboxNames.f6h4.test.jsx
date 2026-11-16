/* eslint-disable import/first */
// redesign F6h-4 (A2): the listbox of the status, driver and company selects carries the name of its field («Order status»,
// «Change status» in bulk, «Driver», «Driver company»), not the text of the trigger (the current value). Real selects, real
// consumers; only the controllers' data is stubbed.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{ configs: {} }],
  DriversList: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      driversList={{ loading: false, drivers: [{ id: 1, name: 'Dan', lastname: 'Driver', enabled: true, available: true, busy: false, assigned_orders_count: 1, photo: null }] }}
      companysList={{ loading: false, error: null, companys: [{ id: 1, name: 'Fast Riders', logo: null }] }}
      driverActionStatus={{}}
      companyActionStatus={{}}
      handleAssignDriver={vi.fn()}
    />
  )
}))
vi.mock('../../../Shared', () => ({ Alert: () => null }))
vi.mock('../../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))

import { OrderStatusTypeSelector } from '..'
import { DriverSelector } from '../../DriverSelector'
import { CompanySelector } from '../../CompanySelector'
import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'

const wrap = ui => (
  <ThemeProvider theme={{ ...createDashboardTheme(theme), images: {} }}>
    <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>{ui}</SelectSurfaceContext.Provider>
  </ThemeProvider>
)
const openFirst = ui => {
  const view = render(wrap(ui))
  fireEvent.click(view.container.querySelector('.od-first-select-trigger'))
  return view
}

describe('listbox names (A2)', () => {
  it('the footer status select names its listbox «Order status»', () => {
    openFirst(<OrderStatusTypeSelector isFirstSelect noPadding orderId={1} deliveryType={1} defaultValue={11} handleUpdateOrderStatus={vi.fn()} placement='auto' />)
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Order status')
  })

  it('the bulk status select names its listbox «Change status»', () => {
    openFirst(<OrderStatusTypeSelector isFirstSelect noPadding mutiOrdersChange deliveryType={1} defaultValue='default' handleChangeMultiOrdersStatus={vi.fn()} />)
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Change status')
  })

  it('a consumer can name it with its own label', () => {
    openFirst(<OrderStatusTypeSelector isFirstSelect noPadding ariaLabel='Status of the order' orderId={1} deliveryType={1} defaultValue={11} handleUpdateOrderStatus={vi.fn()} />)
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Status of the order')
  })

  it('the driver select names its listbox «Driver»', () => {
    openFirst(<DriverSelector order={{ id: 42 }} orderId={42} defaultValue={1} />)
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Driver')
  })

  it('the driver company select names its listbox with its visible label «Driver company»', () => {
    const view = render(wrap(<CompanySelector order={{ id: 7 }} defaultValue={1} handleAssignDriverCompany={() => {}} />))
    expect(view.container.querySelector('.odt-assign-label')).toHaveTextContent('Driver company')
    fireEvent.click(view.container.querySelector('.od-first-select-trigger'))
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Driver company')
  })

  it('the status filter (multi-select) names its listbox «Order status»', () => {
    const view = render(wrap(<OrderStatusTypeSelector isFilterView filterValues={{ statuses: [] }} defaultFilterValues={[]} />))
    fireEvent.click(view.container.querySelector('.od-multi-select-trigger'))
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Order status')
  })
})
