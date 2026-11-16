import { describe, expect, it } from 'vitest'
import { formatPhoneNumber } from 'react-phone-number-input'

import {
  USER_FORM_EMAIL_PATTERN,
  cellphoneStartZero,
  changedFieldNames,
  checkoutFields,
  fieldLabel,
  phoneToChanges,
  requiredMessage,
  sanitizeEmail,
  userPhoneText,
  validateUserForm
} from '../userForm'

// redesign UF-B1a (decision 1): the helpers the four user forms share. Each one reproduces what
// `UI/Users/UserFormDetails`, `UI/Users/UserAddForm` and their `UI/Delivery` copies do today.
const t = (_key, fallback) => fallback
const keysOf = (calls) => calls.map(([key]) => key)

const CHECKOUT = {
  email: { id: 5, code: 'email', name: 'Email', type: 'email' },
  lastname: { id: 3, code: 'lastname', name: 'Last name', type: 'text' },
  name: { id: 1, code: 'name', name: 'Name', type: 'text' },
  cellphone: { id: 9, code: 'cellphone', name: 'Mobile phone', type: 'tel' },
  second_lastname: { id: 4, code: 'second_lastname', name: 'Second last name', type: 'text' },
  middle_name: { id: 2, code: 'middle_name', name: 'Middle name', type: 'text' }
}

describe('USER_FORM_EMAIL_PATTERN', () => {
  it.each(['ana@example.com', 'ANA.LOPEZ+tag@Example.CO', 'a_b%c@sub.example.org'])('accepts %s', (email) => {
    expect(USER_FORM_EMAIL_PATTERN.test(email)).toBe(true)
  })

  it.each(['', 'ana', 'ana@', 'ana@example', 'ana@example.c', 'ana @example.com', 'ana@exa mple.com'])('rejects %j', (email) => {
    expect(USER_FORM_EMAIL_PATTERN.test(email)).toBe(false)
  })
})

describe('sanitizeEmail', () => {
  it('lowers the case', () => {
    expect(sanitizeEmail('Ana.Lopez@Example.COM')).toBe('ana.lopez@example.com')
  })

  it('strips & , ( ) % " ; : ç ? < > { } \\ [ ] and whitespace', () => {
    expect(sanitizeEmail('a&b,c(d)e%f"g;h:iç?j<k>l{m}n\\o[p]q r\ts@x.co')).toBe('abcdefghijklmnopqrs@x.co')
  })

  it('keeps the characters the pattern allows', () => {
    expect(sanitizeEmail('a.b_c+d-e@x-y.co')).toBe('a.b_c+d-e@x-y.co')
  })

  it.each([undefined, null])('turns %s into an empty string', (value) => {
    expect(sanitizeEmail(value)).toBe('')
  })
})

describe('checkoutFields', () => {
  const validationFields = { loading: false, fields: { checkout: CHECKOUT } }

  it('sorts name, middle_name, lastname, second_lastname, email and drops what is not in that list', () => {
    expect(checkoutFields(validationFields).map(field => field.code)).toEqual(['name', 'middle_name', 'lastname', 'second_lastname', 'email'])
  })

  it('returns the field objects untouched', () => {
    expect(checkoutFields(validationFields)[0]).toBe(CHECKOUT.name)
  })

  it('filters by showField when it is given', () => {
    const showField = (code) => code !== 'middle_name' && code !== 'second_lastname'
    expect(checkoutFields(validationFields, showField).map(field => field.code)).toEqual(['name', 'lastname', 'email'])
  })

  it('does not filter when showField is not a function', () => {
    expect(checkoutFields(validationFields, undefined)).toHaveLength(5)
  })

  it.each([
    ['an empty fields object', { loading: false, fields: {} }],
    ['an empty object', {}],
    ['null', null],
    ['undefined', undefined],
    ['a null checkout map', { fields: { checkout: null } }]
  ])('returns an empty list for %s without throwing', (_label, input) => {
    expect(checkoutFields(input)).toEqual([])
    expect(checkoutFields(input, () => true)).toEqual([])
  })
})

