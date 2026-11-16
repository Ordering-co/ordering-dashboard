import React, { useEffect, useRef } from 'react'

import { BusinessMetaFields as BusinessMetaFieldsController, useLanguage } from '../../../../../index'
import { Dialog } from '../../Shared/Product'
import { MetaFieldDeleteConfirm, MetaFieldsEditor, useMetaFieldDelete } from '../../Stores/MetaFieldsEditor'

// (from Tiendas 5.16, ): the custom fields of a store in Connect, in a P/Dialog. S/BusinessCustomFields is the
// section of the store editor, with an h1 of its own: inside this Dialog it said «Custom fields» twice, and its delete confirmation sat
// in the Dialog's React tree, where Base UI takes it for a nested dialog and draws no scrim. So the panel wires the same controller
// (BusinessMetaFields, the same requests and the same two success callbacks) to S/MetaFieldsEditor without the h1, and hosts the delete
// flow beside the Dialog, as the menu does (S/BusinessMenuCustomFields). The controller stays inside the Dialog, so it mounts (and, without
// `metafields`, fetches) only while the Dialog is open, as before; its delete action reaches the flow through a ref.

const FieldsEditor = ({ businessId, metaFieldsList, reloadMetaFields, handleAddMetaField, handleDeleteMetaField, deletion, deleteActionRef }) => {
  useEffect(() => {
    deleteActionRef.current = handleDeleteMetaField
  })
  useEffect(() => () => { deleteActionRef.current = null }, [deleteActionRef])
  return (
    <MetaFieldsEditor
      fields={Array.isArray(metaFieldsList?.metaFields) ? metaFieldsList.metaFields : []}
      loading={Boolean(metaFieldsList?.loading)}
      error={metaFieldsList?.error}
      onReload={reloadMetaFields}
      onAdd={handleAddMetaField}
      deletion={deletion}
      extraBody={{ business_id: businessId }}
    />
  )
}

/**
 * `open` and `onClose()` drive the Dialog; `business` is the store (`id`, `metafields`); `onAdded(result)` and `onDeleted(id)` are the
 * success callbacks of the controller (the panel turns them into `handleSuccessAddBusinessItem` / `handleSuccessDeleteBusinessItem`).
 */
export const PosCustomFieldsDialog = ({ open, onClose, business, onAdded, onDeleted }) => {
  const [, t] = useLanguage()
  const deleteActionRef = useRef(null)
  const deletion = useMetaFieldDelete({
    onDelete: (id) => (deleteActionRef.current ? deleteActionRef.current(id) : Promise.resolve({ ok: false }))
  })

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => { if (!next) onClose() }}
        size='lg'
        title={t('CUSTOM_FIELDS', 'Custom fields')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <BusinessMetaFieldsController
          asDashboard
          businessId={business?.id}
          metafields={business?.metafields}
          handleSuccessAddMetaFields={onAdded}
          handleSuccessDeleteBusinessMetaFields={onDeleted}
          deletion={deletion}
          deleteActionRef={deleteActionRef}
          UIComponent={FieldsEditor}
        />
      </Dialog>
      {/* a SIBLING of the Dialog: inside its React tree Base UI would take it for a nested dialog and skip its scrim */}
      <MetaFieldDeleteConfirm
        open={deletion.confirm.open}
        busy={deletion.confirm.busy}
        error={deletion.confirm.error}
        field={deletion.confirm.field}
        finalFocus={deletion.confirm.finalFocus}
        onCancel={deletion.confirm.onCancel}
        onConfirm={deletion.confirm.onConfirm}
      />
    </>
  )
}
