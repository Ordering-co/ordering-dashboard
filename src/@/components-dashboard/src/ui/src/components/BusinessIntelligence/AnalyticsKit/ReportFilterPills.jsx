import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  useLanguage,
  AnalyticsBusinessFilter as StoresController,
  ReportsBrandFilter as BrandController,
  CountryList as CountryController
} from '../../../../../index'
import { normalizeTimezone } from '../../../../../utils'
// redesign the store-name lookup reads the API and the session itself (from their own modules, as the pages' hooks do)
import { useApi } from '../../../../../contexts/ApiContext'
import { useSession } from '../../../../../contexts/SessionContext'
import { timezones } from '../../../config/constants'
import {
  Avatar,
  Button,
  Checkbox,
  FilterBar,
  FilterChips,
  FilterPopover,
  Pagination,
  PopoverFoot,
  SearchField,
  cx
} from '../../Shared/Product'
import { withoutLeadingLabel } from '../../Shared/Product/filterValueText'
import { Clock, Globe, LayoutGrid, Store } from '../../Shared/Icon'
// redesign reports FB2 (D4, D5): the small parts that were here now live in reportPillParts.jsx (moved, not changed); the pills of
// the reports that Business does not have live in ReportPeoplePills.jsx
import {
  SkeletonRows,
  asList,
  fillTemplate,
  figure,
  orNull,
  pillText,
  toggled,
  useSearchTexts,
  useServerSearch
} from './reportPillParts'
import { ChannelPill, DriverGroupPill, DriverPill, OrderTypePill, orderTypeLabels } from './ReportPeoplePills'
import './report-filters.css'

// redesign bi FB2 (D6; BI-10, BI-14, BI-18, BI-19; auditor 5, 6): the filter pills of the business reports, in one Product filter
// bar: Stores, Brand, Country and Time zone, then a chip per active value and «Clear filters». The controllers of `main`
// (AnalyticsBusinessFilter, ReportsBrandFilter, CountryList) are used as they are; this file is only their UIComponents. None of
// them keeps the selection: it is `filterList` of the page (`businessIds`, `franchises_id`, `timeZone`) and `countryCode`, so a
// pill, its chip and «Clear filters» always agree (BI-10). Stores and Brand apply at once (`{ debounce: true }`: the page waits
// before it asks for the ten reports); Time zone applies and closes (BI-18); Country keeps the «Filter» of `main` because what it
// does is not a filter of the reports (BI-19, see CountryBody).
//
// @param {object}   props
// @param {object}   props.filterList                  `{ lapse, businessIds, app_id, franchises_id, timeZone }`: the page's filters.
// @param {Function} props.handleChangeFilterList      `(next, { debounce }?) => void`. Always the whole object (`{ ...filterList, … }`).
// @param {string}   [props.countryCode]               The active country code of the page ('' = all).
// @param {Function} props.handleChangeCode            `(code) => void`: the page's own, which toggles the same code back to ''.
// @param {boolean}  [props.flush=true]                The page gives the bar its margin (as the lists of the dashboard do).
// @param {string}   [props.className]
//
// redesign reports FB2 (D4, D5; RP-10, RP-18, RP-21; auditor 6, 7, 12): the props below are opt-in, for the 21 enterprise reports.
// Without any of them the bar is exactly the one of /intelligence/business. The bar of the reports is mounted once per report.
// @param {string[]} [props.pills]                     Ordered list of `stores`, `brand`, `country`, `zone`, `driverGroup`, `driver`,
//                                                     `orderType`, `channel`; only those are painted, in that order (default: the
//                                                     first four). Giving it also makes «Clear filters» set to null every filter key of
//                                                     the page, those of pills the report does not show included (D4).
// @param {boolean}  [props.storesByBrand=true]        false: the list of stores is not scoped by the brand (`isFranchise` of `main`).
// @param {boolean}  [props.driversByGroup=true]       false: the list of drivers is not scoped by the driver groups chosen.
// @param {boolean}  [props.countryWhenMany=false]     true: the Country pill exists only if the project has more than one country.
// @param {node}     [props.leading]                   Goes before the pills, in the same bar (the period pill of the page).
//
// redesign (D-21, option B): two more opt-in props, for a page that mounts the bar again during one visit (/intelligence/reports).
// Without them the Country pill opens by itself when the project has more than one country, as always (Business, Drivers, E-commerce).
// @param {boolean}  [props.countryOpensItself=true]   false: with several countries the Country pill is there but stays closed.
// @param {Function} [props.onCountryOpened]           `() => void`: called when the pill opened by itself, so the page can pass `countryOpensItself={false}`
//                                                     to the bars it mounts later in the same visit.
// No `wrap` prop: this bar already puts all its pills on as many lines as they need, with no scroll and no «+N», at every width
// (`.odc-bi-filters` in report-filters.css), which is what the reports ask for.
//
// redesign reports R1 (Q-01, Q-02, Q-03): three more opt-in props, for a page that mounts the bar again for each report (`key`).
// Without them the bar keeps what it has learned in its own state and writes its own «Clear filters», as /intelligence/business does.
// @param {object}   [props.names]                     What the bar has learned, kept by the page: `EMPTY_REPORT_NAMES`'s shape
//                                                     (`{ stores, brands, countries, drivers, groups, channels, members }`, each id → name;
//                                                     `members` is group → ids of its drivers). Given, the bar reads it instead of its own.
// @param {Function} [props.onNamesChange]             `(next) => void`: the whole new object, called each time the bar learns something new
//                                                     (never for a name it already has). The page keeps it and gives it back as `names`.
// @param {Function} [props.onClearFilters]            `() => void`: «Clear filters» (the bar's button and the chips' one) calls it instead of
//                                                     writing its own patch, so the page clears all it holds (D4); the focus still goes
//                                                     to the first pill.
//
// redesign drivers FA (D5, auditor 1): one more opt-in prop, for the page whose Driver pill is not the kit's (/intelligence/drivers).
// Without it the bar paints the kit's DriverPill, as every report does.
// @param {Function} [props.driverPill]                A React component painted instead of the kit's DriverPill, in the same place, only
//                                                     when `pills` includes `driver`. It is given `{ label, value, filterList, selected,
//                                                     onSetIds, onClear, onLearn }`: `value` is what the kit's pill is given; `selected` is
//                                                     `filterList.drivers_ids` as a list; `onSetIds(ids)` sets the whole list at once (a group
//                                                     checkbox marks several drivers) with the debounce, and an empty list is null;
//                                                     `onClear()` is `onSetIds([])`; `onLearn('drivers', [[id, name], …])` lets the chips and
//                                                     the pill read the names. The chips, the count in «Clear filters», `hasFilters` and the
//                                                     focus after the last chip are the bar's, as for the kit's pill.

