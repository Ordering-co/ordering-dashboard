import React, { useEffect, useState } from 'react'

import { useLanguage } from '../../../../../index'
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
import { Check, FilterX, TriangleAlert, Truck, Users } from '../../Shared/Icon'
import { driverName, driverStatus, isOfflineBusy, phoneOf } from './driverData'
import { directoryCopy, isManagersRole } from './directoryRole'
import './drivers-table.css'

// redesign DL-B2 (decisions 2, 3, 4, 5; M-DL1, M-DL3, M-DL9, M-DL13): the drivers list as a Product DataTable (and RecordCards
// under 768px). It draws what the controller gives (`users`) and what the host decides (selection, the open driver, the three
// switches from useDriverToggles); it fetches nothing and owns no dialog. The ID column is gone on purpose (decision 2): the id
// sits under the name, as a figure.

const DEFAULT_PAGE_SIZE = 10

// redesign DL-B2 (decision 2; as CustomersTable): width priorities. A column steps aside when the table is narrower than all
// the columns that outrank it plus its own: Phone first, then Availability. The Driver column is locked. What each asks for, in
// px, padding included (the selection cell counts too). The phone is not lost: the Driver cell's second line takes it when its
// column is away; the state stays in Status and the switches in the driver's panel.
const WIDTH_PRIORITY = ['phone', 'availability']
// redesign DL-R1 (Q-3): the sum with the selection column is 718, so all four fit the ~728px of a 1024 window without a panel
// (it was 738 and Phone and Availability stepped aside by 10px). Availability asks for 200: a third switch (Busy) wraps to a
// second line (`.odc-drv-switches` has `flex-wrap`), it does not clip.
const COLUMN_WIDTH = { selection: 48, driver: 200, status: 120, phone: 150, availability: 200, account: 120 }