describe('fieldLabel', () => {
  it('asks for the upper-case code and falls back to the field name', () => {
    const calls = []
    const label = fieldLabel((key, fallback) => { calls.push([key, fallback]); return fallback }, CHECKOUT.email)
    expect(label).toBe('Email')
    expect(calls).toEqual([['EMAIL', 'Email']])
  })

  // redesign tanda AB (U-1): the live dictionary says «Lastname» for LASTNAME; the last-name fields read
  // LAST_NAME («Last name») and SECOND_LAST_NAME («Second last name») instead.
  it.each([
    ['lastname', 'LAST_NAME', 'Last name'],
    ['second_lastname', 'SECOND_LAST_NAME', 'Second last name']
  ])('reads %s from %s', (code, key, english) => {
    const calls = []
    const label = fieldLabel((k, fallback) => { calls.push(k); return fallback }, { code, name: 'Lastname' })
    expect(calls).toEqual([key])
    expect(label).toBe(english)
  })

  it('returns the translation when there is one', () => {
    expect(fieldLabel((key) => `x:${key}`, CHECKOUT.name)).toBe('x:NAME')
  })
})

describe('requiredMessage', () => {
  it('email: the Email required message with the attribute replaced', () => {
    const calls = []
    const message = requiredMessage((key, fallback) => { calls.push(key); return key === 'VALIDATION_ERROR_EMAIL_REQUIRED' ? 'The field _attribute_ is required' : (key === 'EMAIL' ? 'Correo' : fallback) }, CHECKOUT.email)
    expect(message).toBe('The field Correo is required')
    expect(calls).toEqual(['VALIDATION_ERROR_EMAIL_REQUIRED', 'EMAIL'])
  })

  it('email: default text', () => {
    expect(requiredMessage(t, CHECKOUT.email)).toBe('The field Email is required')
  })

  it('others: VALIDATION_ERROR_<CODE>_REQUIRED, default "<name> is required"', () => {
    const calls = []
    const message = requiredMessage((key, fallback) => { calls.push([key, fallback]); return fallback }, CHECKOUT.second_lastname)
    expect(message).toBe('Second last name is required')
    expect(calls[0]).toEqual(['VALIDATION_ERROR_SECOND_LASTNAME_REQUIRED', 'Second last name is required'])
  })

  it('others: replaces _attribute_ with t(field.name, field.code), the same expression as today', () => {
    const message = requiredMessage((key, fallback) => (key === 'VALIDATION_ERROR_NAME_REQUIRED' ? 'The _attribute_ is needed' : (key === 'Name' ? 'Nombre' : fallback)), CHECKOUT.name)
    expect(message).toBe('The Nombre is needed')
  })
})

