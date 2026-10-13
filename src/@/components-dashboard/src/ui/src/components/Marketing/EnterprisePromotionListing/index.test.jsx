import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../../../../../index', () => ({
  EnterprisePromotionList: props => {
    const Component = props.UIComponent
    return (
      <Component
        {...props}
        promotionListState={{ promotions: [], loading: false, error: null }}
        sitesState={{ sites: [], loading: false }}
        paymethodsState={{ paymethods: [], loading: false }}
        businessesList={{ businesses: [], loading: false }}
        businessesPaginationProps={{ currentPage: 1, totalPages: 1 }}
        paginationProps={{ currentPage: 1, totalPages: 1 }}
        getPromotions={vi.fn()}
        loadAllJourneyBusinesses={vi.fn().mockResolvedValue([])}
      />
    )
  },
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [{}, (key, fallback) => fallback || key],
  useSession: () => [{ user: { level: 0 } }]
}))

vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../Shared', () => ({
  Alert: () => null,
  LearnDropDown: () => null,
  SearchBar: () => <input aria-label='Search' />,
  SideBar: ({ children }) => <div>{children}</div>
}))

vi.mock('../PromotionJourneysListing', async () => {
  const actual = await vi.importActual('../PromotionJourneysListing/journeyUtils')
  return {
    PromotionJourneysListingUI: ({ onOpenAdvancedPromotion }) => (
      <div data-testid='journeys-content'>
        Journeys content
        <button type='button' onClick={() => onOpenAdvancedPromotion?.({ id: 42 })}>Edit excluded promotion</button>
      </div>
    ),
    ...actual
  }
})

vi.mock('../EnterprisePromotionList', () => ({ EnterprisePromotionList: () => <div data-testid='advanced-offers-content'>Advanced content</div> }))
vi.mock('../EnterprisePromotionDetails', () => ({ EnterprisePromotionDetails: ({ promotionId }) => <div data-testid='advanced-promotion-id'>{promotionId}</div> }))

import { EnterprisePromotionListing } from './index'

const theme = {
  colors: {
    primary: '#266DF0',
    lightPrimary: '#EAF1FE',
    backgroundPage: '#FFFFFF',
    headingColor: '#0B0C0D',
    borderColor: '#DEE0E3'
  }
}

const renderWorkspace = initialEntry => render(
  <ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[initialEntry]}>
      <EnterprisePromotionListing />
    </MemoryRouter>
  </ThemeProvider>
)

describe('EnterprisePromotionListing workspace', () => {
  test('opens Quick offers by default and switches tabs without a blank state', () => {
    renderWorkspace('/marketing/promotions-enterprise')

    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Quick offers' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Advanced offers' }))
    expect(screen.getByTestId('advanced-offers-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Advanced offers' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Quick offers' }))
    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
  })

  test('preserves legacy promotion deep links by opening Advanced offers', () => {
    renderWorkspace('/marketing/promotions-enterprise?id=42')

    expect(screen.getByTestId('advanced-offers-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Advanced offers' })).toHaveAttribute('aria-selected', 'true')
  })

  test('an explicit Quick offers view wins over a stale promotion id', () => {
    renderWorkspace('/marketing/promotions-enterprise?view=journeys&id=42')

    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
    expect(screen.queryByTestId('advanced-offers-content')).not.toBeInTheDocument()
  })

  test('routes unsupported Quick offer edits to the matching Advanced promotion', () => {
    renderWorkspace('/marketing/promotions-enterprise?view=journeys')

    fireEvent.click(screen.getByRole('button', { name: 'Edit excluded promotion' }))

    expect(screen.getByTestId('advanced-offers-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Advanced offers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('42')
  })
})
