import React from 'react'
import { useLanguage, OrdersFilter as OrdersFilterController } from '../../../../../index'
import { useFilterValues } from '../../../contexts/FilterValuesContext'
import { FilterPill } from '../../Shared/Product/FilterBar'
import { Calendar, Store } from '../../Shared/Icon'
import { DateTypeSelector } from '../DateTypeSelector'
import { ChecklistPopover } from '../../Shared/Product/FilterPopover' // redesign W0-2a (T0-4)

/**
 * The Date and Business pills of the filter bar (redesign F1b, D-05). Each one filters in its own popover and never
 * opens the whole Filters sheet:
 * - Date opens the brand date range of the sheet's field (`DateTypeSelector`, presets, From / To and the
 *   calendar), with the same handlers for a preset; a custom range is a draft until «Done» and then ONE write of
 *   `{ dateType, deliveryFromDatetime, deliveryEndDatetime }` to the context (one list request, F6c-1);
 * - Business opens a checklist like Driver (search, logo of 20px, name, «Clear») with the sheet's own handler
 *   (`handleChangeBusinesses`) and the same `businessIds`.
 * They write straight to the shared filter context, like the Driver pills (`OrdersHeaderFilterGroup`, whose effect
 * hands every change of the context to the list); the sheet keeps both fields too. `dateValue` and
 * `businessValue` are the words the pills show (the same as their chips).
 */
const DateBusinessPillsUI = (props) => {
  const {
    filterValues,
    businessesList,
    dateValue,
    businessValue,
    handleChangeDateType,
    handleChangeFromDate,
    handleChangeEndDate,
    handleChangeBusinesses,
    setFilterValues
  } = props
  const [, t] = useLanguage()
  const dateLabel = t('DATE', 'Date')
  const businessLabel = t('BUSINESS', 'Business')
  const items = (businessesList?.businesses || []).map(business => ({
    id: business.id,
    name: business.name ?? '',
    photo: business.logo
  }))

  return (
    <>
      <DateTypeSelector
        filterValues={filterValues}
        handleChangeDateType={handleChangeDateType}
        handleChangeFromDate={handleChangeFromDate}
        handleChangeEndDate={handleChangeEndDate}
        onApplyRange={values => setFilterValues && setFilterValues({ ...filterValues, ...values })}
        align='start'
        renderTrigger={({ ref, expanded, toggle }) => (
          <span ref={ref} className='odc-orders-pill-anchor'>
            <FilterPill
              icon={Calendar}
              label={dateLabel}
              value={dateValue}
              priority='secondary'
              hasPopup='dialog'
              expanded={expanded}
              onClick={toggle}
            />
          </span>
        )}
      />
      <ChecklistPopover
        icon={Store}
        label={businessLabel}
        value={businessValue}
        priority='secondary'
        items={items}
        selected={filterValues?.businessIds || []}
        onToggle={handleChangeBusinesses}
        onClear={() => setFilterValues && setFilterValues({ ...filterValues, businessIds: [] })}
        loading={businessesList?.loading}
        avatars='business'
        searchLabel={t('SEARCH', 'Search')}
        clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
        loadingLabel={`${t('LOADING', 'Loading')}...`}
        noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
        clearLabel={t('CLEAR', 'Clear')}
      />
    </>
  )
}

export const OrdersDateBusinessPills = (props) => {
  const [filterValues, { handleFilterValues } = {}] = useFilterValues()
  return (
    <OrdersFilterController
      {...props}
      UIComponent={DateBusinessPillsUI}
      filterValues={filterValues}
      setFilterValues={handleFilterValues}
      handleFilterValues={handleFilterValues}
    />
  )
}
