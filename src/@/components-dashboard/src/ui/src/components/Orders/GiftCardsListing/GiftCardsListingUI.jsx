import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useLanguage } from '../../../../../index'
import { buildSettingsPath } from '../../../../../utils/settingsRedirects'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { addQueryToUrl } from '../../../utils'
import { CreditCard, Menu as MenuIcon, Settings } from '../../Shared/Icon'
import { Button, IconButton, PageHeader, Pagination, SearchField, Tabs } from '../../Shared/Product'
import { GiftCardsCatalog } from '../../Loyalty/GiftCards'
import { GiftCardsTable } from './GiftCardsTable'
import { hasError, lastPageOf, pageSizeOptions } from './giftCardData'
import './gift-cards.css'

// redesign GC-B (GC-01…GC-04, GC-14, GC-16 | D1, D8, D9, D10): the gift cards page. A header (title, count, «Gift card settings»,
// «Set up gift cards»), the status tabs and the search, the table (GiftCardsTable) and the pagination. The controller
// (K/GiftCardsList) owns the data and the page; this owns what the person sees of it: the tab and the page in the URL (as main), the
// search (it waits 750ms after the last key, as main's SearchBar lazyLoad), the catalog sheet (the lote C's GiftCardsCatalog), the
// way back from a page past the end and the focus.
// `Orders/GiftCardsListing` (index.js) mounts it as the UIComponent of the controller.

// Search: main's SearchBar waited this long after the last key before asking the API
const SEARCH_WAIT_MS = 750

// The status tabs, in the order they are drawn
const STATUS_TABS = ['pending', 'activated']

const plural = (count, one, other) => (count === 1 ? one : other)
const plain = (template, count) => template.replace('_count_', () => String(count))

// «Showing _from_–_to_ of _total_» → the numbers become .odc-figure nodes (decision 11)
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

// GC-02: after «Retry» the error state goes away; the focus goes to the list (tried over a few frames: the DOM settles late)
const focusList = (getFrame) => {
  let frames = 0
  const step = () => {
    frames++
    const target = getFrame()?.querySelector('.odc-table-scroll, ul[role="list"]')
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      return
    }
    if (frames < 30) nextFrame(step)
  }
  nextFrame(step)
}

