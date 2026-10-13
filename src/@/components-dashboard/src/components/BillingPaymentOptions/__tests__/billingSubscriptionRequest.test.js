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
