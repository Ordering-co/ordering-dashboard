import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))
vi.mock('../../../Shared', () => ({
  Pagination: () => null
}))

import { DeliveryServicesList } from '../index'

const companies = [
  { id: 133, name: 'Doordash Drive', enabled: true, plugin_id: 529, driver_groups: [] },
  { id: 166, name: 'Uber Direct', enabled: true, plugin_id: 1222, driver_groups: [] }
]

const renderList = (props = {}) => {
  const handleUpdateDeliveryService = vi.fn()
  const view = renderWithProviders(
    <DeliveryServicesList
      deliveryServicesState={{ loading: false, companies }}
      searchValue=''
      handleOpenDetails={vi.fn()}
      handleUpdateDeliveryService={handleUpdateDeliveryService}
      {...props}
    />,
    { theme }
  )
  return { ...view, handleUpdateDeliveryService }
}

const switchOf = (container, index) => container.querySelectorAll('.group-enabled input')[index]

describe('DeliveryServicesList enable switch', () => {
  it('updates the company of the row when no company is open', () => {
    const { container, handleUpdateDeliveryService } = renderList()
    fireEvent.click(switchOf(container, 0))
    expect(handleUpdateDeliveryService).toHaveBeenCalledWith(133, { enabled: false })
  })

  it('updates the company of the row even while another company is open', () => {
    const { container, handleUpdateDeliveryService } = renderList({ deliveryServiceId: '166' })
    fireEvent.click(switchOf(container, 0))
    expect(handleUpdateDeliveryService).toHaveBeenCalledWith(133, { enabled: false })
  })
})

describe('DeliveryServicesList install button', () => {
  const pending = [
    { id: 200, name: 'Pending One', enabled: false, plugin_id: null, plugin_root: 'https://one.plugins.test', driver_groups: [] },
    { id: 201, name: 'Pending Two', enabled: false, plugin_id: null, plugin_root: 'https://two.plugins.test', driver_groups: [] }
  ]

  it('installs the company of the row without reloading the page', () => {
    const handleInstallDeliveryService = vi.fn()
    const handleOpenDetails = vi.fn()
    const { getAllByText } = renderList({ deliveryServicesState: { loading: false, companies: pending }, handleInstallDeliveryService, handleOpenDetails })
    fireEvent.click(getAllByText('Install')[1])
    expect(handleInstallDeliveryService).toHaveBeenCalledWith(pending[1])
    expect(handleOpenDetails).not.toHaveBeenCalled()
  })

  it('shows Installing on the company being installed and blocks the other installs', () => {
    const handleInstallDeliveryService = vi.fn()
    const { getByText, getAllByRole } = renderList({
      deliveryServicesState: { loading: false, companies: pending },
      handleInstallDeliveryService,
      installingPluginRoot: 'https://one.plugins.test'
    })
    expect(getByText('Installing...')).toBeTruthy()
    getAllByRole('button').forEach(button => expect(button.disabled).toBe(true))
  })
})
