import React, { useEffect } from 'react'
import {
  useLanguage,
  useConfig,
  ReportsDriverGroupFilter as DriverGroupController,
  ReportsDriverFilter as DriverController,
  ReportsAppIdFilter as ChannelController
} from '../../../../../index'
import { Checkbox, FilterPopover, PopoverFoot, SearchField } from '../../Shared/Product'
import { Bike, Link, ShoppingBag, Users } from '../../Shared/Icon'
import { SkeletonRows, asList, useSearchTexts, useServerSearch } from './reportPillParts'
import './report-filters.css'

// redesign reports FB2 (D4, D5; RP-10, RP-18, RP-21; auditor 6, 7, 12): the four pills of the report filters that the business
// reports do not have: Driver group, Driver, Order type and Channel, with the pattern of Stores and Brand in ReportFilterPills.
// Each one is a Product `FilterPopover` whose body is the UIComponent of the controller of `main` (ReportsDriverGroupFilter,
// ReportsDriverFilter, ReportsAppIdFilter), mounted when the popover opens (the popup unmounts on close), so GET drivergroups,
// users and sites go out on each opening, as `main` did with its modals. Order type has no controller in `main` (its UI reads
// `order_types_allowed` from the config), so its body does the same.
//
// The selection, «All» and «Filter» of the controllers are NOT used (as StoresPill does not use them): the checks are the ids the
// page holds in `filterList` (`selected`) and each check applies at once (`onToggle`, which the bar turns into
// `handleChangeFilterList(next, { debounce: true })`; nothing checked is `null`, RP-10). The bodies tell the bar the names they
// have seen (`onLearn`) so a pill and a chip read a name when the list that brought it is no longer on screen.
//
// @param {object}   props
// @param {string}   props.label       The pill (and dialog) name: «Driver group», «Driver», «Order type», «Channel».
// @param {*}        props.value       What the pill says of the ids it holds (the bar computes it).
// @param {object}   props.filterList  The page's filters (the controllers take it as a prop).
// @param {number[]} props.selected    The ids the page holds for this pill.
// @param {Function} props.onToggle    `(id, name) => void`.
// @param {Function} props.onClear     `() => void`: «Clear» of the popover.
// @param {Function} props.onLearn     `(kind, [[id, value], …]) => void`.

const POPUP = 'odc-orders-checklist-popup odc-orders-picker-popup'

// The five order types of `main` (ReportsOrderTypeFilter), with the keys and texts it uses. Static: a chip reads its name without
// the popover ever having been opened.
export const orderTypeLabels = (t) => ({
  1: t('DELIVERY', 'Delivery'),
  2: t('PICKUP', 'Pickup'),
  3: t('EAT_IN', 'Eat in'),
  4: t('CURBSIDE', 'Curbside'),
  5: t('DRIVE_THRU', 'Drive thru')
})

// The order types the project allows (`order_types_allowed` of the config, «1|2|3»), in the order of `main`. `main` showed none
// when the config did not say; here the five are shown instead of an empty popover.
const useOrderTypes = () => {
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const labels = orderTypeLabels(t)
  const all = Object.keys(labels).map(Number)
  const allowed = String(configs?.order_types_allowed?.value ?? '').split('|').map(Number)
  const ids = all.filter(id => allowed.includes(id))
  return (ids.length > 0 ? ids : all).map(id => ({ id, name: labels[id] }))
}

const fullName = (person) => [person?.name, person?.lastname].filter(Boolean).join(' ')

// ---- The list every pill paints ----------------------------------------------------------------------------------------------------
// Rows with a Product checkbox, a search only where `main` had one (`search`: the result of useServerSearch), skeletons while the
// answer comes, «No results found», and «Clear» once something is checked.

const PickerBody = ({ label, rows, loading, selected, onToggle, onClear, search }) => {
  const texts = useSearchTexts(label)
  return (
    <div className='odc-orders-picker odc-bi-picker'>
      {search && (
        <SearchField
          className='odc-orders-picker-search'
          value={search.query}
          onChange={search.type}
          onClear={() => search.send('')}
          onKeyDown={(event) => { if (event.key === 'Enter') search.send(search.query) }}
          label={texts.fieldLabel}
          placeholder={texts.searchLabel}
          clearLabel={texts.clearSearchLabel}
        />
      )}
      {loading
        ? <SkeletonRows label={label} />
        : (
          <div className='odc-orders-checklist odc-orders-picker-list' role='group' aria-label={label}>
            {rows.map(row => (
              <Checkbox key={row.id} checked={selected.includes(row.id)} onCheckedChange={() => onToggle(row.id, row.name)}>
                <span className='odc-orders-picker-row'>
                  <span className='odc-orders-picker-name'>{row.name ?? ''}</span>
                </span>
              </Checkbox>
            ))}
          </div>
          )}
      {!loading && rows.length === 0 && (
        <p className='odc-orders-picker-empty' role='status'>{texts.noResultsLabel}</p>
      )}
      {selected.length > 0 && <PopoverFoot onClear={onClear} clearLabel={texts.clearLabel} />}
    </div>
  )
}

