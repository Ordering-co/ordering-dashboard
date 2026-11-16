import React, { useEffect, useId, useRef, useState } from 'react'
import {
  useLanguage,
  useUtils,
  BusinessBrandBUSIDetail as BusinessBrandBUSIDetailController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { Store, TriangleAlert } from '../../Shared/Icon'
import {
  Avatar,
  Button,
  Checkbox,
  EmptyState,
  InlineNotice,
  Pagination,
  SearchField,
  Skeleton
} from '../../Shared/Product'
import './brand-stores.css'

// redesign SB-B4 (; decision 4; G5-45, M-SB2, M-SB7): the Stores tab of a brand on Product. One row per store with a
// checkbox that toggles the whole line (its name is the store's); a store that belongs to ANOTHER brand says «In <name>» (the name
// comes from the brand list the page already loaded; if it is not there, «In brand #id», auditor 6). «Select all» / «Select none» act
// on the stores of the page, and the text says so with the real count (auditor 3). The controller holds the saves: a store that is
// saving is in `businessList.pending`, one that failed is in `businessList.failures` (its box stays as it was and the row says why),
// and a failed load is `businessList.error` (an error with Retry, never «no results», M-SB7). Same requests, same export, same
// `propsToFetch` as `main`; the tab value `?tab=businesses` belongs to the brand list.
// redesign D-85 (owner, 2026-10-19; C8): taking stores that belong to ANOTHER brand asks first, from «Select all» and from the
// tick of one such store («Move _store_ from _from_ to _to_?»): the move cannot be told back later, the store keeps no trace of its old
// brand. Only that move asks: a store without a brand, «Select none» and unticking an own store stay immediate. Cancel writes nothing.

const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 5
const SEARCH_DEBOUNCE_MS = 750 // the lazy search of main (Shared/UI/SearchBar)

// «Showing _from_–_to_ of _total_»: P/Pagination hands the numbers as figure nodes (decision 11)
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const hasFailure = (failures, id) => Object.prototype.hasOwnProperty.call(failures, id)

const includesId = (ids, id) => {
  if (!ids) return false
  if (typeof ids.has === 'function') return ids.has(id)
  return Array.isArray(ids) && ids.includes(id)
}

const BusinessBrandBUSIDetailUI = (props) => {
  const {
    onSearch,
    businessList,
    brand,
    brandListState,
    handleChangeCheckBox,
    handleSelectAllBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    handleRetry
  } = props
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const { ask: askConfirm, dialog: confirmDialog } = useConfirmStep()
  const listId = useId()

  const [searchText, setSearchText] = useState('')
  const [searched, setSearched] = useState(false)
  const searchTimer = useRef(null)
  // 'all' | 'none' while a block saves, in series: the clicked button is busy and the other one waits
  const [selecting, setSelecting] = useState(null)
  const [blockFailedIds, setBlockFailedIds] = useState([])

  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    setSearched(Boolean(text))
    onSearch?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => sendSearch(text), SEARCH_DEBOUNCE_MS)
  }

  const rows = businessList?.businesses || []
  const loading = Boolean(businessList?.loading)
  const error = businessList?.error
  const failures = businessList?.failures || {}
  const pagination = businessList?.pagination
  const hasTotal = pagination?.total != null
  const failureCount = Object.keys(failures).length
  const brandName = (id) => (brandListState?.brands || []).find(item => String(item?.id) === String(id))?.name

  // «the brand of this store», as the row says it: its name, or «brand #id» when the loaded list does not have it
  const brandLabel = (id) => brandName(id) || t('BRAND_STORES_BRAND_ID', 'brand #_id_').replace('_id_', () => String(id))
  const belongsToOther = (business) => business.franchise_id != null && String(business.franchise_id) !== String(brand?.id)

  // redesign D-85: asks before the stores in `taking` (they belong to another brand) join this brand; resolves `true` to go on
  const confirmTaking = (taking) => {
    const sources = [...new Set(taking.map(business => String(business.franchise_id)))]
    const to = brand.name || ''
    let title
    if (taking.length === 1) {
      title = t('BRAND_STORES_MOVE_TITLE_ONE', 'Move _store_ from _from_ to _to_?')
        .replace('_store_', () => taking[0].name || '')
        .replace('_from_', () => brandLabel(taking[0].franchise_id))
        .replace('_to_', () => to)
    } else if (sources.length === 1) {
      title = t('BRAND_STORES_MOVE_TITLE_FROM', 'Move _count_ stores from _from_ to _to_?')
        .replace('_count_', String(taking.length))
        .replace('_from_', () => brandLabel(taking[0].franchise_id))
        .replace('_to_', () => to)
    } else {
      title = t('BRAND_STORES_MOVE_TITLE_OTHERS', 'Move _count_ stores from other brands to _to_?')
        .replace('_count_', String(taking.length))
        .replace('_to_', () => to)
    }
    return askConfirm({
      title,
      body: taking.length === 1
        ? t('BRAND_STORES_MOVE_BODY_ONE', "It leaves its current brand, and the dashboard can't tell later which brand it came from.")
        : t('BRAND_STORES_MOVE_BODY', "They leave their current brand, and the dashboard can't tell later which brand each one came from."),
      confirmLabel: taking.length === 1
        ? t('BRAND_STORES_MOVE_CONFIRM_ONE', 'Move store')
        : t('BRAND_STORES_MOVE_CONFIRM_OTHER', 'Move _count_ stores').replace('_count_', String(taking.length)),
      tone: 'danger'
    })
  }

  const runBlock = async (isAll) => {
    if (selecting || !brand) return
    // redesign D-85: «Select all» moves the stores of the page that belong to another brand; those are the ones to confirm
    if (isAll) {
      const taking = rows.filter(business => business.franchise_id !== brand.id && belongsToOther(business))
      if (taking.length && !(await confirmTaking(taking))) return
    }
    setSelecting(isAll ? 'all' : 'none')
    setBlockFailedIds([])
    const result = await handleSelectAllBusinesses(isAll, brand.id)
    setSelecting(null)
    setBlockFailedIds((result?.failed || []).map(item => item.id))
  }

  // the stores of the last block that are still failing: trying one again (or searching) takes it away
  const blockFailedCount = blockFailedIds.filter(id => hasFailure(failures, id)).length

  const errorText = (value) => translateApiMessage(t, firstMessage(value), undefined)

  const search = (
    <SearchField
      className='odc-brand-stores-search'
      value={searchText}
      onChange={typeSearch}
      onClear={() => sendSearch('')}
      onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
      label={t('BRAND_STORES_SEARCH', 'Search stores')}
      placeholder={t('BRAND_STORES_SEARCH', 'Search stores')}
      clearLabel={t('CLEAR_SEARCH', 'Clear search')}
    />
  )

  if (!brand) {
    return (
      <div className='odc-root odc-brand-stores'>
        {search}
        <p className='odc-brand-stores-empty'>{t('NO_SELECTED_BRAND', 'There is no selected brand')}</p>
      </div>
    )
  }

  const scopeText = rows.length === 1
    ? t('BRAND_STORES_PAGE_SCOPE_ONE', 'Applies to the _count_ store on this page')
    : t('BRAND_STORES_PAGE_SCOPE_OTHER', 'Applies to the _count_ stores on this page')

  const retry = <Button onClick={() => handleRetry?.()}>{t('RETRY', 'Retry')}</Button>

  const rowNote = (business) => {
    if (business.franchise_id == null || String(business.franchise_id) === String(brand.id)) return null
    const name = brandName(business.franchise_id)
    return name
      ? t('BRAND_STORES_IN_OTHER', 'In _name_').replace('_name_', () => name)
      : t('BRAND_STORES_IN_BRAND_ID', 'In brand #_id_').replace('_id_', () => String(business.franchise_id))
  }

  const renderRow = (business) => {
    const own = String(business.franchise_id) === String(brand.id)
    const pending = includesId(businessList?.pending, business.id)
    const failed = hasFailure(failures, business.id)
    const failure = failures[business.id]
    const note = rowNote(business)
    const noteId = `${listId}-note-${business.id}`
    const errorId = `${listId}-error-${business.id}`
    const describedBy = [note && noteId, failed && errorId].filter(Boolean).join(' ') || undefined
    return (
      <li key={business.id} className='odc-brand-store'>
        <Checkbox
          checked={own}
          aria-busy={pending ? 'true' : undefined}
          aria-describedby={describedBy}
          // a store that is saving keeps its focus and ignores a second click until the answer comes
          // redesign D-85: ticking a store of another brand asks first; Cancel leaves the box as it was (it is controlled)
          onCheckedChange={async (next) => {
            if (pending) return
            if (next && belongsToOther(business) && !(await confirmTaking([business]))) return
            handleChangeCheckBox({ target: { checked: next } }, business.id, brand.id)
          }}
        >
          <Avatar kind='business' name={business.name || ''} src={business.logo ? optimizeImage(business.logo, 'h_50,c_limit') : undefined} />
          <span className='odc-brand-store-name' dir='auto'>{business.name}</span>
        </Checkbox>
        {note && <p id={noteId} className='odc-brand-store-note' dir='auto'>{note}</p>}
        {failed && (
          // redesign SB-R1 (review R1-03): one failure is an alert; after a block with several, the summary notice is the one alert
          <p id={errorId} role={failureCount === 1 ? 'alert' : undefined} className='odc-brand-store-error' dir='auto'>
            <TriangleAlert className='odc-icon odc-brand-store-error-icon' />
            <span>{errorText(failure) || t('BRAND_STORES_ITEM_FAILED', "Couldn't update this store. Try again.")}</span>
          </p>
        )}
      </li>
    )
  }

  const listBody = () => {
    if (loading) {
      return (
        <div aria-busy='true'>
          <span className='odc-sr-only'>{t('STORES_LOADING', 'Loading stores')}</span>
          {[...Array(SKELETON_ROWS).keys()].map(index => (
            <div key={index} className='odc-brand-store-skeleton'>
              <Skeleton shape='box' size='var(--od-x-checkbox-box)' block='var(--od-x-checkbox-box)' />
              <Skeleton shape='box' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
              <Skeleton size='40%' />
            </div>
          ))}
        </div>
      )
    }
    if (error && rows.length === 0) {
      return (
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={t('STORES_LOAD_FAILED', "We couldn't load the stores.")}
          description={errorText(error)}
          action={retry}
        />
      )
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={Store}
          title={searched ? t('NO_RESULTS', 'No results') : t('NO_STORES_TO_SHOW', 'No stores to show')}
        />
      )
    }
    return (
      <>
        {error && (
          <InlineNotice tone='danger' icon={TriangleAlert} action={retry}>
            {errorText(error) || t('STORES_LOAD_FAILED', "We couldn't load the stores.")}
          </InlineNotice>
        )}
        <ul className='odc-brand-stores-list'>
          {rows.map(renderRow)}
        </ul>
      </>
    )
  }

  const foot = Number(pagination?.total_pages) > 1 && (
    <div className='odc-brand-stores-foot'>
      <Pagination
        page={Number(pagination.current_page) || 1}
        pageSize={Number(pagination.page_size) || PAGE_SIZES[0]}
        // the total when the API gives it; otherwise «there is more» from the page count
        total={hasTotal ? Number(pagination.total) : undefined}
        hasMore={hasTotal ? undefined : Number(pagination.current_page) < Number(pagination.total_pages)}
        itemCount={hasTotal ? undefined : rows.length}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={page => handleChangeBusinessPage?.(page)}
        onPageSizeChange={size => handleChangeBusinessPageSize?.(size)}
        busy={loading}
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
        rangeLabel={(from, to, total, node) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, node)}
        pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
      />
    </div>
  )

  const noActions = loading || rows.length === 0

  return (
    <div className='odc-root odc-brand-stores'>
      {search}
      <div className='odc-brand-stores-actions'>
        <Button size='sm' disabled={noActions} busy={selecting === 'all'} onClick={() => runBlock(true)}>
          {t('SELECT_ALL', 'Select all')}
        </Button>
        <Button size='sm' disabled={noActions} busy={selecting === 'none'} onClick={() => runBlock(false)}>
          {t('SELECT_NONE', 'Select none')}
        </Button>
        {!noActions && (
          <p className='odc-brand-stores-scope'>{scopeText.replace('_count_', String(rows.length))}{/* prose: no figure (decision 11) */}</p>
        )}
      </div>
      {blockFailedCount > 0 && (
        <InlineNotice tone='danger' icon={TriangleAlert} role={failureCount > 1 ? 'alert' : undefined}>
          {blockFailedCount === 1
            ? t('BRAND_STORES_BLOCK_FAILED_ONE', "_count_ store couldn't be changed").replace('_count_', '1')
            : t('BRAND_STORES_BLOCK_FAILED_OTHER', "_count_ stores couldn't be changed").replace('_count_', String(blockFailedCount))}
        </InlineNotice>
      )}
      {listBody()}
      {foot}
      {confirmDialog}
    </div>
  )
}

export const BusinessBrandBUSIDetail = (props) => {
  const businessBrandBUSIDetailProps = {
    ...props,
    UIComponent: BusinessBrandBUSIDetailUI,
    propsToFetch: ['id', 'name', 'logo', 'franchise_id'],
    isSearchByName: true
  }
  return <BusinessBrandBUSIDetailController {...businessBrandBUSIDetailProps} />
}
