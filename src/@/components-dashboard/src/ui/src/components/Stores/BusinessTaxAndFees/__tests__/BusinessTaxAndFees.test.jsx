/* eslint-disable import/first */
// redesign stores 5.12 (; decisions 4, 5, 12d, B-1, B-5, B-6; G4-11, G4-12, G4-13, G4-14): Tax & fees of a store.
// Covered: the section's P/SaveBar sends only what changed through `handleUpdateBusinessClick` with `keepPendingChanges` and says a
// failure; percentages are numbers from 0 to 100 (checked before saving); Simple / Advanced as a segmented control, and going back
// to Simple with taxes applied asks (Remove from this store / Keep advanced taxes); one row per tax of the project with a checkbox
// named by the tax; the delete question names the tax and the project, and the store's selection only changes once the delete
// worked; the legacy service fee stays in view while it is saved. The tax editor and the customer fees have their own tests: here
// they are stand-ins.
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ hideToast: vi.fn() }))

const mockModule = vi.hoisted(() => () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useToast: () => [{}, { showToast: () => {}, hideToast: (...args) => probe.hideToast(...args) }]
}))
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../EditTaxManager', async () => {
  const ReactModule = await import('react')
  return {
    EditTaxManager: ({ data, layout }) => ReactModule.createElement('div', {
      'data-testid': 'tax-editor',
      'data-tax': data === true ? 'new' : data?.id,
      'data-layout': layout
    })
  }
})
vi.mock('../../CustomerFees', async () => {
  const ReactModule = await import('react')
  return {
    CustomerFees: ({ legacyField, keepLegacyField }) => ReactModule.createElement('div', { 'data-testid': 'customer-fees', 'data-keep': String(!!keepLegacyField) }, legacyField)
  }
})

import { BusinessTaxAndFees } from '../index'

const VAT = { id: 31, name: 'VAT', rate: 10, type: 1 }
const CITY = { id: 32, name: 'City tax', rate: 2.5, type: 2 }
const TAXES = { 'id:31': VAT, 'id:32': CITY }

const STORE = { id: 2, name: 'Fast Bite', tax: 0, tax_type: 2, delivery_tax_rate: 26, delivery_tax_type: 2, service_fee: 0, taxes: [] }

const Harness = ({ store = {}, taxes = TAXES, answer = () => ({ ok: true }), spy, deleteAnswer = () => ({ ok: true }), deleteSpy }) => {
  const [business, setBusiness] = useState({ ...STORE, ...store })
  const [taxMap, setTaxMap] = useState(taxes)
  const handleUpdateBusinessClick = async (changes, options) => {
    spy?.(changes, options)
    const result = await answer(changes)
    if (result.ok) {
      setBusiness(prev => ({
        ...prev,
        ...changes,
        ...(changes.taxes ? { taxes: changes.taxes.map(id => taxMap[`id:${id}`]) } : {})
      }))
    }
    return result
  }
  const handleDeleteTax = async (id, action, options) => {
    deleteSpy?.(id, action, options)
    const result = await deleteAnswer()
    if (result.ok) {
      setTaxMap(prev => {
        const next = { ...prev }
        delete next[`id:${id}`]
        return next
      })
    }
    return result
  }
  return (
    <BusinessTaxAndFees
      business={business}
      taxes={taxMap}
      formTaxState={{ loading: false, result: { error: false } }}
      formTaxChanges={{}}
      setFormTaxChanges={() => {}}
      handleChangeTax={() => {}}
      handleSaveTax={async () => ({ ok: true })}
      handleDeleteTax={handleDeleteTax}
      handleUpdateBusinessClick={handleUpdateBusinessClick}
      setIsExtendExtraOpen={() => {}}
    />
  )
}

const save = () => screen.getByRole('button', { name: 'Save' })
const taxList = () => screen.getByRole('list', { name: 'Taxes of this store' })

