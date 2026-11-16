import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { AlertDialog, Button } from '../../Shared/Product'
import { ScheduleForm } from '../DriversGroupAddForm/ScheduleForm'

import { Container } from './styles'

export const DriversGroupSchedule = (props) => {
  const {
    driversGroupState,
    changesState,
    actionState,
    actionDisabled,
    isScheduleEnabled,
    handleUpdateDriversGroup
  } = props

  const [, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const onSubmit = (e) => {
    e.preventDefault()
    if (isScheduleEnabled && !(changesState?.timezone ?? driversGroupState?.driversGroup?.timezone)) {
      setAlertState({
        open: true,
        content: [t('VALIDATION_ERROR_REQUIRED', 'The timezone is required.').replace('_attribute_', t('TIMEZONE', 'Timezone'))]
      })
      return
    }
    handleUpdateDriversGroup(changesState)
  }

  return (
    <>
      <Container
        onSubmit={onSubmit}
        disabled={actionDisabled}
        inert={actionDisabled ? '' : undefined}
        aria-disabled={actionDisabled ? 'true' : undefined}
      >
        <ScheduleForm {...props} hideTitle />
        {/* redesign (AD-1): a Product primary Save, aligned to the inline start; in a wrapper so the legacy `> button` rule of the form leaves it alone */}
        <div style={{ marginBlockStart: 'var(--od-space-4)' }}>
          <Button
            variant='primary'
            type='submit'
            disabled={Object.keys(changesState).length === 0 || actionState?.loading}
            busy={Boolean(actionState?.loading)}
          >
            {t('SAVE', 'Save')}
          </Button>
        </div>
      </Container>
      {/* redesign (AD-7): the legacy Alert is a Product alert dialog; same message */}
      <AlertDialog
        open={alertState.open}
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setAlertState({ open: false, content: [] })}
      />
    </>
  )
}