describe('validateUserForm', () => {
  const fields = checkoutFields({ fields: { checkout: CHECKOUT } })
  const none = () => false
  const all = () => true
  const base = { t, fields, values: {}, isRequiredField: none }

  it('is an empty object when nothing is required and nothing is wrong', () => {
    expect(validateUserForm(base)).toEqual({})
  })

  it('every required empty field gets its required message, keyed by field code', () => {
    const errors = validateUserForm({ ...base, isRequiredField: all, values: { lastname: 'Lopez' } })
    expect(Object.keys(errors)).toEqual(['name', 'middle_name', 'second_lastname', 'email'])
    expect(errors.name).toBe('Name is required')
    expect(errors.email).toBe('The field Email is required')
  })

  it('treats undefined, null and an empty string as empty; any text is a value', () => {
    const errors = validateUserForm({ ...base, isRequiredField: (code) => code !== 'email', values: { name: '', middle_name: null, lastname: undefined, second_lastname: ' ' } })
    expect(Object.keys(errors)).toEqual(['name', 'middle_name', 'lastname'])
  })

  it('a field that is not required is never reported empty', () => {
    expect(validateUserForm({ ...base, values: { name: '' } })).toEqual({})
  })

  it('only the fields passed are checked', () => {
    const errors = validateUserForm({ ...base, fields: [CHECKOUT.name], isRequiredField: all })
    expect(Object.keys(errors)).toEqual(['name'])
  })

  describe('email', () => {
    it('required by isRequiredField when empty', () => {
      const errors = validateUserForm({ ...base, isRequiredField: (code) => code === 'email' })
      expect(errors).toEqual({ email: 'The field Email is required' })
    })

    it('emailRequired overrides isRequiredField, both ways', () => {
      expect(validateUserForm({ ...base, isRequiredField: all, values: { name: 'a', middle_name: 'a', lastname: 'a', second_lastname: 'a' }, emailRequired: false })).toEqual({})
      expect(validateUserForm({ ...base, emailRequired: true })).toEqual({ email: 'The field Email is required' })
    })

    it('a value that does not match the pattern is invalid, with the attribute replaced', () => {
      const errors = validateUserForm({
        ...base,
        values: { email: 'not-an-email' },
        t: (key, fallback) => (key === 'INVALID_ERROR_EMAIL' ? 'The _attribute_ is wrong' : (key === 'EMAIL' ? 'Correo' : fallback))
      })
      expect(errors).toEqual({ email: 'The Correo is wrong' })
    })

    it('default invalid text', () => {
      expect(validateUserForm({ ...base, values: { email: 'ana@' } })).toEqual({ email: 'Invalid email address' })
    })

    it('a valid email, and an empty one that is not required, give no error', () => {
      expect(validateUserForm({ ...base, values: { email: 'Ana@Example.com' } })).toEqual({})
      expect(validateUserForm({ ...base, values: { email: '' } })).toEqual({})
    })

    it('an empty required email is reported as required, not as invalid', () => {
      const errors = validateUserForm({ ...base, emailRequired: true, values: { email: '' } })
      expect(errors.email).toBe('The field Email is required')
    })
  })

  describe('password', () => {
    it('is skipped when show is false', () => {
      expect(validateUserForm({ ...base, password: { value: '', show: false, required: true } })).toEqual({})
      expect(validateUserForm({ ...base, password: { value: 'abc', show: false, required: false } })).toEqual({})
    })

    it('is skipped when it is not passed', () => {
      expect(validateUserForm({ ...base, password: undefined })).toEqual({})
    })

    it('required and empty', () => {
      expect(validateUserForm({ ...base, password: { value: '', show: true, required: true } })).toEqual({ password: 'The field Password is required' })
      expect(validateUserForm({ ...base, password: { value: undefined, show: true, required: true } })).toEqual({ password: 'The field Password is required' })
    })

    it('uses the translated attribute', () => {
      const errors = validateUserForm({
        ...base,
        password: { value: '', show: true, required: true },
        t: (key, fallback) => (key === 'VALIDATION_ERROR_PASSWORD_REQUIRED' ? 'The _attribute_ is mandatory' : (key === 'PASSWORD' ? 'Clave' : fallback))
      })
      expect(errors.password).toBe('The Clave is mandatory')
    })

    it('not required and empty is fine', () => {
      expect(validateUserForm({ ...base, password: { value: '', show: true, required: false } })).toEqual({})
    })

    it('shorter than 8 gets the minimum message, with _attribute_ and _min_ replaced', () => {
      const errors = validateUserForm({ ...base, password: { value: '1234567', show: true, required: false } })
      expect(errors).toEqual({ password: 'The Password must be at least 8 characters.' })
      const custom = validateUserForm({
        ...base,
        password: { value: 'abc', show: true, required: true },
        t: (key, fallback) => (key === 'VALIDATION_ERROR_PASSWORD_MIN_STRING' ? '_attribute_ needs _min_ characters' : fallback)
      })
      expect(custom.password).toBe('Password needs 8 characters')
    })

    it('8 characters is enough', () => {
      expect(validateUserForm({ ...base, password: { value: '12345678', show: true, required: true } })).toEqual({})
    })
  })

  describe('cellphone', () => {
    const phone = { number: '', isValid: null, enabled: true, required: true, hasCountryCode: false }

    it('enabled, required and empty', () => {
      expect(validateUserForm({ ...base, phone })).toEqual({ cellphone: 'The field Phone Number is required.' })
    })

    it('empty but not required, or required but not enabled, is fine', () => {
      expect(validateUserForm({ ...base, phone: { ...phone, required: false } })).toEqual({})
      expect(validateUserForm({ ...base, phone: { ...phone, enabled: false } })).toEqual({})
    })

    it('a number that is not valid, with a country code', () => {
      expect(validateUserForm({ ...base, phone: { ...phone, number: '+39 06', isValid: false, hasCountryCode: true } })).toEqual({ cellphone: 'The Phone Number field is invalid' })
    })

    it('a number that is not valid, without a country code', () => {
      expect(validateUserForm({ ...base, phone: { ...phone, number: '0612345678', isValid: false, hasCountryCode: false } })).toEqual({ cellphone: 'The country code of the phone number is invalid' })
    })

    it('a valid number has no error', () => {
      expect(validateUserForm({ ...base, phone: { ...phone, number: '+390612345678', isValid: true, hasCountryCode: true } })).toEqual({})
    })

    it('is skipped when it is not passed', () => {
      expect(validateUserForm({ ...base, phone: undefined })).toEqual({})
    })
  })

  it('collects every kind of error at once, in field, email, password, phone order', () => {
    const errors = validateUserForm({
      ...base,
      isRequiredField: (code) => code === 'name',
      values: { email: 'bad' },
      password: { value: 'abc', show: true, required: true },
      phone: { number: '12', isValid: false, enabled: true, required: false, hasCountryCode: true }
    })
    expect(Object.keys(errors)).toEqual(['name', 'email', 'password', 'cellphone'])
  })

  it('never throws with no fields', () => {
    expect(validateUserForm({ t, fields: [], values: undefined, isRequiredField: none })).toEqual({})
    expect(validateUserForm({ t, fields: undefined, values: {}, isRequiredField: none })).toEqual({})
  })

  it('asks the translator only for the keys of the rules that fired', () => {
    const calls = []
    validateUserForm({
      ...base,
      t: (key, fallback) => { calls.push([key]); return fallback },
      isRequiredField: (code) => code === 'name'
    })
    expect(keysOf(calls)).toEqual(['VALIDATION_ERROR_NAME_REQUIRED', 'Name'])
  })
})

