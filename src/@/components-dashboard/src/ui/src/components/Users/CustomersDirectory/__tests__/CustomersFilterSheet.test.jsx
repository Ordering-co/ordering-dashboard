/* eslint-disable import/first */
// redesign UC-B3 (decision 3; M-C6): the «Filters» sheet of the customers list. A draft that applies once, on «Apply»; Esc and
// the close button discard it; «Clear» empties the sheet's own fields only. Same semantics as the modal it replaces.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => text]
}))

import { USERS_FILTER_INITIAL_VALUES } from '../../../../../../components/UsersFilter'
import { CustomersFilterSheet } from '../CustomersFilterSheet'

const INITIAL = JSON.parse(JSON.stringify(USERS_FILTER_INITIAL_VALUES))

const renderSheet = (values = INITIAL, { open = true } = {}) => {
  const onApply = vi.fn()
  const onOpenChange = vi.fn()
  const Harness = () => {
    const [isOpen, setIsOpen] = useState(open)
    return (
      <>
        <button type='button' onClick={() => setIsOpen(true)}>Open filters</button>
        <CustomersFilterSheet
          open={isOpen}
          onOpenChange={(next) => { onOpenChange(next); setIsOpen(next) }}
          multiFilterValues={values}
          onApply={onApply}
        />
      </>
    )
  }
  render(<Harness />)
  return { onApply, onOpenChange }
}

const sheet = () => screen.findByRole('dialog', { name: 'Filters' })

beforeEach(() => vi.clearAllMocks())
afterEach(() => document.getElementById('app-modals')?.remove())

