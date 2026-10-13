import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const websiteState = vi.hoisted(() => ({ url: null }))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: value => value }],
  useEvent: () => [{ emit: vi.fn() }],
  useApi: () => [{ project: '22sept' }],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 2 } }]
}))

vi.mock('~ui', async () => {
  const React = await import('react')
  return {
    Confirm: () => null,
    Alert: () => null,
    Modal: ({ open, children }) => open ? React.createElement('div', { role: 'dialog' }, children) : null,
    useWindowSize: () => ({ width: 1200 })
  }
})

vi.mock('react-bootstrap', async () => {
  const React = await import('react')
  return {
    Dropdown: {
      Item: ({ children, ...props }) => React.createElement('button', { type: 'button', ...props }, children)
    },
    DropdownButton: ({ children }) => React.createElement('div', null, children)
  }
})

vi.mock('../../../../hooks/useWebsiteUrl', () => ({
  useStoreWebsiteUrl: () => websiteState.url
}))
vi.mock('../../../../hooks/useUserSelectedAccess', () => ({ useSelectedAccessRole: () => false }))
vi.mock('../../../../../utils/businessConfigSections', () => ({ getBusinessConfigSections: () => [] }))
vi.mock('../../../../../utils/businessDetailSections', () => ({
  EATSTREET_PROJECTS: [],
  isBusinessSectionEnabled: () => false
}))
vi.mock('../../BusinessPreview', async () => {
  const React = await import('react')
  return { BusinessPreview: () => React.createElement('div', { 'data-testid': 'business-preview' }) }
})
vi.mock('../../SnoozeComponent', () => ({ SnoozeComponent: () => null }))

import { BusinessSummary } from '../index'

const business = {
  name: 'Chick-fil-A',
  slug: 'chick_fil_a',
  enabled: true,
  configs: {},
  third_party_integrations: []
}

const renderSummary = (overrides = {}) => renderWithProviders(
  <BusinessSummary
    isAdmin={false}
    businessState={{ loading: false, business }}
    formState={{ loading: false, changes: {} }}
    actionSidebar={vi.fn()}
    handleChangeActiveBusiness={vi.fn()}
    handleSelectedItem={vi.fn()}
    handleUpdateBusinessClick={vi.fn()}
    handleDeleteBusiness={vi.fn()}
    handleDuplicateBusiness={vi.fn()}
    handleSyncClover={vi.fn()}
    setFormState={vi.fn()}
    setIsExpand={vi.fn()}
    {...overrides}
  />,
  { theme: themeJson }
)

beforeEach(() => {
  websiteState.url = 'https://v26-22sept.orderingplus.com/store/chick_fil_a'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BusinessSummary store preview', () => {
  it('opens the shared store URL in a new tab without mounting the preview modal', () => {
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderSummary()

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(openWindow).toHaveBeenCalledWith(
      'https://v26-22sept.orderingplus.com/store/chick_fil_a',
      '_blank'
    )
    expect(screen.queryByTestId('business-preview')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    ['subscription URL is unresolved', null, false],
    ['business is loading', 'https://v26-22sept.orderingplus.com/store/chick_fil_a', true]
  ])('disables Preview when the %s', (_reason, url, loading) => {
    websiteState.url = url
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderSummary({ businessState: { loading, business } })

    const previewButton = screen.getByRole('button', { name: 'Preview' })
    expect(previewButton).toBeDisabled()
    fireEvent.click(previewButton)
    expect(openWindow).not.toHaveBeenCalled()
  })
})
