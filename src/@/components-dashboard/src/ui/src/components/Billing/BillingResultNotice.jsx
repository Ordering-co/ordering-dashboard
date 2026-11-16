import { useEffect } from 'react'

import { ToastType, useLanguage, useSession, useToast } from '../../../../index'
import { takeBillingResult } from './BillingPaymentOptions/billingModel'

// redesign BM-C (M-BM5): the dialog reloads the page when a payment goes through and leaves a one-shot mark (`rememberBillingResult`).
// This is where it is read, once, after the reload: a toast that says what happened. It paints nothing.
// (owner decision 4 of the parity audit, 2026-10-27): main counted the Rewardful conversion when the dialog opened, so paying
// with a saved card counted too; since n.º 5 it only counted on «Add card». A payment that went through counts it here, after
// the reload, so the request is not cut by it. The Rewardful script is the page's (this repo does not load it); without it nothing happens.
export const BillingResultNotice = () => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ user } = {}] = useSession() || []

  useEffect(() => {
    const result = takeBillingResult()
    if (result === 'paid') showToast(ToastType.Success, t('BILLING_PAYMENT_RECEIVED', 'Payment received.'))
    else if (result === 'upgraded') showToast(ToastType.Success, t('PLAN_UPDATED_SUCCESSFULLY', 'Plan updated Successfully'))
    if ((result === 'paid' || result === 'upgraded') && typeof window.rewardful === 'function') {
      window.rewardful('convert', { email: user?.email })
    }
  }, [])

  return null
}
