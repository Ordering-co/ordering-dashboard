import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../@/components-dashboard/src/index', () => ({
  useApi: () => [{ project: 'tenant-a' }],
  PluginList: ({ projectCode }) => <div data-testid='plugin-controller'>{projectCode}</div>,
  DeliveryServiceDetails: ({ projectCode }) => <div data-testid='delivery-controller'>{projectCode}</div>
}))

import { PluginList } from '../@/components-dashboard/src/ui/src/components/Settings/PluginList'
import { DeliveryServiceDetails } from '../@/components-dashboard/src/ui/src/components/Connect/DeliveryServiceDetails'

afterEach(() => localStorage.clear())

describe('tenant props for authenticated controllers', () => {
  it('uses the active API tenant for plugins while preserving a global selection from another project', () => {
    localStorage.setItem('project', 'tenant-b')
    render(<PluginList />)
    expect(screen.getByTestId('plugin-controller')).toHaveTextContent('tenant-a')
    expect(localStorage.getItem('project')).toBe('tenant-b')
  })

  it('uses the active API tenant for delivery services while preserving a global selection from another project', () => {
    localStorage.setItem('project', 'tenant-b')
    render(<DeliveryServiceDetails />)
    expect(screen.getByTestId('delivery-controller')).toHaveTextContent('tenant-a')
    expect(localStorage.getItem('project')).toBe('tenant-b')
  })
})
