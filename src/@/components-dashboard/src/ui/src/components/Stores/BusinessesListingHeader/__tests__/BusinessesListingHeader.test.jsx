import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../Shared', () => ({ SearchBar: () => null, LearnDropDown: () => null }))
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }] }))
vi.mock('../../ImportersButton', () => ({ ImportersButton: () => <button>Importers</button> }))
vi.mock('../../BusinessFilterGroup', () => ({ BusinessFilterGroup: () => null }))
import { BusinessesListingHeader } from '../index'

describe('BusinessesListingHeader', () => {
  it('keeps the store actions without the Sync button', () => {
    renderWithProviders(
      <BusinessesListingHeader
        filterValues={{}}
        allowBusinessRegister
        handleRefreshBusinesses={vi.fn()}
        handleGotToAdd={vi.fn()}
      />,
      { theme: dashboardTheme }
    )
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importers' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add new store' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sync' })).not.toBeInTheDocument()
  })
})
