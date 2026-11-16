import React, { useEffect, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import {
  Avatar,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  RecordCardList,
  Switch
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Check, FilterX, TriangleAlert, Users } from '../../Shared/Icon'
import { customerName, isCashWalletOn, phoneOf, walletOf } from './customerData'
import './customers-table.css'

// redesign UC-B2 (decisions 7, 8; M-C8, M-C10, M-C14): the customers list as a Product DataTable (and RecordCards under 768px).
// It draws what the controller gives (`users`) and what the host decides (selection, the open customer, the status toggle from
// useCustomerActiveToggle); it fetches nothing and owns no dialog. The «Type» column and the orders badge on the avatar are gone
// on purpose (decision 7): the list asks only for level 3, and the orders already have their column.

const DEFAULT_PAGE_SIZE = 10

// redesign UC-B2 (as QueueTable, OC-F1): width priorities. A column steps aside when the table is narrower than all the columns
// that outrank it plus its own: Wallet first, then Phone. The Customer column is locked. What each asks for, in px, padding
// included (the selection cell counts too). The phone is not lost: the Customer cell's second line takes it when its column is
// away; the balance stays in the customer's panel.
const WIDTH_PRIORITY = ['wallet', 'phone']
const COLUMN_WIDTH = { selection: 48, customer: 240, phone: 150, orders: 90, wallet: 120, status: 140 }

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpenUser`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

export const CustomersTable = ({
  users = [],
  loading = false,
  error = null,
  pageSize,
  configs,
  activeUserId,
  onOpenUser,
  selection,
  hasFilters = false,
  onClearFilters,
  onRetry,
  onToggleActive,
  pendingIds = []
}) => {
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const isPhone = useIsPhone()
  // the columns DataTable hid for want of width (it reports them once per change)
  const [widthHiddenIds, setWidthHiddenIds] = useState([])
  useEffect(() => {
    if (isPhone) setWidthHiddenIds([]) // the cards have no columns: what a table reported earlier is stale
  }, [isPhone])

  const cashOn = isCashWalletOn(configs)
  const skeletonCount = Number(pageSize) || DEFAULT_PAGE_SIZE
  const selectedIds = selection?.selectedIds ?? []

  // ---- the cells (the table and the cards draw the same ones) ----
  const dash = () => (
    <span className='odc-cu-dash'>
      <span aria-hidden='true'>—</span>
      <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
    </span>
  )

  const verifiedMark = () => (
    <span className='odc-cu-verified' role='img' aria-label={t('VERIFIED', 'Verified')}>
      <Check className='odc-icon' aria-hidden='true' />
    </span>
  )

  const ordersCell = (user) => (Number(user.orders_count) > 0
    ? <bdi dir='ltr' className='odc-figure'>{user.orders_count}</bdi>
    : <span className='odc-cu-new'>{t('NEW', 'New')}</span>)

  // A negative balance keeps its minus sign (the shared formatter breaks it on whole hundreds); a balance that rounds to zero
  // has none (M-C4: never «- $0.00»).
  const balanceText = (balance) => {
    const text = parsePrice(Math.abs(parseFloat(balance) || 0))
    return parseFloat(balance) < 0 && /[1-9]/.test(text) ? `-${text}` : text
  }
  const walletCell = (user) => {
    const wallet = walletOf(user, 'cash')
    return wallet ? <bdi dir='ltr' className='odc-figure'>{balanceText(wallet.balance)}</bdi> : dash()
  }

  const phoneCell = (user) => {
    const phone = phoneOf(user)
    if (!phone) return dash()
    return (
      <span className='odc-cu-inline'>
        <bdi dir='ltr'>{phone}</bdi>
        {!!user.phone_verified && verifiedMark()}
      </span>
    )
  }

  const statusSwitch = (user) => (
    <Switch
      checked={!!user.enabled}
      busy={pendingIds.includes(user.id)}
      onCheckedChange={next => onToggleActive?.(user, next)}
    >
      {user.enabled ? t('ACTIVE', 'Active') : t('INACTIVE', 'Inactive')}
    </Switch>
  )

  const rawName = (user) => [user.name, user.lastname].filter(Boolean).join(' ')

  // «email ✓ · phone · #id»: the phone only while its column is away; the id is a figure
  const customerCell = (user) => {
    const name = customerName(user, t)
    const phone = widthHiddenIds.includes('phone') ? phoneOf(user) : null
    const parts = [
      user.email && (
        <span key='email' className='odc-cu-inline'>
          <span dir='auto' className='odc-cu-email'>{user.email}</span>
          {!!user.email_verified && verifiedMark()}
        </span>
      ),
      phone && <bdi key='phone' dir='ltr'>{phone}</bdi>,
      <bdi key='id' dir='ltr' className='odc-figure'>{`#${user.id}`}</bdi>
    ].filter(Boolean)
    return (
      <span className='odc-cu-who'>
        <Avatar kind='person' name={rawName(user)} src={user.photo || undefined} />
        <span className='odc-cu-who-text'>
          <span className='odc-cu-name' dir='auto' title={name}>{name}</span>
          <span className='odc-cu-sub'>
            {parts.map((part, index) => (
              <React.Fragment key={part.key}>
                {index > 0 && ' · '}
                {part}
              </React.Fragment>
            ))}
          </span>
        </span>
      </span>
    )
  }

  // ---- the states that are not rows ----
  const loadingLabel = t('CUSTOMERS_LOADING', 'Loading customers')
  const listLabel = t('CUSTOMERS', 'Customers')

  const emptyState = () => {
    if (hasFilters) {
      return (
        <EmptyState
          icon={FilterX}
          title={t('CUSTOMERS_NO_MATCH', 'No customers match these filters')}
          action={<Button onClick={() => onClearFilters?.()}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>}
        />
      )
    }
    return (
      <EmptyState
        icon={Users}
        title={t('CUSTOMERS_EMPTY', 'No customers yet')}
      />
    )
  }

  // A failure takes the place of the list (M-C14), with the way to try again
  if (!loading && hasError(error)) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('CUSTOMERS_LOAD_ERROR', "We couldn't load the customers.")}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards (M-C8: nothing sideways, nothing out of reach) ----
  if (isPhone) {
    const toCard = (user) => {
      const name = customerName(user, t)
      const phone = phoneOf(user)
      const wallet = cashOn ? walletOf(user, 'cash') : null
      return {
        id: user.id,
        href: hrefFor(user.id),
        label: name,
        title: <span className='odc-cu-card-name' dir='auto'>{name}</span>,
        status: Number(user.orders_count) > 0
          ? (
            <span className='odc-cu-metric'>
              <span className='odc-cu-metric-label'>{t('ORDERS', 'Orders')}</span>
              {ordersCell(user)}
            </span>
            )
          : ordersCell(user),
        from: (user.email || phone) && (
          <span className='odc-cu-contact'>
            {user.email && (
              <span className='odc-cu-inline'>
                <span dir='auto' className='odc-cu-email'>{user.email}</span>
                {!!user.email_verified && verifiedMark()}
              </span>
            )}
            {phone && (
              <span className='odc-cu-inline'>
                <bdi dir='ltr'>{phone}</bdi>
                {!!user.phone_verified && verifiedMark()}
              </span>
            )}
          </span>
        ),
        indicator: <bdi dir='ltr' className='odc-figure odc-cu-card-id'>{`#${user.id}`}</bdi>,
        figure: wallet && (
          <span className='odc-cu-metric'>
            <span className='odc-cu-metric-label'>{t('WALLET', 'Wallet')}</span>
            {walletCell(user)}
          </span>
        ),
        active: activeUserId != null && String(activeUserId) === String(user.id),
        actions: (
          <div className='odc-cu-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
            <Checkbox
              label={t('CUSTOMERS_SELECT_CUSTOMER', 'Select _name_').replace('_name_', name)}
              checked={selectedIds.includes(user.id)}
              onCheckedChange={() => selection?.onToggle?.(user.id)}
            />
            {statusSwitch(user)}
          </div>
        ),
        onOpen: () => onOpenUser?.(user)
      }
    }
    // redesign DL-R3 (D-01, ; parity: main's «Select all» sat in the table header): the same contract as DataTable's header, for this page's ids
    const pageIds = users.map(user => user.id)
    const selectedOnPage = pageIds.filter(id => selectedIds.includes(id)).length
    const selectAll = selection && pageIds.length > 0
      ? {
          label: t('SELECT_ALL', 'Select all'),
          checked: selectedOnPage === 0 ? false : (selectedOnPage === pageIds.length ? true : 'mixed'),
          onToggle: () => selection.onToggleAll?.(pageIds)
        }
      : undefined
    return (
      <div className='odc-cu-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : users.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={skeletonCount}
          empty={emptyState()}
          selectAll={selectAll}
        />
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  const DEFINITIONS = {
    customer: { header: t('CUSTOMER', 'Customer'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2, lead: 'avatar' }, cell: customerCell },
    phone: { header: t('PHONE', 'Phone'), skeleton: { lines: 1 }, cell: phoneCell },
    orders: { header: t('ORDERS', 'Orders'), align: 'end', skeleton: { lines: 1 }, cell: ordersCell },
    wallet: { header: t('WALLET', 'Wallet'), align: 'end', skeleton: { lines: 1 }, cell: walletCell },
    status: { header: t('STATUS', 'Status'), skeleton: { lines: 1, lead: 'dot' }, cell: statusSwitch }
  }
  const shown = ['customer', 'phone', 'orders', ...(cashOn ? ['wallet'] : []), 'status']
  // The threshold of a priority column is the width of the table with it and everything that outranks it
  const hideBelow = {}
  let needed = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], selection ? COLUMN_WIDTH.selection : 0)
  WIDTH_PRIORITY.filter(id => shown.includes(id)).forEach(id => {
    hideBelow[id] = needed
    needed -= COLUMN_WIDTH[id]
  })
  const columns = shown.map(id => ({ id, ...DEFINITIONS[id], hideBelow: hideBelow[id] }))

  return (
    <DataTable
      label={listLabel}
      columns={columns}
      rows={users}
      getRowId={user => user.id}
      onWidthHiddenChange={setWidthHiddenIds}
      activeRowId={activeUserId != null && activeUserId !== '' ? Number(activeUserId) : undefined}
      onOpenRow={user => onOpenUser?.(user)}
      selection={selection
        ? {
            selectedIds,
            onToggle: id => selection.onToggle?.(id),
            // the header toggles this page: the host adds these ids, or takes them off when they are all in
            onToggleAll: () => selection.onToggleAll?.(users.map(user => user.id)),
            allLabel: t('SELECT_ALL', 'Select all'),
            rowLabel: user => t('CUSTOMERS_SELECT_CUSTOMER', 'Select _name_').replace('_name_', customerName(user, t))
          }
        : undefined}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState()}
    />
  )
}
