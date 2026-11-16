import { describe, expect, it } from 'vitest'
import { validationFieldLabel } from '../validationFieldLabel'

// (U1, tanda AK): the checkout, address and card field lists of Settings name a field by `code.toUpperCase()`. For
// `lastname` that is LASTNAME, which the live catalog writes «Lastname»; LAST_NAME says «Last name» there and in the repo.
// What orderingv1 serves (2026-10-23): SECOND_LAST_NAME has no entry, so the text comes from the default
const LIVE = { LASTNAME: 'Lastname', LAST_NAME: 'Last name', NAME: 'Name' }
const t = (key, fallback) => LIVE[key] ?? fallback

describe('validationFieldLabel', () => {
  it('names the last name field «Last name», not the live «Lastname»', () => {
    expect(validationFieldLabel(t, { code: 'lastname', name: 'Lastname' })).toBe('Last name')
  })

  it('names the second last name field «Second last name», not the API name «Second lastname»', () => {
    expect(validationFieldLabel(t, { code: 'second_lastname', name: 'Second lastname' })).toBe('Second last name')
  })

  it('names any other field by its code, with the API name as the fallback, as before', () => {
    expect(validationFieldLabel(t, { code: 'name', name: 'Name' })).toBe('Name')
    expect(validationFieldLabel(t, { code: 'zipcode', name: 'Zip code' })).toBe('Zip code')
  })

  it('without a code it falls back to the API name and never throws', () => {
    expect(validationFieldLabel(t, { name: 'Notes' })).toBe('Notes')
    expect(validationFieldLabel(t, undefined)).toBe('')
  })
})
