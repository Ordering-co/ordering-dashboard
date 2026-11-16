import React from 'react'
import { Link, useHistory } from 'react-router-dom'
import { useConfig, useLanguage, useSession } from '../../../../../index'
import { getPaymentGatewayKeyStatus, getPaymentGatewaySettingsPath } from '../../../../../utils/settingsExternalEditors'
import { useSectionSplit } from '../../Shared/Product/SectionSplit'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'

// redesign stores 5.9: PaymentOptionGlobal on ProviderPanel — Stripe, Computop and the global Google / Apple Pay, whose keys live in Settings: General (level 0 only) shows whether the keys are set and links to Settings; then channels and order types.
export const PaymentOptionGlobal = ({
  paymethod,
  businessPaymethod,
  gatewayName,
  storeName,
  sites,
  devices,
  orderTypes,
  initialTab,
  onTabChange,
  onSave
}) => {
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()
  const gateway = paymethod?.gateway
  const gatewayStatus = getPaymentGatewayKeyStatus({ gateway, configs })
  const settingsPath = getPaymentGatewaySettingsPath(gateway)
  const history = useHistory()
  const { requestLeave } = useSectionSplit()
  // review F3 #3: leaving for Settings goes through the detail's guards (unsaved changes ask first); a modified click still opens a tab
  const goToSettings = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    requestLeave(() => history.push(settingsPath))
  }
  const tabs = [
    ...(user?.level === 0 ? [{ id: 'general', index: 0 }] : []),
    { id: 'channels', index: 1 },
    { id: 'order_types', index: 2 }
  ]

  const generalBefore = (
    <div className='odc-pp-mode'>
      <p className='odc-pp-hint'>
        {gatewayStatus.configured
          ? t('SETTINGS_PAYMENT_KEYS_CONFIGURED', 'API keys configured')
          : t('SETTINGS_PAYMENT_KEYS_MISSING', 'API keys missing')}
      </p>
      <Link className='odc-btn' data-variant='link' data-size='md' to={settingsPath} onClick={goToSettings}>
        {t('SETTINGS_PAYMENT_KEYS_LINK', 'Edit in Settings')}
      </Link>
    </div>
  )

  return (
    <ProviderPanel
      paymethod={paymethod}
      businessPaymethod={businessPaymethod}
      gatewayName={gatewayName}
      storeName={storeName}
      tabs={tabs}
      initialTab={initialTab}
      onTabChange={onTabChange}
      sites={sites}
      devices={devices}
      orderTypes={orderTypes}
      generalBefore={generalBefore}
      onSave={onSave}
    />
  )
}