// redesign reports FB2 (D4, RP-10): the keys of the page's filters that «Clear filters» of a report sets to null (the ones of the
// controller of `main`: AdvancedReports:27-40; `from`, `to`, `timeZone` and `countryCode` are not here)
const REPORT_FILTER_KEYS = ['businessIds', 'franchises_id', 'drivers_ids', 'driver_companies_ids', 'driver_groups_ids', 'delivery_types_ids', 'app_ids']
const DEFAULT_PILLS = ['stores', 'brand', 'country', 'zone']
// redesign reports R1 (Q-01, Q-03): the empty memory of the bar, and the shape of the `names` prop (the page starts from this one)
export const EMPTY_REPORT_NAMES = { stores: {}, brands: {}, countries: {}, drivers: {}, groups: {}, channels: {}, members: {} }
// a name the bar has learned may be a list (the drivers of a group): the same list is not a change
const sameName = (a, b) => a === b || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => item === b[index]))

// redesign drivers R1 (F1): what the driver pill says of the ids it holds. The name of a PERSON is written as it is: `pillText` cuts the
// label from the front of a name (made for the groups of the API that already carry it, «Driver Group: Shipday»), and that turned a driver
// called «Driver Test» into «Test». The rest is `pillText`: a name nobody gave is a count (a figure).
const personPillText = (ids, nameOf) => {
  if (ids.length === 0) return ''
  if (ids.length === 1 && nameOf(ids[0]) != null) return String(nameOf(ids[0]))
  return figure(ids.length)
}

const PAGE_SIZE = 10
// redesign the sizes `main` offered in the stores list
const PAGE_SIZES = [10, 25, 50]
// Stores and Brand apply on every check; the page controller waits before it asks for the ten reports
const DEBOUNCE = { debounce: true }
// `logo` joins the fields `main` asked for, for the logo in each row (C12, C18)
const STORE_FIELDS = ['id', 'name', 'logo', 'slug', 'franchise_id']

// ---- Single choice ---------------------------------------------------------------------------------------------------------------
// redesign bi FB2 (BI-14, BI-18): a radio group whose arrows MOVE the focus and do not choose (Enter or Space chooses): a choice
// that applies a filter or closes the popover cannot be made by passing over an option, and the Time zone list has hundreds. One tab
// stop (the chosen option, else the one the focus is on, else the first). The look is the Product radio's (`odc-radio`, radio-group.css).

const ChoiceList = ({ label, options, value, onPick }) => {
  const listRef = useRef(null)
  const checkedRef = useRef(null)
  const [stop, setStop] = useState(null)
  const checkedValue = options.some(option => option.value === value) ? value : undefined
  const tabValue = options.some(option => option.value === stop) ? stop : (checkedValue ?? options[0]?.value)

  // the chosen option is in view when the popover opens (a list of 400 zones)
  useEffect(() => {
    const list = listRef.current
    const node = checkedRef.current
    if (!list || !node) return
    list.scrollTop = Math.max(0, node.offsetTop - (list.clientHeight - node.offsetHeight) / 2)
  }, [])

  const handleKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const radios = Array.from(listRef.current.querySelectorAll('[role="radio"]'))
    const index = radios.indexOf(event.target.closest?.('[role="radio"]'))
    if (index < 0) return
    const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: radios.length - 1 }[event.key]
    if (target === undefined) return
    event.preventDefault()
    if (radios[target]) radios[target].focus()
    else if (event.key === 'ArrowUp') listRef.current.closest('.odc-bi-picker')?.querySelector('input[type="search"]')?.focus()
  }

  return (
    <div
      ref={listRef}
      role='radiogroup'
      aria-label={label}
      className='odc-orders-checklist odc-orders-picker-list odc-bi-choices'
      onKeyDown={handleKeyDown}
    >
      {options.map(option => {
        const checked = option.value === checkedValue
        return (
          <button
            key={option.value}
            ref={checked ? checkedRef : undefined}
            type='button'
            role='radio'
            aria-checked={checked}
            tabIndex={option.value === tabValue ? 0 : -1}
            data-checked={checked ? '' : undefined}
            className='odc-radio odc-bi-choice'
            onFocus={() => setStop(option.value)}
            onClick={() => onPick(option.value)}
          >
            <span className='odc-radio-box' aria-hidden='true'>{checked && <span className='odc-radio-dot' />}</span>
            <span className='odc-radio-text'><span className='odc-radio-label'>{option.label}</span></span>
          </button>
        )
      })}
    </div>
  )
}

// ArrowDown from the search field goes into the list (the checkbox lists get it from FilterPopover; the radios do not)
const enterChoices = (event) => {
  if (event.key !== 'ArrowDown' || !event.target.matches?.('input[type="search"]')) return
  const first = event.currentTarget.querySelector('[role="radio"][tabindex="0"]') ?? event.currentTarget.querySelector('[role="radio"]')
  if (!first) return
  event.preventDefault()
  first.focus()
}

// ---- Stores ----------------------------------------------------------------------------------------------------------------------
// redesign bi FB2 (auditor 5, BI-10): the controller is mounted with the popover (the popup unmounts on close): each opening asks for the
// first page again, scoped by the brand and the country the page holds at that moment, and the search starts empty. Its own selection
// (`businessIds`, «All», «Filter») is not used: the checks are `filterList.businessIds`, and «All» of the page is this file's.