describe('phoneToChanges', () => {
  const blank = {
    country_phone_code: { name: 'country_phone_code', value: '' },
    cellphone: { name: 'cellphone', value: '' }
  }

  it('invalid gives both empty, in the {name, value} shape handleChangeInput(…, true) takes', () => {
    expect(phoneToChanges('+39 06', false)).toEqual(blank)
    expect(phoneToChanges('', false, { validationPhoneNumberLib: 1 })).toEqual(blank)
  })

  it('valid gives the calling code and the national number', () => {
    expect(phoneToChanges('+14155552671', true)).toEqual({
      country_phone_code: { name: 'country_phone_code', value: '1' },
      cellphone: { name: 'cellphone', value: '4155552671' }
    })
  })

  it('a leading zero of the national number stays out of the parsed number (+39 0612345678)', () => {
    const changes = phoneToChanges('+390612345678', true)
    expect(changes.country_phone_code.value).toBe('39')
    expect(changes.cellphone.value).toBe('0612345678')
  })

  it('validation_phone_number_lib 1 (or missing) keeps the parsed national number', () => {
    const expected = phoneToChanges('+390612345678', true)
    expect(phoneToChanges('+390612345678', true, { validationPhoneNumberLib: 1 })).toEqual(expected)
    expect(phoneToChanges('+390612345678', true, { validationPhoneNumberLib: undefined })).toEqual(expected)
    expect(phoneToChanges('+390612345678', true, {})).toEqual(expected)
  })

  it.each([0, '0'])('validation_phone_number_lib %j keeps formatPhoneNumber(number) without spaces', (lib) => {
    const changes = phoneToChanges('+390612345678', true, { validationPhoneNumberLib: lib })
    expect(changes.country_phone_code.value).toBe('39')
    expect(changes.cellphone.value).toBe(formatPhoneNumber('+390612345678').replace(/\s/g, ''))
    expect(changes.cellphone.value).not.toMatch(/\s/)
  })

  it('an invalid number is blank even with validation_phone_number_lib 0', () => {
    expect(phoneToChanges('+39 06', false, { validationPhoneNumberLib: 0 })).toEqual(blank)
  })
})

