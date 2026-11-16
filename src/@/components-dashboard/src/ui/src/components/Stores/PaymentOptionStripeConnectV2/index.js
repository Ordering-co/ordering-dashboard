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
 * It now rides on the redesign's PaymentOption / ProviderPanel: the tabs are `extraTabs` items `{ id, label, content }`.
 */
export const PaymentOptionStripeConnectV2 = (props) => {
  const { business } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const extraTabs = [
    {
      id: 'stripe_account',
      label: t('STRIPE_CONNECT_ACCOUNT_TITLE', 'Stripe account'),
      content: (
        <TabContent>
          <StripeConnectAccount ownerType='business' ownerId={business?.id} />
        </TabContent>
      )
    },
    user?.level === 0 && {
      id: 'platform_fee',
      label: t('PAYOUT_RULE_PLATFORM_TITLE', 'Platform fee'),
      content: (
        <TabContent>
          <PayoutRuleForm scope='platform' ownerId={business?.id} />
        </TabContent>
      )
    },
    {
      id: 'payouts',
      label: t('PAYOUTS', 'Payouts'),
      content: (
        <TabContent>
          <Payouts businessId={business?.id} />
        </TabContent>
      )
    }
  ].filter(Boolean)

  return <PaymentOption {...props} extraTabs={extraTabs} />
}
