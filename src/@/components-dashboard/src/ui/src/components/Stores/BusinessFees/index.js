import React, { useEffect, useMemo, useRef, useState } from 'react'

import { BusinessFees as BusinessFeesController, useConfig, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Plus, RefreshCw, TriangleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, IconButton, InlineNotice, Pagination, SearchField, SectionSplit, SelectionBar, Tabs } from '../../Shared/Product'
import { BusinessFeeDetail } from '../BusinessFeeForm'
import { FeeEventsTable, FeesTable } from './FeesTables'
import { ManualEventDialog } from './ManualEventDialog'
import './business-fees.css'

// redesign stores 5.13 (; E2): the business fees of a store on Product, in place of the tables, the modals and the Alerts of
// `main`. The same controller and the same requests; what changes is how the screen says things.
// - Tabs «Fees» | «Fee events» (S-1) and «Refresh» to the right, which reloads the tab that is open. Changing tab clears the search of the
//   other one, as before.
// - Fees: a search and «Add fee», a P/DataTable (RecordCards under 768px) whose Status is a switch that saves at once and goes back,
//   saying why, when it cannot; the pages. The fee opens beside the list (S-2: P/SectionSplit with its default `splitFrom`, and the
//   editor gives the section the full width while it is open) and instead of it below, with «‹ Back». Selecting rows brings a selection
//   bar; «Delete» asks first (the count in the question) and says which fees stayed when some could not be deleted.
// - Fee events: a search and «Add charge or credit» (a two-step dialog that confirms the amount: decision 6). Only the manual events
//   (charge, credit) can be selected and deleted (S-5); an order fee shows «Order #N» and has no checkbox. The rows open nothing.
// - Every write goes through the controller with `{ inlineError: true }`: no toast, no Alert; the reason is said in place.

const FEES = 'fees'
const EVENTS = 'events'
const NEW = 'new'
const PAGE_SIZES = [10, 25, 50]
const SEARCH_DELAY_MS = 400

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

