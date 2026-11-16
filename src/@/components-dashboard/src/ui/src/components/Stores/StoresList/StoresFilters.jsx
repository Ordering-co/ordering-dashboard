import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, BusinessTypeFilter as BusinessTypeFilterController, CityList as CityListController } from '../../../../../index'
import {
  Button,
  ChecklistPopover,
  FilterBar,
  FilterChips,
  FilterPopover,
  ListPopover,
  PopoverFoot,
  RadioGroup,
  SearchField,
  TextField
} from '../../Shared/Product'
import { pillValue, withoutLeadingLabel } from '../../Shared/Product/filterValueText'
import { LayoutGrid, Link, MapPin, Star, Store } from '../../Shared/Icon'
import { useFeaturedRestriction } from '../../../hooks/useFeaturedRestriction'
import { hasActiveFilters, nextFilterValues, readFilterValues, sameFilterValues, toggleCityId } from './storesListModel'
import './stores-list.css'

// redesign SL-F1 (A1): the filters of /stores/list: the Product filter bar, search and five pills (Type, City, Featured, Name,
// External ID) that replace the filter modal of BusinessFilterGroup. It holds no filter state: it shows `filterValues` and reports
// every change once through `handleChangeFilterValues`, with the object the modal used to send on «Accept» (see `nextFilterValues`
// in storesListModel.js), so the list makes one request per change.
// redesign stores 3.A: the type is a pill (the first) with its chip, no longer a row above the bar; «Clear filters» (the
// one of the bar, G1-08) clears the type as well as the filters; City applies once, with «Apply».
//
// @param {object}   props
// @param {string}   [props.searchValue]                 The search text the controller holds (`null` or '' = none).
// @param {Function} props.onSearch                      `(text: string) => void`, called after the same 750 ms wait SearchBar had (at once on Enter or on clear).
// @param {object}   props.filterValues                  The applied filters: `{}` or the full shape of BusinessFilter. See storesListModel.js.
// @param {Function} props.handleChangeFilterValues      `(filterValues: object) => void`. «Clear filters» sends `{}` (only when filters are on).
// @param {boolean}  [props.noBusinesses]                The project has no stores: the Type pill is not drawn (the filter bar is, as the search was).
// @param {boolean}  [props.loadFailed]                  The load of the list failed (its empty list is not «no stores»): the Type pill stays next to the error.
// @param {Array}    [props.businessTypes]               Types already loaded (the page keeps them); without it the controller fetches them.
// @param {*}        [props.businessTypeSelected]        The type the list controller holds (`types.id`; `null` or missing = all types). Drives the
//                                                      Type pill and its chip.
// @param {Function} props.handleChangeBusinessType      `(typeId: number | null) => void`: sets `types.id` in the list controller. «Clear filters» sends `null` (only when a type is set).
// @param {Function} [props.setBusinessTypes]            Hands the loaded types up to the page, which gives them to the editor.
// @param {Array}    [props.citiesList]                  The cities the list controller already has (`DashboardBusinessList` `citiesList`). Given, the
//                                                      City pill makes no request; missing, the CityList controller fetches them as the modal did.
// @param {boolean}  [props.citiesLoading]               With `citiesList`: the cities are still loading.

// The wait before the search text reaches the controller: each change of it is a request of the list (SearchBar lazyLoad: 750 ms)
const SEARCH_DEBOUNCE_MS = 750

// ---- The «Type» pill ----------------------------------------------------------------------------------------------------------
// redesign stores 3.A, decision 1 A (sketch 01-type-filter): the row of types is gone (G1-01, G1-02). «Type» is the first pill of
// the bar (P/ListPopover: «All types» first, search, one choice). It stays wired through the S/BusinessTypeFilter controller, so the types are
// still fetched and handed up with `setBusinessTypes` once loaded (the editor reads them). The UI component draws ONLY the pill, with no wrapper:
// FilterBar measures its pills as the direct children of `.odc-filterbar-filters`.
// redesign stores 1.C, G1-03: a request that failed says so inside the popover, with «Retry» (`onRetry`).

// The name of a type as the row showed it, translated by its API name (the chip and the pill say the same thing)
const typeDisplayName = (t, type) => t(`BUSINESS_TYPE_${String(type.name).replace(/\s/g, '_').toUpperCase()}`, type.name)

