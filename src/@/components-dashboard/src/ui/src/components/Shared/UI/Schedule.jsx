import React, { useState, useEffect, useRef } from 'react'
import {
  useLanguage,
  useConfig,
  useUtils,
  Schedule as ScheduleController
} from '../../../../../index'
import { Checkbox } from '../../../styles/Checkbox'
import { IconButton } from '../../../styles/Buttons'
import { Alert, Confirm } from '../Confirm'
import { ScheduleCopyTimes } from '../ScheduleCopyTimes'
import { Select as DefaultSelect } from '../../../styles/Select'

import {
  ScheduleContainer,
  TimeScheduleItemContainer,
  Option,
  SplitLine,
  IconWrapper,
  SelectWrapper,
  AddScheduleIconWrapper,
  TrashIconWrapper,
  DateWrapper,
  LapseRow
} from './schedule-styles'
import { CircleMinus as DashCircleFill, CirclePlus as PlusCircleFill, SquarePlus as PlusSquare, Trash2 as Trash } from '../Icon'

const ScheduleUI = (props) => {
  const {
    scheduleState,
    isConflict,
    setIsConflict,
    isTimeChangeError,
    addScheduleTime,
    openAddSchedule,
    setIsTimeChangeError,
    handleEnabledSchedule,
    handleChangeScheduleTime,
    handleDeleteSchedule,
    handleOpenAddSchedule,
    handleChangeAddScheduleTime,
    handleAddSchedule,
    selectedCopyDays,
    cleanSelectedCopyDays,
    handleSelectCopyTimes,
    handleApplyScheduleCopyTimes,
    isShowDate,
    disableSchedule,
    useDaysAbbrevation
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate }] = useUtils()

  const is12Hours = configs?.general_hour_format?.value?.includes('hh:mm')

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })

  const minuteOptions = useRef([])
  const hourOptions = useRef([])
  const [isOpenCopytimes, setIsOpenCopytimes] = useState(null)

  const daysOfWeek = [
    t(`SUNDAY${useDaysAbbrevation ? '_ABBREVIATION' : ''}`, 'Sunday'),
    t(`MONDAY${useDaysAbbrevation ? '_ABBREVIATION' : ''}`, 'Monday'),
    t(`TUESDAY${useDaysAbbrevation ? '_ABBREVIATION' : ''}`, 'Tuesday'),
    t(`WEDNESDAY${useDaysAbbrevation ? '_ABBREVIATION' : ''}`, 'Wednesday'),
    t(`THURSDAY${useDaysAbbrevation ? '_ABBREVIATION' : ''}`, 'Thursday'),
    t(`FRIDAY${useDaysAbbrevation ? '_ABBREVIATION' : ''}`, 'Friday'),
    t(`SATURDAY${useDaysAbbrevation ? '_ABBREVIATION' : ''}`, 'Saturday')
  ]

  const closeAlert = () => {
    setIsConflict(false)
    setIsTimeChangeError(false)
    setAlertState({
      open: false,
      content: []
    })
  }

  const onClickDelete = (daysOfWeekIndex, index) => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('SCHEDULE', 'Schedule')),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeleteSchedule(daysOfWeekIndex, index)
      }
    })
  }

  const getNextDate = (x) => {
    const now = new Date()
    now.setDate(now.getDate() + (x + (7 - now.getDay())) % 7)
    return now
  }

  useEffect(() => {
    if (!isTimeChangeError) return
    setAlertState({
      open: true,
      content: [t('END_TIME_LATER', 'Choose an end time later than the start time.')]
    })
  }, [isTimeChangeError])

  useEffect(() => {
    if (!isConflict) return
    setAlertState({
      open: true,
      content: [t('SCHEDULE_CONFLICT', 'There is an schedule conflict')]
    })
  }, [isConflict])

  useEffect(() => {
    const generateOptions = (count, formatFn) => {
      return Array.from({ length: count }, (_, i) => ({
        value: i,
        content: <Option>{formatFn(i)}</Option>
      }))
    }

    const formatMinute = (i) => (i < 10 ? `0${i}` : i)
    const formatHour = (hour) => {
      if (!is12Hours) return hour < 10 ? `0${hour}` : hour
      if (hour === 0) return `12 ${t('AM', 'AM')}`
      if (hour < 12) return `${hour} ${t('AM', 'AM')}`
      if (hour === 12) return `12 ${t('PM', 'PM')}`
      return `${hour - 12} ${t('PM', 'PM')}`
    }
    minuteOptions.current = generateOptions(60, formatMinute)
    hourOptions.current = generateOptions(24, formatHour)
  }, [is12Hours])

  return (
    <>
      <ScheduleContainer>
        {scheduleState.map((schedule, daysOfWeekIndex) => (
          <TimeScheduleItemContainer
            key={daysOfWeekIndex}
            dayIndex={daysOfWeekIndex}
          >
            <div className='day-title od-schedule-day-title'>
              {!disableSchedule && (
                <Checkbox
                  aria-label={`${t('SCHEDULE', 'Schedule')}: ${daysOfWeek[daysOfWeekIndex]}`}
                  checked={schedule?.enabled}
                  onChange={e => handleEnabledSchedule(daysOfWeekIndex, e.target.checked)}
                />
              )}
              <DateWrapper>
                <h4>{daysOfWeek[daysOfWeekIndex]}</h4>
                {isShowDate && (
                  <h4 className='date'>{parseDate(getNextDate(daysOfWeekIndex), { outputFormat: 'YYYY-MM-DD' })}</h4>
                )}
              </DateWrapper>
            </div>
            <div className='day-selector od-schedule-day-selector'>
              {schedule?.enabled
                ? (
                  <div className='days od-schedule-lapses'>
                    {schedule?.lapses.map((lapse, index) => (
                      <LapseRow
                        key={index}
                        lapseIndex={index}
                      >
                        <SelectWrapper
                          role='group'
                          aria-label={`${daysOfWeek[daysOfWeekIndex]} ${t('OPEN', 'Open')} ${t('HOUR', 'Hour')} ${index + 1}`}
                          boundary='open'
                          unit='hour'
                          lapseIndex={index}
                        >
                          <DefaultSelect
                            className='od-schedule-time-select'
                            noSelected
                            options={hourOptions.current}
                            defaultValue={lapse?.open?.hour}
                            onChange={val => handleChangeScheduleTime(val, daysOfWeekIndex, index, true, 'hour')}
                            optionInnerMaxHeight='300px'
                          />
                        </SelectWrapper>
                        <SelectWrapper
                          role='group'
                          aria-label={`${daysOfWeek[daysOfWeekIndex]} ${t('OPEN', 'Open')} ${t('MINUTE', 'Minute')} ${index + 1}`}
                          boundary='open'
                          unit='minute'
                          lapseIndex={index}
                        >
                          <DefaultSelect
                            className='od-schedule-time-select'
                            noSelected
                            options={minuteOptions.current}
                            defaultValue={lapse?.open?.minute}
                            onChange={val => handleChangeScheduleTime(val, daysOfWeekIndex, index, true, 'minute')}
                            optionInnerMaxHeight='300px'
                          />
                        </SelectWrapper>
                        <SplitLine />
                        <SelectWrapper
                          role='group'
                          aria-label={`${daysOfWeek[daysOfWeekIndex]} ${t('CLOSE', 'Close')} ${t('HOUR', 'Hour')} ${index + 1}`}
                          boundary='close'
                          unit='hour'
                          lapseIndex={index}
                        >
                          <DefaultSelect
                            className='od-schedule-time-select'
                            noSelected
                            options={hourOptions.current}
                            defaultValue={lapse?.close?.hour}
                            onChange={val => handleChangeScheduleTime(val, daysOfWeekIndex, index, false, 'hour')}
                            optionInnerMaxHeight='300px'
                          />
                        </SelectWrapper>
                        <SelectWrapper
                          role='group'
                          aria-label={`${daysOfWeek[daysOfWeekIndex]} ${t('CLOSE', 'Close')} ${t('MINUTE', 'Minute')} ${index + 1}`}
                          boundary='close'
                          unit='minute'
                          lapseIndex={index}
                        >
                          <DefaultSelect
                            className='od-schedule-time-select'
                            noSelected
                            options={minuteOptions.current}
                            defaultValue={lapse?.close?.minute}
                            onChange={val => handleChangeScheduleTime(val, daysOfWeekIndex, index, false, 'minute')}
                            optionInnerMaxHeight='300px'
                          />
                        </SelectWrapper>
                        <TrashIconWrapper
                          isHide={schedule?.lapses.length <= 1}
                        >
                          {!disableSchedule && (
                            <IconButton
                              type='button'
                              aria-label={`${t('DELETE', 'Delete')} ${t('SCHEDULE', 'Schedule')}: ${daysOfWeek[daysOfWeekIndex]} ${index + 1}`}
                              data-schedule-action='delete'
                              onClick={() => onClickDelete(daysOfWeekIndex, index)}
                            >
                              <Trash />
                            </IconButton>
                          )}
                        </TrashIconWrapper>
                      </LapseRow>
                    ))}
                    {openAddSchedule[daysOfWeekIndex] && (
                      <LapseRow manual lapseIndex='manual'>
                        <SelectWrapper
                          role='group'
                          aria-label={`${daysOfWeek[daysOfWeekIndex]} ${t('OPEN', 'Open')} ${t('HOUR', 'Hour')}`}
                          boundary='open'
                          unit='hour'
                          lapseIndex='manual'
                        >
                          <DefaultSelect
                            className='od-schedule-time-select'
                            noSelected
                            options={hourOptions.current}
                            defaultValue={addScheduleTime?.open?.hour}
                            onChange={val => handleChangeAddScheduleTime(val, true, 'hour')}
                            optionInnerMaxHeight='300px'
                          />
                        </SelectWrapper>
                        <SelectWrapper
                          role='group'
                          aria-label={`${daysOfWeek[daysOfWeekIndex]} ${t('OPEN', 'Open')} ${t('MINUTE', 'Minute')}`}
                          boundary='open'
                          unit='minute'
                          lapseIndex='manual'
                        >
                          <DefaultSelect
                            className='od-schedule-time-select'
                            noSelected
                            options={minuteOptions.current}
                            defaultValue={addScheduleTime?.open?.minute}
                            onChange={val => handleChangeAddScheduleTime(val, true, 'minute')}
                            optionInnerMaxHeight='300px'
                          />
                        </SelectWrapper>
                        <SplitLine />
                        <SelectWrapper
                          role='group'
                          aria-label={`${daysOfWeek[daysOfWeekIndex]} ${t('CLOSE', 'Close')} ${t('HOUR', 'Hour')}`}
                          boundary='close'
                          unit='hour'
                          lapseIndex='manual'
                        >
                          <DefaultSelect
                            className='od-schedule-time-select'
                            noSelected
                            options={hourOptions.current}
                            defaultValue={addScheduleTime?.close?.hour}
                            onChange={val => handleChangeAddScheduleTime(val, false, 'hour')}
                            optionInnerMaxHeight='300px'
                          />
                        </SelectWrapper>
                        <SelectWrapper
                          role='group'
                          aria-label={`${daysOfWeek[daysOfWeekIndex]} ${t('CLOSE', 'Close')} ${t('MINUTE', 'Minute')}`}
                          boundary='close'
                          unit='minute'
                          lapseIndex='manual'
                        >
                          <DefaultSelect
                            className='od-schedule-time-select'
                            noSelected
                            options={minuteOptions.current}
                            defaultValue={addScheduleTime?.close?.minute}
                            onChange={val => handleChangeAddScheduleTime(val, false, 'minute')}
                            optionInnerMaxHeight='300px'
                          />
                        </SelectWrapper>
                        <AddScheduleIconWrapper>
                          <IconButton
                            type='button'
                            aria-label={`${t('APPLY', 'Apply')} ${t('SCHEDULE', 'Schedule')}: ${daysOfWeek[daysOfWeekIndex]}`}
                            data-schedule-action='apply-manual'
                            onClick={() => handleAddSchedule(daysOfWeekIndex)}
                          >
                            <PlusCircleFill />
                          </IconButton>
                          <IconButton
                            type='button'
                            aria-label={`${t('CANCEL', 'Cancel')} ${t('SCHEDULE', 'Schedule')}: ${daysOfWeek[daysOfWeekIndex]}`}
                            data-schedule-action='cancel-manual'
                            onClick={() => handleOpenAddSchedule(null)}
                          >
                            <DashCircleFill />
                          </IconButton>
                        </AddScheduleIconWrapper>
                      </LapseRow>
                    )}
                  </div>
                  )
                : (
                  <div className='days od-schedule-lapses'>
                    <p>{t('UNAVAILABLE', 'Unavailable')}</p>
                  </div>
                  )}
              {!disableSchedule && (
                <div className='icons od-schedule-actions'>
                  <IconWrapper
                    isHide={!schedule?.enabled}
                  >
                    <IconButton
                      type='button'
                      aria-label={`${t('ADD', 'Add')} ${t('SCHEDULE', 'Schedule')}: ${daysOfWeek[daysOfWeekIndex]}`}
                      data-schedule-action='add'
                      onClick={() => handleAddSchedule(daysOfWeekIndex)}
                    >
                      <PlusSquare />
                    </IconButton>
                  </IconWrapper>
                  <ScheduleCopyTimes
                    label={`${t('COPY_TIMES_TO', 'Copy times to')}: ${daysOfWeek[daysOfWeekIndex]}`}
                    disabled={!schedule?.enabled}
                    cleanSelectedCopyDays={cleanSelectedCopyDays}
                    open={isOpenCopytimes === daysOfWeekIndex}
                    daysOfWeekIndex={daysOfWeekIndex}
                    onClick={setIsOpenCopytimes}
                    onClose={() => setIsOpenCopytimes(null)}
                    selectedCopyDays={selectedCopyDays}
                    handleSelectDays={(value) => handleSelectCopyTimes(value)}
                    handleApplyScheduleCopyTimes={handleApplyScheduleCopyTimes}
                  />
                </div>
              )}
            </div>
          </TimeScheduleItemContainer>
        ))}
      </ScheduleContainer>
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
      <Confirm
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const Schedule = (props) => {
  const scheduleProps = {
    ...props,
    UIComponent: ScheduleUI
  }
  return (
    <ScheduleController {...scheduleProps} />
  )
}
