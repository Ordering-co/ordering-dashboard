import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  useLanguage,
  useApi,
  useConfig,
  BusinessBrandListing as BusinessBrandListingController
} from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { settleFocusOn } from '../../../utils/listFocus'
import { Menu as MenuIcon, Plus, TriangleAlert } from '../../Shared/Icon'
import { isWhiteLabelSiteConfigured, WHITE_LABEL_SITES_ENABLED } from '../../../../../utils/businessDetailSections'
import {
  AlertDialog,
  Button,
  ConfirmDialog,
  IconButton,
  InlineNotice,
  PageHeader,
  Pagination,
  SearchField,
  SplitView
} from '../../Shared/Product'
import { BrandPanel } from './BrandPanel'
import { BrandsTable } from './BrandsTable'
import './brand-listing.css'

// redesign SB-B2 (; decisions 1, 2, 5, 6, 7; G5-43, G5-44, G5-47, M-SB1, M-SB3, M-SB4, M-SB6, M-SB8, M-SB9, auditor 1, 9, 14, 15):
// /stores/brand on Product. A header (title, count, «Add brand»), the search, the brand table (cards under 768px) and its foot, beside
// the brand's ficha in a split view. The controller (C/BusinessBrandListing) owns the data; this owns what the person sees of it: the URL
// (`?id=` when a brand opens, `?tab=` when the tab changes, both gone on close), the brand that is open, the width of the ficha, the
// discard guard and the two dialogs (delete, and the error of a delete). The three tabs are the children of before (SB-B3, SB-B4, SB-B5).
//
// `?tab=` keeps the values of main (`general`, `businesses`, `white_label`) although the second one says «Stores» now, and `?id=` and the
// command palette are as they were (auditor 9). Opening a brand asks for nothing: only General is mounted; Stores and White label mount
// when their tab opens (auditor 1).

const SEARCH_DEBOUNCE_MS = 750 // the wait of `SearchBar lazyLoad` of main: each change of the search is a request
const PAGE_SIZES = [10, 25, 50]
const NAME_TOKEN = '_name_'

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

// «of _total_» → the number becomes an .odc-figure node and keeps its direction in RTL
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// The API answers a list of messages, one text or nothing
const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

