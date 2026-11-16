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

import { ProfessionalListing } from '../ProfessionalListing'

describe('users listings take the command palette search (?q=)', () => {
  it.each([
    ['ProfessionalListing', ProfessionalListing, '/users/professionals?q=ana']
  ])('%s', (_name, Listing, path) => {
    received.props = null
    renderWithProviders(<Listing isUseQuery defaultUserTypesSelected={[0]} />, { initialEntries: [path] })
    expect(received.props.searchSeed).toMatchObject({ value: 'ana' })
    expect(received.props.isSearchByUserName).toBe(true)
  })
})
