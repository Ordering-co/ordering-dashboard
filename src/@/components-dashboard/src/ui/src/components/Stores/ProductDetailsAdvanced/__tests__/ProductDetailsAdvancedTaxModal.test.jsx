/* eslint-disable import/first */
// redesign stores 5.12 (E2): smoke test of the one consumer of S/EditTaxManager that is not redesigned. The product editor opens the
// tax form inside its legacy Modal («Add new tax»), with the modal layout of the form: it must keep adding a tax and closing after it.
// The controller is a stand-in that keeps `taxToEdit` and `formTaxChanges` like the real one (`handleChangeTax` as in the controller).
import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

const probe = vi.hoisted(() => ({ handleSaveTax: null }))

vi.mock('../../../../../../index', async (importOriginal) => {
  const ReactModule = await import('react')
  return {
    ...(await importOriginal()),
    useLanguage: () => [{}, (_key, text) => text],
    useSession: () => [{ user: { level: 0 }, token: 'x' }],
    useUtils: () => [{ parsePrice: value => String(value), optimizeImage: url => url }],
    ProductDetailsAdvanced: ({ UIComponent, ...props }) => {
      const [taxToEdit, setTaxToEdit] = ReactModule.useState({ action: null, payload: null })
      const [formTaxChanges, setFormTaxChanges] = ReactModule.useState({})
      const [alertState, setAlertState] = ReactModule.useState({ open: false, content: [] })
      const handleChangeTax = (name, value, orderType) => {
        if (orderType) {
          setFormTaxChanges(prev => ({
            ...prev,
            order_type_rates: { ...prev.order_type_rates, [orderType]: { ...prev.order_type_rates?.[orderType], [name]: parseFloat(value) } }
          }))
        } else {
          setFormTaxChanges(prev => ({ ...prev, [name]: value }))
        }
      }
      return ReactModule.createElement(UIComponent, {
        ...props,
        formState: { changes: {}, loading: false },
        productState: { product: {}, loading: false },
        business: { id: 1 },
        taxes: {},
        fees: {},
        taxToEdit,
        setTaxToEdit,
        formTaxChanges,
        setFormTaxChanges,
        alertState,
        setAlertState,
        handleChangeTax,
        handleSaveTax: (...args) => probe.handleSaveTax(...args),
        handleDeleteTax: vi.fn(),
        handleClickProperty: vi.fn(),
        handleClickProperties: vi.fn(),
        handleUpdateClick: vi.fn()
      })
    }
  }
})

import { ProductDetailsAdvanced } from '../index'

const settle = async () => {
  for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
}

const openTaxEditor = async (user) => {
  render(
    <ThemeProvider theme={{ colors: {}, fonts: {}, images: {} }}>
      <ProductDetailsAdvanced />
    </ThemeProvider>
  )
  await user.click(screen.getByText('Add new tax'))
}

const fillTax = async (user) => {
  await user.type(screen.getByLabelText(/^Name/), 'City tax')
  await user.type(screen.getByLabelText(/^Description/), 'Local tax')
  await user.type(screen.getByLabelText(/^Rate \(%\)/), '8')
}

describe('ProductDetailsAdvanced · the tax form in its legacy Modal', () => {
  it('opens the tax form with the type preset, adds the tax with handleSaveTax(undefined, "taxes") and closes', async () => {
    probe.handleSaveTax = vi.fn().mockResolvedValue({ id: 5 })
    const user = userEvent.setup()
    await openTaxEditor(user)
    expect(screen.getByText('Add tax')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Included on price' }).getAttribute('aria-checked')).toBe('true')
    await fillTax(user)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Accept' })) })
    await settle()
    expect(probe.handleSaveTax).toHaveBeenCalledTimes(1)
    expect(probe.handleSaveTax.mock.calls[0]).toEqual([undefined, 'taxes'])
    expect(screen.queryByLabelText(/^Rate \(%\)/)).toBeNull()
  })

  it('keeps the form open and says why when the tax is rejected', async () => {
    probe.handleSaveTax = vi.fn().mockResolvedValue({ ok: false, error: ['The name has already been taken'] })
    const user = userEvent.setup()
    await openTaxEditor(user)
    await fillTax(user)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Accept' })) })
    await settle()
    expect(screen.getByText('The name has already been taken')).toBeTruthy()
    expect(screen.getByLabelText(/^Name/).value).toBe('City tax')
  })

  it('closes without saving from the Close button', async () => {
    probe.handleSaveTax = vi.fn()
    const user = userEvent.setup()
    await openTaxEditor(user)
    // the legacy Modal has its own «Close» (the X): the one of the form is in its footer
    await user.click(within(screen.getByRole('button', { name: 'Accept' }).closest('.odc-etm-footer')).getByRole('button', { name: 'Close' }))
    expect(probe.handleSaveTax).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/^Rate \(%\)/)).toBeNull()
  })
})
