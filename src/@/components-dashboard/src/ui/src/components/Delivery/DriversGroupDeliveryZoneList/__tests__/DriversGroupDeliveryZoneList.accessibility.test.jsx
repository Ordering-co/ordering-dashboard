/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => fallback || key]
}))

vi.mock('../../../Shared', () => ({ SideBar: ({ children }) => <div>{children}</div> }))
vi.mock('../../DriversGroupsDeliveryZoneDetails', () => ({ DriverGroupDeliveryZoneDetails: () => <div>Zone details</div> }))
vi.mock('../../../../styles', () => ({
  Checkbox: props => <input type='checkbox' {...props} />
}))

import { DriverGroupDeliveryZoneList } from '..'

const zone = { id: 88001, name: 'Downtown polygon', minimum: 10, price: 3, type: 2 }

const renderList = (overrides = {}) => {
  const props = {
    drivergroup: { id: 975001 },
    setIsExtendExtraOpen: vi.fn(),
    handleSuccessUpdate: vi.fn(),
    zoneListState: { isCheckAll: false, changes: {} },
    handleChangeZoneState: vi.fn(),
    handleChangeAllZoneState: vi.fn(),
    handleParentSidebarMove: vi.fn(),
    zoneList: { loading: false, zones: [zone] },
    setZoneList: vi.fn(),
    setIsOpenDetails: vi.fn(),
    isOpenDetails: false,
    ...overrides
  }
  renderWithProviders(<DriverGroupDeliveryZoneList {...props} />)
  return props
}

describe('DriverGroupDeliveryZoneList semantics', () => {
  it('names the table, scopes its headers and keeps one row body', () => {
    renderList()
    const table = screen.getByRole('table', { name: 'Delivery zones' })
    expect(table.querySelectorAll('tbody')).toHaveLength(1)
    expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(5)
    expect(table.querySelectorAll('th[scope="row"]')).toHaveLength(1)
  })

  it('separates row selection from opening the zone without changing the callbacks', () => {
    const props = renderList()

    const select = screen.getByRole('checkbox', { name: 'Downtown polygon' })
    fireEvent.click(select)
    expect(props.handleChangeZoneState).toHaveBeenCalledWith(88001, true)
    expect(props.setIsOpenDetails).not.toHaveBeenCalled()

    // Both the name and the trailing chevron open the zone, so the row keeps the
    // activation its hover highlight advertises without a click-anywhere region.
    const openControls = screen.getAllByRole('button', { name: 'Downtown polygon' })
    expect(openControls).toHaveLength(2)
    for (const control of openControls) {
      props.setIsOpenDetails.mockClear()
      props.handleParentSidebarMove.mockClear()
      fireEvent.click(control)
      expect(props.setIsOpenDetails).toHaveBeenCalledWith(true)
      expect(props.handleParentSidebarMove).toHaveBeenCalledWith(500)
    }

    fireEvent.click(screen.getByRole('button', { name: 'Add delivery zone' }))
    expect(props.setIsExtendExtraOpen).toHaveBeenLastCalledWith(true)
  })

  it('gives the header checkbox an accessible select-all name', () => {
    const props = renderList()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(props.handleChangeAllZoneState).toHaveBeenCalledWith(true)
  })
})
