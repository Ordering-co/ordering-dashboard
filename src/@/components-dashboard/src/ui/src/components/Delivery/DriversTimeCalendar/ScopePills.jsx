import React, { useEffect, useId, useRef, useState } from 'react'

import { DriversGroupsList, DriversList, useLanguage } from '../../../../../index'
import { Bike, Users } from '../../Shared/Icon'
import { Checkbox, FilterPopover, Pagination, PopoverFoot, SearchField, Skeleton, pillValue } from '../../Shared/Product'
import './toolbar.css'

// redesign DT-B4 (DT-05, decision 3 | auditor 10): the scope of the drivers' time calendar, two Product pills for the bar
// (`P/FilterBar` `filters`, without `overflowLabel`: the two stay on the row), with the pattern of BI/AnalyticsKit/ReportPeoplePills.
// Each one is a `FilterPopover` whose body is the UIComponent of the controller of `main`, mounted when the popover opens (the popup
// unmounts on close), so the GET of the groups and of the drivers go out on each opening, as `main` did with its menus.
//
// Driver group: ONE choice (a radio group; «All drivers» first takes the group away, `onGroupChange(null)`), with the number of
// drivers of each group, a server search and the pager of the controller (`getHeaderDriversGroups`). Choosing closes the popover.
// Drivers: a checklist that applies on each check. Without a group the controller pages the drivers of the project and searches by
// name on the server; with a group the controller works by props (`useDriversByProps`, `driversList={selectedGroup}`): the drivers
// are the ones of the group and the search filters them here, as `main` did.
//
// @param {object}   props
// @param {?object}  props.selectedGroup   The group chosen (as the controller listed it, with its `drivers`), or null.
// @param {Function} props.onGroupChange   `(group | null) => void`.
// @param {number[]} props.driverIds       The drivers checked.
// @param {object}   props.driverNames     `{ [id]: name }` the page has learned when a driver was checked (the pill reads it).
// @param {Function} props.onToggleDriver  `(id, name) => void`.
// @param {Function} props.onClearDrivers  `() => void`: «Clear» of the popover.

const POPUP = 'odc-orders-checklist-popup odc-orders-picker-popup'
const GROUP_PAGE_SETTINGS = { initialPage: 1, pageSize: 5, controlType: 'pages' }
const GROUP_FIELDS = ['id', 'enabled', 'drivers', 'name', 'timezone'] // the calendar works in the group's zone
const DRIVER_PAGE_SETTINGS = { initialPage: 1, pageSize: 10, controlType: 'pages' }
const DRIVER_FIELDS = ['id', 'name', 'lastname', 'cellphone', 'photo']
// the wait before the text typed reaches a server search (each change of it is a request)
const SEARCH_DEBOUNCE_MS = 500
const SKELETON_ROWS = 5
const ALL = 'all'

const asList = (value) => (Array.isArray(value) ? value : [])
const fullName = (person) => [person?.name, person?.lastname].filter(Boolean).join(' ')
// the drivers of a group arrive without `lastname` (the group's GET does not ask for it), so two «Driver» looked the same.
// Without a last name a driver shows its email, or «#id», next to the name. Only the label changes: the name the page keeps stays plain.
const hintOf = (person) => (person?.lastname ? '' : (person?.email || `#${person?.id}`))

// «Showing _from_–_to_ of _total_» / «Drivers _count_»: the numbers become .odc-figure nodes (decision 11)
const fill = (template, values, figureOf) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figureOf(values[name])}</React.Fragment> : part
})
const figure = (value) => <bdi className='odc-figure'>{value}</bdi>

// The text typed in a search: sent after a wait (at once on Enter or on clear), `null` when it is empty.
const useTypedSearch = (onSend) => {
  const [query, setQuery] = useState('')
  const timer = useRef(null)
  const latest = useRef(onSend)
  latest.current = onSend
  useEffect(() => () => clearTimeout(timer.current), [])
  const send = (text) => {
    clearTimeout(timer.current)
    latest.current?.(text.trim() || null)
  }
  const type = (text) => {
    setQuery(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => send(text), SEARCH_DEBOUNCE_MS)
  }
  return { query, type, send }
}

const PickerSearch = ({ label, search, t }) => (
  <SearchField
    className='odc-orders-picker-search'
    value={search.query}
    onChange={search.type}
    onClear={() => search.send('')}
    onKeyDown={(event) => { if (event.key === 'Enter') search.send(search.query) }}
    label={`${t('SEARCH', 'Search')} ${label}`}
    placeholder={t('SEARCH', 'Search')}
    clearLabel={t('CLEAR_SEARCH', 'Clear search')}
  />
)

