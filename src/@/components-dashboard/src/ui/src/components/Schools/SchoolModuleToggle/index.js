import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { SchoolModuleToggle as SchoolModuleToggleController } from '../../../../../components/Schools/SchoolModuleToggle'
import { Button } from '../../../styles'
import { Confirm } from '../../Shared'
import { TextButton } from '../styles'

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
      <Button
        color='primary'
        disabled={saving}
        onClick={handleEnable}
      >
        {t('SCHOOL_MODULE_ENABLE', 'Enable school module')}
      </Button>
    )
  }

  const closeConfirm = () => setConfirmOpen(false)

  const handleAcceptDisable = async () => {
    closeConfirm()
    await handleDisable()
  }

  return (
    <>
      <TextButton
        type='button'
        disabled={saving}
        onClick={() => setConfirmOpen(true)}
      >
        {t('SCHOOL_MODULE_DISABLE', 'Disable')}
      </TextButton>
      <Confirm
        width='600px'
        title={t('SCHOOL_MODULE_DISABLE_CONFIRM_TITLE', 'Disable the School module?')}
        content={t('SCHOOL_MODULE_DISABLE_CONFIRM_TEXT', 'Businesses with the School vertical keep their data, but grades, classrooms, students and meals are hidden until you enable the module again.')}
        acceptText={t('SCHOOL_MODULE_DISABLE', 'Disable')}
        open={confirmOpen}
        onClose={closeConfirm}
        onCancel={closeConfirm}
        onAccept={handleAcceptDisable}
      />
    </>
  )
}

export const SchoolModuleToggle = (props) => (
  <SchoolModuleToggleController {...props} UIComponent={SchoolModuleToggleUI} />
)
