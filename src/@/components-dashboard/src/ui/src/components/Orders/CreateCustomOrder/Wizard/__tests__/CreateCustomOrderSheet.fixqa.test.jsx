/* eslint-disable import/first */
import React, { useEffect } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign fix-qa E3: inside the real Sheet, Escape in a sub view of the customer step goes back one level;
// only an Escape on the step itself reaches the discard question.
vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: url => url }],
  useCustomer: () => [{}, { setUserCustomer: vi.fn(), deleteUserCustomer: vi.fn() }],
  useConfig: () => [{ configs: { default_country_code: { value: 'us' } } }]
}))
vi.mock('../../../../../utils', () => ({ findExitingCountryPhoneCode: () => '1' }))
vi.mock('../../../../Users', () => ({ UserAddForm: () => <form><h1>New user</h1></form> }))
vi.mock('../../../../Delivery', () => ({
  AddressList: () => <div id='address_control'><button type='button'>Add new address</button></div>
}))

const customer = { id: 4, name: 'Ana', lastname: 'Perez', cellphone: '5550001111', addresses: [{ id: 1 }] }
const address = { id: 1, address: '1 Main St', location: { lat: 1, lng: 2 } }

// The wizard content is covered elsewhere; here the real customer step runs with a customer already picked.
const flags = vi.hoisted(() => ({ throwWizard: false }))

vi.mock('../../CustomOrderDetails', () => ({
  CustomOrderDetails: props => {
    if (flags.throwWizard) throw new TypeError("Cannot read properties of undefined (reading 'maps')")
    useEffect(() => {
      props.onDirtyChange?.(true)
      return () => props.onDirtyChange?.(false)
    }, [])
    return (
      <>
        <h3 tabIndex={-1} data-wizard-step-title=''>Customer</h3>
        <SelectCustomer
          phone=''
          customersPhones={{ users: [], loading: false, error: null }}
          selectedUser={customer}
          setSelectedUser={() => {}}
          onChangeNumber={() => {}}
          customerAddress={address}
          hideTitle
        />
      </>
    )
  }
}))

import { SelectCustomer } from '../../SelectCustomer'
import { CreateCustomOrder } from '../../index'

let consoleError
// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

beforeEach(() => {
  flags.throwWizard = false
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleError.mockRestore()
  document.getElementById('app-modals')?.remove()
})

describe('CreateCustomOrder · Escape inside the customer step', () => {
  it('leaves the address view first and asks about discarding only on the next Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateCustomOrder />)
    await user.click(screen.getByRole('button', { name: 'Create custom order' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create custom order' })

    // redesign N-05: the wizard is a lazy chunk, so it is found, not assumed
    await user.click(await within(dialog).findByRole('button', { name: 'Change' }))
    const panel = dialog.querySelector('#address_list')
    await waitFor(() => expect(within(panel).getByRole('heading', { name: 'Ana Perez' })).toHaveFocus())

    await user.keyboard('{Escape}')
    expect(dialog.querySelector('#address_list')).toBeNull()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Create custom order' })).toBeInTheDocument()

    // The focus came back to the button that opened the view, inside the Sheet: the next Escape is the Sheet's.
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Change' })).toHaveFocus())
    await user.keyboard('{Escape}')
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard this order?')
  })
})

describe('CreateCustomOrder · a runtime error in the wizard', () => {
  it('stays inside the Sheet, with a message and a way to close, and does not blank the page', async () => {
    flags.throwWizard = true
    const user = userEvent.setup()
    renderWithProviders(<div><p>Orders page</p><CreateCustomOrder /></div>)
    await user.click(screen.getByRole('button', { name: 'Create custom order' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create custom order' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be shown') // redesign N-05: lazy chunk
    expect(screen.getByText('Orders page')).toBeInTheDocument()

    flags.throwWizard = false
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))
    expect(await within(dialog).findByRole('heading', { name: 'Customer', level: 3 })).toBeInTheDocument()
  })
})
