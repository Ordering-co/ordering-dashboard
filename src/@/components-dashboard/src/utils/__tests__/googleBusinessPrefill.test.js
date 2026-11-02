import { describe, expect, it, vi } from 'vitest'

import {
  googleHoursToSchedule,
  fromNewPlace,
  fromLegacyPlace,
  isGoogleBusiness,
  mergePrefill,
  toE164
} from '../googleBusinessPrefill'

const lapse = (openHour, openMinute, closeHour, closeMinute) => ({
  open: { hour: openHour, minute: openMinute },
  close: { hour: closeHour, minute: closeMinute }
})
const fullDay = lapse(0, 0, 23, 59)
const closed = { enabled: false, lapses: [fullDay] }

describe('googleHoursToSchedule', () => {
  it('returns null when Google has no opening hours', () => {
    expect(googleHoursToSchedule(undefined)).toBeNull()
    expect(googleHoursToSchedule([])).toBeNull()
  })

  it('marks days without periods as closed instead of open all day', () => {
    const schedule = googleHoursToSchedule([
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 30 } }
    ])

    expect(schedule).toHaveLength(7)
    expect(schedule[1]).toEqual({ enabled: true, lapses: [lapse(9, 0, 17, 30)] })
    expect(schedule[0]).toEqual(closed)
    expect(schedule[6]).toEqual(closed)
  })

  it('maps a single period without close to open 24/7', () => {
    const schedule = googleHoursToSchedule([{ open: { day: 0, hour: 0, minute: 0 } }])

    expect(schedule).toEqual(Array.from({ length: 7 }, () => ({ enabled: true, lapses: [fullDay] })))
  })

  it('keeps split shifts sorted and merges touching ones', () => {
    const schedule = googleHoursToSchedule([
      { open: { day: 2, hour: 18, minute: 0 }, close: { day: 2, hour: 22, minute: 0 } },
      { open: { day: 2, hour: 11, minute: 0 }, close: { day: 2, hour: 15, minute: 0 } },
      { open: { day: 3, hour: 11, minute: 0 }, close: { day: 3, hour: 15, minute: 0 } },
      { open: { day: 3, hour: 15, minute: 0 }, close: { day: 3, hour: 22, minute: 0 } }
    ])

    expect(schedule[2].lapses).toEqual([lapse(11, 0, 15, 0), lapse(18, 0, 22, 0)])
    expect(schedule[3].lapses).toEqual([lapse(11, 0, 22, 0)])
  })

  it('splits periods that cross midnight, including Saturday into Sunday', () => {
    const schedule = googleHoursToSchedule([
      { open: { day: 5, hour: 20, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } },
      { open: { day: 6, hour: 20, minute: 0 }, close: { day: 0, hour: 3, minute: 30 } }
    ])

    expect(schedule[5].lapses).toEqual([lapse(20, 0, 23, 59)])
    expect(schedule[6].lapses).toEqual([lapse(0, 0, 2, 0), lapse(20, 0, 23, 59)])
    expect(schedule[0]).toEqual({ enabled: true, lapses: [lapse(0, 0, 3, 30)] })
  })

  it('does not add an empty lapse when a period closes exactly at midnight', () => {
    const schedule = googleHoursToSchedule([
      { open: { day: 1, hour: 18, minute: 0 }, close: { day: 2, hour: 0, minute: 0 } }
    ])

    expect(schedule[1].lapses).toEqual([lapse(18, 0, 23, 59)])
    expect(schedule[2]).toEqual(closed)
  })

  it('accepts legacy points that use hours and minutes', () => {
    const schedule = googleHoursToSchedule([
      { open: { day: 4, hours: 8, minutes: 15 }, close: { day: 4, hours: 12, minutes: 45 } }
    ])

    expect(schedule[4].lapses).toEqual([lapse(8, 15, 12, 45)])
  })
})

