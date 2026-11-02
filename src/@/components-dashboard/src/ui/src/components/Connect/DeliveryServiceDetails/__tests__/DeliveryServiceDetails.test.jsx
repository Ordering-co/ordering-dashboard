import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'

const state = vi.hoisted(() => ({ plugin: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  DeliveryServiceDetails: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      deliveryServiceState={{ deliveryService: { id: 166, name: 'Uber Direct', enabled: true, plugin: state.plugin } }}
      actionState={{}}
      scheduleState={{}}
      handleParentSidebarMove={vi.fn()}
      setIsExtendExtraOpen={vi.fn()}
    />
  )
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  DragScroll: ({ children }) => <div>{children}</div>,
  LearnDropDown: () => null,
  Schedule: () => null,
  Modal: ({ open, title, children }) => open ? <div role='dialog' aria-label={title}>{children}</div> : null
}))
vi.mock('../../DeliveryServiceGeneralForm', () => ({ DeliveryServiceGeneralForm: () => null }))
vi.mock('../../DeliveryServicePaymethods', () => ({ DeliveryServicePaymethods: () => null }))
vi.mock('../../DeliveryServiceZones', () => ({ DeliveryServiceZones: () => null }))
vi.mock('../../DeliveryServicesBusinesses', () => ({ DeliveryServiceBusinesses: () => null }))
import { DeliveryServiceDetails } from '../index'

const uberDirect = {
  key: 'uber_direct_integration',
  root: 'https://uber-direct.plugins.orderingplus.com',
  links: JSON.stringify({ info_setup: '/views/info?project_code=@{project_code}' })
}

const renderDetails = () => renderWithProviders(<DeliveryServiceDetails />, { theme: dashboardTheme })

beforeEach(() => { state.plugin = uberDirect })

describe('Delivery service setup guide', () => {
  it('opens the plugin setup guide under one clear name', () => {
    renderDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Setup guide' }))
    const dialog = screen.getByRole('dialog', { name: 'Setup guide' })
    expect(dialog.querySelector('iframe')).toHaveAttribute('src', 'https://uber-direct.plugins.orderingplus.com/views/info?project_code=demo')
    expect(screen.queryByText(/Setting up/)).not.toBeInTheDocument()
  })

  it('hides the button when the plugin has no setup guide', () => {
    state.plugin = { ...uberDirect, links: JSON.stringify({}) }
    renderDetails()
    expect(screen.queryByRole('button', { name: 'Setup guide' })).not.toBeInTheDocument()
  })
})
