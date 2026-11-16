import React from 'react'
import { BusinessPromotionMetaFields as BusinessPromotionMetaFieldsController } from '../../../../../index'
import { useSectionSplit } from '../../Shared/Product'
import { MetaFieldsEditor } from '../MetaFieldsEditor'

// redesign stores 5.14 (S-12, K-1): the custom fields of a promotion, inline in the tab of its detail. The list, the
// add form and the confirmed delete are S/MetaFieldsEditor (promoted from the menu's, 5.6); this file only wires the controller to it.
// The requests are the ones of before: the add sends `{ key, business_id, value, value_type, offer_id }` (the editor spreads
// `extraBody` and adds key, value and value_type). The add form registers its leave guard in the SectionSplit the detail lives in,
// so a change of tab, of promotion or closing the detail asks while a field is half typed (decision 4).

const BusinessPromotionCustomFieldsUI = (props) => {
  const {
    businessId,
    offerId,
    metaFieldsList,
    reloadMetaFields,
    handleDeleteMetaField,
    handleAddMetaField
  } = props
  const { registerCloseGuard } = useSectionSplit()

  return (
    <MetaFieldsEditor
      fields={Array.isArray(metaFieldsList?.metaFields) ? metaFieldsList.metaFields : []}
      loading={Boolean(metaFieldsList?.loading)}
      error={metaFieldsList?.error}
      onReload={reloadMetaFields}
      onAdd={handleAddMetaField}
      onDelete={handleDeleteMetaField}
      extraBody={{ business_id: businessId, offer_id: offerId }}
      registerCloseGuard={registerCloseGuard}
    />
  )
}

export const BusinessPromotionCustomFields = (props) => {
  const MetaFieldsProps = {
    ...props,
    asDashboard: true,
    UIComponent: BusinessPromotionCustomFieldsUI
  }
  return <BusinessPromotionMetaFieldsController {...MetaFieldsProps} />
}
