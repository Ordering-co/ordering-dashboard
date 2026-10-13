const RETRY_STATUSES = ['incomplete', 'past_due']

export const buildBillingSubscriptionRequest = ({
  subscription,
  planId,
  period,
  replace,
  userPaymethodId
}) => {
  const isExistingRetry = Boolean(
    subscription?.id && RETRY_STATUSES.includes(subscription?.status) && planId
  )

  if (isExistingRetry) {
    return {
      urlPath: `/billing/subscriptions/${subscription.id}`,
      body: {
        user_paymethod_id: userPaymethodId
      }
    }
  }

  return {
    urlPath: '/billing/subscriptions/plans',
    body: {
      plan_id: planId,
      period,
      replace: !!planId || replace,
      ...(userPaymethodId ? { user_paymethod_id: userPaymethodId } : {})
    }
  }
}
