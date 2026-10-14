import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useApi: () => [{ project: 'luisv4plus' }],
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  IntegrationLogs: () => null,
  Modal: ({ open, title, children }) => open
    ? (
      <div role='dialog' aria-label={title}>{children}</div>
      )
    : null
}))

import { BusinessIntegration } from '../index'

const square = {
  id: 430,
  name: 'Square POS Integration',
  plugin_id: 2477,
  plugin: {
    name: 'Square',
    root: 'https://square.test',
    links: {
      general_settings: '/views/settings?project_code=@{project_code}&token=@{access_token}',
      setup: '/views/setup?project_code=@{project_code}&token=@{access_token}&business_id=@{business_id}'
    }
  }
}

const renderPanel = () => renderWithProviders(
  <BusinessIntegration
    business={{ id: 628, third_party_integrations: [{ third_party_integration_id: 430, enabled: true }] }}
    selectedIntegration={square}
    formState={{ changes: {} }}
    setFormState={vi.fn()}
    handleConnectBusiness={vi.fn()}
    handleDisconnectBusiness={vi.fn()}
    handlePushAction={vi.fn()}
  />,
  { theme }
)

describe('BusinessIntegration plugin links', () => {
  it('opens the setup link from the Setup button with the store id filled in', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Setup' }))
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://square.test/views/setup?project_code=luisv4plus&token=test-token&business_id=628')
  })

  it('keeps General settings on the settings link', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'General settings' }))
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://square.test/views/settings?project_code=luisv4plus&token=test-token')
  })
})