describe('cellphoneStartZero', () => {
  it('is the raw number when it has a number and a calling code', () => {
    expect(cellphoneStartZero({ number: '0612345678', countryCallingCode: '39' })).toBe('0612345678')
  })

  it.each([
    [{ number: '0612345678' }],
    [{ countryCallingCode: '39' }],
    [{ number: '', countryCallingCode: '39' }],
    [{}],
    [null],
    [undefined]
  ])('is null for %j', (raw) => {
    expect(cellphoneStartZero(raw)).toBeNull()
  })
})

describe('userPhoneText', () => {
  const idle = { result: { error: false }, changes: {} }

  it('is "+code number" when the user has both', () => {
    expect(userPhoneText({ cellphone: '0612345678', country_phone_code: '39' }, idle)).toBe('+39 0612345678')
  })

  it('is the bare number when the user has no country code', () => {
    expect(userPhoneText({ cellphone: '0612345678' }, idle)).toBe('0612345678')
  })

  it('is an empty string when the user has no phone', () => {
    expect(userPhoneText({ cellphone: '' }, idle)).toBe('')
    expect(userPhoneText({ country_phone_code: '39' }, idle)).toBe('')
    expect(userPhoneText({}, idle)).toBe('')
    expect(userPhoneText(null, idle)).toBe('')
    expect(userPhoneText(undefined, idle)).toBe('')
  })

  it('after a failed save it keeps what was typed, when both parts were typed', () => {
    const failed = { result: { error: true }, changes: { cellphone: '3331112222', country_phone_code: '39' } }
    expect(userPhoneText({ cellphone: '0612345678', country_phone_code: '39' }, failed)).toBe('+39 3331112222')
  })

  it('after a failed save with only part of the phone typed it falls back to the user', () => {
    const half = { result: { error: true }, changes: { cellphone: '3331112222' } }
    expect(userPhoneText({ cellphone: '0612345678', country_phone_code: '39' }, half)).toBe('+39 0612345678')
  })

  it('typed changes are ignored when the last save did not fail', () => {
    const typed = { result: { error: false }, changes: { cellphone: '3331112222', country_phone_code: '39' } }
    expect(userPhoneText({ cellphone: '0612345678', country_phone_code: '39' }, typed)).toBe('+39 0612345678')
  })

  it('a failed save does not invent a phone for a user that has none', () => {
    const failed = { result: { error: true }, changes: { cellphone: '3331112222', country_phone_code: '39' } }
    expect(userPhoneText({}, failed)).toBe('')
  })

  it('a missing form state does not throw', () => {
    expect(userPhoneText({ cellphone: '0612345678', country_phone_code: '39' }, undefined)).toBe('+39 0612345678')
  })
})

describe('changedFieldNames', () => {
  const labelOf = (key) => `L:${key}`

  it('is the labels of the changed keys, in the order they changed', () => {
    expect(changedFieldNames({ lastname: 'A', name: 'B', email: 'c@d.co' }, labelOf)).toEqual(['L:lastname', 'L:name', 'L:email'])
  })

  it('counts country_phone_code and cellphone once, as the phone', () => {
    expect(changedFieldNames({ name: 'A', country_phone_code: '39', cellphone: '06' }, labelOf)).toEqual(['L:name', 'L:cellphone'])
    expect(changedFieldNames({ cellphone: '06', country_phone_code: '39' }, labelOf)).toEqual(['L:cellphone'])
    expect(changedFieldNames({ country_phone_code: '' }, labelOf)).toEqual(['L:cellphone'])
  })

  it('has no duplicates when two keys share a label', () => {
    expect(changedFieldNames({ a: 1, b: 2 }, () => 'Same')).toEqual(['Same'])
  })

  it('falls back to the key when there is no label', () => {
    expect(changedFieldNames({ timezone: 'UTC' }, () => undefined)).toEqual(['timezone'])
    expect(changedFieldNames({ timezone: 'UTC' })).toEqual(['timezone'])
  })

  it.each([[{}], [null], [undefined]])('is empty for %j', (changes) => {
    expect(changedFieldNames(changes, labelOf)).toEqual([])
  })
})
