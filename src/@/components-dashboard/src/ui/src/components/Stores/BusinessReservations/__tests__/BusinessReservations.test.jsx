/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// redesign stores 5.4
// The real Product pieces (AsyncSwitch, NumberField, Switch, SaveBar) with a fake controller handler and a fake leave-guard host.
vi.mock('~components', async () => {
  const { useLanguage } = await import('../../../../../../contexts/LanguageContext')
  return { useLanguage }
})

import { LeaveGuardContext } from '../../../Shared/Product/LeaveGuard'
import { BusinessReservations } from '../index'

const SETTING = {
  min_guests_reservation: 1,
  max_guests_reservation: 5,
  min_time_reserve_minutes: 15,
  max_time_reserve_days: 2,
  late_arrival_hold_minutes: 15,
  max_reservation_sites: 2,
  allow_preorder_reservation: false
}

const makeBusiness = ({ enabled = '1', setting = SETTING } = {}) => ({
  id: 7,
  configs: [
    { id: 11, key: 'reservation_enabled', value: enabled },
    { id: 12, key: 'reservation_setting', value: setting === null ? '' : JSON.stringify(setting) }
  ]
})

const deferred = () => {
  let finish
  const promise = new Promise(resolve => { finish = resolve })
  return { promise, resolve: finish }
}

const renderReservations = ({ business = makeBusiness(), handler, host } = {}) => {
  const handleUpdateBusinessConfigs = handler || vi.fn(async () => ({ ok: true }))
  const element = (b) => (
    <LeaveGuardContext.Provider value={host || null}>
      <BusinessReservations
        business={b}
        businessId={7}
        handleUpdateBusinessConfigs={handleUpdateBusinessConfigs}
        actionStatus={{ loading: false }}
      />
    </LeaveGuardContext.Provider>
  )
  const view = render(element(business))
  return { ...view, handleUpdateBusinessConfigs, rerenderWith: (b) => view.rerender(element(b)) }
}

const field = (name) => screen.getByLabelText(name)
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const savedJson = (handler) => JSON.parse(handler.mock.calls[handler.mock.calls.length - 1][0])