const StoresBody = (props) => {
  const { label, selected, onToggle, onTogglePage, onClear, onLearn, businessList, handleChangeBusinessPage, handleChangeBusinessPageSize, onSearch } = props
  const [, t] = useLanguage()
  const texts = useSearchTexts(label)
  const search = useServerSearch(onSearch)
  const businesses = asList(businessList?.businesses)
  const loading = Boolean(businessList?.loading)
  const pagination = businessList?.pagination

  useEffect(() => {
    if (!loading && businesses.length > 0) onLearn('stores', businesses.map(business => [business.id, business.name]))
  }, [businessList?.businesses, loading])

  const knownTotal = Number.isFinite(Number(pagination?.total)) ? Number(pagination.total) : undefined
  // (owner decision 3 of the parity audit, 2026-10-27): main's «All» marks or unmarks every store of the visible page,
  // and the selection adds up across pages (C/components/AnalyticsBusinessFilter:51-68)
  const pageOn = businesses.filter(business => selected.includes(business.id)).length
  const pageAll = pageOn === 0 ? false : pageOn === businesses.length ? true : 'mixed'

  return (
    <div className='odc-orders-picker odc-bi-picker'>
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
      {loading
        ? <SkeletonRows label={label} />
        : (
          <div className='odc-orders-checklist odc-orders-picker-list' role='group' aria-label={label}>
            {onTogglePage && businesses.length > 0 && (
              <Checkbox checked={pageAll} onCheckedChange={() => onTogglePage(businesses)}>{t('ALL', 'All')}</Checkbox>
            )}
            {businesses.map(business => (
              <Checkbox key={business.id} checked={selected.includes(business.id)} onCheckedChange={() => onToggle(business)}>
                <span className='odc-orders-picker-row'>
                  <Avatar kind='business' name={business.name} src={business.logo} />
                  <span className='odc-orders-picker-name'>{business.name}</span>
                </span>
              </Checkbox>
            ))}
          </div>
          )}
      {!loading && businesses.length === 0 && (
        <p className='odc-orders-picker-empty' role='status'>{texts.noResultsLabel}</p>
      )}
      {/* redesign (regression): `main` let the person pick 10, 25 or 50 per page and go to any page; with only previous / next,
          page 9 of 84 stores was eight clicks. The foot stays while there is more than the smallest page (a size of 50 over 30 stores is
          one page, and the person still needs the selector to go back to 10). Pagination's page field is the way to any page. */}
      {pagination && (pagination.total_pages > 1 || (knownTotal ?? 0) > PAGE_SIZES[0]) && (
        <Pagination
          className='odc-bi-picker-pager'
          page={pagination.current_page}
          pageSize={pagination.page_size ?? PAGE_SIZE}
          total={knownTotal}
          hasMore={pagination.current_page < pagination.total_pages}
          itemCount={businesses.length}
          busy={loading}
          onPageChange={handleChangeBusinessPage}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={handleChangeBusinessPageSize ? (size) => handleChangeBusinessPageSize(size) : undefined}
          showPageInput
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
          pageLabel={t('PAGE', 'Page')}
          pageOfLabel={(totalPages, figureOf) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages }, figureOf)}
          rangeLabel={(from, to, total, figureOf) => (total == null
            ? <>{figureOf(from)}–{figureOf(to)}</>
            : fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figureOf))}
          pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
        />
      )}
      {selected.length > 0 && <PopoverFoot onClear={onClear} clearLabel={texts.clearLabel} />}
    </div>
  )
}

// redesign reports FB2 (D4; report 10): `byBrand` false does not scope the stores by the brand (`isFranchise` of `main` off, and
// no franchise filter in what the controller is given)
const StoresPill = ({ label, value, filterList, countryCode, selected, onToggle, onTogglePage, onClear, onLearn, byBrand = true }) => (
  <FilterPopover
    icon={Store}
    label={label}
    value={value}
    priority='secondary'
    popupClassName='odc-orders-checklist-popup odc-orders-picker-popup'
  >
    <StoresController
      UIComponent={StoresBody}
      isFranchise={byBrand}
      isSearchByName
      propsToFetch={STORE_FIELDS}
      filterList={byBrand ? filterList : { ...filterList, franchises_id: null }}
      countryCode={countryCode}
      label={label}
      selected={selected}
      onToggle={onToggle}
      onTogglePage={onTogglePage}
      onClear={onClear}
      onLearn={onLearn}
    />
  </FilterPopover>
)

// ---- Brand -----------------------------------------------------------------------------------------------------------------------
// Every brand of the project at once, as `main`: no pager, a local search. redesign bi R1 (P-a, parity): the controller is mounted with
// the popover, as Stores is (the popup unmounts on close), so GET franchises goes out each time it opens, as `main` did with its
// modal. `ChecklistPopover` does not export its body, so the list is painted here with the same classes and parts (Checkbox, a local
// search, «Clear»). The value of the pill comes from `filterList.franchises_id` and the names the bar has seen, not from this list.

const BrandBody = (props) => {
  const { label, selected, onToggle, onClear, onLearn, brandList } = props
  const texts = useSearchTexts(label)
  const [query, setQuery] = useState('')
  const brands = asList(brandList?.brands)
  const loading = Boolean(brandList?.loading)

  useEffect(() => {
    if (brands.length > 0) onLearn('brands', brands.map(brand => [brand.id, brand.name]))
  }, [brandList?.brands])

  const needle = query.trim().toLocaleLowerCase()
  const shown = needle ? brands.filter(brand => String(brand.name ?? '').toLocaleLowerCase().includes(needle)) : brands

  return (
    <div className='odc-orders-picker odc-bi-picker'>
      <SearchField
        className='odc-orders-picker-search'
        value={query}
        onChange={setQuery}
        label={texts.fieldLabel}
        placeholder={texts.searchLabel}
        clearLabel={texts.clearSearchLabel}
      />
      {loading
        ? <SkeletonRows label={label} />
        : (
          <div className='odc-orders-checklist odc-orders-picker-list' role='group' aria-label={label}>
            {shown.map(brand => (
              <Checkbox key={brand.id} checked={selected.includes(brand.id)} onCheckedChange={() => onToggle(brand.id)}>
                <span className='odc-orders-picker-row'>
                  <span className='odc-orders-picker-name'>{brand.name ?? ''}</span>
                </span>
              </Checkbox>
            ))}
          </div>
          )}
      {!loading && shown.length === 0 && (
        <p className='odc-orders-picker-empty' role='status'>{texts.noResultsLabel}</p>
      )}
      {selected.length > 0 && <PopoverFoot onClear={onClear} clearLabel={texts.clearLabel} />}
    </div>
  )
}

