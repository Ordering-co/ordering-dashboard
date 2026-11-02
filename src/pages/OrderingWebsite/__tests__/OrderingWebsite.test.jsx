import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

const { websiteProps } = vi.hoisted(() => ({ websiteProps: vi.fn() }))

vi.mock('~ui', async () => {
  const { createUiPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return { ...createUiPageMocks(), OrderingWebsite: (props) => { websiteProps(props); return <div data-testid='page-ui' /> } }
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return createComponentsPageMocks()
})

vi.mock('../../../config', () => ({ default: {} }))

import { OrderingWebsite } from '../index'

describe('OrderingWebsite page', () => {
  it('renders its main controller', () => {
    renderWithProviders(<OrderingWebsite />)

    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('creates no website, and shows the migration only when VITE_WEBSITE_MIGRATION is true', () => {
    vi.stubEnv('VITE_WEBSITE_MIGRATION', '')
    renderWithProviders(<OrderingWebsite />)
    expect(websiteProps).toHaveBeenLastCalledWith(expect.objectContaining({ withMigration: false, disableSiteCreation: true }))

    vi.stubEnv('VITE_WEBSITE_MIGRATION', 'true')
    renderWithProviders(<OrderingWebsite />)
    expect(websiteProps).toHaveBeenLastCalledWith(expect.objectContaining({ withMigration: true, disableSiteCreation: true }))
  })
})
