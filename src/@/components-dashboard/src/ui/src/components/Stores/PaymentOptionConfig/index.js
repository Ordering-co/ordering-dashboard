import React, { useMemo } from 'react'
import { useApi, useLanguage, useSession } from '../../../../../index'
import { filterPaymethodFieldsByRole, getMercadoPagoSetupUrl, isMercadoPagoConnectGateway, openMercadoPagoSetupPopup } from '../../../utils/mercadoPagoConnect'
import { Link } from '../../Shared/Icon'
import { Button } from '../../Shared/Product'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'
import { isSecretField } from '../BusinessPaymentMethods/paymethodModel'

// redesign stores 5.9: PaymentOptionConfig on ProviderPanel — a templated gateway (`data_template` not null): the fields of its template, in the mode that is on (Live or Sandbox), channels and order types; Mercado Pago also gets its Connect button.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 }
]

export const PaymentOptionConfig = ({
  business,
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
  const [ordering] = useApi()
  const [{ user }] = useSession()
  const gateway = paymethod?.gateway

  // two fields per template entry (Live and Sandbox): the panel draws the ones of the mode that is on
  const fields = useMemo(() => (
    filterPaymethodFieldsByRole(paymethod?.data_template, { gateway, userLevel: user?.level }).flatMap(field => {
      const common = {
        key: field.key,
        label: t(`${gateway?.toUpperCase()}_${field.name?.toUpperCase()}`, field.name),
        required: !!field.required,
        type: field.type,
        hint: field.description || undefined,
        secret: isSecretField({ key: field.key, type: field.type })
      }
      return [{ ...common, mode: 'live' }, { ...common, mode: 'sandbox' }]
    })
  ), [paymethod?.data_template, gateway, user?.level, t])

  const generalBefore = isMercadoPagoConnectGateway(gateway)
    ? (
      <div>
        <Button
          variant='secondary'
          icon={Link}
          onClick={() => openMercadoPagoSetupPopup(getMercadoPagoSetupUrl({ project: ordering?.project, businessId: business?.id }))}
        >
          {t('CONNECT_WITH_MERCADO_PAGO', 'Connect with Mercado Pago')}
        </Button>
      </div>
      )
    : undefined

  return (
    <ProviderPanel
      paymethod={paymethod}
      businessPaymethod={businessPaymethod}
      gatewayName={gatewayName}
      storeName={storeName}
      tabs={TABS}
      initialTab={initialTab}
      onTabChange={onTabChange}
      sites={sites}
      devices={devices}
      orderTypes={orderTypes}
      showMode
      fieldsDisplay='active'
      fields={fields}
      generalBefore={generalBefore}
      onSave={onSave}
    />
  )
}
