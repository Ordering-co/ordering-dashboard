import React, { useEffect, useMemo, useRef } from 'react'

import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useAdvancedReport } from '../../../../../components/AdvancedReports/useAdvancedReport'
import { DatePicker, DateRangePopover, FilterPill, IconButton, Menu, PageHeader, useProductDir } from '../../Shared/Product'
import { Calendar, Menu as MenuIcon } from '../../Shared/Icon'
import { ADVANCED_REPORTS, ADVANCED_REPORT_GROUPS, GROUP_TEXTS, REPORT_TEXTS } from '../../../../../utils/advancedReports'
import { REPORT_RANGE_PRESETS, presetOf, presetRange } from '../../../../../utils/reportPeriods'
import { describeDateFormat, formatDay, todayDay } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { ReportFilterPills } from '../AnalyticsKit'
import { distanceUnitOf } from '../AnalyticsKit/pivotFormat'
import { ReportBody } from './ReportBody'
import { usePeriodText } from './usePeriodText'
import { barCountryCode, barFilters, effectiveFilters, findPeriodUnit, mergeBarFilters } from './reportFilters'
import './reports.css'

// redesign reports FC1 (D1, D3, D4, D5, D9; RP-08, RP-11, RP-12; auditor 7, 16): a report opened in the page. The header (back, title,
// description, «Switch report»), the bar of filters with the period (or, in report 7, its day) first, the line of dates, and the body of
// lot C2. It owns nothing the user chose: the filters, the country and the day are the page's (index.js), so changing report keeps them.
// The page mounts this view with `key={report.id}`: the data hook and the body start empty for each report, and `useAdvancedReport`
// keeping the answer of the previous load while the next one comes (`updating`) never paints the data of another report.

// redesign reports FC1 (D3): the preset ranges, labelled as Business reports does (not the shared LAST_7_DAYS: the API's catalog has «Last 7 dyas»)
const presetLabels = (t) => ({
  today: t('TODAY', 'Today'),
  yesterday: t('YESTERDAY', 'Yesterday'),
  last_7_days: t('BUSINESS_REPORTS_LAST_7_DAYS', 'Last 7 days'),
  last_30_days: t('BUSINESS_REPORTS_LAST_30_DAYS', 'Last 30 days')
})

const useDateParts = () => {
  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const spec = describeDateFormat(dateFormat)
  // the project's date format (decision 13); the plain formatter only stands in where the host gives no `parseDate`
  const shown = (day) => (parseDate ? parseDate(day, { dateOnly: true, inputFormat: 'YYYY-MM-DD', utc: false }) : formatDay(day, spec))
  return { t, locale: languageState?.language?.code, dateFormat, shown }
}

/**
 * The Period pill: the four presets and a custom range in the range popover. A preset applies at once; a custom range is a draft until
 * «Done» (RP-07), then it is written once.
 */
// redesign ecommerce FC (D1): exported for the clicks view of /intelligence/ecommerce_reports
export const PeriodPill = ({ from, to, today, onApplyRange }) => {
  const { t, locale, dateFormat, shown } = useDateParts()
  const labels = presetLabels(t)
  const presetValue = presetOf(from, to, today)
  const label = t('BUSINESS_REPORTS_PERIOD', 'Period')
  const value = presetValue ? labels[presetValue] : (from === to ? shown(from) : `${shown(from)} – ${shown(to)}`)

  return (
    <DateRangePopover
      presets={REPORT_RANGE_PRESETS.map(preset => ({ value: preset, label: labels[preset] }))}
      presetValue={presetValue}
      from={from}
      to={to}
      dateFormat={dateFormat}
      triggerText={value}
      labels={{
        title: t('SELECT_DATE', 'Select a date'),
        presets: label,
        close: t('CLOSE', 'Close'),
        done: t('DONE', 'Done'),
        from: t('FROM', 'From'),
        to: t('TO', 'To'),
        today: t('TODAY', 'Today'),
        goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
        previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
        nextMonth: t('NEXT_MONTH', 'Next month'),
        rangeOrder: t('DATE_RANGE_ORDER', 'The start date must not be after the end date.'),
        invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format)
      }}
      locale={locale}
      align='start'
      onPreset={(preset) => {
        const range = presetRange(preset, today)
        if (range) onApplyRange(range)
      }}
      // a range is a draft until «Done» (onApplyRange): the popover never reports it piece by piece
      onRange={() => {}}
      onApplyRange={({ from: nextFrom, to: nextTo }) => {
        const first = nextFrom || nextTo
        if (first) onApplyRange({ from: first, to: nextTo || first })
      }}
      renderTrigger={({ ref, expanded, toggle }) => (
        <span ref={ref} className='odc-orders-pill-anchor'>
          <FilterPill icon={Calendar} label={label} value={value} priority='secondary' hasPopup='dialog' expanded={expanded} onClick={toggle} />
        </span>
      )}
    />
  )
}

