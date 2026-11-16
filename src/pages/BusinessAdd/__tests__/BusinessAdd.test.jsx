import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

const received = vi.hoisted(() => ({ props: null }))

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

vi.mock('~ui', async () => {
  const { createUiPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  const mocks = await createUiPageMocks()
  return {
    ...mocks,
    BusinessAdd: (props) => {
      received.props = props
      return <div data-testid='page-ui' />
    }
  }
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return createComponentsPageMocks()
})

vi.mock('../../../config', () => ({ default: {} }))

import { BusinessAdd } from '../index'

describe('BusinessAdd page', () => {
  it('renders its helmet tags and main controller', () => {
    renderWithProviders(<BusinessAdd />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'business_add')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })

  // the list's «Add your first store» says so in the navigation
  it('passes the tutorial and the place of the address on to the add', () => {
    renderWithProviders(
      <MemoryRouter initialEntries={[{ pathname: '/stores/add', search: '?placeId=abc', state: { continueTutorial: true } }]}>
        <BusinessAdd />
      </MemoryRouter>
    )
    expect(received.props).toMatchObject({ placeId: 'abc', continueTutorial: true })
  })

  // G5-32: the place id is read by name, whatever other params the URL carries.
  it.each([
    ['/stores/add?placeId=ChIJ123', 'ChIJ123'],
    ['/stores/add?placeId=ChIJ123&utm_source=mail', 'ChIJ123'],
    ['/stores/add?utm_source=mail&placeId=ChIJ123', 'ChIJ123']
  ])('passes the placeId of %s', (entry, placeId) => {
    renderWithProviders(<BusinessAdd />, { initialEntries: [entry] })

    expect(received.props.placeId).toBe(placeId)
  })

  it('passes no placeId when the URL has none', () => {
    renderWithProviders(<BusinessAdd />, { initialEntries: ['/stores/add?utm_source=mail'] })

    expect(received.props.placeId).toBeUndefined()
  })
})
