/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { addQueryToUrl } = vi.hoisted(() => ({ addQueryToUrl: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => fallback || key]
}))

vi.mock('../../../Shared', () => ({ SideBar: ({ children }) => <div>{children}</div>, Modal: ({ children }) => <div>{children}</div> }))
vi.mock('../../../../styles', () => ({ Button: ({ children, borderRadius: _borderRadius, color: _color, ...props }) => <button {...props}>{children}</button> }))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1400 }) }))
vi.mock('../../../../utils', () => ({ addQueryToUrl }))
vi.mock('../../DriversGroupOrders', () => ({ DriversGroupOrders: () => <div>Group orders</div> }))
vi.mock('../../DriversGroupAutoassign', () => ({ DriversGroupAutoassign: () => <div>Autoassign</div> }))
vi.mock('../../DriversMarkAsBusy', () => ({ DriversMarkAsBusy: () => <div>Mark busy</div> }))

import { DriversGroupLogistics } from '..'

describe('DriversGroupLogistics selection semantics', () => {
  it('exposes the start status as a keyboard-operable radiogroup and preserves the change payload', () => {
    const handleChangesState = vi.fn()
    renderWithProviders(
      <DriversGroupLogistics
        driversGroupState={{ driversGroup: { id: 975001, type: 0, orders_group_start_in_status: 7 } }}
        changesState={{}}
        handleChangesState={handleChangesState}
        handleParentSidebarMove={vi.fn()}
        handleUpdateDriversGroup={vi.fn()}
      />
    )

    const group = screen.getByRole('radiogroup', { name: 'Start group in status' })
    expect(group).toBeInTheDocument()
    const accepted = screen.getByRole('radio', { name: 'Accepted by the business' })
    const prepared = screen.getByRole('radio', { name: 'Preparation completed' }) // redesign 5.2: shared status label in sentence case (C14)
    expect(accepted).toHaveAttribute('aria-checked', 'true')
    expect(prepared).toHaveAttribute('aria-checked', 'false')

    expect(accepted).toHaveAttribute('tabindex', '0')
    expect(prepared).toHaveAttribute('tabindex', '-1')

    fireEvent.click(prepared)
    expect(handleChangesState).toHaveBeenCalledWith({ orders_group_start_in_status: 4 })

    // Arrow/Home/End move the selection the radiogroup role advertises.
    fireEvent.keyDown(accepted, { key: 'ArrowRight' })
    expect(handleChangesState).toHaveBeenLastCalledWith({ orders_group_start_in_status: 4 })
    fireEvent.keyDown(accepted, { key: 'End' })
    expect(handleChangesState).toHaveBeenLastCalledWith({ orders_group_start_in_status: 4 })
    fireEvent.keyDown(prepared, { key: 'Home' })
    expect(handleChangesState).toHaveBeenLastCalledWith({ orders_group_start_in_status: 7 })
  })

  it('opens each configuration from a native button and keeps the config query payload', () => {
    renderWithProviders(
      <DriversGroupLogistics
        driversGroupState={{ driversGroup: { id: 975001, type: 0 } }}
        changesState={{ type: 0 }}
        handleChangesState={vi.fn()}
        handleParentSidebarMove={vi.fn()}
        handleUpdateDriversGroup={vi.fn()}
      />
    )

    const autoassign = screen.getByRole('button', { name: /Autoassign settings/ })
    expect(autoassign).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(autoassign)
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ config: 'AUTOASSIGN_SETTINGS' })
    expect(screen.getByRole('button', { name: /Autoassign settings/ })).toHaveAttribute('aria-expanded', 'true')
  })
})
