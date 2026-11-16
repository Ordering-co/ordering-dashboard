import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../@/components-dashboard/src/index', () => ({
  useApi: () => [{ project: 'tenant-a' }],
  PluginList: ({ projectCode }) => <div data-testid='plugin-controller'>{projectCode}</div>
}))

import { PluginList } from '../@/components-dashboard/src/ui/src/components/Settings/PluginList'

afterEach(() => localStorage.clear())

describe('tenant props for authenticated controllers', () => {
  it('uses the active API tenant for plugins while preserving a global selection from another project', () => {
    localStorage.setItem('project', 'tenant-b')
    render(<PluginList />)
    expect(screen.getByTestId('plugin-controller')).toHaveTextContent('tenant-a')
    expect(localStorage.getItem('project')).toBe('tenant-b')
  })
  // the old Connect/DeliveryServiceDetails was deleted as dead code; the provider panel that replaced it passes the API
  // tenant as projectCode, covered by DeliveryServicesDirectory/__tests__/ProviderPanel.test.jsx
})