const BusinessBrandListingUI = (props) => {
  const {
    searchValue,
    onSearch,
    brandListState,
    handleChangeState,
    handleDeleteBrand,
    getBrand,
    openDetail,
    setOpenDetail,
    paginationProps,
    getBrands,
    handleUpdateBrandList
  } = props

  const location = useLocation()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [ordering] = useApi()
  const [{ configs }] = useConfig()
  // main, the brand's White label tab is hidden while WHITE_LABEL_SITES_ENABLED is false
  const whiteLabelEnabled = WHITE_LABEL_SITES_ENABLED && isWhiteLabelSiteConfigured(ordering?.project, configs?.whitelabel_brands_sites)

  const brands = brandListState?.brands ?? []
  const listError = brandListState?.error
  // before the first answer the list is on its way, not empty (`loaded` comes from the controller)
  const loading = !!brandListState?.loading || (brandListState?.loaded === false && !listError)
  const currentPage = paginationProps?.currentPage
  const pageSize = paginationProps?.pageSize
  const total = paginationProps?.totalItems ?? null

  // ---- the brand that is open: a row, or just an id (`?id=` of a brand the page does not hold is asked for) ----
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [tab, setTab] = useState('general')
  const [expanded, setExpanded] = useState(false)
  const [panelKey, setPanelKey] = useState(0) // a new brand (or «Add new brand») starts a new panel; creating one does not
  const [notFound, setNotFound] = useState(false)
  const widthBefore = useRef(false) // the width the ficha had before White label took the whole page
  const frameRef = useRef(null)
  const openIdRef = useRef(null)
  openIdRef.current = openDetail ? (selectedBrand?.id ?? null) : null

  // The list's version of the open brand when it has one (a switch or a save moved it); else the one we hold (it may be on another page)
  const listBrand = selectedBrand ? brands.find(item => item.id === selectedBrand.id) : null
  const shownBrand = useMemo(
    () => (selectedBrand ? (listBrand ? { ...selectedBrand, ...listBrand } : selectedBrand) : null),
    [selectedBrand, listBrand]
  )

  // ---- unsaved changes in General: switching brand or opening «Add brand» asks first (closing is guarded by the panel) ----
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const [discard, setDiscard] = useState(null) // { go }
  const resetDraft = () => {
    dirtyRef.current = false
    setDirty(false)
  }
  const handleDirty = useCallback((value) => {
    dirtyRef.current = !!value
    setDirty(!!value)
  }, [])
  const withDraftGuard = (go) => (dirtyRef.current ? setDiscard({ go }) : go())
  // redesign SB-R1 (review R1-02): «Keep editing» gives the focus back to the General field the user was in, not to the row that asked
  const lastFieldRef = useRef(null)
  const keepingRef = useRef(false)
  useEffect(() => {
    const track = (event) => {
      if (event.target?.closest?.('.odc-brand-general')) lastFieldRef.current = event.target
    }
    document.addEventListener('focusin', track)
    return () => document.removeEventListener('focusin', track)
  }, [])

  const normalizeTab = (value, hasBrand) => {
    if (!hasBrand) return 'general'
    if (value === 'businesses') return 'businesses'
    if (value === 'white_label' && whiteLabelEnabled) return 'white_label'
    return 'general'
  }

  // Shows a brand in the panel; true when it is another one than the one that was open. The URL is the caller's.
  const showBrand = (brand, tabParam) => {
    const changed = openIdRef.current !== brand.id
    setNotFound(false)
    if (!changed) return false
    const nextTab = normalizeTab(tabParam, true)
    resetDraft()
    setPanelKey(key => key + 1)
    setSelectedBrand(brand)
    setTab(nextTab)
    widthBefore.current = false
    setExpanded(nextTab === 'white_label') // White label is opened as a page, as in main
    setOpenDetail(true)
    return true
  }

  const openBrand = (brand) => withDraftGuard(() => {
    const changed = showBrand(brand, 'general')
    addQueryToUrl({ id: brand.id })
    if (changed) removeQueryToUrl(['tab'])
  })

  const openNew = () => withDraftGuard(() => {
    resetDraft()
    setPanelKey(key => key + 1)
    setSelectedBrand(null)
    setTab('general')
    widthBefore.current = false
    setExpanded(false)
    setNotFound(false)
    setOpenDetail(true)
    removeQueryToUrl(['id', 'tab'])
  })

  // What the panel's close, Escape and scrim end in (the panel asked about unsaved changes before), and what a delete ends in
  const closePanel = () => {
    // redesign bugs F row 20 (M-01): a brand opened by the address (?id=, ⌘K) had no opener to give the focus back to, so
    // it fell to <body>; it goes to the brand's row (after a delete, the table). A focus already on something of the list stays.
    settleFocusOn(() => frameRef.current, selectedBrand?.id ?? null)
    resetDraft()
    setOpenDetail(false)
    setSelectedBrand(null)
    setTab('general')
    widthBefore.current = false
    setExpanded(false) // M-SB9: the next brand opens in the split
    removeQueryToUrl(['id', 'tab'])
  }

  const handleTab = (next) => {
    const target = normalizeTab(next, !!selectedBrand)
    if (target === tab) return
    // White label is a wide surface: the ficha takes the page and goes back to the width it had when the person leaves it
    if (target === 'white_label') {
      widthBefore.current = expanded
      setExpanded(true)
    } else if (tab === 'white_label') {
      setExpanded(widthBefore.current)
    }
    setTab(target)
    addQueryToUrl({ tab: target })
  }

  // General created a brand (`onSelectedBrand` with the new one) or saved one (with what the API answered): the panel follows it (M-SB8)
  const handleSelectedBrand = (brand) => {
    if (!brand || brand.id == null) return
    if (!selectedBrand) addQueryToUrl({ id: brand.id })
    setSelectedBrand(previous => (previous && previous.id === brand.id ? { ...previous, ...brand } : brand))
  }

  // White label made a site for the brand: the brand and the list know its `site_id`
  const handleUpdateBrand = (updated) => {
    setSelectedBrand(updated)
    if (handleUpdateBrandList && brandListState?.brands) {
      handleUpdateBrandList(brandListState.brands.map(item => (item.id === updated.id ? updated : item)))
    }
  }

  // The switch of a row and the one of the panel: the same call; what it answers is what AsyncSwitch reads (`{ ok: false }` goes back)
  const toggleEnabled = async (brand, next) => {
    const result = await handleChangeState?.(brand.id, 'enabled', next)
    // a brand the page does not hold has no row to show what the switch just did
    if (!result || result.ok !== false) {
      setSelectedBrand(previous => (previous && previous.id === brand.id ? { ...previous, enabled: next } : previous))
    }
    return result
  }

  // ---- ?id= (M-SB1): decided once, when the first list is in (a list with 0 brands counts); `?tab=` is applied when it opens ----
  const resolveBrand = async (id, tabParam, fromRouter) => {
    const found = brands.find(item => item.id === id)
    let brand = found
    if (!brand) {
      let result = null
      try {
        result = await getBrand?.(id)
      } catch {
        result = null
      }
      brand = result?.ok ? result.brand : null
    }
    if (!brand) {
      setNotFound(true)
      removeQueryToUrl(['id', 'tab']) // never «Add new brand» for an id that does not exist
      return
    }
    const changed = showBrand(brand, tabParam)
    const wanted = normalizeTab(tabParam, true)
    if (changed && tabParam && tabParam !== wanted) removeQueryToUrl(['tab']) // a `?tab=` the brand cannot show
    if (changed && fromRouter && !tabParam) removeQueryToUrl(['tab'])
  }

  const pendingId = useRef(positiveInt(new URLSearchParams(location.search).get('id')))
  const pendingTab = useRef(new URLSearchParams(location.search).get('tab'))
  const listArrived = brandListState?.loaded ?? (!loading && (brands.length > 0 || !!listError || total != null))
  useEffect(() => {
    if (pendingId.current == null || !listArrived) return
    const id = pendingId.current
    pendingId.current = null
    resolveBrand(id, pendingTab.current, false)
  }, [listArrived])

  // The router navigated to a brand while the page was open (⌘K): our own replaceState writes never reach the router
  const visited = useRef({ search: location.search, key: location.key })
  useEffect(() => {
    if (visited.current.search === location.search && visited.current.key === location.key) return
    visited.current = { search: location.search, key: location.key }
    const params = new URLSearchParams(location.search)
    const id = positiveInt(params.get('id'))
    if (id == null || openIdRef.current === id) return
    withDraftGuard(() => resolveBrand(id, params.get('tab'), true))
  }, [location.key, location.search])

  // ---- delete (G5-43, decision 6): asks first; on success the panel and the URL go (G5-44) and the focus goes to the list's heading ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const deletedRef = useRef(false)
  const deletingRef = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const askToDelete = (brand) => {
    deletedRef.current = false
    setDeleteTarget(brand)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (deletingRef.current || !deleteTarget) return
    deletingRef.current = true
    setDeleting(true)
    let result
    try {
      result = await handleDeleteBrand?.(deleteTarget.id)
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    deletingRef.current = false
    if (!mounted.current) return
    setDeleting(false)
    setDeleteOpen(false)
    if (result && result.ok === false) {
      setDeleteErrors(errorLines(result.error, t('DELETE_BRAND_ERROR', 'The brand could not be deleted.')))
      return
    }
    deletedRef.current = true
    closePanel()
  }

  const deleteTitleParts = t('DELETE_BRAND_TITLE', 'Delete _name_?').split(NAME_TOKEN)
  const deleteTitle = deleteTitleParts.reduce(
    (nodes, part, index) => (index === 0 ? [part] : [...nodes, <bdi key={index}>{deleteTarget?.name ?? ''}</bdi>, part]),
    []
  )

  // ---- search: typed here, sent after a wait (at once on Enter and on clear) ----
  const [searchText, setSearchText] = useState(searchValue || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  const sentSearch = useRef(searchValue || '')
  sentSearch.current = searchValue || ''
  // a value set from outside shows unless the person is typing
  useEffect(() => {
    if (!searchValue) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(searchValue)
  }, [searchValue])
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    if (text !== sentSearch.current) onSearch?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => sendSearch(text), SEARCH_DEBOUNCE_MS)
  }

  // ---- what the pieces receive ----
  const known = total != null && Number.isFinite(Number(total))
  const countLabel = Number(total) === 1
    ? t('BRANDS_COUNT_ONE', '1 brand')
    : t('BRANDS_COUNT_OTHER', '_count_ brands').replace('_count_', String(total))
  const addLabel = t('ADD_BRAND', 'Add brand')

  const listView = (
    <div ref={frameRef} className='odc-root odc-brand-frame'>
      <PageHeader
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        title={t('BRANDS', 'Brands')}
        count={known ? Number(total) : undefined}
        countLabel={known ? countLabel : undefined}
        primaryAction={(
          <Button variant='primary' icon={Plus} title={addLabel} onClick={openNew}>
            <span data-collapse-label=''>{addLabel}</span>
          </Button>
        )}
      />
      <div className='odc-brand-search'>
        <SearchField
          value={searchText}
          onChange={typeSearch}
          onClear={() => sendSearch('')}
          onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
          inputRef={searchInput}
          label={t('SEARCH', 'Search')}
          placeholder={t('BRANDS_SEARCH_PLACEHOLDER', 'Search brands')}
          clearLabel={t('CLEAR_SEARCH', 'Clear search')}
        />
      </div>
      {notFound && (
        <InlineNotice tone='warning' icon={TriangleAlert} role='status'>
          {t('BRAND_NOT_FOUND', 'Brand not found')}
        </InlineNotice>
      )}
      <BrandsTable
        brands={brands}
        loading={loading}
        error={listError}
        pageSize={pageSize}
        activeBrandId={openDetail ? (selectedBrand?.id ?? null) : null}
        onOpenBrand={openBrand}
        hasSearch={!!searchValue}
        onRetry={() => getBrands?.(currentPage, pageSize)}
        onAddBrand={openNew}
        onToggleEnabled={toggleEnabled}
      />
      {/* decision 5: no «Add new brand» in the foot; «Add brand» is the header's and the empty state's */}
      {!listError && total != null && (
        <div className='odc-brand-foot'>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={total}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={(page) => getBrands?.(page, pageSize)}
            onPageSizeChange={(size, page) => getBrands?.(page, size)}
            busy={loading}
            showPageInput
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            pageLabel={t('PAGE', 'Page')}
            pageOfLabel={(totalPages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(totalPages) })}
            // after a delete the page holds fewer rows than its size until the next load: never claim more than the rows on screen
            rangeLabel={(from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(brands.length > 0 ? Math.min(to, from + brands.length - 1) : to), total: figureOf(count) })}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        </div>
      )}
    </div>
  )

  const panel = openDetail && (
    <BrandPanel
      key={panelKey}
      brand={shownBrand}
      tab={tab}
      onTabChange={handleTab}
      whiteLabelEnabled={whiteLabelEnabled}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onClose={closePanel}
      onDelete={askToDelete}
      onToggleEnabled={toggleEnabled}
      dirty={dirty}
      onDirtyChange={handleDirty}
      onSelectedBrand={handleSelectedBrand}
      onUpdateBrand={handleUpdateBrand}
      controllerProps={props}
    />
  )

  return (
    <>
      <SplitView
        className='odc-brand-split'
        list={listView}
        panel={panel}
        open={!!openDetail}
        expanded={expanded}
        panelLabel={shownBrand?.name ?? t('ADD_NEW_BRAND', 'Add new brand')}
        resizeLabel={t('BRANDS_RESIZE_PANEL', 'Resize the brand panel')}
        storageKey='odc-brand-panel'
        onClose={closePanel}
      />

      <ConfirmDialog
        open={deleteOpen}
        tone='danger'
        title={deleteTitle}
        confirmLabel={t('DELETE_BRAND', 'Delete brand')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        finalFocus={() => {
          const heading = frameRef.current?.querySelector('h1')
          if (deletedRef.current && heading?.isConnected) {
            deletedRef.current = false
            heading.setAttribute('tabindex', '-1')
            return heading
          }
          return true
        }}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      >
        {/* P8: the API unlinks the stores and does not touch the white-label site */}
        {t('DELETE_BRAND_BODY_STORES', "Its stores are left without a brand. Its white-label site is not deleted. This can't be undone.")}
      </ConfirmDialog>

      <AlertDialog
        open={!!deleteErrors}
        title={t('DELETE_BRAND_ERROR_TITLE', "The brand wasn't deleted")}
        content={deleteErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteErrors(null)}
      />

      <ConfirmDialog
        open={!!discard}
        title={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          const go = discard?.go
          keepingRef.current = false
          setDiscard(null)
          resetDraft()
          go?.()
        }}
        onCancel={() => {
          keepingRef.current = true
          setDiscard(null)
        }}
        finalFocus={() => {
          const field = lastFieldRef.current
          const keep = keepingRef.current
          keepingRef.current = false
          return keep && field?.isConnected ? field : true
        }}
      >
        {t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

export const BusinessBrandListing = (props) => {
  const businessBrandListingProps = {
    ...props,
    UIComponent: BusinessBrandListingUI
  }
  return <BusinessBrandListingController {...businessBrandListingProps} />
}
