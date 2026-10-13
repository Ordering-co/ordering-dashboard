import React, { useEffect, useState } from 'react'
import { useLanguage, useUtils, PurchaseAddonDetails as PurchaseAddonDetailsController, useToast, ToastType } from '../../../../../index'
import { PaymentOptionStripe } from '../../Billing/BillingPaymentOptions/Stripe'
import { removeQueryToUrl } from '../../../utils'

import { Button } from '../../../styles'

import {
  Container,
  CategoryContainer,
  List
} from './styles'

export const PurchaseAddonDetailsUI = (props) => {
  const {
    selectedAddon,
    addonPurchaseState,
    handlePurchaseAddon
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const [, { showToast }] = useToast()
  const [isShowCardSelection, setShowCardSelection] = useState(false)

  const validStatus = ['active', 'trialing']

  useEffect(() => {
    if (addonPurchaseState?.loading) return
    if (addonPurchaseState?.error && addonPurchaseState?.error?.includes('Default paymethod is required')) {
      showToast(ToastType.Error, addonPurchaseState?.error)
      setShowCardSelection(true)
      return
    }
    if (addonPurchaseState?.error) {
      showToast(ToastType.Error, addonPurchaseState?.error)
    }
    const isActive = addonPurchaseState?.result?.subscriptions && addonPurchaseState?.result?.subscriptions?.filter(s => s.plan)?.every(sub => validStatus.includes(sub.status))
    if (!addonPurchaseState?.error && addonPurchaseState?.result && isActive) {
      removeQueryToUrl(['id'])
      window.location.reload()
      showToast(ToastType.Success, t('ADDON_PURCHASED_SUCCESSFULLY', 'Addon Purchased Successfully'))
    } else if (!addonPurchaseState?.error && Object.keys(addonPurchaseState?.result) > 0 && !isActive) {
      showToast(ToastType.Info, t('ADDON_PURCHASED_INFO', 'Not all current subscriptions are active'))
    }
  }, [addonPurchaseState])

  return (
    <>
      <Container>
        {isShowCardSelection && (
          <List>
            <PaymentOptionStripe />
          </List>
        )}
        <CategoryContainer>
          <h1>{selectedAddon?.name ?? t('ADDON', 'Addon')}</h1>
          <div className='text-container'>
            {selectedAddon?.description
              ? <span style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: selectedAddon?.description }} />
              : t('ADDON', 'Addon')
            }
          </div>
          <p>{parsePrice((selectedAddon?.prices?.monthly?.amount ?? 0).toFixed(2), { separator: '.', currency: '$' }) + `${selectedAddon?.prices?.monthly?.type === 'recurring' ? t('Monthly', '/m') : ''}`}</p>
          <Button
            borderRadius='8px'
            color='primary'
            onClick={() => handlePurchaseAddon()}
            disabled={addonPurchaseState?.loading || addonPurchaseState?.isWaitReload}
          >
            {addonPurchaseState?.loading ? t('PURCHASING', 'Purchasing') : t('BUY_ADDON', 'Buy Addon')}
          </Button>
        </CategoryContainer>
      </Container>
    </>
  )
}

export const PurchaseAddonDetails = (props) => {
  const purchaseAddonsProps = {
    ...props,
    UIComponent: PurchaseAddonDetailsUI
  }

  return (
    <PurchaseAddonDetailsController {...purchaseAddonsProps} />
  )
}
