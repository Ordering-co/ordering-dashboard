/* eslint-disable import/first */
import React, { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign F6d (Q3-09): picking the customer unmounts the phone field, the element that had the focus. The focus
// used to fall to <body> (outside the wizard dialog); it goes to the customer summary now.
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }],
  useCustomer: () => [{}, { setUserCustomer: vi.fn(), deleteUserCustomer: vi.fn() }],
  useConfig: () => [{ configs: { default_country_code: { value: 'us' } } }]
}))
vi.mock('../../../../utils', () => ({ findExitingCountryPhoneCode: () => '1' }))
vi.mock('../../../Users', () => ({ UserAddForm: () => null }))
vi.mock('../../../Delivery', () => ({ AddressList: () => <button type='button'>Add new address</button> }))

import { SelectCustomer } from '../SelectCustomer'

const customer = { id: 4, name: 'Ana', lastname: 'Perez', cellphone: '5550001111' }

const Harness = ({ address = { id: 1, address: '1 Main St', location: { lat: 1, lng: 2 } } }) => {
  const [selectedUser, setSelectedUser] = useState(null)
  return (
    <SelectCustomer
      phone='5550001111'
      customersPhones={{ users: [customer], loading: false, error: null }}
      selectedUser={selectedUser}
      setSelectedUser={setSelectedUser}
      onChangeNumber={vi.fn()}
      customerAddress={selectedUser ? address : null}
      hideTitle
    />
  )
}

describe('SelectCustomer · focus after picking the customer (Q3-09)', () => {
  it('moves the focus to the customer summary when the customer is picked with the keyboard', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(screen.getByRole('combobox', { name: 'Phone number' }))
    await user.keyboard('{ArrowDown}{Enter}')
    const summary = await screen.findByRole('button', { name: /^Change customer/ })
    expect(summary).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('does the same when the customer is picked with a click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(screen.getByRole('combobox', { name: 'Phone number' }))
    await user.click(await screen.findByRole('option', { name: /Ana Perez/ }))
    expect(await screen.findByRole('button', { name: /^Change customer/ })).toHaveFocus()
  })

  it('leaves the focus to the address view when the customer has no address and that view opens by itself', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness address={null} />)
    await user.click(screen.getByRole('combobox', { name: 'Phone number' }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Change customer/ })).not.toBeInTheDocument()
  })
})
