import { describe, expect, it } from 'vitest'
import { buildBillingSubscriptionRequest } from '../billingSubscriptionRequest'

describe('buildBillingSubscriptionRequest', () => {
  it('includes the selected card on a new subscription plans POST', () => {
    expect(buildBillingSubscriptionRequest({
      planId: 2,
      period: 'monthly',
      replace: true,
      userPaymethodId: 789
    })).toEqual({
      urlPath: '/billing/subscriptions/plans',
      body: {
        plan_id: 2,
        period: 'monthly',
        replace: true,
        user_paymethod_id: 789
      }
    })
  })

  it('omits user_paymethod_id on a plans POST when no card is selected', () => {
    expect(buildBillingSubscriptionRequest({
      planId: 2,
      period: 'annual',
      replace: false
    })).toEqual({
      urlPath: '/billing/subscriptions/plans',
      body: {
        plan_id: 2,
        period: 'annual',
        replace: true
      }
    })
  })

  // (billing-api#103): «Pay the pending payment» on an active subscription whose plan change by modify waits.
  it('pays the pending charge of an active subscription through its retry route only when asked to', () => {
    const subscription = { id: 501, status: 'active', data: { plan_change: { status: 'pending', kind: 'modify' } } }
    expect(buildBillingSubscriptionRequest({ subscription, planId: 5, period: 'monthly', userPaymethodId: 789, payPending: true }))
      .toEqual({ urlPath: '/billing/subscriptions/501', body: { user_paymethod_id: 789 } })
    expect(buildBillingSubscriptionRequest({ subscription, planId: 12, period: 'annual', replace: true, userPaymethodId: 789 }).urlPath)
      .toBe('/billing/subscriptions/plans')
  })

  it('still sends the selected card when retrying an incomplete subscription', () => {
    expect(buildBillingSubscriptionRequest({
      subscription: { id: 55, status: 'past_due' },
      planId: 2,
      userPaymethodId: 789
    })).toEqual({
      urlPath: '/billing/subscriptions/55',
      body: {
        user_paymethod_id: 789
      }
    })
  })
})
