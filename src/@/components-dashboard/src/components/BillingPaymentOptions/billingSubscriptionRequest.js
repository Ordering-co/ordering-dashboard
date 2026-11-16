const RETRY_STATUSES = ['incomplete', 'past_due']

export const buildBillingSubscriptionRequest = ({
  subscription,
  planId,
  period,
  replace,
  userPaymethodId,
  payPending
}) => {
  // «Pay the pending payment» pays that subscription's own pending charge, also an active one whose plan change by
  // modify waits for its invoice (billing-api#103). Only that action asks for it: «Pay» buys what the dialog shows.
  const isExistingRetry = Boolean(subscription?.id && payPending) || Boolean(
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
