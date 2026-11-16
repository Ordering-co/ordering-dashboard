import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { TriangleAlert } from '../../Shared/Icon'
import { Avatar, Button, Checkbox, InlineNotice, Pagination, SearchField, Skeleton } from '../../Shared/Product'
import { apiErrorText } from './BannerNameField'
import './banner-panel.css'

// redesign AB-B3 (decision 2; defects M-AB12, M-AB15, M-AB16): the businesses a «Business page» banner shows on. The controller owns the
// list, the selection and the page (K/BannerDetails); this draws them and saves in edit mode. Props:
//   - `mode`: 'create' (the list in the create form, no save) or 'edit' (the Businesses tab, with «Save businesses»);
//   - the controller's `businessList`, `selectedBusinessIds`, `handleSelectBusiness`, `handleSelectAllBusiness` (this page only),
//     `handleSelectEveryBusiness() → Promise<{ ok, error, count, stale }>` (every page, row 41), `handleChangeBusinessPage`,
//     `searchBusinesses`, `actionState`;
//   - `onSave() → Promise<{ ok, error }>` (edit): the panel wires it to `handleUpdateClick({ businesses: selectedBusinessIds })`.
// Not changed (decisions 1–4): the page buttons act on the visible page only and a banner keeps at least one business; the words say so.
// redesign (review F-2): they now do (`pageOnly`: add the page, take the page out), and «Clear selection» beside the count
// clears a selection that spans pages, which «Select none on this page» did in main.
// redesign (row 41, P-3): «Select all businesses» takes every enabled business of the search, on every page (the controller
// reads the ids in one request); busy while it loads, an inline notice if it fails. The page buttons stay.

const SEARCH_DEBOUNCE_MS = 300
const SKELETON_ROWS = 5

// «_count_ selected»: the number goes in a node of its own (`odc-figure`, decision 11) and keeps its direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const figureOf = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