// redesign DM-B2 (decision 2 | M-DL1, M-DL21, M-DL22): the managers list is the same table with `role='managers'`: Manager, Phone and
// Account (one «Active» switch; a manager has no state and no Online/Busy). Phone steps aside first, then Account. Account asks for 120
// (one switch, «Active»): with the selection column the three columns need 518 (48 + 200 + 150 + 120). The drivers' widths stay as above.
const MANAGERS_WIDTH_PRIORITY = ['phone', 'account']

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpenUser`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

export const DriversTable = ({
  users = [],
  loading = false,
  error = null,
  pageSize,
  activeUserId,
  onOpenUser,
  selection,
  hasFilters = false,
  onClearFilters,
  onRetry,
  onAddDriver,
  onToggle,
  pendingKeys = [],
  actionDisabled = false,
  role = 'drivers' // redesign DM-B2 (decision 2 | M-DL1, M-DL21, M-DL22): opt-in; absent or unknown is the drivers list
}) => {
  const [, t] = useLanguage()
  const managers = isManagersRole(role)
  const copy = directoryCopy(role, t)
  const isPhone = useIsPhone()
  // the columns DataTable hid for want of width (it reports them once per change)
  const [widthHiddenIds, setWidthHiddenIds] = useState([])
  useEffect(() => {
    if (isPhone) setWidthHiddenIds([]) // the cards have no columns: what a table reported earlier is stale
  }, [isPhone])

  const skeletonCount = Number(pageSize) || DEFAULT_PAGE_SIZE
  const selectedIds = selection?.selectedIds ?? []

  // ---- the cells (the table and the cards draw the same ones) ----
  const dash = () => (
    <span className='odc-drv-dash'>
      <span aria-hidden='true'>—</span>
      <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
    </span>
  )

  const verifiedMark = () => (
    <span className='odc-drv-verified' role='img' aria-label={t('VERIFIED', 'Verified')}>
      <Check className='odc-icon' aria-hidden='true' />
    </span>
  )

  // redesign DL-B2 (decision 3): Inactive, Offline («Offline · Busy» with orders, as the dashboard says it), Busy, Available
  const stateCell = (user) => {
    const status = driverStatus(user)
    const label = {
      available: t('AVAILABLE', 'Available'),
      busy: t('BUSY', 'Busy'),
      offline: t('OFFLINE', 'Offline'),
      inactive: t('INACTIVE', 'Inactive')
    }[status]
    return (
      <span className='odc-drv-state' data-state={status}>
        <span className='odc-drv-dot' aria-hidden='true' />
        <span>{label}{isOfflineBusy(user) && ` · ${t('BUSY', 'Busy')}`}</span>
      </span>
    )
  }

  const phoneCell = (user) => {
    const phone = phoneOf(user)
    if (!phone) return dash()
    return (
      <span className='odc-drv-inline'>
        <bdi dir='ltr'>{phone}</bdi>
        {!!user.phone_verified && verifiedMark()}
      </span>
    )
  }

  // redesign DL-B2 (decision 4): all three are immediate; each is controlled by the row, so none moves before the API says ok.
  // (main #479): Busy is drawn for every driver; admins and drivers managers can mark a driver busy, and turning it off releases them.
  const toggleSwitch = (user, attribute, text) => (
    <Switch
      key={attribute}
      checked={!!user[attribute]}
      busy={pendingKeys.includes(`${user.id}:${attribute}`)}
      disabled={actionDisabled}
      onCheckedChange={next => onToggle?.(user, attribute, next)}
    >
      {text}
    </Switch>
  )

  // redesign DM-B2 (decision 2 | M-DL1, M-DL21, M-DL22): a manager has one switch, the account's `enabled`
  const switches = (user) => managers
    ? [toggleSwitch(user, 'enabled', t('ACTIVE', 'Active'))]
    : [
        toggleSwitch(user, 'available', t('DRIVERS_ONLINE', 'Online')),
        toggleSwitch(user, 'busy', t('BUSY', 'Busy')),
        toggleSwitch(user, 'enabled', t('ACTIVE', 'Active'))
      ]

  const availabilityCell = (user) => <span className='odc-drv-switches'>{switches(user)}</span>

  const rawName = (user) => [user.name, user.lastname].filter(Boolean).join(' ')

  // «email ✓ · phone · #id»: the phone only while its column is away; the id is a figure
  const driverCell = (user) => {
    const name = driverName(user, t)
    const phone = widthHiddenIds.includes('phone') ? phoneOf(user) : null
    const parts = [
      user.email && (
        <span key='email' className='odc-drv-inline'>
          <span dir='auto' className='odc-drv-email'>{user.email}</span>
          {!!user.email_verified && verifiedMark()}
        </span>
      ),
      phone && <bdi key='phone' dir='ltr'>{phone}</bdi>,
      <bdi key='id' dir='ltr' className='odc-figure'>{`#${user.id}`}</bdi>
    ].filter(Boolean)
    return (
      <span className='odc-drv-who'>
        <Avatar kind='person' name={rawName(user)} src={user.photo || undefined} />
        <span className='odc-drv-who-text'>
          <span className='odc-drv-name' dir='auto' title={name}>{name}</span>
          <span className='odc-drv-sub'>
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
  const loadingLabel = copy.loading
  const listLabel = copy.list

  const emptyState = () => {
    if (hasFilters) {
      return (
        <EmptyState
          icon={FilterX}
          title={copy.noMatch}
          action={<Button onClick={() => onClearFilters?.()}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>}
        />
      )
    }
    return (
      <EmptyState
        icon={managers ? Users : Truck}
        title={copy.empty}
        action={<Button disabled={actionDisabled} onClick={() => onAddDriver?.()}>{copy.add}</Button>}
      />
    )
  }

  // A failure takes the place of the list (M-DL9), with the way to try again
  if (!loading && hasError(error)) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={copy.loadError}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards (decision 5: nothing sideways, nothing out of reach) ----
  if (isPhone) {
    const toCard = (user) => {
      const name = driverName(user, t)
      const phone = phoneOf(user)
      return {
        id: user.id,
        href: hrefFor(user.id),
        label: name,
        title: <span className='odc-drv-card-name' dir='auto'>{name}</span>,
        status: managers ? undefined : stateCell(user), // a manager has no derived state
        from: (user.email || phone) && (
          <span className='odc-drv-contact'>
            {user.email && (
              <span className='odc-drv-inline'>
                <span dir='auto' className='odc-drv-email'>{user.email}</span>
                {!!user.email_verified && verifiedMark()}
              </span>
            )}
            {phone && (
              <span className='odc-drv-inline'>
                <bdi dir='ltr'>{phone}</bdi>
                {!!user.phone_verified && verifiedMark()}
              </span>
            )}
          </span>
        ),
        indicator: <bdi dir='ltr' className='odc-figure odc-drv-card-id'>{`#${user.id}`}</bdi>,
        active: activeUserId != null && String(activeUserId) === String(user.id),
        actions: (
          <div className='odc-drv-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
            <Checkbox
              label={t('DRIVERS_SELECT_DRIVER', 'Select _name_').replace('_name_', name)}
              checked={selectedIds.includes(user.id)}
              onCheckedChange={() => selection?.onToggle?.(user.id)}
            />
            {switches(user)}
          </div>
        ),
        onOpen: () => onOpenUser?.(user)
      }
    }
    // redesign DL-R2 (parity: main's «Select all» sat in the table header): the same contract as DataTable's header, for this page's ids
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
      <div className='odc-drv-cards'>
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
    driver: { header: copy.column, rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2, lead: 'avatar' }, cell: driverCell },
    status: { header: t('STATUS', 'Status'), skeleton: { lines: 1, lead: 'dot' }, cell: stateCell },
    phone: { header: t('PHONE', 'Phone'), skeleton: { lines: 1 }, cell: phoneCell },
    availability: { header: t('DRIVERS_AVAILABILITY', 'Availability'), skeleton: { lines: 1 }, cell: availabilityCell },
    account: { header: t('ACCOUNT', 'Account'), skeleton: { lines: 1 }, cell: availabilityCell }
  }
  const shown = managers ? ['driver', 'phone', 'account'] : ['driver', 'status', 'phone', 'availability']
  // The threshold of a priority column is the width of the table with it and everything that outranks it
  const hideBelow = {}
  let needed = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], selection ? COLUMN_WIDTH.selection : 0)
  const priority = managers ? MANAGERS_WIDTH_PRIORITY : WIDTH_PRIORITY
  priority.filter(id => shown.includes(id)).forEach(id => {
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
            rowLabel: user => t('DRIVERS_SELECT_DRIVER', 'Select _name_').replace('_name_', driverName(user, t))
          }
        : undefined}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState()}
    />
  )
}
