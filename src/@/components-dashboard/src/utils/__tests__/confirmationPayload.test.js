import { describe, expect, it } from 'vitest'
import { confirmationPayload } from '../confirmationPayload'

describe('confirmationPayload', () => {
  it('sends a confirmation token as confirmation_token', () => {
    expect(confirmationPayload('tok')).toEqual({ confirmation_token: 'tok' })
  })

  it('sends nothing without a proof', () => {
    expect(confirmationPayload(undefined)).toEqual({})
    expect(confirmationPayload(null)).toEqual({})
    expect(confirmationPayload('')).toEqual({})
    expect(confirmationPayload({ legacyCode: '123456' })).toEqual({})
  })
})
