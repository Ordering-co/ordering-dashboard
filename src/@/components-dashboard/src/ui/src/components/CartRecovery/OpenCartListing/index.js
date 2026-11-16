import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, useSession, OpenCartListing as OpenCartListingController } from '../../../../../index'
import { CART_VIEWS, contactOf } from '../../../../../utils/openCarts'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { addQueryToUrl, learnOptionsValues, removeQueryToUrl } from '../../../utils'
import { Pagination, SplitView } from '../../Shared/Product'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { QueueHeader } from '../OpenCartsQueue/QueueHeader'
import { QueueFilters } from '../OpenCartsQueue/QueueFilters'
import { QueueTable } from '../OpenCartsQueue/QueueTable'
import { OpenCartPanel } from '../OpenCartPanel'
import '../OpenCartsQueue/open-carts.css'
import { Foot, ListFrame } from './styles'

// redesign OC-B (OC-1): the open carts page is a queue (header with the views, filters, table, foot) beside the cart panel in a
// split view, as /orders. The controller (OC-A) owns the data; this owns what the person sees of it: the URL (?view, ?id, ?page,
// ?pageSize, ?contact), the cart that is open and the announcements.

const PAGE_SIZES = [10, 25, 50]
const DEFAULT_VIEW = 'followUp'
const HIGHLIGHT_MS = 2000 // a row that just arrived in Live now stays marked for 2 seconds

// redesign OC-F2 (OC-Q1-04): after a delete the focus goes to the row that took the deleted cart's place. DataTable's rows (and the
// cards of the phone list) carry `data-row-id`; with no row left it goes to the table's region. The DOM is not ready the moment the
// controller answers (the list re-renders, the panel and its dialog close and give the focus back), so it is tried on the next frames
// until it holds, and it leaves alone a focus the person already put somewhere in the list.
const FOCUS_FRAMES = 30
const FOCUS_STABLE_FRAMES = 3
const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

const focusableIn = (element) => {
  if (!element) return null
  if (element.hasAttribute('tabindex')) return element
  return element.querySelector('a[href], button, [tabindex]') ?? element
}

const focusTargetIn = (frame, id, final) => {
  if (!frame) return null
  if (id != null) {
    const row = Array.from(frame.querySelectorAll('[data-row-id]')).find(element => element.getAttribute('data-row-id') === String(id))
    if (row) return focusableIn(row)
    if (!final) return null // the list may not have rendered yet
  }
  const region = frame.querySelector('.odc-table-scroll, ul[role="list"]') ?? frame
  if (!region.hasAttribute('tabindex')) region.setAttribute('tabindex', '-1')
  return region
}

const settleFocusOn = (getFrame, id) => {
  let frames = 0
  let stable = 0
  const step = () => {
    frames++
    const frame = getFrame()
    const target = focusTargetIn(frame, id, frames >= 4)
    if (target) {
      const active = document.activeElement
      if (active === target) {
        stable++
      } else if (!active || active === document.body || !active.isConnected || !frame.contains(active)) {
        target.focus({ preventScroll: true })
        stable = 0
      } else {
        return // the focus is already on something in the list
      }
      if (stable >= FOCUS_STABLE_FRAMES) return
    }
    if (frames < FOCUS_FRAMES) nextFrame(step)
  }
  nextFrame(step)
}

const idOf = (text) => {
  const id = Number(text)
  return text != null && text !== '' && Number.isInteger(id) ? id : null
}

