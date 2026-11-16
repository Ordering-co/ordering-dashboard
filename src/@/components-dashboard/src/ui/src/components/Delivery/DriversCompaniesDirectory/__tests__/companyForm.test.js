// redesign DC-B3 (decision 3 | M-DC9, M-DC10): the checks of the company's single save and the names of what is pending
import { describe, expect, it } from 'vitest'

import { changedFields, firstErrorSection, sectionOf, validate, valueOf } from '../companyForm'

const t = (_key, text) => text
const company = {
  id: 1,
  name: 'Fast Couriers',
  address: 'Main 1',
  timezone: 'UTC',
  webhook_new_order: null,
  webhook_cancel_request: null
}

describe('companyForm · valueOf', () => {
  it('reads the pending change, else the company (an empty change counts)', () => {
    expect(valueOf('name', {}, company)).toBe('Fast Couriers')
    expect(valueOf('name', { name: 'New' }, company)).toBe('New')
    expect(valueOf('name', { name: '' }, company)).toBe('')
    expect(valueOf('name', {}, null)).toBeUndefined()
  })
})

describe('companyForm · validate (edit)', () => {
  it('General, as main: name and address hold a value, and the time zone', () => {
    expect(validate({ section: 'general', company, t })).toEqual({})
    expect(validate({ section: 'general', company: { ...company, address: '' }, t })).toEqual({ address: 'Value is required' })
    expect(validate({ section: 'general', company: { ...company, timezone: null }, t })).toEqual({ timezone: 'Value is required' })
  })

  it('General does not check the webhooks the person did not touch (main saved a company without them)', () => {
    expect(validate({ section: 'general', changes: { limit: '5' }, company, t })).toEqual({})
  })

  it('Webhooks, as main: new order and cancel request hold a value, and the time zone', () => {
    expect(validate({ section: 'webhooks', company, t })).toEqual({
      webhook_new_order: 'Value is required',
      webhook_cancel_request: 'Value is required'
    })
    const filled = { webhook_new_order: 'https://a.test/new', webhook_cancel_request: 'https://a.test/cancel' }
    expect(validate({ section: 'webhooks', changes: filled, company, t })).toEqual({})
  })

  it('Schedule checks nothing of its own, as main', () => {
    expect(validate({ section: 'schedule', changes: { schedule: [] }, company: { ...company, timezone: null }, t })).toEqual({})
  })

  it('a required field emptied in another section is caught wherever the save is pressed', () => {
    expect(validate({ section: 'schedule', changes: { name: '  ' }, company, t })).toEqual({ name: 'Value is required' })
    expect(validate({ section: 'general', changes: { webhook_new_order: '' }, company: { ...company, webhook_new_order: 'x' }, t }))
      .toEqual({ webhook_new_order: 'Value is required' })
  })

  it('the order-status webhook and the limit are never required, as main', () => {
    expect(validate({ section: 'webhooks', changes: { webhook_new_order: 'a', webhook_cancel_request: 'b', webhook_order_status_changed: '' }, company, t })).toEqual({})
    expect(validate({ section: 'general', changes: { limit: '' }, company, t })).toEqual({})
  })

  // an integration company (owner_type system) has no webhooks to fill
  it('an integration company needs no webhooks (name, address and time zone stay required)', () => {
    expect(validate({ section: 'webhooks', company, integration: true, t })).toEqual({})
    expect(validate({ section: 'general', changes: { webhook_new_order: '' }, company: { ...company, webhook_new_order: 'x' }, integration: true, t })).toEqual({})
    expect(validate({ section: 'general', company: { ...company, name: '', timezone: null }, integration: true, t }))
      .toEqual({ name: 'Value is required', timezone: 'Value is required' })
    expect(validate({ section: 'webhooks', company, integration: false, t })).toEqual({
      webhook_new_order: 'Value is required',
      webhook_cancel_request: 'Value is required'
    })
  })

  it('names the field when the project translation asks for it', () => {
    const named = (key, text) => (key === 'VALIDATION_ERROR_REQUIRED' ? 'The _attribute_ field is required.' : text)
    expect(validate({ section: 'general', company: { ...company, name: '' }, t: named })).toEqual({ name: 'The Name field is required.' })
  })
})

describe('companyForm · validate (add)', () => {
  it('checks every required field and the time zone, as main (one page with the three sections)', () => {
    expect(Object.keys(validate({ mode: 'add', changes: {}, t }))).toEqual(['name', 'timezone', 'address', 'webhook_new_order', 'webhook_cancel_request'])
    const full = { name: 'N', address: 'A', timezone: 'UTC', webhook_new_order: 'x', webhook_cancel_request: 'y' }
    expect(validate({ mode: 'add', changes: full, t })).toEqual({})
  })
})

describe('companyForm · sections and names', () => {
  it('maps a field to its section', () => {
    expect(sectionOf('name')).toBe('general')
    expect(sectionOf('timezone')).toBe('general')
    expect(sectionOf('schedule')).toBe('schedule')
    expect(sectionOf('webhook_cancel_request')).toBe('webhooks')
  })

  it('finds the section of the first error in screen order', () => {
    expect(firstErrorSection({})).toBeNull()
    expect(firstErrorSection({ webhook_new_order: 'x', address: 'y' })).toBe('general')
    expect(firstErrorSection({ webhook_new_order: 'x' })).toBe('webhooks')
  })

  it('lists the pending fields in screen order, unknown ones last', () => {
    expect(changedFields({ schedule: [], name: 'x', extra: 1, webhook_new_order: 'y' })).toEqual(['name', 'schedule', 'webhook_new_order', 'extra'])
    expect(changedFields(undefined)).toEqual([])
  })
})