describe('BusinessReservations · the form', () => {
  it('shows the title, the master switch on and the five numbers and the pre-order switch with the stored values', () => {
    renderReservations()
    expect(screen.getByRole('heading', { name: 'Reservations' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Do you offer table reservation?' }).getAttribute('aria-checked')).toBe('true')
    expect(field('Minimum guests').value).toBe('1')
    expect(field('Maximum guests').value).toBe('5')
    expect(field('Minimum time in advance (Minutes)').value).toBe('15')
    expect(field('Maximum time in advance (Days)').value).toBe('2')
    expect(field('When guest are late, hold table for (Minutes)').value).toBe('15')
    expect(screen.getByRole('switch', { name: 'Allow guests to pre-order their food when booking a table' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('group', { name: 'Reservations' })).toBeNull()
  })

  it('shows no fields when reservations are off', () => {
    renderReservations({ business: makeBusiness({ enabled: '0' }) })
    expect(screen.getByRole('switch', { name: 'Do you offer table reservation?' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByLabelText('Minimum guests')).toBeNull()
  })

  it('does not take letters in the minutes field, and an empty one is an error under it that sends nothing', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs } = renderReservations()
    const minutes = field('Minimum time in advance (Minutes)')
    await user.clear(minutes)
    await user.type(minutes, 'abc')
    expect(minutes.value).toBe('')
    await user.click(saveButton())
    expect(within(minutes.closest('.odc-field')).getByRole('alert').textContent).toBe('Enter a whole number, 0 or more.')
    expect(handleUpdateBusinessConfigs).not.toHaveBeenCalled()
    await user.type(minutes, '3x0')
    expect(minutes.value).toBe('30')
  })

  it('with an invalid number, Save sends nothing and the focus goes to the invalid field', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs } = renderReservations()
    const minutes = field('Minimum time in advance (Minutes)')
    await user.clear(minutes)
    await user.click(saveButton())
    // the click left the focus on the Save button; the invalid field takes it on the next frame
    await waitFor(() => expect(document.activeElement).toBe(field('Minimum time in advance (Minutes)')))
    expect(document.activeElement.getAttribute('aria-invalid')).toBe('true')
    expect(handleUpdateBusinessConfigs).not.toHaveBeenCalled()
  })

  it('refuses a fraction as not whole', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs } = renderReservations()
    const late = field('When guest are late, hold table for (Minutes)')
    await user.clear(late)
    await user.type(late, '1.5')
    await user.click(saveButton())
    expect(within(late.closest('.odc-field')).getByRole('alert').textContent).toBe('Enter a whole number, 0 or more.')
    expect(handleUpdateBusinessConfigs).not.toHaveBeenCalled()
  })

  it('puts each rule under the field that causes it and does not send', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs } = renderReservations()
    const type = async (name, value) => {
      const input = field(name)
      await user.clear(input)
      await user.type(input, value)
    }
    const errorOf = (name) => within(field(name).closest('.odc-field')).queryByRole('alert')?.textContent

    await type('Minimum guests', '0')
    await user.click(saveButton())
    expect(errorOf('Minimum guests')).toBe('Minimum guests cannot be zero')

    await type('Minimum guests', '9')
    await user.click(saveButton())
    expect(errorOf('Minimum guests')).toBe('Minimum guests cannot be higher than maximum guests')
    expect(errorOf('Maximum guests')).toBeUndefined()

    await type('Minimum guests', '2')
    await type('Maximum time in advance (Days)', '0')
    await user.click(saveButton())
    expect(errorOf('Minimum guests')).toBeUndefined()
    expect(errorOf('Maximum time in advance (Days)')).toBe('Max reserve days cannot be zero')

    await type('Maximum time in advance (Days)', '1')
    await type('Minimum time in advance (Minutes)', '1441')
    await user.click(saveButton())
    expect(errorOf('Maximum time in advance (Days)')).toBe('Max reserve days cannot be lower than min time reserve')

    expect(handleUpdateBusinessConfigs).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('counts the changes by field, and a field typed back to its stored value no longer counts', async () => {
    const user = userEvent.setup()
    renderReservations()
    const guests = field('Maximum guests')
    await user.clear(guests)
    await user.type(guests, '8')
    const bar = screen.getByRole('group', { name: 'Reservations' })
    expect(bar.textContent).toContain('1 unsaved change')
    expect(bar.textContent).toContain('Maximum guests')
    await user.click(screen.getByRole('switch', { name: 'Allow guests to pre-order their food when booking a table' }))
    expect(screen.getByRole('group', { name: 'Reservations' }).textContent).toContain('2 unsaved changes')
    await user.clear(guests)
    await user.type(guests, '5')
    expect(screen.getByRole('group', { name: 'Reservations' }).textContent).toContain('1 unsaved change')
  })

  it('saves the whole JSON keeping the hidden key, then empties the draft', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs, rerenderWith } = renderReservations()
    const guests = field('Maximum guests')
    await user.clear(guests)
    await user.type(guests, '8')
    await user.click(screen.getByRole('switch', { name: 'Allow guests to pre-order their food when booking a table' }))
    await user.click(saveButton())

    await waitFor(() => expect(handleUpdateBusinessConfigs).toHaveBeenCalledTimes(1))
    expect(handleUpdateBusinessConfigs.mock.calls[0][1]).toBe(12)
    expect(savedJson(handleUpdateBusinessConfigs)).toEqual({ ...SETTING, max_guests_reservation: 8, allow_preorder_reservation: true })
    expect(savedJson(handleUpdateBusinessConfigs).max_reservation_sites).toBe(2)

    // the controller answers with the stored value: the bar says «Saved» and no change is left in the draft
    rerenderWith(makeBusiness({ setting: { ...SETTING, max_guests_reservation: 8, allow_preorder_reservation: true } }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved'))
    expect(screen.queryByText(/unsaved change/)).toBeNull()
    expect(field('Maximum guests').value).toBe('8')

    // a later stored value from outside shows as it is: nothing of the old draft is left over it
    rerenderWith(makeBusiness({ setting: { ...SETTING, max_guests_reservation: 6 } }))
    expect(field('Maximum guests').value).toBe('6')
  })

  it('saves the six visible keys when the setting was empty, with 0 and false for what was never stored', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs } = renderReservations({ business: makeBusiness({ setting: null }) })
    for (const [name, value] of [['Minimum guests', '1'], ['Maximum guests', '4'], ['Maximum time in advance (Days)', '3']]) {
      await user.type(field(name), value)
    }
    await user.click(saveButton())
    await waitFor(() => expect(handleUpdateBusinessConfigs).toHaveBeenCalledTimes(1))
    expect(savedJson(handleUpdateBusinessConfigs)).toEqual({
      min_guests_reservation: 1,
      max_guests_reservation: 4,
      min_time_reserve_minutes: 0,
      max_time_reserve_days: 3,
      late_arrival_hold_minutes: 0,
      allow_preorder_reservation: false
    })
  })

  it('Discard empties the draft and the field errors', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs } = renderReservations()
    const guests = field('Minimum guests')
    await user.clear(guests)
    await user.type(guests, '0')
    await user.click(saveButton())
    expect(within(guests.closest('.odc-field')).getByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(field('Minimum guests').value).toBe('1')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Reservations' })).toBeNull()
    expect(handleUpdateBusinessConfigs).not.toHaveBeenCalled()
  })

  it('a failed save keeps the draft, says why in the bar and Retry sends it again', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['Something went wrong on the server'] })
      .mockResolvedValueOnce({ ok: true })
    renderReservations({ handler })
    const guests = field('Maximum guests')
    await user.clear(guests)
    await user.type(guests, '9')
    await user.click(saveButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Something went wrong on the server')
    expect(field('Maximum guests').value).toBe('9')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(2))
    expect(savedJson(handler).max_guests_reservation).toBe(9)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('a failed save without text says the generic reason', async () => {
    const user = userEvent.setup()
    const handler = vi.fn(async () => ({ ok: false }))
    renderReservations({ handler })
    await user.click(screen.getByRole('switch', { name: 'Allow guests to pre-order their food when booking a table' }))
    await user.click(saveButton())
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't save the change.")
  })

  it('a second Save while it saves does nothing', async () => {
    const user = userEvent.setup()
    const pending = deferred()
    const handler = vi.fn(() => pending.promise)
    renderReservations({ handler })
    await user.click(screen.getByRole('switch', { name: 'Allow guests to pre-order their food when booking a table' }))
    await user.click(saveButton())
    await user.click(screen.getByRole('button', { name: /Save/ }))
    expect(handler).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve({ ok: true }) })
  })
})