describe('CustomersFilterSheet · fields', () => {
  it('is a sheet named «Filters» with a visible label on every field (never placeholder-only)', async () => {
    renderSheet()
    const box = await sheet()
    ;['ID', 'External ID', 'Name', 'Last name', 'Email'].forEach(label => {
      const field = within(box).getByLabelText(label)
      expect(field).toBeInTheDocument()
      expect(field.closest('.odc-field').querySelector('label')).toHaveTextContent(label)
    })
    expect(within(box).getByRole('group', { name: 'Amount of orders' })).toBeInTheDocument()
    expect(within(box).getByRole('combobox', { name: 'Select a condition' })).toBeInTheDocument()
    expect(within(box).getByRole('textbox', { name: 'Number' })).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('starts from the values the list holds', async () => {
    renderSheet({ ...INITIAL, id: '12', name: 'Ana', ordersCount: { value: '3', condition: 'ge' } })
    const box = await sheet()
    expect(within(box).getByLabelText('ID')).toHaveValue('12')
    expect(within(box).getByLabelText('Name')).toHaveValue('Ana')
    expect(within(box).getByRole('combobox', { name: 'Select a condition' })).toHaveValue('ge')
    expect(within(box).getByRole('textbox', { name: 'Number' })).toHaveValue('3')
  })

  it('ID and External ID only take digits, as the modal does', async () => {
    const user = userEvent.setup()
    renderSheet()
    const box = await sheet()
    await user.type(within(box).getByLabelText('ID'), 'a1b2-3')
    await user.type(within(box).getByLabelText('External ID'), '9x8')
    expect(within(box).getByLabelText('ID')).toHaveValue('123')
    expect(within(box).getByLabelText('External ID')).toHaveValue('98')
  })

  it('offers the five operators of the modal in a native select', async () => {
    renderSheet()
    const box = await sheet()
    const select = within(box).getByRole('combobox', { name: 'Select a condition' })
    expect(select.tagName).toBe('SELECT')
    expect([...select.options].map(option => [option.value, option.textContent])).toEqual([
      ['eq', '='], ['gt', '>'], ['lt', '<'], ['ge', '>='], ['le', '<=']
    ])
    expect(select).toHaveValue('eq')
  })

  it('says the amount of orders overrides the Orders filter, under the field', async () => {
    renderSheet()
    const box = await sheet()
    const hint = within(box).getByText('Overrides the Orders filter')
    expect(within(box).getByRole('textbox', { name: 'Number' })).toHaveAccessibleDescription('Overrides the Orders filter')
    expect(hint).toBeInTheDocument()
  })
})

describe('CustomersFilterSheet · draft, Apply, Esc and Clear', () => {
  it('writes nothing until «Apply», then once, with a complete object, and closes', async () => {
    const user = userEvent.setup()
    const { onApply, onOpenChange } = renderSheet({ ...INITIAL, phoneVerified: true, loyaltyLevel: 4 })
    const box = await sheet()
    await user.type(within(box).getByLabelText('Name'), 'Ana')
    await user.type(within(box).getByLabelText('Last name'), 'Ruiz')
    await user.type(within(box).getByLabelText('Email'), 'ana@')
    await user.type(within(box).getByLabelText('ID'), '12')
    await user.selectOptions(within(box).getByRole('combobox', { name: 'Select a condition' }), 'gt')
    await user.type(within(box).getByRole('textbox', { name: 'Number' }), '3')
    expect(onApply).not.toHaveBeenCalled()
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith({
      ...INITIAL,
      id: '12',
      name: 'Ana',
      lastname: 'Ruiz',
      email: 'ana@',
      ordersCount: { value: '3', condition: 'gt' },
      // the pills' values travel as they were
      phoneVerified: true,
      loyaltyLevel: 4
    })
    expect(Object.values(onApply.mock.calls[0][0]).includes(undefined)).toBe(false)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull())
  })

  it('an emptied field is written as null, not as an empty string', async () => {
    const user = userEvent.setup()
    const { onApply } = renderSheet({ ...INITIAL, name: 'Ana' })
    const box = await sheet()
    await user.clear(within(box).getByLabelText('Name'))
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(INITIAL)
  })

  it('Esc discards the draft: nothing is applied, and the next opening starts from the list again', async () => {
    const user = userEvent.setup()
    const values = { ...INITIAL, name: 'Ana' }
    const { onApply, onOpenChange } = renderSheet(values)
    const box = await sheet()
    await user.type(within(box).getByLabelText('Name'), 'bel')
    expect(within(box).getByLabelText('Name')).toHaveValue('Anabel')
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(onApply).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull())
    // the next opening starts from what the list holds, not from the discarded draft
    await user.click(screen.getByRole('button', { name: 'Open filters' }))
    expect(within(await sheet()).getByLabelText('Name')).toHaveValue('Ana')
  })

  it('the close button discards the draft too', async () => {
    const user = userEvent.setup()
    const { onApply, onOpenChange } = renderSheet()
    const box = await sheet()
    await user.type(within(box).getByLabelText('Email'), 'x')
    await user.click(within(box).getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('«Clear» empties the sheet fields only: it writes nothing, and the pills keep their values on Apply', async () => {
    const user = userEvent.setup()
    const { onApply } = renderSheet({
      ...INITIAL,
      id: '5',
      email: 'a@b',
      ordersCount: { value: '2', condition: 'lt' },
      emailVerified: false,
      dateType: 'today',
      deliveryFromDatetime: '2026-10-09 00:00:00'
    })
    const box = await sheet()
    await user.click(within(box).getByRole('button', { name: 'Clear' }))
    expect(onApply).not.toHaveBeenCalled()
    expect(within(box).getByLabelText('ID')).toHaveValue('')
    expect(within(box).getByLabelText('Email')).toHaveValue('')
    expect(within(box).getByRole('combobox', { name: 'Select a condition' })).toHaveValue('eq')
    expect(within(box).getByRole('textbox', { name: 'Number' })).toHaveValue('')
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith({
      ...INITIAL,
      emailVerified: false,
      dateType: 'today',
      deliveryFromDatetime: '2026-10-09 00:00:00'
    })
  })

  it('accepts a partial object of values (the controller starts with {})', async () => {
    const user = userEvent.setup()
    const { onApply } = renderSheet({})
    const box = await sheet()
    await user.type(within(box).getByLabelText('Name'), 'Ana')
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith({ ...INITIAL, name: 'Ana' })
  })
})
