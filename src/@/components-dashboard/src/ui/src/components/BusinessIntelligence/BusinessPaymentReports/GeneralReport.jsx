import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Button, EmptyState, InlineNotice, Menu, SegmentedControl, Skeleton } from '../../Shared/Product'
import { SEGMENTED_MAX_OPTIONS } from '../../Shared/Product/SegmentedControl'
import { Download, Inbox, TriangleAlert } from '../../Shared/Icon'
import { readableApiMessage } from './readableApiMessage'
import { useFocusAfter } from './useFocusAfter'
import './business-payments.css'

// redesign business-payments FC2 (D5, D9, D11; ): the General report. `main` had a calendar (weekly methods) and a grid of months
// (monthly ones) that picked ONE period and then a download button. Here the method is one control and the billing periods of the method are a
// list, newest first, each with its own «Download CSV»: the period is read, not found. The periods are computed by the controller as `main` does;
// this file only draws them and asks for the download. Nothing is downloaded by itself.

const PERIODS_STEP = 8

// The text of an API error: a list of messages, a message, or an object with `message`. The first one that has text.
const messageOf = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

// «Cut-off _time_»: the time is a figure of its own (decision 11)
const fillTime = (template, time) => template.split('_time_').flatMap((part, index) => (
  index === 0 ? [part] : [<bdi key={index} dir='ltr' className='odc-figure'>{time}</bdi>, part]
))

