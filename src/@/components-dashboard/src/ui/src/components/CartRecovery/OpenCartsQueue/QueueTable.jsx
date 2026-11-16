import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { CART_STATUS, cartTotal, contactOf, parseApiUtc, summarizeItems } from '../../../../../utils/openCarts'
import {
  Avatar,
  Button,
  ColumnManager,
  DataTable,
  EmptyState,
  InlineNotice,
  RecordCardList,
  Skeleton,
  Status,
  Switch
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { FilterX, Inbox, Search, TriangleAlert } from '../../Shared/Icon'
import { ContactMenu } from './ContactMenu'
import './queue-table.css'

// redesign OC-C (list): the open carts as a Product DataTable (and RecordCards under 768px). It draws what the controller
// gives (`list`, `details`) and asks for the details of the carts it shows (`ensureDetails`); it fetches nothing itself.

// Default order of the columns. ID and City are optional (parity with main's column manager) and start hidden.
const COLUMN_IDS = ['customer', 'id', 'cart', 'business', 'city', 'value', 'lastActivity', 'status', 'contact']
const DEFAULT_HIDDEN = ['id', 'city']
const LOCKED = ['customer']
// redesign OC-F1 (OC-Q1-02, OC-Q1-03): width priorities, Orders' pattern, by the width of the list whatever the reason it is
// narrow (the panel beside it, a small window). A column steps aside when the table is narrower than all the columns that
// outrank it plus its own: the first of the list first, only as far as needed, and it comes back when there is room. What the
// two last ones show is not lost: the Cart cell's second line carries the business and the time (below), and the contact stays in
// the panel and on the cards.
const WIDTH_PRIORITY = ['contact', 'business', 'lastActivity']
// What each column asks for, in px, padding included. Customer and Cart wrap and truncate, so they count at the least they need
// to stay readable (the estimates for a full line are 220 and 240); ID and City are the person's and count here but never step aside.
const COLUMN_WIDTH = { customer: 170, id: 90, cart: 180, business: 170, city: 130, value: 96, lastActivity: 120, status: 140, contact: 110 }
const COLUMNS_PREFIX = 'odc-open-carts-columns:'
const DEFAULT_PAGE_SIZE = 10

const defaultColumns = () => COLUMN_IDS.map(id => ({ id, visible: !DEFAULT_HIDDEN.includes(id) }))

// The saved preference is `[{ id, visible }]` in the user's order. Anything unknown or malformed is dropped and what is
// missing comes back at its default (a new column of a later release shows up instead of vanishing).
const normalizeColumns = (saved) => {
  const seen = new Set()
  const columns = []
  if (Array.isArray(saved)) {
    saved.forEach(entry => {
      if (entry && COLUMN_IDS.includes(entry.id) && !seen.has(entry.id)) {
        seen.add(entry.id)
        columns.push({ id: entry.id, visible: LOCKED.includes(entry.id) ? true : Boolean(entry.visible) })
      }
    })
  }
  COLUMN_IDS.forEach(id => {
    if (!seen.has(id)) columns.push({ id, visible: !DEFAULT_HIDDEN.includes(id) })
  })
  return columns
}

const storageKey = (userId) => (userId == null || userId === '' ? null : `${COLUMNS_PREFIX}${userId}`)

// Read once and written only on a change by the user; a storage that fails (private mode, quota) is no failure of the list.
const readColumns = (userId) => {
  const key = storageKey(userId)
  if (!key) return defaultColumns()
  try {
    return normalizeColumns(JSON.parse(window.localStorage.getItem(key)))
  } catch (error) {
    return defaultColumns()
  }
}
const writeColumns = (userId, columns) => {
  const key = storageKey(userId)
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(columns))
  } catch (error) {}
}

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpenCart`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

// «_count_ hidden»: the number is a figure of its own
const fillCount = (template, count) => template.split('_count_').flatMap((part, index) => (
  index === 0 ? [part] : [<bdi key={index} className='odc-figure'>{count}</bdi>, part]
))

const errorText = (t, error) => {
  const first = (Array.isArray(error) ? error : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, undefined)
}

export const QueueTable = ({
  view,
  list,
  details = {},
  ensureDetails,
  activeCartId,
  onOpenCart,
  withContactOnly,
  onWithContactOnlyChange,
  onClearFilters,
  hasFilters,
  search,
  onReload,
  columnsUserId,
  highlightIds = [] // redesign OC-integration: carts that arrived on the last Live now refresh
}) => {
  const [, t] = useLanguage()
  const [{ parseDate, parsePrice, optimizeImage, getTimeAgo }] = useUtils()
  const isPhone = useIsPhone()
  // redesign OC-F1 (OC-Q1-02): the columns DataTable hid for want of width (it reports them once per change)
  const [widthHiddenIds, setWidthHiddenIds] = useState([])
  // redesign OC-F1 (OC-Q1-04): after Retry, focus goes to the table (the button that had it is gone by then)
  const frameRef = useRef(null)
  const retried = useRef(false)
  const reloaded = useRef(false)

  const carts = list?.carts || []
  const isFollowUp = view === 'followUp'

  // ---- the details of the carts on screen: once per change of what is shown (the controller caches the rest) ----
  const ensureRef = useRef(ensureDetails)
  ensureRef.current = ensureDetails
  const shownKey = carts.map(cart => `${cart.id}:${cart.updated_at ?? ''}`).join('|')
  useEffect(() => {
    if (list?.loading || carts.length === 0) return
    ensureRef.current?.(carts)
  }, [shownKey, list?.loading])

  // redesign OC-integration (OC-Q1-09): a detail that failed is asked again after 11 s even with the screen still (the controller
  // retries entries older than 10 s, three attempts at most); the key changes with each attempt, so a new failure re-arms it
  const failedKey = carts
    .filter(cart => details?.[cart.id]?.error && (details[cart.id].attempts ?? 1) < 3)
    .map(cart => `${cart.id}:${details[cart.id].attempts ?? 1}`)
    .join('|')
  useEffect(() => {
    if (!failedKey || list?.loading) return undefined
    const timer = setTimeout(() => ensureRef.current?.(carts), 11000)
    return () => clearTimeout(timer)
  }, [failedKey, list?.loading])

  // ---- the columns the user chose (kept per user on this device) ----
  const [columns, setColumns] = useState(() => readColumns(columnsUserId))
  const lastUser = useRef(columnsUserId)
  useEffect(() => {
    // the session may arrive after the first paint: read the preference of the user it turns out to be
    if (lastUser.current === columnsUserId) return
    lastUser.current = columnsUserId
    setColumns(readColumns(columnsUserId))
  }, [columnsUserId])
  const changeColumns = (next) => {
    const model = normalizeColumns(next)
    setColumns(model)
    writeColumns(columnsUserId, model)
  }

  // ---- bands of the follow up view ----
  const groups = isFollowUp && Array.isArray(list?.groups) && list.groups.length > 0 ? list.groups : null
  const groupLabel = (key) => (key === 'last24h'
    ? t('OPEN_CARTS_GROUP_LAST_24H', 'Last 24 hours')
    : t('OPEN_CARTS_GROUP_EARLIER', '1–7 days ago'))
  const { bandOf, firstOfBand } = useMemo(() => {
    const band = new Map()
    const first = new Set()
    ;(groups || []).forEach(group => group.carts.forEach((cart, index) => {
      band.set(cart.id, group.key)
      if (index === 0) first.add(cart.id)
    }))
    return { bandOf: band, firstOfBand: first }
  }, [list?.groups, isFollowUp])
  const rows = groups ? groups.flatMap(group => group.carts) : carts

  // ---- redesign OC-F1 (OC-Q1-04): after Retry, the focus goes to the list ----
  // The button that had the focus is gone while the list reloads, and the focus would fall to <body>. Once the reload is over
  // it goes to the first row (the table's tab stop), or to the first card, or to the table region when there are no rows, or
  // to the new Retry when the list failed again.
  const focusList = () => {
    const frame = frameRef.current
    if (!frame) return
    const first = frame.querySelector('tr[data-row-id][tabindex="0"], a.odc-order-card-link')
    if (first) {
      first.focus()
      return
    }
    const region = frame.querySelector('[role="region"]')
    if (region) {
      region.tabIndex = -1
      region.focus()
      return
    }
    frame.querySelector('[role="alert"] button')?.focus()
  }
  useEffect(() => {
    if (isPhone) setWidthHiddenIds([]) // the cards have no columns: what a table reported earlier is stale
  }, [isPhone])
  useEffect(() => {
    if (!retried.current) return
    if (list?.loading) {
      reloaded.current = true
      return
    }
    if (!reloaded.current && list?.error) return // nothing has happened yet
    retried.current = false
    reloaded.current = false
    focusList()
  }, [list?.loading, list?.error, rows.length])

  // ---- the cells (the table and the cards draw the same ones) ----
  const detailOf = (cart) => details?.[cart.id]
  const ready = (cart) => Boolean(detailOf(cart)?.cart)
  const waiting = (cart) => {
    const entry = detailOf(cart)
    return !entry || (entry.loading && !entry.cart)
  }

  const dash = (reason) => (
    <span className='odc-oq-dash'>
      <span aria-hidden='true' title={reason}>—</span>
      <span className='odc-sr-only'>{reason}</span>
    </span>
  )
  const noDetail = () => dash(t('OPEN_CARTS_DETAIL_UNAVAILABLE', "Couldn't load the details of this cart"))

  const who = (cart, { kicker = false } = {}) => {
    const contact = contactOf(cart)
    const guest = contact.isGuest
    const main = contact.name || contact.email || contact.phone
    const nameText = guest ? t('OPEN_CARTS_GUEST', 'Guest') : main
    let sub = null
    if (guest) sub = t('OPEN_CARTS_NO_CONTACT_DETAILS', 'No contact details')
    else if (contact.name) sub = [contact.email, contact.phone].filter(Boolean).join(' · ') || null
    else if (contact.email) sub = contact.phone
    const band = bandOf.get(cart.id)
    const photo = cart.user?.photo
    return (
      <span className='odc-oq-customer'>
        {kicker && band && (firstOfBand.has(cart.id)
          ? <span className='odc-oq-group'>{groupLabel(band)}</span>
          : <span className='odc-sr-only'>{groupLabel(band)}, </span>)}
        <span className='odc-oq-who'>
          <Avatar kind='person' name={guest ? '' : (contact.name || '')} src={photo ? optimizeImage(photo, 'h_50,c_limit') : undefined} />
          <span className='odc-oq-who-text'>
            <span className='odc-oq-name' dir='auto' title={nameText} data-quiet={guest ? '' : undefined}>{nameText}</span>
            {sub && <span className='odc-oq-sub' dir='auto' title={sub}>{sub}</span>}
          </span>
        </span>
      </span>
    )
  }

  const businessCell = (cart) => {
    const name = cart.business?.name
    const logo = cart.business?.logo
    return (
      <span className='odc-oq-who'>
        <Avatar kind='business' name={name || ''} src={logo ? optimizeImage(logo, 'h_50,c_limit') : undefined} />
        <span className='odc-oq-who-text'>
          <span className='odc-oq-name' dir='auto' title={name}>{name}</span>
        </span>
      </span>
    )
  }

  const itemsText = (cart) => {
    if (waiting(cart)) return <Skeleton size='75%' />
    if (!ready(cart)) return noDetail()
    const summary = summarizeItems(detailOf(cart).cart.products)
    if (!summary || summary.items.length === 0) return dash(t('OPEN_CARTS_NO_ITEMS', 'No items'))
    const full = summarizeItems(detailOf(cart).cart.products, Infinity)
    // redesign «3× Name» is one isolate per product (`<bdi>`), with the « · » outside: in an RTL page the bidi algorithm
    // used to reorder a single joined text («Name 3 ×1»). The tooltip is plain text, so it isolates with FSI/PDI (U+2068/U+2069).
    const product = (item) => `${item.quantity}× ${item.name}`
    const tooltip = full.items.map(item => `\u2068${product(item)}\u2069`).join(' · ')
    return (
      <span className='odc-oq-items' title={tooltip}>
        {summary.items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && ' · '}
            <bdi>{product(item)}</bdi>
          </React.Fragment>
        ))}
        {summary.more > 0 && (
          <>
            {' '}
            <span aria-hidden='true' className='odc-figure'>{`+${summary.more}`}</span>
            <span className='odc-sr-only'>{t('OPEN_CARTS_MORE_ITEMS', '+_count_ more items').replace('_count_', summary.more)}</span>
          </>
        )}
      </span>
    )
  }

  // redesign OC-F1 (OC-Q1-02): the column that stepped aside for width gives its datum to this line, «#16864 · P.F. Changs ·
  // 2 days ago»; a column the person turned off is theirs and is not added
  const cartCell = (cart) => {
    const business = widthHiddenIds.includes('business') ? cart.business?.name : null
    const timed = widthHiddenIds.includes('lastActivity') && parseApiUtc(cart.updated_at)
    const ago = timed ? getTimeAgo(cart.updated_at) : null
    const line = [`#${cart.id}`, business, ago].filter(Boolean).join(' · ')
    return (
      <span className='odc-oq-cell'>
        {itemsText(cart)}
        <span className='odc-oq-sub' title={line}>
          <bdi dir='ltr' className='odc-mono'>{`#${cart.id}`}</bdi>
          {business ? ` · ${business}` : null}
          {ago ? <>{' · '}<span title={parseDate(cart.updated_at)}>{ago}</span></> : null}
        </span>
      </span>
    )
  }

  const valueCell = (cart) => {
    if (waiting(cart)) return <Skeleton size='60%' align='end' />
    if (!ready(cart)) return noDetail()
    return <bdi dir='ltr' className='odc-figure'>{parsePrice(cartTotal(detailOf(cart)))}</bdi>
  }

  const activityCell = (cart) => {
    if (!parseApiUtc(cart.updated_at)) return dash(t('NO_DATA', 'No data'))
    return <span title={parseDate(cart.updated_at)}>{getTimeAgo(cart.updated_at)}</span>
  }

  const statusCell = (cart) => (cart.status === CART_STATUS.PAYMENT_FAILED
    ? <Status family='cancel' label={t('OPEN_CARTS_PAYMENT_FAILED', 'Payment failed')} />
    : <Status family='pending' label={t('OPEN_CART_STATUS_OPEN', 'Open')} />) // the state (adjective), not the verb of OPEN

  const contactCell = (cart) => (contactOf(cart).isGuest || !contactOf(cart).hasContact
    ? dash(t('OPEN_CARTS_NO_CONTACT_DETAILS', 'No contact details'))
    : <ContactMenu cart={cart} detail={detailOf(cart)?.cart || null} />)

  const cityCell = (cart) => {
    const city = cart.city || cart.business?.city
    const name = typeof city === 'string' ? city : city?.name
    return name ? <span title={name}>{name}</span> : dash(t('NO_DATA', 'No data'))
  }

  const DEFINITIONS = {
    customer: { header: t('CUSTOMER', 'Customer'), rowHeader: true, wrap: true, skeleton: { lines: 2, lead: 'avatar' }, cell: cart => who(cart, { kicker: true }) },
    id: { header: t('ID', 'ID'), skeleton: { lines: 1 }, cell: cart => <bdi dir='ltr' className='odc-mono'>{cart.id}</bdi> },
    cart: { header: t('OPEN_CARTS_COLUMN_CART', 'Cart'), wrap: true, skeleton: { lines: 2 }, cell: cartCell },
    business: { header: t('BUSINESS', 'Business'), wrap: true, skeleton: { lines: 1, lead: 'business' }, cell: businessCell },
    city: { header: t('CITY', 'City'), skeleton: { lines: 1 }, cell: cityCell },
    value: { header: t('OPEN_CARTS_VALUE', 'Value'), align: 'end', skeleton: { lines: 1 }, cell: valueCell },
    lastActivity: { header: t('LAST_ACTIVITY', 'Last activity'), skeleton: { lines: 1 }, cell: activityCell },
    status: { header: t('STATUS', 'Status'), skeleton: { lines: 1, lead: 'dot' }, cell: statusCell },
    contact: { header: t('OPEN_CARTS_CONTACT', 'Contact'), skeleton: { lines: 1 }, cell: contactCell }
  }
  // The threshold of a priority column is the width of the table with it and everything that outranks it (what the person
  // turned off is not counted, and is never given a threshold).
  const shown = columns.filter(column => column.visible).map(column => column.id)
  const hideBelow = {}
  let needed = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0)
  WIDTH_PRIORITY.filter(id => shown.includes(id)).forEach(id => {
    hideBelow[id] = needed
    needed -= COLUMN_WIDTH[id]
  })
  const tableColumns = columns.map(({ id }) => ({ id, ...DEFINITIONS[id], hideBelow: hideBelow[id] }))
  const hiddenColumnIds = columns.filter(column => !column.visible).map(column => column.id)
  const managerColumns = columns.map(({ id, visible }) => ({
    id,
    label: DEFINITIONS[id].header,
    visible,
    locked: LOCKED.includes(id),
    widthHidden: visible && widthHiddenIds.includes(id)
  }))

  // ---- the states that are not rows ----
  const loadingLabel = t('OPEN_CARTS_LOADING', 'Loading carts')
  const listLabel = t('OPEN_CARTS', 'Open carts')
  const hiddenCount = Number(list?.hiddenCount) || 0
  const filtered = Boolean(hasFilters) || String(search ?? '').trim() !== ''

  const emptyState = () => {
    if (list?.searchWithoutDigits) {
      return <EmptyState icon={Search} title={t('OPEN_CARTS_SEARCH_BY_NUMBER', 'Search by cart number')} />
    }
    if (filtered) {
      return (
        <EmptyState
          icon={FilterX}
          title={t('OPEN_CARTS_NO_MATCH', 'No carts match these filters')}
          action={<Button onClick={onClearFilters}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>}
        />
      )
    }
    if (view === 'live') {
      return <EmptyState icon={Inbox} title={t('OPEN_CARTS_LIVE_EMPTY', 'Nobody has added to a cart in the last 30 minutes.')} />
    }
    if (isFollowUp && withContactOnly && hiddenCount > 0) {
      return (
        <EmptyState
          icon={Inbox}
          title={t('OPEN_CARTS_EMPTY', 'No open carts')}
          description={t('OPEN_CARTS_EMPTY_ALL_HIDDEN', 'The carts of this view have no contact details. Turn off “With contact only” to see them.')}
        />
      )
    }
    return <EmptyState icon={Inbox} title={t('OPEN_CARTS_EMPTY', 'No open carts')} />
  }

  const retry = (
    <Button
      onClick={() => {
        retried.current = true
        reloaded.current = false
        onReload?.()
      }}
    >
      {t('RETRY', 'Retry')}
    </Button>
  )
  // One frame in every state (it takes no box of its own: `display: contents`), so the focus can be found again after a reload
  const framed = (children) => <div ref={frameRef} className='odc-oq-frame'>{children}</div>

  // A failure with nothing to show takes the place of the list; a refresh that failed keeps the carts and says so above them.
  if (list?.error && carts.length === 0 && !list.loading) {
    return framed(
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('OPEN_CARTS_LOAD_FAILED', "We couldn't load the carts.")}
        description={errorText(t, list.error)}
        action={retry}
      />
    )
  }

  const tools = (isFollowUp || !isPhone) && (
    <div className='odc-oq-tools' data-cards={isPhone ? '' : undefined}>
      <span className='odc-oq-tools-start'>
        {isFollowUp && (
          <Switch checked={Boolean(withContactOnly)} onCheckedChange={next => onWithContactOnlyChange?.(Boolean(next))}>
            {t('OPEN_CARTS_WITH_CONTACT_ONLY', 'With contact only')}
          </Switch>
        )}
        {isFollowUp && hiddenCount > 0 && (
          <span className='odc-oq-note'>{fillCount(t('OPEN_CARTS_HIDDEN_COUNT', '_count_ hidden'), hiddenCount)}</span>
        )}
      </span>
      {!isPhone && (
        <span className='odc-oq-tools-end'>
          <ColumnManager
            columns={managerColumns}
            onChange={changeColumns}
            onReset={() => changeColumns(defaultColumns())}
            triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
            title={t('MANAGE_COLUMNS', 'Manage columns')}
            resetLabel={t('COLUMNS_RESET', 'Reset')}
            lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
            widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
            moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', label)}
            moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', label)}
          />
        </span>
      )}
    </div>
  )

  const refreshFailed = list?.error && carts.length > 0 && (
    <div className='odc-oq-notice' data-cards={isPhone ? '' : undefined}>
      <InlineNotice tone='warning' icon={TriangleAlert} action={retry}>
        {t('OPEN_CARTS_REFRESH_FAILED', "We couldn't refresh the carts.")}
      </InlineNotice>
    </div>
  )

  // ---- phone: the same data as cards ----
  if (isPhone) {
    const toCard = (cart) => {
      const contact = contactOf(cart)
      const name = contact.isGuest ? t('OPEN_CARTS_GUEST', 'Guest') : (contact.name || contact.email || contact.phone)
      return {
        id: cart.id,
        href: hrefFor(cart.id),
        label: t('OPEN_CARTS_CARD_LABEL', 'Cart #_id_ · _customer_').replace('_id_', cart.id).replace('_customer_', name),
        title: `#${cart.id}`,
        status: statusCell(cart),
        from: who(cart),
        to: businessCell(cart),
        assignee: itemsText(cart),
        schedule: [activityCell(cart)],
        figure: valueCell(cart),
        active: activeCartId != null && Number(activeCartId) === cart.id,
        actions: contact.hasContact
          ? (
            <div className='odc-oq-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
              <ContactMenu cart={cart} detail={detailOf(cart)?.cart || null} />
            </div>
            )
          : undefined,
        onOpen: () => onOpenCart?.(cart)
      }
    }
    const skeletonCount = Number(list?.pageSize) || DEFAULT_PAGE_SIZE
    return framed(
      <>
        {tools}
        {refreshFailed}
        {groups && !list.loading
          ? groups.map(group => (
            <section key={group.key}>
              <h3 className='odc-oq-card-group'>{groupLabel(group.key)}</h3>
              <RecordCardList label={groupLabel(group.key)} items={group.carts.map(toCard)} />
            </section>
          ))
          : (
            <RecordCardList
              label={listLabel}
              items={list?.loading ? [] : rows.map(toCard)}
              loading={Boolean(list?.loading)}
              loadingLabel={loadingLabel}
              skeletonCount={skeletonCount}
              empty={emptyState()}
            />
            )}
      </>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  return framed(
    <>
      {tools}
      {refreshFailed}
      <DataTable
        label={listLabel}
        columns={tableColumns}
        rows={rows}
        getRowId={cart => cart.id}
        newRowIds={highlightIds}
        hiddenColumnIds={hiddenColumnIds}
        onWidthHiddenChange={setWidthHiddenIds}
        activeRowId={activeCartId != null && Number.isFinite(Number(activeCartId)) ? Number(activeCartId) : undefined}
        onOpenRow={cart => onOpenCart?.(cart)}
        loading={Boolean(list?.loading)}
        loadingLabel={loadingLabel}
        skeletonRows={Number(list?.pageSize) || DEFAULT_PAGE_SIZE}
        getRowAttributes={cart => (firstOfBand.has(cart.id) ? { 'data-group-start': '' } : undefined)}
        scrollLabel={t('OPEN_CARTS_TABLE_SCROLL_REGION', 'Open carts table, scrolls sideways')}
        empty={emptyState()}
      />
    </>
  )
}
