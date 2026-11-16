import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useLanguage, SitesList as SitesListController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useRouteLeaveGuard } from '../../../hooks/useRouteLeaveGuard'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { Menu as MenuIcon, Plus, TriangleAlert } from '../../Shared/Icon'
import {
  Button,
  IconButton,
  InlineNotice,
  LeaveDialog,
  LeaveGuardContext,
  PageHeader,
  Pagination,
  SearchField,
  SplitView,
  useLeaveGuardHost
} from '../../Shared/Product'
import { OrderingProductDetails } from '../OrderingProductDetails'
import { SitesTable } from './SitesTable'
import './ordering-products.css'

// redesign (lot B, decisions 1, 2, 10, 11): the /ordering-products route on Product. The same controller (C/components/SitesList)
// and the same requests as `main`; what changes:
// - A page header in the list's column (count, the help text visible, «Add product»): it never sits under the panel (OP-02), and the
//   «Add product» of the foot is gone (it was a copy).
// - The search (name or description, as `main`) waits 400 ms after the last key; Enter and clearing send at once.
// - S/OrderingProductsListing/SitesTable: Product, Code and URL (OP-05), rows that open with the keyboard (OP-04).
// - A failed load says why, with «Try again», in a notice (no Alert).
// - The detail is lot C's OrderingProductDetails in a P/SplitView, with the leave guard of the page (OP-08). «Add product» always mounts
//   a new, empty form and takes id and tab out of the address (OP-01); a new product never opens on Theme (OP-15).
// - The address: ?id= opens a site (once, when the page has it), ?tab= is the tab it opens on, ?page and ?pageSize.

const NEW = 'new'
const TABS = ['general', 'theme']
const PAGE_SIZES = [10, 25, 50]
// review r2 (N-01): longer than the Slow role (--od-duration-slow, 420ms) of the closing overlay
const REFOCUS_WINDOW_MS = 900
const SEARCH_DELAY_MS = 400

// the tab the address asks for (?tab=): general or theme; anything else is general
const tabFromAddress = () => {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return TABS.includes(tab) ? tab : 'general'
}

// the site the address asks for (?id=), or null
const idFromAddress = () => {
  const value = new URLSearchParams(window.location.search).get('id')
  return /^\d+$/.test(String(value ?? '').trim()) ? Number(String(value).trim()) : null
}

// «Showing _from_–_to_ of _total_» with the numbers as figures (decision 11)
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