// ---- Driver group ------------------------------------------------------------------------------------------------------------------
// The list comes with the drivers of each group (`drivers` is one of the fields `main` asks for): the bar keeps who is in each group
// (`members`) to scope the Driver pill by them, as `main` did with `availableDriverIds`.

const DriverGroupBody = (props) => {
  const { label, selected, onToggle, onClear, onLearn, driverGroupList, onSearch } = props
  const search = useServerSearch(onSearch)
  const groups = asList(driverGroupList?.driverGroups)
  const loading = Boolean(driverGroupList?.loading)

  useEffect(() => {
    if (loading || groups.length === 0) return
    onLearn('groups', groups.map(group => [group.id, group.name]))
    onLearn('members', groups.map(group => [group.id, asList(group.drivers).map(driver => driver.id)]))
  }, [driverGroupList?.driverGroups, loading])

  const rows = groups.map(group => ({ id: group.id, name: group.name }))
  return <PickerBody label={label} rows={rows} loading={loading} selected={selected} onToggle={onToggle} onClear={onClear} search={search} />
}

export const DriverGroupPill = ({ label, value, filterList, selected, onToggle, onClear, onLearn }) => (
  <FilterPopover icon={Users} label={label} value={value} priority='secondary' popupClassName={POPUP}>
    <DriverGroupController
      UIComponent={DriverGroupBody}
      propsToFetch={['id', 'name', 'enabled', 'drivers']}
      filterList={filterList}
      label={label}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
      onLearn={onLearn}
    />
  </FilterPopover>
)

// ---- Driver ------------------------------------------------------------------------------------------------------------------------
// `main` asks for these fields and searches by name and last name on the server. Its list shows the name only; this one shows the
// name and the last name (two drivers can share a name, and the chip reads it). `availableDriverIds`: the drivers of the groups
// chosen (undefined = every driver).

const DriverBody = (props) => {
  const { label, selected, onToggle, onClear, onLearn, driverList, onSearch } = props
  const search = useServerSearch(onSearch)
  const drivers = asList(driverList?.drivers)
  const loading = Boolean(driverList?.loading)
  const rows = drivers.map(driver => ({ id: driver.id, name: fullName(driver) }))

  useEffect(() => {
    if (!loading && rows.length > 0) onLearn('drivers', rows.map(row => [row.id, row.name]))
  }, [driverList?.drivers, loading])

  return <PickerBody label={label} rows={rows} loading={loading} selected={selected} onToggle={onToggle} onClear={onClear} search={search} />
}

export const DriverPill = ({ label, value, filterList, selected, onToggle, onClear, onLearn, availableDriverIds }) => (
  <FilterPopover icon={Bike} label={label} value={value} priority='secondary' popupClassName={POPUP}>
    <DriverController
      UIComponent={DriverBody}
      propsToFetch={['id', 'name', 'lastname', 'driver_groups.id']}
      isSearchByName
      isSearchByLastName
      availableDriverIds={availableDriverIds}
      filterList={filterList}
      label={label}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
      onLearn={onLearn}
    />
  </FilterPopover>
)

// ---- Order type --------------------------------------------------------------------------------------------------------------------

const OrderTypeBody = ({ label, selected, onToggle, onClear }) => {
  const rows = useOrderTypes()
  return <PickerBody label={label} rows={rows} loading={false} selected={selected} onToggle={onToggle} onClear={onClear} />
}

export const OrderTypePill = ({ label, value, selected, onToggle, onClear }) => (
  <FilterPopover icon={ShoppingBag} label={label} value={value} priority='secondary' popupClassName={POPUP}>
    <OrderTypeBody label={label} selected={selected} onToggle={onToggle} onClear={onClear} />
  </FilterPopover>
)

// ---- Channel -----------------------------------------------------------------------------------------------------------------------
// The sites of the project (`main`'s «App id» button: its list has no search either).

const ChannelBody = (props) => {
  const { label, selected, onToggle, onClear, onLearn, appIdList } = props
  const sites = asList(appIdList?.appIds)
  const loading = Boolean(appIdList?.loading)

  useEffect(() => {
    if (!loading && sites.length > 0) onLearn('channels', sites.map(site => [site.id, site.name]))
  }, [appIdList?.appIds, loading])

  const rows = sites.map(site => ({ id: site.id, name: site.name }))
  return <PickerBody label={label} rows={rows} loading={loading} selected={selected} onToggle={onToggle} onClear={onClear} />
}

export const ChannelPill = ({ label, value, filterList, selected, onToggle, onClear, onLearn }) => (
  <FilterPopover icon={Link} label={label} value={value} priority='secondary' popupClassName={POPUP}>
    <ChannelController
      UIComponent={ChannelBody}
      propsToFetch={['id', 'name', 'code']}
      filterList={filterList}
      label={label}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
      onLearn={onLearn}
    />
  </FilterPopover>
)
