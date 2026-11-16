import React, { useEffect, useContext } from 'react'
import { useLanguage, useConfig, OrdersFilter as OrdersFilterController } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { Input } from '../../../styles'
import { useFilterValues } from '../../../contexts/FilterValuesContext'
import { SearchBar } from '../../Shared'
import { Link, Truck, Users } from '../../Shared/Icon'
import { ChecklistPopover, FilterPopover } from '../../Shared/Product/FilterPopover' // redesign W0-2a (T0-4)
import { pillValue, withoutLeadingLabel } from '../../Shared/Product/filterValueText'
// FilterPopover used to load this sheet: the `.external_id` rules of the popover are still in it (redesign W0-2a, T0-4)
import '../OrdersFilterBar/orders-filter-bar.css'

/**
 * The three filters of `filter_order_options` (external id, driver, assignable
 * driver group) as pills of the filter bar (C7). External id opens its search field;
 * Driver and Driver group open their checklist directly in the popover, like Status
 * (redesign fix-qa E2). The lists, the handlers (`handleChangeDriver`, `handleChangeGroup`)
 * and the context sync are the old ones; the full lists are already in memory, so the
 * list scrolls and has no pager.
 */
const OrdersHeaderFilterGroupUI = (props) => {
  const {
    filterValues,
    driversList,
    handleChangeDriver,
    handleChangeFilterValues,
    handleChangeExternalId,
    handleChangeGroup,
    assignableDriverGroupList,
    setFilterValues
  } = props

  const [{ dictionary }, t] = useLanguage()
  const [{ configs, loading }] = useConfig()

  const configFilter = configs?.filter_order_options?.value.split('|').map(value => (value)) || []
  const configFile = useContext(ConfigFileContext)?.[0]
  const prefixForVariable = (configFile?.app_internal_name || '').toUpperCase()

  useEffect(() => {
    if (Object.keys(filterValues).length > 0) {
      handleChangeFilterValues(filterValues)
    }
  }, [filterValues])

  const externalIdLabel = dictionary?.[`${prefixForVariable}_EXTERNAL_ID`] ?? t('EXTERNAL_ID', 'External ID')
  const driverLabel = dictionary?.[`${prefixForVariable}_DRIVER`] ?? t('DRIVER', 'Driver')
  // redesign fix-qa D1: the pill reads «Driver group»; the filter is still the assignable one (the sheet field and
  // the chip keep «Driver group (assignable)» to tell it from «Driver group (assigned)»).
  const groupLabel = dictionary?.DRIVER_GROUP ?? t('DRIVER_GROUP', 'Driver group')
  const driverName = (id) => {
    const driver = driversList?.drivers?.find(item => item.id === id)
    return driver ? `${driver.name} ${driver.lastname ?? ''}`.trim() : undefined
  }
  const groupName = (id) => assignableDriverGroupList?.groups?.find(item => item.id === id)?.name
  const driverItems = (driversList?.drivers || []).map(driver => ({
    id: driver.id,
    name: `${driver.name ?? ''} ${driver.lastname ?? ''}`.trim(),
    photo: driver.photo
  }))
  // redesign F6d-1 (P4-04): `main` showed `{id}. {name}`; fix-qa C3 moved the id to a muted second text, where a bare
  // «34» read like a count (Q2-04 removed it). It is back as a labelled, muted «ID 34» (not a number, not a prefix),
  // and the group is still found by typing the number (the word «ID» is only the label, not searched).
  const idLabel = t('ID', 'ID')
  const groupItems = (assignableDriverGroupList?.groups || []).map(group => ({
    id: group.id,
    name: group.name ?? '',
    secondary: `${idLabel} ${group.id}`,
    keywords: [String(group.id)]
  }))
  const clearFilter = (key) => () => setFilterValues && setFilterValues({ ...filterValues, [key]: [] })

  return (
    <>
      {!loading && configFilter.includes('external_id') && (
        <FilterPopover icon={Link} label={externalIdLabel} value={filterValues?.externalId || ''}>
          <SearchBar
            placeholder={externalIdLabel}
            onChange={handleChangeExternalId}
            search={filterValues?.externalId || ''}
            isCustomLayout
            hideSearchIcon
            lazyLoad
            CustomInput={Input}
            onSearch={(value) => handleChangeExternalId({ target: { value } })}
            customClass='external_id'
          />
        </FilterPopover>
      )}
      {!loading && configFilter.includes('driver') && (
        <ChecklistPopover
          icon={Truck}
          label={driverLabel}
          value={pillValue(filterValues?.driverIds, driverName)}
          items={driverItems}
          selected={filterValues?.driverIds || []}
          onToggle={handleChangeDriver}
          onClear={clearFilter('driverIds')}
          loading={driversList?.loading}
          avatars
          searchLabel={t('SEARCH', 'Search')}
          clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
          loadingLabel={`${t('LOADING', 'Loading')}...`}
          noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
          clearLabel={t('CLEAR', 'Clear')}
        />
      )}
      {!loading && configFilter.includes('driver_group') && assignableDriverGroupList && (
        <ChecklistPopover
          icon={Users}
          label={groupLabel}
          // the name of a group may already start with «Driver group»: not written twice (Q2-15)
          value={withoutLeadingLabel(groupLabel, pillValue(filterValues?.driverGroupBusinessIds, groupName))}
          items={groupItems}
          selected={filterValues?.driverGroupBusinessIds || []}
          onToggle={handleChangeGroup}
          onClear={clearFilter('driverGroupBusinessIds')}
          loading={assignableDriverGroupList?.loading}
          searchLabel={t('SEARCH', 'Search')}
          clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
          loadingLabel={`${t('LOADING', 'Loading')}...`}
          noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
          clearLabel={t('CLEAR', 'Clear')}
        />
      )}
    </>
  )
}

export const OrdersHeaderFilterGroup = (props) => {
  const [filterValues, { handleFilterValues }] = useFilterValues()

  const FilterControlProps = {
    ...props,
    UIComponent: OrdersHeaderFilterGroupUI,
    driverGroupList: props.driverGroupList,
    filterValues,
    setFilterValues: handleFilterValues
  }
  return (
    <>
      <OrdersFilterController {...FilterControlProps} />
    </>
  )
}
