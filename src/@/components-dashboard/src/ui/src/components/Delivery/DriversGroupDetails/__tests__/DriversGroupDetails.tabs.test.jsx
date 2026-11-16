/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { addQueryToUrl } = vi.hoisted(() => ({ addQueryToUrl: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  DriversGroupDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { autoassign_type: { value: 'advanced' } } }],
  useSession: () => [{ user: { level: 0 } }]
}))

vi.mock('react-bootstrap', () => {
  const Dropdown = ({ children }) => <div>{children}</div>
  Dropdown.Item = function DropdownItem ({ children, ...props }) {
    return <button {...props}>{children}</button>
  }
  return {
    Dropdown,
    DropdownButton: ({ children, title, menuAlign: _menuAlign, ...props }) => <div><button {...props}>{title}</button>{children}</div>
  }
})

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  DragScroll: ({ children }) => <div>{children}</div>,
  LearnDropDown: () => null
}))

vi.mock('../../../../styles', () => ({
  IconButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  Switch: props => <input type='checkbox' aria-label='Enabled' {...props} />
}))

vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1200 }) }))
vi.mock('../../../../utils', () => ({ addQueryToUrl, learnOptionsValues: () => [] }))

vi.mock('../../DriversGroupGeneralForm', () => ({ DriversGroupGeneralForm: () => <div>General panel</div> }))
vi.mock('../../DriversGroupBusinesses', () => ({ DriversGroupBusinesses: () => <div>Businesses panel</div> }))
vi.mock('../../DriversGroupPaymethods', () => ({ DriversGroupPaymethods: () => <div>Paymethods panel</div> }))
vi.mock('../../DriversGroupLogistics', () => ({ DriversGroupLogistics: () => <div>Logistics panel</div> }))
vi.mock('../../DriversGroupLogs', () => ({ DriversGroupLogs: () => <div>Logs panel</div> }))
vi.mock('../../DriversGroupDeliveryDetails', () => ({ DriverGroupDeliveryDetails: () => <div>Delivery zones panel</div> }))

import { DriversGroupDetailsUI } from '..'

const baseProps = {
  driversGroupState: { loading: false, driversGroup: { id: 975001, name: 'Downtown couriers', enabled: true } },
  actionState: { loading: false },
  handleParentSidebarMove: vi.fn(),
  handleDeleteDriversGroup: vi.fn(),
  handleNextTour: vi.fn(),
  handleUpdateDriversGroup: vi.fn(),
  setIsExtendExtraOpen: vi.fn(),
  driversGroupId: 975001
}

describe('DriversGroupDetails tabs', () => {
  it('uses the tab keyboard model, links panels and preserves the tab query payload', () => {
    renderWithProviders(<DriversGroupDetailsUI {...baseProps} />, { initialEntries: ['/drivers-groups?id=975001'] })

    const general = screen.getByRole('tab', { name: 'General' })
    expect(general).toHaveAttribute('aria-selected', 'true')
    expect(general).toHaveAttribute('aria-controls', 'drivers-group-general-panel')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'drivers-group-general-tab')

    fireEvent.keyDown(general, { key: 'ArrowRight' })
    const businesses = screen.getByRole('tab', { name: 'Businesses' })
    expect(businesses).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Businesses panel')
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'businesses' })

    fireEvent.keyDown(businesses, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Logs' })).toHaveAttribute('aria-selected', 'true')
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'logs' })

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Logs' }), { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'general' })
  })
})
