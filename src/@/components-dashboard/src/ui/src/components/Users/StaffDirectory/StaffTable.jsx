import React, { useEffect, useId, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { userFullName, phoneOf } from '../../../../../utils/userContact'
import {
  Avatar,
  Button,
  Checkbox,
  ColumnManager,
  DataTable,
  EmptyState,
  RecordCardList,
  Switch
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Check, FilterX, TriangleAlert, Users } from '../../Shared/Icon'
import { say } from './staffKinds'
import './staff-table.css'

// redesign BO-B3 (decisions 1, 7; auditor #3, #7d): the staff list (business owners today) as a Product DataTable, and
// RecordCards under 768px. Modeled on Users/CustomersDirectory/CustomersTable, without the wallet and with a Stores column. It
// draws what the controller gives (`users`) and what the host decides (selection, the open record, the status toggle); it
// fetches nothing and owns no dialog. The words come from the `kind` (Users/StaffDirectory/staffKinds).

const DEFAULT_PAGE_SIZE = 10
// The Stores cell names this many stores and counts the rest as «+N»
const VISIBLE_STORES = 2

// redesign BO-B3 (as CustomersTable, UC-B2): width priorities. A column steps aside when the table is narrower than all the
// columns that outrank it plus its own: Orders placed first, then Phone, then Stores (the stores are what this list is for: with the
// record open at 1440 the column stays, R1). The owner column is locked. What each asks for, in px, padding
// included (the selection cell counts too). The phone is not lost: the owner cell's second line takes it when its column is away;
// the orders placed stay in the record (Orders tab).
// redesign (B1b, decision 3): the professionals' columns (Occupation, City, Email) are added at the end of both tables, so the
// priorities and widths of the other kinds are what they were (a kind that does not list a column takes no part in its threshold).
// The Email steps aside first (the Professional cell then carries it, as it carries the phone), then City, Phone and Occupation.
const WIDTH_PRIORITY = ['orders', 'email', 'city', 'phone', 'occupation', 'stores']
const COLUMN_WIDTH = { selection: 48, owner: 220, phone: 150, stores: 180, orders: 110, status: 140, occupation: 150, city: 130, email: 200 }

// redesign (B1b, decision 3): a kind with `columnManager` lets the person hide and move its columns (`kind.columns` is the
// default list and order). The choice is `[{ id, visible }]` in order, kept in `localStorage[kind.columnsStorageKey]`; reading and
// writing are in try/catch (private mode, quota): if the storage fails it lives in memory only, as main's selector did.
const LOCKED_COLUMNS = ['owner', 'status']
const defaultColumnPrefs = (kind) => (kind.columns ?? []).map(id => ({ id, visible: true }))
const normalizeColumnPrefs = (kind, stored) => {
  const allowed = kind.columns ?? []
  const seen = new Set()
  const prefs = []
  ;(Array.isArray(stored) ? stored : []).forEach((item) => {
    if (!item || !allowed.includes(item.id) || seen.has(item.id)) return
    seen.add(item.id)
    prefs.push({ id: item.id, visible: LOCKED_COLUMNS.includes(item.id) || item.visible !== false })
  })
  allowed.forEach((id) => { if (!seen.has(id)) prefs.push({ id, visible: true }) })
  return prefs
}
const readColumnPrefs = (kind) => {
  if (!kind.columnManager || !kind.columnsStorageKey) return defaultColumnPrefs(kind)
  try {
    const raw = window.localStorage.getItem(kind.columnsStorageKey)
    return normalizeColumnPrefs(kind, raw ? JSON.parse(raw) : null)
  } catch (error) {
    return defaultColumnPrefs(kind)
  }
}
const writeColumnPrefs = (kind, prefs) => {
  if (!kind.columnsStorageKey) return
  try {
    if (prefs) window.localStorage.setItem(kind.columnsStorageKey, JSON.stringify(prefs.map(({ id, visible }) => ({ id, visible }))))
    else window.localStorage.removeItem(kind.columnsStorageKey)
  } catch (error) {
    // memory only
  }
}

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpenUser`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const hasText = (value) => value != null && String(value).trim() !== ''

// the name of an occupation or a city: the record may bring `{ id, name }` or the name alone
const nameOf = (value) => {
  const name = typeof value === 'string' ? value : value?.name
  return hasText(name) ? String(name).trim() : ''
}

export const StaffTable = ({
  kind,
  users = [],
  loading = false,
  error = null,
  pageSize,
  activeUserId,
  onOpenUser,
  selection,
  hasFilters = false,
  // redesign the list is the Inactive tab. Empty there means «no inactive …», not an empty directory,
  // so it does not offer Add (the header keeps it)
  inactive = false,
  onClearFilters,
  onRetry,
  onAdd,
  onToggleActive,
  pendingIds = [],
  // redesign D-3 (owner, 2026-10-19): the id of the signed-in person. On their own row the switch and the checkbox stay,
  // disabled, each with its reason; the host decides nothing else (it never asks to switch or select that id)
  currentUserId
}) => {
  const [, t] = useLanguage()
  const reasonIdPrefix = useId()
  const isPhone = useIsPhone()
  // the columns DataTable hid for want of width (it reports them once per change)
  const [widthHiddenIds, setWidthHiddenIds] = useState([])
  useEffect(() => {
    if (isPhone) setWidthHiddenIds([]) // the cards have no columns: what a table reported earlier is stale
  }, [isPhone])

  // the column manager's choice (kinds with `columnManager` only); the others keep `kind.columns` or their fixed list
  const [columnPrefs, setColumnPrefs] = useState(() => readColumnPrefs(kind))

  const skeletonCount = Number(pageSize) || DEFAULT_PAGE_SIZE
  const selectedIds = selection?.selectedIds ?? []

  const displayName = (user) => userFullName(user) || t('CUSTOMERS_NO_NAME', 'No name')
  const rawName = (user) => [user.name, user.lastname].filter(Boolean).join(' ')

  // ---- the cells (the table and the cards draw the same ones) ----
  const dash = () => (
    <span className='odc-sd-dash'>
      <span aria-hidden='true'>—</span>
      <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
    </span>
  )

  const verifiedMark = () => (
    <span className='odc-sd-verified' role='img' aria-label={t('VERIFIED', 'Verified')}>
      <Check className='odc-icon' aria-hidden='true' />
    </span>
  )

  // redesign (decision 9): a kind may name its orders column (`text.ordersColumn`, else «Orders placed») and count a first-timer
  // as the figure 0 (`ordersZeroAsNumber`, else «New»): an agent's orders are the ones it placed as a customer («Own orders»), not the
  // ones it took for others, and 0 is a number there.
  const ordersLabel = kind.text?.ordersColumn ? say(t, kind.text.ordersColumn) : t('STAFF_ORDERS_PLACED', 'Orders placed')
  const hasOrdersColumn = !kind.columns || kind.columns.includes('orders')
  const hasOrders = (user) => Number(user.orders_count) > 0
  const showsOrdersFigure = (user) => hasOrders(user) || Boolean(kind.ordersZeroAsNumber)
  const ordersCell = (user) => (showsOrdersFigure(user)
    ? <bdi dir='ltr' className='odc-figure'>{hasOrders(user) ? user.orders_count : 0}</bdi>
    : <span className='odc-sd-new'>{t('NEW', 'New')}</span>)

  const phoneCell = (user) => {
    const phone = phoneOf(user)
    if (!phone) return dash()
    return (
      <span className='odc-sd-inline'>
        <bdi dir='ltr'>{phone}</bdi>
        {!!user.phone_verified && verifiedMark()}
      </span>
    )
  }

  // The stores the list asked for: up to two names and «+N», every name in the title. `undefined` is «not asked», not «none».
  const storeName = (store) => (hasText(store?.name) ? String(store.name).trim() : `#${store?.id}`)
  const storesCell = (user) => {
    const list = user[kind.storesKey]
    if (!Array.isArray(list)) return dash()
    if (list.length === 0) return <span className='odc-sd-muted'>{t('STAFF_NO_STORES', 'No stores')}</span>
    const names = list.map(storeName)
    const more = names.length - VISIBLE_STORES
    return (
      <span className='odc-sd-stores' title={names.join(', ')}>
        <span className='odc-sd-store-names' dir='auto'>{names.slice(0, VISIBLE_STORES).join(', ')}</span>
        {more > 0 && (
          <span className='odc-sd-more'>
            <span aria-hidden='true'>{t('STAFF_MORE_STORES', '+_count_').replace('_count_', () => String(more))}</span>
            <span className='odc-sr-only'>{t('STAFF_MORE_STORES_LABEL', 'and _count_ more').replace('_count_', () => String(more))}</span>
          </span>
        )}
      </span>
    )
  }

  // redesign (B1b): the professionals' own columns
  const occupationCell = (user) => {
    const name = nameOf(user.occupation)
    if (!name) {
      return (
        <span className='odc-sd-dash'>
          <span aria-hidden='true'>—</span>
          <span className='odc-sr-only'>{t('PROFESSIONALS_NO_OCCUPATION', 'No occupation')}</span>
        </span>
      )
    }
    return <span dir='auto' className='odc-sd-clip'>{name}</span>
  }
  const cityCell = (user) => {
    const name = nameOf(user.city)
    return name ? <span dir='auto' className='odc-sd-clip'>{name}</span> : dash()
  }
  const emailCell = (user) => {
    if (!hasText(user.email)) return dash()
    return (
      <span className='odc-sd-inline'>
        <bdi className='odc-sd-email'>{user.email}</bdi>
        {!!user.email_verified && verifiedMark()}
      </span>
    )
  }

  // redesign D-3: your own account is not switched off or deleted from the list. The control is disabled, not hidden, and the
  // reason is its accessible description (aria-describedby) and a visible `title` on the wrapper, which also answers over a disabled button.
  const isSelf = (user) => currentUserId != null && String(user.id) === String(currentUserId)
  const selfReason = {
    deactivate: t('STAFF_CANNOT_DEACTIVATE_SELF', "You can't deactivate your own account."),
    delete: t('STAFF_CANNOT_DELETE_SELF', "You can't delete your own account.")
  }
  const protectedReason = {
    deactivate: t('STAFF_PROTECTED_CANNOT_DEACTIVATE', "You can't deactivate a protected account."),
    delete: t('STAFF_PROTECTED_CANNOT_DELETE', "You can't delete a protected account.")
  }
  const deactivateReason = (user) => {
    if (isSelf(user)) return selfReason.deactivate
    return user.protected && user.enabled ? protectedReason.deactivate : null
  }
  const deleteReason = (user) => {
    if (isSelf(user)) return selfReason.delete
    return user.protected ? protectedReason.delete : null
  }
  const lockNote = (user) => {
    if (isSelf(user)) return t('STAFF_CANNOT_CHANGE_SELF', "You can't deactivate or delete your own account.")
    return user.protected ? t('STAFF_PROTECTED_CANNOT_CHANGE', "This account is protected. You can't deactivate or delete it.") : null
  }
  const selectLabel = (user) => t('CUSTOMERS_SELECT_CUSTOMER', 'Select _name_').replace('_name_', () => displayName(user))

  const statusSwitch = (user) => {
    const reason = deactivateReason(user)
    const reasonId = `${reasonIdPrefix}-${user.id}-status`
    const control = (
      <Switch
        checked={!!user.enabled}
        busy={pendingIds.includes(user.id)}
        disabled={!!reason}
        aria-describedby={reason ? reasonId : undefined}
        onCheckedChange={next => onToggleActive?.(user, next)}
      >
        {user.enabled ? t('ACTIVE', 'Active') : t('INACTIVE', 'Inactive')}
      </Switch>
    )
    if (!reason) return control
    return (
      <span title={reason}>
        {control}
        <span id={reasonId} className='odc-sr-only'>{reason}</span>
      </span>
    )
  }

  const emailPart = (user) => (
    <span className='odc-sd-inline'>
      <span dir='auto' className='odc-sd-email'>{user.email}</span>
      {!!user.email_verified && verifiedMark()}
    </span>
  )

  // redesign (auditor 11): a kind whose columns include Email (professionals) does not repeat the address under the name
  // while that column is on the table; if the table drops it for want of width, the cell carries it, as it does the phone
  const emailHere = !kind.columns?.includes('email') || widthHiddenIds.includes('email')

  // «email ✓ · phone · #id»: the phone only while its column is away; the id is a figure
  const ownerCell = (user) => {
    const name = displayName(user)
    const phone = widthHiddenIds.includes('phone') ? phoneOf(user) : null
    const parts = [
      emailHere && user.email && <React.Fragment key='email'>{emailPart(user)}</React.Fragment>,
      phone && <bdi key='phone' dir='ltr'>{phone}</bdi>,
      <bdi key='id' dir='ltr' className='odc-figure'>{`#${user.id}`}</bdi>
    ].filter(Boolean)
    return (
      <span className='odc-sd-who'>
        <Avatar kind='person' name={rawName(user)} src={user.photo || undefined} />
        <span className='odc-sd-who-text'>
          <span className='odc-sd-name' dir='auto' title={name}>{name}</span>
          <span className='odc-sd-sub'>
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
  const loadingLabel = say(t, kind.text.loading)
  const listLabel = say(t, kind.text.title)

  const emptyState = () => {
    if (hasFilters) {
      return (
        <EmptyState
          icon={FilterX}
          title={say(t, kind.text.noMatch)}
          action={<Button onClick={() => onClearFilters?.()}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>}
        />
      )
    }
    if (inactive && kind.text.emptyInactive) {
      return <EmptyState icon={Users} title={say(t, kind.text.emptyInactive)} />
    }
    return (
      <EmptyState
        icon={Users}
        title={say(t, kind.text.empty)}
        action={<Button onClick={() => onAdd?.()}>{say(t, kind.text.add)}</Button>}
      />
    )
  }

  // A failure takes the place of the list, with the way to try again
  if (!loading && hasError(error)) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={say(t, kind.text.loadError)}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards (nothing sideways, nothing out of reach) ----
  if (isPhone) {
    const toCard = (user) => {
      const name = displayName(user)
      const phone = phoneOf(user)
      // redesign a kind with no stores (admins) has no stores line on the card, not even «No stores»
      const hasStores = Boolean(kind.storesKey) && Array.isArray(user[kind.storesKey])
      // redesign a kind with no orders column (professionals) has no orders metric on the card (not even «New»); its
      // first contact line is «occupation · city», each only if it exists
      const where = kind.columns?.includes('occupation') ? [nameOf(user.occupation), nameOf(user.city)].filter(Boolean) : []
      return {
        id: user.id,
        href: hrefFor(user.id),
        label: name,
        title: <span className='odc-sd-card-name' dir='auto'>{name}</span>,
        status: hasOrdersColumn
          ? (showsOrdersFigure(user)
              ? (
                <span className='odc-sd-metric'>
                  <span className='odc-sd-metric-label'>{ordersLabel}</span>
                  {ordersCell(user)}
                </span>
                )
              : ordersCell(user))
          : undefined,
        from: (where.length > 0 || user.email || phone) && (
          <span className='odc-sd-contact'>
            {where.length > 0 && <span className='odc-sd-card-where' dir='auto'>{where.join(' · ')}</span>}
            {user.email && emailPart(user)}
            {phone && phoneCell(user)}
          </span>
        ),
        indicator: <bdi dir='ltr' className='odc-figure odc-sd-card-id'>{`#${user.id}`}</bdi>,
        // R1: «No stores» says it alone (not «Stores: No stores»); the label is its own node, with no colon glued to a translation
        figure: hasStores && (
          user[kind.storesKey].length === 0
            ? storesCell(user)
            : (
              <span className='odc-sd-metric'>
                <span className='odc-sd-metric-label'>{t('STAFF_STORES', 'Stores')}</span>
                {storesCell(user)}
              </span>
              )
        ),
        active: activeUserId != null && String(activeUserId) === String(user.id),
        actions: (
          <div className='odc-sd-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
            {deleteReason(user)
              ? (
                <span title={deleteReason(user)}>
                  <Checkbox
                    label={selectLabel(user)}
                    checked={selectedIds.includes(user.id)}
                    disabled
                    aria-describedby={`${reasonIdPrefix}-${user.id}-select`}
                    onCheckedChange={() => selection?.onToggle?.(user.id)}
                  />
                  <span id={`${reasonIdPrefix}-${user.id}-select`} className='odc-sr-only'>{deleteReason(user)}</span>
                </span>
                )
              : (
                <Checkbox
                  label={selectLabel(user)}
                  checked={selectedIds.includes(user.id)}
                  onCheckedChange={() => selection?.onToggle?.(user.id)}
                />
                )}
            {statusSwitch(user)}
            {/* redesign R-4: a touch user has no tooltip, so the own card says the reason in a visible line (the Field hint
                pattern), once for both disabled controls. The per-control title and sr texts stay; the line is hidden from assistive tech
                because the controls' descriptions already say it. The 1440 table keeps its tooltip and sr text only. */}
            {lockNote(user) && (
              <span className='odc-field-hint odc-sd-self-note' aria-hidden='true'>
                {lockNote(user)}
              </span>
            )}
          </div>
        ),
        onOpen: () => onOpenUser?.(user)
      }
    }
    // «Select all» sat in main's table header and must stay reachable at 390: the same contract as DataTable's header, for this page's ids
    // redesign D-3: the signed-in person is not part of «all»
    const pageIds = users.filter(user => !deleteReason(user)).map(user => user.id)
    const selectedOnPage = pageIds.filter(id => selectedIds.includes(id)).length
    const selectAll = selection && pageIds.length > 0
      ? {
          label: t('SELECT_ALL', 'Select all'),
          checked: selectedOnPage === 0 ? false : (selectedOnPage === pageIds.length ? true : 'mixed'),
          onToggle: () => selection.onToggleAll?.(pageIds)
        }
      : undefined
    return (
      <div className='odc-sd-cards'>
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
    owner: { header: say(t, kind.text.one), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2, lead: 'avatar' }, cell: ownerCell },
    phone: { header: t('PHONE', 'Phone'), skeleton: { lines: 1 }, cell: phoneCell },
    occupation: { header: t('OCCUPATION', 'Occupation'), wrap: true, skeleton: { lines: 1 }, cell: occupationCell },
    city: { header: t('CITY', 'City'), wrap: true, skeleton: { lines: 1 }, cell: cityCell },
    email: { header: t('EMAIL', 'Email'), wrap: true, skeleton: { lines: 1 }, cell: emailCell },
    stores: { header: t('STAFF_STORES', 'Stores'), skeleton: { lines: 1 }, cell: storesCell },
    orders: { header: ordersLabel, align: 'end', skeleton: { lines: 1 }, cell: ordersCell },
    status: { header: t('STATUS', 'Status'), skeleton: { lines: 1, lead: 'dot' }, cell: statusSwitch }
  }
  // redesign a kind with no stores (`storesKey: null`, admins) has no Stores column, so it takes no part in the width priorities
  // redesign a kind that names its `columns` (professionals) is drawn with them, in its order, minus the ones the person
  // hid in the column manager (`owner` and `status` always stay)
  const columnState = kind.columnManager ? columnPrefs : defaultColumnPrefs(kind)
  const shown = kind.columns
    ? columnState.filter(({ id, visible }) => visible || LOCKED_COLUMNS.includes(id)).map(({ id }) => id)
    : ['owner', 'phone', ...(kind.storesKey ? ['stores'] : []), 'orders', 'status']
  // redesign (CA-4): a list that loaded with no rows (the error case returned above) has nothing to select: no «Select all»
  // over an empty table
  const tableSelection = selection && (loading || users.length > 0) ? selection : undefined
  // The threshold of a priority column is the width of the table with it and everything that outranks it
  const hideBelow = {}
  let needed = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], tableSelection ? COLUMN_WIDTH.selection : 0)
  WIDTH_PRIORITY.filter(id => shown.includes(id)).forEach(id => {
    hideBelow[id] = needed
    needed -= COLUMN_WIDTH[id]
  })
  const columns = shown.map(id => ({ id, ...DEFINITIONS[id], hideBelow: hideBelow[id] }))

  const changeColumns = (next) => {
    const prefs = normalizeColumnPrefs(kind, next)
    setColumnPrefs(prefs)
    writeColumnPrefs(kind, prefs)
  }
  const resetColumns = () => {
    setColumnPrefs(defaultColumnPrefs(kind))
    writeColumnPrefs(kind, null)
  }

  const table = (
    <DataTable
      label={listLabel}
      columns={columns}
      rows={users}
      getRowId={user => user.id}
      onWidthHiddenChange={setWidthHiddenIds}
      activeRowId={activeUserId != null && activeUserId !== '' ? Number(activeUserId) : undefined}
      className={activeUserId != null && activeUserId !== '' ? 'odc-sd-record-open' : undefined}
      onOpenRow={user => onOpenUser?.(user)}
      selection={tableSelection
        ? {
            selectedIds,
            onToggle: id => tableSelection.onToggle?.(id),
            // the header toggles this page: the host adds these ids, or takes them off when they are all in
            // redesign D-3: the signed-in person is not part of «all»
            onToggleAll: () => tableSelection.onToggleAll?.(users.filter(user => !deleteReason(user)).map(user => user.id)),
            allLabel: t('SELECT_ALL', 'Select all'),
            rowLabel: selectLabel,
            disabledReason: deleteReason
          }
        : undefined}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState()}
    />
  )
  if (!kind.columnManager) return table

  // redesign (decision 3): the column manager (as Marketing/PromotionsDirectory/PromotionsTable) at the end of a row above the table
  return (
    <>
      <div className='odc-sd-tools'>
        <ColumnManager
          columns={columnState.map(({ id, visible }) => ({
            id,
            label: DEFINITIONS[id].header,
            visible: LOCKED_COLUMNS.includes(id) || visible,
            locked: LOCKED_COLUMNS.includes(id),
            widthHidden: widthHiddenIds.includes(id)
          }))}
          onChange={changeColumns}
          onReset={resetColumns}
          triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
          title={t('MANAGE_COLUMNS', 'Manage columns')}
          resetLabel={t('COLUMNS_RESET', 'Reset')}
          lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
          widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
          moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', () => label)}
          moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', () => label)}
        />
      </div>
      {table}
    </>
  )
}
