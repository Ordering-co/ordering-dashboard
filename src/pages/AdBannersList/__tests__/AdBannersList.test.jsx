import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

vi.mock('~ui', () => ({
  AdBannersListing: (props) => (
    <div data-testid='ad-banners-listing' data-has-props={String(!!props)} />
  )
}))

import { AdBannersList } from '../index'

describe('AdBannersList page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders helmet tags and wired UI controller', () => {
    renderWithProviders(<AdBannersList />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'ad_banners')
    expect(screen.getByTestId('ad-banners-listing')).toBeInTheDocument()
  })
})
