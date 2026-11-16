import React, { useState } from 'react'
import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, it, expect, afterEach, beforeEach, describe } from 'vitest'
import { ConfigContext } from '../../../../../../contexts/ConfigContext'
import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product'
import { BusinessDeliveryDetails } from '../index'

const mocks = vi.hoisted(() => ({
  save: null,
  zoneListProps: null
}))

// the real controller; the editor's contexts and the zone list (another lot) are simulated
vi.mock('../../../../../../index', async () => ({
  useLanguage: () => [{}, (key, fallback) => fallback],
  BusinessDeliveryDetails: (await import('../../../../../../components/BusinessDeliveryDetails')).BusinessDeliveryDetails
}))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'token' }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', businesses: () => ({ save: (...args) => mocks.save(...args) }) }]
}))
vi.mock('../../BusinessDeliveryZoneList', () => ({
  BusinessDeliveryZoneList: (props) => {
    mocks.zoneListProps = props
    const { business, zoneListState, handleChangeZoneState, handleChangeAllZoneState } = props
    return (
      <div>
        <input
          type='checkbox'
          aria-label='All zones'
          checked={zoneListState.isCheckAll}
          onChange={event => handleChangeAllZoneState(event.target.checked)}
        />
        {business.zones.filter(zone => zone.type !== 3).map(zone => (
          <input
            key={zone.id}
            type='checkbox'
            aria-label={zone.name}
            checked={!!zoneListState.changes[zone.id]}
            onChange={event => handleChangeZoneState(zone.id, event.target.checked)}
          />
        ))}
      </div>
    )
  }
}))

// redesign stores 5.7: Delivery is one form with a draft and a save bar. Real Product pieces (TimeField, NumberField,
// Field, SaveBar, useLeaveGuard) and the real controller; only the network and the zone list are simulated.

