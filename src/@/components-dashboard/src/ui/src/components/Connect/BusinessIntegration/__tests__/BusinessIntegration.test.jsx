import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const state = vi.hoisted(() => ({ level: 2 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useApi: () => [{ project: 'luisv4plus' }],
  useSession: () => [{ token: 'test-token', user: { level: state.level } }]
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

const renderPanel = (overrides = {}) => renderWithProviders(
  <BusinessIntegration
    business={{ id: 628, third_party_integrations: [{ third_party_integration_id: 430, enabled: true }] }}
    selectedIntegration={square}
    formState={{ changes: {} }}
    setFormState={vi.fn()}
    handleConnectBusiness={vi.fn()}
    handleDisconnectBusiness={vi.fn()}
    handlePushAction={vi.fn()}
    {...overrides}
  />,
  { theme }
)

describe('BusinessIntegration plugin links', () => {
  it.each([
    'https://calendly.com/pos/meet',
    'HTTP://calendly.com/pos/meet',
    '//calendly.com/pos/meet'
  ])('opens admin booking URL %s without prepending the plugin root', (link) => {
    state.level = 0
    renderPanel({ selectedIntegration: { ...square, plugin: { ...square.plugin, links: { book_call: link } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Book call' }))
    expect(document.querySelector('iframe')).toHaveAttribute('src', link)
  })

  it.each([0, 2])('preserves absolute non-Calendly setup and template variables for level %s', (level) => {
    state.level = level
    renderPanel({ selectedIntegration: { ...square, plugin: { ...square.plugin, links: { setup: 'https://setup.test/views/setup?business_id=@{business_id}' } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Setup' }))
    expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://setup.test/views/setup?business_id=628')
  })

  it.each([0, 2])('preserves non-Calendly setup with the store id for level %s', (level) => {
    state.level = level
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Setup' }))
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://square.test/views/setup?project_code=luisv4plus&token=test-token&business_id=628')
  })

  it.each([0, 2])('preserves non-Calendly General settings for level %s', (level) => {
    state.level = level
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'General settings' }))
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://square.test/views/settings?project_code=luisv4plus&token=test-token')
  })

  it.each([2, undefined])('disables Calendly links only for non-admin level %s', (level) => {
    state.level = level
    renderPanel({ selectedIntegration: { ...square, plugin: { ...square.plugin, links: { ...square.plugin.links, book_call: 'https://calendly.com/pos/meet' } } } })
    const contactAdmin = screen.getByRole('button', { name: 'Contact admin' })
    expect(contactAdmin).toBeDisabled()
    expect(contactAdmin).not.toHaveAttribute('href')
    fireEvent.click(contactAdmin)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Setup' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'General settings' })).toBeEnabled()
  })

  it.each([
    [0, false],
    [2, true]
  ])('preserves Calendly plugin links for level %s with Sales Channels %s', (level, fromSalesChannels) => {
    state.level = level
    renderPanel({ fromSalesChannels, selectedIntegration: { ...square, plugin: { name: 'Booking', root: 'https://calendly.com', links: { book_call: '/pos/meet' } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Book call' }))
    expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://calendly.com/pos/meet')
  })
})
