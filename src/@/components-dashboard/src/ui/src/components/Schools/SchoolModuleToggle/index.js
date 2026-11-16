import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { SchoolModuleToggle as SchoolModuleToggleController } from '../../../../../components/Schools/SchoolModuleToggle'
import { Button, ConfirmDialog } from '../../Shared/Product'

// redesign SC-B5 (decision 4): the switch of the School module on Product pieces. The controller (K/SchoolModuleToggle) is untouched: it
// does the PUT of the config and the refresh, and tells the UI `canToggle` (level 0 with a config row, S7 of docs/SETTINGS.md).
//
// On: «Disable school module» (a secondary button; it was a red text) opens a confirmation (C8) with the text of today and the verb
// «Disable module»; it stays open and busy until `handleDisable` answers. Off: «Enable school module», the one primary action, no
// confirmation (as today). Without `canToggle`, nothing.
const SchoolModuleToggleUI = (props) => {
  const {
    isEnabled,
    canToggle,
    saving,
    handleEnable,
    handleDisable
  } = props
  const [, t] = useLanguage()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!canToggle) return null

  if (!isEnabled) {
    return (
      <Button variant='primary' busy={saving} onClick={handleEnable}>
        {t('SCHOOL_MODULE_ENABLE', 'Enable school module')}
      </Button>
    )
  }

  const closeConfirm = () => setConfirmOpen(false)

  // closes when the request is over, whatever it said: a failure is a toast of the controller, not a dialog left open
  const handleAcceptDisable = async () => {
    try {
      await handleDisable()
    } finally {
      closeConfirm()
    }
  }

  return (
    <>
      {/* SCHOOL_MODULE_DISABLE is shared («Disable»); the button says what it disables */}
      <Button busy={saving} onClick={() => setConfirmOpen(true)}>
        {t('SCHOOL_MODULE_DISABLE_ACTION', 'Disable school module')}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        tone='danger'
        title={t('SCHOOL_MODULE_DISABLE_CONFIRM_TITLE', 'Disable the School module?')}
        confirmLabel={t('SCHOOL_MODULE_DISABLE_CONFIRM', 'Disable module')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={saving}
        onConfirm={handleAcceptDisable}
        onCancel={closeConfirm}
      >
        {t('SCHOOL_MODULE_DISABLE_CONFIRM_TEXT', 'Businesses with the School vertical keep their data, but grades, classrooms, students and meals are hidden until you enable the module again.')}
      </ConfirmDialog>
    </>
  )
}

export const SchoolModuleToggle = (props) => (
  <SchoolModuleToggleController {...props} UIComponent={SchoolModuleToggleUI} />
)
