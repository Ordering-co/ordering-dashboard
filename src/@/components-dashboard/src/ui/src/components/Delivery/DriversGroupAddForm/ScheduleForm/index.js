import React, { useState, useEffect } from 'react'
import { useLanguage } from '../../../../../../index'
import { Checkbox, DefaultSelect } from '../../../../styles'
import { Schedule } from '../../../Shared'
import { timezones } from '../../../../config/constants'
import { FieldError } from '../FieldError'

import {
  HeaderWrapper,
  CheckboxContainer,
  Description,
  InputWrapper
} from './styles'

const getBrowserTimezone = () => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return timezones.includes(timezone) ? timezone : null
}

export const ScheduleForm = (props) => {
  const {
    driversGroupState,
    changesState,
    isScheduleEnabled,
    hideTitle,
    handleChangesState,
    handleChangeScheduleEnabled,
    handleChangeScheduleState,
    // (P-2 of batch R): opt-in; the add form's «Select a timezone» check. The edit form does not pass it
    fieldErrors
  } = props

  const [, t] = useLanguage()
  const [timezoneSearchValue, setTimezoneSearchValue] = useState('')
  const [timezonesOptions, setTimezonesOptions] = useState([])

  const driversGroup = driversGroupState?.driversGroup
  const timezoneError = fieldErrors?.timezone

  useEffect(() => {
    const _timezonesOptions = timezones
      .filter(timezone => timezone.toLocaleLowerCase().includes(timezoneSearchValue.toLocaleLowerCase()))
      .map(timezone => {
        return {
          value: timezone,
          content: timezone
        }
      })
    setTimezonesOptions(_timezonesOptions)
  }, [timezoneSearchValue])

  return (
    <>
      <HeaderWrapper>
        {!hideTitle && (
          <h2>{t('SCHEDULE', 'Schedule')}</h2>
        )}
        <CheckboxContainer>
          <Checkbox
            aria-labelledby='drivers-group-schedule-always-available'
            checked={!isScheduleEnabled}
            onChange={e => handleChangeScheduleEnabled(!e.target.checked, getBrowserTimezone())}
          />
          <p id='drivers-group-schedule-always-available'>{t('ALWAYS_AVAILABLE', 'Always available')}</p>
        </CheckboxContainer>
      </HeaderWrapper>
      <Description>
        {isScheduleEnabled
          ? t('DRIVER_GROUP_SCHEDULE_OVERNIGHT_INFO', 'Each time range must start and end on the same day. For overnight hours, split the range across both days.')
          : t('DRIVER_GROUP_SCHEDULE_ALWAYS_AVAILABLE', 'Without a schedule, this group is always available to receive orders.')}
      </Description>
      {isScheduleEnabled && (
        <>
          <InputWrapper isTimezone>
            <label id='drivers-group-timezone-label'>{t('TIMEZONE', 'Timezone')}</label>
            <DefaultSelect
              id='drivers-group-timezone'
              ariaLabelledBy='drivers-group-timezone-label drivers-group-timezone'
              ariaDescribedBy={timezoneError?.id}
              placeholder={t('SELECT_TIMEZONE', 'Select a timezone')}
              defaultValue={changesState?.timezone ?? driversGroup?.timezone}
              options={timezonesOptions}
              onChange={timezone => handleChangesState({ timezone })}
              optionInnerMaxHeight='60vh'
              isShowSearchBar
              searchBarIsCustomLayout
              searchBarIsNotLazyLoad
              searchValue={timezoneSearchValue}
              handleChangeSearch={setTimezoneSearchValue}
            />
            {timezoneError && <FieldError id={timezoneError.id}>{timezoneError.message}</FieldError>}
          </InputWrapper>
          <Schedule
            scheduleList={changesState?.schedule ?? driversGroup?.schedule}
            handleChangeScheduleState={handleChangeScheduleState}
          />
        </>
      )}
    </>
  )
}