const TypePillUI = (props) => {
  const { typesState, businessTypeSelected, handleChangeBusinessType, setBusinessTypes, onRetry } = props
  const { loading, error, types } = typesState
  const [, t] = useLanguage()

  useEffect(() => {
    if (loading) return
    setBusinessTypes?.(types)
  }, [types])

  // an answer with no types (and no error) draws nothing and says nothing, as the row did
  if (!loading && !error && (!types || types.length === 0)) return null

  // «All» is the synthetic type (`id == null`) the controller adds; the pill adds its own «All types»
  const items = (types || [])
    .filter(type => type.enabled && type.id !== null && type.id !== undefined)
    .map(type => ({ id: type.id, name: typeDisplayName(t, type), keywords: [type.name] }))

  return (
    <ListPopover
      icon={LayoutGrid}
      label={t('TYPE', 'Type')}
      priority='primary'
      items={items}
      value={businessTypeSelected ?? null}
      onChange={(id) => handleChangeBusinessType?.(id)}
      loading={Boolean(loading)}
      error={Boolean(error)}
      onRetry={onRetry}
      allLabel={t('ALL_TYPES', 'All types')}
      searchLabel={t('SEARCH', 'Search')}
      clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
      loadingLabel={`${t('LOADING', 'Loading')}...`}
      noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
      errorLabel={t('STORES_TYPES_LOAD_FAILED', "We couldn't load the business types.")}
      retryLabel={t('RETRY', 'Retry')}
    />
  )
}

// «Retry» mounts the controller again (a new `key`): it asks for the types on mount, and keeps no retry of its own
const TypePill = ({ businessTypes, businessTypeSelected, handleChangeBusinessType, setBusinessTypes }) => {
  const [attempt, setAttempt] = useState(0)
  return (
    <BusinessTypeFilterController
      key={attempt}
      UIComponent={TypePillUI}
      businessTypes={businessTypes}
      businessTypeSelected={businessTypeSelected}
      onChangeBusinessType={handleChangeBusinessType}
      setBusinessTypes={setBusinessTypes}
      onRetry={() => setAttempt(current => current + 1)}
    />
  )
}

// ---- Pills with their own popover ---------------------------------------------------------------------------------------------

/** Name and External ID: a text, applied with Enter or «Apply». The draft lives in the popup, so it starts from the applied text on each open. */
const TextFilterBody = ({ label, applied, onApply, applyLabel, clearLabel }) => {
  const [draft, setDraft] = useState(applied || '')
  const input = useRef(null)
  const apply = () => onApply(draft)
  return (
    <div className='odc-sl-textfilter'>
      <TextField
        ref={input}
        label={label}
        value={draft}
        onChange={setDraft}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          apply()
        }}
        autoComplete='off'
      />
      <div className='odc-sl-textfilter-actions'>
        <Button variant='primary' size='sm' onClick={apply}>{applyLabel}</Button>
      </div>
      {applied
        ? (
          <PopoverFoot
            clearLabel={clearLabel}
            onClear={() => {
              setDraft('')
              input.current?.focus()
              onApply('')
            }}
          />
          )
        : null}
    </div>
  )
}

const TextFilterPill = ({ icon, label, applied, onApply, applyLabel, clearLabel }) => (
  <FilterPopover icon={icon} label={label} value={applied || ''} priority='secondary'>
    <TextFilterBody label={label} applied={applied} onApply={onApply} applyLabel={applyLabel} clearLabel={clearLabel} />
  </FilterPopover>
)

/** Featured: Yes or No, a click each (the old select held `true` / `false`). */
const FeaturedBody = ({ label, featured, onPick, yesLabel, noLabel, clearLabel }) => {
  const root = useRef(null)
  const chosen = featured === true ? 'yes' : (featured === false ? 'no' : '')
  return (
    <div ref={root} className='odc-sl-featured'>
      <RadioGroup
        label={label}
        hideLabel
        value={chosen}
        onValueChange={(value) => onPick(value === 'yes')}
        options={[{ value: 'yes', label: yesLabel }, { value: 'no', label: noLabel }]}
      />
      {chosen
        ? (
          <PopoverFoot
            clearLabel={clearLabel}
            onClear={() => {
              root.current?.querySelector('[role="radio"]')?.focus()
              onPick(null)
            }}
          />
          )
        : null}
    </div>
  )
}

// ---- The bar --------------------------------------------------------------------------------------------------------------------

