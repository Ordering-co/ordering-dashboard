import React, { useState } from 'react'
import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, it, expect, afterEach, beforeEach, describe } from 'vitest'
import { ConfigContext } from '../../../../../../contexts/ConfigContext'
import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product'
import { BusinessPickupDetails } from '../index'

// the UI wired to its REAL controller: only the contexts the controller reads and the language are simulated
const api = vi.hoisted(() => ({ save: vi.fn() }))

vi.mock('../../../../../../index', async () => {
  const { BusinessPickupDetails } = await import('../../../../../../components/BusinessPickupDetails')
  return {
    useLanguage: () => [{}, (key, fallback) => fallback],
    BusinessPickupDetails
  }
})
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ businesses: () => ({ save: api.save }) }]
}))
vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'tok' }]
}))

// redesign stores 5.7: the Pickup tab is one form with a draft and a save bar (decision 4 of Tiendas).

beforeEach(() => {
  api.save.mockReset()
  api.save.mockImplementation(async (changes) => ({ content: { error: false, result: { id: 1, ...changes } } }))
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

let host
let updates
// the editor's page: a host for the leave guard and a business that the controller updates
const Harness = ({ initial }) => {
  const [business, setBusiness] = useState({ id: 1, ...initial })
  host = useLeaveGuardHost()
  return (
    <LeaveGuardContext.Provider value={host.context}>
      <BusinessPickupDetails
        business={business}
        handleUpdateBusinessState={next => {
          updates.push(next)
          setBusiness(current => ({ ...current, ...next }))
        }}
      />
    </LeaveGuardContext.Provider>
  )
}

const renderPickup = (initial = { pickup_time: '00:20', minimum: 5 }) => {
  updates = []
  const user = userEvent.setup()
  render(
    <ConfigContext.Provider value={[{ configs: {} }, async () => {}]}>
      <Harness initial={initial} />
    </ConfigContext.Provider>
  )
  return { user }
}

const hours = () => screen.getByRole('combobox', { name: /Pickup Time Hours/ })
const minutes = () => screen.getByRole('combobox', { name: /Pickup Time Minutes/ })
const minimum = () => screen.getByRole('textbox', { name: /Minimum purchase/ })
const saveBar = () => screen.queryByRole('group', { name: 'Save changes' })
const barButton = name => within(saveBar()).getByRole('button', { name })

const typeNumber = async (user, input, text) => {
  await user.clear(input)
  if (text) await user.type(input, text)
  await user.tab()
}

describe('BusinessPickupDetails (5.7 form)', () => {
  it('shows the saved values, the two headings and no bar', () => {
    renderPickup()
    expect(screen.getByRole('heading', { name: 'Order time' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Purchase' })).toBeTruthy()
    // "00:20" reads 0 h 20 min: hours are plain «0», with no leading space
    expect(hours().value).toBe('0')
    expect(within(hours()).getByRole('option', { name: '10' })).toBeTruthy()
    expect(minutes().value).toBe('20')
    expect(minimum().value).toBe('5')
    expect(saveBar()).toBeNull()
  })

  it('touching a field writes nothing until Save, then sends only the changed key with the time unpadded', async () => {
    const { user } = renderPickup()
    await user.selectOptions(hours(), '1')
    expect(api.save).not.toHaveBeenCalled()
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(within(saveBar()).getByText(/Pickup Time/)).toBeTruthy()

    await user.click(barButton('Save'))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.save).toHaveBeenCalledWith({ pickup_time: '1:20' }, { accessToken: 'tok' })
    expect(updates).toHaveLength(1)
    expect(updates[0].pickup_time).toBe('1:20')
    // the value now comes from the saved business and the draft is empty
    expect(hours().value).toBe('1')
    expect(within(saveBar()).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('sends a minimum with decimals as a string and both keys when both changed', async () => {
    const { user } = renderPickup({ pickup_time: '0:20', minimum: null })
    expect(minimum().value).toBe('')
    await typeNumber(user, minimum(), '12.5')
    await user.selectOptions(minutes(), '5')
    expect(within(saveBar()).getByText(/2 unsaved changes/)).toBeTruthy()
    expect(within(saveBar()).getByText(/Pickup Time, Minimum purchase/)).toBeTruthy()

    await user.click(barButton('Save'))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.save).toHaveBeenCalledWith({ pickup_time: '0:5', minimum: '12.5' }, { accessToken: 'tok' })
  })

  it('a draft equal to the saved time after normalizing is not a change', async () => {
    const { user } = renderPickup({ pickup_time: '00:20', minimum: 5 })
    await user.selectOptions(hours(), '3')
    expect(saveBar()).not.toBeNull()
    await user.selectOptions(hours(), '0')
    expect(saveBar()).toBeNull()
    expect(host.isDirty()).toBe(false)
  })

  it("an empty minimum is sent as '' (clears it, as main)", async () => {
    const { user } = renderPickup()
    await typeNumber(user, minimum(), '')
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(minimum().getAttribute('aria-invalid')).not.toBe('true')
    await user.click(barButton('Save'))
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
    expect(api.save).toHaveBeenCalledWith({ minimum: '' }, { accessToken: 'tok' })
    expect(screen.queryByText('Enter a number, 0 or more.')).toBeNull()
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(minimum().value).toBe('')
  })

  it('the field refuses the minus sign, so a negative minimum can never be sent', async () => {
    const { user } = renderPickup()
    await user.clear(minimum())
    await user.type(minimum(), '-3')
    await user.tab()
    expect(minimum().value).toBe('3')
    await user.click(barButton('Save'))
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
    expect(api.save).toHaveBeenCalledWith({ minimum: '3' }, { accessToken: 'tok' })
  })

  it('a failure shows the text of the API in the bar (never the flag), keeps the draft, and Retry sends it again', async () => {
    api.save.mockImplementationOnce(async () => ({ content: { error: true, result: ['Nope'] } }))
    const { user } = renderPickup()
    await user.selectOptions(hours(), '2')
    await user.click(barButton('Save'))

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert.textContent).toContain('Nope')
    expect(alert.textContent).not.toMatch(/^true$/)
    expect(updates).toHaveLength(0)
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(hours().value).toBe('2')

    await user.click(within(saveBar()).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(api.save).toHaveBeenCalledTimes(2)
    expect(api.save).toHaveBeenLastCalledWith({ pickup_time: '2:20' }, { accessToken: 'tok' })
    expect(updates).toHaveLength(1)
  })

  it('a string answer and a thrown error show their text; a failure without text says the generic one', async () => {
    api.save.mockImplementationOnce(async () => ({ content: { error: true, result: 'Server said no' } }))
    const { user } = renderPickup()
    await user.selectOptions(hours(), '2')
    await user.click(barButton('Save'))
    expect((await screen.findByRole('alert')).textContent).toContain('Server said no')

    api.save.mockImplementationOnce(async () => { throw new Error('Network down') })
    await user.click(within(saveBar()).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Network down'))

    api.save.mockImplementationOnce(async () => ({ content: { error: true, result: null } }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("We couldn't save the change."))
  })

  it('Discard goes back to what is saved', async () => {
    const { user } = renderPickup()
    await user.selectOptions(hours(), '4')
    await typeNumber(user, minimum(), '9')
    await user.click(barButton('Discard'))
    expect(saveBar()).toBeNull()
    expect(hours().value).toBe('0')
    expect(minimum().value).toBe('5')
    expect(api.save).not.toHaveBeenCalled()
  })

  it('registers in the leave guard while there are unsaved changes', async () => {
    const { user } = renderPickup()
    expect(host.isDirty()).toBe(false)
    await user.selectOptions(hours(), '1')
    expect(host.isDirty()).toBe(true)
    await user.click(barButton('Discard'))
    expect(host.isDirty()).toBe(false)
  })
})