const BrandPill = ({ label, value, filterList, selected, onToggle, onClear, onLearn }) => (
  <FilterPopover
    icon={LayoutGrid}
    label={label}
    value={value}
    priority='secondary'
    popupClassName='odc-orders-checklist-popup odc-orders-picker-popup'
  >
    <BrandController
      UIComponent={BrandBody}
      propsToFetch={['id', 'name', 'enabled']}
      filterList={filterList}
      label={label}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
      onLearn={onLearn}
    />
  </FilterPopover>
)

// ---- Country ---------------------------------------------------------------------------------------------------------------------
// The semantics of `main` (BI-19), not made better: choosing only sets the code of the controller; «Filter» runs its apply and
// closes. Level 0: it only clears the stores and scopes the list of stores (the reports never get the country). Level 2: the stores
// of the country become `businessIds`. The page's `handleChangeCode` turns the same code back into '' (pressing «Filter» with the
// active country removes it). The controller lives with the pill, not with the popover, as `main`'s modal did: the countries load
// once and decide whether the popover opens by itself.

const CountryBody = ({ label, countries, loading, busy, code, setCode, countryCode, onApply, onSearch, close }) => {
  const [, t] = useLanguage()
  const texts = useSearchTexts(label)
  const search = useServerSearch(onSearch)
  // redesign bi FB2 (BI-19, a defect of `main` fixed in the UI): the choice the controller holds starts from the active country each
  // time the popover opens. `main` kept the last choice for ever (its modal never unmounted the controller), so a choice never applied
  // (X, backdrop) came back as if it were the filter, and so did the country that the toggle had just taken away.
  useEffect(() => { setCode(countryCode) }, [])
  // the controller keeps the search text: a list searched in a popover that closes goes back to all of them
  useEffect(() => () => { if (search.touched.current) onSearch?.(null) }, [])

  const options = countries.map(country => ({ value: country.code, label: country.name }))
  const waiting = loading || busy

  return (
    <div className='odc-orders-picker odc-bi-picker' onKeyDown={enterChoices}>
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
      {waiting
        ? <SkeletonRows label={label} />
        : <ChoiceList label={label} options={options} value={code} onPick={setCode} />}
      {!waiting && options.length === 0 && (
        <p className='odc-orders-picker-empty' role='status'>{texts.noResultsLabel}</p>
      )}
      <div className='odc-orders-popover-foot'>
        <Button variant='primary' size='sm' disabled={loading} onClick={() => { onApply(); close() }}>
          {t('FILTER', 'Filter')}
        </Button>
      </div>
    </div>
  )
}

const CountryUI = (props) => {
  const { label, value, countryCode, onLearn, countriesState, code, setCode, handleClickFilterButton, handleChangeCode, onSearch, actionState, whenMany, countryOpensItself, onCountryOpened } = props
  const countries = asList(countriesState?.countries)
  const loading = Boolean(countriesState?.loading)

  // redesign bi FB2 (auditor 6): with more than one country the popover opens when the countries first load, as `main`'s modal did. Decided once,
  // on that first load (a later search that narrows the list must not open it again); the pill is remounted open by its key.
  // redesign (D-21, option B): «there are several countries» (the pill exists) is one decision and «it opens by itself» is another:
  // a page that mounts the bar again for each report opens it only the first time of the visit (`countryOpensItself` false afterwards), and the
  // pill is still there, closed.
  // Both are taken on that first load and kept: the page flipping the prop later (it does so once the pill opened) must not close the popover.
  const decided = useRef(null)
  if (decided.current === null && !loading) {
    const several = countries.length > 1
    // redesign (row 3, review F-3): a code that came with the address and is not a country of the project is dropped, once,
    // on this first load (a later search narrows the list and must drop nothing)
    const wanted = String(countryCode ?? '').toUpperCase()
    const unknown = wanted !== '' && countries.length > 0 && !countries.some(country => String(country?.code ?? '').toUpperCase() === wanted)
    decided.current = { several, opens: several && countryOpensItself !== false, unknown }
  }
  const severalCountries = Boolean(decided.current?.several)
  const opensItself = Boolean(decided.current?.opens)

  useEffect(() => {
    if (opensItself) onCountryOpened?.()
  }, [opensItself])

  useEffect(() => {
    if (decided.current?.unknown) handleChangeCode?.('')
  }, [Boolean(decided.current?.unknown)])

  useEffect(() => {
    if (countries.length > 0) onLearn('countries', countries.map(country => [country.code, country.name]))
  }, [countriesState?.countries])

  // redesign reports FB2 (D4; auditor 6): `main` has the button only if the project has more than one country (isOneMoreCountry).
  // While the countries load, and with one, there is no pill; the decision is the one above, taken once on the first load.
  if (whenMany && !severalCountries) return null

  return (
    <FilterPopover
      key={opensItself ? 'opens' : 'rests'}
      defaultOpen={opensItself}
      icon={Globe}
      label={label}
      value={value}
      priority='secondary'
      popupClassName='odc-orders-checklist-popup odc-orders-picker-popup'
    >
      {({ close }) => (
        <CountryBody
          label={label}
          countries={countries}
          loading={loading}
          busy={Boolean(actionState?.loading)}
          code={code}
          setCode={setCode}
          countryCode={countryCode}
          onApply={handleClickFilterButton}
          onSearch={onSearch}
          close={close}
        />
      )}
    </FilterPopover>
  )
}