const StoresFilterBar = ({
  searchValue,
  onSearch,
  filterValues,
  handleChangeFilterValues,
  cities,
  citiesLoading,
  showTypePill,
  businessTypes,
  knownTypes,
  businessTypeSelected,
  handleChangeBusinessType,
  setBusinessTypes,
  tools
}) => {
  const [, t] = useLanguage()
  const values = readFilterValues(filterValues)
  const cityIds = Array.isArray(values.cityIds) ? values.cityIds : []
  const cityList = Array.isArray(cities) ? cities : []
  const cityName = (id) => cityList.find(city => city?.id === id)?.name
  // redesign stores 1.C, G1-06: a change that leaves the filters as they are (an empty «Apply», the same text again)
  // does not reach the list: a new object there is a new request
  const change = (patch) => {
    const next = nextFilterValues(filterValues, patch)
    if (sameFilterValues(next, filterValues)) return
    handleChangeFilterValues?.(next)
  }
  // redesign stores 3.A, S2 / G1-08: the type is one more filter. The single «Clear filters» sends `{}` only if filters are on
  // (no useless request) and `null` to the type only if one is set
  const typeSelected = businessTypeSelected === undefined ? null : businessTypeSelected
  const hasType = typeSelected !== null

  // ---- search: typed here, sent after a wait (at once on Enter or on clear). A value set from outside shows unless the user is typing.
  const [searchText, setSearchText] = useState(searchValue || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  useEffect(() => {
    if (!searchValue) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(searchValue)
  }, [searchValue])
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    onSearch?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => onSearch?.(text), SEARCH_DEBOUNCE_MS)
  }

  const labels = {
    type: t('TYPE', 'Type'),
    city: t('CITY', 'City'),
    featured: t('FEATURED', 'Featured'),
    name: t('NAME', 'Name'),
    // redesign tanda AB (S-4b): own key; the live catalogue's EXTERNAL_ID reads «External Id»
    externalId: t('STORE_EXTERNAL_ID', 'External ID')
  }
  // main (441a22ccd, ): the Featured filter is for administrators only
  const canFilterFeatured = !useFeaturedRestriction()
  const yes = t('YES', 'Yes')
  const no = t('NO', 'No')
  const clearText = t('CLEAR_FILTERS', 'Clear filters')
  const featuredText = values.featured === true ? yes : (values.featured === false ? no : '')
  const nameText = typeof values.name === 'string' ? values.name : ''
  const externalIdText = typeof values.externalId === 'string' ? values.externalId : ''

  const hasFilters = hasActiveFilters(filterValues)
  // a search narrows the list as a filter does, so «Clear filters» is there for it too and clears it (it has no chip)
  const hasSearch = Boolean(searchValue) || searchText.trim() !== ''
  const clearFilters = () => {
    if (hasFilters) handleChangeFilterValues?.({})
    if (hasType) handleChangeBusinessType?.(null)
    if (hasSearch) {
      setSearchText('')
      sendSearch('')
    }
  }
  // the chip says the name of the type as the pill does; a type not among the loaded ones (an id from the URL) shows its id
  const typeName = (() => {
    if (!hasType) return ''
    const known = (Array.isArray(knownTypes) ? knownTypes : []).find(type => type?.id !== null && type?.id !== undefined && String(type.id) === String(typeSelected))
    return known ? typeDisplayName(t, known) : String(typeSelected)
  })()

  // ---- chips: one per value ----
  const chips = (() => {
    const entries = []
    const add = (key, name, value, patch) => entries.push({
      key,
      label: `${name}: ${value}`,
      removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', `${name} ${value}`),
      onRemove: () => change(patch)
    })
    // redesign stores 3.A: the type comes first, as its pill does
    if (hasType) {
      entries.push({
        key: 'type',
        label: `${labels.type}: ${typeName}`,
        removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', `${labels.type} ${typeName}`),
        onRemove: () => handleChangeBusinessType?.(null)
      })
    }
    cityIds.forEach(id => add(`city-${id}`, labels.city, withoutLeadingLabel(labels.city, String(cityName(id) ?? id)), { cityIds: toggleCityId(cityIds, id) }))
    if (canFilterFeatured && featuredText) add('featured', labels.featured, featuredText, { featured: null })
    if (nameText.trim()) add('name', labels.name, nameText, { name: null })
    if (externalIdText.trim()) add('externalId', labels.externalId, externalIdText, { externalId: null })
    return entries
  })()

  const searchNode = (
    <SearchField
      value={searchText}
      onChange={typeSearch}
      onClear={() => sendSearch('')}
      onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
      inputRef={searchInput}
      label={t('SEARCH', 'Search')}
      placeholder={t('SEARCH', 'Search')}
      clearLabel={t('CLEAR_SEARCH', 'Clear search')}
    />
  )

  const pills = (
    <>
      {showTypePill && (
        <TypePill
          businessTypes={businessTypes}
          businessTypeSelected={businessTypeSelected}
          handleChangeBusinessType={handleChangeBusinessType}
          setBusinessTypes={setBusinessTypes}
        />
      )}
      <ChecklistPopover
        icon={MapPin}
        label={labels.city}
        value={withoutLeadingLabel(labels.city, pillValue(cityIds, cityName))}
        priority='secondary'
        items={cityList.map(city => ({ id: city.id, name: city.name ?? '' }))}
        selected={cityIds}
        onToggle={(id) => change({ cityIds: toggleCityId(cityIds, id) })}
        // redesign stores 3.A, S4: the ticks change a draft and «Apply» sends the cities once; «Clear» still empties them at once
        onApply={(ids) => change({ cityIds: ids })}
        applyLabel={t('APPLY', 'Apply')}
        onClear={() => change({ cityIds: [] })}
        loading={Boolean(citiesLoading)}
        searchLabel={t('SEARCH', 'Search')}
        clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
        loadingLabel={`${t('LOADING', 'Loading')}...`}
        noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
        clearLabel={t('CLEAR', 'Clear')}
      />
      {canFilterFeatured && (
        <FilterPopover icon={Star} label={labels.featured} value={featuredText} priority='secondary'>
          <FeaturedBody
            label={labels.featured}
            featured={values.featured}
            onPick={(featured) => change({ featured })}
            yesLabel={yes}
            noLabel={no}
            clearLabel={t('CLEAR', 'Clear')}
          />
        </FilterPopover>
      )}
      <TextFilterPill
        icon={Store}
        label={labels.name}
        applied={nameText}
        onApply={(text) => change({ name: text })}
        applyLabel={t('APPLY', 'Apply')}
        clearLabel={t('CLEAR', 'Clear')}
      />
      <TextFilterPill
        icon={Link}
        label={labels.externalId}
        applied={externalIdText}
        onApply={(text) => change({ externalId: text })}
        applyLabel={t('APPLY', 'Apply')}
        clearLabel={t('CLEAR', 'Clear')}
      />
    </>
  )

  return (
    <FilterBar
      flush
      label={t('STORE_FILTERS', 'Store filters')}
      // the pills that do not fit go to «+N»; its name says how many, and how many of them hold a value
      overflowLabel={(count) => `+${count} ${t('MORE_FILTERS', 'more filters')}`}
      overflowActiveLabel={(count) => t('FILTERS_ACTIVE_COUNT', '_count_ active').replace('_count_', count)}
      // the row keeps the room of «Clear filters» even with no filter on, so the first filter never moves the bar
      clearReserve={clearText}
      search={searchNode}
      filters={pills}
      // redesign stores 3.B: the column manager of the table, at the end of the bar (it had a row of its own)
      tools={tools}
      // redesign stores 3.A, G1-08: the bar's button is the only «Clear filters» (FilterChips draws no second one)
      clear={hasFilters || hasType || hasSearch ? <Button variant='ghost' onClick={clearFilters}>{clearText}</Button> : undefined}
      chips={chips.length > 0
        ? (
          // redesign stores 3.A, review F1: the chips keep their «clear all». FilterBar shows one «Clear filters» at
          // a time (C7): the bar's button on a wide screen, this one on the phone, where the bar's button leaves
          <FilterChips
            label={t('FILTERS_ACTIVE', 'Active filters')}
            clearAllLabel={clearText}
            onClearAll={clearFilters}
            chips={chips}
          />
          )
        : undefined}
    />
  )
}

