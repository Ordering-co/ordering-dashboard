/* eslint-disable import/first */
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign fix-qa E9: when the order options of the customer's address cannot be loaded, the wizard says so in
// the step, with the text the API gave, instead of the empty «Error / Accept» modal of the global Alert.
const mocks = vi.hoisted(() => ({ changeAddress: null, retryType: null }))

vi.mock('../../../../../../../index', () => ({
  // P5-02: the translation of the app, by key; a key it does not know answers the fallback text.
  useLanguage: () => [null, (key, fallback) => ({ INTERNAL_ERROR: 'Internal error. Try again later.' }[key] ?? fallback)],
  useUtils: () => [{ parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  useOrder: () => [{ loading: false, options: { type: 1 } }, { changeAddress: (...args) => mocks.changeAddress(...args) }],
  useValidationFields: () => [{ fields: { checkout: {} } }],
  CustomOrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../SelectCustomer', () => ({ SelectCustomer: () => <input aria-label='Phone number' /> }))
// redesign F6d (Q3-12): the selector hands its refusals to the wizard (`onFailure`), which owns the one banner.
vi.mock('../../OrderTypeSelector', () => ({
  OrderTypeSelector: ({ onFailure }) => (
    <div data-testid='order-type'>
      <button type='button' onClick={() => onFailure?.('Pickup is not available for this address', mocks.retryType)}>Refuse type</button>
      <button type='button' onClick={() => onFailure?.(null)}>Accept type</button>
    </div>
  )
}))
vi.mock('../../SelectBusinesses', () => ({ SelectBusinesses: () => <div data-testid='select-businesses' /> }))
vi.mock('../../Map', () => ({ Map: () => <div data-testid='map' /> }))
vi.mock('../../SelectProducts', () => ({ SelectProducts: () => <input aria-label='Search products' /> }))
vi.mock('../../Checkout', () => ({ Checkout: () => <div data-testid='checkout' /> }))

import { CustomOrderDetails } from '../../CustomOrderDetails'

const selectedUser = { id: 1, name: 'Ana', lastname: 'Perez', cellphone: '5550001111' }
const customerAddress = { id: 7, address: '1 Main St', location: { lat: 1, lng: 2 } }
const selectedBusiness = { id: 5, slug: 'store', name: 'Corner Store' }

const baseProps = () => ({
  phone: '',
  onChangeNumber: vi.fn(),
  customersPhones: { users: [], loading: false, error: null },
  setCustomersPhones: vi.fn(),
  businessList: { loading: false, businesses: [selectedBusiness] },
  selectedUser,
  selectedBusiness,
  setSelectedUser: vi.fn(),
  setSelectedBusiness: vi.fn(),
  productList: { loading: false, products: [] },
  getProducts: vi.fn(),
  handeUpdateProductCart: vi.fn(),
  cart: null,
  onClose: vi.fn(),
  handleOpenCustomOrderDetail: vi.fn(),
  handlePlaceOrderByTotal: vi.fn(),
  extraFields: {},
  setExtraFields: vi.fn(),
  actionState: { loading: false, error: null },
  customerAddress
})

const renderWizard = (extra = {}) => renderWithProviders(<CustomOrderDetails {...baseProps()} {...extra} />)
const withProduct = { cart: { products: [{ id: 1, name: 'Burger', quantity: 1 }], total: 10 } }
const continueButton = () => screen.getByRole('button', { name: /^Continue$/ })

beforeEach(() => {
  mocks.changeAddress = vi.fn().mockResolvedValue({ ok: true })
  mocks.retryType = vi.fn()
})

describe('Create custom order wizard · order options of the address (E9)', () => {
  it('asks for the options silently, so the global Alert stays closed', async () => {
    renderWizard()
    await waitFor(() => expect(mocks.changeAddress).toHaveBeenCalledTimes(1))
    expect(mocks.changeAddress).toHaveBeenCalledWith(7, undefined, { silent: true })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says it in the customer step with the text of the API when the options fail', async () => {
    mocks.changeAddress = vi.fn().mockResolvedValue({ ok: false, error: 'Address out of coverage' })
    renderWizard()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Address out of coverage')
    expect(alert).not.toBeEmptyDOMElement()
  })

  it('keeps saying it in the business step, where the options are needed', async () => {
    mocks.changeAddress = vi.fn().mockResolvedValue({ ok: false, error: 'Address out of coverage' })
    renderWizard()
    await screen.findByRole('alert')
    const user = userEvent.setup()
    await user.click(continueButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Address out of coverage')
    expect(screen.getByTestId('select-businesses')).toBeInTheDocument()
  })

  it('falls back to a generic sentence when the failure carries no text', async () => {
    mocks.changeAddress = vi.fn().mockResolvedValue({ ok: false, error: '' })
    renderWizard()
    expect(await screen.findByRole('alert')).toHaveTextContent('The options for this address could not be loaded.')
  })

  it('Try again asks again and clears the message when it works', async () => {
    mocks.changeAddress = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'Address out of coverage' })
      .mockResolvedValueOnce({ ok: true })
    renderWizard()
    const alert = await screen.findByRole('alert')
    const user = userEvent.setup()
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(mocks.changeAddress).toHaveBeenCalledTimes(2)
    expect(mocks.changeAddress).toHaveBeenLastCalledWith(7, undefined, { silent: true })
  })

  it('a changeAddress that answers nothing (no session) is not an error', async () => {
    mocks.changeAddress = vi.fn().mockResolvedValue(undefined)
    renderWizard()
    await waitFor(() => expect(mocks.changeAddress).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // redesign F6d (Q3-12): a refused order type never opens a dialog on top of the banner.
  // redesign F6e (P5-01): the type refusal and the options failure are two different problems with their own
  // notice and their own action; each says one sentence and offers one action.
  it('shows a refused order type in its own notice next to the options one, never in a dialog', async () => {
    mocks.changeAddress = vi.fn().mockResolvedValue({ ok: false, error: '' })
    renderWizard()
    await screen.findByRole('alert')
    const user = userEvent.setup()
    await user.click(continueButton())
    await user.click(await screen.findByRole('button', { name: 'Refuse type' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent('The options for this address could not be loaded.')
    expect(alerts[1]).toHaveTextContent('Pickup is not available for this address')
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
  })

  it('clears the banner when the order type is accepted afterwards', async () => {
    renderWizard()
    const user = userEvent.setup()
    await waitFor(() => expect(mocks.changeAddress).toHaveBeenCalled())
    await user.click(continueButton())
    await user.click(await screen.findByRole('button', { name: 'Refuse type' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Accept type' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  // redesign F6e (P5-02): the options failure is translated the way the type failure and the global Alert of main are.
  it('translates an error key of the options failure instead of writing INTERNAL_ERROR (P5-02)', async () => {
    mocks.changeAddress = vi.fn().mockResolvedValue({ ok: false, error: 'INTERNAL_ERROR' })
    renderWizard()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Internal error. Try again later.')
    expect(alert).not.toHaveTextContent('INTERNAL_ERROR')
  })

  // redesign F6e (P5-01)
  describe('two errors, two notices (P5-01)', () => {
    const refuseTypeInBusiness = async (user) => {
      await waitFor(() => expect(mocks.changeAddress).toHaveBeenCalled())
      await user.click(continueButton())
      await user.click(await screen.findByRole('button', { name: 'Refuse type' }))
      return screen.findByText('Pickup is not available for this address')
    }

    it('a type change that works does not clear the options failure', async () => {
      mocks.changeAddress = vi.fn().mockResolvedValue({ ok: false, error: 'Address out of coverage' })
      renderWizard()
      await screen.findByText('Address out of coverage')
      const user = userEvent.setup()
      await user.click(continueButton())
      await user.click(await screen.findByRole('button', { name: 'Accept type' }))
      expect(screen.getByText('Address out of coverage')).toBeInTheDocument()
    })

    it('Try again on the type notice retries the type, and does not save the address again', async () => {
      const user = userEvent.setup()
      renderWizard()
      const notice = (await refuseTypeInBusiness(user)).closest('[role="alert"]')
      expect(mocks.changeAddress).toHaveBeenCalledTimes(1)
      await user.click(within(notice).getByRole('button', { name: 'Try again' }))
      expect(mocks.retryType).toHaveBeenCalledTimes(1)
      expect(mocks.changeAddress).toHaveBeenCalledTimes(1)
    })

    it('Try again on the options notice retries the options, and does not touch the type notice', async () => {
      mocks.changeAddress = vi.fn()
        .mockResolvedValueOnce({ ok: false, error: 'Address out of coverage' })
        .mockResolvedValueOnce({ ok: true })
      const user = userEvent.setup()
      renderWizard()
      await screen.findByText('Address out of coverage')
      await user.click(continueButton())
      await user.click(await screen.findByRole('button', { name: 'Refuse type' }))
      const options = screen.getByText('Address out of coverage').closest('[role="alert"]')
      await user.click(within(options).getByRole('button', { name: 'Try again' }))
      await waitFor(() => expect(screen.queryByText('Address out of coverage')).not.toBeInTheDocument())
      expect(mocks.changeAddress).toHaveBeenCalledTimes(2)
      expect(mocks.retryType).not.toHaveBeenCalled()
      expect(screen.getByText('Pickup is not available for this address')).toBeInTheDocument()
    })

    it('the type notice follows the operator to Items and Payment until it is resolved', async () => {
      const user = userEvent.setup()
      renderWizard(withProduct)
      await refuseTypeInBusiness(user)
      await user.click(continueButton())
      expect(await screen.findByRole('heading', { name: 'Items' })).toBeInTheDocument()
      expect(screen.getByText('Pickup is not available for this address')).toBeInTheDocument()
      await user.click(continueButton())
      expect(await screen.findByRole('heading', { name: 'Payment' })).toBeInTheDocument()
      expect(screen.getByText('Pickup is not available for this address')).toBeInTheDocument()
    })

    it('the options notice follows the operator to Items too', async () => {
      mocks.changeAddress = vi.fn().mockResolvedValue({ ok: false, error: 'Address out of coverage' })
      const user = userEvent.setup()
      renderWizard(withProduct)
      await screen.findByText('Address out of coverage')
      await user.click(continueButton())
      await user.click(continueButton())
      expect(await screen.findByRole('heading', { name: 'Items' })).toBeInTheDocument()
      expect(screen.getByText('Address out of coverage')).toBeInTheDocument()
    })

    it('each notice has one sentence and one action: «Try again» is not said twice', async () => {
      mocks.changeAddress = vi.fn().mockResolvedValue({ ok: false, error: '' })
      const user = userEvent.setup()
      renderWizard()
      await refuseTypeInBusiness(user)
      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(2)
      for (const alert of alerts) {
        expect(within(alert).getAllByRole('button')).toHaveLength(1)
        expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(alert.textContent.match(/try again/gi)).toHaveLength(1)
      }
    })

    it('the type notice goes when the customer is cleared (its selector is gone)', async () => {
      const user = userEvent.setup()
      const view = renderWizard()
      await refuseTypeInBusiness(user)
      view.rerender(<CustomOrderDetails {...baseProps()} customerAddress={null} selectedUser={null} />)
      await waitFor(() => expect(screen.queryByText('Pickup is not available for this address')).not.toBeInTheDocument())
    })
  })
})
