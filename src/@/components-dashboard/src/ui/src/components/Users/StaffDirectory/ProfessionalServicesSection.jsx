import React, { useEffect, useId, useRef, useState } from 'react'

import { ProfessionalBusinessService as ProfessionalBusinessServiceController, useLanguage, useUtils } from '../../../../../index'
import { ChevronLeft, ChevronRight, CircleAlert } from '../../Shared/Icon'
import { Avatar, Button, ConfirmDialog, EmptyState, Pagination, SearchField, Skeleton, cx } from '../../Shared/Product'
import { ProfessionalServices } from '../ProfessionalServices'
import { userFullName } from '../../../../../utils/userContact'
import './professional-services.css'

// redesign (B1a, decisions 7 and 8): the Business & Services section of a professional's record, in place of main's
// Users/ProfessionalBusinessService. It is the UIComponent of K/ProfessionalBusinessService (untouched). The stores come as a list
// (name, logo, how many services this professional has there); a click opens the services of that store INSIDE the section, with a way
// back, instead of main's second side bar. Main's check boxes saved nothing (`businessIds` was never sent anywhere), so there are no
// check boxes, no «Select all / Select none» and no «You need to select a business».
// apply-list row 22 (users-professionals P-1): inside a store, "Remove from store" takes the professional out of all its services there
// in one go, after a question that says how many (the controller sends the same DELETE one unticked service sends, once per service).

// The wait before the search text reaches the controller; Enter and the clear button send at once
const SEARCH_DEBOUNCE_MS = 500
// The controller hands over every store that matches; the page is cut here, as main did
const PAGE_SIZES = [10, 25, 50] // review r1 #3: main's «Items per page»
const SKELETON_ROWS = 5

const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// The «back» arrow follows the reading direction (the same class P/IconButton uses)
const BackIcon = ({ className, ...props }) => <ChevronLeft {...props} className={cx(className, 'odc-icon-flip')} />

const RowsSkeleton = ({ label }) => (
  <div className='psv-skeleton' role='status' aria-busy='true'>
    <span className='odc-sr-only'>{label}</span>
    {Array.from({ length: SKELETON_ROWS }, (_, row) => (
      <div key={row} className='psv-skeleton-row'>
        <Skeleton shape='box' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
        <Skeleton size='40%' />
      </div>
    ))}
  </div>
)

/**
 * The UI of the section. Props from the controller: `searchValue`, `onSearch(text)`, `businessList` (`loading`, `businesses`, `error`),
 * `userServiceList` (`loading`, `services`), `handleUpdateServices(services)` and `handleRemoveBusinessServices(businessId)` (resolves
 * `{ removed, failed }`); from the host: `user`.
 */
