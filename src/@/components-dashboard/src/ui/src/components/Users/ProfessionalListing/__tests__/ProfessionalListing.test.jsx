/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../ProfessionalList', () => ({ ProfessionalList: () => <div data-testid='professional-list' /> }))
vi.mock('../../UsersListingHeader', () => ({ UsersListingHeader: () => null }))
vi.mock('../../UserActiveStateFilter', () => ({ UserActiveStateFilter: () => null }))
vi.mock('../../UserDetailsLateralBar', () => ({ UserDetailsLateralBar: () => null }))
vi.mock('../../ProfessionalAddForm', () => ({ ProfessionalAddForm: () => null }))
vi.mock('../../UsersDeleteButton', () => ({ UsersDeleteButton: () => null }))
vi.mock('../../UsersExportCSV', () => ({ UsersExportCSV: () => null }))
vi.mock('../../OccupationsFilter', () => ({ OccupationsFilter: () => null }))
vi.mock('../../../Shared', () => ({ Alert: () => null, SideBar: () => null }))

vi.mock('../../../../styles', () => ({
  Button: ({ children, borderRadius, ...props }) => <button {...props}>{children}</button>
}))

vi.mock('../../../../hooks/useOneShotQuery', () => ({ useOpenFromQuery: vi.fn() }))
vi.mock('../../../../hooks/useListingSearchSeed', () => ({ useListingSearchSeed: () => undefined }))

vi.mock('../../../../utils', () => ({
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  UsersList: ({ UIComponent, ...props }) => (
    <UIComponent {...props} usersList={{ loading: false, users: [] }} occupationsState={{ occupations: [] }} />
  )
}))

import { ProfessionalListing } from '..'

describe('ProfessionalListing', () => {
  it('lets a project without any appointments config manage professionals', () => {
    renderWithProviders(<ProfessionalListing />)

    expect(screen.getByTestId('professional-list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add professional' })).toBeInTheDocument()
    expect(screen.queryByText('The appointments feature is not enabled.')).not.toBeInTheDocument()
  })
})
