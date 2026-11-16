/* eslint-disable import/first */
// redesign stores 5.12 (E2): `layout='panel'`, the form inside the P/SectionSplit of S/BusinessTaxAndFees. No Accept / Close
// buttons: a P/SaveBar counts and names what changed (only what differs from the stored record: the parent presets `type` on a new tax,
// and that preset is not a change), Save calls `handleSave(id, type, undefined, saveOptions)` and `onSaved(result)` (never `onClose`),
// Discard calls `onDiscard`, and the leave guard asks only about real changes.
import React from 'react'
import { act, fireEvent, screen, within } from '@testing-library/react'
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

import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product/LeaveGuard'
import { setup } from './testHarness'

const STORED = { value: 31, name: 'VAT', description: 'Value added', rate: 21, type: 1 }

const bar = () => screen.queryByRole('group', { name: 'Save changes' })
const settle = async () => {
  for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
}
const save = async () => {
  await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: /^(Save changes|Add tax|Add fee)$/ })) })
  await settle()
}

const panel = (options = {}) => setup({ layout: 'panel', data: STORED, ...options })

describe('EditTaxManager · panel layout', () => {
  it('draws no Accept or Close buttons and no bar while nothing changed', () => {
    panel()
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(bar()).toBeNull()
  })

  it('counts and names the changed fields', () => {
    panel({ initial: { name: 'VAT 2', rate: 8 } })
    expect(within(bar()).getByText('2 unsaved changes')).toBeTruthy()
    expect(within(bar()).getByText(/Name, Rate \(%\)/)).toBeTruthy()
  })

  it('counts the order type rates as one change called «Rates by order type»', () => {
    panel({ initial: { order_type_rates: { delivery: { rate: 5, type: 1 }, pickup: { rate: 6, type: 2 } } } })
    expect(within(bar()).getByText('1 unsaved change')).toBeTruthy()
    expect(within(bar()).getByText(/Rates by order type/)).toBeTruthy()
  })

  it('names the fee fields', () => {
    panel({ type: 'fees', data: { value: 4, name: 'a', description: 'b', fixed: 1, percentage: 2, taxable: true }, initial: { fixed: 3, taxable: false } })
    expect(within(bar()).getByText('2 unsaved changes')).toBeTruthy()
    expect(within(bar()).getByText(/Fixed, Taxable/)).toBeTruthy()
  })

  it('words the Save button: «Add tax» for a new tax, «Add fee» for a new fee, «Save changes» for a saved one', () => {
    const first = panel({ data: true, initial: { name: 'N' } })
    expect(within(bar()).getByRole('button', { name: 'Add tax' })).toBeTruthy()
    first.unmount()
    const second = panel({ data: true, type: 'fees', initial: { name: 'N' } })
    expect(within(bar()).getByRole('button', { name: 'Add fee' })).toBeTruthy()
    second.unmount()
    panel({ initial: { name: 'N' } })
    expect(within(bar()).getByRole('button', { name: 'Save changes' })).toBeTruthy()
  })
})

describe('EditTaxManager · panel layout · what counts as a change', () => {
  it('does not count the preset type 1 of a new tax', () => {
    panel({ data: true, initial: { type: 1 } })
    expect(bar()).toBeNull()
  })

  it('counts a type that differs from the default or from the stored one', () => {
    const first = panel({ data: true, initial: { type: 2 } })
    expect(within(bar()).getByText('1 unsaved change')).toBeTruthy()
    first.unmount()
    panel({ initial: { type: 2 } })
    expect(within(bar()).getByText(/Type/)).toBeTruthy()
  })

  it.each([
    ['a value equal to the stored one', { name: 'VAT', rate: 21 }],
    ['a rate typed as text that equals the stored number', { rate: '21' }],
    ['the default apply_to_fees (off)', { apply_to_fees: false }],
    ['the default recipient (business)', { recipient: 'business' }]
  ])('does not count %s', (_, initial) => {
    panel({ initial })
    expect(bar()).toBeNull()
  })

  it('does not count a rate cleared that was never stored', () => {
    panel({ data: { value: 31, name: 'VAT', description: 'Value added' }, initial: { rate: '' } })
    expect(bar()).toBeNull()
  })

  it('does not count the default Taxable (on) of a fee', () => {
    panel({ type: 'fees', data: { value: 4, name: 'a', description: 'b', fixed: 1, percentage: 2 }, initial: { taxable: true } })
    expect(bar()).toBeNull()
  })

  it('counts a cleared rate that was stored, and a recipient other than business', () => {
    panel({ initial: { rate: '', recipient: 'customer' } })
    expect(within(bar()).getByText('2 unsaved changes')).toBeTruthy()
  })

  it('does not count order type rates equal to the stored ones, and counts one that differs', () => {
    const stored = { ...STORED, order_type_rates: { delivery: { rate: 5, type: 2 }, pickup: { rate: 6, type: 1 } } }
    const first = panel({ data: stored, initial: { order_type_rates: { delivery: { rate: 5, type: 2 }, pickup: { rate: 6 } } } })
    expect(bar()).toBeNull()
    first.unmount()
    panel({ data: stored, initial: { order_type_rates: { delivery: { rate: 5, type: 1 } } } })
    expect(within(bar()).getByText('1 unsaved change')).toBeTruthy()
  })

  it('counts a new order type rate and ignores an order type rate that is empty and was never stored', () => {
    const first = panel({ initial: { order_type_rates: { eatin: { rate: NaN, type: 1 } } } })
    expect(bar()).toBeNull()
    first.unmount()
    panel({ initial: { order_type_rates: { eatin: { rate: 3, type: 1 } } } })
    expect(within(bar()).getByText('1 unsaved change')).toBeTruthy()
  })

  const withHost = (initial, data = true) => {
    const probe = { current: null }
    const Host = ({ children }) => {
      const host = useLeaveGuardHost()
      probe.current = host
      return <LeaveGuardContext.Provider value={host.context}>{children}</LeaveGuardContext.Provider>
    }
    setup({ layout: 'panel', data, initial, wrapper: Host })
    return probe
  }

  it('does not ask on leave for the preset type of a new tax', () => {
    const probe = withHost({ type: 1 })
    expect(probe.current.isDirty()).toBe(false)
  })

  it('asks on leave when a real change is pending', () => {
    const probe = withHost({ type: 1, name: 'N' })
    expect(probe.current.isDirty()).toBe(true)
  })
})

