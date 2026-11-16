import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage, useConfig, useUtils, Appointments as AppointmentsController } from '../../../../../index'
// redesign W1-7 (T1-7-4, b): the header is P/PageHeader with the business selector as its action; Lucide icons; EmptyState without a business
// redesign (decision 7): the error state is an EmptyState (tone error); the empty period is an InlineNotice (tone info) that
// the toolbar draws (R1-02), so the page only tells it through AppointmentsToolbarContext
import { Button, EmptyState, IconButton, PageHeader } from '../../Shared/Product'
import { Menu as MenuIcon, ChevronDown, Store } from '../../Shared/Icon'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { BusinessSelectHeader } from '../../Stores/BusinessSelectHeader'
import moment from 'moment'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
// the view components carry the statics (`range`, `navigate`, `title`) rbc asks of a view; the page reads their `range` to know what is on screen
import MonthView from 'react-big-calendar/lib/Month'
import WeekView from 'react-big-calendar/lib/Week'
import DayView from 'react-big-calendar/lib/Day'
// redesign W1-7 (T1-7-4): the dragAndDrop sheet is gone (the calendar has no dragging)
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { buildCalendarFormats, uses24Hours } from './calendarFormats'
import { AppointmentsToolbarContext, CalendarHeader, TimeGridDayHeader } from './CalendarHeader'
import { EventComponent, MonthEventComponent, MonthEventRows } from './EventComponent'
import { AppointmentsListView } from './AppointmentsListView'
import { filterByProfessional, professionalOptions } from './professionalFilter'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { OrderDetails } from '../OrderDetails'
import { SpinnerLoader } from '../../Shared'
import { nowWallDate, resolveTimeZone, timeZoneNote, zoneWallDate } from '../../../../../utils/timeZone'

import {
  Container,
  SpinnerLoaderWrapper,
  BusinessPicker,
  CalendarWrapper
} from './styles'

const localizer = momentLocalizer(moment)
// BusinessSelectHeader's own fields, and the store's zone
const BUSINESS_FIELDS = ['name', 'slug', 'logo', 'city', 'timezone']

// redesign (decision 4): Month, Week, Day and the custom List view, in this order (the toolbar draws one option per name)
const CALENDAR_VIEWS = { month: true, week: true, day: true, list: AppointmentsListView }
const VIEW_COMPONENTS = { month: MonthView, week: WeekView, day: DayView, list: AppointmentsListView }
// redesign (decision 5): where week and day start when no appointment is in the visible range
const DEFAULT_SCROLL_HOUR = 8

// The visible range of a view as whole days, `{ start, end }`. rbc's views answer with a list of days (week, day) or `{ start, end }`
// (month, List); both go from the first instant of the first day to the last instant of the last one.
export const rangeOf = (range, localizer) => {
  const days = Array.isArray(range) ? range : [range?.start, range?.end]
  return {
    start: localizer.startOf(days[0], 'day'),
    end: localizer.endOf(days[days.length - 1], 'day')
  }
}

const isInRange = (date, range) => date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime()

// redesign (decision 5): the hour on the dot of the earliest appointment of the visible `range` (the earliest time of day,
// so the topmost appointment of the grid is in view), 08:00 when none. A Date on a fixed day, as rbc's `scrollToTime` asks.
export const earliestScrollTime = (events, startAccessor, range) => {
  let hour = DEFAULT_SCROLL_HOUR
  let found = false
  ;(events || []).forEach(event => {
    const start = startAccessor(event)
    if (!isInRange(start, range)) return
    if (!found || start.getHours() < hour) hour = start.getHours()
    found = true
  })
  return new Date(1970, 0, 1, hour, 0)
}