export const ProfessionalServicesSectionUI = ({
  user,
  onSearch,
  businessList,
  userServiceList,
  handleUpdateServices,
  handleRemoveBusinessServices
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const headingId = useId()

  const businesses = businessList?.businesses ?? []
  // Before the controller's first read starts there is no list and nothing loading: that is not «no stores» (a hook: before any return)
  const asked = useRef(false)
  if (businessList?.loading) asked.current = true
  const allServices = Array.isArray(userServiceList?.services) ? userServiceList.services : []

  // ---- which view: the list (default) or the services of one store ------------------------------------------------------------
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const buttons = useRef(new Map())
  const backButton = useRef(null)
  const returnTo = useRef(null)

  // Opening the services puts the focus on the way back; going back puts it on the button of the store that was open.
  useEffect(() => {
    if (selected) {
      backButton.current?.focus()
    } else if (returnTo.current !== null) {
      buttons.current.get(returnTo.current)?.focus()
      returnTo.current = null
    }
  }, [selected])

  // ---- remove from store: the question (with the number it was asked about) and the wait ---------------------------------------
  const [confirm, setConfirm] = useState({ open: false, count: 0 }) // `count` stays while the question fades out
  const [removing, setRemoving] = useState(false)
  const removingNow = useRef(false) // a second click before the first render of `removing` must not send twice

  const open = (business) => {
    returnTo.current = business.id
    setSelected({ id: business.id, name: business.name })
  }

  // ---- search: typed here, sent after a wait (at once on Enter and on clear) ----------------------------------------------------
  const [searchText, setSearchText] = useState('')
  const searchTimer = useRef(null)
  const sentSearch = useRef('')
  const latestSearch = useRef(onSearch)
  latestSearch.current = onSearch
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    if (text === sentSearch.current) return
    sentSearch.current = text
    setPage(1)
    latestSearch.current?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => sendSearch(text), SEARCH_DEBOUNCE_MS)
  }

  // ---- the services of one store ----------------------------------------------------------------------------------------------
  if (selected) {
    const storeServices = allServices.filter((service) => service.business_id === selected.id)
    const confirmRemove = async () => {
      if (removingNow.current) return
      removingNow.current = true
      setRemoving(true)
      let outcome
      try {
        outcome = await handleRemoveBusinessServices?.(selected.id)
      } catch (error) {
        outcome = { removed: 0, failed: confirm.count }
      }
      removingNow.current = false
      setRemoving(false)
      setConfirm((current) => ({ ...current, open: false }))
      // everything gone: back to the stores (the focus goes to this store's button); otherwise stay with what is left
      if (outcome && outcome.failed === 0) setSelected(null)
    }
    const professionalName = userFullName(user) || t('CUSTOMERS_NO_NAME', 'No name')
    const confirmText = confirm.count === 1
      ? t('PROFESSIONALS_STORE_REMOVE_BODY_ONE', 'This removes 1 service from this professional at this store.')
      : t('PROFESSIONALS_STORE_REMOVE_BODY_OTHER', 'This removes _count_ services from this professional at this store.').replace('_count_', () => String(confirm.count))
    return (
      <div className='psv-root'>
        <div className='psv-detail-head'>
          <Button ref={backButton} variant='ghost' icon={BackIcon} onClick={() => setSelected(null)}>
            {t('PROFESSIONALS_BACK_TO_STORES', 'Back to stores')}
          </Button>
          <h3 className='psv-store-name'><bdi>{selected.name}</bdi></h3>
          {storeServices.length > 0 && (
            <Button onClick={() => setConfirm({ open: true, count: storeServices.length })}>
              {t('PROFESSIONALS_REMOVE_FROM_STORE', 'Remove from store')}
            </Button>
          )}
        </div>
        <ProfessionalServices
          businessId={selected.id}
          services={userServiceList?.services}
          userId={user?.id}
          handleUpdateServices={handleUpdateServices}
        />
        <ConfirmDialog
          open={confirm.open}
          tone='danger'
          title={t('PROFESSIONALS_STORE_REMOVE_TITLE', 'Remove _name_ from _store_?').replace('_name_', () => professionalName).replace('_store_', () => selected.name)}
          confirmLabel={t('PROFESSIONALS_STORE_REMOVE_CONFIRM', 'Remove')}
          cancelLabel={t('CANCEL', 'Cancel')}
          closeLabel={t('CLOSE', 'Close')}
          busy={removing}
          onCancel={() => setConfirm((current) => ({ ...current, open: false }))}
          onConfirm={confirmRemove}
        >
          {confirmText}
        </ConfirmDialog>
      </div>
    )
  }

  // ---- the list -----------------------------------------------------------------------------------------------------------------
  const loading = Boolean(businessList?.loading) || (!asked.current && businesses.length === 0 && !businessList?.error)
  // `error` stays in the controller's state after a later good read, so it only counts when there is nothing to show
  const failed = !loading && businesses.length === 0 && Boolean(businessList?.error)
  const servicesLoading = Boolean(userServiceList?.loading)

  const pageStart = (page - 1) * pageSize
  const shown = businesses.slice(pageStart, pageStart + pageSize)
  const searchLabel = t('PROFESSIONALS_SEARCH_STORES', 'Search stores')

  const countLabel = (count) => {
    if (count === 0) return t('PROFESSIONALS_SERVICES_COUNT_NONE', 'No services')
    if (count === 1) return t('PROFESSIONALS_SERVICES_COUNT_ONE', '1 service')
    return t('PROFESSIONALS_SERVICES_COUNT_OTHER', '_count_ services').replace('_count_', () => String(count))
  }

  let body
  if (loading) {
    body = <RowsSkeleton label={t('LOADING', 'Loading')} />
  } else if (failed) {
    body = <EmptyState tone='error' icon={CircleAlert} title={t('PROFESSIONALS_STORES_LOAD_ERROR', "We couldn't load the stores.")} />
  } else if (businesses.length === 0) {
    body = <EmptyState title={t('PROFESSIONALS_NO_STORES', 'No stores match this search')} />
  } else {
    body = (
      <ul className='psv-list' aria-labelledby={headingId}>
        {shown.map((business) => {
          const count = allServices.filter((service) => service.business_id === business.id).length
          return (
            <li key={business.id} className='psv-item'>
              <button
                type='button'
                className='psv-row'
                ref={(node) => { if (node) buttons.current.set(business.id, node); else buttons.current.delete(business.id) }}
                onClick={() => open(business)}
              >
                <Avatar kind='business' name={business.name} src={business.logo ? optimizeImage(business.logo) : undefined} />
                <bdi className='psv-name'>{business.name}</bdi>
                {/* a space between the two texts for the accessible name («Shop A 3 services»); it paints nothing between flex items */}
                {' '}
                {servicesLoading
                  ? <span className='psv-count-skeleton'><Skeleton /></span>
                  : <span className='psv-count'>{countLabel(count)}</span>}
                <ChevronRight className='odc-icon odc-icon-flip psv-chevron' />
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className='psv-root'>
      <h3 id={headingId} className='odc-sr-only'>{t('BUSINESS_AND_SERVICES', 'Business & Services')}</h3>
      <SearchField
        className='psv-search'
        value={searchText}
        onChange={typeSearch}
        onClear={() => sendSearch('')}
        onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
        label={searchLabel}
        placeholder={searchLabel}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />
      {body}
      {!loading && !failed && businesses.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={businesses.length}
          onPageChange={setPage}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size, nextPage) => { setPageSize(size); setPage(nextPage) }}
          pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          pageLabel={t('PAGE', 'Page')}
          rangeLabel={(from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(count) })}
          pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
        />
      )}
    </div>
  )
}

/**
 * The Business & Services section of a professional. `user` is the record (`user.id` asks for its services). Mounts
 * K/ProfessionalBusinessService with the same fields and name search as main, and `ProfessionalServicesSectionUI`. One controller per
 * professional (`key`).
 */
export const ProfessionalServicesSection = ({ user }) => (
  <ProfessionalBusinessServiceController
    key={user?.id}
    user={user}
    propsToFetch={['id', 'name', 'logo']}
    isSearchByName
    UIComponent={ProfessionalServicesSectionUI}
  />
)
