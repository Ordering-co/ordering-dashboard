import { describe, expect, it } from 'vitest'
import {
  addProblems,
  allDaySchedule,
  businessBody,
  canRegisterStores,
  cleanSlug,
  citiesOf,
  followUpJobs,
  galleryBody,
  offeredPaymethods,
  paymethodBody,
  slugFromName,
  zoneBody,
  zoneProblems
} from '../storeAdd'

const validForm = { name: 'Pizza Place', slug: 'pizzaplace', email: 'owner@example.com' }

describe('storeAdd · slug', () => {
  it('keeps main: the name gives stringToSlug, a typed slug loses its spaces', () => {
    expect(cleanSlug('Pizza Place 2')).toBe('PizzaPlace2')
    expect(slugFromName('Café Ñandú Pizza')).toBe('cafe_nandu_pizza')
    expect(slugFromName('QA-REDESIGN-ADD Probe')).toBe('qa_redesign_add_probe')
  })
})

describe('storeAdd · problems', () => {
  it('asks for what main marks as required: name, slug, email and a payment method (G5-20, SA-02)', () => {
    expect(addProblems({ form: {}, paymethodIds: [] })).toEqual({ name: 'required', slug: 'required', email: 'required', payments: 'required' })
  })
  it('says an invalid slug or email apart from a missing one', () => {
    expect(addProblems({ form: { ...validForm, slug: 'pizza place', email: 'nope' }, paymethodIds: [1] })).toEqual({ slug: 'invalid', email: 'invalid' })
    expect(addProblems({ form: { ...validForm, slug: 'pizza_place' }, paymethodIds: [1] })).toEqual({})
  })
  it('a valid form without an address has no problems (the address stays optional, as in main)', () => {
    expect(addProblems({ form: validForm, paymethodIds: [1] })).toEqual({})
  })
  it('a zone being added must be complete; «0» is a valid minimum and fee (SA-03)', () => {
    expect(zoneProblems(null)).toEqual({})
    expect(zoneProblems({ name: 'Downtown', type: 4, minimum: '0', price: 0 })).toEqual({})
    expect(zoneProblems({ name: '', type: 2, minimum: '', price: '-1', data: [] })).toEqual({
      zoneName: 'required', zoneMinimum: 'required', zonePrice: 'invalid', zoneGeometry: 'required'
    })
    expect(zoneProblems({ name: 'A', type: 1, minimum: 1, price: 1, data: { center: { lat: 1, lng: 2 }, radio: 3 } })).toEqual({})
    expect(zoneProblems({ name: 'A', type: 5, minimum: 1, price: 1, data: { distance: '120' } })).toEqual({ zoneDistance: 'invalid' })
    expect(zoneProblems({ name: 'A', type: 5, minimum: 1, price: 1, data: { distance: 12, unit: 'km' } })).toEqual({})
  })
})

describe('storeAdd · request bodies (same as main)', () => {
  it('POST /business carries main defaults, the schedule and the city', () => {
    const schedule = allDaySchedule()
    expect(businessBody({ form: { ...validForm, slugEdited: true }, schedule, ownerId: 7, cityId: 3 })).toEqual({
      ...validForm, minimum: 0, delivery_price: 0, tax: 0, tax_type: 1, service_fee: 0, enabled: true, owner_id: 7, schedule, city_id: 3
    })
    expect(businessBody({ form: validForm, schedule, ownerId: 7 })).not.toHaveProperty('city_id')
    // review: a price level Google filled and a later business emptied is left out, as when it was never set
    expect(businessBody({ form: { ...validForm, price_level: '' }, schedule, ownerId: 7 })).not.toHaveProperty('price_level')
    expect(businessBody({ form: { ...validForm, price_level: '3' }, schedule, ownerId: 7 }).price_level).toBe('3')
  })
  // (PP-1): the same `description` of POST /business that the retired side form sent
  it('the store carries the description the form holds', () => {
    const schedule = allDaySchedule()
    expect(businessBody({ form: { ...validForm, description: 'Slices' }, schedule, ownerId: 7 }).description).toBe('Slices')
    expect(businessBody({ form: validForm, schedule, ownerId: 7 })).not.toHaveProperty('description')
  })
  it('payment methods go in sandbox for the gateways main named', () => {
    expect(paymethodBody({ id: 4, gateway: 'paypal' })).toEqual({ enabled: true, paymethod_id: 4, sandbox: true })
    expect(paymethodBody({ id: 5, gateway: 'cash' })).toEqual({ enabled: true, paymethod_id: 5, sandbox: false })
  })
  it('the gallery and the zone bodies are main\'s', () => {
    expect(galleryBody(9, { file: 'data:x', temp_id: 'a' })).toEqual({ business_id: 9, file: 'data:x', type: 1 })
    const body = zoneBody({ name: 'Downtown', type: 1, minimum: '5', price: '2', data: { center: { lat: 1, lng: 2 }, radio: 3 } })
    expect(body).toMatchObject({ name: 'Downtown', type: 1, minimum: '5', price: '2', enabled: true })
    expect(JSON.parse(body.data)).toEqual({ center: { lat: 1, lng: 2 }, radio: 3 })
    expect(JSON.parse(body.schedule)).toHaveLength(7)
  })
  it('the follow-up writes keep main\'s order and have stable keys', () => {
    expect(followUpJobs({ paymethodIds: [1, 2], gallery: [{ temp_id: 'p', file: 'x' }], zone: { name: 'Z' } }).map(job => job.key))
      .toEqual(['paymethod:1', 'paymethod:2', 'photo:p', 'zone'])
  })
})

describe('storeAdd · project rules', () => {
  it('register stores: the list\'s rule', () => {
    expect(canRegisterStores({ level: 0 }, { allow_business_owner_register_business: { value: '0' } })).toBe(true)
    expect(canRegisterStores({ level: 2 }, {})).toBe(true)
    expect(canRegisterStores({ level: 2 }, { allow_business_owner_register_business: { value: '0' } })).toBe(false)
    expect(canRegisterStores({ level: 2 }, { allow_business_owner_register_business: { value: '1' } })).toBe(true)
  })
  // bugs E: one rule for the list, ⌘K, the /stores/add route and Duplicate; the setting is on as '1', 1 or true (⌘K's reading)
  it('register stores: the setting is on as 1 or true too, and off as anything else', () => {
    expect(canRegisterStores({ level: 2 }, { allow_business_owner_register_business: { value: 1 } })).toBe(true)
    expect(canRegisterStores({ level: 2 }, { allow_business_owner_register_business: { value: true } })).toBe(true)
    expect(canRegisterStores({ level: 2 }, { allow_business_owner_register_business: { value: false } })).toBe(false)
    expect(canRegisterStores({ level: 2 }, { allow_business_owner_register_business: { value: '' } })).toBe(false)
    expect(canRegisterStores(undefined, undefined)).toBe(true)
  })
  it('cities of enabled countries', () => {
    expect(citiesOf([{ enabled: false, cities: [{ id: 1 }] }, { enabled: true, cities: [{ id: 2 }, { id: 3 }] }]).map(c => c.id)).toEqual([2, 3])
  })
  it('never offers the gateways main left out', () => {
    expect(offeredPaymethods([{ gateway: 'cash' }, { gateway: 'stripe_direct' }, { gateway: 'authorize' }]).map(p => p.gateway)).toEqual(['cash'])
  })
})