export const BannerBusinesses = ({
  mode = 'edit',
  businessList,
  selectedBusinessIds,
  handleSelectBusiness,
  handleSelectAllBusiness,
  handleSelectEveryBusiness,
  handleChangeBusinessPage,
  searchBusinesses,
  actionState,
  onSave
}) => {
  const [, t] = useLanguage()
  const reasonId = useId()
  const editing = mode === 'edit'

  const businesses = businessList?.businesses ?? []
  const pagination = businessList?.pagination
  const loading = !!businessList?.loading
  const selected = Array.isArray(selectedBusinessIds) ? selectedBusinessIds : []
  // the same ids in a new array (the host merged the saved banner back) are the same selection
  const selectionKey = selected.map(String).sort().join(',')

  const [query, setQuery] = useState('')
  const searchRef = useRef(searchBusinesses)
  searchRef.current = searchBusinesses
  const searchTimer = useRef(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  // redesign (row 41): the read of every business: busy while it loads, how the last one ended (`failure` text or `none`)
  const [selectingAll, setSelectingAll] = useState(false)
  const selectingAllRef = useRef(false)
  const [selectAllNote, setSelectAllNote] = useState(null) // { failure } | { none: true } | null
  const [outcome, setOutcome] = useState(null) // { key, ok, message }: how the save of THAT selection ended
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(searchTimer.current) // a search pending when the list goes away is not sent
    }
  }, [])

  const search = (text) => {
    setQuery(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchRef.current?.(text), SEARCH_DEBOUNCE_MS)
  }

  const acting = !!actionState?.loading || saving || selectingAll

  const selectEvery = async () => {
    if (selectingAllRef.current || !handleSelectEveryBusiness) return
    selectingAllRef.current = true
    setSelectingAll(true)
    setSelectAllNote(null)
    let result
    try {
      result = await handleSelectEveryBusiness()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    selectingAllRef.current = false
    if (!mounted.current) return
    setSelectingAll(false)
    if (result && result.ok === false) {
      setSelectAllNote({ failure: apiErrorText(t, result.error, t('AD_BANNERS_SELECT_ALL_FAILED', "We couldn't select all the businesses. Try again.")) })
    } else if (result && result.count === 0) {
      setSelectAllNote({ none: true })
    }
  }

  const save = async () => {
    if (savingRef.current || selected.length === 0 || !onSave) return
    savingRef.current = true
    setSaving(true)
    setOutcome(null)
    const key = selectionKey
    let result
    try {
      result = await onSave()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    savingRef.current = false
    if (!mounted.current) return
    setSaving(false)
    setOutcome(result && result.ok === false
      ? { key, ok: false, message: apiErrorText(t, result.error, t('AD_BANNERS_SAVE_BUSINESSES_FAILED', "We couldn't save the businesses. Try again.")) }
      : { key, ok: true })
  }

  const shownOutcome = outcome && outcome.key === selectionKey ? outcome : null
  const reason = editing && selected.length === 0 ? t('AD_BANNERS_BUSINESSES_REQUIRED', 'Choose at least one business.') : null

  const countText = selected.length === 1
    ? t('AD_BANNERS_SELECTED_COUNT_ONE', '_count_ selected')
    : t('AD_BANNERS_SELECTED_COUNT_OTHER', '_count_ selected')

  const totalPages = Number(pagination?.total_pages) || 1
  const pageSize = Number(pagination?.page_size) || 10

  return (
    <div className='odc-root odc-banners-businesses'>
      {!editing && <h3 className='odc-banners-section-title'>{t('BUSINESSES', 'Businesses')}</h3>}

      {/* redesign (row 49, M-AB26): main's SEARCH_BUSINESSES key, same text; no banner-only copy */}
      <SearchField
        value={query}
        onChange={search}
        label={t('SEARCH_BUSINESSES', 'Search businesses')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
        placeholder={t('SEARCH_BUSINESSES', 'Search businesses')}
      />

      <div className='odc-banners-businesses-tools'>
        {handleSelectEveryBusiness && (
          <Button size='sm' busy={selectingAll} disabled={!!actionState?.loading || saving} onClick={selectEvery}>
            {t('AD_BANNERS_SELECT_ALL', 'Select all businesses')}
          </Button>
        )}
        <Button size='sm' disabled={acting} onClick={() => handleSelectAllBusiness?.(true, { pageOnly: true })}>
          {t('AD_BANNERS_SELECT_PAGE_ALL', 'Select all on this page')}
        </Button>
        <Button size='sm' disabled={acting} onClick={() => handleSelectAllBusiness?.(false, { pageOnly: true })}>
          {t('AD_BANNERS_SELECT_PAGE_NONE', 'Select none on this page')}
        </Button>
      </div>
      {selectAllNote?.failure && (
        <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{selectAllNote.failure}</InlineNotice>
      )}
      {selectAllNote?.none && (
        <p className='odc-banners-muted' role='status'>{t('AD_BANNERS_SELECT_ALL_NONE', 'No businesses to select.')}</p>
      )}

      {loading
        ? (
          <div className='odc-banners-business-skeleton' role='status' aria-busy='true'>
            <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
            {[...Array(SKELETON_ROWS).keys()].map(index => (
              <div key={index} className='odc-banners-business-row'>
                <Skeleton shape='box' size='var(--od-x-checkbox-box)' block='var(--od-x-checkbox-box)' />
                <Skeleton shape='round' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
                <Skeleton size='40%' />
              </div>
            ))}
          </div>
          )
        : businesses.length === 0
          ? <p className='odc-banners-muted'>{t('AD_BANNERS_NO_BUSINESSES', 'No businesses found.')}</p>
          : (
            <ul className='odc-banners-business-list' aria-label={t('BUSINESSES', 'Businesses')}>
              {businesses.map(business => (
                <li key={business.id} className='odc-banners-business-item'>
                  <Checkbox
                    checked={selected.includes(business.id)}
                    disabled={acting}
                    onCheckedChange={next => handleSelectBusiness?.(business.id, next)}
                  >
                    <span className='odc-banners-business'>
                      <Avatar kind='business' name={business.name} src={business.logo} />
                      <span className='odc-banners-business-name'>{business.name}</span>
                    </span>
                  </Checkbox>
                </li>
              ))}
            </ul>
            )}

      {totalPages > 1 && (
        <Pagination
          page={Number(pagination?.current_page) || 1}
          pageSize={pageSize}
          total={pagination?.total ?? undefined}
          hasMore={pagination?.total == null && (Number(pagination?.current_page) || 1) < totalPages}
          itemCount={businesses.length}
          onPageChange={page => handleChangeBusinessPage?.(page)}
          busy={loading}
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          rangeLabel={(from, to, count, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, figure)}
          pageStatusLabel={(current, pages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(pages))}
        />
      )}

      {/* redesign (review F-2): the page buttons touch the visible page only, so clearing a selection that spans pages is here */}
      <div className='odc-banners-selected-row'>
        <p className='odc-banners-selected'>{fillTemplate(countText, { count: selected.length }, figureOf)}</p>
        {selected.length > 0 && (
          <Button size='sm' variant='link' disabled={acting} onClick={() => handleSelectAllBusiness?.(false)}>
            {t('CLEAR_SELECTION', 'Clear selection')}
          </Button>
        )}
      </div>

      {editing && (
        <div className='odc-banners-businesses-foot'>
          <Button
            variant='primary'
            busy={saving}
            disabled={selected.length === 0 || !!actionState?.loading || selectingAll}
            aria-describedby={reason ? reasonId : undefined}
            onClick={save}
          >
            {t('AD_BANNERS_SAVE_BUSINESSES', 'Save businesses')}
          </Button>
          {reason && <p id={reasonId} className='odc-banners-muted'>{reason}</p>}
          <p className='odc-banners-status' aria-live='polite'>
            {shownOutcome?.ok ? t('SAVED', 'Saved') : ''}
          </p>
          {shownOutcome?.ok === false && (
            <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{shownOutcome.message}</InlineNotice>
          )}
        </div>
      )}
    </div>
  )
}
