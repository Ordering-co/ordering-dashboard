import { describe, expect, it } from 'vitest'
import * as LoginFormModule from '..'

describe('LoginForm default tab', () => {
  it('always has a valid tab before the first render', () => {
    expect(LoginFormModule.getDefaultLoginTab({ useLoginByEmail: true })).toBe('email')
    expect(LoginFormModule.getDefaultLoginTab({ useLoginByCellphone: true })).toBe('cellphone')
    expect(LoginFormModule.getDefaultLoginTab({ useLoginOtpEmail: true })).toBe('otp')
    expect(LoginFormModule.getDefaultLoginTab({})).toBe('email')
  })
})