const CountryPill = (props) => (
  <CountryController
    UIComponent={CountryUI}
    isSearchByName
    countryCode={props.countryCode}
    filterList={props.filterList}
    handleChangeFilterList={props.handleChangeFilterList}
    handleChangeCode={props.handleChangeCode}
    label={props.label}
    value={props.value}
    onLearn={props.onLearn}
    whenMany={props.whenMany}
    countryOpensItself={props.countryOpensItself}
    onCountryOpened={props.onCountryOpened}
  />
)

// ---- Time zone -------------------------------------------------------------------------------------------------------------------

// The zones of the project (config/constants.js), each written as the reports ask for it (normalizeTimezone: «Europe/Kiev» is «Europe/Kyiv»)
const ZONES = Array.from(new Set(timezones.map(zone => normalizeTimezone(zone))))

const TimeZoneBody = ({ label, active, onPick, close }) => {
  const texts = useSearchTexts(label)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase()
  const options = useMemo(() => ZONES
    .filter(zone => !needle || zone.toLocaleLowerCase().includes(needle))
    .map(zone => ({ value: zone, label: zone })), [needle])

  return (
    <div className='odc-orders-picker odc-bi-picker' onKeyDown={enterChoices}>
      <SearchField
        className='odc-orders-picker-search'
        value={query}
        onChange={setQuery}
        label={texts.fieldLabel}
        placeholder={texts.searchLabel}
        clearLabel={texts.clearSearchLabel}
      />
      {options.length > 0
        ? <ChoiceList label={label} options={options} value={active} onPick={(zone) => { onPick(zone); close() }} />
        : <p className='odc-orders-picker-empty' role='status'>{texts.noResultsLabel}</p>}
    </div>
  )
}

const TimeZonePill = ({ label, value, onPick }) => (
  <FilterPopover
    icon={Clock}
    label={label}
    value={value}
    priority='secondary'
    popupClassName='odc-orders-checklist-popup odc-orders-picker-popup'
  >
    {({ close }) => <TimeZoneBody label={label} active={value} onPick={onPick} close={close} />}
  </FilterPopover>
)

// ---- Names of ids that arrive with the page ---------------------------------------------------------------------------------------
// redesign a shared link or a reload (`?stores=2&brands=1`) brings ids and no names: the bar only learns a name when a popover
// lists it. These two render nothing; they ask once for what the bar needs and hand it to `onLearn`, so the pills and the chips say the
// name as soon as it is known. Until then (and for an id nobody can name) a pill is a count, never the id.

// The brand controller of `main` fetches ALL the brands when it mounts, so one mount names every brand id of the page.
const BrandNamesUI = ({ brandList, onLearn, onDone }) => {
  const loading = Boolean(brandList?.loading)
  useEffect(() => {
    if (loading) return
    const brands = asList(brandList?.brands)
    if (brands.length > 0) onLearn('brands', brands.map(brand => [brand.id, brand.name]))
    onDone()
  }, [loading, brandList?.brands])
  return null
}

const BrandNames = ({ filterList, onLearn, onDone }) => (
  <BrandController
    UIComponent={BrandNamesUI}
    propsToFetch={['id', 'name', 'enabled']}
    filterList={filterList}
    onLearn={onLearn}
    onDone={onDone}
  />
)

// The stores controller of `main` can search by name but not by id, and its pages are of 10, so the ids of the page are asked for
// directly: the same endpoints the controller uses (the SDK, or the backoffice list for a superadmin), only `id` and `name`, one request.
const STORE_LOOKUP_LIMIT = 100

