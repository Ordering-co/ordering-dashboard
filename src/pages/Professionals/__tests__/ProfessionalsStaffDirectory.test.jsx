import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

// redesign (B1c): the page is the staff directory driven by the professional kind, as ManagersList is for admins; the stub
// records what it is given. The old ProfessionalListing is still in the tree but this page no longer mounts it.
const seen = vi.hoisted(() => ({ staffListing: null, professionalListing: null }))

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
    },
    ProfessionalAddForm: function ProfessionalAddFormMock () { return null },
    ProfessionalListing: (props) => {
      seen.professionalListing = props
      return React.createElement('div', { 'data-testid': 'page-ui' })
    }
  }
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return createComponentsPageMocks()
})

vi.mock('../../../config', () => ({ default: {} }))

import { Professionals } from '../index'

beforeEach(() => {
  seen.staffListing = null
  seen.professionalListing = null
})

describe('Professionals page (staff directory)', () => {
  it('renders its helmet tags and the staff directory', () => {
    renderWithProviders(<Professionals />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'professionals')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })

  it('is the staff directory of the professional kind, reading the address', () => {
    renderWithProviders(<Professionals />)

    expect(seen.staffListing).toMatchObject({ kind: 'professional', isUseQuery: true })
    expect(seen.professionalListing).toBeNull()
  })

  it('does not carry the level, the fields, the title or the redirect: they live in the kind and the directory', () => {
    renderWithProviders(<Professionals />)

    expect(seen.staffListing).not.toHaveProperty('defaultUserTypesSelected')
    expect(seen.staffListing).not.toHaveProperty('propsToFetch')
    expect(seen.staffListing).not.toHaveProperty('onUserRedirect')
    expect(seen.staffListing).not.toHaveProperty('headerTitle')
  })

  it('injects main\'s professional add form as AddForm (the directory itself does not import it)', async () => {
    const { ProfessionalAddForm } = await import('~ui')
    renderWithProviders(<Professionals />)

    expect(seen.staffListing.AddForm).toBe(ProfessionalAddForm)
  })

  it('keeps the props the router gives it', () => {
    renderWithProviders(<Professionals someRouterProp='x' />)

    expect(seen.staffListing).toMatchObject({ someRouterProp: 'x', kind: 'professional' })
  })
})
