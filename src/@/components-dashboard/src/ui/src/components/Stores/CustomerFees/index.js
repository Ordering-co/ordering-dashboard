import React, { useEffect, useMemo, useRef, useState } from 'react'

import { CustomerFees as CustomerFeesController, useLanguage, useSession } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { EDITOR_PANEL_WIDE_FROM } from '../../../../../utils/editorPanel'
import { Plus, TriangleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, InlineNotice, Pagination, SearchField, SectionSplit, SelectionBar } from '../../Shared/Product'
import { CustomerFeeDetail } from './CustomerFeeDetail'
import { CustomerFeesTable } from './CustomerFeesTable'
import './customer-fees.css'

// redesign stores 5.12 (; E4): the customer fees of a store on Product, in place of the table, the modal and the Alert of
// `main`. The same controller and the same requests; what changes is how the screen says things.
// - The list: a search and «Add customer fee» (it replaces «Add new» and «Use advanced fee settings»: both opened the same form), a
//   P/DataTable (RecordCards under 768px) whose Status is a switch that saves at once and says why when it cannot, and the pages.
// - Selecting rows brings a selection bar; «Delete» asks first (the count in the question) and says which fees stayed when some could
//   not be deleted. Writes go through the controller with `{ inlineError: true }`: no toast, no Alert; the reason is said in place.
// - The detail (`S/CustomerFees/CustomerFeeDetail`) opens beside the list from 1000px of window (`EDITOR_PANEL_WIDE_FROM`, where `main`
//   opened its modal) and instead of it below, with «‹ Back». «New customer fee» opens it empty.
// - The legacy «Service fee settings in %» field is the parent's (`legacyField`): shown on top while the store has no customer fees,
//   and also with them when the parent asks (`keepLegacyField`).
// - `PUT` and `DELETE /fees/{id}` are level 0 only; everyone else who reaches this screen, a store owner (level 2) above all,
//   can only create. So below level 0 there is no switch, no selection and no delete, a stored fee opens to read, and the screen says who
//   can do the rest. The API is the rule; this only stops offering what it would refuse.

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