describe('EditTaxManager · panel layout · save and discard', () => {
  it('saves with the id, the type, undefined and the save options; reports onSaved; never closes', async () => {
    const result = { id: 31 }
    const handleSave = vi.fn().mockResolvedValue(result)
    const onSaved = vi.fn()
    const saveOptions = { inlineError: true }
    const { onClose } = panel({ initial: { name: 'VAT 2' }, handleSave, onSaved, saveOptions, clearOnSave: true })
    await save()
    expect(handleSave).toHaveBeenCalledTimes(1)
    expect(handleSave.mock.calls[0]).toEqual([31, 'taxes', undefined, saveOptions])
    expect(onSaved).toHaveBeenCalledWith(result)
    expect(onClose).not.toHaveBeenCalled()
    expect(within(bar()).getByRole('status').textContent).toBe('Saved')
  })

  it('does not call onSaved when the save fails, and shows the reason in the bar with a retry', async () => {
    const handleSave = vi.fn().mockResolvedValueOnce({ ok: false, error: ['Name already exists'] }).mockResolvedValueOnce({ id: 31 })
    const onSaved = vi.fn()
    panel({ initial: { name: 'VAT 2' }, handleSave, onSaved, clearOnSave: true })
    await save()
    expect(onSaved).not.toHaveBeenCalled()
    expect(within(bar()).getByRole('alert').textContent).toContain('Name already exists')
    await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: 'Try again' })) })
    await settle()
    expect(handleSave).toHaveBeenCalledTimes(2)
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('says the generic reason when the save throws', async () => {
    panel({ initial: { name: 'VAT 2' }, handleSave: vi.fn().mockRejectedValue(new Error('boom')) })
    await save()
    expect(within(bar()).getByRole('alert').textContent).toContain('The tax could not be saved.')
  })

  it('validates before it saves: the messages go under the fields and the bar counts them', async () => {
    const { handleSave } = panel({ initial: { name: '' } })
    await save()
    expect(handleSave).not.toHaveBeenCalled()
    expect(within(screen.getByLabelText(/^Name/).closest('.odc-field')).getByRole('alert').textContent).toBe('The name is required')
    expect(within(bar()).getByRole('alert').textContent).toContain('Fix 1 field to save.')
  })

  it('submits with Enter in a field', async () => {
    const user = userEvent.setup()
    const { handleSave } = panel({ initial: { name: 'VAT 2' } })
    await user.type(screen.getByLabelText(/^Name/), '{Enter}')
    await settle()
    expect(handleSave).toHaveBeenCalledTimes(1)
  })

  it('calls onDiscard and shows the stored values again', async () => {
    const user = userEvent.setup()
    const onDiscard = vi.fn()
    panel({ initial: { name: 'VAT 2' }, onDiscard })
    expect(screen.getByLabelText(/^Name/).value).toBe('VAT 2')
    await user.click(within(bar()).getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText(/^Name/).value).toBe('VAT')
    expect(bar()).toBeNull()
  })

  it('closes in the modal layout and does not call onSaved', async () => {
    const onSaved = vi.fn()
    const { onClose } = setup({ data: STORED, onSaved })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Accept' })) })
    await settle()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()
  })
})