// With the cities of the list controller (`citiesList`) the bar makes no request; without them the CityList controller fetches them.
const CitiesBridge = ({ citiesList, ...rest }) => (
  <StoresFilterBar {...rest} cities={citiesList?.cities} citiesLoading={Boolean(citiesList?.loading)} />
)

export const StoresFilters = (props) => {
  const {
    searchValue,
    onSearch,
    filterValues,
    handleChangeFilterValues,
    noBusinesses,
    loadFailed,
    businessTypes,
    businessTypeSelected,
    handleChangeBusinessType,
    setBusinessTypes,
    citiesList,
    citiesLoading,
    tools
  } = props

  // redesign stores 3.A: a local copy of the loaded types, so the chip can say the name of the type; they are still handed up
  const [loadedTypes, setLoadedTypes] = useState(null)
  const handleTypesLoaded = (types) => {
    setLoadedTypes(types)
    setBusinessTypes?.(types)
  }

  const barProps = {
    searchValue,
    onSearch,
    filterValues,
    handleChangeFilterValues,
    showTypePill: !noBusinesses || loadFailed,
    businessTypes,
    knownTypes: loadedTypes ?? businessTypes,
    businessTypeSelected,
    handleChangeBusinessType,
    setBusinessTypes: handleTypesLoaded,
    tools
  }

  return (
    <div className='odc-root odc-sl-filters'>
      {Array.isArray(citiesList)
        ? <StoresFilterBar {...barProps} cities={citiesList} citiesLoading={citiesLoading} />
        : <CityListController {...barProps} UIComponent={CitiesBridge} />}
    </div>
  )
}
