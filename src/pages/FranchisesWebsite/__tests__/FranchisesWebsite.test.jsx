import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
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
  // the controller stand-in shows the site it got and picks another one, as the site picker (or the fallback) does
  const { useHistory, useLocation } = await import('react-router-dom')
  const OrderingWebsite = (props) => {
    const location = useLocation()
    const history = useHistory()
    // what the sections editor does to change section: it rebuilds the address from the router's location
    const goToImages = () => {
      const next = new URLSearchParams(location.search)
      next.set('section', 'images')
      history.replace({ pathname: location.pathname, search: `?${next.toString()}` })
    }
    return (
      <div data-testid='page-ui' data-app-id={props.appId} data-layout={props.layout}>
        <button type='button' onClick={() => props.setAppIdState('web_franchises_2')}>pick site</button>
        <button type='button' onClick={goToImages}>go to images</button>
        <output data-testid='location'>{location.pathname + location.search}</output>
      </div>
    )
  }
  return { ...createComponentsPageMocks(), OrderingWebsite }
})

vi.mock('../../../config', () => ({ default: {} }))

import { FranchisesWebsite } from '../index'

describe('FranchisesWebsite page', () => {
  it('renders its helmet tags and main controller', () => {
    renderWithProviders(<FranchisesWebsite />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'franchises_website')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })

  // redesign J5 row 54 (franchises-website P-FW2, ; with P-FW4 already in, ): the chosen site lives in the address
  it('opens the site of ?appId= and writes the site picked afterwards into ?appId=, which a section change keeps', () => {
    renderWithProviders(<FranchisesWebsite />, { initialEntries: ['/my-products/franchises-website?appId=web_franchises_1'] })
    expect(screen.getByTestId('page-ui')).toHaveAttribute('data-app-id', 'web_franchises_1')
    fireEvent.click(screen.getByRole('button', { name: 'pick site' }))
    expect(screen.getByTestId('page-ui')).toHaveAttribute('data-app-id', 'web_franchises_2')
    expect(screen.getByTestId('location')).toHaveTextContent('/my-products/franchises-website?appId=web_franchises_2')
    // review J5 #1: the address was written outside the router and a section change put the old site back
    fireEvent.click(screen.getByRole('button', { name: 'go to images' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/my-products/franchises-website?appId=web_franchises_2&section=images')
  })

  // redesign J5 row 52 (ordering-website P-OW3, ): the franchise website is edited with the sections editor
  it('asks for the sections editor', () => {
    renderWithProviders(<FranchisesWebsite />)
    expect(screen.getByTestId('page-ui')).toHaveAttribute('data-layout', 'sections')
  })
})