export const GeneralReport = ({ methods, method, selectMethod, periods = [], report }) => {
  const [, t] = useLanguage()
  const [{ parseDate, parseTime }] = useUtils()
  // How many periods are on screen, for the method they were asked for: another method starts again at eight, with no effect to run
  const gateway = method?.gateway ?? null
  const [shown, setShown] = useState({ gateway: null, count: PERIODS_STEP })
  const count = shown.gateway === gateway ? shown.count : PERIODS_STEP
  const listRef = useRef(null)
  const focusIndex = useRef(null)
  // redesign «Try again» of the methods removes the button that had the focus; the report takes it when the methods are no longer loading
  const rootRef = useRef(null)
  const armRetry = useFocusAfter(rootRef, !methods?.loading)
  const rootLabel = t('GENERAL_REPORT', 'General report')

  const items = methods?.items || []
  const methodLabel = (item) => `${item.name} · ${item.cycle === 'weekly' ? t('WEEKLY', 'Weekly') : t('MONTHLY', 'Monthly')}`

  // «Show older periods» may take away the very button that was pressed (when it shows the last ones): the focus goes to the first
  // period that came in, never to <body>
  useEffect(() => {
    const index = focusIndex.current
    if (index == null) return
    focusIndex.current = null
    const row = listRef.current?.querySelectorAll('li')[index]
    const target = row?.querySelector('button:not(:disabled)')
    if (target) target.focus()
    else row?.focus()
  }, [count])

  if (methods?.loading) {
    return (
      <div className='odc-bpr-general' aria-busy='true' data-state='loading' ref={rootRef} role='group' aria-label={rootLabel} tabIndex={-1}>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <div className='odc-bpr-skeleton' aria-hidden='true'>
          <Skeleton size='60%' block='var(--od-x-control-height)' />
          <Skeleton size='40%' />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} block='var(--od-x-control-height-lg)' />
          ))}
        </div>
      </div>
    )
  }

  if (methods?.error) {
    return (
      <div className='odc-bpr-general' data-state='error' ref={rootRef} role='group' aria-label={rootLabel} tabIndex={-1}>
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={t('BUSINESS_PAYMENTS_METHODS_ERROR', "We couldn't load the payment methods.")}
          description={readableApiMessage(t, messageOf(methods.error), undefined)}
          action={<Button onClick={() => { armRetry(); methods.retry?.() }}>{t('TRY_AGAIN', 'Try again')}</Button>}
        />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className='odc-bpr-general' data-state='empty' ref={rootRef} role='group' aria-label={rootLabel} tabIndex={-1}>
        <EmptyState icon={Inbox} title={t('BUSINESS_PAYMENTS_NO_METHODS', 'There are no payment methods with a billing cycle.')} />
      </div>
    )
  }

  const methodLabelText = t('SELECT_PAYMENT_METHOD', 'Select a payment method')
  const visible = periods.slice(0, count)
  const downloading = report?.loadingKey != null
  // the period as it was sent to the API (no zone), so the date read is the one of the file (D11)
  const dateOf = (value) => parseDate(value, { dateOnly: true, utc: false })
  const periodText = (period) => `${dateOf(period.periodStart)} – ${dateOf(period.periodEnd)}`

  const showOlder = () => {
    focusIndex.current = count
    setShown({ gateway, count: count + PERIODS_STEP })
  }

  return (
    <div className='odc-bpr-general' data-state='ready' ref={rootRef} role='group' aria-label={rootLabel} tabIndex={-1}>
      <div className='odc-bpr-method'>
        {items.length <= SEGMENTED_MAX_OPTIONS
          ? (
            <SegmentedControl
              label={methodLabelText}
              value={gateway ?? ''}
              onValueChange={selectMethod}
              options={items.map(item => ({ value: item.gateway, label: methodLabel(item) }))}
            />
            )
          : (
            // redesign business-payments integration (D5): beyond the four options a segmented control takes, a menu of single choice
            // (`P/Menu` radios) whose trigger shows the method in use; the legacy dropdown (FirstSelect) would bring back the legacy residue
            <Menu
              label={method ? methodLabel(method) : t('SELECT_METHOD', 'Select method...')}
              align='start'
              triggerProps={{ 'aria-label': `${methodLabelText}: ${method ? methodLabel(method) : t('SELECT_METHOD', 'Select method...')}` }}
              items={items.map(item => ({
                key: item.gateway,
                type: 'radio',
                checked: item.gateway === gateway,
                label: methodLabel(item),
                onSelect: () => selectMethod(item.gateway)
              }))}
            />
            )}
      </div>

      {method && (
        <div className='odc-bpr-periods'>
          <div className='odc-bpr-periods-head'>
            <h2 className='odc-bpr-section-title'>{t('SELECT_BILLING_PERIOD', 'Select a billing period')}</h2>
            {periods.length > 0 && (
              <p className='odc-bpr-cutoff'>
                {fillTime(t('BUSINESS_PAYMENTS_CUTOFF', 'Cut-off _time_'), parseTime(method.cycle_time, { utc: false }))}
              </p>
            )}
          </div>

          {periods.length === 0
            ? <EmptyState icon={Inbox} title={t('NO_DATA', 'No data')} />
            : (
              <>
                <ul ref={listRef} className='odc-bpr-period-list'>
                  {visible.map(period => {
                    const busy = report?.loadingKey === period.key
                    const failed = report?.errorKey != null && report.errorKey === period.key
                    return (
                      <li key={period.key} className='odc-bpr-period' tabIndex={-1}>
                        <div className='odc-bpr-period-row'>
                          <span className='odc-bpr-period-text'>{periodText(period)}</span>
                          <Button
                            // decision 12: 32 px visible (44 of area on a phone); `sm` (28) fell short on the phone (phase 3)
                            size='md'
                            icon={Download}
                            busy={busy}
                            disabled={downloading && !busy}
                            aria-label={t('BUSINESS_PAYMENTS_DOWNLOAD_CSV_FOR', 'Download CSV: _method_, _period_')
                              .replace('_method_', method.name)
                              .replace('_period_', periodText(period))}
                            onClick={() => report.download(period)}
                          >
                            {t('DOWNLOAD_CSV', 'Download CSV')}
                          </Button>
                        </div>
                        {failed && (
                          <InlineNotice tone='danger' icon={TriangleAlert}>
                            {readableApiMessage(
                              t,
                              messageOf(report.error),
                              t('BUSINESS_PAYMENTS_DOWNLOAD_FAILED', 'The report could not be downloaded. Try again.')
                            )}
                          </InlineNotice>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {periods.length > count && (
                  <div className='odc-bpr-more'>
                    <Button variant='ghost' onClick={showOlder}>
                      {t('BUSINESS_PAYMENTS_SHOW_OLDER', 'Show older periods')}
                    </Button>
                  </div>
                )}
              </>
              )}
        </div>
      )}
    </div>
  )
}
