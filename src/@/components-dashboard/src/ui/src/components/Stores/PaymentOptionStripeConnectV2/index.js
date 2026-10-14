import React from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { PaymentOption } from '../PaymentOption'
import { StripeConnectAccount } from '../../Shared/StripeConnectAccount'
import { PayoutRuleForm } from '../../Shared/PayoutRuleForm'
import { Payouts } from './Payouts'
import { TabContent } from './styles'

/**
 * Stripe Connect v2: the platform charges the order and, once it is
 * completed, transfers the store its share. The store brings no keys, only the
 * Stripe account it gets paid on; what the platform keeps of its orders can be
 * set for this store alone, by an administrator. Payouts lists what its orders
 * paid out, and which ones are waiting or need a look.
 */
export const PaymentOptionStripeConnectV2 = (props) => {
  const { business } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const extraTabs = [
    {
      key: 'stripe_account',
      title: t('STRIPE_CONNECT_ACCOUNT_TITLE', 'Stripe account'),
      content: (
        <TabContent>
          <StripeConnectAccount ownerType='business' ownerId={business?.id} />
        </TabContent>
      )
    },
    user?.level === 0 && {
      key: 'platform_fee',
      title: t('PAYOUT_RULE_PLATFORM_TITLE', 'Platform fee'),
      content: (
        <TabContent>
          <PayoutRuleForm scope='platform' ownerId={business?.id} />
        </TabContent>
      )
    },
    {
      key: 'payouts',
      title: t('PAYOUTS', 'Payouts'),
      content: (
        <TabContent>
          <Payouts businessId={business?.id} />
        </TabContent>
      )
    }
  ].filter(Boolean)

  return <PaymentOption {...props} extraTabs={extraTabs} />
}
