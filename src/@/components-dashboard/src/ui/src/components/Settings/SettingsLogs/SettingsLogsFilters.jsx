import React from 'react'
import { useLanguage, useConfig, useUtils } from '../../../../../index'
import { Button, ChecklistPopover, DateRangePopover, FilterBar, FilterChips } from '../../Shared/Product'
import { FilterPill } from '../../Shared/Product/FilterBar'
import { pillValue, withoutLeadingLabel } from '../../Shared/Product/filterValueText'
import { Calendar, Settings, UserRound } from '../../Shared/Icon'
import { describeDateFormat, formatDay, formatVisibleDay, shiftDay, todayDay } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'

// the filter bar of Logs Audit, on the pattern of CartRecovery/OpenCartsQueue/QueueFilters: a pill per filter (Setting,
// User, Date), one chip per value and «Clear filters». It holds no state: it shows `filters` ({ configIds, authorIds, from, to },
// days as YYYY-MM-DD) and reports the whole next filters through `onChange`.

const PRESETS = ['today', 'last7', 'last30']
const DAYS_BACK = { today: 0, last7: 6, last30: 29 }

const presetsOf = (t) => [
  { value: 'today', label: t('SETTINGS_LOGS_RANGE_TODAY', 'Today') },
  { value: 'last7', label: t('SETTINGS_LOGS_RANGE_LAST_7_DAYS', 'Last 7 days') },
  { value: 'last30', label: t('SETTINGS_LOGS_RANGE_LAST_30_DAYS', 'Last 30 days') }
]
const presetRange = (key, today) => ({ from: shiftDay(today, -DAYS_BACK[key]), to: today })
/** The preset a range is exactly, 'term' for any other range, 'default' for none. */
const presetOf = ({ from, to }, today) => {
  if (!from && !to) return 'default'
  return PRESETS.find(key => {
    const range = presetRange(key, today)
    return range.from === from && range.to === to
  }) || 'term'
}

const toggled = (ids, id) => (ids.includes(id) ? ids.filter(other => other !== id) : [...ids, id])

export const SettingsLogsFilters = ({ filters, onChange, settings = [], authors }) => {
  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat

  const today = todayDay()
  const presets = presetsOf(t)
  const preset = presetOf(filters, today)
  const dateText = (() => {
    const known = presets.find(item => item.value === preset)
    if (known) return known.label
    const spec = describeDateFormat(dateFormat)
    const shown = (day) => (parseDate ? formatVisibleDay(day, parseDate) : formatDay(day, spec))
    if (filters.from && filters.to) return `${shown(filters.from)} – ${shown(filters.to)}`
    if (filters.from) return `${t('FROM', 'From')} ${shown(filters.from)}`
    if (filters.to) return `${t('TO', 'To')} ${shown(filters.to)}`
    return ''
  })()

  const labels = {
    setting: t('SETTING', 'Setting'),
    user: t('USER', 'User'),
    date: t('DATE', 'Date')
  }
  const settingName = (id) => settings.find(item => item.id === id)?.name
  const authorName = (id) => authors?.items?.find(item => item.id === id)?.name
  const change = (partial) => onChange?.({ ...filters, ...partial })
  const clearAll = () => onChange?.({ configIds: [], authorIds: [], from: null, to: null })
  const hasFilters = Boolean(filters.configIds.length || filters.authorIds.length || dateText)
  const clearText = t('CLEAR_FILTERS', 'Clear filters')

  const chips = []
  const addChip = (key, name, value, patch) => chips.push({
    key,
    label: `${name}: ${value}`,
    removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', `${name} ${value}`),
    onRemove: () => change(patch)
  })
  filters.configIds.forEach(id => addChip(`config-${id}`, labels.setting, withoutLeadingLabel(labels.setting, String(settingName(id) ?? id)), { configIds: filters.configIds.filter(other => other !== id) }))
  filters.authorIds.forEach(id => addChip(`author-${id}`, labels.user, String(authorName(id) ?? id), { authorIds: filters.authorIds.filter(other => other !== id) }))
  if (dateText) addChip('date', labels.date, dateText, { from: null, to: null })

  const searchProps = {
    searchLabel: t('SEARCH', 'Search'),
    clearSearchLabel: t('CLEAR_SEARCH', 'Clear search'),
    loadingLabel: `${t('LOADING', 'Loading')}...`,
    noResultsLabel: t('NO_RESULTS_FOUND', 'No results found'),
    clearLabel: t('CLEAR', 'Clear')
  }

  const datePill = (
    <DateRangePopover
      presets={presets}
      presetValue={preset}
      from={filters.from}
      to={filters.to}
      dateFormat={dateFormat}
      triggerText={dateText || labels.date}
      empty={!dateText}
      locale={languageState?.language?.code}
      align='start'
      labels={{
        title: t('SELECT_DATE', 'Select a date'),
        presets: labels.date,
        close: t('CLOSE', 'Close'),
        done: t('DONE', 'Done'),
        from: t('FROM', 'From'),
        to: t('TO', 'To'),
        today: t('TODAY', 'Today'),
        goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
        previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
        nextMonth: t('NEXT_MONTH', 'Next month'),
        rangeOrder: t('DATE_RANGE_ORDER', 'The start date must not be after the end date.'),
        invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', format)
      }}
      onPreset={(key) => change(presetRange(key, today))}
      // a range is a draft until «Done» (onApplyRange), so the popover never reports it piece by piece
      onRange={() => {}}
      onApplyRange={({ from, to }) => change({ from: from || null, to: to || null })}
      renderTrigger={({ ref, expanded, toggle }) => (
        <span ref={ref} className='odc-orders-pill-anchor'>
          <FilterPill icon={Calendar} label={labels.date} value={dateText} priority='secondary' hasPopup='dialog' expanded={expanded} onClick={toggle} />
        </span>
      )}
    />
  )

  const pills = (
    <>
      <ChecklistPopover
        icon={Settings}
        label={labels.setting}
        value={withoutLeadingLabel(labels.setting, pillValue(filters.configIds, settingName))}
        priority='secondary'
        items={settings}
        selected={filters.configIds}
        onToggle={(id) => change({ configIds: toggled(filters.configIds, id) })}
        onClear={() => change({ configIds: [] })}
        {...searchProps}
      />
      <ChecklistPopover
        icon={UserRound}
        label={labels.user}
        value={pillValue(filters.authorIds, authorName)}
        priority='secondary'
        items={authors?.items ?? []}
        loading={Boolean(authors?.loading)}
        selected={filters.authorIds}
        onToggle={(id) => change({ authorIds: toggled(filters.authorIds, id) })}
        onClear={() => change({ authorIds: [] })}
        {...searchProps}
      />
      {datePill}
    </>
  )

  return (
    <FilterBar
      flush
      label={t('SETTINGS_LOGS_FILTERS', 'Settings logs filters')}
      overflowLabel={(count) => `+${count} ${t('MORE_FILTERS', 'more filters')}`}
      overflowActiveLabel={(count) => t('FILTERS_ACTIVE_COUNT', '_count_ active').replace('_count_', count)}
      clearReserve={clearText}
      filters={pills}
      clear={hasFilters ? <Button variant='ghost' onClick={clearAll}>{clearText}</Button> : undefined}
      chips={chips.length > 0
        ? <FilterChips label={t('FILTERS_ACTIVE', 'Active filters')} clearAllLabel={clearText} onClearAll={clearAll} chips={chips} />
        : undefined}
    />
  )
}