/** The day of report 7: one day, in a field shaped as a pill. It starts on today each time the report opens (the page resets it). */
const DayPill = ({ day, onChange }) => {
  const { t, locale, dateFormat } = useDateParts()
  return (
    <DatePicker
      className='odc-rp-day'
      label={t('DAY', 'Day')}
      value={day}
      dateFormat={dateFormat}
      locale={locale}
      labels={{
        title: t('SELECT_DATE', 'Select a date'),
        close: t('CLOSE', 'Close'),
        today: t('TODAY', 'Today'),
        goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
        previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
        nextMonth: t('NEXT_MONTH', 'Next month'),
        invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
        outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.')
      }}
      onChange={(next) => { if (next) onChange(next) }}
    />
  )
}

// the order of the catalog: by group, and inside a group as the registry lists them
const CATALOG_ORDER = ADVANCED_REPORT_GROUPS.flatMap(group => ADVANCED_REPORTS.filter(report => report.group === group))

/**
 * @param {object}   props
 * @param {object}   props.report         An entry of the registry (`ADVANCED_REPORTS`).
 * @param {object}   props.filters        The page's filters (all the keys of `initialFilters`).
 * @param {string}   props.countryCode    The page's country ('' = all).
 * @param {string}   props.scheduleDay    The day of report 7 (`YYYY-MM-DD`).
 * @param {Function} props.onChangeFilters `(updater) => void`: the page's `setFilters`.
 * @param {Function} props.onChangeCode   `(code) => void`: the page's country toggle.
 * @param {Function} props.onChangeDay    `(day) => void`.
 * @param {object}   props.names          The names the filter bar has learned (page state: it survives the change of report, R1 Q-01, Q-03).
 * @param {Function} props.onChangeNames  `(next) => void`: the page's setter of `names`.
 * @param {Function} props.onClearFilters `() => void`: «Clear filters», which clears every filter the page holds (R1 Q-02).
 * @param {Function} props.onBack         «All reports».
 * @param {Function} props.onSwitch       `(id) => void`: another report.
 * @param {boolean}  [props.countryOpensItself] Handed to the bar (D-21): false once the Country pill has opened by itself in this visit. Without it, as always.
 * @param {Function} [props.onCountryOpened]    `() => void`: the Country pill opened by itself.
 * @param {Array}    [props.switchReports] `[{ id, name, groupLabel }]`: the entries of «Switch report», in that order (default: the 21 of the catalog).
 * @param {node}     [props.learn]        The help entry of the header (`PageHeader`'s `learn`).
 */
