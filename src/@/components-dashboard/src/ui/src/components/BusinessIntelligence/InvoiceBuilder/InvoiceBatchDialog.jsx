import React, { useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { zipStore } from '../../../../../utils/zipStore'
import { Button, Dialog, InlineNotice, SelectableList, Status } from '../../Shared/Product'
import { Download, RotateCcw } from '../../Shared/Icon'
import { fillTemplate, figure } from '../AnalyticsKit/reportPillParts'
import { saveInvoicePdfBlob } from '../downloadInvoicePdf'
import { invoicePeriodName } from './useInvoicePdfDownload'
import './invoice-batch.css'

// several invoices at once. The dialog picks businesses or drivers (the same list as the picker of the form, with its
// search and pages), creates one invoice each with the form of the page (`batch.run`, the controller's) and shows each one as it
// ends: ready (download it), no orders (no PDF), failed (its reason and a retry) or stopped. The ready ones also go as one .zip.
// While it runs it cannot be closed; «Stop» cancels what is in flight and what waits.

// The page size of the business list (the controller's)
const PAGE_SIZE = 10

const FAMILY = { queued: 'pending', running: 'progress', done: 'done', empty: 'review', error: 'cancel', cancelled: 'pending' }

// «José» is found by «jose» and by «JOSE» (the driver list is the whole list, filtered here as the picker does)
const plain = (text) => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

const named = (template, name) => String(template).replace('_name_', () => name)

export const InvoiceBatchDialog = ({ open, onOpenChange, kind, party, batch, makePdf, pdfReady }) => {
  const [, t] = useLanguage()
  const isBusiness = kind === 'business'
  const [view, setView] = useState('select')
  const [query, setQuery] = useState('')
  const [zipping, setZipping] = useState(false)

  const items = batch.items
  const results = view === 'results' && items.length > 0
  const selected = batch.selected
  const selectedIds = selected.map(item => item.id)
  const list = Array.isArray(party?.items) ? party.items : []
  const shown = isBusiness || !query ? list : list.filter(item => plain(item.name).includes(plain(query)))
  const full = selected.length >= batch.limit

  const title = isBusiness
    ? t('INVOICE_BATCH_BUSINESSES', 'Invoice several businesses')
    : t('INVOICE_BATCH_DRIVERS', 'Invoice several drivers')

  const create = () => {
    batch.run(makePdf)
    setView('results')
  }

  const messageOf = (item) => {
    const fallback = t('INVOICE_BATCH_FAILED_REASON', 'The invoice could not be created.')
    // the API answers a list of messages; a thrown error («Invalid response format», a network failure) is never shown raw
    const first = (Array.isArray(item.error) ? item.error : [item.error]).find(message => typeof message === 'string')
    return translateApiMessage(t, first, fallback)
  }

  const statusLabel = (status) => ({
    queued: t('INVOICE_BATCH_QUEUED', 'Waiting'),
    running: t('INVOICE_BATCH_RUNNING', 'Creating'),
    done: t('INVOICE_BATCH_READY', 'Ready'),
    empty: t('INVOICE_BATCH_NO_ORDERS', 'No orders'),
    error: t('INVOICE_BATCH_FAILED', 'Failed'),
    cancelled: t('INVOICE_BATCH_STOPPED', 'Stopped')
  })[status]

  const ready = items.filter(item => item.status === 'done')
  const retryable = items.filter(item => item.status === 'error' || item.status === 'cancelled')
  const finished = items.filter(item => !['queued', 'running'].includes(item.status)).length

  const downloadZip = async () => {
    setZipping(true)
    try {
      const zip = await zipStore(ready.map(item => ({ name: item.pdf.filename, blob: item.pdf.blob })))
      const period = invoicePeriodName(ready[0]?.invoice)
      saveInvoicePdfBlob(zip, `invoices${period ? `-${period}` : ''}.zip`)
    } finally {
      setZipping(false)
    }
  }

  let footer
  if (!results) {
    footer = (
      <>
        <Button onClick={() => onOpenChange(false)}>{t('CANCEL', 'Cancel')}</Button>
        <Button variant='primary' disabled={!selected.length || Boolean(batch.blocked) || !pdfReady || batch.running} onClick={create}>
          {fillTemplate(
            selected.length === 1
              ? t('INVOICE_BATCH_CREATE_ONE', 'Create _count_ invoice')
              : t('INVOICE_BATCH_CREATE_OTHER', 'Create _count_ invoices'),
            { count: selected.length },
            figure
          )}
        </Button>
      </>
    )
  } else if (batch.running) {
    footer = <Button onClick={() => batch.cancel()}>{t('INVOICE_BATCH_STOP', 'Stop')}</Button>
  } else {
    footer = (
      <>
        <Button onClick={() => setView('select')}>{t('INVOICE_BATCH_BACK', 'Change selection')}</Button>
        {retryable.length > 0 && (
          <Button icon={RotateCcw} onClick={() => batch.retry(makePdf)}>
            {t('INVOICE_BATCH_RETRY_FAILED', 'Try the failed ones again')}
          </Button>
        )}
        {ready.length > 0 && (
          <Button variant='primary' icon={Download} busy={zipping} onClick={downloadZip}>
            {t('INVOICE_BATCH_DOWNLOAD_ZIP', 'Download all (.zip)')}
          </Button>
        )}
      </>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size='lg'
      title={title}
      description={fillTemplate(
        t('INVOICE_BATCH_DESCRIPTION', 'One PDF each, with the period, fees and filters of the form. Up to _limit_ at a time.'),
        { limit: batch.limit },
        figure
      )}
      closeLabel={t('CLOSE', 'Close')}
      closeDisabled={batch.running}
      footer={footer}
    >
      {!results && (
        <div className='odc-iv-batch'>
          {batch.blocked === 'no_order_types' && (
            <InlineNotice tone='warning'>{t('INVOICE_MANAGER_NO_ORDER_TYPES', 'No order types selected')}</InlineNotice>
          )}
          {batch.blocked === 'setup' && (
            <InlineNotice tone='warning'>{t('INVOICE_BATCH_NOT_READY', 'The payment methods and settings have to load first.')}</InlineNotice>
          )}
          <p className='odc-iv-batch-count' role='status'>
            {fillTemplate(t('INVOICE_BATCH_SELECTED', '_count_ of _limit_ selected'), { count: selected.length, limit: batch.limit }, figure)}
            {full && <> · {t('INVOICE_BATCH_LIMIT_REACHED', 'Limit reached')}</>}
          </p>
          <SelectableList
            label={isBusiness ? t('BUSINESSES', 'Businesses') : t('DRIVERS', 'Drivers')}
            items={shown}
            selectedIds={selectedIds}
            onToggle={(id, next) => {
              const item = shown.find(other => other.id === id)
              if (item) batch.toggle(item, next)
            }}
            avatars={isBusiness ? 'business' : 'person'}
            loading={Boolean(party?.loading)}
            loadingLabel={t('LOADING', 'Loading')}
            emptyTitle={t('NO_RESULTS_FOUND', 'No results found')}
            error={Boolean(party?.error)}
            errorTitle={t('INVOICE_BATCH_LIST_ERROR', 'The list could not be loaded.')}
            retryLabel={t('TRY_AGAIN', 'Try again')}
            onRetry={party?.retry}
            onSearch={(text) => (isBusiness ? party.setSearch?.(text) : setQuery(text))}
            searchLabel={t('SEARCH', 'Search')}
            clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
            onSelectAll={() => batch.selectAll(shown)}
            selectAllLabel={isBusiness
              ? t('INVOICE_BATCH_SELECT_PAGE', 'Select all on this page')
              : t('INVOICE_BATCH_SELECT_SHOWN', 'Select all shown')}
            onSelectNone={() => batch.clear()}
            selectNoneLabel={t('SELECT_NONE', 'Select none')}
            pagination={isBusiness && party.totalPages > 1
              ? {
                  page: party.page,
                  // as the picker: the party knows its pages, not its total, so the total is their upper bound
                  pageSize: PAGE_SIZE,
                  total: party.totalPages * PAGE_SIZE,
                  itemCount: list.length,
                  onPageChange: party.goToPage,
                  label: t('PAGINATION', 'Pagination'),
                  previousLabel: t('PREVIOUS_PAGE', 'Previous page'),
                  nextLabel: t('NEXT_PAGE', 'Next page'),
                  rangeLabel: () => fillTemplate(t('PAGE_STATUS', 'Page _page_ of _total_'), { page: party.page, total: party.totalPages }, figure),
                  pageStatusLabel: (current) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(party.totalPages))
                }
              : undefined}
          />
        </div>
      )}
      {results && (
        <div className='odc-iv-batch'>
          <p className='odc-iv-batch-count' role='status'>
            {fillTemplate(t('INVOICE_BATCH_PROGRESS', '_done_ of _total_ finished'), { done: finished, total: items.length }, figure)}
          </p>
          <ul className='odc-iv-batch-results' aria-label={title}>
            {items.map(item => (
              <li key={item.id} className='odc-iv-batch-row' data-status={item.status}>
                <div className='odc-iv-batch-main'>
                  <bdi className='odc-iv-batch-name'>{item.name}</bdi>
                  <Status family={FAMILY[item.status]} label={statusLabel(item.status)} />
                </div>
                {item.status === 'error' && <p className='odc-iv-batch-reason'>{messageOf(item)}</p>}
                {item.truncated && (
                  <p className='odc-iv-batch-reason'>
                    {fillTemplate(
                      t('INVOICE_MANAGER_TRUNCATED', 'Only _received_ of _total_ orders were read; the totals may be incomplete.'),
                      { received: item.truncated.received, total: item.truncated.total },
                      figure
                    )}
                  </p>
                )}
                <div className='odc-iv-batch-actions'>
                  {item.status === 'done' && (
                    <Button
                      size='sm'
                      icon={Download}
                      aria-label={named(t('INVOICE_BATCH_DOWNLOAD_NAMED', 'Download the PDF of _name_'), item.name)}
                      onClick={() => saveInvoicePdfBlob(item.pdf.blob, item.pdf.filename)}
                    >
                      {t('DOWNLOAD', 'Download')}
                    </Button>
                  )}
                  {(item.status === 'error' || item.status === 'cancelled') && !batch.running && (
                    <Button
                      size='sm'
                      icon={RotateCcw}
                      aria-label={named(t('INVOICE_BATCH_RETRY_NAMED', 'Try _name_ again'), item.name)}
                      onClick={() => batch.retry(makePdf, item.id)}
                    >
                      {t('TRY_AGAIN', 'Try again')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  )
}