// The reason of a failed bulk delete: the controller prefixes each message with «#<id>: », but the notice already says how many
// failed, so the prefix goes.
const withoutIdPrefix = (message) => (typeof message === 'string' ? message.replace(/^#[^\s:]+:\s*/, '') : message)

// A delete that removed something asks the page again, so the foot («Showing 1–10 of N») and the rows say the same thing: the rows of the
// next pages move up into it. If the delete left the page past the end (the total no longer reaches it, so the page would be empty
// and it is not the first), the one before is asked. Nothing deleted, nothing asked. The foot's own clamp may ask the same last page
// at the same moment: both ask for the same page.
const reloadAfterDelete = ({ rows, deleted, pagination, setPagination, load }) => {
  if (!deleted || deleted.length === 0) return
  const current = Number(pagination?.currentPage) >= 1 ? Number(pagination.currentPage) : 1
  const size = Number(pagination?.pageSize) >= 1 ? Number(pagination.pageSize) : 10
  const total = Number(pagination?.totalItems)
  let page = current
  if (Number.isFinite(total)) {
    page = Math.min(current, Math.max(1, Math.ceil(Math.max(total - deleted.length, 0) / size)))
  } else if (current > 1 && rows.every(row => deleted.some(id => String(id) === String(row.id)))) {
    page = current - 1 // the total is not known: an emptied page falls back to the previous one
  }
  if (page !== current) setPagination?.(prev => ({ ...prev, currentPage: page }))
  load?.(page, size)
}

// What a bulk delete answered, in the shape the UI needs: `{ error, result, deletedIds, failedIds }` from the controller (a throw or no
// answer counts as «all failed»).
const bulkDelete = async (remove, ids) => {
  let result
  try {
    result = await remove?.(ids, { inlineError: true })
  } catch (error) {
    result = { error: true, result: [error?.message], deletedIds: [], failedIds: ids }
  }
  const failed = result?.failedIds ?? (result?.error || !result ? ids : [])
  const deleted = result?.deletedIds ?? ids.filter(id => !failed.includes(id))
  return { failed, deleted, result }
}

// ── The search: what is typed waits a moment, so the list is asked once per word and not once per letter ──
const useDelayedSearch = (value, onChange) => {
  const [draft, setDraft] = useState(value ?? '')
  const timer = useRef(null)
  const sent = useRef(value ?? '')
  const handler = useRef(onChange)
  handler.current = onChange
  useEffect(() => {
    if ((value ?? '') === sent.current) return
    sent.current = value ?? ''
    setDraft(value ?? '')
  }, [value])
  useEffect(() => () => clearTimeout(timer.current), [])

  const change = (next) => {
    setDraft(next)
    clearTimeout(timer.current)
    const send = () => {
      if (next === sent.current) return
      sent.current = next
      handler.current?.(next)
    }
    if (next === '') send()
    else timer.current = setTimeout(send, SEARCH_DELAY_MS)
  }

  // a tab left: its search is cleared (and the list asked again only if it was filtered)
  const reset = () => {
    clearTimeout(timer.current)
    setDraft('')
    if (sent.current !== '') {
      sent.current = ''
      handler.current?.('')
    }
  }
  return [draft, change, reset]
}

const BusinessFeesUI = (props) => {
  const {
    businessId,
    business,
    businessName,
    // Fees
    feesList,
    getFees,
    createFee,
    updateFee,
    deleteFees,
    searchValue,
    handleChangeSearch,
    paginationProps,
    setPaginationProps,
    // Fee events
    feeEventsList,
    getFeeEvents,
    createFeeEvent,
    deleteFeeEvents,
    eventsSearchValue,
    handleChangeEventsSearch,
    eventsPaginationProps,
    setEventsPaginationProps,
    // Dropdowns
    sitesState,
    paymethodsState,
    // the editor gives the section the full width while a fee is open
    setIsExtendExtraOpen
  } = props

  const [, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const currencySymbol = configs?.format_number_currency?.value || '$'
  const storeName = businessName || business?.name
  const splitRef = useRef(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const [tab, setTab] = useState(FEES)
  const [openKey, setOpenKey] = useState(null) // a fee id, NEW, or null
  const [openFee, setOpenFee] = useState(null) // the record the detail holds (it follows the list; it outlives a page or a search)
  const [selectedFeeIds, setSelectedFeeIds] = useState([])
  const [selectedEventIds, setSelectedEventIds] = useState([])
  const [deleting, setDeleting] = useState({ open: false, busy: false })
  const [deletingEvents, setDeletingEvents] = useState({ open: false, busy: false })
  const [feeNotice, setFeeNotice] = useState(null)
  const [eventNotice, setEventNotice] = useState(null)
  const [manualOpen, setManualOpen] = useState(false)

  const [feesDraft, handleFeesSearch, resetFeesSearch] = useDelayedSearch(searchValue, handleChangeSearch)
  const [eventsDraft, handleEventsSearch, resetEventsSearch] = useDelayedSearch(eventsSearchValue, handleChangeEventsSearch)

  const fees = Array.isArray(feesList?.fees) ? feesList.fees : []
  const events = Array.isArray(feeEventsList?.events) ? feeEventsList.events : []
  const feesLoading = Boolean(feesList?.loading)
  const eventsLoading = Boolean(feeEventsList?.loading)
  const feesTotal = paginationProps?.totalItems
  const eventsTotal = eventsPaginationProps?.totalItems

  // ── Names of the conditions ──
  const deliveryTypeOptions = useMemo(() => ([
    { value: 'all', content: t('ALL_DELIVERY_TYPES', 'All delivery types') },
    { value: 'delivery', content: t('DELIVERY', 'Delivery') },
    { value: 'pickup', content: t('PICKUP', 'Pickup') },
    { value: 'eatin', content: t('EATING', 'Eat in') },
    { value: 'curbside', content: t('CURBSIDE', 'Curbside') },
    { value: 'drive_thru', content: t('DRIVE_THRU', 'Drive thru') },
    { value: 'seat_delivery', content: t('SEAT_DELIVERY', 'Seat delivery') },
    { value: 'catering_delivery', content: t('CATERING_DELIVERY', 'Catering delivery') },
    { value: 'catering_pickup', content: t('CATERING_PICKUP', 'Catering pickup') },
    { value: 'reservation', content: t('RESERVATION', 'Reservation') }
  ]), [t])

  const sitesList = Array.isArray(sitesState?.sites) ? sitesState.sites : []
  const paymethodsList = Array.isArray(paymethodsState?.paymethods) ? paymethodsState.paymethods : []
  const siteOptions = useMemo(
    () => [{ value: 'all', content: t('ALL_SITES', 'All sites') }]
      .concat(sitesList.map(site => ({ value: site.id, content: site.name || String(site.id) }))),
    [sitesList, t]
  )
  const paymethodOptions = useMemo(
    () => [{ value: 'all', content: t('ALL_PAYMENT_METHODS', 'All payment methods') }]
      .concat(paymethodsList.map(paymethod => ({ value: paymethod.id, content: paymethod.name || String(paymethod.id) }))),
    [paymethodsList, t]
  )

  const withCount = (template, value) => template.replace('_count_', String(value))

  // ── Open and close the detail ──
  const showDetail = (key, record) => {
    setFeeNotice(null)
    setOpenKey(key)
    setOpenFee(record)
  }

  const requestOpen = (key, record) => {
    if (!businessId || String(key) === String(openKey)) return
    if (splitRef.current) splitRef.current.requestLeave(() => showDetail(key, record))
    else showDetail(key, record)
  }

  const closeDetail = () => {
    setOpenKey(null)
    setOpenFee(null)
  }

  // the record in the detail follows the list (a switch of the table, a save)
  useEffect(() => {
    if (openKey == null || openKey === NEW) return
    const found = fees.find(fee => String(fee.id) === String(openKey))
    if (found && found !== openFee) setOpenFee(found)
  }, [feesList?.fees, openKey])

  const isOpen = openKey === NEW || (openKey != null && openFee != null)

  // ── Tabs and refresh ──
  const handleTabChange = (next) => {
    if (next === tab) return
    const change = () => {
      // the search of the tab that is left goes (the controller refetches only if it was filtering)
      if (next === EVENTS) resetFeesSearch()
      else resetEventsSearch()
      setTab(next)
    }
    // a fee open with changes asks before the tab goes
    if (tab === FEES && splitRef.current) {
      splitRef.current.requestLeave(() => {
        closeDetail()
        change()
      })
      return
    }
    change()
  }

  const refresh = () => {
    if (tab === FEES) {
      if (feesLoading) return
      getFees?.(paginationProps?.currentPage, paginationProps?.pageSize)
    } else {
      if (eventsLoading) return
      getFeeEvents?.(eventsPaginationProps?.currentPage, eventsPaginationProps?.pageSize)
    }
  }

  // ── The switch of a row ──
  const toggleEnabled = (fee, next) => Promise.resolve(updateFee?.(fee.id, { enabled: next }, { inlineError: true }))
    .then(result => (!result || result.error ? { ok: false, error: result?.result } : { ok: true }))

  // ── Selection ──
  const toggleIn = (setter) => (id) => setter(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  const toggleAllIn = (setter, ids) => () => setter(current => (
    ids.length > 0 && ids.every(id => current.includes(id))
      ? current.filter(id => !ids.includes(id))
      : [...new Set([...current, ...ids])]
  ))
  // an order fee is not selectable (it cannot be deleted): «select all» is the manual events of the page
  const manualEventIds = events.filter(event => event.event_type !== 'order_fee').map(event => event.id)

  const confirmDelete = async () => {
    const ids = selectedFeeIds
    setFeeNotice(null)
    setDeleting({ open: true, busy: true })
    const { failed, deleted, result } = await bulkDelete(deleteFees, ids)
    if (!mounted.current) return
    setDeleting({ open: false, busy: false })
    setSelectedFeeIds(failed)
    reloadAfterDelete({ rows: fees, deleted, pagination: paginationProps, setPagination: setPaginationProps, load: getFees })
    if (openKey != null && openKey !== NEW && deleted.some(id => String(id) === String(openKey))) closeDetail()
    if (failed.length === 0) return
    const reason = translateApiMessage(t, withoutIdPrefix(firstMessage(result?.result)), t('ERROR', 'Error'))
    setFeeNotice(withCount(failed.length === 1
      ? t('BUSINESS_FEES_DELETE_FAILED_ONE', '1 fee could not be deleted: _reason_')
      : t('BUSINESS_FEES_DELETE_FAILED_OTHER', '_count_ fees could not be deleted: _reason_'), failed.length).replace('_reason_', () => reason))
  }

  const confirmDeleteEvents = async () => {
    const ids = selectedEventIds
    setEventNotice(null)
    setDeletingEvents({ open: true, busy: true })
    const { failed, deleted, result } = await bulkDelete(deleteFeeEvents, ids)
    if (!mounted.current) return
    setDeletingEvents({ open: false, busy: false })
    setSelectedEventIds(failed)
    reloadAfterDelete({ rows: events, deleted, pagination: eventsPaginationProps, setPagination: setEventsPaginationProps, load: getFeeEvents })
    if (failed.length === 0) return
    const reason = translateApiMessage(t, withoutIdPrefix(firstMessage(result?.result)), t('ERROR', 'Error'))
    setEventNotice(withCount(failed.length === 1
      ? t('FEE_EVENTS_DELETE_FAILED_ONE', '1 charge or credit could not be deleted: _reason_')
      : t('FEE_EVENTS_DELETE_FAILED_OTHER', '_count_ charges or credits could not be deleted: _reason_'), failed.length).replace('_reason_', () => reason))
  }

  // ── Pages (the controller keeps the page; the foot asks for the next one) ──
  const pageHandlers = (setPagination, pagination, load) => ({
    onPageChange: (page) => {
      const nextPage = Number(page) >= 1 ? Number(page) : 1
      setPagination(prev => ({ ...prev, currentPage: nextPage }))
      load(nextPage, pagination.pageSize)
    },
    onPageSizeChange: (pageSize) => {
      const nextPageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
      setPagination(prev => ({ ...prev, pageSize: nextPageSize, currentPage: 1 }))
      load(1, nextPageSize)
    }
  })

  const foot = (pagination, total, loading, handlers) => total > 0 && (
    <div className='odc-bf-foot'>
      <Pagination
        page={pagination.currentPage}
        pageSize={pagination.pageSize}
        total={total}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={handlers.onPageChange}
        onPageSizeChange={(size) => handlers.onPageSizeChange(size)}
        busy={loading}
        showPageInput
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
        pageLabel={t('PAGE', 'Page')}
        pageOfLabel={(count, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: count }, figure)}
        rangeLabel={(from, to, count, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, figure)}
        pageStatusLabel={(current, count) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(count))}
      />
    </div>
  )

  // ── The Fees tab ──
  const feesSearching = Boolean(searchValue)
  const showFeesTools = fees.length > 0 || Boolean(feesDraft) || feesSearching || (feesTotal != null && feesTotal > 0)
  const noFeeRows = !feesLoading && fees.length === 0
  const feesEmptyText = (feesSearching || feesDraft) ? t('NO_RESULTS_FOUND', 'No results found') : t('NO_FEES', 'No fees found')
  const feesCount = selectedFeeIds.length
  const addFeeButton = (
    <Button variant='primary' icon={Plus} disabled={!businessId} onClick={() => requestOpen(NEW, null)}>
      {t('ADD_FEE', 'Add fee')}
    </Button>
  )

  const feesPane = !showFeesTools && noFeeRows
    ? (
      <div className='odc-bf-pane'>
        <div className='odc-bf-empty'>
          <p className='odc-bf-empty-text'>{t('NO_FEES', 'No fees found')}</p>
          {addFeeButton}
        </div>
      </div>
      )
    : (
      <div className='odc-bf-pane'>
        <div className='odc-bf-tools'>
          <SearchField
            className='odc-bf-search'
            value={feesDraft}
            onChange={handleFeesSearch}
            label={t('SEARCH_FEES', 'Search fees')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR', 'Clear')}
          />
          {addFeeButton}
        </div>
        {feeNotice && <InlineNotice tone='warning' icon={TriangleAlert} className='odc-bf-notice'>{feeNotice}</InlineNotice>}
        {feesCount > 0 && (
          <SelectionBar
            label={t('BUSINESS_FEES_BULK_ACTIONS_LABEL', 'Actions for selected fees')}
            countLabel={withCount(t('STORES_SELECTED_COUNT', '_count_ selected'), feesCount)}
            clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
            onClear={() => setSelectedFeeIds([])}
            busy={deleting.busy}
            actions={(
              <Button size='sm' data-tone='danger' disabled={deleting.busy} onClick={() => setDeleting({ open: true, busy: false })}>
                {t('DELETE', 'Delete')}
              </Button>
            )}
          />
        )}
        <FeesTable
          fees={fees}
          loading={feesLoading && fees.length === 0}
          selectedIds={selectedFeeIds}
          onToggle={toggleIn(setSelectedFeeIds)}
          onToggleAll={toggleAllIn(setSelectedFeeIds, fees.map(fee => fee.id))}
          activeId={isOpen && openKey !== NEW ? openKey : undefined}
          onOpen={(fee) => requestOpen(fee.id, fee)}
          onToggleEnabled={toggleEnabled}
          empty={<p className='odc-bf-empty-text'>{feesEmptyText}</p>}
        />
        {foot(paginationProps, feesTotal, feesLoading, pageHandlers(setPaginationProps, paginationProps, (page, size) => getFees?.(page, size)))}
      </div>
      )

  const feesTab = (
    <SectionSplit
      revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
      ref={splitRef}
      open={isOpen}
      detailKey={openKey}
      onClose={closeDetail}
      onExtendChange={value => setIsExtendExtraOpen?.(value)}
      detailTitle={openFee?.name || t('NEW_FEE', 'New fee')}
      closeLabel={t('CLOSE', 'Close')}
      backLabel={t('BACK', 'Back')}
      list={feesPane}
      detail={isOpen
        ? (
          <BusinessFeeDetail
            key={openKey === NEW ? NEW : openFee.id}
            fee={openKey === NEW ? null : openFee}
            deliveryTypeOptions={deliveryTypeOptions}
            siteOptions={siteOptions}
            paymethodOptions={paymethodOptions}
            createFee={createFee}
            updateFee={updateFee}
            onSaved={(record) => setOpenFee(current => (current ? { ...current, ...record } : current))}
            onCreated={(record) => showDetail(record.id, record)}
            onClose={closeDetail}
          />
          )
        : null}
    />
  )

  // ── The Fee events tab ──
  const eventsSearching = Boolean(eventsSearchValue)
  const showEventsTools = events.length > 0 || Boolean(eventsDraft) || eventsSearching || (eventsTotal != null && eventsTotal > 0)
  const noEventRows = !eventsLoading && events.length === 0
  const eventsEmptyText = (eventsSearching || eventsDraft) ? t('NO_RESULTS_FOUND', 'No results found') : t('NO_FEE_EVENTS', 'No fee events found')
  const eventsCount = selectedEventIds.length
  const addEventButton = (
    <Button variant='primary' icon={Plus} disabled={!businessId} onClick={() => setManualOpen(true)}>
      {t('ADD_CHARGE_OR_CREDIT', 'Add charge or credit')}
    </Button>
  )

  const eventsTab = !showEventsTools && noEventRows
    ? (
      <div className='odc-bf-pane'>
        <div className='odc-bf-empty'>
          <p className='odc-bf-empty-text'>{t('NO_FEE_EVENTS', 'No fee events found')}</p>
          {addEventButton}
        </div>
      </div>
      )
    : (
      <div className='odc-bf-pane'>
        <div className='odc-bf-tools'>
          <SearchField
            className='odc-bf-search'
            value={eventsDraft}
            onChange={handleEventsSearch}
            label={t('SEARCH_FEE_EVENTS', 'Search fee events')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR', 'Clear')}
          />
          {addEventButton}
        </div>
        {eventNotice && <InlineNotice tone='warning' icon={TriangleAlert} className='odc-bf-notice'>{eventNotice}</InlineNotice>}
        {eventsCount > 0 && (
          <SelectionBar
            label={t('FEE_EVENTS_BULK_ACTIONS_LABEL', 'Actions for selected charges and credits')}
            countLabel={withCount(t('STORES_SELECTED_COUNT', '_count_ selected'), eventsCount)}
            clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
            onClear={() => setSelectedEventIds([])}
            busy={deletingEvents.busy}
            actions={(
              <Button size='sm' data-tone='danger' disabled={deletingEvents.busy} onClick={() => setDeletingEvents({ open: true, busy: false })}>
                {t('DELETE', 'Delete')}
              </Button>
            )}
          />
        )}
        <FeeEventsTable
          events={events}
          loading={eventsLoading && events.length === 0}
          selectedIds={selectedEventIds}
          onToggle={toggleIn(setSelectedEventIds)}
          onToggleAll={toggleAllIn(setSelectedEventIds, manualEventIds)}
          empty={<p className='odc-bf-empty-text'>{eventsEmptyText}</p>}
        />
        {foot(eventsPaginationProps, eventsTotal, eventsLoading, pageHandlers(setEventsPaginationProps, eventsPaginationProps, (page, size) => getFeeEvents?.(page, size)))}
      </div>
      )

  return (
    <div className='odc-root odc-bf'>
      <h2 className='odc-bf-title'>{t('BUSINESS_FEES_TITLE', 'Business fees')}</h2>
      <div className='odc-bf-nav'>
        <Tabs
          className='odc-bf-tabs'
          label={t('BUSINESS_FEES_TITLE', 'Business fees')}
          value={tab}
          onValueChange={handleTabChange}
          items={[
            { value: FEES, label: t('FEES', 'Fees') },
            { value: EVENTS, label: t('FEE_EVENTS', 'Fee events') }
          ]}
        />
        <IconButton
          className='odc-bf-refresh'
          icon={RefreshCw}
          label={t('REFRESH', 'Refresh')}
          aria-busy={(tab === FEES ? feesLoading : eventsLoading) || undefined}
          onClick={refresh}
        />
      </div>
      {tab === FEES ? feesTab : eventsTab}
      <ManualEventDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={(payload) => createFeeEvent?.(payload, { inlineError: true })}
        storeName={storeName}
        currencySymbol={currencySymbol}
      />
      <ConfirmDialog
        open={deleting.open}
        tone='danger'
        busy={deleting.busy}
        title={feesCount === 1
          ? t('BUSINESS_FEES_DELETE_TITLE_ONE', 'Delete 1 fee?')
          : withCount(t('BUSINESS_FEES_DELETE_TITLE_OTHER', 'Delete _count_ fees?'), feesCount)}
        // redesign tanda AB (S-5): the button names what it deletes, as the title does
        confirmLabel={feesCount === 1 ? t('BUSINESS_FEES_DELETE_CONFIRM_ONE', 'Delete fee') : t('BUSINESS_FEES_DELETE_CONFIRM_OTHER', 'Delete fees')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDeleting(current => (current.busy ? current : { ...current, open: false }))}
        onConfirm={confirmDelete}
      >
        {t('BUSINESS_FEES_DELETE_BODY', "The store stops paying them. This can't be undone.")}
      </ConfirmDialog>
      <ConfirmDialog
        open={deletingEvents.open}
        tone='danger'
        busy={deletingEvents.busy}
        title={eventsCount === 1
          ? t('FEE_EVENTS_DELETE_TITLE_ONE', 'Delete 1 charge or credit?')
          : withCount(t('FEE_EVENTS_DELETE_TITLE_OTHER', 'Delete _count_ charges or credits?'), eventsCount)}
        // redesign tanda AB (S-5): the button names what it deletes, as the title does
        confirmLabel={eventsCount === 1 ? t('FEE_EVENTS_DELETE_CONFIRM_ONE', 'Delete charge or credit') : t('FEE_EVENTS_DELETE_CONFIRM_OTHER', 'Delete charges or credits')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDeletingEvents(current => (current.busy ? current : { ...current, open: false }))}
        onConfirm={confirmDeleteEvents}
      >
        {t('FEE_EVENTS_DELETE_BODY', "They are removed from the store's balance. This can't be undone.")}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessFees = (props) => {
  const businessId = props?.businessId
  const businessFeesProps = {
    ...props,
    businessId,
    UIComponent: BusinessFeesUI
  }

  return <BusinessFeesController {...businessFeesProps} />
}