export const GiftCardsListingUI = (props) => {
  const {
    giftCards,
    paginationProps,
    activeStatus,
    setActiveStatus,
    getGiftCards,
    searchValue,
    onSearch,
    reload,
    isUseQuery
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()
  const defaultStatus = new URLSearchParams(location.search).get('status')

  const list = giftCards?.list ?? []
  const loading = Boolean(giftCards?.loading)
  const failed = hasError(giftCards?.error)
  const currentPage = paginationProps?.currentPage
  const pageSize = paginationProps?.pageSize
  const totalPages = paginationProps?.totalPages
  const totalItems = paginationProps?.totalItems

  const frameRef = useRef(null)
  const searchRef = useRef(null)
  const setupRef = useRef(null)

  // ---- the tab: `?status=` as main (a value that is not a tab, like `sent`, goes to the API as it is; D9) ----
  const handleChangeStatus = (status) => {
    setActiveStatus(status)
    if (isUseQuery) addQueryToUrl({ status })
  }

  useEffect(() => {
    if (!isUseQuery) return
    if (defaultStatus) {
      setActiveStatus(defaultStatus)
      return
    }
    addQueryToUrl({ status: 'pending' })
  }, [])

  // ---- the page and its size in the URL, as main ----
  useEffect(() => {
    if (!isUseQuery || !currentPage || !pageSize || !totalPages) return
    addQueryToUrl({ page: currentPage, pageSize })
  }, [currentPage, pageSize, totalPages])

  // ---- GC-16 (audit F7): a page past the end comes back empty with a total; ask for the last page once, never say «empty» ----
  const outOfRange = !loading && !failed && list.length === 0 && Number.isFinite(Number(totalItems)) && Number(totalItems) > 0
  const askKey = `${activeStatus}|${searchValue ?? ''}|${totalItems}|${pageSize}`
  const askedRef = useRef(null)
  const recovering = outOfRange && askedRef.current !== askKey
  useEffect(() => {
    if (loading) return
    if (list.length > 0 || failed) {
      askedRef.current = null
      return
    }
    if (!outOfRange || askedRef.current === askKey) return
    askedRef.current = askKey
    getGiftCards(lastPageOf(totalItems, pageSize), pageSize)
  }, [loading, list.length, failed, totalItems, pageSize, activeStatus, searchValue])

  // ---- the search: it waits for the last key; clearing is immediate ----
  const [draft, setDraft] = useState(searchValue ?? '')
  const searchTimer = useRef(null)
  const searchNow = useRef(searchValue)
  searchNow.current = searchValue
  // The value can change from outside (the empty state's «Clear search»): the box follows. What was just sent from the box is the
  // trimmed draft, which must not eat a space the person is still typing.
  useEffect(() => {
    if (searchTimer.current === null) setDraft(previous => (previous.trim() === String(searchValue ?? '') ? previous : String(searchValue ?? '')))
  }, [searchValue])
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const sendSearch = (text) => {
    searchTimer.current = null
    const next = text.trim()
    // the controller reloads on every change of the value: ask only when it is another search
    if (next !== String(searchNow.current ?? '')) onSearch(next)
  }
  const handleSearchChange = (text) => {
    setDraft(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => sendSearch(text), SEARCH_WAIT_MS)
  }
  const handleSearchClear = () => {
    clearTimeout(searchTimer.current)
    setDraft('')
    sendSearch('')
  }
  const clearSearchFromEmptyState = () => {
    handleSearchClear()
    searchRef.current?.focus() // the button goes away with the empty state; the focus goes to the search
  }

  // ---- the catalog ("Set up gift cards"): the button and `?setup=1` (command palette) open it; closing gives the focus back ----
  const [showCatalog, setShowCatalog] = useState(false)
  // redesign GC-D (R5): who opened it. The button is the opener the sheet gives the focus back to; with `?setup=1` (⌘K) there is none.
  const openedByButton = useRef(false)
  const openCatalog = () => {
    openedByButton.current = true
    setShowCatalog(true)
  }
  useOpenFromQuery('setup', () => {
    openedByButton.current = false
    setShowCatalog(true)
  })
  const closeCatalog = () => {
    const viaButton = openedByButton.current
    setShowCatalog(false)
    // The sheet returns the focus to what opened it. With the button that is the button. With `?setup=1` there is no opener: the
    // sheet hands the focus to the first link of the document («Skip to content»), which is not lost, so «lost» is not the test
    // there: the button takes it. (R5)
    nextFrame(() => nextFrame(() => {
      const active = document.activeElement
      if (!viaButton || !active || active === document.body) setupRef.current?.focus()
    }))
  }

  // redesign GC-D (R2): «Look in Redeemed / Pending» drops the empty state, and the button with it, once the other tab loads: the
  // focus goes to the tab that was chosen (the tabs are in the order of `STATUS_TABS`), never to <body>.
  const tabsRef = useRef(null)
  const handleLookIn = (status) => {
    handleChangeStatus(status)
    const tab = tabsRef.current?.querySelectorAll('[role="tab"]')[STATUS_TABS.indexOf(status)]
    tab?.focus()
  }

  const retry = () => {
    reload?.()
    focusList(() => frameRef.current)
  }

  // ---- the header ----
  const known = !loading && !failed && totalItems !== null && totalItems !== undefined && Number.isFinite(Number(totalItems))
  const count = known ? Number(totalItems) : undefined
  const countLabel = known
    ? plain(plural(count, t('GIFT_CARDS_COUNT_ONE', '_count_ gift card'), t('GIFT_CARDS_COUNT_OTHER', '_count_ gift cards')), count)
    : undefined
  const setupLabel = t('SETUP_GIFT_CARDS', 'Set up gift cards')
  const settingsLabel = t('GIFT_CARD_SETTINGS', 'Gift card settings')

  return (
    <div ref={frameRef} className='odc-root odc-gc-frame'>
      <div className='odc-gc-header'>
        <PageHeader
          leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
          title={t('GIFT_CARD_MANAGER', 'Gift card manager')}
          count={count}
          countLabel={countLabel}
          // D8: a link to the settings hub, not an editor
          actions={(
            <Link
              className='odc-btn'
              data-variant='ghost'
              data-size='md'
              title={settingsLabel}
              to={buildSettingsPath({ group: 'payments', category: 'addon_gift_cards' })}
            >
              <Settings className='odc-icon' />
              <span data-collapse-label=''>{settingsLabel}</span>
            </Link>
          )}
          primaryAction={(
            <Button ref={setupRef} variant='primary' icon={CreditCard} title={setupLabel} onClick={openCatalog}>
              <span data-collapse-label=''>{setupLabel}</span>
            </Button>
          )}
        />
        <div ref={tabsRef} className='odc-gc-toolbar'>
          {/* GC-14: real tabs, not buttons with aria-pressed */}
          <Tabs
            label={t('GIFT_CARD_STATUS', 'Gift card status')}
            value={activeStatus}
            onValueChange={handleChangeStatus}
            items={[
              { value: STATUS_TABS[0], label: t('ORDER_PENDING', 'Pending') },
              { value: STATUS_TABS[1], label: t('REDEEMED', 'Redeemed') }
            ]}
          />
          <div className='odc-gc-search'>
            <SearchField
              value={draft}
              onChange={handleSearchChange}
              onClear={handleSearchClear}
              inputRef={searchRef}
              label={t('GIFT_CARDS_SEARCH', 'Search by code, buyer or recipient')}
              placeholder={t('GIFT_CARDS_SEARCH', 'Search by code, buyer or recipient')}
              clearLabel={t('CLEAR_SEARCH', 'Clear search')}
            />
          </div>
        </div>
      </div>
      <GiftCardsTable
        cards={list}
        loading={loading || recovering}
        error={giftCards?.error}
        status={activeStatus}
        searchValue={searchValue}
        pageSize={pageSize}
        onClearSearch={clearSearchFromEmptyState}
        onLookIn={handleLookIn}
        onRetry={retry}
      />
      {/* redesign GC-D (R1, R2): the page field gives back the jump to a page that main's page buttons had. The foot is not unmounted
          while a page loads (the button just pressed would go with it and the focus would fall to <body>): it stays `busy`. It is
          hidden only with a failure, an empty list or the first load (no data yet). */}
      {!failed && !recovering && list.length > 0 && (
        <div className='odc-gc-foot'>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={totalItems}
            pageSizeOptions={pageSizeOptions(pageSize)}
            onPageChange={(page) => getGiftCards(page, pageSize)}
            onPageSizeChange={(size, page) => getGiftCards(page, size)}
            busy={loading}
            showPageInput
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            pageLabel={t('PAGE', 'Page')}
            pageOfLabel={(pages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(pages) })}
            rangeLabel={(from, to, total, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(total) })}
            pageStatusLabel={(current, pages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(pages))}
          />
        </div>
      )}
      {showCatalog && <GiftCardsCatalog open onClose={closeCatalog} />}
    </div>
  )
}