const SkeletonRows = ({ label, checkbox }) => (
  <div className='odc-orders-picker-list odc-dt-skeletons' role='group' aria-label={label} aria-busy='true'>
    {Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <div key={index} className='odc-dt-skeleton-row'>
        <Skeleton shape={checkbox ? 'box' : 'round'} size='var(--od-x-checkbox-box)' block='var(--od-x-checkbox-box)' />
        <Skeleton size='60%' />
      </div>
    ))}
  </div>
)

// The pager of a list that the controller pages (`pagination`: currentPage, pageSize, totalPages and totalItems | total).
// Nothing when the list fits one page.
const PickerPager = ({ pagination, count, busy, onPageChange, t }) => {
  if (!(pagination?.totalPages > 1)) return null
  const total = pagination.totalItems ?? pagination.total
  return (
    <Pagination
      className='odc-dt-picker-pager'
      page={pagination.currentPage}
      pageSize={pagination.pageSize}
      total={total ?? undefined}
      hasMore={pagination.currentPage < pagination.totalPages}
      itemCount={count}
      busy={busy}
      onPageChange={onPageChange}
      label={t('PAGINATION', 'Pagination')}
      previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
      nextLabel={t('NEXT_PAGE', 'Next page')}
      rangeLabel={(from, to, known, figureOf) => (known == null
        ? <>{figureOf(from)}–{figureOf(to)}</>
        : fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: known }, figureOf))}
      pageStatusLabel={(current, pages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(pages))}
    />
  )
}

// ---- Driver group ------------------------------------------------------------------------------------------------------------------
// A radio group whose arrows MOVE the focus and do not choose (Enter or Space chooses): choosing a group reloads the calendar and
// closes the popover, so passing over an option must not do it. One Tab stop (the chosen option, else the one the focus is on, else
// the first). The look is the Product radio's (`odc-radio`, radio-group.css).