const AppointmentsUI = (props) => {
  const {
    selectedBusiness,
    setSelectedBusiness,
    businessCalendarEvents,
    refreshCalendarEvents
  } = props

  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate }] = useUtils()

  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [showSelectHeader, setShowSelectHeader] = useState(false)
  const [openDetails, setOpenDetails] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  // redesign C1a (W1-QC1-07, W1-PC1-05): ONE rule for the gutter and the events: 12 h only with format_time '12', otherwise 24 h
  const is24Hours = uses24Hours(configs)
  const languageCode = languageState?.language?.code
  // redesign W1-7 (T1-7-4, W0-F-01): words from Intl (via parseDate), gutter and events by format_time (C1a: same clock)
  const formats = useMemo(
    () => buildCalendarFormats({ parseDate, languageCode, is24Hours }),
    [parseDate, languageCode, is24Hours]
  )

  // the calendar draws the store's zone (business.timezone). rbc only draws browser Dates, so each time becomes a Date with
  // the digits of the store's wall clock; with no zone on the store it is today's flow (parseDate, the browser's zone), and it says so.
  const timeZone = useMemo(() => resolveTimeZone(selectedBusiness?.timezone), [selectedBusiness?.timezone])
  const zone = timeZone.zone
  const wallDate = useCallback(
    time => (timeZone.fallback ? moment(parseDate(time, { outputFormat: 'YYYY-MM-DD HH:mm:ss' })).toDate() : zoneWallDate(time, zone)),
    [parseDate, timeZone, zone]
  )
  const getNow = useCallback(() => nowWallDate(zone), [zone])

  // redesign (decision 5): `date` and `view` are the page's, so the visible range is always known (rbc does not call
  // onRangeChange on the first paint, and after a drill-down from a day number it answers with the range of the view it left)
  const [date, setDate] = useState(() => nowWallDate(zone))
  // a store in another zone opens on its own today
  useEffect(() => { setDate(nowWallDate(zone)) }, [zone])
  // redesign (n.º 6, P-1): on a phone (< 768px, the width this page already uses) the agenda opens in List; only the first paint
  // reads the width, so a resize later switches nothing and the user still picks Month, Week or Day
  const isPhone = useIsPhone()
  const [view, setView] = useState(() => (isPhone ? 'list' : Views.MONTH))
  const visibleRange = useMemo(
    () => rangeOf(VIEW_COMPONENTS[view].range(date, { localizer }), localizer),
    [view, date]
  )
  const startAccessor = useCallback(event => wallDate(event.start), [wallDate])
  const endAccessor = useCallback(event => wallDate(event.end), [wallDate])
  const loadedEvents = businessCalendarEvents.result
  // redesign apply-list row 23 (appointments P-2): the professional filter lives in the page, not in the URL. `professional` is the
  // chosen `{ value, label }` or null (All); it is kept when that professional is no longer among the loaded events (the empty state
  // tells it, nothing switches by itself) and goes back to All with the business.
  const [professional, setProfessional] = useState(null)
  useEffect(() => { setProfessional(null) }, [selectedBusiness?.id])
  const professionalChoices = useMemo(() => professionalOptions(loadedEvents, languageCode), [loadedEvents, languageCode])
  // every consumer below (calendar, List view, empty period, first hour) reads the filtered list
  const events = useMemo(() => filterByProfessional(loadedEvents, professional?.value), [loadedEvents, professional])
  const professionalFilter = useMemo(() => {
    if (!professional && professionalChoices.length === 0) return null
    const options = !professional || professionalChoices.some(option => option.value === professional.value)
      ? professionalChoices
      : [...professionalChoices, professional]
    return {
      options,
      value: professional?.value ?? '',
      onChange: value => setProfessional(options.find(option => option.value === value) ?? null)
    }
  }, [professionalChoices, professional])
  const hasAppointmentsInRange = (events || []).some(event => isInRange(startAccessor(event), visibleRange))
  // rbc 1.20 reads scrollToTime only when the time grid mounts: it is passed for that first paint and the effect below repeats it
  const scrollTime = useMemo(
    () => earliestScrollTime(events, startAccessor, visibleRange),
    [events, startAccessor, visibleRange]
  )
  const scrollHour = scrollTime.getHours()

  // redesign (R1-02, R1-06): the notice is the toolbar's, and says «empty» only about a finished result that belongs to the
  // business on screen (`businessId` comes from the controller; null before the first answer, so the first paint says nothing)
  const emptyPeriod = !businessCalendarEvents.loading &&
    !businessCalendarEvents.error &&
    selectedBusiness?.id != null &&
    businessCalendarEvents.businessId === selectedBusiness.id &&
    !hasAppointmentsInRange
  const toolbarContext = useMemo(() => ({ emptyPeriod, professional: professionalFilter, wallDate }), [emptyPeriod, professionalFilter, wallDate])

  // redesign (decisions 7): the error replaces the calendar only once the load is over
  // redesign (R1-04): ...but after the user presses Retry it stays mounted while it loads (the controller clears the error
  // then), so the Retry button is the same node and keeps the focus; it is `aria-disabled`, never `disabled` (which drops the focus)
  const [retrying, setRetrying] = useState(false)
  const retrySawLoading = useRef(false)
  const focusCalendarAfterRetry = useRef(false)
  const showError = Boolean(businessCalendarEvents.error) && !businessCalendarEvents.loading
  const showErrorState = showError || (retrying && businessCalendarEvents.loading)
  const showCalendar = Boolean(selectedBusiness && !showErrorState)
  const calendarRef = useRef(null)
  // another business: the retry is no longer about what is on screen
  useEffect(() => {
    retrySawLoading.current = false
    focusCalendarAfterRetry.current = false
    setRetrying(false)
  }, [selectedBusiness?.id])
  // the retry is over once a load that started after the click has finished
  useEffect(() => {
    if (!retrying) return
    if (businessCalendarEvents.loading) retrySawLoading.current = true
    else if (retrySawLoading.current) {
      retrySawLoading.current = false
      setRetrying(false)
    }
  }, [retrying, businessCalendarEvents.loading])
  // a retry that succeeds: the Retry button is gone, so the focus goes to the calendar region (a retry that fails keeps it on Retry)
  useEffect(() => {
    if (!focusCalendarAfterRetry.current || !showCalendar || businessCalendarEvents.loading) return
    focusCalendarAfterRetry.current = false
    calendarRef.current?.focus({ preventScroll: true })
  }, [showCalendar, businessCalendarEvents.loading])
  const handleRetry = () => {
    if (businessCalendarEvents.loading) return
    focusCalendarAfterRetry.current = true
    setRetrying(true)
    refreshCalendarEvents()
  }
  useEffect(() => {
    if (!showCalendar || (view !== Views.WEEK && view !== Views.DAY)) return
    const content = calendarRef.current?.querySelector('.rbc-time-content')
    if (content) content.scrollTop = content.scrollHeight * scrollHour / 24
  }, [showCalendar, selectedBusiness?.id, events, view, visibleRange, scrollHour])

  const changeBusinessState = (business) => {
    setShowSelectHeader(false)
    setSelectedBusiness(business)
  }

  // redesign C1a (W1-QC1-02): closing the appointment's panel (Esc included) returns the focus to the event that opened it
  const returnFocusRef = useRef(null)
  const handleOpenDetails = (event) => {
    returnFocusRef.current = document.activeElement
    setOpenDetails(true)
    setSelectedAppointment(event)
  }
  const handleCloseDetails = () => {
    setOpenDetails(false)
    setSelectedAppointment(null)
    const opener = returnFocusRef.current
    returnFocusRef.current = null
    if (opener && opener !== document.body) {
      requestAnimationFrame(() => { if (opener.isConnected) opener.focus({ preventScroll: true }) })
    }
  }
  // redesign C1a (W1-QC1-02): Enter and Space on an event open it, as a click does (rbc only calls this from an event's own keydown)
  const handleEventKeyPress = (event, keyboardEvent) => {
    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ' || keyboardEvent.key === 'Spacebar') {
      keyboardEvent.preventDefault()
      handleOpenDetails(event)
    }
  }
  // redesign C1a (W1-QC1-02, -09): the month's event is focusable; the week and day headers are plain text, not columnheaders in a button
  const calendarComponents = useMemo(() => ({
    toolbar: CalendarHeader,
    event: EventComponent,
    month: { event: MonthEventComponent, weekWrapper: MonthEventRows },
    week: { header: TimeGridDayHeader },
    day: { header: TimeGridDayHeader }
  }), [])

  return (
    <Container className='odc-root'>
      {businessCalendarEvents.loading && (
        <SpinnerLoaderWrapper role='status' aria-live='polite' aria-label={t('LOADING', 'Loading')}>
          <SpinnerLoader />
        </SpinnerLoaderWrapper>
      )}
      {/* the opener is PageHeader's `leading`; the business selector is the header's action */}
      <PageHeader
        leading={isCollapse && (
          <IconButton
            icon={MenuIcon}
            label={t('OPEN_MENU', 'Open menu')}
            onClick={() => handleMenuCollapse(false)}
          />
        )}
        // redesign (decision 1): the plural title, with no «Calendar» crumb under it
        title={t('APPOINTMENTS', 'Appointments')}
        description={selectedBusiness ? timeZoneNote(timeZone, t) : undefined} //
        // main: appointments are for every project; no `appointments` config gates the screen
        actions={(
          <BusinessPicker>
            <Button
              icon={Store}
              iconEnd={ChevronDown}
              aria-haspopup='true'
              aria-expanded={showSelectHeader}
              title={selectedBusiness?.name}
              onClick={() => setShowSelectHeader(!showSelectHeader)}
            >
              <span className='business-name'>{selectedBusiness?.name || t('SELECT_BUSINESS', 'Select a business')}</span>
            </Button>
            {showSelectHeader && (
              <BusinessSelectHeader
                close={() => setShowSelectHeader(false)}
                isOpen={showSelectHeader}
                changeBusinessState={changeBusinessState}
                defaultPropsToFetch={BUSINESS_FIELDS}
              />
            )}
          </BusinessPicker>
        )}
      />

      {!selectedBusiness
      // redesign W1-7 (T1-7-4, b, proposal): without a business there is nothing to draw, so the screen asks for one. Nothing is picked for the user.
        ? (
          <EmptyState
            icon={Store}
            title={t('APPOINTMENTS_SELECT_BUSINESS', 'Select a business to see its appointments')}
            action={(
              // redesign C1a (W1-QC1-03, W1-PC1-10): like the header's trigger it says it opens a popup and whether it is open
              // (aria-controls waits for the id of the dropdown, which BusinessSelectHeader owns: C1b)
              <Button aria-haspopup='true' aria-expanded={showSelectHeader} onClick={() => setShowSelectHeader(true)}>
                {t('SELECT_BUSINESS', 'Select a business')}
              </Button>
            )}
          />
          )
        : showErrorState
        // redesign (decision 7): the error keeps the calendar's place and offers the retry the controller already has
          ? (
          <EmptyState
            tone='error'
            title={t('APPOINTMENTS_LOAD_ERROR', "We couldn't load the appointments.")}
            description={t('APPOINTMENTS_LOAD_ERROR_HINT', 'Check the connection and try again.')}
            action={(
              // redesign (R1-04): while the retry loads it is aria-disabled with no action (not `disabled`, which drops the focus)
              <Button
                busy={businessCalendarEvents.loading}
                aria-disabled={businessCalendarEvents.loading ? 'true' : undefined}
                onClick={handleRetry}
              >
                {t('RETRY', 'Retry')}
              </Button>
            )}
          />
            )
          : (
        // redesign (R1-04): tabIndex -1 so the page can send the focus here after a successful retry
        <CalendarWrapper ref={calendarRef} role='region' tabIndex={-1} aria-label={t('CALENDAR', 'Calendar')}>
          <AppointmentsToolbarContext.Provider value={toolbarContext}>
            <Calendar
              localizer={localizer}
              formats={formats}
              date={date}
              getNow={getNow}
              view={view}
              onNavigate={setDate}
              onView={setView}
              events={events}
              startAccessor={startAccessor}
              endAccessor={endAccessor}
              views={CALENDAR_VIEWS}
              scrollToTime={scrollTime}
              showMultiDayTimes={false}
              messages={{
                showMore: total => `+${total} ${t('MORE', 'More')}`
              }}
              onSelectEvent={event => handleOpenDetails(event)}
              onKeyPressEvent={handleEventKeyPress}
              components={calendarComponents}
            />
          </AppointmentsToolbarContext.Provider>
        </CalendarWrapper>
            )}

      {openDetails && (
        <OrderDetails
          isServiceOrder
          open={openDetails}
          orderId={selectedAppointment?.order_id}
          onClose={handleCloseDetails}
        />
      )}
    </Container>
  )
}

export const Appointments = (props) => {
  const appointmentsProps = {
    ...props,
    UIComponent: AppointmentsUI
  }
  return <AppointmentsController {...appointmentsProps} />
}
