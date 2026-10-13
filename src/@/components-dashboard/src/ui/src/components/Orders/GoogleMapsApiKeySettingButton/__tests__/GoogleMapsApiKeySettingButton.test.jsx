import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { GoogleMapsApiKeySettingButton } from '../index'

describe('GoogleMapsApiKeySettingButton', () => {
  it('warns and links to Settings instead of editing the key here', () => {
    renderWithProviders(<GoogleMapsApiKeySettingButton />)

    expect(screen.getByText('Google Maps API key is missing.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add it in Settings' }))
      .toHaveAttribute('href', '/settings?group=locations&category=google_maps')
    expect(screen.queryByRole('button', { name: 'Instructions here' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Add API Key')).not.toBeInTheDocument()
  })
})
