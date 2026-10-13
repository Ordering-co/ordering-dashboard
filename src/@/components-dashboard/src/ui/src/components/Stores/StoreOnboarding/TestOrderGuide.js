import React from 'react'
import { useStoreOnboardingLanguage } from '../../../../../utils/useStoreOnboardingLanguage'
import { Card, Fields } from './styles'

export const TestOrderGuide = ({ testOrder }) => {
  const [, t] = useStoreOnboardingLanguage()
  if (!testOrder?.enabled) return null
  return <Card style={{ textAlign: 'start', marginTop: 24 }}>
    <Fields>
      {testOrder?.enabled && <>
        <h2>{t('STORE_ONBOARDING_TEST_TITLE', 'Now try your first order')}</h2>
        <ol>
          <li>{t('STORE_ONBOARDING_TEST_OPEN', 'Open your restaurant and add a product to the cart.')}</li>
          <li>{t('STORE_ONBOARDING_TEST_CHECKOUT', 'Choose delivery, enter an address inside your delivery area and pay with cash.')}</li>
          <li>{t('STORE_ONBOARDING_TEST_OPEN_ORDERS', 'Place the order, then open Orders manager to see it.')}</li>
        </ol>
        <p>{t('STORE_ONBOARDING_TEST_CLOSED', 'If your restaurant is closed, choose the next available delivery time.')}</p>
        <p>{t('STORE_ONBOARDING_TEST_REAL', 'This creates a real order. Cancel it in Orders when your test is complete.')}</p>
      </>}
    </Fields>
  </Card>
}
