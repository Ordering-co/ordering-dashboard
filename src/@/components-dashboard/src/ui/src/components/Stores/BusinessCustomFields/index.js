import React from 'react'
import { useLanguage, BusinessMetaFields as BusinessMetaFieldsController } from '../../../../../index'
import { MetaFieldsEditor } from '../MetaFieldsEditor'
import './business-custom-fields.css'

// redesign stores 5.16 (; G2-31, G2-32): the custom fields of a store, in the section of the store editor
// (StoreSectionBody, `custom_fields`). The list, the add form and the confirmed delete are
// S/MetaFieldsEditor (the one the menu and the promotions use); this file puts an h1 over it and wires the BusinessMetaFields controller.
// The requests are the ones of before: the add sends `{ business_id, key, value, value_type }` (the editor spreads `extraBody` and adds
// key, value and value_type), GET only runs when the `metafields` prop is missing, and the two `handleSuccess*` callbacks run on success.
// A delete the API refuses keeps the row and says why in the confirmation; nothing keeps spinning (G2-31).
// Since Connect no longer mounts it: Connect/PosMenu/PosCustomFieldsDialog hosts S/MetaFieldsEditor itself.

const BusinessCustomFieldsUI = (props) => {
  const {
    businessId,
    metaFieldsList,
    reloadMetaFields,
    handleDeleteMetaField,
    handleAddMetaField
  } = props
  const [, t] = useLanguage()

  return (
    <div className='odc-root odc-bcf'>
      <h1 className='odc-bcf-title'>{t('CUSTOM_FIELDS', 'Custom fields')}</h1>
      <MetaFieldsEditor
        fields={Array.isArray(metaFieldsList?.metaFields) ? metaFieldsList.metaFields : []}
        loading={Boolean(metaFieldsList?.loading)}
        error={metaFieldsList?.error}
        onReload={reloadMetaFields}
        onAdd={handleAddMetaField}
        onDelete={handleDeleteMetaField}
        extraBody={{ business_id: businessId }}
      />
    </div>
  )
}

export const BusinessCustomFields = (props) => {
  const MetaFieldsProps = {
    ...props,
    asDashboard: true,
    UIComponent: BusinessCustomFieldsUI
  }
  return <BusinessMetaFieldsController {...MetaFieldsProps} />
}