describe('BusinessReservations · the master switch', () => {
  it('saves at once with «1» and goes through the controller by its config id', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs } = renderReservations({ business: makeBusiness({ enabled: '0' }) })
    await user.click(screen.getByRole('switch', { name: 'Do you offer table reservation?' }))
    expect(handleUpdateBusinessConfigs).toHaveBeenCalledWith('1', 11, { inlineError: true })
    // controlled by the stored value: it stays off until the business says otherwise
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Do you offer table reservation?' }).getAttribute('aria-busy')).not.toBe('true'))
    expect(screen.getByRole('switch', { name: 'Do you offer table reservation?' }).getAttribute('aria-checked')).toBe('false')
  })

  it('saves at once with «0»', async () => {
    const user = userEvent.setup()
    const { handleUpdateBusinessConfigs } = renderReservations()
    await user.click(screen.getByRole('switch', { name: 'Do you offer table reservation?' }))
    expect(handleUpdateBusinessConfigs).toHaveBeenCalledWith('0', 11, { inlineError: true })
  })

  it('turning reservations off drops what was typed and not saved: the guard is clean and, turned on again, the field shows the saved value', async () => {
    const user = userEvent.setup()
    const entries = []
    const host = { register: vi.fn(entryRef => { entries.push(entryRef); return () => {} }), requestLeave: vi.fn() }
    const { handleUpdateBusinessConfigs, rerenderWith } = renderReservations({ host })
    const guests = field('Maximum guests')
    await user.clear(guests)
    await user.type(guests, '8')
    expect(entries[0].current.isDirty()).toBe(true)

    await user.click(screen.getByRole('switch', { name: 'Do you offer table reservation?' }))
    expect(handleUpdateBusinessConfigs).toHaveBeenCalledWith('0', 11, { inlineError: true })
    // the controller stored it: the business now says «0» and the form is hidden
    rerenderWith(makeBusiness({ enabled: '0' }))
    expect(screen.queryByLabelText('Maximum guests')).toBeNull()
    expect(entries[0].current.isDirty()).toBe(false)

    rerenderWith(makeBusiness({ enabled: '1' }))
    expect(field('Maximum guests').value).toBe('5')
    expect(screen.queryByText(/unsaved change/)).toBeNull()
    expect(entries[0].current.isDirty()).toBe(false)
  })

  it('goes back and says why when the save fails', async () => {
    const user = userEvent.setup()
    const handler = vi.fn(async () => ({ ok: false }))
    renderReservations({ business: makeBusiness({ enabled: '0' }), handler })
    await user.click(screen.getByRole('switch', { name: 'Do you offer table reservation?' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain("We couldn't change table reservations.")
    expect(screen.getByRole('switch', { name: 'Do you offer table reservation?' }).getAttribute('aria-checked')).toBe('false')
  })
})

describe('BusinessReservations · the leave guard', () => {
  it('registers in the host and is dirty only with unsaved changes', async () => {
    const user = userEvent.setup()
    const entries = []
    const host = {
      register: vi.fn(entryRef => { entries.push(entryRef); return () => {} }),
      requestLeave: vi.fn()
    }
    renderReservations({ host })
    expect(host.register).toHaveBeenCalledTimes(1)
    const entry = entries[0]
    expect(entry.current.isDirty()).toBe(false)
    const guests = field('Maximum guests')
    await user.clear(guests)
    await user.type(guests, '7')
    expect(entry.current.isDirty()).toBe(true)
    expect(entry.current.count()).toBe(1)
    // the leave dialog takes the focus before it asks to discard; a number field being edited shows its own text until it blurs
    await user.tab()
    await act(async () => { await entry.current.discard() })
    await waitFor(() => expect(entry.current.isDirty()).toBe(false))
    expect(field('Maximum guests').value).toBe('5')
  })

  it('the guard Save sends the form and answers {ok}', async () => {
    const user = userEvent.setup()
    const entries = []
    const host = { register: vi.fn(entryRef => { entries.push(entryRef); return () => {} }), requestLeave: vi.fn() }
    const { handleUpdateBusinessConfigs } = renderReservations({ host })
    const guests = field('Maximum guests')
    await user.clear(guests)
    await user.type(guests, '7')
    let result
    await act(async () => { result = await entries[0].current.save() })
    expect(result).toEqual({ ok: true })
    expect(savedJson(handleUpdateBusinessConfigs).max_guests_reservation).toBe(7)
  })
})
