import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({ user: { level: 0 } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: mockState.user }],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }]
}))

import { GoogleMapsApiKeySettingButton } from '../index'

describe('GoogleMapsApiKeySettingButton', () => {
  beforeEach(() => {
    mockState.user = { level: 0 }
  })

  // (R-4): the read-only admin cannot open Settings, so the notice stays and the link goes
  it('keeps the missing-key notice without the Settings link for a read-only admin', () => {
    mockState.user = { level: 0, readOnlyAdmin: true }
    renderWithProviders(<GoogleMapsApiKeySettingButton />)

    expect(screen.getByText('Google Maps API key is missing.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add it in Settings' })).not.toBeInTheDocument()
  })

  it('warns and links to Settings instead of editing the key here', () => {
    renderWithProviders(<GoogleMapsApiKeySettingButton />)

    expect(screen.getByText('Google Maps API key is missing.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add it in Settings' }))
      .toHaveAttribute('href', '/settings?group=locations&category=google_maps')
    expect(screen.queryByRole('button', { name: 'Instructions here' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Add API Key')).not.toBeInTheDocument()
  })

  // redesign W1-2 (T1-2-4): token colours (no literal fallbacks) and a link of at least 24px (44px hit area on touch).
  it('styles the notice with product tokens and gives the link a 24px floor and a touch hit area', () => {
    renderWithProviders(<GoogleMapsApiKeySettingButton />)
    const css = Array.from(document.querySelectorAll('style')).map(node => node.textContent).join('\n')

    expect(css).toContain('var(--od-warning-soft)')
    expect(css).toContain('var(--od-warning-signal)')
    expect(css).not.toMatch(/#fff8e6|#f9b959/i)
    expect(css).toMatch(/min-block-size:var\(--od-x-target-fine\)/)
    expect(css).toMatch(/@media \(pointer:coarse\)[^]*inset:var\(--od-x-target-inset\)/)
  })
})
