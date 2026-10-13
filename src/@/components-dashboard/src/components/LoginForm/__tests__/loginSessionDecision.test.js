import { describe, expect, it } from 'vitest'
import { getDashboardLoginSessionDecision } from '../loginSessionDecision'

const dashboardLevels = [0, 2, 5, 8]

const customerUser = {
  id: 91,
  level: 1,
  session: { access_token: 'tok_customer' }
}

const adminUser = {
  id: 2,
  level: 0,
  session: { access_token: 'tok_admin' }
}

describe('getDashboardLoginSessionDecision', () => {
  it('rejects a marketplace customer so Twilio login cannot persist a dashboard session', () => {
    expect(getDashboardLoginSessionDecision({
      user: customerUser,
      allowedLevels: dashboardLevels
    })).toEqual({
      persistSession: false,
      logoutToken: 'tok_customer',
      error: 'YOU_DO_NOT_HAVE_PERMISSION'
    })
  })

  it('allows an admin level that password login already accepts', () => {
    expect(getDashboardLoginSessionDecision({
      user: adminUser,
      allowedLevels: dashboardLevels
    })).toEqual({
      persistSession: true,
      user: adminUser,
      token: 'tok_admin'
    })
  })

  it('does not gate when allowedLevels is empty, matching the password path', () => {
    expect(getDashboardLoginSessionDecision({
      user: customerUser,
      allowedLevels: []
    })).toEqual({
      persistSession: true,
      user: customerUser,
      token: 'tok_customer'
    })
  })
})
