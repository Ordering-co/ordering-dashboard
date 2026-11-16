/* eslint-disable import/first */
import React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign UF-B1a (M-UF10): showField / isRequiredField of both form controllers (UserFormDetails and AddressForm)
// survive a failed validation-fields request (`fields` is `{}`, ValidationsFieldsContext:35-37).
const mocks = vi.hoisted(() => ({
  validationFields: { loading: false, fields: {} },
  session: { loading: false, token: 'token', user: { id: 1, level: 0 } }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session, { changeUser: vi.fn() }] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../contexts/CustomerContext', () => ({ useCustomer: () => [{}, { setUserCustomer: vi.fn() }] }))
vi.mock('../../../contexts/ValidationsFieldsContext', () => ({ useValidationFields: () => [mocks.validationFields] }))

import { UserFormDetails } from '..'
import { AddressForm } from '../../AddressForm'

const USER = { id: 7, name: 'Ana', level: 3 }

const mountController = (Controller, props) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  // the controller's propTypes read the raw props (before its defaults), so the session manager is stated
  const defaults = Controller === UserFormDetails ? { useDefualtSessionManager: true } : {}
  render(<Controller UIComponent={UIComponent} {...defaults} {...props} />)
  return ui
}

const CONFIGURED = {
  loading: false,
  fields: {
    checkout: {
      email: { code: 'email', enabled: true, required: true },
      name: { code: 'name', enabled: false, required: true },
      lastname: { code: 'lastname', enabled: true, required: false }
    },
    address: {
      address: { code: 'address', enabled: true, required: true },
      zipcode: { code: 'zipcode', enabled: false, required: true },
      address_notes: { code: 'address_notes', enabled: true, required: false }
    }
  }
}

const FAILED_REQUESTS = [
  ['an empty fields object', { loading: false, fields: {} }],
  ['no fields at all', { loading: false }],
  ['empty checkout and address', { loading: false, fields: { checkout: undefined, address: undefined } }]
]

describe('UserFormDetails controller · showField / isRequiredField (UF-B1a, M-UF10)', () => {
  beforeEach(() => {
    mocks.validationFields = CONFIGURED
  })

  describe('with the validation fields loaded (today)', () => {
    it('without useValidationFields every field is shown and none is required', () => {
      const ui = mountController(UserFormDetails, { user: USER })
      expect(ui.current.showField('email')).toBe(true)
      expect(ui.current.showField('name')).toBe(true)
      expect(ui.current.isRequiredField('email')).toBe(false)
    })

    it('with useValidationFields a configured field is shown when enabled', () => {
      const ui = mountController(UserFormDetails, { user: USER, useValidationFields: true })
      expect(ui.current.showField('email')).toBe(true)
      expect(ui.current.showField('name')).toBe(false)
    })

    it('a field that is not configured is shown and not required', () => {
      const ui = mountController(UserFormDetails, { user: USER, useValidationFields: true })
      expect(ui.current.showField('second_lastname')).toBe(true)
      expect(ui.current.isRequiredField('second_lastname')).toBeFalsy()
    })

    it('is required only when enabled and required', () => {
      const ui = mountController(UserFormDetails, { user: USER, useValidationFields: true })
      expect(ui.current.isRequiredField('email')).toBe(true)
      expect(ui.current.isRequiredField('name')).toBeFalsy()
      expect(ui.current.isRequiredField('lastname')).toBeFalsy()
    })

    it('while the fields load nothing is shown and nothing is required', () => {
      mocks.validationFields = { ...CONFIGURED, loading: true }
      const ui = mountController(UserFormDetails, { user: USER, useValidationFields: true })
      expect(ui.current.showField('email')).toBe(false)
      expect(ui.current.isRequiredField('email')).toBeFalsy()
    })
  })

  describe.each(FAILED_REQUESTS)('when the request failed: %s', (_label, failed) => {
    beforeEach(() => {
      mocks.validationFields = failed
    })

    it('mounts and treats every field as not configured (shown, not required)', () => {
      const ui = mountController(UserFormDetails, { user: USER, useValidationFields: true })
      expect(ui.current.showField('email')).toBe(true)
      expect(ui.current.isRequiredField('email')).toBe(false)
    })

    it('keeps the answers when useValidationFields is off', () => {
      const ui = mountController(UserFormDetails, { user: USER })
      expect(ui.current.showField('email')).toBe(true)
      expect(ui.current.isRequiredField('email')).toBe(false)
    })
  })
})

describe('AddressForm controller · showField / isRequiredField (UF-B1a, M-UF10)', () => {
  beforeEach(() => {
    mocks.validationFields = CONFIGURED
  })

  describe('with the validation fields loaded (today)', () => {
    it('without useValidationFileds every field is shown and none is required', () => {
      const ui = mountController(AddressForm, { address: {} })
      expect(ui.current.showField('address')).toBe(true)
      expect(ui.current.showField('zipcode')).toBe(true)
      expect(ui.current.isRequiredField('address')).toBe(false)
    })

    it('a configured field is shown when enabled', () => {
      const ui = mountController(AddressForm, { address: {}, useValidationFileds: true })
      expect(ui.current.showField('address')).toBe(true)
      expect(ui.current.showField('zipcode')).toBe(false)
    })

    it('a field that is not configured is shown and not required', () => {
      const ui = mountController(AddressForm, { address: {}, useValidationFileds: true })
      expect(ui.current.showField('internal_number')).toBe(true)
      expect(ui.current.isRequiredField('internal_number')).toBeFalsy()
    })

    it('is required only when enabled and required', () => {
      const ui = mountController(AddressForm, { address: {}, useValidationFileds: true })
      expect(ui.current.isRequiredField('address')).toBe(true)
      expect(ui.current.isRequiredField('zipcode')).toBeFalsy()
      expect(ui.current.isRequiredField('address_notes')).toBeFalsy()
    })

    it('while the fields load nothing is shown and nothing is required', () => {
      mocks.validationFields = { ...CONFIGURED, loading: true }
      const ui = mountController(AddressForm, { address: {}, useValidationFileds: true })
      expect(ui.current.showField('address')).toBe(false)
      expect(ui.current.isRequiredField('address')).toBeFalsy()
    })
  })

  describe.each(FAILED_REQUESTS)('when the request failed: %s', (_label, failed) => {
    beforeEach(() => {
      mocks.validationFields = failed
    })

    it('mounts and treats every field as not configured (shown, not required)', () => {
      const ui = mountController(AddressForm, { address: {}, useValidationFileds: true })
      expect(ui.current.showField('address')).toBe(true)
      expect(ui.current.isRequiredField('address')).toBe(false)
    })

    it('keeps the answers when useValidationFileds is off', () => {
      const ui = mountController(AddressForm, { address: {} })
      expect(ui.current.showField('address')).toBe(true)
      expect(ui.current.isRequiredField('address')).toBe(false)
    })
  })
})