describe('fromNewPlace', () => {
  it('normalizes a Places API (New) place with photos and attributions', () => {
    const getURI = vi.fn(({ maxWidth }) => `https://photo.example/${maxWidth}`)
    const business = fromNewPlace({
      id: 'place-1',
      displayName: 'Joe’s Pizza',
      internationalPhoneNumber: '+1 212-366-1182',
      formattedAddress: '7 Carmine St, New York, NY 10014, USA',
      location: { lat: () => 40.73, lng: () => -74.0 },
      addressComponents: [{ longText: '10014', shortText: '10014', types: ['postal_code'] }],
      regularOpeningHours: { periods: [{ open: { day: 1, hour: 10, minute: 0 }, close: { day: 1, hour: 23, minute: 0 } }] },
      priceLevel: 'INEXPENSIVE',
      websiteURI: 'https://joespizzanyc.com/',
      googleMapsURI: 'https://maps.google.com/?cid=1',
      primaryTypeDisplayName: 'Pizza restaurant',
      businessStatus: 'OPERATIONAL',
      types: ['pizza_restaurant', 'establishment'],
      photos: [{ getURI, authorAttributions: [{ displayName: 'Ana', uri: 'https://maps.google.com/contrib/1' }] }]
    })

    expect(business).toMatchObject({
      placeId: 'place-1',
      name: 'Joe’s Pizza',
      phone: '+1 212-366-1182',
      address: '7 Carmine St, New York, NY 10014, USA',
      location: { lat: 40.73, lng: -74.0 },
      zipcode: '10014',
      priceLevel: 1,
      website: 'https://joespizzanyc.com/',
      mapsUrl: 'https://maps.google.com/?cid=1',
      category: 'Pizza restaurant',
      status: 'OPERATIONAL',
      isBusiness: true,
      canCopyPhotos: true
    })
    expect(business.schedule[1].lapses).toEqual([lapse(10, 0, 23, 0)])
    expect(business.photos).toEqual([{
      id: 'photo-0',
      thumbnailUrl: 'https://photo.example/400',
      url: 'https://photo.example/1600',
      logoUrl: 'https://photo.example/512',
      attributions: [{ name: 'Ana', uri: 'https://maps.google.com/contrib/1' }]
    }])
  })

  it('keeps missing fields empty so the user can fill them', () => {
    const business = fromNewPlace({ id: 'place-2', displayName: 'Only name', location: { lat: 1, lng: 2 } })

    expect(business).toMatchObject({ phone: '', website: '', schedule: null, photos: [], location: { lat: 1, lng: 2 }, zipcode: null })
  })
})

describe('fromLegacyPlace', () => {
  it('normalizes a legacy PlacesService place and parses html attributions', () => {
    const getUrl = vi.fn(({ maxWidth }) => `https://legacy.example/${maxWidth}`)
    const business = fromLegacyPlace({
      place_id: 'legacy-1',
      name: 'Legacy Cafe',
      international_phone_number: '+52 55 1234 5678',
      formatted_address: 'Av. Reforma 1, CDMX',
      geometry: { location: { lat: () => 19.4, lng: () => -99.1 } },
      address_components: [],
      opening_hours: { periods: [{ open: { day: 2, hours: 7, minutes: 0 }, close: { day: 2, hours: 14, minutes: 0 } }] },
      price_level: 2,
      website: 'https://legacy.example',
      url: 'https://maps.google.com/?cid=2',
      business_status: 'CLOSED_PERMANENTLY',
      types: ['cafe', 'establishment'],
      photos: [{ getUrl, html_attributions: ['<a href="https://maps.google.com/contrib/9">Luis &amp; Co</a>'] }]
    })

    expect(business).toMatchObject({
      placeId: 'legacy-1',
      name: 'Legacy Cafe',
      location: { lat: 19.4, lng: -99.1 },
      priceLevel: 2,
      status: 'CLOSED_PERMANENTLY',
      isBusiness: true,
      canCopyPhotos: false
    })
    expect(business.schedule[2].lapses).toEqual([lapse(7, 0, 14, 0)])
    expect(business.photos[0]).toMatchObject({
      url: 'https://legacy.example/1600',
      attributions: [{ name: 'Luis & Co', uri: 'https://maps.google.com/contrib/9' }]
    })
  })
})

describe('isGoogleBusiness', () => {
  it('only accepts establishments, never plain addresses or buildings', () => {
    expect(isGoogleBusiness(['restaurant', 'point_of_interest', 'establishment'])).toBe(true)
    expect(isGoogleBusiness(['premise', 'street_address'])).toBe(false)
    expect(isGoogleBusiness(undefined)).toBe(false)
  })
})

