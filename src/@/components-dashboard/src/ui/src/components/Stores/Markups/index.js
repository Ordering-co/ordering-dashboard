import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { Markups as MarkupsController, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { useRouteLeaveGuard } from '../../../hooks/useRouteLeaveGuard'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { Menu as MenuIcon, Plus, TriangleAlert } from '../../Shared/Icon'
import {
  Button,
  ColumnManager,
  ConfirmDialog,
  IconButton,
  InlineNotice,
  LeaveDialog,
  LeaveGuardContext,
  PageHeader,
  Pagination,
  RecordPanel,
  SearchField,
  SelectionBar,
  SplitView,
  useLeaveGuardHost,
  useSplitView
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { MarkupDetail } from '../BusinessMarkups/MarkupDetail'
import { MARKUP_COLUMN_IDS, MarkupsTable } from '../BusinessMarkups/MarkupsTable'
import {
  fillTemplate,
  firstMessage,
  markupAppliesTo,
  markupDeliveryTypeOptions,
  markupTypeOptions as markupTypeOptionsOf,
  reloadAfterDelete,
  withoutIdPrefix
} from '../BusinessMarkups/markupShared'
import './markups-page.css'

// redesign (decisions 1–8): the /stores/markups route on Product, with the list and the detail of the Markups section of
// the store editor (5.13) at page level. The same controller (C/components/Markups) and the same requests as `main`; what changes:
// - A page header (count, «Add markup»), the search (name or ID; a number opens that markup, as `main`) and the column manager
//   (ID and Name stay: Name is the button that opens a markup).
// - S/BusinessMarkups/MarkupsTable with a Business column: its name, «Global» (no store: every store) or «Store <id>» (a store the
//   API no longer gives). Here no markup is read-only: this route is where the global ones are edited.
// - The switch of a row and of the detail is a P/AsyncSwitch: it goes back and says why when the save fails (G5-39). Every write
//   goes with `{ inlineError: true }`: the reason is said where it was asked, not in a toast «Error» or an Alert (G5-40).
// - Selecting brings a selection bar; «Delete» asks with the count; after a partial delete the deleted rows leave, the page is asked
//   again and only the ones that failed stay selected, with a notice that says how many and why (G5-41).
// - The detail is S/BusinessMarkups/MarkupDetail in project mode (the Business select when creating, «All businesses» = global) in a
//   P/SplitView + P/RecordPanel, with its save bar and the leave guard of the page. As `main`, it closes once saved (decision 5).
// - The address: ?id= opens a markup (it is searched by id when it is not on the page), ?add=1 opens a new one, ?page and ?pageSize.

const NEW = 'new'
const PAGE_SIZES = [10, 25, 50]
const SEARCH_DELAY_MS = 400
const LOCKED_COLUMNS = ['id', 'name']
const DEFAULT_COLUMNS = MARKUP_COLUMN_IDS.map(id => ({ id, visible: true }))
// review r1 #2: the list's width (px) under which a column steps aside, so Name stays readable beside the detail. The detail says both.
const HIDE_BELOW = { applies: 900, store: 700 }

const isMarkupId = (value) => /^\d+$/.test(String(value ?? '').trim())

// the markup the address asks for (?id=), or null
const idFromAddress = () => {
  const value = new URLSearchParams(window.location.search).get('id')
  return isMarkupId(value) ? Number(String(value).trim()) : null
}

// The detail inside the split view: it reads the mode to word its way out («Back» on a phone, «Close» elsewhere)
const MarkupPanel = ({ title, subtitle, onClose, children }) => {
  const [, t] = useLanguage()
  const phone = useSplitView().mode === 'full'
  return (
    <RecordPanel title={title} subtitle={subtitle} closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')} onClose={onClose}>
      <div className='odc-mkp-detail'>{children}</div>
    </RecordPanel>
  )
}

const MarkupsUI = (props) => {
  const {
    markupsList,
    getMarkups,
    createMarkup,
    updateMarkup,
    deleteMarkups,
    businessesState,
    businessesPaginationProps,
    handleChangeBusinessPage,
    searchBusinesses,
    sitesState,
    paginationProps,
    setPaginationProps,
    searchValue,
    handleChangeSearch,
    isUseQuery
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const leave = useLeaveGuardHost()
  // redesign bugs E: the sidebar, links, back/forward, ⌘K and Mia ask too while a markup holds unsaved work
  useRouteLeaveGuard({ active: leave.dirty, requestLeave: leave.requestLeave })
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const [open, setOpen] = useState(null) // { key: a markup id or NEW, markup }
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState({ open: false, busy: false })
  const [notice, setNotice] = useState(null)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [widthHidden, setWidthHidden] = useState([])
  const isPhone = useIsPhone()
  const [businessSearch, setBusinessSearch] = useState('')

  const loading = Boolean(markupsList?.loading)
  const markups = Array.isArray(markupsList?.markups) ? markupsList.markups : []
  const totalItems = paginationProps?.totalItems
  const withCount = (template, value) => template.replace('_count_', String(value))

  // ── Words: the conditions of a markup and where it applies ──
  const deliveryTypeOptions = useMemo(() => markupDeliveryTypeOptions(t), [t])
  const markupTypeOptions = useMemo(() => markupTypeOptionsOf(t), [t])
  const sites = Array.isArray(sitesState?.sites) ? sitesState.sites : []
  const siteOptions = useMemo(
    () => [{ value: 'all', content: t('ALL_SITES', 'All sites') }]
      .concat(sites.map(site => ({ value: site.id, content: site.name || String(site.id) }))),
    [sites, t]
  )
  const appliesTo = (markup) => markupAppliesTo(markup, { sites, deliveryTypeOptions, t })
  const storeWithId = (id) => t('STORE_WITH_ID', 'Store _id_').replace('_id_', () => String(id))
  const storeOf = (markup) => {
    if (markup?.business_id == null) return <span className='odc-bm-tag'>{t('GLOBAL', 'Global')}</span>
    return markup?.business?.name || storeWithId(markup.business_id)
  }

  // ── The search: a moment after typing, once per word. A number also goes to the address and opens that markup (as `main`) ──
  const [draft, setDraft] = useState(searchValue ?? '')
  const timer = useRef(null)
  const sent = useRef(searchValue ?? '')
  useEffect(() => () => clearTimeout(timer.current), [])

  const sendSearch = (text) => {
    const normalized = String(text ?? '').trim()
    if (normalized === sent.current) return
    sent.current = normalized
    const pageSize = paginationProps?.pageSize ?? 10
    setPaginationProps?.(prev => ({ ...prev, currentPage: 1 }))
    if (isMarkupId(normalized)) {
      addQueryToUrl({ id: normalized, page: 1, pageSize })
    } else {
      removeQueryToUrl(['id'])
      addQueryToUrl({ page: 1, pageSize })
    }
    handleChangeSearch?.(normalized)
  }

  const typeSearch = (text) => {
    setDraft(text)
    clearTimeout(timer.current)
    if (text === '') sendSearch('')
    else timer.current = setTimeout(() => sendSearch(text), SEARCH_DELAY_MS)
  }

  // ── Open and close the detail; every way out asks first when the form holds unsaved work ──
  const opened = useRef(null) // the id the address opened, so a reload of the list does not open it again
  const showDetail = (key, markup) => {
    setNotice(null)
    setOpen({ key, markup })
    if (key === NEW) {
      opened.current = null
      removeQueryToUrl(['id'])
    } else {
      opened.current = Number(key)
      addQueryToUrl({ id: key })
    }
  }
  const requestOpen = (key, markup) => {
    if (open && String(open.key) === String(key)) return
    leave.requestLeave(() => showDetail(key, markup))
  }
  const closeDetail = () => {
    setOpen(null)
    opened.current = null
    removeQueryToUrl(['id'])
  }

  // `?add=1` (the command palette) opens a new markup, like the button
  useOpenFromQuery('add', () => requestOpen(NEW, null))

  // ?id=: open it once the list has it; when the page does not, search it by id (the controller then asks again). It waits for the
  // first answer: a search sent while the first page is on its way would be dropped by the controller (one request at a time).
  useEffect(() => {
    if (loading || totalItems == null) return
    const id = idFromAddress()
    if (id == null) {
      opened.current = null
      return
    }
    if (opened.current === id) return
    const found = markups.find(markup => Number(markup?.id) === id)
    if (found) {
      opened.current = id
      // review r1 #1: a number typed in the search with unsaved work open asks first; staying puts the open markup back in the address
      const previous = open && open.key !== NEW ? open.key : null
      leave.requestLeave(() => setOpen({ key: found.id, markup: found }), () => {
        opened.current = previous != null ? Number(previous) : null
        if (previous != null) addQueryToUrl({ id: previous })
        else removeQueryToUrl(['id'])
      })
      return
    }
    if (String(searchValue ?? '') !== String(id)) {
      setDraft(String(id))
      sent.current = String(id)
      handleChangeSearch?.(String(id))
    }
  }, [markupsList])

  // the record in the detail follows the list (a switch of the table, a save)
  useEffect(() => {
    if (!open || open.key === NEW) return
    const found = markups.find(markup => String(markup.id) === String(open.key))
    if (found && found !== open.markup) setOpen(current => (current ? { ...current, markup: found } : current))
  }, [markups])

  // ?page and ?pageSize after each load, as `main`
  useEffect(() => {
    if (!isUseQuery) return
    if (!paginationProps?.currentPage || !paginationProps?.pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({ page: paginationProps.currentPage, pageSize: paginationProps.pageSize })
  }, [paginationProps?.currentPage, paginationProps?.pageSize, paginationProps?.totalPages, isUseQuery])

  // ── The switch of a row and the one of the detail: it goes back and says why when the save fails ──
  const toggleEnabled = (markup, next) => Promise.resolve(updateMarkup?.(markup.id, { enabled: next }, { inlineError: true }))
    .then(result => (!result || result.error
      ? { ok: false, error: translateApiMessage(t, firstMessage(result?.result), t('MARKUP_ENABLE_FAILED', "We couldn't change this markup.")) }
      : { ok: true }))
    .catch(error => ({ ok: false, error: translateApiMessage(t, error?.message, t('MARKUP_ENABLE_FAILED', "We couldn't change this markup.")) }))

  // ── Selection (it outlives a page or a search) ──
  const toggleOne = (id) => setSelectedIds(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  const pageIds = markups.map(markup => markup.id)
  const toggleAll = () => setSelectedIds(current => (
    pageIds.length > 0 && pageIds.every(id => current.includes(id))
      ? current.filter(id => !pageIds.includes(id))
      : [...new Set([...current, ...pageIds])]
  ))

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
    // only the markups that are still there stay selected (G5-41)
    setSelectedIds(failed)
    reloadAfterDelete({ rows: markups, deleted, pagination: paginationProps, setPagination: setPaginationProps, load: getMarkups })
    if (open && open.key !== NEW && deleted.some(id => String(id) === String(open.key))) closeDetail()
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

  // ── The Business select of the detail: the stores of the controller, and the one of the open markup when the list lacks it ──
  const openMarkup = open?.key !== NEW ? open?.markup : null
  const businessOptions = useMemo(() => {
    const list = Array.isArray(businessesState?.businesses) ? businessesState.businesses : []
    const options = list.map(business => ({ value: business.id, content: business.name }))
    const id = openMarkup?.business_id
    if (id != null && !options.some(option => Number(option.value) === Number(id))) {
      options.unshift({ value: id, content: openMarkup?.business?.name || storeWithId(id) })
    }
    return [{ value: 'all', content: t('ALL_BUSINESSES', 'All businesses') }].concat(options)
  }, [businessesState?.businesses, openMarkup?.business_id, openMarkup?.business?.name, t])

  const handleBusinessSearch = (value) => {
    setBusinessSearch(value ?? '')
    searchBusinesses?.(value ?? '')
  }

  // ── The list ──
  const addLabel = t('ADD_MARKUP', 'Add markup')
  const searching = Boolean(searchValue) || Boolean(draft)
  const known = totalItems != null && Number.isFinite(Number(totalItems))
  const listError = !loading && markupsList?.error
    ? translateApiMessage(t, firstMessage(markupsList.error), t('MARKUPS_LOAD_FAILED', "We couldn't load the markups."))
    : null
  const noRows = !loading && markups.length === 0
  const emptyText = searching ? t('NO_RESULTS_FOUND', 'No results found') : t('NO_MARKUPS', 'No markups found')

  const columnLabels = {
    id: t('ID', 'ID'),
    name: t('NAME', 'Name'),
    store: t('BUSINESS', 'Business'),
    applies: t('APPLIES_TO', 'Applies to'),
    rule: t('MARKUP_RULE', 'Rule'),
    status: t('STATUS', 'Status')
  }

  const header = (
    <PageHeader
      leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
      title={t('MARKUPS', 'Markups')}
      count={known ? Number(totalItems) : undefined}
      countLabel={known
        ? (Number(totalItems) === 1 ? t('MARKUPS_COUNT_ONE', '1 markup') : withCount(t('MARKUPS_COUNT_OTHER', '_count_ markups'), totalItems))
        : undefined}
      primaryAction={(
        <Button variant='primary' icon={Plus} title={addLabel} onClick={() => requestOpen(NEW, null)}>
          <span data-collapse-label=''>{addLabel}</span>
        </Button>
      )}
    />
  )

  const tools = (
    <div className='odc-mkp-tools'>
      <SearchField
        className='odc-mkp-search'
        value={draft}
        onChange={typeSearch}
        onKeyDown={(event) => { if (event.key === 'Enter') { clearTimeout(timer.current); sendSearch(draft) } }}
        label={t('SEARCH_MARKUPS', 'Search markups')}
        placeholder={t('SEARCH_BY_NAME_OR_ID', 'Search by name or ID')}
        clearLabel={t('CLEAR', 'Clear')}
      />
      {/* the cards of a phone always say everything: the column manager is for the table */}
      {!isPhone && (
      <ColumnManager
        columns={columns.map(({ id, visible }) => ({
          id,
          label: columnLabels[id],
          visible: LOCKED_COLUMNS.includes(id) || visible,
          locked: LOCKED_COLUMNS.includes(id),
          widthHidden: widthHidden.includes(id)
        }))}
        onChange={(next) => setColumns(next.map(({ id, visible }) => ({ id, visible })))}
        onReset={() => setColumns(DEFAULT_COLUMNS)}
        triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
        title={t('MANAGE_COLUMNS', 'Manage columns')}
        resetLabel={t('COLUMNS_RESET', 'Reset')}
        lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
        widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
        moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', () => label)}
        moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', () => label)}
      />
      )}
    </div>
  )

  let body
  if (noRows && !searching && !listError && known) {
    body = (
      <div className='odc-mkp-empty'>
        <p className='odc-mkp-empty-text'>{t('NO_MARKUPS', 'No markups found')}</p>
        <Button variant='primary' icon={Plus} onClick={() => requestOpen(NEW, null)}>{addLabel}</Button>
      </div>
    )
  } else {
    body = (
      <>
        {listError && (
          <InlineNotice
            tone='danger'
            icon={TriangleAlert}
            action={(
              <Button size='sm' onClick={() => getMarkups(paginationProps?.currentPage ?? 1, paginationProps?.pageSize ?? 10)}>
                {t('TRY_AGAIN', 'Try again')}
              </Button>
            )}
          >
            {listError}
          </InlineNotice>
        )}
        {notice && <InlineNotice tone='warning' icon={TriangleAlert}>{notice}</InlineNotice>}
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
        {/* tanda P: a failed load with no rows is the error and its retry alone, as /stores/devices: the table said
            «No markups found» under it, as if the project had none */}
        {!(listError && noRows) && (
        <MarkupsTable
          markups={markups}
          loading={loading && markups.length === 0}
          selectedIds={selectedIds}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
          activeId={open && open.key !== NEW ? open.key : undefined}
          onOpen={(markup) => requestOpen(markup.id, markup)}
          onToggleEnabled={toggleEnabled}
          isGlobal={() => false}
          appliesTo={appliesTo}
          storeOf={storeOf}
          columns={columns.map(column => (HIDE_BELOW[column.id] ? { ...column, hideBelow: HIDE_BELOW[column.id] } : column))}
          onWidthHiddenChange={setWidthHidden}
          empty={<p className='odc-mkp-empty-text'>{emptyText}</p>}
        />
        )}
        {totalItems > 0 && (
          <div className='odc-mkp-foot'>
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

  const list = (
    <div className='odc-root odc-mkp-frame'>
      {header}
      {tools}
      {body}
    </div>
  )

  const isNew = open?.key === NEW
  const panelTitle = isNew ? t('NEW_MARKUP', 'New markup') : (openMarkup?.name || `${t('ID', 'ID')} ${open?.key}`)
  const panel = open
    ? (
      <MarkupPanel
        title={<span dir='auto'>{panelTitle}</span>}
        subtitle={isNew ? undefined : <>{t('ID', 'ID')} <bdi dir='ltr' className='odc-figure'>{open.key}</bdi></>}
        onClose={() => leave.requestLeave(closeDetail)}
      >
        <MarkupDetail
          key={isNew ? NEW : open.key}
          markup={isNew ? null : openMarkup}
          businessId={null}
          businessField={{
            options: businessOptions,
            searchValue: businessSearch,
            onSearchChange: handleBusinessSearch,
            pagination: businessesPaginationProps,
            onChangePage: handleChangeBusinessPage,
            loading: businessesState?.loading
          }}
          guardScope='page'
          deliveryTypeOptions={deliveryTypeOptions}
          markupTypeOptions={markupTypeOptions}
          siteOptions={siteOptions}
          createMarkup={createMarkup}
          updateMarkup={updateMarkup}
          onToggleEnabled={toggleEnabled}
          // as `main`, the detail closes once saved; the controller's toast says it
          onSaved={closeDetail}
          onCreated={closeDetail}
          onClose={closeDetail}
        />
      </MarkupPanel>
      )
    : null

  const count = selectedIds.length
  return (
    <LeaveGuardContext.Provider value={leave.context}>
      <SplitView
        className='odc-mkp-split'
        list={list}
        panel={panel}
        open={Boolean(panel)}
        panelLabel={panelTitle}
        resizeLabel={t('MARKUPS_RESIZE_PANEL', 'Resize the markup panel')}
        storageKey='od.markups.panel'
        onClose={closeDetail}
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
        {t('MARKUPS_DELETE_BODY_ALL', "Prices stop including them. This can't be undone.")}
      </ConfirmDialog>
      <LeaveDialog
        open={leave.dialog.open}
        saving={leave.dialog.saving}
        onKeep={leave.dialog.onKeep}
        onDiscard={leave.dialog.onDiscard}
        onSave={leave.dialog.onSave}
        returnFocus={leave.dialog.returnFocus}
        title={t('LEAVE_UNSAVED_TITLE', 'Save your changes?')}
        description={t('LEAVE_UNSAVED_DESCRIPTION', 'You have unsaved changes in _section_. Save them before you leave, or discard them.')
          .replace('_section_', () => t('MARKUPS', 'Markups'))}
        keepLabel={t('KEEP_EDITING', 'Keep editing')}
        saveLabel={t('SAVE_AND_CONTINUE', 'Save and continue')}
        discardLabel={t('DISCARD', 'Discard')}
        closeLabel={t('CLOSE', 'Close')}
      />
    </LeaveGuardContext.Provider>
  )
}

export const Markups = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10

  const markupsProps = {
    ...props,
    UIComponent: MarkupsUI,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPageSize) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }

  return <MarkupsController {...markupsProps} />
}