beforeEach(() => {
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  mocks.save = vi.fn(async (changes) => ({ content: { error: false, result: { ...changes } } }))
  mocks.zoneListProps = null
  global.fetch = vi.fn(async () => ({ json: async () => ({ error: false, result: {} }) }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const zones = () => [1, 2, 3].map(id => ({ id, name: `Zone ${id}`, enabled: true, type: 1 }))

let host
// the editor's page: a host for the leave guard and a business that handleUpdateBusinessState merges into (Object.assign)
const Harness = ({ initial, setIsExtendExtraOpen }) => {
  const [business, setBusiness] = useState(initial)
  host = useLeaveGuardHost()
  return (
    <LeaveGuardContext.Provider value={host.context}>
      <BusinessDeliveryDetails
        business={business}
        setIsExtendExtraOpen={setIsExtendExtraOpen}
        handleUpdateBusinessState={changes => setBusiness(current => ({ ...current, ...changes }))}
      />
    </LeaveGuardContext.Provider>
  )
}

const renderDelivery = (business = {}) => {
  const setIsExtendExtraOpen = vi.fn()
  const user = userEvent.setup()
  render(
    <ConfigContext.Provider value={[{ configs: {} }, async () => {}]}>
      <Harness
        initial={{ id: 2, delivery_time: '2:0', cancel_order_after_minutes: 30, order_default_priority: 0, zones: zones(), ...business }}
        setIsExtendExtraOpen={setIsExtendExtraOpen}
      />
    </ConfigContext.Provider>
  )
  return { user, setIsExtendExtraOpen }
}

const hours = () => screen.getByRole('combobox', { name: /Delivery time Hours/ })
const minutes = () => screen.getByRole('combobox', { name: /Delivery time Minutes/ })
const expire = () => screen.getByRole('textbox', { name: /Expire order after minutes/ })
const priority = () => screen.getByRole('combobox', { name: /Order default priority/ })
const saveBar = () => screen.queryByRole('group', { name: 'Save changes' })
const barButton = name => within(saveBar()).getByRole('button', { name })
const putUrls = () => global.fetch.mock.calls.map(([url]) => url.split('/').pop())

describe('BusinessDeliveryDetails (5.7 form)', () => {
  it('shows the saved values, the subsections and feeds the zone list its props', () => {
    const { setIsExtendExtraOpen } = renderDelivery()
    expect(screen.getByRole('heading', { level: 2, name: 'Order time' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Logistic' })).toBeTruthy()
    expect(hours().value).toBe('2')
    expect(minutes().value).toBe('0')
    expect(expire().value).toBe('30')
    expect(priority().value).toBe('0')
    expect(Array.from(priority().options).map(option => [option.value, option.textContent])).toEqual([['2', 'Urgent'], ['1', 'High'], ['0', 'Normal'], ['-1', 'Low']])
    expect(saveBar()).toBeNull()
    expect(Object.keys(mocks.zoneListProps).sort()).toEqual(['business', 'handleChangeAllZoneState', 'handleChangeZoneState', 'handleSuccessUpdate', 'onClose', 'setIsExtendExtraOpen', 'zoneListState'])
    mocks.zoneListProps.onClose()
    expect(setIsExtendExtraOpen).toHaveBeenCalledWith(false)
  })

  it('a priority that is not one of the four shows an empty option', () => {
    renderDelivery({ order_default_priority: 5 })
    expect(priority().value).toBe('')
    expect(priority().options[0].textContent).toBe('Select priority')
  })

  it('touching the time writes nothing until Save, then sends only the changed key with the unpadded "H:M"', async () => {
    const { user } = renderDelivery()
    await user.selectOptions(hours(), '3')
    await user.selectOptions(minutes(), '5')
    expect(mocks.save).not.toHaveBeenCalled()
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(within(saveBar()).getByText(/Delivery time/)).toBeTruthy()

    await user.click(barButton('Save'))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save).toHaveBeenCalledWith({ delivery_time: '3:5' }, { accessToken: 'token' })
    expect(global.fetch).not.toHaveBeenCalled()
    // the value now comes from the business and the draft is empty
    expect(hours().value).toBe('3')
    expect(within(saveBar()).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('a time equal to the saved one in another writing ("02:00" and "2:0") is not a change', async () => {
    const { user } = renderDelivery({ delivery_time: '02:00' })
    expect(hours().value).toBe('2')
    await user.selectOptions(hours(), '3')
    expect(saveBar()).not.toBeNull()
    await user.selectOptions(hours(), '2')
    expect(saveBar()).toBeNull()
    expect(host.isDirty()).toBe(false)
  })

  it('changes the three fields together and sends exactly those keys, «Expire» as a string', async () => {
    const { user } = renderDelivery()
    await user.selectOptions(minutes(), '45')
    await user.clear(expire())
    await user.type(expire(), '15')
    await user.tab()
    await user.selectOptions(priority(), '1')
    expect(within(saveBar()).getByText(/3 unsaved changes/)).toBeTruthy()
    await user.click(barButton('Save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith({ delivery_time: '2:45', cancel_order_after_minutes: '15', order_default_priority: '1' }, { accessToken: 'token' })
  })

  it("an empty Expire is sent as '' (clears it, as main)", async () => {
    const { user } = renderDelivery()
    await user.clear(expire())
    await user.tab()
    expect(expire().getAttribute('aria-invalid')).not.toBe('true')
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    await user.click(barButton('Save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith({ cancel_order_after_minutes: '' }, { accessToken: 'token' })
    expect(screen.queryByText('Enter a whole number, 0 or more.')).toBeNull()
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(expire().value).toBe('')
  })

  it('a decimal still blocks the save with the message, focus and nothing sent, and typing again clears the message', async () => {
    const { user } = renderDelivery()
    await user.clear(expire())
    await user.type(expire(), '1.5')
    await user.tab()
    await user.click(barButton('Save'))
    await waitFor(() => expect(screen.getByText('Enter a whole number, 0 or more.')).toBeTruthy())
    expect(expire().getAttribute('aria-invalid')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(expire()))
    expect(mocks.save).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
    await user.clear(expire())
    await user.type(expire(), '20')
    expect(screen.queryByText('Enter a whole number, 0 or more.')).toBeNull()
  })

  it('an empty «Expire» that was already empty is not a change', async () => {
    const { user } = renderDelivery({ cancel_order_after_minutes: null })
    expect(expire().value).toBe('')
    await user.click(expire())
    await user.tab()
    expect(saveBar()).toBeNull()
  })

  it('zones: 3 pending, the 2nd fails; the others go, the fields are saved, the bar names the 2nd and Retry sends only it', async () => {
    const { user } = renderDelivery()
    global.fetch = vi.fn(async (url) => ({
      json: async () => (url.endsWith('/2') && global.fetch.mock.calls.length <= 3
        ? { error: true, result: ['Zone is in use'] }
        : { error: false, result: {} })
    }))
    await user.click(screen.getByRole('checkbox', { name: 'All zones' }))
    await user.selectOptions(minutes(), '30')
    const names = within(saveBar()).getByText(/Delivery time, Zone 1, Zone 2 \+1/)
    expect(names).toBeTruthy()
    expect(within(saveBar()).getByText(/4 unsaved changes/)).toBeTruthy()

    await user.click(barButton('Save'))
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert.textContent).toContain("These zones weren't saved: Zone 2.")
    // zones 1 and 3 were sent despite the failure of the 2nd; so were the fields
    expect(putUrls()).toEqual(['1', '2', '3'])
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ enabled: false })
    expect(mocks.save).toHaveBeenCalledWith({ delivery_time: '2:30' }, { accessToken: 'token' })
    // what is left is the 2nd zone
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(within(saveBar()).getByText(/^· Zone 2$/)).toBeTruthy()
    expect(minutes().value).toBe('30')
    expect(screen.getByRole('checkbox', { name: 'Zone 1' }).checked).toBe(false)
    expect(screen.getByRole('checkbox', { name: 'Zone 2' }).checked).toBe(false)

    await user.click(within(saveBar()).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(putUrls()).toEqual(['1', '2', '3', '2'])
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })

  it('a failed fields save keeps the field drafts and shows the message; the zones that were saved are gone', async () => {
    const { user } = renderDelivery()
    mocks.save = vi.fn(async () => ({ content: { error: true, result: ['Invalid delivery time'] } }))
    await user.click(screen.getByRole('checkbox', { name: 'Zone 1' }))
    await user.selectOptions(minutes(), '30')
    await user.click(barButton('Save'))
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert.textContent).toContain('Invalid delivery time')
    expect(putUrls()).toEqual(['1'])
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(minutes().value).toBe('30')
    expect(screen.getByRole('checkbox', { name: 'Zone 1' }).checked).toBe(false)
  })

  it('the Expire input shows a saved 1440 without a separator', () => {
    renderDelivery({ cancel_order_after_minutes: 1440 })
    expect(expire().value).toBe('1440')
  })

  it('while a save is pending the fields and the priority select are disabled, and they come back after it', async () => {
    const { user } = renderDelivery()
    let release
    mocks.save = vi.fn(() => new Promise(resolve => { release = resolve }))
    await user.selectOptions(priority(), '1')
    await user.click(barButton('Save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith({ order_default_priority: '1' }, { accessToken: 'token' })
    expect(priority().disabled).toBe(true)
    expect(expire().disabled).toBe(true)
    expect(hours().disabled).toBe(true)
    expect(minutes().disabled).toBe(true)

    release({ content: { error: false, result: { order_default_priority: '1' } } })
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(priority().disabled).toBe(false)
    expect(priority().value).toBe('1')
    expect(expire().disabled).toBe(false)
    expect(saveBar()).not.toBeNull()
    expect(within(saveBar()).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('a zone and the fields failing: the bar says the zones, then the fields that were not saved, then the API text', async () => {
    const { user } = renderDelivery()
    mocks.save = vi.fn(async () => ({ content: { error: true, result: ['Invalid delivery time'] } }))
    global.fetch = vi.fn(async () => ({ json: async () => ({ error: true, result: ['Zone is in use'] }) }))
    await user.click(screen.getByRole('checkbox', { name: 'Zone 1' }))
    await user.selectOptions(minutes(), '30')
    await user.click(barButton('Save'))
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert.textContent).toContain("These zones weren't saved: Zone 1. These changes weren't saved: Delivery time. Invalid delivery time")
    expect(putUrls()).toEqual(['1'])
    expect(mocks.save).toHaveBeenCalledWith({ delivery_time: '2:30' }, { accessToken: 'token' })
    expect(within(saveBar()).getByText(/2 unsaved changes/)).toBeTruthy()
    expect(minutes().value).toBe('30')
  })

  it('pending zone enables survive a business.zones update from the zone panel', async () => {
    const { user } = renderDelivery()
    await user.click(screen.getByRole('checkbox', { name: 'Zone 1' }))
    // the zone panel saves a zone and the editor merges the new list
    mocks.zoneListProps.handleSuccessUpdate({ zones: [{ id: 1, name: 'Zone 1', enabled: true, type: 1 }, { id: 3, name: 'Zone 3', enabled: true, type: 1 }, { id: 9, name: 'Zone 9', enabled: false, type: 1 }] })
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Zone 9' })).toBeTruthy())
    expect(screen.getByRole('checkbox', { name: 'Zone 1' }).checked).toBe(false)
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'All zones' }).checked).toBe(false)
  })

  it('«All zones» is not checked when the business has no zones (G3-23)', () => {
    renderDelivery({ zones: [] })
    expect(screen.getByRole('checkbox', { name: 'All zones' }).checked).toBe(false)
  })

  it('Discard goes back to what is saved: fields, errors and pending zones', async () => {
    const { user } = renderDelivery()
    await user.click(screen.getByRole('checkbox', { name: 'Zone 2' }))
    await user.selectOptions(priority(), '2')
    await user.selectOptions(minutes(), '10')
    await user.click(barButton('Discard'))
    expect(saveBar()).toBeNull()
    expect(priority().value).toBe('0')
    expect(minutes().value).toBe('0')
    expect(screen.getByRole('checkbox', { name: 'Zone 2' }).checked).toBe(true)
    expect(mocks.save).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('registers in the leave guard while there are unsaved changes', async () => {
    const { user } = renderDelivery()
    expect(host.isDirty()).toBe(false)
    await user.click(screen.getByRole('checkbox', { name: 'Zone 3' }))
    expect(host.isDirty()).toBe(true)
    await user.click(barButton('Discard'))
    expect(host.isDirty()).toBe(false)
  })
})