const StoreNames = ({ ids, onLearn, onDone }) => {
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  useEffect(() => {
    let alive = true
    const asked = ids.slice(0, STORE_LOOKUP_LIMIT)
    const where = { conditions: asked.map(id => ({ attribute: 'id', value: id })), conector: 'OR' }
    const run = async () => {
      let content = null
      if (user?.level === 0) {
        const response = await fetch(
          `${ordering.root}/backoffice/businesses?params=id,name&page=1&page_size=${asked.length}&where=${JSON.stringify(where)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
        )
        content = await response.json()
      } else {
        const response = await ordering.businesses().asDashboard().select(['id', 'name']).where(where).get({ query: { page: 1, page_size: asked.length } })
        content = response.content
      }
      if (!content?.error && Array.isArray(content?.result)) onLearn('stores', content.result.map(business => [business.id, business.name]))
    }
    // a failed lookup leaves the count: nothing here is worth an error on the page
    run().catch(() => {}).finally(() => { if (alive) onDone(ids) })
    return () => { alive = false }
  }, [])
  return null
}

// ---- The bar -----------------------------------------------------------------------------------------------------------------------

export const ReportFilterPills = ({
  filterList,
  handleChangeFilterList,
  countryCode = '',
  handleChangeCode,
  flush = true,
  className,
  // redesign reports FB2 (D4, D5): opt-in, see the header
  pills: pillKeys,
  storesByBrand = true,
  driversByGroup = true,
  countryWhenMany = false,
  countryOpensItself = true,
  onCountryOpened,
  leading,
  // redesign reports R1 (Q-01, Q-02, Q-03): opt-in, see the header
  names: pageNames,
  onNamesChange,
  onClearFilters,
  // redesign drivers FA (D5, auditor 1): opt-in, see the header
  driverPill: DriverPillOverride
}) => {
  const [, t] = useLanguage()
  // the names the bar has seen (id → name), so a pill and a chip read a name when the list that brought it is no longer on screen.
  // redesign reports FB2: also drivers, driver groups and channels; `members` is the ids of the drivers of each group (not a name)
  const [ownNames, setOwnNames] = useState(EMPTY_REPORT_NAMES)
  // redesign reports R1 (Q-01, Q-03): a page that mounts the bar again for each report keeps the memory itself (`names`), or the names and
  // the drivers of each group are lost with every change of report
  const kept = pageNames !== undefined
  // redesign the lists already asked for to name the ids of the page (the brand list names every brand at once; the stores
  // are asked by id, so the ids asked are kept and an id nobody could name is not asked again)
  const [brandsAsked, setBrandsAsked] = useState(false)
  const [storesAsked, setStoresAsked] = useState([])
  const names = kept ? pageNames : ownNames
  // what `learn` reads: the latest object, also when it learns twice before the page has rendered again (the groups and their members)
  const latest = useRef({ kept, names, onNamesChange })
  latest.current = { kept, names, onNamesChange }
  const learn = useCallback((kind, entries) => {
    const learned = (current) => {
      let changed = false
      const next = { ...current[kind] }
      entries.forEach(([id, name]) => {
        if (name != null && !sameName(next[id], name)) {
          next[id] = name
          changed = true
        }
      })
      return changed ? { ...current, [kind]: next } : current
    }
    if (!latest.current.kept) {
      setOwnNames(learned)
      return
    }
    const current = latest.current.names
    const next = learned(current)
    if (next === current) return
    latest.current = { ...latest.current, names: next }
    latest.current.onNamesChange?.(next)
  }, [])

  const browserZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const storeIds = asList(filterList?.businessIds)
  const brandIds = asList(filterList?.franchises_id)
  const zone = normalizeTimezone(filterList?.timeZone)
  const zoneChanged = Boolean(zone) && zone !== normalizeTimezone(browserZone)

  // the whole object, as the page controller expects it; the second argument only when there is one
  const apply = (patch, options) => {
    const next = { ...filterList, ...patch }
    if (options) handleChangeFilterList?.(next, options)
    else handleChangeFilterList?.(next)
  }

  const labels = {
    stores: t('STORES', 'Stores'),
    brand: t('BRAND', 'Brand'),
    country: t('COUNTRY', 'Country'),
    zone: t('TIMEZONE', 'Timezone'),
    // redesign reports FB2: the texts `main` uses for its buttons («App id» is a technical text: the Channel of the period row is `CHANNEL`)
    driverGroup: t('DRIVER_GROUP', 'Driver group'),
    driver: t('DRIVER', 'Driver'),
    orderType: t('ORDER_TYPE', 'Order type'),
    channel: t('CHANNEL', 'Channel')
  }
  const storeName = (id) => names.stores[id]
  const brandName = (id) => names.brands[id]
  const countryName = names.countries[countryCode] ?? countryCode

  const setStores = (ids) => apply({ businessIds: orNull(ids) }, DEBOUNCE)
  const setBrands = (ids) => apply({ franchises_id: orNull(ids) }, DEBOUNCE)
  const toggleStore = (store) => {
    learn('stores', [[store.id, store.name]])
    setStores(toggled(storeIds, store.id))
  }
  // (owner decision 3): «All» of the visible page; with the whole page on it unmarks the page, otherwise it adds the rest
  const toggleStorePage = (stores) => {
    learn('stores', stores.map(store => [store.id, store.name]))
    const pageIds = stores.map(store => store.id)
    const wholePage = pageIds.every(id => storeIds.includes(id))
    setStores(wholePage ? storeIds.filter(id => !pageIds.includes(id)) : [...storeIds, ...pageIds.filter(id => !storeIds.includes(id))])
  }

  // redesign reports FB2 (D4, D5; RP-10, RP-18, RP-21): the pills of the report, and what each one holds. `pills` given = a report
  const reportMode = pillKeys !== undefined
  const pillList = reportMode ? pillKeys : DEFAULT_PILLS
  const has = (key) => pillList.includes(key)
  const groupIds = asList(filterList?.driver_groups_ids)
  const driverIds = asList(filterList?.drivers_ids)
  const orderTypeIds = asList(filterList?.delivery_types_ids)
  const channelIds = asList(filterList?.app_ids)
  const orderTypeNames = orderTypeLabels(t)
  const groupName = (id) => names.groups[id]
  const driverName = (id) => names.drivers[id]
  const channelName = (id) => names.channels[id]
  const orderTypeName = (id) => orderTypeNames[id]
  // the same pattern as Stores: nothing checked is null (RP-10), every check applies at once with a debounce
  const setIdsOf = (key) => (ids) => apply({ [key]: orNull(ids) }, DEBOUNCE)
  const toggleIn = (key, ids, kind) => (id, name) => {
    if (kind) learn(kind, [[id, name]])
    setIdsOf(key)(toggled(ids, id))
  }
  // the drivers the groups chosen allow (availableDriverIds of `main`): known only for the groups whose list the bar has seen, so a
  // group it has not seen leaves the list of drivers whole rather than hiding drivers of that group
  const availableDriverIds = !driversByGroup || groupIds.length === 0 || !groupIds.every(id => names.members[id] != null)
    ? undefined
    : Array.from(new Set(groupIds.flatMap(id => names.members[id])))
  // a text that depends on the data is a map of literal t() calls (the i18n scanner reads literals only)
  const countTexts = {
    // redesign reports R1 (Q-01): a brand nobody named never shows its id in a report (Business keeps its chip as it was)
    brand: [t('ENTERPRISE_REPORT_BRANDS_COUNT_ONE', '_count_ brand'), t('ENTERPRISE_REPORT_BRANDS_COUNT_OTHER', '_count_ brands')],
    driverGroup: [t('ENTERPRISE_REPORT_DRIVER_GROUPS_COUNT_ONE', '_count_ driver group'), t('ENTERPRISE_REPORT_DRIVER_GROUPS_COUNT_OTHER', '_count_ driver groups')],
    driver: [t('ENTERPRISE_REPORT_DRIVERS_COUNT_ONE', '_count_ driver'), t('ENTERPRISE_REPORT_DRIVERS_COUNT_OTHER', '_count_ drivers')],
    orderType: [t('ENTERPRISE_REPORT_ORDER_TYPES_COUNT_ONE', '_count_ order type'), t('ENTERPRISE_REPORT_ORDER_TYPES_COUNT_OTHER', '_count_ order types')],
    channel: [t('ENTERPRISE_REPORT_CHANNELS_COUNT_ONE', '_count_ channel'), t('ENTERPRISE_REPORT_CHANNELS_COUNT_OTHER', '_count_ channels')]
  }

  // the values of the pills the report does not show are not this bar's: no chip, and they do not make «Clear filters» appear
  const hasFilters = (has('stores') && storeIds.length > 0) ||
    (has('brand') && brandIds.length > 0) ||
    (has('country') && Boolean(countryCode)) ||
    (has('zone') && zoneChanged) ||
    (has('driverGroup') && groupIds.length > 0) ||
    (has('driver') && driverIds.length > 0) ||
    (has('orderType') && orderTypeIds.length > 0) ||
    (has('channel') && channelIds.length > 0)
  const clearText = t('CLEAR_FILTERS', 'Clear filters')

  // redesign bi R1 (F2): removing the last chip, or «Clear filters», takes the control that had the focus out of the page and the browser
  // drops the focus on <body> (FilterChips can only pass it to a chip that is left, and this bar has no «+N» nor search field for
  // FilterBar's own fallback). The pending move is kept here and done after the render that removed them: to the first pill.
  const barId = useId()
  const focusFirstPill = useRef(false)

  // «Clear filters» is the defaults of the page for these four; the period and the channel have their own controls
  // redesign reports FB2 (D4): in a report it is every filter key of the page, the ones of pills it does not show too (a value left by
  // another report would otherwise stay in the request); `from` and `to` are not touched
  const clearFilters = () => {
    focusFirstPill.current = true
    // redesign reports R1 (Q-02, D4): the page clears all it holds (the brand of a report with no Brand pill too), the country and the zone
    if (onClearFilters) {
      onClearFilters()
      return
    }
    const cleared = reportMode
      ? Object.fromEntries(REPORT_FILTER_KEYS.map(key => [key, null]))
      : { businessIds: null, franchises_id: null }
    apply({ ...cleared, timeZone: browserZone })
    if (countryCode) handleChangeCode?.('')
  }

  const chips = (() => {
    const entries = []
    const add = (key, name, value, onRemove) => entries.push({
      key,
      label: `${name}: ${value}`,
      removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', `${name} ${value}`),
      onRemove
    })
    // redesign reports FB2 (D4, D5): one chip per value of each new pill, with the pattern of Stores below: a name the bar does not
    // know reads as a count («_count_ drivers»), one chip for all of them, whose × removes all of them at once
    // redesign drivers R1 (F1): `verbatim` (the driver) writes the name as it is, without cutting the label from its front
    const addIdChips = (kind, label, ids, nameOf, setIds, verbatim = false) => {
      const namedIds = ids.filter(id => nameOf(id) != null)
      const unnamedIds = ids.filter(id => nameOf(id) == null)
      namedIds.forEach(id => add(`${kind}-${id}`, label, verbatim ? String(nameOf(id)) : withoutLeadingLabel(label, String(nameOf(id))), () => setIds(ids.filter(other => other !== id))))
      if (unnamedIds.length > 0) {
        const count = unnamedIds.length
        const template = countTexts[kind][count === 1 ? 0 : 1]
        entries.push({
          key: `${kind}-unnamed`,
          label: <>{fillTemplate(template, { count }, figure)}</>,
          removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', template.replace('_count_', String(count))),
          onRemove: () => setIds(namedIds)
        })
      }
    }
    // the chips follow the order of the pills; each chip only for a pill the bar paints
    const chipsOf = {
      stores: () => {
        // redesign bi R1 (P-c): the stores whose name the bar does not know (the ones a country brought at level 2, a store of another
        // page) never show their id: they are one chip, «_count_ stores», whose × removes all of them at once
        const namedStoreIds = storeIds.filter(id => storeName(id) != null)
        const unnamedStoreIds = storeIds.filter(id => storeName(id) == null)
        namedStoreIds.forEach(id => add(`store-${id}`, labels.stores, withoutLeadingLabel(labels.stores, String(storeName(id))), () => setStores(storeIds.filter(other => other !== id))))
        if (unnamedStoreIds.length > 0) {
          const count = unnamedStoreIds.length
          const template = count === 1
            ? t('BUSINESS_REPORTS_STORES_COUNT_ONE', '_count_ store')
            : t('BUSINESS_REPORTS_STORES_COUNT_OTHER', '_count_ stores')
          entries.push({
            key: 'stores-unnamed',
            label: <>{fillTemplate(template, { count }, figure)}</>,
            removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', template.replace('_count_', String(count))),
            onRemove: () => setStores(namedStoreIds)
          })
        }
      },
      // redesign reports R1 (Q-01): in a report a brand whose name is not known is a count, like the stores, never its id
      brand: () => (reportMode
        ? addIdChips('brand', labels.brand, brandIds, brandName, setBrands)
        : brandIds.forEach(id => add(`brand-${id}`, labels.brand, withoutLeadingLabel(labels.brand, String(brandName(id) ?? id)), () => setBrands(brandIds.filter(other => other !== id))))),
      country: () => { if (countryCode) add('country', labels.country, withoutLeadingLabel(labels.country, String(countryName)), () => handleChangeCode?.('')) },
      zone: () => { if (zoneChanged) add('zone', labels.zone, zone, () => apply({ timeZone: browserZone })) },
      driverGroup: () => addIdChips('driverGroup', labels.driverGroup, groupIds, groupName, setIdsOf('driver_groups_ids')),
      driver: () => addIdChips('driver', labels.driver, driverIds, driverName, setIdsOf('drivers_ids'), true), // redesign drivers R1 (F1)
      orderType: () => addIdChips('orderType', labels.orderType, orderTypeIds, orderTypeName, setIdsOf('delivery_types_ids')),
      channel: () => addIdChips('channel', labels.channel, channelIds, channelName, setIdsOf('app_ids'))
    }
    pillList.forEach(key => chipsOf[key]?.())
    // the last chip leaves with the focus on its ×: remember to take it to the first pill
    return entries.map(entry => (entries.length === 1
      ? { ...entry, onRemove: () => { focusFirstPill.current = true; entry.onRemove() } }
      : entry))
  })()

  // after every render: if a removal left the bar with no chip and the focus fell to <body> (or to a node that is gone), the first pill takes it.
  // A focus that is somewhere else (the user moved on, or a popover has it) is left alone.
  useLayoutEffect(() => {
    if (!focusFirstPill.current || chips.length > 0) return
    focusFirstPill.current = false
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    document.getElementById(barId)?.querySelector('.odc-pill')?.focus()
  })

  // redesign reports FB2: the pills in the order the report asks for (by default the four of Business), after `leading`
  const pillOf = {
    stores: () => (
      <StoresPill
        label={labels.stores}
        value={pillText(labels.stores, storeIds, storeName)}
        filterList={filterList}
        countryCode={countryCode}
        selected={storeIds}
        onToggle={toggleStore}
        onTogglePage={toggleStorePage}
        onClear={() => setStores([])}
        onLearn={learn}
        byBrand={storesByBrand}
      />
    ),
    brand: () => (
      <BrandPill
        label={labels.brand}
        value={pillText(labels.brand, brandIds, brandName)}
        filterList={filterList}
        selected={brandIds}
        onToggle={(id) => setBrands(toggled(brandIds, id))}
        onClear={() => setBrands([])}
        onLearn={learn}
      />
    ),
    country: () => (
      <CountryPill
        label={labels.country}
        value={countryCode ? withoutLeadingLabel(labels.country, String(countryName)) : t('ALL', 'All')}
        countryCode={countryCode}
        filterList={filterList}
        handleChangeFilterList={handleChangeFilterList}
        handleChangeCode={handleChangeCode}
        onLearn={learn}
        whenMany={countryWhenMany}
        countryOpensItself={countryOpensItself}
        onCountryOpened={onCountryOpened}
      />
    ),
    zone: () => (
      <TimeZonePill
        label={labels.zone}
        value={zone}
        onPick={(next) => apply({ timeZone: next })}
      />
    ),
    driverGroup: () => (
      <DriverGroupPill
        label={labels.driverGroup}
        value={pillText(labels.driverGroup, groupIds, groupName)}
        filterList={filterList}
        selected={groupIds}
        onToggle={toggleIn('driver_groups_ids', groupIds, 'groups')}
        onClear={() => setIdsOf('driver_groups_ids')([])}
        onLearn={learn}
      />
    ),
    // redesign drivers FA (D5, auditor 1): the page's own pill instead of the kit's, in the same place; it sets the whole list at once
    driver: () => (DriverPillOverride
      ? (
        <DriverPillOverride
          label={labels.driver}
          value={personPillText(driverIds, driverName)} // redesign drivers R1 (F1)
          filterList={filterList}
          selected={driverIds}
          onSetIds={setIdsOf('drivers_ids')}
          onClear={() => setIdsOf('drivers_ids')([])}
          onLearn={learn}
        />
        )
      : (
        <DriverPill
          label={labels.driver}
          value={personPillText(driverIds, driverName)} // redesign drivers R1 (F1)
          filterList={filterList}
          selected={driverIds}
          onToggle={toggleIn('drivers_ids', driverIds, 'drivers')}
          onClear={() => setIdsOf('drivers_ids')([])}
          onLearn={learn}
          availableDriverIds={availableDriverIds}
        />
        )),
    orderType: () => (
      <OrderTypePill
        label={labels.orderType}
        value={pillText(labels.orderType, orderTypeIds, orderTypeName)}
        selected={orderTypeIds}
        onToggle={toggleIn('delivery_types_ids', orderTypeIds)}
        onClear={() => setIdsOf('delivery_types_ids')([])}
      />
    ),
    channel: () => (
      <ChannelPill
        label={labels.channel}
        value={pillText(labels.channel, channelIds, channelName)}
        filterList={filterList}
        selected={channelIds}
        onToggle={toggleIn('app_ids', channelIds, 'channels')}
        onClear={() => setIdsOf('app_ids')([])}
        onLearn={learn}
      />
    )
  }
  const pills = (
    <>
      {leading}
      {pillList.map(key => <React.Fragment key={key}>{pillOf[key]?.()}</React.Fragment>)}
    </>
  )

  // redesign what has an id and no name yet, for the pills this bar paints
  const unnamedBrandIds = has('brand') ? brandIds.filter(id => brandName(id) == null) : []
  const unnamedStoreIds = has('stores') ? storeIds.filter(id => storeName(id) == null && !storesAsked.includes(id)) : []

  return (
    <>
      {unnamedBrandIds.length > 0 && !brandsAsked && (
        <BrandNames filterList={filterList} onLearn={learn} onDone={() => setBrandsAsked(true)} />
      )}
      {unnamedStoreIds.length > 0 && (
        // one request at a time: the ids it asks for are the ones unnamed when it mounts, and it is mounted again (new key) only once those are
        // marked as asked, so the names it brings in do not start a second request for the ids it could not name
        <StoreNames
          key={storesAsked.join(',')}
          ids={unnamedStoreIds}
          onLearn={learn}
          onDone={(asked) => setStoresAsked(current => Array.from(new Set([...current, ...asked])))}
        />
      )}
    <FilterBar
      id={barId}
      flush={flush}
      className={cx('odc-bi-filters', className)}
      label={t('FILTERS', 'Filters')}
      filters={pills}
      clear={hasFilters ? <Button variant='ghost' onClick={clearFilters}>{clearText}</Button> : undefined}
      chips={chips.length > 0
        ? (
          <FilterChips
            label={t('FILTERS_ACTIVE', 'Active filters')}
            clearAllLabel={clearText}
            onClearAll={clearFilters}
            chips={chips}
          />
          )
        : undefined}
    />
    </>
  )
}
