import React from 'react'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, it, expect, afterEach, describe } from 'vitest'
import { BusinessCateringDelivery, readCateringSegment, withCateringSegments } from '../index'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

// redesign stores 5.4: one fieldset of five NumberFields per catering order type. It holds no state: the section
// keeps the draft, so here the draft comes in as a prop and the changes go out as calls.

afterEach(cleanup)

const KEYS = ['preorder_lead_time', 'preorder_slot_interval', 'preorder_time_range', 'preorder_minimum_days', 'preorder_maximum_days']
const business = value => ({ configs: KEYS.map((key, index) => ({ id: index + 1, key, value })) })

describe('catering segment helpers', () => {
  it('reads the segment of a type by its exact key', () => {
    const config = { value: 'catering_pickup_extra,7|catering_pickup,20|catering_delivery,10' }
    expect(readCateringSegment(config, 'catering_pickup')).toBe(20)
    expect(readCateringSegment(config, 'catering_delivery')).toBe(10)
    expect(readCateringSegment({ value: 'delivery,0' }, 'catering_delivery')).toBeNull()
    expect(readCateringSegment({ value: null }, 'catering_delivery')).toBeNull()
    expect(readCateringSegment(undefined, 'catering_delivery')).toBeNull()
    expect(readCateringSegment({ value: 'catering_delivery,abc' }, 'catering_delivery')).toBeNull()
  })

  it('replaces only the segments it is told, adds the missing ones at the end and keeps the rest exact', () => {
    const value = 'delivery,0|pickup,0|eatin,0|curbside,0|driver_thru,0|seat_delivery,0|catering_delivery,5|catering_pickup,5'
    expect(withCateringSegments({ value }, { catering_delivery: 9 }))
      .toBe('delivery,0|pickup,0|eatin,0|curbside,0|driver_thru,0|seat_delivery,0|catering_delivery,9|catering_pickup,5')
    expect(withCateringSegments({ value }, { catering_delivery: 1, catering_pickup: 2 }))
      .toBe('delivery,0|pickup,0|eatin,0|curbside,0|driver_thru,0|seat_delivery,0|catering_delivery,1|catering_pickup,2')
    expect(withCateringSegments({ value: 'delivery,0' }, { catering_pickup: 3 })).toBe('delivery,0|catering_pickup,3')
    expect(withCateringSegments({ value: null }, { catering_delivery: 3 })).toBe('catering_delivery,3')
  })
})

describe('BusinessCateringDelivery', () => {
  it('is a fieldset named by its legend with five labelled fields and their defaults as hints', () => {
    render(<BusinessCateringDelivery type='catering_pickup' business={business('catering_pickup,20')} />)
    const group = within(screen.getByRole('group', { name: 'Catering pickup' }))
    expect(group.getAllByRole('textbox')).toHaveLength(5)
    expect(group.getByRole('textbox', { name: 'Lead times per order type (Minutes)' }).value).toBe('20')
    expect(group.getByRole('textbox', { name: 'Maximum days (Days)' })).toHaveAccessibleDescription('Default = 15 Days')
    expect(group.getByRole('textbox', { name: 'Slot times (Minutes)' })).toHaveAccessibleDescription('Default = 30 minutes.')
    expect(group.getByRole('textbox', { name: 'Lead times per order type (Minutes)' })).toHaveAccessibleDescription('Default = 0 (allows asap orders).')
  })

  it('shows the draft over the saved value and the default button only when the value is not the default', () => {
    render(<BusinessCateringDelivery type='catering_delivery' business={business('catering_delivery,0')} draft={{ 'catering_delivery:preorder_lead_time': 5 }} />)
    expect(screen.getByRole('textbox', { name: /Lead times/ }).value).toBe('5')
    // lead time 5 (default 0), slot times, time range and maximum days (0 against 30, 30 and 15) differ; minimum days is 0 = default
    expect(screen.getAllByRole('button', { name: /Use default value/ })).toHaveLength(4)
  })

  it('reports a typed value by its draft key and the default by the same call', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onUseDefault = vi.fn()
    render(<BusinessCateringDelivery type='catering_delivery' business={business('catering_delivery,10')} onChange={onChange} onUseDefault={onUseDefault} />)
    const input = screen.getByRole('textbox', { name: /Slot times/ })
    await user.clear(input)
    await user.type(input, '45')
    expect(onChange).toHaveBeenLastCalledWith('catering_delivery:preorder_slot_interval', 45)
    await user.click(screen.getByRole('button', { name: /Use default value, Slot times/ }))
    expect(onUseDefault).toHaveBeenCalledWith('catering_delivery:preorder_slot_interval', 30)
  })

  it('paints the error under its field and disables the fields of a config that does not exist', () => {
    render(<BusinessCateringDelivery type='catering_delivery' business={{ configs: [{ id: 1, key: 'preorder_lead_time', value: null }] }} errors={{ 'catering_delivery:preorder_lead_time': 'Enter a whole number, 0 or more.' }} />)
    expect(screen.getByRole('textbox', { name: /Lead times/ })).toHaveAccessibleDescription(/Enter a whole number/)
    expect(screen.getByRole('textbox', { name: /Lead times/ }).disabled).toBe(false)
    expect(screen.getByRole('textbox', { name: /Slot times/ }).disabled).toBe(true)
    expect(screen.queryAllByRole('button', { name: /Use default value/ })).toHaveLength(1)
  })
})
