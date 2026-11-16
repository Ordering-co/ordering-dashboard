import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

// redesign AD-B1: the page is the staff directory driven by the admin kind; the stub records what it is given
const seen = vi.hoisted(() => ({ staffListing: null }))

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

vi.mock('~ui', async () => {
  const { createUiPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  const React = await import('react')
  const base = await createUiPageMocks()
  return {
    ...base,
    StaffListing: (props) => {
      seen.staffListing = props
      return React.createElement('div', { 'data-testid': 'page-ui' })
    }
  }
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return createComponentsPageMocks()
})

vi.mock('../../../config', () => ({ default: {} }))

import { ManagersList } from '../index'

beforeEach(() => {
  seen.staffListing = null
})

describe('ManagersList page', () => {
  it('renders its helmet tags and main controller', () => {
    renderWithProviders(<ManagersList />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'admins')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })

  it('is the staff directory of the admin kind, reading the address', () => {
    renderWithProviders(<ManagersList />)

    expect(seen.staffListing).toMatchObject({ kind: 'admin', isUseQuery: true })
  })

  it('does not carry the level, the fields or the Learn entries: they live in the kind and the directory', () => {
    renderWithProviders(<ManagersList />)

    expect(seen.staffListing).not.toHaveProperty('defaultUserTypesSelected')
    expect(seen.staffListing).not.toHaveProperty('propsToFetch')
    expect(seen.staffListing).not.toHaveProperty('onUserRedirect')
    expect(seen.staffListing).not.toHaveProperty('headerTitle')
    expect(seen.staffListing).not.toHaveProperty('learnOptions')
  })

  it('keeps the props the router gives it', () => {
    renderWithProviders(<ManagersList someRouterProp='x' />)

    expect(seen.staffListing).toMatchObject({ someRouterProp: 'x', kind: 'admin' })
  })
})