const CustomerFeesUI = (props) => {
  const {
    businessId,
    feesList,
    getFees,
    createFee,
    updateFee,
    deleteFees,
    searchValue,
    handleChangeSearch,
    paginationProps,
    setPaginationProps,
    sitesState,
    paymethodsState,
    setIsExtendExtraOpen,
    legacyField,
    keepLegacyField
  } = props

  const [, t] = useLanguage()
  const [{ user } = {}] = useSession() || []
  const canManage = user?.level === 0
  const adminOnlyNote = t('CUSTOMER_FEES_ADMIN_ONLY_NOTE', 'Only an administrator can turn off, change or delete a customer fee. Ask one if you need it.')
  const splitRef = useRef(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const [openKey, setOpenKey] = useState(null) // a fee id, NEW, or null
  const [openFee, setOpenFee] = useState(null) // the record the detail holds (it follows the list; it outlives a page or a search)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState({ open: false, busy: false })
  const [notice, setNotice] = useState(null)

  const loading = Boolean(feesList?.loading)
  const fees = Array.isArray(feesList?.fees) ? feesList.fees : []
  const totalItems = paginationProps?.totalItems
  const searching = Boolean(searchValue)
  const hasCustomerFees = !loading && (fees.length > 0 || (totalItems != null && totalItems > 0))
  // a search that finds nothing does not mean the store has no fees: the legacy field stays out of it
  const showLegacy = legacyField != null && (Boolean(keepLegacyField) || (!loading && !hasCustomerFees && !searching))

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

  const showTools = fees.length > 0 || Boolean(draft) || searching || (totalItems != null && totalItems > 0)

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

  // an id the lists do not know is said by its id, translated (it was «Site #7» and «PM #9»)
  const conditionsOf = (fee) => {
    const names = []
    if (fee?.site_id) {
      const site = sitesList.find(item => String(item.id) === String(fee.site_id))
      names.push(site?.name || t('SITE_WITH_ID', 'Site _id_').replace('_id_', () => String(fee.site_id)))
    }
    if (fee?.paymethod_id) {
      const paymethod = paymethodsList.find(item => String(item.id) === String(fee.paymethod_id))
      names.push(paymethod?.name || t('PAYMETHOD_WITH_ID', 'Payment method _id_').replace('_id_', () => String(fee.paymethod_id)))
    }
    if (fee?.delivery_type) {
      const option = deliveryTypeOptions.find(item => item.value === fee.delivery_type)
      names.push(option?.content || fee.delivery_type.charAt(0).toUpperCase() + fee.delivery_type.slice(1).replace(/_/g, ' '))
    }
    return names
  }

  // ── Open and close the detail ──
  const showDetail = (key, record) => {
    setNotice(null)
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
  }, [fees, openKey])

  const isOpen = openKey === NEW || (openKey != null && openFee != null)

  // ── The switch of a row ──
  const toggleEnabled = (fee, next) => Promise.resolve(updateFee?.(fee.id, { enabled: next }, { inlineError: true }))
    .then(result => (!result || result.error ? { ok: false, error: result?.result } : { ok: true }))

  // ── Selection ──
  const toggleOne = (id) => setSelectedIds(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  const pageIds = fees.map(fee => fee.id)
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
      result = await deleteFees?.(ids, { inlineError: true })
    } catch (error) {
      result = { error: true, result: [error?.message], deletedIds: [], failedIds: ids }
    }
    if (!mounted.current) return
    setDeleting({ open: false, busy: false })
    const failed = result?.failedIds ?? (result?.error || !result ? ids : [])
    const deleted = result?.deletedIds ?? ids.filter(id => !failed.includes(id))
    setSelectedIds(failed)
    if (openKey != null && openKey !== NEW && deleted.some(id => String(id) === String(openKey))) closeDetail()
    if (failed.length === 0) return
    const reason = translateApiMessage(t, firstMessage(result?.result), t('ERROR', 'Error'))
    setNotice(withCount(failed.length === 1
      ? t('CUSTOMER_FEES_DELETE_FAILED_ONE', '1 fee could not be deleted: _reason_')
      : t('CUSTOMER_FEES_DELETE_FAILED_OTHER', '_count_ fees could not be deleted: _reason_'), failed.length).replace('_reason_', () => reason))
  }

  // ── Pages (the controller keeps the page; the foot asks for the next one) ──
  const handleChangePage = (page) => {
    const nextPage = Number(page) >= 1 ? Number(page) : 1
    setPaginationProps(prev => ({ ...prev, currentPage: nextPage }))
    getFees(nextPage, paginationProps.pageSize)
  }

  const handleChangePageSize = (pageSize) => {
    const nextPageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
    setPaginationProps(prev => ({ ...prev, pageSize: nextPageSize, currentPage: 1 }))
    getFees(1, nextPageSize)
  }

  // ── The list ──
  const addButton = (
    <Button variant='primary' icon={Plus} disabled={!businessId} onClick={() => requestOpen(NEW, null)}>
      {t('ADD_CUSTOMER_FEE', 'Add customer fee')}
    </Button>
  )

  const noRows = !loading && fees.length === 0
  const emptyText = (searching || draft)
    ? t('NO_RESULTS_FOUND', 'No results found')
    : t('NO_CUSTOMER_FEES', 'No customer fees yet.')

  let body
  if (!showTools && noRows) {
    body = (
      <div className='odc-cf-empty'>
        <p className='odc-cf-empty-text'>{t('NO_CUSTOMER_FEES', 'No customer fees yet.')}</p>
        {addButton}
      </div>
    )
  } else {
    body = (
      <>
        {showTools && (
          <div className='odc-cf-tools'>
            <SearchField
              className='odc-cf-search'
              value={draft}
              onChange={handleSearch}
              label={t('SEARCH_CUSTOMER_FEES', 'Search customer fees')}
              placeholder={t('SEARCH', 'Search')}
              clearLabel={t('CLEAR', 'Clear')}
            />
            {addButton}
          </div>
        )}
        {notice && <InlineNotice tone='warning' icon={TriangleAlert} className='odc-cf-notice'>{notice}</InlineNotice>}
        {selectedIds.length > 0 && (
          <SelectionBar
            label={t('CUSTOMER_FEES_BULK_ACTIONS_LABEL', 'Actions for selected customer fees')}
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
        <CustomerFeesTable
          fees={fees}
          loading={loading && fees.length === 0}
          selectedIds={selectedIds}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
          activeId={isOpen && openKey !== NEW ? openKey : undefined}
          onOpen={(fee) => requestOpen(fee.id, fee)}
          onToggleEnabled={toggleEnabled}
          canManage={canManage}
          conditionsOf={conditionsOf}
          empty={<p className='odc-cf-empty-text'>{emptyText}</p>}
        />
        {totalItems > 0 && (
          <div className='odc-cf-foot'>
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
    <div className='odc-cf-pane'>
      {!canManage && <InlineNotice tone='info' live={false} className='odc-cf-notice'>{adminOnlyNote}</InlineNotice>}
      {body}
    </div>
  )

  const count = selectedIds.length
  return (
    <div className='odc-root odc-cf'>
      {showLegacy && <div className='odc-cf-legacy'>{legacyField}</div>}
      <SectionSplit
        revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
        ref={splitRef}
        splitFrom={EDITOR_PANEL_WIDE_FROM}
        open={isOpen}
        detailKey={openKey}
        onClose={closeDetail}
        onExtendChange={value => setIsExtendExtraOpen?.(value)}
        detailTitle={openFee?.name || t('NEW_CUSTOMER_FEE', 'New customer fee')}
        closeLabel={t('CLOSE', 'Close')}
        backLabel={t('BACK', 'Back')}
        list={list}
        detail={isOpen
          ? (
            <CustomerFeeDetail
              key={openKey === NEW ? NEW : openFee.id}
              fee={openKey === NEW ? null : openFee}
              deliveryTypeOptions={deliveryTypeOptions}
              siteOptions={siteOptions}
              paymethodOptions={paymethodOptions}
              createFee={createFee}
              updateFee={updateFee}
              canManage={canManage}
              adminOnlyNote={adminOnlyNote}
              onSaved={(record) => setOpenFee(current => (current ? { ...current, ...record } : current))}
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
          ? t('CUSTOMER_FEES_DELETE_TITLE_ONE', 'Delete 1 customer fee?')
          : withCount(t('CUSTOMER_FEES_DELETE_TITLE_OTHER', 'Delete _count_ customer fees?'), count)}
        // redesign tanda AB (S-5): the button names what it deletes, as the title does
        confirmLabel={count === 1 ? t('CUSTOMER_FEES_DELETE_CONFIRM_ONE', 'Delete customer fee') : t('CUSTOMER_FEES_DELETE_CONFIRM_OTHER', 'Delete customer fees')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDeleting(current => (current.busy ? current : { ...current, open: false }))}
        onConfirm={confirmDelete}
      >
        {t('CUSTOMER_FEES_DELETE_BODY', "Customers of this store stop paying them. This can't be undone.")}
      </ConfirmDialog>
    </div>
  )
}

export const CustomerFees = (props) => {
  // `formState`, `setFormState` and `handleUpdateBusinessClick` are no longer used by this UI (the legacy field is the parent's);
  // they are still accepted, and the controller does not need them.
  const {
    businessId,
    business,
    /* eslint-disable no-unused-vars */
    formState,
    setFormState,
    handleUpdateBusinessClick,
    /* eslint-enable no-unused-vars */
    ...rest
  } = props

  const customerFeesProps = {
    ...rest,
    businessId,
    business,
    UIComponent: CustomerFeesUI
  }

  return <CustomerFeesController {...customerFeesProps} />
}
