import React, { useState } from 'react'
import { Calendar4 } from 'react-bootstrap-icons'
import DatePicker from 'react-datepicker'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'
import moment from 'moment'
import * as locales from 'react-date-range/dist/locale'

import { useLanguage } from '~components'
import { getLocale } from '../../../utils'
import { snoozeUtils } from './utils'

import {
  SnoozeContainer,
  SnoozeTitle,
  SnoozeWrapper,
  Button,
  ButtonOptions,
  ButtonWrapper,
  DateContainer,
  IconContainer,
  InfoContainer
} from './styles'

export const SnoozeComponent = (props) => {
  const {
    isAutomaticUpdate,
    hideButtons,
    dataState,
    handleUpdate,
    onClose,
    setFormState,
    handleChangeFormState,
    formState
  } = props
  const [state, t] = useLanguage()
  const { snoozeOptions, dateOptions } = snoozeUtils()
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    today.setDate(today.getDate() + 1)
    return today
  })
  const [openCalendar, setOpenCalendar] = useState(false)
  const [selectedOption, setSelectedOption] = useState('')

  const handleRemoveSnooze = () => {
    handleChangeFormState && handleChangeFormState({ snooze_until: null })
    setFormState && setFormState(prevState => ({ ...prevState, changes: { ...prevState?.changes, snooze_until: null } }))
  }

  const handleChangeOption = (value) => {
    setSelectedOption(value)
    if (['until_date', 'off'].includes(value)) {
      value === 'off' && handleRemoveSnooze()
      return
    }
    const currentDate = new Date()
    let newDate = null

    const numericValue = Number(value)
    const timeMapping = [1, 2, 4, 6, 12]
    if (timeMapping.includes(numericValue)) {
      newDate = new Date(currentDate.getTime() + numericValue * 60 * 60 * 1000)
    } else if (value === 'indefinitely') {
      newDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 2))
    }

    if (newDate) {
      handleChangeFormState && handleChangeFormState({ snooze_until: moment(newDate).utc().format('YYYY-MM-DD HH:mm:ss') })
      setFormState && setFormState(prevState => ({
        ...prevState,
        changes: {
          ...prevState?.changes,
          snooze_until: moment(newDate).utc().format('YYYY-MM-DD HH:mm:ss')
        }
      }))
    }
  }

  const handleSelectDate = (date) => {
    const currentDate = new Date()
    const diffInHours = Math.abs((date - currentDate) / 36e5)

    const tolerance = 0.15 // 10 minutes tolerance

    const options = [1, 2, 4, 6, 12]

    let matchedOption = options.find(option => Math.abs(diffInHours - option) <= tolerance)

    matchedOption = matchedOption ? String(matchedOption) : ''

    setSelectedDate(date)
    if (matchedOption) {
      setSelectedOption(matchedOption)
    }

    handleChangeFormState && handleChangeFormState({ snooze_until: moment(date).utc().format('YYYY-MM-DD HH:mm:ss') })
    setFormState && setFormState(prevState => ({
      ...prevState,
      changes: { ...prevState?.changes, snooze_until: moment(date).utc().format('YYYY-MM-DD HH:mm:ss') }
    }))
  }

  const handleUpdateClick = () => {
    onClose && onClose()
    if (isAutomaticUpdate) {
      handleUpdate && handleUpdate(formState?.changes)
      return
    }
    if (Object.keys(formState?.changes)?.length) {
      handleUpdate && handleUpdate()
    }
  }

  return (
    <>
      <SnoozeContainer openCalendar={openCalendar}>
        <SnoozeTitle>
          {t('SNOOZE_TITLE', 'Disable for:')}
        </SnoozeTitle>
        <SnoozeWrapper>
          {snoozeOptions?.map((option, i) => (
            <div key={i}>
              {option.value === 'until_date' && (
                <DateContainer active={option.value === selectedOption || openCalendar}>
                  <IconContainer>
                    <Calendar4 />
                  </IconContainer>
                  <DatePicker
                    locale={getLocale(state?.language?.code, locales)}
                    selected={selectedDate}
                    minDate={new Date()}
                    onChange={handleSelectDate}
                    onCalendarOpen={() => {
                      setSelectedOption('until_date')
                      setOpenCalendar(true)
                    }}
                    onCalendarClose={() => setOpenCalendar(false)}
                    showTimeSelect
                    timeFormat='HH:mm'
                    timeIntervals={15}
                    timeCaption='Time'
                    dateFormat='MMMM d, yyyy HH:mm'
                  />
                </DateContainer>
              )}
              {option.value === 'or' && (
                <p>{option.content}</p>
              )}
              {!dateOptions.includes(option.value) && (
                <ButtonOptions
                  onClick={() => handleChangeOption(option.value)}
                  active={option.value === selectedOption}
                >{option.content}
                </ButtonOptions>
              )}
            </div>
          ))}
        </SnoozeWrapper>
        <InfoContainer hasSnooze={dataState?.snooze_until} hideButtons={hideButtons}>
          {!hideButtons && (
            <ButtonWrapper>
              <Button color='primary' onClick={() => handleUpdateClick()}>{selectedOption === 'off' ? t('DISABLE_SNOOZE', 'Disable Snooze') : t('SNOOZE_SAVE', 'Snooze')}</Button>
              <Button onClick={() => onClose()}>{t('CANCEL', 'Cancel')}</Button>
            </ButtonWrapper>
          )}
          {dataState?.snooze_until && (
            <span><strong>{t('SNOOZED_UNTIL', 'Snoozed until:')}</strong> {moment.utc(dataState?.snooze_until).local().format('YYYY-MM-DD HH:mm')}</span>
          )}
        </InfoContainer>
      </SnoozeContainer>
    </>
  )
}
