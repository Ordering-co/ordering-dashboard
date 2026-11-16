import React, { useState } from 'react'
import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, it, expect, afterEach, beforeEach, describe } from 'vitest'
import { ConfigContext } from '../../../../../../contexts/ConfigContext'
import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product'
import { BusinessPreorderDetails } from '../index'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

// redesign stores 5.4: the section is one form with a draft and a save bar. Real Product pieces (TimeField,
// NumberField, SaveBar, useLeaveGuard); the controllers are simulated the way the editor's controller answers (contract of 5.4).

beforeEach(() => {
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const ALL = 'delivery,0|pickup,0|eatin,0|curbside,0|driver_thru,0|seat_delivery,0|catering_delivery,10|catering_pickup,20'
const KEYS = ['preorder_lead_time', 'preorder_slot_interval', 'preorder_time_range', 'preorder_minimum_days', 'preorder_maximum_days']
const fullConfigs = () => KEYS.map((key, index) => ({ id: index + 1, key, value: ALL }))

let host
// the editor's page: a host for the leave guard and a business that the controllers update
const Harness = ({ configs, preorderTime = 0, updateBusiness, updateConfigs, onHost }) => {
  const [business, setBusiness] = useState({ id: 1, preorder_time: preorderTime, configs })
  host = useLeaveGuardHost()
  onHost?.(host)
  const handleUpdateBusinessClick = async (changes, options) => {
    const result = await (updateBusiness?.(changes, options) ?? { ok: true })
    if (result.ok) setBusiness(current => ({ ...current, ...changes }))
    return result
  }
  const handleUpdatePreorderConfigs = async (value, id, options) => {
    const result = await (updateConfigs?.(value, id, options) ?? { ok: true })
    if (result.ok) setBusiness(current => ({ ...current, configs: current.configs.map(config => (config.id === id ? { ...config, value } : config)) }))
    return result
  }
  return (
    <LeaveGuardContext.Provider value={host.context}>
      <BusinessPreorderDetails
        business={business}
        formState={{ loading: false, changes: {} }}
        setFormState={vi.fn()}
        handleUpdateBusinessClick={handleUpdateBusinessClick}
        handleUpdatePreorderConfigs={handleUpdatePreorderConfigs}
        actionStatus={{ loading: false }}
      />
    </LeaveGuardContext.Provider>
  )
}

const renderPreorder = (configs, extra = {}) => {
  const updateBusiness = vi.fn(async () => ({ ok: true }))
  const updateConfigs = vi.fn(async () => ({ ok: true }))
  const user = userEvent.setup()
  render(
    <ConfigContext.Provider value={[{ configs: {} }, async () => {}]}>
      <Harness configs={configs} updateBusiness={updateBusiness} updateConfigs={updateConfigs} {...extra} />
    </ConfigContext.Provider>
  )
  return { user, updateBusiness, updateConfigs }
}

const setOf = type => within(screen.getByRole('group', { name: type === 'delivery' ? 'Catering delivery' : 'Catering pickup' }))
const fieldOf = (type, name) => setOf(type).getByRole('textbox', { name: new RegExp(name) })
const saveBar = () => screen.queryByRole('group', { name: 'Save changes' })
const barButton = name => within(saveBar()).getByRole('button', { name })

const typeNumber = async (user, input, text) => {
  await user.clear(input)
  if (text) await user.type(input, text)
  await user.tab()
}

describe('BusinessPreorderDetails (G3-33)', () => {
  it('keeps the current values when every segment exists', () => {
    renderPreorder(fullConfigs())
    expect(screen.getByRole('heading', { level: 1, name: 'Preorders and lead times' })).toBeTruthy()
    expect(fieldOf('delivery', 'Lead times per order type').value).toBe('10')
    expect(fieldOf('pickup', 'Lead times per order type').value).toBe('20')
  })

  it('renders when a preorder_* config has no segment for the type', () => {
    renderPreorder([{ id: 7, key: 'preorder_lead_time', value: 'delivery,0|catering_delivery,10' }])
    expect(screen.getByText('Catering pickup')).toBeTruthy()
    expect(fieldOf('delivery', 'Lead times per order type').value).toBe('10')
    expect(fieldOf('pickup', 'Lead times per order type').value).toBe('')
  })

  it('renders when a preorder_* config is not segmented or has no value', () => {
    renderPreorder([
      { id: 8, key: 'preorder_enabled', value: '1' },
      { id: 9, key: 'preorder_lead_time', value: null },
      { id: 10, value: 'catering_delivery,5' }
    ])
    expect(screen.getByText('Catering delivery')).toBeTruthy()
    expect(screen.getByText('Catering pickup')).toBeTruthy()
  })

  it('adds the missing segment instead of dropping the change', async () => {
    const { user, updateConfigs } = renderPreorder([{ id: 7, key: 'preorder_lead_time', value: 'delivery,0|catering_delivery,10' }])
    await typeNumber(user, fieldOf('pickup', 'Lead times per order type'), '30')
    await user.click(barButton('Save'))
    await waitFor(() => expect(updateConfigs).toHaveBeenCalledTimes(1))
    expect(updateConfigs).toHaveBeenCalledWith('delivery,0|catering_delivery,10|catering_pickup,30', 7, { inlineError: true })
  })

  it('writes the segment when the config exists with no value', async () => {
    const { user, updateConfigs } = renderPreorder([{ id: 9, key: 'preorder_lead_time', value: null }])
    await typeNumber(user, fieldOf('delivery', 'Lead times per order type'), '12')
    await user.click(barButton('Save'))
    await waitFor(() => expect(updateConfigs).toHaveBeenCalledTimes(1))
    expect(updateConfigs).toHaveBeenCalledWith('catering_delivery,12', 9, { inlineError: true })
  })

  it('has nothing to write when the config does not exist: the field is disabled and no bar appears', async () => {
    const { user, updateConfigs } = renderPreorder([])
    const input = fieldOf('delivery', 'Lead times per order type')
    expect(input.disabled).toBe(true)
    await user.type(input, '45')
    expect(saveBar()).toBeNull()
    expect(updateConfigs).not.toHaveBeenCalled()
  })

  it('tells a segment by its exact key, not by a text that contains it', async () => {
    const value = 'catering_pickup_extra,7|catering_pickup,20|catering_delivery,10'
    const { user, updateConfigs } = renderPreorder([{ id: 7, key: 'preorder_lead_time', value }])
    expect(fieldOf('pickup', 'Lead times per order type').value).toBe('20')
    await typeNumber(user, fieldOf('pickup', 'Lead times per order type'), '25')
    await user.click(barButton('Save'))
    await waitFor(() => expect(updateConfigs).toHaveBeenCalledTimes(1))
    expect(updateConfigs).toHaveBeenCalledWith('catering_pickup_extra,7|catering_pickup,25|catering_delivery,10', 7, { inlineError: true })
  })
})

describe('BusinessPreorderDetails (5.4 form)', () => {
  it('touching two fields writes nothing until Save, then sends the time and one call per changed config', async () => {
    const { user, updateBusiness, updateConfigs } = renderPreorder(fullConfigs(), { preorderTime: 90 })
    // the saved time reads «1 h 30 min»
    const hours = screen.getByRole('combobox', { name: /Pre order time Hours/ })
    expect(hours.value).toBe('1')

    await user.selectOptions(hours, '2')
    await typeNumber(user, fieldOf('delivery', 'Slot times'), '45')
    await typeNumber(user, fieldOf('pickup', 'Slot times'), '15')
    await typeNumber(user, fieldOf('pickup', 'Maximum days'), '7')
    expect(updateBusiness).not.toHaveBeenCalled()
    expect(updateConfigs).not.toHaveBeenCalled()
    expect(within(saveBar()).getByText(/4 unsaved changes/)).toBeTruthy()

    await user.click(barButton('Save'))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(updateBusiness).toHaveBeenCalledTimes(1)
    expect(updateBusiness).toHaveBeenCalledWith({ preorder_time: 150 }, { keepPendingChanges: true })
    // one call per config, the six foreign segments untouched
    expect(updateConfigs).toHaveBeenCalledTimes(2)
    expect(updateConfigs).toHaveBeenNthCalledWith(1, 'delivery,0|pickup,0|eatin,0|curbside,0|driver_thru,0|seat_delivery,0|catering_delivery,45|catering_pickup,15', 2, { inlineError: true })
    expect(updateConfigs).toHaveBeenNthCalledWith(2, 'delivery,0|pickup,0|eatin,0|curbside,0|driver_thru,0|seat_delivery,0|catering_delivery,10|catering_pickup,7', 5, { inlineError: true })
    // the values now come from the saved business and the draft is empty
    expect(fieldOf('delivery', 'Slot times').value).toBe('45')
    expect(within(saveBar()).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('names the changed fields with their order type in the bar', async () => {
    const { user } = renderPreorder(fullConfigs())
    await typeNumber(user, fieldOf('pickup', 'Slot times'), '15')
    expect(within(saveBar()).getByText(/Slot times · Catering pickup/)).toBeTruthy()
  })

  it('an empty value is an error under the field and nothing is sent', async () => {
    const { user, updateBusiness, updateConfigs } = renderPreorder(fullConfigs())
    await typeNumber(user, fieldOf('delivery', 'Time range'), '')
    await user.click(barButton('Save'))
    const input = fieldOf('delivery', 'Time range')
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
    expect(setOf('delivery').getByText('Enter a whole number, 0 or more.')).toBeTruthy()
    expect(updateBusiness).not.toHaveBeenCalled()
    expect(updateConfigs).not.toHaveBeenCalled()
  })

  it('with an empty catering field and the time changed, Save sends nothing and the focus goes to the invalid field', async () => {
    const { user, updateBusiness, updateConfigs } = renderPreorder(fullConfigs(), { preorderTime: 90 })
    await user.selectOptions(screen.getByRole('combobox', { name: /Pre order time Hours/ }), '2')
    await typeNumber(user, fieldOf('delivery', 'Time range'), '')
    await user.click(barButton('Save'))
    // the click left the focus on the Save button; the invalid field takes it on the next frame
    await waitFor(() => expect(document.activeElement).toBe(fieldOf('delivery', 'Time range')))
    expect(fieldOf('delivery', 'Time range').getAttribute('aria-invalid')).toBe('true')
    expect(updateBusiness).not.toHaveBeenCalled()
    expect(updateConfigs).not.toHaveBeenCalled()
  })

  it('a decimal is an error and letters never become a value', async () => {
    const { user, updateConfigs } = renderPreorder(fullConfigs())
    await typeNumber(user, fieldOf('pickup', 'Minimum days'), '1.5')
    await user.click(barButton('Save'))
    await waitFor(() => expect(setOf('pickup').getByText('Enter a whole number, 0 or more.')).toBeTruthy())
    expect(updateConfigs).not.toHaveBeenCalled()

    // letters are not accepted by the field: the saved value is what is left, so there is nothing to save
    await user.click(barButton('Discard'))
    await typeNumber(user, fieldOf('delivery', 'Minimum days'), 'abc')
    expect(fieldOf('delivery', 'Minimum days').value).not.toMatch(/[a-z]/i)
    expect(updateConfigs).not.toHaveBeenCalled()
  })

  it('«Use default value» puts the default in the draft without writing, and only shows when the value differs', async () => {
    const { user, updateConfigs } = renderPreorder(fullConfigs())
    const set = setOf('pickup')
    // saved 20 against a default of 0: the button shows; lead time default is 0
    const useDefault = set.getAllByRole('button', { name: /Use default value/ })
    expect(useDefault).toHaveLength(5)
    await user.click(set.getByRole('button', { name: /Use default value, Lead times per order type/ }))
    expect(fieldOf('pickup', 'Lead times per order type').value).toBe('0')
    expect(updateConfigs).not.toHaveBeenCalled()
    expect(set.getAllByRole('button', { name: /Use default value/ })).toHaveLength(4)
    expect(document.activeElement).toBe(fieldOf('pickup', 'Lead times per order type'))
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
  })

  it('Discard goes back to what is saved', async () => {
    const { user, updateConfigs, updateBusiness } = renderPreorder(fullConfigs(), { preorderTime: 60 })
    await typeNumber(user, fieldOf('delivery', 'Slot times'), '45')
    await user.selectOptions(screen.getByRole('combobox', { name: /Pre order time Minutes/ }), '30')
    await user.click(barButton('Discard'))
    expect(saveBar()).toBeNull()
    expect(fieldOf('delivery', 'Slot times').value).toBe('10')
    expect(screen.getByRole('combobox', { name: /Pre order time Minutes/ }).value).toBe('0')
    expect(updateConfigs).not.toHaveBeenCalled()
    expect(updateBusiness).not.toHaveBeenCalled()
  })

  it('a failure shows the error in the bar, keeps what was not saved, and Retry sends only that', async () => {
    const { user, updateConfigs, updateBusiness } = renderPreorder(fullConfigs())
    let calls = 0
    updateConfigs.mockImplementation(async () => (++calls === 2 ? { ok: false, error: ['Nope'] } : { ok: true }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Pre order time Hours/ }), '1')
    await typeNumber(user, fieldOf('delivery', 'Slot times'), '45')
    await typeNumber(user, fieldOf('delivery', 'Time range'), '15')
    await user.click(barButton('Save'))

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert.textContent).toContain('Nope')
    expect(updateBusiness).toHaveBeenCalledTimes(1)
    expect(updateConfigs).toHaveBeenCalledTimes(2)
    // time and slot times were stored; time range stays in the draft
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(fieldOf('delivery', 'Time range').value).toBe('15')

    await user.click(within(saveBar()).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(updateBusiness).toHaveBeenCalledTimes(1)
    expect(updateConfigs).toHaveBeenCalledTimes(3)
    expect(updateConfigs).toHaveBeenLastCalledWith(expect.stringContaining('catering_delivery,15'), 3, { inlineError: true })
  })

  it('registers in the leave guard while there are unsaved changes', async () => {
    const { user } = renderPreorder(fullConfigs())
    expect(host.isDirty()).toBe(false)
    await typeNumber(user, fieldOf('delivery', 'Slot times'), '45')
    expect(host.isDirty()).toBe(true)
    await user.click(barButton('Discard'))
    expect(host.isDirty()).toBe(false)
  })
})