// N-04 (review): «General and Theme» in the app's language; a plain comma where Intl has no list format
const listOf = (labels, locale) => {
  if (labels.length < 2) return labels.join('')
  try {
    return new Intl.ListFormat(locale || 'en', { style: 'long', type: 'conjunction' }).format(labels)
  } catch (error) {
    return labels.join(', ')
  }
}

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const OrderingProductsUI = (props) => {
  const {
    sitesListState,
    searchValue,
    onSearch,
    getSites,
    paginationProps,
    setPaginationProps,
    handleSuccessUpdateSites,
    isUseQuery,
    enableAutoFillFromWebsite
  } = props

  const [languageState, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const leave = useLeaveGuardHost()
  // redesign the sidebar, ⌘K, links and back/forward ask too while a form holds unsaved work (the dialog is the one below)
  useRouteLeaveGuard({ active: leave.dirty, requestLeave: leave.requestLeave })

  const [open, setOpen] = useState(null) // { key: a site id or NEW, site, tab }
  const [expanded, setExpanded] = useState(false)

  const loading = Boolean(sitesListState?.loading)
  const sites = Array.isArray(sitesListState?.sites) ? sitesListState.sites : []
  const totalItems = paginationProps?.totalItems
  const pageSize = Number(paginationProps?.pageSize) >= 1 ? Number(paginationProps.pageSize) : 10
  const withCount = (template, value) => template.replace('_count_', String(value))

  // ── The search: a moment after typing, once per word. Enter and clearing send at once ──
  const [draft, setDraft] = useState(searchValue ?? '')
  const timer = useRef(null)
  const sent = useRef(searchValue ?? '')
  useEffect(() => () => clearTimeout(timer.current), [])

  const sendSearch = (text) => {
    const normalized = String(text ?? '').trim()
    if (normalized === sent.current) return
    sent.current = normalized
    // the controller goes back to the first page on its own when the search changes
    onSearch?.(normalized)
  }

  const typeSearch = (text) => {
    setDraft(text)
    clearTimeout(timer.current)
    if (text === '') sendSearch('')
    else timer.current = setTimeout(() => sendSearch(text), SEARCH_DELAY_MS)
  }

  // ── Open and close the detail; every way out asks first when the form holds unsaved work (OP-08) ──
  const opened = useRef(null) // the id the address opened, so a reload of the list does not open it again
  const showDetail = (site) => {
    // redesign (OP-01): ?tab stays as it is (lot C reads it by `initialTab`); only the id changes
    setOpen({ key: site.id, site, tab: tabFromAddress() })
    opened.current = Number(site.id)
    addQueryToUrl({ id: site.id })
  }
  const showNew = () => {
    // redesign (OP-01, OP-15): a new product is a form of its own (key 'new') on General, with no id or tab in the address
    setOpen({ key: NEW, site: null, tab: 'general' })
    opened.current = null
    removeQueryToUrl(['id', 'tab'])
  }
  // redesign (review r1, Q-05): the element that had the focus when the panel was asked for (a row, «Add product»). It is taken
  // before the leave question opens, so a dialog in between does not become the opener. Keeping the form puts the old one back.
  const openerRef = useRef(null)
  const addRef = useRef(null)
  const rememberOpener = () => {
    const previous = openerRef.current
    const active = typeof document !== 'undefined' ? document.activeElement : null
    openerRef.current = active && active !== document.body ? active : null
    return () => { openerRef.current = previous }
  }
  const requestOpen = (site) => {
    if (open && String(open.key) === String(site.id)) return
    const restore = rememberOpener()
    leave.requestLeave(() => showDetail(site), restore)
  }
  const requestNew = () => {
    if (open && open.key === NEW) return
    const restore = rememberOpener()
    leave.requestLeave(showNew, restore)
  }
  // redesign J5 row 47 (ordering-products P-1, ): after a create the new site stays open on Theme, to give it a theme
  // without looking for it in the list (main closed the panel). The create is saved: nothing is left to ask about.
  const showAdded = (site) => {
    if (site?.id == null) return closeDetail()
    setOpen({ key: site.id, site, tab: 'theme' })
    opened.current = Number(site.id)
    addQueryToUrl({ id: site.id, tab: 'theme' })
  }
  const closeDetail = () => {
    setOpen(null)
    setExpanded(false)
    opened.current = null
    removeQueryToUrl(['id', 'tab'])
  }

  // Once the panel is gone (any way out: ✕, Esc, Discard, a create, a delete) the focus goes back to the opener if it is still in the
  // page; if not (the row of a deleted site, or a panel the address opened), to «Add product» in the header. The page behind a closing
  // dialog is inert for a few frames, and the closing overlay (768–1279) gives the focus back by its own rule once its Slow role ends
  // (to <body> or to «Skip to content»). review r2 (N-01): so for a while longer than that it puts the focus back whenever it lands on
  // <body>, in the closing panel or outside the page; it waits while a dialog is open and stops when the user moves it inside the list.
  const wasOpen = useRef(false)
  const refocus = useRef(0)
  useEffect(() => {
    const isOpen = open != null
    const closing = wasOpen.current && !isOpen
    wasOpen.current = isOpen
    if (!closing) return
    const opener = openerRef.current
    openerRef.current = null
    const started = window.performance.now()
    const lost = (active) => !active || active === document.body || !!active.closest('.odc-split-panel') ||
      !active.closest('.odc-op-split')
    const attempt = () => {
      const target = opener?.isConnected ? opener : addRef.current
      if (!target?.isConnected) return
      const active = document.activeElement
      if (active !== target && !active?.closest('[role="alertdialog"]')) {
        if (!lost(active)) return
        target.focus({ preventScroll: true })
      }
      if (window.performance.now() - started < REFOCUS_WINDOW_MS) refocus.current = window.requestAnimationFrame(attempt)
    }
    refocus.current = window.requestAnimationFrame(attempt)
  }, [open])
  useEffect(() => () => window.cancelAnimationFrame(refocus.current), [])

  // The open site follows the list (a save), and ?id= opens a site once, when the page has it (if it does not: nothing)
  useEffect(() => {
    if (loading) return
    if (open && open.key !== NEW) {
      const updated = sites.find(site => String(site.id) === String(open.key))
      if (updated && updated !== open.site) setOpen(current => (current ? { ...current, site: updated } : current))
    }
    const id = idFromAddress()
    if (id == null) {
      opened.current = null
      return
    }
    if (opened.current === id) return
    const found = sites.find(site => Number(site?.id) === id)
    if (!found) return
    opened.current = id
    const previous = open && open.key !== NEW ? open.key : null
    leave.requestLeave(() => setOpen({ key: found.id, site: found, tab: tabFromAddress() }), () => {
      // staying puts the open site back in the address
      opened.current = previous != null ? Number(previous) : null
      if (previous != null) addQueryToUrl({ id: previous })
      else removeQueryToUrl(['id'])
    })
  }, [sitesListState])

  // The list the controller keeps changes under the panel (a save, a delete). A delete closes the panel through `onClose` (the
  // controller calls it once the site is gone); a save keeps it open, as `main`. The panel never closes here because an id moved.
  // ?page and ?pageSize after each load, as `main`
  useEffect(() => {
    if (!isUseQuery || !paginationProps?.currentPage || !paginationProps?.pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({
      page: paginationProps.currentPage,
      pageSize: paginationProps.pageSize
    })
  }, [paginationProps?.currentPage, paginationProps?.pageSize, paginationProps?.totalPages])

  // ── Pages ──
  const handleChangePage = (page) => {
    const nextPage = Number(page) >= 1 ? Number(page) : 1
    getSites(nextPage, pageSize)
  }
  const handleChangePageSize = (size) => {
    const nextPageSize = Number(size) >= 1 ? Number(size) : 10
    // redesign (review r1, Q-08): as `main`, the user keeps the position: the page that holds the first row on screen
    const expectedPage = Math.max(1, Math.ceil(Number(paginationProps?.from) / nextPageSize) || 1)
    setPaginationProps(prev => ({ ...prev, pageSize: nextPageSize }))
    getSites(expectedPage, nextPageSize)
  }

  // redesign (review r1, Q-04): a create or a delete changes the rows, so the count and the range follow by the difference
  // (the controller only replaces `sites`). A save keeps the same rows and changes nothing here.
  const handleSitesUpdated = (updatedSites) => {
    const difference = Array.isArray(updatedSites) ? updatedSites.length - sites.length : 0
    handleSuccessUpdateSites?.(updatedSites)
    if (difference === 0 || !Number.isFinite(Number(totalItems))) return
    setPaginationProps?.(prev => ({
      ...prev,
      totalItems: Math.max(0, Number(prev.totalItems) + difference),
      ...(prev.to != null ? { to: Math.max(0, Number(prev.to) + difference) } : {})
    }))
  }
  const pageSizeOptions = PAGE_SIZES.includes(pageSize) ? PAGE_SIZES : [...PAGE_SIZES, pageSize].sort((a, b) => a - b)

  // ── The list ──
  const addLabel = t('ADD_PRODUCT', 'Add product')
  const searching = Boolean(searchValue) || Boolean(draft)
  const known = totalItems != null && Number.isFinite(Number(totalItems))
  const listError = !loading && sitesListState?.error
    ? translateApiMessage(t, firstMessage(sitesListState.error), t('ORDERING_PRODUCTS_LOAD_FAILED', "We couldn't load the products."))
    : null

  const header = (
    <PageHeader
      leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
      title={t('ORDERING_PRODUCTS', 'Ordering products')}
      count={known ? Number(totalItems) : undefined}
      countLabel={known
        ? (Number(totalItems) === 1
            ? t('ORDERING_PRODUCTS_COUNT_ONE', '1 product')
            : withCount(t('ORDERING_PRODUCTS_COUNT_OTHER', '_count_ products'), totalItems))
        : undefined}
      // redesign (OP-10): the help is a visible line, not an icon that shows it on hover
      description={t('ORDERING_PRODUCTS_INFO', 'Select your site and customize it with our basic configurations in General tab and our advanced configurations in Theme tab.')}
      primaryAction={(
        <Button ref={addRef} variant='primary' icon={Plus} title={addLabel} onClick={requestNew}>
          <span data-collapse-label=''>{addLabel}</span>
        </Button>
      )}
    />
  )

  const tools = (
    <div className='odc-op-tools'>
      <SearchField
        className='odc-op-search'
        value={draft}
        onChange={typeSearch}
        onKeyDown={(event) => { if (event.key === 'Enter') { clearTimeout(timer.current); sendSearch(draft) } }}
        label={t('SEARCH', 'Search')}
        placeholder={t('SEARCH_BY_NAME_OR_DESCRIPTION', 'Search by name or description')}
        clearLabel={t('CLEAR', 'Clear')}
      />
    </div>
  )

  const list = (
    <div className='odc-root odc-op-frame'>
      {header}
      {tools}
      {listError && (
        <InlineNotice
          tone='danger'
          icon={TriangleAlert}
          action={(
            <Button size='sm' onClick={() => getSites(paginationProps?.currentPage ?? 1, pageSize)}>
              {t('TRY_AGAIN', 'Try again')}
            </Button>
          )}
        >
          {listError}
        </InlineNotice>
      )}
      {!(listError && sites.length === 0) && (
        <SitesTable
          sites={sites}
          loading={loading}
          skeletonRows={pageSize}
          activeId={open && open.key !== NEW ? open.key : undefined}
          onOpen={requestOpen}
          searching={searching}
          onAdd={requestNew}
        />
      )}
      {totalItems > 0 && (
        <div className='odc-op-foot'>
          <Pagination
            page={paginationProps.currentPage}
            pageSize={pageSize}
            total={totalItems}
            pageSizeOptions={pageSizeOptions}
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
    </div>
  )

  const isNew = open?.key === NEW
  const panelTitle = isNew ? addLabel : (open?.site?.name || String(open?.key ?? ''))
  const panel = open
    ? (
      <OrderingProductDetails
        key={isNew ? NEW : open.key}
        site={isNew ? null : open.site}
        sitesList={sites}
        handleSuccessUpdateSites={handleSitesUpdated}
        enableAutoFillFromWebsite={enableAutoFillFromWebsite}
        // redesign (OP-15): a new product never opens on Theme
        initialTab={isNew ? 'general' : open.tab}
        onTabChange={(tab) => { if (!isNew) addQueryToUrl({ tab }) }}
        expanded={expanded && !isNew}
        onToggleExpanded={() => setExpanded(current => !current)}
        onRequestClose={() => leave.requestLeave(closeDetail)}
        // a delete closes at once, with no «Discard?» after it (decision 10); a create opens the new site on Theme (J5 row 47)
        onClose={closeDetail}
        onSiteAdded={showAdded}
      />
      )
    : null

  return (
    <LeaveGuardContext.Provider value={leave.context}>
      <SplitView
        className='odc-op-split'
        list={list}
        panel={panel}
        open={Boolean(panel)}
        expanded={expanded && !isNew}
        panelLabel={panelTitle || addLabel}
        resizeLabel={t('ORDERING_PRODUCTS_RESIZE_PANEL', 'Resize the product panel')}
        storageKey='od.ordering-products.panel'
        onClose={closeDetail}
      />
      <LeaveDialog
        open={leave.dialog.open}
        saving={leave.dialog.saving}
        onKeep={leave.dialog.onKeep}
        onDiscard={leave.dialog.onDiscard}
        onSave={leave.dialog.onSave}
        returnFocus={leave.dialog.returnFocus}
        title={t('LEAVE_UNSAVED_TITLE', 'Save your changes?')}
        description={t('LEAVE_UNSAVED_DESCRIPTION', 'You have unsaved changes in _section_. Save them before you leave, or discard them.')
          // N-04 (of ): the tabs with unsaved changes, not the page; the page when no form names itself
          .replace('_section_', () => listOf(leave.dialog.labels, languageState?.language?.code) || t('ORDERING_PRODUCTS', 'Ordering products'))}
        keepLabel={t('KEEP_EDITING', 'Keep editing')}
        saveLabel={t('SAVE_AND_CONTINUE', 'Save and continue')}
        discardLabel={t('DISCARD', 'Discard')}
        closeLabel={t('CLOSE', 'Close')}
      />
    </LeaveGuardContext.Provider>
  )
}

export const OrderingProductsListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const sitesProps = {
    ...props,
    UIComponent: OrderingProductsUI,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPageSize) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }
  return <SitesListController {...sitesProps} />
}
