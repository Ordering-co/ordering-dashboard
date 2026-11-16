import React from 'react'
import { useLanguage, BusinessMenuMetaFields as BusinessMenuMetaFieldsController } from '../../../../../index'
import {
  Dialog,
  LeaveDialog,
  LeaveGuardContext,
  useLeaveGuardHost
} from '../../Shared/Product'
import { MetaFieldDeleteConfirm, MetaFieldsEditor, useMetaFieldDelete } from '../MetaFieldsEditor'
import { useRouteLeaveGuard } from '../../../hooks/useRouteLeaveGuard'

// redesign stores 5.6 (G3-06, G3-07, decision 6): the custom fields of a menu in P/Dialog. The UI owns the dialog (`open`,
// `onClose`; the controller only fetches while it is open). Every way to close asks through a LOCAL leave guard (closing this
// dialog never asks about the menu form behind it). The list, the add form and the delete confirmation are S/MetaFieldsEditor
// (promoted in stores 5.14, , K-1; the delete flow is hosted here so its confirmation is a sibling of the Dialog, as in
// 5.6, and darkens it); the requests and their bodies are the ones the legacy UI sent:
// `handleAddMetaField({ key, business_id, menu_id, value, value_type })`.

const BusinessMenuCustomFieldsUI = (props) => {
  const {
    open,
    onClose,
    returnFocus,
    businessId,
    menuId,
    metaFieldsList,
    reloadMetaFields,
    handleDeleteMetaField,
    handleAddMetaField
  } = props
  const [, t] = useLanguage()
  // The guard is local on purpose: closing this dialog asks about its own form only, never about the menu form behind it.
  const leave = useLeaveGuardHost()
  // redesign bugs E: the sidebar, links, back/forward, ⌘K and Mia ask too while a field is half typed
  useRouteLeaveGuard({ active: Boolean(open) && leave.dirty, requestLeave: leave.requestLeave })
  const deletion = useMetaFieldDelete({ onDelete: handleDeleteMetaField })

  const fields = Array.isArray(metaFieldsList?.metaFields) ? metaFieldsList.metaFields : []
  const loading = Boolean(metaFieldsList?.loading)
  const loadError = !loading && metaFieldsList?.error ? metaFieldsList.error : null

  return (
    <>
      <Dialog
        open={Boolean(open)}
        onOpenChange={(next) => {
          if (!next) leave.requestLeave(() => onClose?.())
        }}
        size='md'
        title={t('CUSTOM_FIELDS', 'Custom fields')}
        closeLabel={t('CLOSE', 'Close')}
        returnFocus={returnFocus}
      >
        <LeaveGuardContext.Provider value={leave.context}>
          <MetaFieldsEditor
            fields={fields}
            loading={loading}
            error={loadError}
            onReload={reloadMetaFields}
            onAdd={handleAddMetaField}
            deletion={deletion}
            extraBody={{ business_id: businessId, menu_id: menuId }}
          />
        </LeaveGuardContext.Provider>
      </Dialog>
      {/* a SIBLING of the Dialog, as in 5.6: inside its React tree Base UI would take it for a nested dialog and skip its scrim */}
      <MetaFieldDeleteConfirm
        open={deletion.confirm.open}
        busy={deletion.confirm.busy}
        error={deletion.confirm.error}
        field={deletion.confirm.field}
        finalFocus={deletion.confirm.finalFocus}
        onCancel={deletion.confirm.onCancel}
        onConfirm={deletion.confirm.onConfirm}
      />
      <LeaveDialog
        open={leave.dialog.open}
        saving={leave.dialog.saving}
        onKeep={leave.dialog.onKeep}
        onDiscard={leave.dialog.onDiscard}
        onSave={leave.dialog.onSave}
        returnFocus={leave.dialog.returnFocus}
        title={t('LEAVE_UNSAVED_TITLE', 'Save your changes?')}
        description={t('LEAVE_UNSAVED_DESCRIPTION', 'You have unsaved changes in _section_. Save them before you leave, or discard them.').replace('_section_', t('CUSTOM_FIELDS', 'Custom fields'))}
        keepLabel={t('KEEP_EDITING', 'Keep editing')}
        saveLabel={t('STORES_MENU_FIELD_ADD_AND_CLOSE', 'Add and close')}
        discardLabel={t('DISCARD', 'Discard')}
        closeLabel={t('CLOSE', 'Close')}
      />
    </>
  )
}

export const BusinessMenuCustomFields = (props) => {
  const businessMenuMetaFieldsProps = {
    ...props,
    UIComponent: BusinessMenuCustomFieldsUI
  }
  return (
    <BusinessMenuMetaFieldsController {...businessMenuMetaFieldsProps} />
  )
}
