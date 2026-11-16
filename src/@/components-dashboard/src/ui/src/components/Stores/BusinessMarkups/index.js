import React, { useEffect, useMemo, useRef, useState } from 'react'

import { Markups as MarkupsController, useEvent, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Info, Plus, TriangleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, InlineNotice, Pagination, SearchField, SectionSplit, SelectionBar, useRequestLeave } from '../../Shared/Product'
import { MarkupDetail } from './MarkupDetail'
import {
  fillTemplate,
  firstMessage,
  markupAppliesTo,
  markupDeliveryTypeOptions,
  markupTypeOptions as markupTypeOptionsOf,
  reloadAfterDelete,
  withoutIdPrefix
} from './markupShared'
import { MarkupsTable } from './MarkupsTable'
import './business-markups.css'

// redesign stores 5.13 (; E3b): the markups of a store on Product, in place of the table, the modal and the Alerts of
// `main`. The same controller and the same requests; what changes is how the screen says things.
// - The list: a search and «Add markup» (it replaces «Add new»), a P/DataTable (RecordCards under 768px) with the site and delivery
//   type a markup applies to and its rule, a Status that is a switch that saves at once and says why when it cannot, and the pages.
// - Global markups (the ones of every store) are shown but are not opened, selected or switched here (S-6): a note says where they
//   are edited. It used to be an Alert on every click.
// - Selecting rows brings a selection bar; «Delete» asks first (the count in the question) and says which markups stayed when some
//   could not be deleted. Writes go through the controller with `{ inlineError: true }`: no toast, no Alert; the reason is said in place.
// - The detail (`S/BusinessMarkups/MarkupDetail`) opens beside the list while there is room for both (the SectionSplit decides) and
//   instead of it below, with «‹ Back». «New markup» opens it empty. It replaces the modal.

const NEW = 'new'
const PAGE_SIZES = [10, 25, 50]
const SEARCH_DELAY_MS = 400

const isModifiedClick = (event) => event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey

