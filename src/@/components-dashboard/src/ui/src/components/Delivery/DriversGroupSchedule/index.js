import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { Alert } from '../../Shared'
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
      >
        <ScheduleForm {...props} hideTitle />
        <Button
          borderRadius='8px'
          color='primary'
          type='submit'
          disabled={Object.keys(changesState).length === 0 || actionState?.loading}
        >
          {t('SAVE', 'Save')}
        </Button>
      </Container>
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}