describe('BusinessTaxAndFees', () => {
  it('opens in Simple when the store has no taxes, with numeric percentage fields', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'Tax & fees' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Simple' }).getAttribute('aria-pressed')).toBe('true')
    const rate = screen.getByLabelText('Delivery tax percentage (%)')
    expect(rate.value).toBe('26')
    expect(rate.getAttribute('inputmode')).toBeTruthy()
  })

  it('saves only what changed, through keepPendingChanges, and says when the save fails', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness spy={spy} answer={() => ({ ok: false, error: ['Tax is invalid'] })} />)
    const field = screen.getByLabelText('Tax percentage (%)')
    await user.clear(field)
    await user.type(field, '8.5')
    await user.tab()
    await user.click(save())
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy).toHaveBeenCalledWith({ tax: 8.5 }, { keepPendingChanges: true })
    expect(await screen.findByText('Tax is invalid')).toBeTruthy()
    expect(probe.hideToast).toHaveBeenCalled()
  })

  it('blocks a percentage over 100 under the field (G4-13)', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    const field = screen.getByLabelText('Tax percentage (%)')
    await user.clear(field)
    await user.type(field, '120')
    await user.tab()
    await user.click(save())
    expect(await screen.findByText('Enter a percentage from 0 to 100.')).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })

  it('opens in Advanced when the store has taxes, one row per project tax with a checkbox named by the tax (B-1)', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness store={{ taxes: [VAT] }} spy={spy} />)
    const rows = within(taxList()).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(screen.getByRole('checkbox', { name: 'VAT' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('checkbox', { name: 'City tax' }).getAttribute('aria-checked')).toBe('false')
    await user.click(screen.getByRole('checkbox', { name: 'City tax' }))
    await user.click(save())
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.calls[0][0].taxes.sort()).toEqual([31, 32])
  })

  it('opens a tax in its editor beside the list (panel layout)', async () => {
    const user = userEvent.setup()
    render(<Harness store={{ taxes: [VAT] }} />)
    await user.click(screen.getByRole('button', { name: 'City tax, View details' }))
    const editor = await screen.findByTestId('tax-editor')
    expect(editor.getAttribute('data-tax')).toBe('32')
    expect(editor.getAttribute('data-layout')).toBe('panel')
  })

  it('asks before going back to Simple with taxes applied, and removes them only if confirmed (12d, G4-12)', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness store={{ taxes: [VAT] }} spy={spy} />)
    await user.click(screen.getByRole('button', { name: 'Simple' }))
    let dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/VAT still applies to this store\. Remove it/)).toBeTruthy() // review R2: one tax, singular
    await user.click(within(dialog).getByRole('button', { name: 'Keep advanced taxes' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('list', { name: 'Taxes of this store' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Simple' }))
    dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove from this store' }))
    expect(await screen.findByLabelText('Tax percentage (%)')).toBeTruthy()
    await user.click(save())
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.calls[0][0]).toEqual({ taxes: [] })
  })

  it('names the tax and the project when deleting, and keeps the selection when the delete fails (G4-11)', async () => {
    const user = userEvent.setup()
    const deleteSpy = vi.fn()
    render(<Harness store={{ taxes: [VAT] }} deleteSpy={deleteSpy} deleteAnswer={() => ({ ok: false, error: ['In use'] })} />)
    await user.click(screen.getByRole('button', { name: 'Delete VAT' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete VAT for the whole project?')).toBeTruthy()
    expect(within(dialog).getByText(/every store and product that uses it/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Delete tax' }))
    expect(deleteSpy).toHaveBeenCalledWith(31, 'taxes', { inlineError: true })
    expect(await screen.findByText('VAT was not deleted: In use')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'VAT' }).getAttribute('aria-checked')).toBe('true')
  })

  it('a delete that works takes the tax out of the list and, as in main, leaves the store change to save (review P1)', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness store={{ taxes: [VAT] }} spy={spy} />)
    await user.click(screen.getByRole('button', { name: 'Delete VAT' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete tax' }))
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'VAT' })).toBeNull())
    await user.click(save())
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.calls[0][0]).toEqual({ taxes: [] })
  })

  it('a deleted tax the store did not have leaves nothing to save', async () => {
    const user = userEvent.setup()
    render(<Harness store={{ taxes: [VAT] }} />)
    await user.click(screen.getByRole('button', { name: 'Delete City tax' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete tax' }))
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'City tax' })).toBeNull())
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('keeps the store\'s tax ids the project does not list when it saves (review P2)', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness store={{ taxes: [VAT, { id: 77 }] }} spy={spy} />)
    await user.click(screen.getByRole('checkbox', { name: 'City tax' }))
    await user.click(save())
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.calls[0][0].taxes.sort((a, b) => a - b)).toEqual([31, 32, 77])
  })

  it('hides the section\'s save bar while a tax is open in its editor, and brings it back on close (review R1)', async () => {
    const user = userEvent.setup()
    render(<Harness store={{ taxes: [VAT] }} />)
    await user.click(screen.getByRole('checkbox', { name: 'City tax' }))
    expect(screen.getByText('1 unsaved change')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'City tax, View details' }))
    await screen.findByTestId('tax-editor')
    expect(screen.queryByText('1 unsaved change')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('tax-editor')).toBeNull())
    expect(screen.getByText('1 unsaved change')).toBeTruthy()
  })

  it('keeps the legacy service fee in view while a value is saved (G4-14)', async () => {
    const user = userEvent.setup()
    render(<Harness store={{ service_fee: 12 }} />)
    await user.click(screen.getByRole('tab', { name: 'Fees' }))
    const fees = screen.getByTestId('customer-fees')
    expect(fees.getAttribute('data-keep')).toBe('true')
    expect(within(fees).getByLabelText('Service fee (%)').value).toBe('12')
    expect(within(fees).getByText(/still has a service fee saved/)).toBeTruthy()
  })

  it('without a saved service fee, the customer fees decide (as in main)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('tab', { name: 'Fees' }))
    expect(screen.getByTestId('customer-fees').getAttribute('data-keep')).toBe('false')
  })
})

