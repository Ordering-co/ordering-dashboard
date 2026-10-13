import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

vi.mock('~ui', async () => {
  const { createUiPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return createUiPageMocks()
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return createComponentsPageMocks()
})

vi.mock('../../../config', () => ({ default: {} }))

import { Schools } from '../index'

describe('Schools page', () => {
  it('renders its helmet tags and main controller', () => {
    renderWithProviders(<Schools />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'schools')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })
})