const GroupChoices = ({ label, options, checkedValue, onPick }) => {
  const listRef = useRef(null)
  const baseId = useId()
  const [stop, setStop] = useState(null)
  const tabValue = options.some(option => option.value === stop) ? stop : (options.some(option => option.value === checkedValue) ? checkedValue : options[0]?.value)

  const handleKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const radios = Array.from(listRef.current.querySelectorAll('[role="radio"]'))
    const index = radios.indexOf(event.target.closest?.('[role="radio"]'))
    if (index < 0) return
    const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: radios.length - 1 }[event.key]
    if (target === undefined) return
    event.preventDefault()
    if (radios[target]) radios[target].focus()
    else if (event.key === 'ArrowUp') listRef.current.closest('.odc-dt-picker')?.querySelector('input[type="search"]')?.focus()
  }

  return (
    <div
      ref={listRef}
      role='radiogroup'
      aria-label={label}
      className='odc-orders-checklist odc-orders-picker-list odc-dt-choices'
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const checked = option.value === checkedValue
        const nameId = `${baseId}-${index}-name`
        const descriptionId = option.description != null ? `${baseId}-${index}-description` : undefined
        return (
          <button
            key={option.value}
            type='button'
            role='radio'
            aria-checked={checked}
            aria-labelledby={nameId}
            aria-describedby={descriptionId}
            tabIndex={option.value === tabValue ? 0 : -1}
            data-checked={checked ? '' : undefined}
            className='odc-radio odc-dt-choice'
            onFocus={() => setStop(option.value)}
            onClick={() => onPick(option)}
          >
            <span className='odc-radio-box' aria-hidden='true'>{checked && <span className='odc-radio-dot' />}</span>
            <span className='odc-radio-text'>
              <span id={nameId} className='odc-radio-label'>{option.label}</span>
              {descriptionId && <span id={descriptionId} className='odc-radio-description'>{option.description}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const GroupBody = (props) => {
  const { label, selectedGroup, onPick, driversGroupsState, pagination, onSearch, getHeaderDriversGroups } = props
  const [, t] = useLanguage()
  const search = useTypedSearch(onSearch)
  const groups = asList(driversGroupsState?.groups)
  const loading = Boolean(driversGroupsState?.loading)

  // «All drivers» is always the first option and is never paged or searched away: it is the way to take the group off
  const options = [
    { value: ALL, label: t('DRIVER_BLOCKS_ALL_DRIVERS', 'All drivers'), group: null },
    ...(loading
      ? []
      : groups.map(group => ({
        value: String(group.id),
        label: group.name ?? '',
        description: fill(t('DRIVER_BLOCKS_GROUP_DRIVERS', 'Drivers _count_'), { count: asList(group.drivers).length }, figure),
        group
      })))
  ]

  return (
    <div className='odc-orders-picker odc-dt-picker'>
      <PickerSearch label={label} search={search} t={t} />
      <GroupChoices
        label={label}
        options={options}
        checkedValue={selectedGroup ? String(selectedGroup.id) : ALL}
        onPick={option => onPick(option.group)}
      />
      {loading && <SkeletonRows label={label} />}
      {!loading && groups.length === 0 && (
        <p className='odc-orders-picker-empty' role='status'>{t('NO_RESULTS_FOUND', 'No results found')}</p>
      )}
      <PickerPager
        pagination={pagination}
        count={groups.length}
        busy={loading}
        onPageChange={(page) => getHeaderDriversGroups?.(page, pagination?.pageSize)}
        t={t}
      />
    </div>
  )
}

// ---- Drivers -----------------------------------------------------------------------------------------------------------------------

const DriversBody = (props) => {
  const { label, driverIds, onToggle, onClear, driversList, pagination, handleChangePage, setSearchValue, useDriversByProps } = props
  const [, t] = useLanguage()
  // with a group the list is the group's and the search filters it here; without one the controller searches on the server
  const byGroup = Boolean(useDriversByProps)
  const search = useTypedSearch(byGroup ? undefined : setSearchValue)
  const loading = Boolean(driversList?.loading)
  const needle = search.query.trim().toLocaleLowerCase()
  const rows = asList(driversList?.drivers)
    .map(driver => ({ id: driver.id, name: fullName(driver), hint: byGroup ? hintOf(driver) : '' }))
    .filter(row => !byGroup || !needle || row.name.toLocaleLowerCase().includes(needle))

  return (
    <div className='odc-orders-picker odc-dt-picker'>
      <PickerSearch label={label} search={search} t={t} />
      {loading
        ? <SkeletonRows label={label} checkbox />
        : (
          <div className='odc-orders-checklist odc-orders-picker-list' role='group' aria-label={label}>
            {rows.map(row => (
              <Checkbox key={row.id} checked={driverIds.includes(row.id)} onCheckedChange={() => onToggle(row.id, row.name)}>
                <span className='odc-orders-picker-row'>
                  <span className='odc-orders-picker-name'>{row.name}</span>
                  {row.hint && <>{' '}<span className='odc-orders-picker-meta'>{row.hint}</span></>}
                </span>
              </Checkbox>
            ))}
          </div>
          )}
      {!loading && rows.length === 0 && (
        <p className='odc-orders-picker-empty' role='status'>{t('NO_RESULTS_FOUND', 'No results found')}</p>
      )}
      {!byGroup && (
        <PickerPager pagination={pagination} count={rows.length} busy={loading} onPageChange={(page) => handleChangePage?.(page)} t={t} />
      )}
      {driverIds.length > 0 && <PopoverFoot onClear={onClear} clearLabel={t('CLEAR', 'Clear')} />}
    </div>
  )
}

export const ScopePills = ({ selectedGroup, onGroupChange, driverIds = [], driverNames = {}, onToggleDriver, onClearDrivers }) => {
  const [, t] = useLanguage()
  const groupLabel = t('DRIVER_GROUP', 'Driver group')
  const driversLabel = t('DRIVERS', 'Drivers')
  const groupValue = selectedGroup?.name || t('ALL', 'All')
  // the name of one driver is the one the page learned when it was checked; several are a count; none is «All»
  const driversValue = driverIds.length > 0 ? pillValue(driverIds, id => driverNames[id]) : t('ALL', 'All')

  return (
    <>
      <FilterPopover icon={Users} label={groupLabel} value={groupValue} priority='primary' popupClassName={POPUP}>
        {({ close }) => (
          <DriversGroupsList
            UIComponent={GroupBody}
            isHeaderComponent
            asDashboard
            paginationSettings={GROUP_PAGE_SETTINGS}
            propsToFetch={GROUP_FIELDS}
            label={groupLabel}
            selectedGroup={selectedGroup}
            onPick={(group) => {
              onGroupChange?.(group)
              close()
            }}
          />
        )}
      </FilterPopover>
      <FilterPopover icon={Bike} label={driversLabel} value={driversValue} priority='primary' popupClassName={POPUP}>
        <DriversList
          UIComponent={DriversBody}
          disableDriverLocationsSockets
          paginationSettings={DRIVER_PAGE_SETTINGS}
          propsToFetch={DRIVER_FIELDS}
          isSearchByName
          disableSocketRoomDriver
          filterValues={{ driverIds }}
          useDriversByProps={selectedGroup || undefined}
          driversList={selectedGroup || undefined}
          label={driversLabel}
          driverIds={driverIds}
          onToggle={onToggleDriver}
          onClear={onClearDrivers}
        />
      </FilterPopover>
    </>
  )
}
