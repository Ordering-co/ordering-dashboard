/* eslint-disable import/first */
import React from 'react'
import { act, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign fix-qa E3: the address and user sub views of the customer step (focus, Escape, embedded address list).
const mocks = vi.hoisted(() => ({ addressList: { current: null } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }],
  useCustomer: () => [{}, { setUserCustomer: vi.fn(), deleteUserCustomer: vi.fn() }],
  useConfig: () => [{ configs: { default_country_code: { value: 'us' } } }]
}))
vi.mock('../../../../utils', () => ({ findExitingCountryPhoneCode: () => '1' }))

// Like the real form: it draws its own heading.
vi.mock('../../../Users', () => ({
  UserAddForm: () => (
    <form>
      <h1>New user</h1>
      <input aria-label='Name' />
    </form>
  )
}))
vi.mock('../../../Delivery', () => ({
  AddressList: props => {
    mocks.addressList.current = props
    return <div id='address_control'><button type='button'>Add new address</button></div>
  }
}))

import { SelectCustomer } from '../SelectCustomer'

const customer = { id: 4, name: 'Ana', lastname: 'Perez', cellphone: '5550001111', addresses: [{ id: 1 }] }
const address = { id: 1, address: '1 Main St', location: { lat: 1, lng: 2 } }

const renderStep = (overrides = {}) => {
  const props = {
    phone: '5550001111',
    customersPhones: { users: [], loading: false, error: null },
    selectedUser: customer,
    setSelectedUser: vi.fn(),
    onChangeNumber: vi.fn(),
    customerAddress: address,
    ...overrides
  }
  return renderWithProviders(<SelectCustomer {...props} />)
}

let outerKeys
const spy = event => outerKeys(event.key)
beforeEach(() => {
  mocks.addressList.current = null
  outerKeys = vi.fn()
  document.addEventListener('keydown', spy)
})
afterEach(() => document.removeEventListener('keydown', spy))

describe('SelectCustomer · address view', () => {
  it('opens the embedded address list: the brand version of the list, not the legacy panel', async () => {
    const user = userEvent.setup()
    renderStep()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    expect(mocks.addressList.current.isEmbedded).toBe(true)
  })

  it('moves the focus to the title of the view when it opens', async () => {
    const user = userEvent.setup()
    const { container } = renderStep()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    const panel = container.querySelector('#address_list')
    await waitFor(() => expect(within(panel).getByRole('heading', { name: 'Ana Perez' })).toHaveFocus())
  })

  it('Escape goes back to the step and the Sheet behind never hears it', async () => {
    const user = userEvent.setup()
    const { container } = renderStep()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await waitFor(() => expect(within(container.querySelector('#address_list')).getByRole('heading', { name: 'Ana Perez' })).toHaveFocus())
    outerKeys.mockClear()
    await user.keyboard('{Escape}')
    expect(container.querySelector('#address_list')).toBeNull()
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
    expect(outerKeys).not.toHaveBeenCalledWith('Escape')
  })

  it('asks "Select customer address" over the list, and not over the form that opens inside it', async () => {
    const user = userEvent.setup()
    renderStep()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.getByText('Select customer address')).toBeInTheDocument()
    act(() => mocks.addressList.current.setExtraOpen(true))
    expect(screen.queryByText('Select customer address')).not.toBeInTheDocument()
    act(() => mocks.addressList.current.setExtraOpen(false))
    expect(screen.getByText('Select customer address')).toBeInTheDocument()
  })

  it('puts the focus back on the button that opened the view when it closes', async () => {
    const user = userEvent.setup()
    const { container } = renderStep()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(within(container.querySelector('#address_list')).getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change' })).toHaveFocus())
  })
})

describe('SelectCustomer · new user view', () => {
  it('moves the focus to the heading of the form and Escape goes back to the search', async () => {
    const user = userEvent.setup()
    const { container } = renderStep({ selectedUser: null, customerAddress: null })
    await user.click(screen.getByRole('button', { name: 'New user' }))
    const panel = container.querySelector('#user_add_form')
    await waitFor(() => expect(within(panel).getByRole('heading', { name: 'New user' })).toHaveFocus())
    outerKeys.mockClear()
    await user.keyboard('{Escape}')
    expect(container.querySelector('#user_add_form')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Phone number' })).toBeInTheDocument()
    expect(outerKeys).not.toHaveBeenCalledWith('Escape')
  })

  it('an Escape from outside the view is left alone', async () => {
    const user = userEvent.setup()
    const { container } = renderStep({ selectedUser: null, customerAddress: null })
    await user.click(screen.getByRole('button', { name: 'New user' }))
    const outside = document.body.appendChild(document.createElement('button'))
    outside.focus()
    await user.keyboard('{Escape}')
    expect(container.querySelector('#user_add_form')).not.toBeNull()
    outside.remove()
  })
})
