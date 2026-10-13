import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { useLanguage } from '~components'
import { PurchaseAddons as PurchaseAddonsController } from '~ui'

export const PurchaseAddons = (props) => {
  const [, t] = useLanguage()
  const purchaseAddonsProps = {
    ...props,
    settingsType: 'key_basic',
    allowOptions: [],
    pageURL: 'purchase_addons',
    title: t('PURCHASE_APPS_AND_ADDONS', 'Apps & Addons'),
    description: t('PURCHASE_APPS_AND_ADDONS_DESCRIPTION', 'Purchase your favorite apps and addons')
  }

  return (
    <>
      <HelmetTags page='purchase_addons' />
      <PurchaseAddonsController {...purchaseAddonsProps} />
    </>
  )
}
