/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const received = vi.hoisted(() => ({ props: null }))

vi.mock('../../../../../components/UsersList', () => ({
  UsersList: (props) => {
    received.props = props
    return null
  }
}))

import { UsersListing } from '../UsersListing'
import { ProfessionalListing } from '../ProfessionalListing'
import { DeliveryUsersListing } from '../../Delivery/DeliveryUsersListing'

describe('users listings take the command palette search (?q=)', () => {
  it.each([
    ['UsersListing (admins, owners, call center)', UsersListing, '/users/admins?q=ana'],
    ['ProfessionalListing', ProfessionalListing, '/users/professionals?q=ana'],
    ['DeliveryUsersListing (drivers, driver managers)', DeliveryUsersListing, '/delivery/drivers-list?q=ana']
  ])('%s', (_name, Listing, path) => {
    received.props = null
    renderWithProviders(<Listing isUseQuery defaultUserTypesSelected={[0]} />, { initialEntries: [path] })
    expect(received.props.searchSeed).toMatchObject({ value: 'ana' })
    expect(received.props.isSearchByUserName).toBe(true)
  })

  it('ignores ?q= when the page does not use the query string', () => {
    received.props = null
    renderWithProviders(<UsersListing defaultUserTypesSelected={[0]} />, { initialEntries: ['/users/admins?q=ana'] })
    expect(received.props.searchSeed).toBeNull()
  })
})