const BusinessMarkupsUI = (props) => {
  const {
    businessId,
    markupsList,
    getMarkups,
    createMarkup,
    updateMarkup,
    deleteMarkups,
    searchValue,
    handleChangeSearch,
    paginationProps,
    setPaginationProps,
    sitesState,
    setIsExtendExtraOpen
  } = props

  const [, t] = useLanguage()
  const [events] = useEvent()
  const requestLeaveHost = useRequestLeave()
  const splitRef = useRef(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const [openKey, setOpenKey] = useState(null) // a markup id, NEW, or null
  const [openMarkup, setOpenMarkup] = useState(null) // the record the detail holds (it follows the list; it outlives a page or a search)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState({ open: false, busy: false })
  const [notice, setNotice] = useState(null)

  const loading = Boolean(markupsList?.loading)
  const markups = Array.isArray(markupsList?.markups) ? markupsList.markups : []
  const totalItems = paginationProps?.totalItems
  const searching = Boolean(searchValue)

  // Global = the markup of every store (no business, or another one). It is read-only here, as in `main`.
  const isGlobal = (markup) => markup?.business_id == null || Number(markup.business_id) !== Number(businessId)
  const hasGlobal = markups.some(isGlobal)

  // ── The search: what is typed waits a moment, so the list is asked once per word and not once per letter ──
  const [draft, setDraft] = useState(searchValue ?? '')
  const timer = useRef(null)
  const sent = useRef(searchValue ?? '')
  useEffect(() => {
    if ((searchValue ?? '') === sent.current) return
    sent.current = searchValue ?? ''
    setDraft(searchValue ?? '')
  }, [searchValue])
  useEffect(() => () => clearTimeout(timer.current), [])

  const handleSearch = (next) => {
    setDraft(next)
    clearTimeout(timer.current)
    const send = () => {
      if (next === sent.current) return
      sent.current = next
      handleChangeSearch?.(next)
    }
    if (next === '') send()
    else timer.current = setTimeout(send, SEARCH_DELAY_MS)
  }

  const showTools = markups.length > 0 || Boolean(draft) || searching || (totalItems != null && totalItems > 0)

  // ── Options of the form and names of the conditions (redesign shared with the /stores/markups route) ──
  const deliveryTypeOptions = useMemo(() => markupDeliveryTypeOptions(t), [t])
  const markupTypeOptions = useMemo(() => markupTypeOptionsOf(t), [t])

  const sitesList = Array.isArray(sitesState?.sites) ? sitesState.sites : []
  const siteOptions = useMemo(
    () => [{ value: 'all', content: t('ALL_SITES', 'All sites') }]
      .concat(sitesList.map(site => ({ value: site.id, content: site.name || String(site.id) }))),
    [sitesList, t]
  )

  // «Main site · Delivery». An id the list does not know is said by its id, translated.
  const appliesTo = (markup) => markupAppliesTo(markup, { sites: sitesList, deliveryTypeOptions, t })

  // ── Open and close the detail ──
  const showDetail = (key, record) => {
    setNotice(null)
    setOpenKey(key)
    setOpenMarkup(record)
  }

  const requestOpen = (key, record) => {
    if (!businessId || String(key) === String(openKey)) return
    if (splitRef.current) splitRef.current.requestLeave(() => showDetail(key, record))
    else showDetail(key, record)
  }

  const closeDetail = () => {
    setOpenKey(null)
    setOpenMarkup(null)
  }

  // the record in the detail follows the list (a switch of the table, a save)
  useEffect(() => {
    if (openKey == null || openKey === NEW) return
    const found = markups.find(markup => String(markup.id) === String(openKey))
    if (found && found !== openMarkup) setOpenMarkup(found)
  }, [markups, openKey])

  const isOpen = openKey === NEW || (openKey != null && openMarkup != null)

  // ── The switch of a row and the one of the detail ──
  const toggleEnabled = (markup, next) => Promise.resolve(updateMarkup?.(markup.id, { enabled: next }, { inlineError: true }))
    .then(result => (!result || result.error ? { ok: false, error: result?.result } : { ok: true }))

  // ── Selection (a global markup is never selected) ──
  const toggleOne = (id) => setSelectedIds(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  const pageIds = markups.filter(markup => !isGlobal(markup)).map(markup => markup.id)
  const toggleAll = () => setSelectedIds(current => (
    pageIds.length > 0 && pageIds.every(id => current.includes(id))
      ? current.filter(id => !pageIds.includes(id))
      : [...new Set([...current, ...pageIds])]
  ))

  const withCount = (template, value) => template.replace('_count_', String(value))

  const confirmDelete = async () => {
    const ids = selectedIds
    setNotice(null)
    setDeleting({ open: true, busy: true })
    let result
    try {
      result = await deleteMarkups?.(ids, { inlineError: true })
    } catch (error) {
      result = { error: true, result: [error?.message], deletedIds: [], failedIds: ids }
    }
    if (!mounted.current) return
    setDeleting({ open: false, busy: false })
    const failed = result?.failedIds ?? (result?.error || !result ? ids : [])
    const deleted = result?.deletedIds ?? ids.filter(id => !failed.includes(id))
    setSelectedIds(failed)
    reloadAfterDelete({ rows: markups, deleted, pagination: paginationProps, setPagination: setPaginationProps, load: getMarkups })
    if (openKey != null && openKey !== NEW && deleted.some(id => String(id) === String(openKey))) closeDetail()
    if (failed.length === 0) return
    const reason = translateApiMessage(t, withoutIdPrefix(firstMessage(result?.result)), t('ERROR', 'Error'))
    setNotice(withCount(failed.length === 1
      ? t('MARKUPS_DELETE_FAILED_ONE', '1 markup could not be deleted: _reason_')
      : t('MARKUPS_DELETE_FAILED_OTHER', '_count_ markups could not be deleted: _reason_'), failed.length).replace('_reason_', () => reason))
  }

  // ── Pages (the controller keeps the page; the foot asks for the next one) ──
  const handleChangePage = (page) => {
    const nextPage = Number(page) >= 1 ? Number(page) : 1
    setPaginationProps(prev => ({ ...prev, currentPage: nextPage }))
    getMarkups(nextPage, paginationProps.pageSize)
  }

  const handleChangePageSize = (pageSize) => {
    const nextPageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
    setPaginationProps(prev => ({ ...prev, pageSize: nextPageSize, currentPage: 1 }))
    getMarkups(1, nextPageSize)
  }

  // ── The note of the global markups: a link to where they are edited, asking first if the form holds unsaved work ──
  const goToMarkups = (event) => {
    if (isModifiedClick(event)) return
    event.preventDefault()
    requestLeaveHost(() => events.emit('go_to_page', { page: 'markups' }))
  }

  const globalNote = fillTemplate(
    t('GLOBAL_MARKUPS_NOTE', 'Global markups apply to every store. Edit them in _link_.'),
    { link: true },
    () => <a className='odc-bm-link' href='/stores/markups' onClick={goToMarkups}>{`${t('STORES', 'Stores')} › ${t('MARKUPS', 'Markups')}`}</a>
  )

  // ── The list ──
  const addButton = (
    <Button variant='primary' icon={Plus} disabled={!businessId} onClick={() => requestOpen(NEW, null)}>
      {t('ADD_MARKUP', 'Add markup')}
    </Button>
  )

  const noRows = !loading && markups.length === 0
  const emptyText = (searching || draft)
    ? t('NO_RESULTS_FOUND', 'No results found')
    : t('NO_MARKUPS', 'No markups found')

  let body
  if (!showTools && noRows) {
    body = (
      <div className='odc-bm-empty'>
        <p className='odc-bm-empty-text'>{t('NO_MARKUPS', 'No markups found')}</p>
        {addButton}
      </div>
    )
  } else {
    body = (
      <>
        {showTools && (
          <div className='odc-bm-tools'>
            <SearchField
              className='odc-bm-search'
              value={draft}
              onChange={handleSearch}
              label={t('SEARCH_MARKUPS', 'Search markups')}
              placeholder={t('SEARCH', 'Search')}
              clearLabel={t('CLEAR', 'Clear')}
            />
            {addButton}
          </div>
        )}
        {hasGlobal && <InlineNotice tone='info' icon={Info} className='odc-bm-notice'>{globalNote}</InlineNotice>}
        {notice && <InlineNotice tone='warning' icon={TriangleAlert} className='odc-bm-notice'>{notice}</InlineNotice>}
        {selectedIds.length > 0 && (
          <SelectionBar
            label={t('MARKUPS_BULK_ACTIONS_LABEL', 'Actions for selected markups')}
            countLabel={withCount(t('STORES_SELECTED_COUNT', '_count_ selected'), selectedIds.length)}
            clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
            onClear={() => setSelectedIds([])}
            busy={deleting.busy}
            actions={(
              <Button size='sm' data-tone='danger' disabled={deleting.busy} onClick={() => setDeleting({ open: true, busy: false })}>
                {t('DELETE', 'Delete')}
              </Button>
            )}
          />
        )}
        <MarkupsTable
          markups={markups}
          loading={loading && markups.length === 0}
          selectedIds={selectedIds}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
          activeId={isOpen && openKey !== NEW ? openKey : undefined}
          onOpen={(markup) => requestOpen(markup.id, markup)}
          onToggleEnabled={toggleEnabled}
          isGlobal={isGlobal}
          appliesTo={appliesTo}
          empty={<p className='odc-bm-empty-text'>{emptyText}</p>}
        />
        {totalItems > 0 && (
          <div className='odc-bm-foot'>
            <Pagination
              page={paginationProps.currentPage}
              pageSize={paginationProps.pageSize}
              total={totalItems}
              pageSizeOptions={PAGE_SIZES}
              onPageChange={handleChangePage}
              onPageSizeChange={(size) => handleChangePageSize(size)}
              busy={loading}
              showPageInput
              label={t('PAGINATION', 'Pagination')}
              previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
              nextLabel={t('NEXT_PAGE', 'Next page')}
              pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
              pageLabel={t('PAGE', 'Page')}
              pageOfLabel={(total, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total }, figure)}
              rangeLabel={(from, to, total, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
              pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
            />
          </div>
        )}
      </>
    )
  }

  const list = <div className='odc-bm-pane'>{body}</div>

  const count = selectedIds.length
  return (
    <div className='odc-root odc-bm'>
      <h2 className='odc-bm-title'>{t('MARKUPS', 'Markups')}</h2>
      <SectionSplit
        revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
        ref={splitRef}
        open={isOpen}
        detailKey={openKey}
        onClose={closeDetail}
        onExtendChange={value => setIsExtendExtraOpen?.(value)}
        detailTitle={openMarkup?.name || t('NEW_MARKUP', 'New markup')}
        closeLabel={t('CLOSE', 'Close')}
        backLabel={t('BACK', 'Back')}
        list={list}
        detail={isOpen
          ? (
            <MarkupDetail
              key={openKey === NEW ? NEW : openMarkup.id}
              markup={openKey === NEW ? null : openMarkup}
              businessId={businessId}
              deliveryTypeOptions={deliveryTypeOptions}
              markupTypeOptions={markupTypeOptions}
              siteOptions={siteOptions}
              createMarkup={createMarkup}
              updateMarkup={updateMarkup}
              onToggleEnabled={toggleEnabled}
              onSaved={(record) => setOpenMarkup(current => (current ? { ...current, ...record } : current))}
              onCreated={(record) => showDetail(record.id, record)}
              onClose={closeDetail}
            />
            )
          : null}
      />
      <ConfirmDialog
        open={deleting.open}
        tone='danger'
        busy={deleting.busy}
        title={count === 1
          ? t('MARKUPS_DELETE_TITLE_ONE', 'Delete 1 markup?')
          : withCount(t('MARKUPS_DELETE_TITLE_OTHER', 'Delete _count_ markups?'), count)}
        // redesign tanda AB (S-5): the button names what it deletes, as the title does
        confirmLabel={count === 1 ? t('MARKUPS_DELETE_CONFIRM_ONE', 'Delete markup') : t('MARKUPS_DELETE_CONFIRM_OTHER', 'Delete markups')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDeleting(current => (current.busy ? current : { ...current, open: false }))}
        onConfirm={confirmDelete}
      >
        {t('MARKUPS_DELETE_BODY', "Prices of this store stop including them. This can't be undone.")}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessMarkups = (props) => {
  const businessId = props?.businessId
  const businessMarkupsProps = {
    ...props,
    businessId,
    includeGlobalMarkups: true,
    isFetchBusinesses: false,
    isFetchSites: true,
    asDashboard: true,
    UIComponent: BusinessMarkupsUI
  }

  return <MarkupsController {...businessMarkupsProps} />
}
