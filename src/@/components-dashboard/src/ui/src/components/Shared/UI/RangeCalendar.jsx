import React, { useEffect, useId, useLayoutEffect, useState, useRef } from 'react'
import { useLanguage } from '../../../../../index'
import moment from 'moment'
import { DateRange, Calendar } from 'react-date-range'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'
import { CalendarDays as Calendar4 } from '../Icon'
import { Button } from '../../../styles/Buttons'
import { Container, CalendarWrapper } from './range-calendar-styles'
import * as locales from 'react-date-range/dist/locale'
import { getLocale } from '../../../utils/getLocale'

export const RangeCalendar = (props) => {
  const {
    handleChangeDate,
    defaultValue,
    isLeft,
    isSingleDate,
    withTime,
    minDate
  } = props

  const [state, t] = useLanguage()
  const [dateRange, setDateRange] = useState([
    {
      startDate: null,
      endDate: null,
      key: 'selection'
    }
  ])
  const [date, setDate] = useState(null)
  const [isShowCalendar, setIsShowCalendar] = useState(false)
  const calendarRef = useRef()
  const buttonOpenCalendarRef = useRef()
  const calendarId = useId()
  const calendarAriaLabels = {
    dateInput: {
      selection: {
        startDate: t('START_DATE', 'Start date'),
        endDate: t('END_DATE', 'End date')
      }
    },
    monthPicker: t('MONTH', 'Month'),
    yearPicker: t('YEAR', 'Year'),
    prevButton: t('PREVIOUS_MONTH', 'Previous month'),
    nextButton: t('NEXT_MONTH', 'Next month')
  }

  const handleClickOutside = (e) => {
    const outsideCalendar = !calendarRef.current?.contains(e.target) && !buttonOpenCalendarRef.current?.contains(e.target)
    if (outsideCalendar) {
      setIsShowCalendar(false)
    }
  }

  const handleOpenCalendar = (evt) => {
    evt.preventDefault()
    setIsShowCalendar(!isShowCalendar)
  }

  const handleChangeSingleDate = (dateTime) => {
    const dateFormat = withTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
    handleChangeDate && handleChangeDate(moment(dateTime).format(dateFormat))

    setDate(dateTime)
  }

  const handleChangeDates = (item) => {
    if (item.selection?.startDate && item.selection?.endDate) {
      const dateFormat = withTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
      handleChangeDate(moment(item.selection.startDate).format(dateFormat), moment(item.selection.endDate).format(dateFormat))
    }

    setDateRange([item.selection])
  }

  const rangeFormat = (date1, date2) => {
    let formattedDate = `${moment(date1).format('YYYY-MM-DD')}~${moment(date2).format('YYYY-MM-DD')}`
    if (moment(date1).format('YYYY') === moment(date2).format('YYYY')) {
      if (moment(date1).format('MM') === moment(date2).format('MM')) formattedDate = `${moment(date1).format('DD')} - ${moment(date2).format('DD')} ${moment(date2).format('MMM')}, ${moment(date1).format('YYYY')}`
      else formattedDate = `${moment(date1).format('MM-DD')} ~ ${moment(date2).format('MM-DD')}, ${moment(date1).format('YYYY')}`
    }
    return formattedDate
  }

  const dateFormat = (dateTime) => {
    return `${moment(dateTime).format('DD')} ${moment(dateTime).format('MMM')}, ${moment(dateTime).format('YYYY')}`
  }

  useEffect(() => {
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  useLayoutEffect(() => {
    if (!isShowCalendar || !calendarRef.current) return undefined
    const keepCalendarInViewport = () => {
      const panel = calendarRef.current
      if (!panel) return
      panel.style.removeProperty('left')
      panel.style.removeProperty('right')
      const bounds = panel.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth
      let ancestor = panel.parentElement
      let usesViewportCoordinates = false
      while (ancestor && ancestor !== document.documentElement) {
        if (window.getComputedStyle(ancestor).position === 'fixed') {
          usesViewportCoordinates = true
          break
        }
        ancestor = ancestor.parentElement
      }
      const scrollX = usesViewportCoordinates ? 0 : (window.scrollX ?? window.pageXOffset ?? 0)
      const measuredLeft = bounds.left + scrollX
      const measuredRight = bounds.right + scrollX
      if (measuredLeft >= 0 && measuredRight <= viewportWidth) return
      const targetLeft = Math.max(0, Math.min(measuredLeft, viewportWidth - bounds.width))
      const scale = panel.offsetWidth ? bounds.width / panel.offsetWidth : 1
      const layoutLeft = panel.offsetLeft + ((targetLeft - measuredLeft) / scale)
      panel.style.left = `${layoutLeft}px`
      panel.style.right = 'auto'
    }
    keepCalendarInViewport()
    window.addEventListener('resize', keepCalendarInViewport)
    return () => window.removeEventListener('resize', keepCalendarInViewport)
  }, [isShowCalendar])

  useEffect(() => {
    if (!isShowCalendar) return undefined
    const closeCalendarWithKeyboard = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setIsShowCalendar(false)
      buttonOpenCalendarRef.current?.focus()
    }
    window.addEventListener('keydown', closeCalendarWithKeyboard, true)
    return () => window.removeEventListener('keydown', closeCalendarWithKeyboard, true)
  }, [isShowCalendar])

  useEffect(() => {
    if (isSingleDate && defaultValue) {
      setDate(new Date(defaultValue))
      return
    }

    if (defaultValue && defaultValue?.from !== '' && defaultValue?.to !== '') {
      setDateRange([
        {
          startDate: new Date(defaultValue?.from),
          endDate: new Date(defaultValue?.to),
          key: 'selection'
        }
      ])
    }
  }, [defaultValue])

  return (
    <Container>
      <Button
        type='button'
        onClick={handleOpenCalendar}
        borderRadius='8px'
        color='secundary'
        ref={buttonOpenCalendarRef}
        className='ordering-calendar-btn'
        aria-expanded={isShowCalendar}
        aria-haspopup='dialog'
        aria-controls={isShowCalendar ? calendarId : undefined}
      >
        <Calendar4 />
        {!isSingleDate && (dateRange[0].startDate ? rangeFormat(dateRange[0].startDate, dateRange[0].endDate) : t('SELECT_DATE_RANGE', 'Select Date Range'))}
        {isSingleDate && (date ? dateFormat(date) : t('SELECT_DATE', 'Select a date'))}
      </Button>
      {
        isShowCalendar && (
          <CalendarWrapper
            id={calendarId}
            ref={calendarRef}
            isLeft={isLeft}
            role='dialog'
            aria-label={isSingleDate ? t('SELECT_DATE', 'Select a date') : t('SELECT_DATE_RANGE', 'Select Date Range')}
          >
            {isSingleDate
              ? (
              <Calendar
                ariaLabels={calendarAriaLabels}
                locale={getLocale(state?.language?.code, locales)}
                date={date}
                onChange={(date) => handleChangeSingleDate(date)}
                minDate={minDate || new Date('1922-01-01')}
              />
                )
              : (
              <DateRange
                ariaLabels={calendarAriaLabels}
                editableDateInputs
                locale={getLocale(state?.language?.code, locales)}
                onChange={item => handleChangeDates(item)}
                moveRangeOnFirstSelection={false}
                ranges={dateRange}
                minDate={minDate || new Date('1922-01-01')}
                startDatePlaceholder={t('EARLY', 'Early')}
                endDatePlaceholder={t('CONTINUOUS', 'Continuous')}
              />
                )}
          </CalendarWrapper>
        )
      }
    </Container>
  )
}

RangeCalendar.displayName = 'OrderingRangeCalendar'