export const ReportView = ({ report, filters, countryCode, scheduleDay, names, onChangeFilters, onChangeCode, onChangeDay, onChangeNames, onClearFilters, onBack, onSwitch, switchReports, learn, countryOpensItself, onCountryOpened }) => {
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const { rangeText, groupingText } = usePeriodText()
  const dir = useProductDir()
  const headRef = useRef(null)
  const today = todayDay()
  // redesign the distance reports describe themselves in the distance unit of the project
  const [configState] = useConfig() || []
  const texts = REPORT_TEXTS[report.id](t, distanceUnitOf(configState?.configs))
  const isDay = report.pills.includes('day')

  const effective = useMemo(
    () => effectiveFilters(report, filters, scheduleDay),
    [report, filters, scheduleDay]
  )
  // redesign reports FC1 (contract C1/C2): the hook and the body are one pair per report
  const result = useAdvancedReport({
    endpoint: report.endpoint,
    endpoint1: report.endpoint1,
    filters: effective,
    countryCode,
    enabled: true
  })

  // redesign reports FC1 (D1): opening a report puts the focus on its title (the h1 of the header, which takes it with tabindex -1;
  // `headRef` is the page root, whose first h1 is the header's)
  useEffect(() => {
    const title = headRef.current?.querySelector('h1')
    if (!title) return
    title.setAttribute('tabindex', '-1')
    title.focus()
  }, [])

  const unit = useMemo(() => (isDay ? null : (findPeriodUnit(result?.data) ?? findPeriodUnit(result?.data1))), [isDay, result?.data, result?.data1])

  // redesign ecommerce FC (D1): a page that reuses this view gives its own list; without it, the 21 of the catalog as always
  const switchEntries = switchReports ?? CATALOG_ORDER.map(item => ({ id: item.id, name: REPORT_TEXTS[item.id](t).name, groupLabel: GROUP_TEXTS[item.group](t) }))
  const switchItems = switchEntries.map((item, index) => {
    const firstOfGroup = index === 0 || switchEntries[index - 1].groupLabel !== item.groupLabel
    return {
      key: String(item.id),
      type: 'radio',
      checked: item.id === report.id,
      label: item.name,
      // the group is said once, on its first report
      description: firstOfGroup ? item.groupLabel : undefined,
      separatorBefore: firstOfGroup && index > 0,
      onSelect: () => onSwitch(item.id)
    }
  })

  const period = isDay
    ? <DayPill day={scheduleDay} onChange={onChangeDay} />
    : <PeriodPill from={filters.from} to={filters.to} today={today} onApplyRange={(range) => onChangeFilters(current => ({ ...current, ...range }))} />

  return (
    <div ref={headRef} className='odc-root odc-rp-page' data-slot='reports-view' data-report={report.id} dir={dir}>
      <PageHeader
        wideTitle
        title={texts.name}
        description={texts.description}
        backLabel={t('ENTERPRISE_REPORTS_ALL', 'All reports')}
        onBack={onBack}
        learn={learn}
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        actions={<Menu label={t('ENTERPRISE_REPORTS_SWITCH', 'Switch report')} items={switchItems} align='end' />}
      />
      <div className='odc-rp-controls'>
        <ReportFilterPills
          key={report.id}
          filterList={barFilters(report, filters)}
          // the wait of 600 ms is the hook's: the `{ debounce }` of the bar is not needed
          handleChangeFilterList={(next) => onChangeFilters(current => mergeBarFilters(report, current, next))}
          countryCode={barCountryCode(report, countryCode)}
          handleChangeCode={onChangeCode}
          pills={report.pills.filter(pill => pill !== 'period' && pill !== 'day')}
          storesByBrand={report.storesByBrand}
          driversByGroup={report.driversByGroup}
          countryWhenMany
          countryOpensItself={countryOpensItself}
          onCountryOpened={onCountryOpened}
          // redesign reports R1 (Q-01, Q-02, Q-03): the bar is mounted again for each report, so what it has learned (names, drivers of a
          // group) is the page's, and «Clear filters» is the page's too (it also clears the brand a report without that pill hides)
          names={names}
          onNamesChange={onChangeNames}
          onClearFilters={onClearFilters}
          leading={period}
        />
        <p className='odc-rp-period-line'>
          <bdi>{isDay ? rangeText(scheduleDay, scheduleDay) : rangeText(filters.from, filters.to)}</bdi>
          {unit ? ` · ${groupingText(unit)}` : null}
        </p>
      </div>
      <div className='odc-rp-body'>
        <ReportBody report={report} result={result} filters={effective} />
      </div>
    </div>
  )
}