describe('toE164', () => {
  it('strips formatting from international numbers', () => {
    expect(toE164('+1 212-366-1182')).toBe('+12123661182')
    expect(toE164('')).toBe('')
    expect(toE164('(212) 366-1182')).toBe('')
  })
})

describe('mergePrefill', () => {
  it('fills empty groups and records what Google applied', () => {
    const result = mergePrefill({
      current: { name: '', phone: '' },
      next: { name: { name: 'Joe’s' }, phone: { phone: '+1 212' } }
    })

    expect(result.changes).toEqual({ name: 'Joe’s', phone: '+1 212' })
    expect(result.applied).toEqual({ name: { name: 'Joe’s' }, phone: { phone: '+1 212' } })
    expect(result.suggestions).toEqual({})
  })

  it('never overwrites what the user typed and suggests the Google value instead', () => {
    const result = mergePrefill({
      current: { name: 'Joe Pizza', phone: '' },
      next: { name: { name: 'Joe’s Pizza' }, phone: { phone: '+1 212' } }
    })

    expect(result.changes).toEqual({ phone: '+1 212' })
    expect(result.suggestions).toEqual({ name: { name: 'Joe’s Pizza' } })
    expect(result.applied).toEqual({ phone: { phone: '+1 212' } })
  })

  it('replaces values that came from a previous Google business and clears the ones the new business lacks', () => {
    const result = mergePrefill({
      current: { name: 'Wrong Store', phone: '+1 111', address: 'Typed by user' },
      applied: { name: { name: 'Wrong Store' }, phone: { phone: '+1 111' } },
      next: { name: { name: 'Right Store' }, address: { address: 'Google address' } }
    })

    expect(result.changes).toEqual({ name: 'Right Store', phone: '' })
    expect(result.applied).toEqual({ name: { name: 'Right Store' } })
    expect(result.suggestions).toEqual({ address: { address: 'Google address' } })
  })

  it('treats values equal to the form defaults as replaceable', () => {
    const defaultSchedule = [{ enabled: true }]
    const result = mergePrefill({
      current: { schedule: defaultSchedule, timezone: 'America/New_York' },
      defaults: { schedule: defaultSchedule, timezone: 'America/New_York' },
      next: { schedule: { schedule: [{ enabled: false }] }, address: { timezone: 'America/Chicago' } }
    })

    expect(result.changes).toEqual({ schedule: [{ enabled: false }], timezone: 'America/Chicago' })
  })

  it('does not blank out a field when Google lacks one value of a group', () => {
    const result = mergePrefill({
      current: { address: '', timezone: 'America/New_York' },
      defaults: { timezone: 'America/New_York' },
      next: { address: { address: 'Google', timezone: null } }
    })

    expect(result.changes).toEqual({ address: 'Google' })
    expect(result.applied).toEqual({ address: { address: 'Google' } })
  })

  it('removes a non-text value from a previous business instead of storing null, or restores its default', () => {
    const schedule = [{ enabled: true }]
    const withoutDefault = mergePrefill({
      current: { schedule },
      applied: { schedule: { schedule } },
      next: { schedule: { schedule: null } }
    })
    const withDefault = mergePrefill({
      current: { schedule },
      applied: { schedule: { schedule } },
      defaults: { schedule: [{ enabled: false }] },
      next: { schedule: { schedule: null } }
    })

    expect(withoutDefault.changes).toEqual({ schedule: undefined })
    expect(JSON.parse(JSON.stringify({ form: { ...withoutDefault.changes } })).form).toEqual({})
    expect(withDefault.changes).toEqual({ schedule: [{ enabled: false }] })
  })

  it('only suggests the values Google actually has', () => {
    const result = mergePrefill({
      current: { address: 'Typed', timezone: 'Africa/Johannesburg' },
      next: { address: { address: 'Google', location: { lat: 1, lng: 2 }, timezone: null } }
    })

    expect(result.suggestions).toEqual({ address: { address: 'Google', location: { lat: 1, lng: 2 } } })
  })

  it('suggests a whole group when any of its fields was edited by the user', () => {
    const result = mergePrefill({
      current: { address: 'Typed', location: null },
      next: { address: { address: 'Google', location: { lat: 1, lng: 2 } } }
    })

    expect(result.changes).toEqual({})
    expect(result.suggestions).toEqual({ address: { address: 'Google', location: { lat: 1, lng: 2 } } })
  })
})
