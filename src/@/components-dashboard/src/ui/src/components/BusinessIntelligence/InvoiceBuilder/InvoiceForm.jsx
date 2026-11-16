import React, { useContext, useEffect, useId, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { getOrderStatusPrefix } from '../../../utils'
import {
  Button,
  ChecklistPopover,
  Checkbox,
  InlineNotice,
  NumberField,
  RadioGroup,
  TextArea,
  TextField
} from '../../Shared/Product'
import { Banknote, ListChecks } from '../../Shared/Icon'
import { figure, fillTemplate } from '../AnalyticsKit/reportPillParts'
import { InvoicePeriod } from './InvoicePeriod'
import { PartyPicker } from '../AnalyticsKit/PartyPicker'
import './invoice-form.css'

// redesign invoice FC1 (D1, D7, D9, D12, D13; IV-06, IV-08, IV-10; auditor 7, 11, 12, 13): the form of the invoice page, in four
// sections with their h2 (Who and when, Fees, Which orders count, Notes), every field of `main` in view (nothing behind a «More»)
// and no «Save»: each change goes to the controller at once. It paints what the controller hands it and writes only through it
// (`setField`, `setPeriod`, `party.select`, `payMethods.toggle`, `orderTypes.toggle`); it keeps no copy of the form.
//
// Props: the ones of the controller of the page (`kind`, `form`, `setField`, `setPeriod`, `party`, `payMethods`, `orderTypes`,
// `orders`) plus `focusTarget` (`null`, `'payment_methods'`, `'order_type'` or `'general'`, the destinations of ⌘K) and
// `onFocusDone()`: when a target arrives the form scrolls to its section, focuses its pill (or its first field) and says it is done.
// `onBatch()`, when given, opens the dialog of several invoices at once.

// The billable states of `main` (the PDF reads the same lists): the business invoice, the driver invoice, and what the driver
// invoice adds with «Include canceled orders». The business with that box on counts every status.
const BUSINESS_STATES = [0, 1, 7, 8, 9, 11, 15]
const DRIVER_STATES = [1, 11]
const DRIVER_CANCELED_STATES = [2, 5, 6, 10, 12]

// A decimal with no thousands separator and room for the fractions a percentage may have
const NUMBER_FORMAT = { maximumFractionDigits: 6, useGrouping: false }

// What the controller keeps as a string (or a number) goes to the field as a number or empty, and back as a string
const asNumber = (value) => {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// Rows of a checklist: one per id; two with the same name are told apart by their second text
const withSecondText = (items) => {
  const names = new Map()
  const pairs = new Map()
  items.forEach(item => {
    names.set(item.name, (names.get(item.name) ?? 0) + 1)
    pairs.set(`${item.name}|${item.gateway ?? ''}`, (pairs.get(`${item.name}|${item.gateway ?? ''}`) ?? 0) + 1)
  })
  return items.map(item => {
    const repeated = names.get(item.name) > 1
    const unique = item.gateway && pairs.get(`${item.name}|${item.gateway}`) === 1
    return { id: item.id, name: item.name, secondary: repeated ? (unique ? item.gateway : `#${item.id}`) : undefined }
  })
}

const Section = React.forwardRef(function Section ({ title, titleRef, children }, ref) {
  const titleId = useId()
  return (
    <section ref={ref} aria-labelledby={titleId} className='odc-iv-section'>
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className='odc-iv-section-title'>{title}</h2>
      {children}
    </section>
  )
})

export const InvoiceForm = ({
  kind,
  form = {},
  setField,
  setPeriod,
  party,
  payMethods,
  orderTypes,
  orders,
  focusTarget = null,
  onFocusDone,
  onBatch
}) => {
  const [languageState, t] = useLanguage()
  const [configFile] = useContext(ConfigFileContext) ?? []
  const isBusiness = kind === 'business'
  const [statesOpen, setStatesOpen] = useState(false)
  const statesId = useId()
  const canceledNoteId = useId()

  const whoRef = useRef(null)
  const ordersRef = useRef(null)
  const ordersTitleRef = useRef(null)
  const payRef = useRef(null)
  const typeRef = useRef(null)
  const handled = useRef(null)

  // ⌘K: scroll to the section, focus the pill (or the first field), say it is done. A target that has nothing to focus (the
  // pill of a driver's order types, a pill replaced by its error) lands on the title of the section, which can take the focus.
  useEffect(() => {
    if (!focusTarget) {
      handled.current = null
      return
    }
    if (handled.current === focusTarget) return
    handled.current = focusTarget
    const section = focusTarget === 'general' ? whoRef.current : ordersRef.current
    const holder = { payment_methods: payRef, order_type: typeRef }[focusTarget]
    const target = focusTarget === 'general'
      ? whoRef.current?.querySelector('button, input, textarea')
      : holder?.current?.querySelector('button')
    section?.scrollIntoView?.({ block: 'start' })
    ;(target ?? (focusTarget === 'general' ? null : ordersTitleRef.current))?.focus?.({ preventScroll: true })
    onFocusDone?.()
  }, [focusTarget])

  // ---- Fees ----------------------------------------------------------------------------------------------------------------------
  const withUnit = (label, unit) => (unit ? <>{label} <span className='odc-iv-unit'>({unit})</span></> : label)
  const numberField = (name, label, { unit, hint, span = false, negative = false } = {}) => (
    <NumberField
      key={name}
      name={name}
      label={withUnit(label, unit)}
      hint={hint}
      min={negative ? undefined : 0}
      format={NUMBER_FORMAT}
      // review F-1 (row 1): a field that takes a minus leaves the keyboard to Base UI (`text`): iOS's decimal pad has no «-»
      inputMode={negative ? undefined : 'decimal'}
      value={asNumber(form[name])}
      onChange={(next) => setField?.(name, next == null ? '' : String(next))}
      fieldClassName={span ? 'odc-iv-span' : undefined}
    />
  )

  // ---- Which orders count ----------------------------------------------------------------------------------------------------------
  const dictionary = languageState?.dictionary ?? {}
  const prefix = String(configFile?.app_internal_name ?? '').toUpperCase()
  const stateIds = isBusiness
    ? BUSINESS_STATES
    : (form.cancelled ? [...DRIVER_STATES, ...DRIVER_CANCELED_STATES] : DRIVER_STATES)
  const stateName = (id) => getOrderStatusPrefix(id, dictionary, prefix)

  const payItems = Array.isArray(payMethods?.items) ? payMethods.items : []
  const typeItems = Array.isArray(orderTypes?.items) ? orderTypes.items : []

  const countValue = (items) => {
    if (items.length === 0) return undefined
    const on = items.filter(item => item.checked).length
    if (on === items.length) return t('ALL', 'All')
    if (on === 0) return t('NONE', 'None')
    return <>{fillTemplate(t('INVOICE_MANAGER_N_OF_M', '_count_ of _total_'), { count: on, total: items.length }, figure)}</>
  }

  const checklistTexts = {
    searchLabel: t('SEARCH', 'Search'),
    clearSearchLabel: t('CLEAR_SEARCH', 'Clear search'),
    loadingLabel: t('LOADING', 'Loading'),
    noResultsLabel: t('NO_RESULTS_FOUND', 'No results found'),
    clearLabel: t('CLEAR', 'Clear')
  }

  return (
    <div className='odc-iv-form'>
      {/* ---- Who and when ---- */}
      <Section ref={whoRef} title={t('INVOICE_MANAGER_SECTION_WHO', 'Who and when')}>
        <div className='odc-iv-fields'>
          <InvoicePeriod from={form.from} to={form.to} setPeriod={setPeriod} />
          {party && <PartyPicker party={party} />}
          {/* several businesses or drivers at once, in a dialog, with this same form */}
          {onBatch && (
            <div className='odc-iv-span'>
              <Button variant='link' onClick={onBatch}>
                {isBusiness
                  ? t('INVOICE_BATCH_BUSINESSES', 'Invoice several businesses')
                  : t('INVOICE_BATCH_DRIVERS', 'Invoice several drivers')}
              </Button>
            </div>
          )}
          {isBusiness && (
            <div className='odc-iv-span'>
              <RadioGroup
                label={t('INVOICE_MANAGER_INVOICE_TYPE', 'Invoice type')}
                value={form.type}
                onValueChange={(next) => setField?.('type', next)}
                options={[
                  { value: 'charge', label: t('INVOICE_MANAGER_TYPE_CHARGE', 'Charge the business commission and fees') },
                  { value: 'payout', label: t('INVOICE_MANAGER_TYPE_PAYOUT', 'Pay out the business') }
                ]}
              />
            </div>
          )}
        </div>
      </Section>

      {/* ---- Fees ---- */}
      <Section title={t('INVOICE_MANAGER_SECTION_FEES', 'Fees')}>
        <div className='odc-iv-fields'>
          {numberField('percentage_fee', t('INVOICE_MANAGER_COMMISSION', 'Commission'), { unit: '%', hint: t('INVOICE_MANAGER_COMMISSION_HINT', 'Of the orders subtotal') })}
          {numberField('fixed_fee', t('INVOICE_MANAGER_FIXED_FEE', 'Fixed fee per order'))}
          {!isBusiness && numberField('percentage_delivery_price', t('INVOICE_MANAGER_DELIVERY_FEE_PERCENT', 'Delivery fee'), { unit: '%' })}
          {!isBusiness && numberField('percentage_driver_tip', t('INVOICE_MANAGER_DRIVER_TIP_PERCENT', 'Driver tip'), { unit: '%' })}
          {numberField('tax', t('INVOICE_MANAGER_TAX', 'Tax'), { unit: '%' })}
          {/* redesign (row 1, P6, D-25 b): the store subtracts it with the type «Pay out»; the driver has no type, so it takes a minus */}
          {isBusiness
            ? numberField('misc_amount', t('INVOICE_MANAGER_OTHER_AMOUNT', 'Other amount'))
            : numberField('misc_amount', t('INVOICE_MANAGER_OTHER_AMOUNT', 'Other amount'), {
              negative: true,
              hint: t('INVOICE_MANAGER_OTHER_AMOUNT_NEGATIVE_HINT', 'A negative amount subtracts')
            })}
          <TextField
            name='misc_description'
            label={t('INVOICE_MANAGER_OTHER_AMOUNT_DESCRIPTION', 'Other amount description')}
            value={form.misc_description ?? ''}
            onChange={(next) => setField?.('misc_description', next)}
            autoComplete='off'
            fieldClassName='odc-iv-span'
          />
        </div>
      </Section>

      {/* ---- Which orders count ---- */}
      <Section ref={ordersRef} titleRef={ordersTitleRef} title={t('INVOICE_MANAGER_SECTION_ORDERS', 'Which orders count')}>
        <div className='odc-iv-help'>
          <p>{t('INVOICE_MANAGER_ORDERS_HELP', 'Orders in billable states paid with these methods and of these types.')}</p>
          <Button
            variant='link'
            aria-expanded={statesOpen}
            aria-controls={statesOpen ? statesId : undefined}
            onClick={() => setStatesOpen(open => !open)}
          >
            {t('INVOICE_MANAGER_WHICH_STATES', 'Which states?')}
          </Button>
        </div>
        {statesOpen && (
          <ul id={statesId} role='list' aria-label={t('INVOICE_MANAGER_WHICH_STATES', 'Which states?')} className='odc-iv-states'>
            {stateIds.map(id => <li key={id}>{stateName(id)}</li>)}
          </ul>
        )}

        <div className='odc-iv-pills'>
          {payMethods?.error
            ? (
              <InlineNotice
                tone='danger'
                className='odc-iv-notice'
                action={payMethods.retry && <Button variant='secondary' size='sm' onClick={payMethods.retry}>{t('TRY_AGAIN', 'Try again')}</Button>}
              >
                {t('INVOICE_MANAGER_PAYMETHODS_ERROR', 'The payment methods could not be loaded.')}
              </InlineNotice>
              )
            : (
              <div ref={payRef} className='odc-iv-pill'>
                <ChecklistPopover
                  icon={Banknote}
                  label={t('PAYMENT_METHODS', 'Payment methods')}
                  value={payMethods?.loading ? undefined : countValue(payItems)}
                  items={withSecondText(payItems)}
                  selected={payItems.filter(item => item.checked).map(item => item.id)}
                  onToggle={(id) => payMethods?.toggle?.(id)}
                  onClear={() => payMethods?.setAll?.(true)}
                  loading={Boolean(payMethods?.loading)}
                  {...checklistTexts}
                />
              </div>
              )}
          {isBusiness && orderTypes && (
            <div ref={typeRef} className='odc-iv-pill'>
              <ChecklistPopover
                icon={ListChecks}
                label={t('INVOICE_MANAGER_ORDER_TYPES', 'Order types')}
                value={countValue(typeItems)}
                items={typeItems.map(item => ({ id: item.value, name: item.name }))}
                selected={typeItems.filter(item => item.checked).map(item => item.value)}
                onToggle={(value) => orderTypes.toggle?.(value)}
                onClear={() => orderTypes.setAll?.(true)}
                {...checklistTexts}
              />
            </div>
          )}
          {orders?.blocked === 'no_order_types' && (
            <InlineNotice tone='warning' className='odc-iv-notice'>
              {t('INVOICE_MANAGER_NO_ORDER_TYPES', 'No order types selected')}
            </InlineNotice>
          )}
        </div>

        <div className='odc-iv-checks'>
          <div className='odc-iv-check'>
            <Checkbox
              checked={Boolean(form.cancelled)}
              onCheckedChange={(checked) => setField?.('cancelled', checked)}
              aria-describedby={isBusiness ? canceledNoteId : undefined}
            >
              {t('INCLUDE_CANCELED_ORDERS', 'Include canceled orders')}
            </Checkbox>
            {isBusiness && (
              <p id={canceledNoteId} className='odc-iv-check-note'>
                {t('INVOICE_MANAGER_CANCELED_NOTE', 'Includes every status, as before')}
              </p>
            )}
          </div>
          {isBusiness && (
            <Checkbox
              checked={Boolean(form.discounts)}
              onCheckedChange={(checked) => setField?.('discounts', checked)}
            >
              {t('INCLUDE_DISCOUNTS_BY_PLATFORM', 'Include discounts done by platform')}
            </Checkbox>
          )}
        </div>
      </Section>

      {/* ---- Notes ---- */}
      <Section title={t('NOTES', 'Notes')}>
        <TextArea
          name='notes'
          aria-label={t('NOTES', 'Notes')}
          hint={t('INVOICE_MANAGER_NOTES_HINT', 'Printed at the end of the invoice')}
          value={form.notes ?? ''}
          onChange={(next) => setField?.('notes', next)}
        />
      </Section>
    </div>
  )
}
