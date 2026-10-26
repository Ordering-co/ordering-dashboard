import React, { memo } from 'react'
import { useLanguage } from '../../../../../../index'
import { Schedule as ScheduleController } from '../../../Shared'
import {
  ScheduleWrapper,
  ScheduleContentWrapper
} from '../styles'

export const Schedule = memo((props) => {
  const {
    handleChangeScheduleState,
    scheduleList
  } = props

  const [, t] = useLanguage()

  return (
    <ScheduleWrapper>
      <h1>{t('SCHEDULE', 'Schedule')}</h1>
      <ScheduleContentWrapper>
        <ScheduleController
          scheduleList={scheduleList}
          handleChangeScheduleState={val => handleChangeScheduleState(val)}
        />
      </ScheduleContentWrapper>
    </ScheduleWrapper>
  )
})

Schedule.displayName = 'Schedule'
