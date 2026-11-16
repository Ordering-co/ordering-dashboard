import React, { createContext, useContext, useEffect, useRef } from 'react'
import { useLanguage } from '../../../../../index'
import { navigate } from 'react-big-calendar/lib/utils/constants'
// redesign W1-7 (T1-7-4, b): Product icon buttons (aria-label and title as the name) and Lucide icons replace the legacy IconButton,
// the react-bootstrap tooltips and the react-bootstrap-icons / meronex glyphs.
// redesign (decision 3): «Today» is a Product Button and the views are a Product SegmentedControl (text options, no icons).
// redesign (R1-02): the empty-period notice is an InlineNotice in the gap of the bar.
import { Button, IconButton, InlineNotice, SegmentedControl } from '../../Shared/Product'
import { ChevronLeft, ChevronRight } from '../../Shared/Icon'
import { ProfessionalSelect } from './ProfessionalSelect'

import {
  CalendarHeaderContainer,
  CalendarLabelContainer,
  ToolbarNoticeSlot,
  ViewSwitch
} from './styles'

// redesign (R1-02): what the page tells its toolbar. rbc builds the toolbar itself (`components.toolbar`), so the page cannot
// hand it props: it provides this context instead. `emptyPeriod` is true when the visible range has no appointments of the chosen business.
// redesign apply-list row 23 (appointments P-2): `professional` is `{ options: [{ value, label }], value, onChange(value) }` when the loaded
// appointments carry professionals (`value` '' is «All professionals»), null otherwise; with a professional chosen the empty period says so.
// `wallDate` turns an API time into the Date the calendar draws (the store's wall clock); the events read it too
export const AppointmentsToolbarContext = createContext({ emptyPeriod: false, professional: null, wallDate: null })

// redesign C1a (W1-QC1-09): the header of a day in the week and day views. rbc's own puts role=columnheader on a span INSIDE the
// day's button, which no row owns (axe aria-required-parent); the text is all that belongs there. Month keeps rbc's header (its
// weekday names are columnheaders of a real row).
export const TimeGridDayHeader = ({ label }) => <span>{label}</span>

export const CalendarHeader = (props) => {
  const {
    label,
    view,
    views,
    onView,
    onNavigate
  } = props

  const [, t] = useLanguage()
  const { emptyPeriod, professional } = useContext(AppointmentsToolbarContext)

  // redesign C1a (W1-QC1-05): going down to Day from a day number or a «+N more» removes the button that had the focus (rbc
  // unmounts the month), and the focus fell to <body>. When the view changes and the focus is lost, it goes to the pressed view
  // (the segmented control's option with aria-pressed, or its <select> when the options did not fit).
  const rootRef = useRef(null)
  const previousView = useRef(view)
  useEffect(() => {
    if (previousView.current === view) return
    previousView.current = view
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    rootRef.current?.querySelector('[aria-pressed="true"], select.odc-seg-select')?.focus()
  }, [view])

  const viewsList = {
    month: { title: t('MONTH', 'Month') },
    week: { title: t('WEEK', 'Week') },
    work_week: { title: t('WORK_WEEK', 'Work week') },
    day: { title: t('DAY', 'Day') },
    agenda: { title: t('AGENDA', 'Agenda') },
    list: { title: t('LIST', 'List') }
  }

  return (
    <CalendarHeaderContainer ref={rootRef}>
      {/* redesign (R1-02): «Today» · ‹ · › · label, as Google Calendar: the buttons keep their place whatever the label's width */}
      <CalendarLabelContainer>
        <Button className='today' onClick={() => onNavigate(navigate.TODAY)}>{t('TODAY', 'Today')}</Button>
        <IconButton
          icon={ChevronLeft}
          flipInRtl
          label={t('PREVIOUS', 'Previous')}
          onClick={() => onNavigate(navigate.PREVIOUS)}
        />
        <IconButton
          icon={ChevronRight}
          flipInRtl
          label={t('NEXT', 'Next')}
          onClick={() => onNavigate(navigate.NEXT)}
        />
        <span className='label' aria-live='polite'>{label}</span>
      </CalendarLabelContainer>
      {/* the gap exists even with no notice, so the notice moves nothing; below 768px it is the third row, under the views */}
      <ToolbarNoticeSlot data-toolbar-notice>
        {emptyPeriod && (
          <InlineNotice tone='info'>
            {professional?.value
              ? t('APPOINTMENTS_EMPTY_PERIOD_PROFESSIONAL', 'No appointments for this professional.')
              : t('APPOINTMENTS_EMPTY_PERIOD', 'No appointments in this period.')}
          </InlineNotice>
        )}
      </ToolbarNoticeSlot>
      {/* redesign apply-list row 23 (appointments P-2): between the gap and the views; its own row under the views on a phone */}
      {professional && <ProfessionalSelect professional={professional} />}
      <ViewSwitch>
        <SegmentedControl
          label={t('CALENDAR_VIEW', 'Calendar view')}
          value={view}
          onValueChange={onView}
          options={views.map((name) => ({ value: name, label: viewsList[name]?.title ?? name }))}
        />
      </ViewSwitch>
    </CalendarHeaderContainer>
  )
}
