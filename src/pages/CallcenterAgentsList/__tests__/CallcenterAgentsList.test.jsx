import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

// redesign CA-B1: the page is the staff directory driven by the call center agent kind; the stub records what it is given
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

import { CallcenterAgentsList } from '../index'

beforeEach(() => {
  seen.staffListing = null
})

describe('CallcenterAgentsList page', () => {
  it('renders its helmet tags and main controller', () => {
    renderWithProviders(<CallcenterAgentsList />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'callcenter_agents')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })

  it('is the staff directory of the call center agent kind, reading the address', () => {
    renderWithProviders(<CallcenterAgentsList />)

    expect(seen.staffListing).toMatchObject({ kind: 'callcenter_agent', isUseQuery: true })
  })

  it('does not carry the level or the fields: they live in the kind and the directory', () => {
    renderWithProviders(<CallcenterAgentsList />)

    expect(seen.staffListing).not.toHaveProperty('defaultUserTypesSelected')
    expect(seen.staffListing).not.toHaveProperty('propsToFetch')
    expect(seen.staffListing).not.toHaveProperty('onUserRedirect')
    expect(seen.staffListing).not.toHaveProperty('headerTitle')
  })

  it('keeps the props the router gives it', () => {
    renderWithProviders(<CallcenterAgentsList someRouterProp='x' />)

    expect(seen.staffListing).toMatchObject({ someRouterProp: 'x', kind: 'callcenter_agent' })
  })
})