// (main #478), ported to the redesign: until the project's taxes have loaded the advanced list is not «empty»; a failed load
// says so with Retry (`getTaxes`), a refresh keeps the taxes already shown, and the fees stay reachable.
describe('BusinessTaxAndFees · the tax catalog', () => {
  const renderCatalog = (taxCatalogState, extra = {}) => {
    const getTaxes = vi.fn()
    const utils = render(
      <BusinessTaxAndFees
        business={{ ...STORE, taxes: [VAT] }}
        taxes={{}}
        taxCatalogState={taxCatalogState}
        getTaxes={getTaxes}
        formTaxState={{ loading: false, result: { error: false } }}
        formTaxChanges={{}}
        setFormTaxChanges={() => {}}
        handleChangeTax={() => {}}
        handleSaveTax={async () => ({ ok: true })}
        handleDeleteTax={async () => ({ ok: true })}
        handleUpdateBusinessClick={async () => ({ ok: true })}
        setIsExtendExtraOpen={() => {}}
        {...extra}
      />
    )
    return { ...utils, getTaxes }
  }

  it('a failed load says so with Retry, and never «There are no taxes in the project yet.»', async () => {
    const user = userEvent.setup()
    const { getTaxes } = renderCatalog({ loading: false, loaded: false, error: 'Offline' })
    expect(screen.getByText("We couldn't load the project's taxes.")).toBeTruthy()
    expect(screen.queryByText('There are no taxes in the project yet.')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(getTaxes).toHaveBeenCalledTimes(1)
  })

  it('while the first load runs there is no empty message either', () => {
    renderCatalog({ loading: true, loaded: false, error: null })
    expect(screen.queryByText('There are no taxes in the project yet.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('a refresh keeps the taxes already loaded in the list', () => {
    renderCatalog({ loading: true, loaded: true, error: null }, { taxes: TAXES })
    expect(screen.getByRole('checkbox', { name: 'VAT' }).getAttribute('aria-checked')).toBe('true')
  })

  it('the fees stay reachable when the taxes fail', async () => {
    const user = userEvent.setup()
    renderCatalog({ loading: false, loaded: false, error: 'Offline' })
    await user.click(screen.getByRole('tab', { name: 'Fees' }))
    expect(screen.getByTestId('customer-fees')).toBeTruthy()
  })
})
