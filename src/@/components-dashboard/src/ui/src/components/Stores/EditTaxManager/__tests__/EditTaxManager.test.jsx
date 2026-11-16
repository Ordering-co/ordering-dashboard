/* eslint-disable import/first */
// redesign stores 5.12 (E2): the add/edit form of a tax or a product fee on Product, modal layout (the one
// S/ProductDetailsAdvanced keeps inside its legacy Modal). Before that, redesign stores 1.A (G4-10): the form waits for the save,
// so a tax the API rejects does not disappear with what the user typed.
import React, { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', async (importOriginal) => ({
  ...(await importOriginal()),
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('../../../Shared', async (importOriginal) => ({
  ...(await importOriginal()),
  RecipientSelect: (props) => <div data-testid='recipient' data-value={props.value} />
}))

import { EditTaxManager } from '../index'
import { setup } from './testHarness'

const typedTax = { name: 'City tax', description: 'Local tax', rate: 8 }

// The parent controller as it really stores an emptied order-type rate (C/BusinessDetails handleChangeTax): `null`, not the NaN
// the shared harness gets from parseFloat('').
const RealParent = ({ spy, handleSave, ...props }) => {
  const [formChanges, setFormChanges] = useState(props.initial || {})
  const onChange = (name, value, orderType) => {
    spy(name, value, orderType)
    setFormChanges(previous => {
      if (!orderType) return { ...previous, [name]: value }
      const isEmpty = value === '' || value === null || value === undefined
      return {
        ...previous,
        order_type_rates: {
          ...previous.order_type_rates,
          [orderType]: { ...previous.order_type_rates?.[orderType], [name]: isEmpty ? null : parseFloat(value) }
        }
      }
    })
  }
  const { initial: _initial, ...rest } = props // eslint-disable-line no-unused-vars
  return (
    <ThemeProvider theme={{ colors: {} }}>
      <EditTaxManager type='taxes' {...rest} formChanges={formChanges} onChange={onChange} handleSave={handleSave} onClose={() => {}} />
    </ThemeProvider>
  )
}
const setupReal = (props) => {
  const spy = vi.fn()
  const handleSave = vi.fn().mockResolvedValue({ id: 1 })
  render(<RealParent spy={spy} handleSave={handleSave} {...props} />)
  return { spy, handleSave }
}

const accept = () => screen.getByRole('button', { name: 'Accept' })
const submit = async () => {
  await act(async () => { fireEvent.click(accept()) })
  for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
}
const rateField = () => screen.getByLabelText(/^Rate \(%\)/)

describe('EditTaxManager · tax fields', () => {
  it('draws the Product fields, the type, the switch, the disclosure closed and the footer', () => {
    setup({ initial: typedTax })
    expect(screen.getByLabelText(/^Name/).value).toBe('City tax')
    expect(screen.getByLabelText(/^Description/).value).toBe('Local tax')
    expect(rateField().value).toBe('8')
    const type = screen.getByRole('radiogroup', { name: 'Type' })
    expect(within(type).getByRole('radio', { name: 'Included on price' }).getAttribute('aria-checked')).toBe('true')
    expect(within(type).getByRole('radio', { name: 'Not included on price' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('switch', { name: 'Apply to fees' }).getAttribute('aria-checked')).toBe('false')
    const rates = screen.getByRole('button', { name: 'Rates by order type' })
    expect(rates.tagName).toBe('BUTTON')
    expect(rates.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(accept().getAttribute('type')).toBe('submit')
  })

  it('shows the stored record when nothing is pending, and the pending change over it', () => {
    setup({ data: { value: 5, name: 'VAT', description: 'Value added', rate: 21, type: 2, apply_to_fees: true }, initial: { name: 'VAT 2' } })
    expect(screen.getByLabelText(/^Name/).value).toBe('VAT 2')
    expect(screen.getByLabelText(/^Description/).value).toBe('Value added')
    expect(rateField().value).toBe('21')
    expect(screen.getByRole('radio', { name: 'Not included on price' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Apply to fees' }).getAttribute('aria-checked')).toBe('true')
  })

  it('sends every change through onChange(field, value)', async () => {
    const user = userEvent.setup()
    const { spy } = setup()
    await user.type(screen.getByLabelText(/^Name/), 'A')
    expect(spy).toHaveBeenLastCalledWith('name', 'A')
    await user.click(screen.getByRole('radio', { name: 'Not included on price' }))
    expect(spy).toHaveBeenLastCalledWith('type', 2)
    await user.click(screen.getByRole('switch', { name: 'Apply to fees' }))
    expect(spy).toHaveBeenLastCalledWith('apply_to_fees', true)
    await user.type(rateField(), '7')
    expect(spy).toHaveBeenLastCalledWith('rate', 7)
  })

  it('takes only numbers in the rate, and sends an empty string when it is cleared', async () => {
    const user = userEvent.setup()
    const { spy } = setup({ initial: typedTax })
    await user.type(rateField(), 'abc')
    expect(rateField().value).toBe('8')
    await user.clear(rateField())
    expect(spy).toHaveBeenLastCalledWith('rate', '')
    expect(rateField().value).toBe('')
  })

  it('accepts a rate above 100 (main only checked that it was a number) and sends it', async () => {
    const { handleSave, onClose } = setup({ initial: { ...typedTax, rate: 150 } })
    expect(rateField().value).toBe('150')
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
    expect(within(rateField().closest('.odc-field')).queryByRole('alert')).toBeNull()
  })

  it('blocks the save when the rate is below 0, with the «0 or more» message', async () => {
    const { handleSave } = setup({ initial: { ...typedTax, rate: -1 } })
    await submit()
    expect(handleSave).not.toHaveBeenCalled()
    expect(within(rateField().closest('.odc-field')).getByRole('alert').textContent).toBe('Enter a number, 0 or more.')
  })

  it('accepts 0 as a rate', async () => {
    const { handleSave } = setup({ initial: { ...typedTax, rate: 0 } })
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(1)
  })

  it('says under each field what is required, instead of an alert', async () => {
    const { handleSave } = setup()
    await submit()
    expect(handleSave).not.toHaveBeenCalled()
    expect(within(screen.getByLabelText(/^Name/).closest('.odc-field')).getByRole('alert').textContent).toBe('The name is required')
    expect(within(screen.getByLabelText(/^Description/).closest('.odc-field')).getByRole('alert').textContent).toBe('The Description is required')
    expect(within(rateField().closest('.odc-field')).getByRole('alert').textContent).toBe('Tax rate is required')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('clears the message of a field when it is edited', async () => {
    const user = userEvent.setup()
    setup()
    await submit()
    await user.type(screen.getByLabelText(/^Name/), 'A')
    expect(within(screen.getByLabelText(/^Name/).closest('.odc-field')).queryByRole('alert')).toBeNull()
  })

  it('draws the recipient picker for taxes', () => {
    setup({ initial: typedTax })
    expect(screen.getByTestId('recipient').getAttribute('data-value')).toBe('business')
  })

  it('calls onClose from the secondary Close button', () => {
    const { onClose, handleSave } = setup({ initial: typedTax })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(handleSave).not.toHaveBeenCalled()
  })
})

describe('EditTaxManager · closes only after a save that did not fail', () => {
  it('saves with the id and the type only (two arguments) and closes after it', async () => {
    const handleSave = vi.fn().mockResolvedValue({ id: 31 })
    const { onClose } = setup({ data: { value: 31, name: 'a', description: 'b', rate: 3 }, handleSave })
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(1)
    expect(handleSave.mock.calls[0]).toEqual([31, 'taxes'])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(handleSave.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0])
  })

  it('saves a new record with an undefined id and closes when handleSave resolves undefined', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined)
    const { onClose } = setup({ initial: typedTax, handleSave })
    await submit()
    expect(handleSave.mock.calls[0]).toEqual([undefined, 'taxes'])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the form open with what was typed and says why when the save returns { ok: false }', async () => {
    const handleSave = vi.fn().mockResolvedValue({ ok: false, error: ['Name already exists'] })
    const { onClose } = setup({ initial: typedTax, handleSave })
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^Name/).value).toBe('City tax')
    expect(rateField().value).toBe('8')
    expect(screen.getByText('Name already exists')).toBeTruthy()
  })

  it('says the generic reason when the failure has none', async () => {
    const handleSave = vi.fn().mockResolvedValue({ ok: false })
    setup({ initial: typedTax, handleSave })
    await submit()
    expect(screen.getByText('The tax could not be saved.')).toBeTruthy()
  })

  it('keeps the form open when handleSave throws', async () => {
    const handleSave = vi.fn().mockRejectedValue(new Error('boom'))
    const { onClose } = setup({ initial: typedTax, handleSave })
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('The tax could not be saved.')).toBeTruthy()
  })

  it('removes the failure notice when the save is tried again', async () => {
    const handleSave = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ id: 1 })
    const { onClose } = setup({ initial: typedTax, handleSave })
    await submit()
    expect(screen.getByText('The tax could not be saved.')).toBeTruthy()
    await submit()
    expect(screen.queryByText('The tax could not be saved.')).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores a second Accept while the save runs', async () => {
    let finish
    const handleSave = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const { onClose } = setup({ initial: typedTax, handleSave })
    await submit()
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(1)
    expect(accept().getAttribute('aria-busy')).toBe('true')
    await act(async () => { finish({ ok: false, error: ['x'] }) })
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() })
    expect(accept().getAttribute('aria-busy')).toBeNull()
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(2)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('EditTaxManager · rates by order type', () => {
  it('starts closed for a record without rates, and opens and closes with the button', async () => {
    const user = userEvent.setup()
    setup({ initial: typedTax })
    const button = screen.getByRole('button', { name: 'Rates by order type' })
    expect(screen.queryByRole('group', { name: 'Delivery' })).toBeNull()
    await user.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    for (const name of ['Delivery', 'Pickup', 'Eat in']) expect(screen.getByRole('group', { name })).toBeTruthy()
    await user.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('group', { name: 'Delivery' })).toBeNull()
  })

  it('starts open when the record already has a rate for an order type', () => {
    setup({ data: { value: 2, name: 'a', description: 'b', rate: 3, order_type_rates: { pickup: { rate: 5, type: 2 } } } })
    expect(screen.getByRole('button', { name: 'Rates by order type' }).getAttribute('aria-expanded')).toBe('true')
    const pickup = screen.getByRole('group', { name: 'Pickup' })
    expect(within(pickup).getByLabelText(/^Rate \(%\)/).value).toBe('5')
    expect(within(pickup).getByRole('radio', { name: 'Not included on price' }).getAttribute('aria-checked')).toBe('true')
    const delivery = screen.getByRole('group', { name: 'Delivery' })
    expect(within(delivery).getByLabelText(/^Rate \(%\)/).value).toBe('')
    expect(within(delivery).getByRole('radio', { name: 'Included on price' }).getAttribute('aria-checked')).toBe('true')
  })

  it('shows the pending value over the stored one', () => {
    setup({
      data: { value: 2, name: 'a', description: 'b', rate: 3, order_type_rates: { delivery: { rate: 5, type: 1 } } },
      initial: { order_type_rates: { delivery: { rate: 9, type: 1 } } }
    })
    expect(within(screen.getByRole('group', { name: 'Delivery' })).getByLabelText(/^Rate \(%\)/).value).toBe('9')
  })

  it('sends the rate and the type together, for the order type that changed', async () => {
    const user = userEvent.setup()
    const { spy } = setup({ initial: typedTax })
    await user.click(screen.getByRole('button', { name: 'Rates by order type' }))
    await user.type(within(screen.getByRole('group', { name: 'Delivery' })).getByLabelText(/^Rate \(%\)/), '4')
    expect(spy).toHaveBeenCalledWith('rate', 4, 'delivery')
    expect(spy).toHaveBeenCalledWith('type', 1, 'delivery')
    const calls = spy.mock.calls.length
    await user.click(within(screen.getByRole('group', { name: 'Pickup' })).getByRole('radio', { name: 'Not included on price' }))
    const pair = spy.mock.calls.slice(calls)
    expect(pair).toEqual([['type', 2, 'pickup'], ['rate', '', 'pickup']])
  })

  it('sends an empty string when a rate is cleared, keeping its type', async () => {
    const user = userEvent.setup()
    const { spy } = setup({
      data: { value: 2, name: 'a', description: 'b', rate: 3, order_type_rates: { eatin: { rate: 5, type: 2 } } }
    })
    const eatin = screen.getByRole('group', { name: 'Eat in' })
    await user.clear(within(eatin).getByLabelText(/^Rate \(%\)/))
    expect(spy).toHaveBeenCalledWith('rate', '', 'eatin')
    expect(spy).toHaveBeenCalledWith('type', 2, 'eatin')
  })

  it('accepts a rate above 100 for an order type and sends it', async () => {
    const user = userEvent.setup()
    const { handleSave } = setup({ initial: { ...typedTax, order_type_rates: { delivery: { rate: 150, type: 1 } } } })
    await user.click(screen.getByRole('button', { name: 'Rates by order type' }))
    expect(within(screen.getByRole('group', { name: 'Delivery' })).getByLabelText(/^Rate \(%\)/).value).toBe('150')
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(1)
    expect(within(screen.getByRole('group', { name: 'Delivery' })).queryByRole('alert')).toBeNull()
  })

  it('blocks the save with the «0 or more» message under the rate of the order type that is below 0', async () => {
    const user = userEvent.setup()
    const { handleSave } = setup({ initial: { ...typedTax, order_type_rates: { delivery: { rate: -1, type: 1 } } } })
    await user.click(screen.getByRole('button', { name: 'Rates by order type' }))
    await submit()
    expect(handleSave).not.toHaveBeenCalled()
    const delivery = screen.getByRole('group', { name: 'Delivery' })
    expect(within(delivery).getByRole('alert').textContent).toBe('Enter a number, 0 or more.')
  })

  describe('a rate that the user cleared (stored 5, pending empty)', () => {
    const stored = { value: 2, name: 'a', description: 'b', rate: 3, order_type_rates: { delivery: { rate: 5, type: 1 } } }
    const deliveryRate = () => within(screen.getByRole('group', { name: 'Delivery' })).getByLabelText(/^Rate \(%\)/)

    it('shows the field empty (not the stored value again) once the pending rate is empty', () => {
      setupReal({ data: stored, initial: { order_type_rates: { delivery: { rate: null, type: 1 } } } })
      expect(deliveryRate().value).toBe('')
    })

    it('keeps the field empty after clearing it, and still saves', async () => {
      const user = userEvent.setup()
      const { spy, handleSave } = setupReal({ data: stored })
      expect(deliveryRate().value).toBe('5')
      await user.clear(deliveryRate())
      expect(spy).toHaveBeenCalledWith('rate', '', 'delivery')
      expect(deliveryRate().value).toBe('')
      await submit()
      expect(handleSave).toHaveBeenCalledTimes(1)
      expect(within(screen.getByRole('group', { name: 'Delivery' })).queryByRole('alert')).toBeNull()
    })

    it('keeps the rate cleared when the Type of that order type is changed later', async () => {
      const user = userEvent.setup()
      const { spy } = setupReal({ data: stored })
      await user.clear(deliveryRate())
      const calls = spy.mock.calls.length
      await user.click(within(screen.getByRole('group', { name: 'Delivery' })).getByRole('radio', { name: 'Not included on price' }))
      const after = spy.mock.calls.slice(calls)
      expect(after).toContainEqual(['type', 2, 'delivery'])
      const rates = after.filter(([name]) => name === 'rate')
      expect(rates.length).toBeGreaterThan(0)
      for (const call of rates) expect(call).toEqual(['rate', '', 'delivery']) // never the stored 5 again
      expect(deliveryRate().value).toBe('')
    })
  })

  it('treats a cleared rate of an order type as no rate, not as an error', async () => {
    const { handleSave } = setup({ initial: { ...typedTax, order_type_rates: { delivery: { rate: NaN, type: 1 } } } })
    await submit()
    expect(handleSave).toHaveBeenCalledTimes(1)
  })

  it('does not draw the disclosure for a fee', () => {
    setup({ type: 'fees', initial: { name: 'a', description: 'b', fixed: 1, percentage: 2 } })
    expect(screen.queryByRole('button', { name: 'Rates by order type' })).toBeNull()
  })
})

describe('EditTaxManager · fee', () => {
  const fee = { name: 'Service', description: 'Service fee', fixed: 1.5, percentage: 10 }

  it('draws Fixed, Percentage and Taxable (on by default) and no tax-only controls', () => {
    setup({ type: 'fees', initial: fee })
    expect(screen.getByLabelText(/^Fixed/).value).toBe('1.5')
    expect(screen.getByLabelText(/^Percentage \(%\)/).value).toBe('10')
    expect(screen.getByRole('switch', { name: 'Taxable' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('radiogroup', { name: 'Type' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Apply to fees' })).toBeNull()
    expect(screen.queryByLabelText(/^Rate/)).toBeNull()
    expect(screen.queryByTestId('recipient')).toBeNull()
  })

  it('draws the recipient picker only when the target is a customer', () => {
    setup({ type: 'fees', data: { value: 3, target: 'customer', ...fee } })
    expect(screen.getByTestId('recipient')).toBeTruthy()
  })

  it('sends the changes: numbers for the amounts and a boolean for Taxable', async () => {
    const user = userEvent.setup()
    const { spy } = setup({ type: 'fees', initial: fee })
    await user.type(screen.getByLabelText(/^Fixed/), '2')
    expect(spy).toHaveBeenLastCalledWith('fixed', 1.52)
    await user.click(screen.getByRole('switch', { name: 'Taxable' }))
    expect(spy).toHaveBeenLastCalledWith('taxable', false)
  })

  it('blocks the save when the percentage is above 100, and says which field is required', async () => {
    const { handleSave } = setup({ type: 'fees', initial: { name: 'a', description: 'b', percentage: 120 } })
    await submit()
    expect(handleSave).not.toHaveBeenCalled()
    expect(within(screen.getByLabelText(/^Percentage \(%\)/).closest('.odc-field')).getByRole('alert').textContent).toBe('Enter a percentage from 0 to 100.')
    expect(within(screen.getByLabelText(/^Fixed/).closest('.odc-field')).getByRole('alert').textContent).toBe('Fee fixed is required')
  })

  it('saves with the id and "fees" and says the fee reason when it fails', async () => {
    const handleSave = vi.fn().mockResolvedValue({ ok: false })
    const { onClose } = setup({ type: 'fees', data: { value: 9, ...fee }, handleSave })
    await submit()
    expect(handleSave.mock.calls[0]).toEqual([9, 'fees'])
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('The fee could not be saved.')).toBeTruthy()
  })
})