// «_total_» → «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const OpenCartListingUI = (props) => {
  const {
    isUseQuery,
    onCartRedirect,
    view,
    onViewChange,
    search,
    onSearchChange,
    filters,
    onFiltersChange,
    onClearFilters,
    withContactOnly,
    onWithContactOnlyChange,
    list,
    onReload,
    onPageChange,
    onPageSizeChange,
    counts,
    details,
    ensureDetails,
    rules,
    dayFigures,
    live,
    deleteCart,
    businesses,
    cities
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()
  const urlQuery = new URLSearchParams(location.search)

  // ---- the cart that is open: kept as an object, so a reload never closes it ----
  const [openCart, setOpenCart] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const openId = useRef(null)
  openId.current = openCart?.id ?? null
  // The ?id= the page was opened with: decided once, when the first list is in
  const pendingId = useRef(urlQuery.has('id') ? urlQuery.get('id') : undefined)

  // the list's own version of the open cart when it has one (a reload may bring a newer `updated_at`), else the one we hold
  const shownCart = useMemo(
    () => (openCart ? (list?.carts?.find(cart => cart.id === openCart.id) ?? openCart) : null),
    [openCart, list?.carts]
  )

  const handleOpenCart = (cart) => {
    setOpenCart(cart)
    onCartRedirect?.(cart?.id)
  }

  const handleClose = () => {
    if (openId.current == null) return // already closed (the panel closes itself after a delete too)
    openId.current = null
    setOpenCart(null)
    setExpanded(false)
    onCartRedirect?.()
  }

  useEffect(() => {
    if (pendingId.current === undefined || !list || list.loading) return
    const wanted = pendingId.current
    pendingId.current = undefined
    // a failed or empty list has nothing to decide on: the URL stays as it is
    if (list.error) return
    const found = idOf(wanted) != null ? list.carts?.find(cart => cart.id === idOf(wanted)) : null
    if (found) {
      setOpenCart(found)
      return
    }
    // redesign OC-F3 (OC-Q1-08): the cart may be a guest's, hidden by «With contact only»: show the guests (and keep the id) and decide
    // again with the list that brings
    if (idOf(wanted) != null && view === 'followUp' && withContactOnly && list.hiddenCount > 0) {
      pendingId.current = wanted
      handleContactChange(false)
      return
    }
    if (!list.carts?.length) return
    onCartRedirect?.() // main's behaviour: an id that is not in the list leaves the URL
  }, [list])

  // the open cart's detail: asked for when it opens and when the list brings a newer version of it; whole, even when the list already
  // brought its total
  useEffect(() => {
    if (shownCart) ensureDetails?.([shownCart], { full: true })
  }, [shownCart?.id, shownCart?.updated_at])

  const frameRef = useRef(null)
  const handleDelete = async (cart) => {
    // the row that will take the deleted cart's place: the next one, or the one before when it was the last
    const rows = list?.carts ?? []
    const index = rows.findIndex(item => item.id === cart.id)
    const successor = index === -1 ? null : (rows[index + 1] ?? rows[index - 1] ?? null)
    const answer = await deleteCart(cart)
    if (answer?.ok && openId.current === cart.id) {
      handleClose()
      settleFocusOn(() => frameRef.current, successor?.id ?? null)
    }
    return answer
  }

  // ---- the URL: ?view= (replace), ?page and ?pageSize as before ----
  const handleViewChange = (next) => {
    onViewChange(next)
    if (!isUseQuery) return
    if (next === DEFAULT_VIEW) removeQueryToUrl(['view'])
    else addQueryToUrl({ view: next })
  }

  // redesign OC-F3 (OC-Q1-08): «With contact only» is kept like the view: ?contact=all when it is off, nothing when it is on (the default)
  const handleContactChange = (next) => {
    onWithContactOnlyChange?.(next)
    if (!isUseQuery) return
    if (next) removeQueryToUrl(['contact'])
    else addQueryToUrl({ contact: 'all' })
  }

  // The router's own ?view= changing (the ⌘K palette navigates to a view while the page is open) moves the view
  const urlView = urlQuery.get('view')
  const lastUrlView = useRef(urlView)
  useEffect(() => {
    if (lastUrlView.current === urlView) return
    lastUrlView.current = urlView
    const next = CART_VIEWS.includes(urlView) ? urlView : DEFAULT_VIEW
    if (next !== view) onViewChange(next)
  }, [urlView])

  useEffect(() => {
    if (!isUseQuery || !list || list.loading || !list.pageSize) return
    addQueryToUrl({ page: list.page, pageSize: list.pageSize })
  }, [isUseQuery, list?.loading, list?.page, list?.pageSize])

  // ---- Live now: what arrived is announced (one message per refresh) and marked for 2 seconds ----
  const [announcement, setAnnouncement] = useState('')
  const [highlightIds, setHighlightIds] = useState([])
  const newIds = live?.newIds
  useEffect(() => {
    if (!newIds?.length) return undefined
    if (newIds.length === 1) {
      const arrived = list?.carts?.find(cart => cart.id === newIds[0])
      const name = arrived ? contactOf(arrived).name : null
      setAnnouncement(name
        ? t('OPEN_CARTS_NEW_CART_FROM', 'New cart from _name_').replace('_name_', name)
        : t('OPEN_CARTS_NEW_CART_GUEST', 'New cart from a guest'))
    } else {
      setAnnouncement(t('OPEN_CARTS_NEW_CARTS', '_count_ new carts').replace('_count_', newIds.length))
    }
    setHighlightIds(newIds)
    const timer = setTimeout(() => setHighlightIds([]), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [newIds])

  // ---- what the pieces receive ----
  const learn = <LearnDropDown learnOptions={learnOptionsValues(['open_cart_general_view', 'cart_details'], t)} />
  const hasFilters = Boolean(
    String(search ?? '').trim() ||
    filters?.businessIds?.length ||
    filters?.customerIds?.length ||
    filters?.cityIds?.length ||
    filters?.lastActivity?.from ||
    filters?.lastActivity?.to
  )
  const detailState = shownCart ? details?.[shownCart.id] : undefined
  const isLive = view === 'live'
  const showFoot = Boolean(list) && !isLive && !list.error && !list.searchWithoutDigits && list.totalPages > 1

  const listView = (
    <ListFrame ref={frameRef} className='odc-root odc-oc-frame'>
      <QueueHeader
        counts={counts}
        view={view}
        onViewChange={handleViewChange}
        rules={rules}
        dayFigures={dayFigures}
        live={live}
        learn={learn}
        onOpenMenu={isCollapse ? () => handleMenuCollapse(false) : undefined}
      />
      <QueueFilters
        search={search}
        onSearchChange={onSearchChange}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
        businesses={businesses}
        cities={cities}
        view={view}
      />
      <QueueTable
        view={view}
        list={list}
        details={details}
        ensureDetails={ensureDetails}
        activeCartId={shownCart?.id ?? null}
        onOpenCart={handleOpenCart}
        withContactOnly={withContactOnly}
        onWithContactOnlyChange={handleContactChange}
        onClearFilters={onClearFilters}
        onReload={onReload}
        hasFilters={hasFilters}
        search={search}
        highlightIds={highlightIds}
        columnsUserId={user?.id}
      />
      <Foot>
        {list?.capped && !list.error && (
          <p className='odc-oc-note'>{t('OPEN_CARTS_CAPPED', 'Showing only the most recent carts. Use the filters to find others.')}</p>
        )}
        {showFoot && (
          <Pagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            busy={Boolean(list.loading)}
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
        )}
      </Foot>
    </ListFrame>
  )

  const panel = shownCart && (
    <OpenCartPanel
      cart={shownCart}
      detail={detailState?.full ? detailState.cart ?? undefined : undefined}
      detailState={detailState}
      onRetry={() => ensureDetails?.([shownCart], { retry: true })}
      onClose={handleClose}
      onDelete={handleDelete}
      rules={rules}
      expanded={expanded}
      onExpandedChange={setExpanded}
    />
  )

  return (
    <>
      <SplitView
        className='odc-oc-split'
        list={listView}
        panel={panel}
        open={Boolean(shownCart)}
        expanded={expanded}
        panelLabel={t('OPEN_CART_NUMBER', 'Cart #_id_').replace('_id_', shownCart?.id ?? '')}
        resizeLabel={t('RESIZE_CART_PANEL', 'Resize the cart panel')}
        storageKey='od.open-carts.panel'
        onClose={handleClose}
      />
      {/* Outside the split view: the list is inert while the panel is a page, and a hidden region announces nothing */}
      <div className='odc-sr-only' role='status' aria-live='polite'>{announcement}</div>
    </>
  )
}

export const OpenCartListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const fromUrl = props.isUseQuery
  const view = query.get('view')
  const page = Number(query.get('page'))
  const pageSize = Number(query.get('pageSize'))
  const openCartsProps = {
    ...props,
    UIComponent: OpenCartListingUI,
    initialView: fromUrl && CART_VIEWS.includes(view) ? view : props.initialView,
    initialWithContactOnly: fromUrl && query.get('contact') === 'all' ? false : props.initialWithContactOnly,
    paginationSettings: {
      initialPage: fromUrl && Number.isInteger(page) && page >= 1 ? page : 1,
      pageSize: fromUrl && PAGE_SIZES.includes(pageSize) ? pageSize : 10,
      controlType: 'pages'
    }
  }
  return <OpenCartListingController {...openCartsProps} />
}
