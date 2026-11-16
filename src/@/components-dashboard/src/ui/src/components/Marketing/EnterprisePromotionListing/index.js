import React, { useEffect, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage, EnterprisePromotionList as EnterprisePromontioListController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { LearnDropDown } from '../../Shared'
import { Button, ConfirmDialog, IconButton, PageHeader, SplitView, Tabs } from '../../Shared/Product'
import { Menu as MenuIcon, Plus } from '../../Shared/Icon'
import { EnterprisePromotionList } from '../EnterprisePromotionList'
import { EnterprisePromotionDetails } from '../EnterprisePromotionDetails'
import { PromotionSearch } from '../PromotionsDirectory/PromotionSearch'
import { PromotionJourneysListingUI } from '../PromotionJourneysListing'
import {
  getPromotionWorkspaceView,
  JOURNEY_VIEWS,
  setPromotionWorkspaceView
} from '../PromotionJourneysListing/journeyUtils'
import { addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '../../../utils'
import { focusableIn } from '../../../utils/listFocus'
import './promotions-page.css'

// redesign PE-B2 (decisions 1, 2, 3, 4, 5, 8, 9; PE-03, PE-09, PE-14, PE-15): the promotions page. It is a header (title, count, Learn and, in
// Advanced, «Add promotion»), the two views as tabs, and under them the view: Quick offers (its own page, PE-B4) or Advanced offers, a
// list beside ONE panel (the editor of PE-B3) in a split view, as the campaigns page. The controller (K/EnterprisePromotionList) owns the
// data; this owns what the person sees of it: the URL (?view, ?id, ?add, ?page, ?pageSize), the promotion that is open, the search box, the
// confirmation of a delete from the list and the guard of unsaved changes.

// The editor re-runs its load when `promotion` changes (it compares the JSON); an empty object means «add» or «load by id»
const NO_RECORD = {}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// Lines of text out of what the API left as an error: a string, a list of strings or a list of lists
const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error.flat(Infinity) : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

// A count in the number format of the person's language («1,240» in English)
const formatCount = (value, locale) => {
  const options = { maximumFractionDigits: 0 }
  try {
    return new Intl.NumberFormat(locale || undefined, options).format(Number(value) || 0)
  } catch (error) {
    return new Intl.NumberFormat(undefined, options).format(Number(value) || 0)
  }
}

// ---- Advanced offers: the list beside its panel ----
const EnterprisePromotionListingUI = (props) => {
  const {
    searchValue,
    onSearch,
    promotionListState,
    paginationProps,
    handleSuccessUpdatePromotions,
    handleSuccessAddPromotion,
    sitesState,
    paymethodsState,
    businessesList,
    businessesPaginationProps,
    searchBusinesses,
    getAllBusinessIds,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    handleSuccessDeletePromotion,
    handleDeletePromotionFromList,
    registerOpenAdd,
    registerLeaveGuard,
    addButtonRef
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()

  const promotions = promotionListState?.promotions ?? []
  const loading = Boolean(promotionListState?.loading)

  // ---- the first load: until it has ended the table shows its skeleton, and `?add=1` waits (inventory D18) ----
  const seenLoading = useRef(false)
  const [finishedLoading, setFinishedLoading] = useState(false)
  useEffect(() => {
    if (loading) seenLoading.current = true
    else if (seenLoading.current) setFinishedLoading(true)
  }, [loading])
  // a list that was already loaded when this view mounted (the person came from Quick offers) has its totals or its error
  const loadedOnce = finishedLoading || (!loading && (hasError(promotionListState?.error) || paginationProps?.totalItems != null || promotions.length > 0))

  // ---- the promotion that is open: a row, just an id (?id=, the panel loads it) or a new one ----
  // `{ mode: 'new', nonce }` | `{ mode: 'view', id, promotion }`
  const [panelState, setPanelState] = useState(null)
  const stateRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const show = (next) => {
    stateRef.current = next
    setPanelState(next)
  }

  // ---- unsaved changes in the editor (it reports them): opening another row, «Add promotion» or `?add=1` asks first ----
  const draft = useRef(false)
  const [discard, setDiscard] = useState(null) // { go }
  const onDirtyChange = useRef((dirty) => { draft.current = !!dirty }).current
  // redesign (review F-5): who asked, so «Keep editing» can send the focus back. A tab that was pressed and not selected (the
  // change did not happen) hands it to the tab that still is
  const guardOpener = useRef(null)
  const withDraftGuard = (go) => {
    if (!draft.current) return go()
    guardOpener.current = document.activeElement
    setDiscard({ go })
  }
  const guardFinalFocus = () => {
    const opener = guardOpener.current
    if (opener?.isConnected && opener.getAttribute('role') === 'tab' && opener.getAttribute('aria-selected') !== 'true') {
      const selected = opener.closest('[role="tablist"]')?.querySelector('[role="tab"][aria-selected="true"]')
      if (selected) return selected
    }
    return true
  }

  const handleCloseDetails = () => {
    if (!stateRef.current) return // already closed (the editor closes itself after a delete too)
    draft.current = false
    show(null)
    setExpanded(false)
    removeQueryToUrl(['id'])
  }

  const handleOpenDetails = (promotion) => {
    if (!promotion) return openCreate()
    if (stateRef.current?.mode === 'view' && stateRef.current.id === promotion.id) return
    withDraftGuard(() => {
      draft.current = false
      show({ mode: 'view', id: promotion.id, promotion })
      addQueryToUrl({ id: promotion.id })
    })
  }

  // Add mode has no id: a stale `?id=` of the row that was open goes, and a clean add panel that is already open is not replaced
  function openCreate () {
    if (stateRef.current?.mode === 'new' && !draft.current) return
    withDraftGuard(() => {
      draft.current = false
      show({ mode: 'new', nonce: (stateRef.current?.nonce ?? 0) + 1 }) // a discarded draft starts over: the panel is a new one
      setExpanded(false)
      removeQueryToUrl(['id'])
    })
  }

  // redesign (row 81, review r1 R9; PE-16): the tabs live in the page above this view, so the view lends them its guard: leaving
  // for Quick offers with unsaved changes in the panel asks first, as another row does
  useEffect(() => {
    registerLeaveGuard?.(withDraftGuard)
    return () => registerLeaveGuard?.(null)
  })

  // the header's «Add promotion» lives in the page above this view: it asks this view to open the panel
  useEffect(() => {
    registerOpenAdd?.(openCreate)
    return () => registerOpenAdd?.(null)
  })

  // `?add=1` (command palette) opens the add form like the button, once the first load has finished
  useOpenFromQuery('add', openCreate, { ready: !loading && loadedOnce })

  // `?id=` opens that promotion, whatever page it is on (the panel loads it). It is applied once per value: the router's location does not
  // follow `removeQueryToUrl`, so after the panel is closed the same `?id=` must not open it again at the next load of the list.
  const idParam = query.get('id')
  const appliedId = useRef(null)
  useEffect(() => {
    if (loading || !idParam) return
    const id = Number(idParam)
    if (!Number.isFinite(id)) return
    const found = promotions.find(promotion => promotion.id === id)
    if (appliedId.current !== idParam) {
      appliedId.current = idParam
      show({ mode: 'view', id, promotion: found })
      return
    }
    // the first answer of the list can come after the panel opened (a fresh load): the panel gets the list's record
    const open = stateRef.current
    if (open?.mode === 'view' && open.id === id && !open.promotion && found) show({ ...open, promotion: found })
  }, [loading, idParam])

  // ---- delete from the row menu (decision 9, PE-07): the confirmation names the promotion; the reason of a failure stays inside it ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // ---- where the focus goes once a promotion is gone or added (redesign , row 20b) ----
  // A delete takes the row that opened the panel or the row menu with it, and an add opened by `?add=1` or the command palette has no
  // opener, so the focus used to fall to <body>. Once the dialog lets it go: the row that took the deleted one's place, else the one
  // above, else «Add promotion», else the title. A focus the person already put somewhere else is theirs.
  const frameRef = useRef(null)
  const [focusAfter, setFocusAfter] = useState(null) // { kind: 'delete', id, index } | { kind: 'add' }
  useEffect(() => {
    if (!focusAfter) return undefined
    let frames = 0
    let frame = 0
    const target = () => {
      const page = frameRef.current?.closest('.odc-promo-page')
      if (focusAfter.kind === 'delete') {
        const rows = Array.from(frameRef.current?.querySelectorAll('[data-row-id]') ?? [])
          .filter(row => row.getAttribute('data-row-id') !== String(focusAfter.id))
        const row = [rows[focusAfter.index], rows[focusAfter.index - 1]].find(Boolean)
        if (row) return focusableIn(row)
      }
      const add = addButtonRef?.current
      if (add?.isConnected && !add.disabled) return add
      const title = page?.querySelector('h1')
      if (title && !title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1')
      return title
    }
    const settle = () => {
      frames++
      const active = document.activeElement
      const inDialog = !!active?.closest?.('[role="dialog"], [role="alertdialog"]')
      // the focus can sit, for a frame or two, on the row that is about to go (the panel or the menu hands it back to its opener)
      const onGone = focusAfter.id != null && active?.closest?.('[data-row-id]')?.getAttribute('data-row-id') === String(focusAfter.id)
      const lost = !active || active === document.body || !active.isConnected
      if ((inDialog || onGone) && frames < 60) {
        frame = window.requestAnimationFrame(settle)
        return
      }
      if (!lost && !onGone && !inDialog) return setFocusAfter(null) // not ours to move
      if (focusAfter.kind === 'add' && stateRef.current) return setFocusAfter(null) // the panel stayed open: it keeps its own focus
      setFocusAfter(null)
      target()?.focus()
    }
    frame = window.requestAnimationFrame(settle)
    return () => window.cancelAnimationFrame(frame)
  }, [focusAfter])

  // the panel's own delete and add tell the list first (its controller), then close the panel
  const indexOf = id => promotions.findIndex(promotion => promotion.id === id)
  const handlePanelDeleted = (id) => {
    setFocusAfter({ kind: 'delete', id, index: indexOf(id) })
    handleSuccessDeletePromotion?.(id)
  }
  const handlePanelAdded = (promotion) => {
    setFocusAfter({ kind: 'add' })
    handleSuccessAddPromotion?.(promotion)
  }

  const askDelete = (promotion) => {
    setDeleteTarget(promotion)
    setDeleteErrors(null)
    setDeleteOpen(true)
  }
  const cancelDelete = () => { if (!deleting) setDeleteOpen(false) }
  const confirmDelete = async () => {
    if (deleting || !deleteTarget) return
    setDeleting(true)
    setDeleteErrors(null)
    let result
    try {
      result = await handleDeletePromotionFromList?.(deleteTarget)
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return
    setDeleting(false)
    if (result?.ok) {
      setFocusAfter({ kind: 'delete', id: deleteTarget.id, index: indexOf(deleteTarget.id) })
      setDeleteOpen(false)
      // the promotion that was open in the panel no longer exists
      if (stateRef.current?.mode === 'view' && stateRef.current.id === deleteTarget.id) handleCloseDetails()
    } else {
      setDeleteErrors(errorLines(result?.error, t('PROMOTION_DELETE_ERROR', "We couldn't delete this promotion. Try again.")))
    }
  }

  // ---- what the pieces receive ----
  const open = panelState?.mode === 'view' ? panelState : null
  const creating = panelState?.mode === 'new'

  const listView = (
    <div className='odc-root odc-promo-frame' ref={frameRef}>
      <EnterprisePromotionList
        toolbar={<PromotionSearch search={searchValue || ''} onSearch={onSearch} />}
        {...props}
        activeId={open?.id ?? null}
        handleOpenDetails={handleOpenDetails}
        onDelete={askDelete}
        loadedOnce={loadedOnce}
      />
    </div>
  )

  const panel = panelState && (
    <EnterprisePromotionDetails
      key={creating ? `new-${panelState.nonce}` : panelState.id}
      sitesState={sitesState}
      businessesList={businessesList}
      businessesPaginationProps={businessesPaginationProps}
      searchBusinesses={searchBusinesses}
      getAllBusinessIds={getAllBusinessIds}
      handleChangeBusinessPage={handleChangeBusinessPage}
      handleChangeBusinessPageSize={handleChangeBusinessPageSize}
      paymethodsState={paymethodsState}
      promotion={creating ? NO_RECORD : (panelState.promotion || NO_RECORD)}
      promotionId={creating ? undefined : panelState.id}
      promotionsList={promotions}
      handleSuccessUpdatePromotions={handleSuccessUpdatePromotions}
      handleSuccessAddPromotion={handlePanelAdded}
      handleSuccessDeletePromotion={handlePanelDeleted}
      onClose={handleCloseDetails}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onDirtyChange={onDirtyChange}
    />
  )

  const panelLabel = creating
    ? t('ADD_PROMOTION', 'Add promotion')
    : ((open?.promotion?.name) || t('PROMOTION', 'Promotion'))

  const deleteName = deleteTarget?.name ?? ''

  return (
    <>
      <SplitView
        className='odc-promo-split'
        list={listView}
        panel={panel}
        open={Boolean(panelState)}
        expanded={expanded}
        panelLabel={panelLabel}
        resizeLabel={t('PROMOTION_RESIZE_PANEL', 'Resize the promotion panel')}
        storageKey='odc-promotion-panel'
        onClose={handleCloseDetails}
      />

      <ConfirmDialog
        open={deleteOpen}
        tone='danger'
        title={t('PROMOTION_DELETE_TITLE', 'Delete "_name_"?').replace('_name_', () => deleteName)}
        confirmLabel={t('PROMOTION_DELETE_CONFIRM', 'Delete promotion')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      >
        {t('PROMOTION_DELETE_BODY', "This can't be undone.")}
        {deleteErrors && (
          <p role='alert' className='odc-promo-list-delete-error'>
            {deleteErrors.map(line => translateApiMessage(t, line, line)).join(' ')}
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!discard}
        title={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          const go = discard?.go
          setDiscard(null)
          draft.current = false
          go?.()
        }}
        finalFocus={guardFinalFocus}
        onCancel={() => setDiscard(null)}
      >
        {t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

// ---- the page: header and tabs, then the view ----
const PromotionWorkspaceUI = (props) => {
  const history = useHistory()
  const location = useLocation()
  const [languageState, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const selectedView = props.selectedView
  const advanced = selectedView === JOURNEY_VIEWS.ADVANCED
  const learnOptions = learnOptionsValues(['advanced_offers'], t)
  // the header's «Add promotion» is answered by the Advanced view, which owns the panel
  const openAdd = useRef(null)
  const registerOpenAdd = useRef((open) => { openAdd.current = open }).current
  // redesign (row 81, R9): the guard of unsaved changes of the view on screen. Owner decision 22 B (2026-10-21, T-1): Quick
  // offers lends its builder's guard too, so Quick → Advanced asks before it drops the typing (main and Advanced → Quick already asked)
  const leaveGuard = useRef(null)
  const registerLeaveGuard = useRef((guard) => { leaveGuard.current = guard }).current
  // redesign (row 20b): where the focus lands when a delete or an add leaves nothing to return to
  const addButtonRef = useRef(null)

  const changeView = (view, promotionId) => {
    const currentSearch = window.location.search || location.search
    history.push({
      pathname: location.pathname,
      search: setPromotionWorkspaceView(currentSearch, view, promotionId)
    })
  }

  const total = props.paginationProps?.totalItems
  const known = total != null && total !== '' && Number.isFinite(Number(total))
  const shown = known ? formatCount(total, languageState?.language?.code) : null
  const countLabel = Number(total) === 1
    ? t('PROMOTIONS_COUNT_ONE', '_count_ promotion').replace('_count_', () => shown)
    : t('PROMOTIONS_COUNT_OTHER', '_count_ promotions').replace('_count_', () => shown ?? String(total))

  return (
    // bugs H review R-1: the shell's <main id='main-content'> already holds the page (#76a)
    <div className='odc-root odc-promo-page' data-testid='promotion-workspace' data-view={selectedView}>
      {/* the opener is PageHeader's `leading`; `odc-promo-head` keeps the page margins on the header itself */}
      <PageHeader
        className='odc-promo-head'
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        title={t('PROMOTIONS', 'Promotions')}
        count={known ? shown : undefined}
        countLabel={known ? countLabel : undefined}
        learn={<LearnDropDown learnOptions={learnOptions} />}
        primaryAction={advanced
          ? (
            <Button ref={addButtonRef} variant='primary' icon={Plus} title={t('ADD_PROMOTION', 'Add promotion')} onClick={() => openAdd.current?.()}>
              <span data-collapse-label=''>{t('ADD_PROMOTION', 'Add promotion')}</span>
            </Button>
            )
          : undefined}
      />
      <div className='odc-promo-tabs'>
        <Tabs
          label={t('PROMOTION_WORKSPACE', 'Promotion workspace')}
          value={selectedView}
          onValueChange={view => (leaveGuard.current ? leaveGuard.current(() => changeView(view)) : changeView(view))}
          items={[
            { value: JOURNEY_VIEWS.JOURNEYS, label: t('QUICK_OFFERS', 'Quick offers') },
            { value: JOURNEY_VIEWS.ADVANCED, label: t('ADVANCED_OFFERS', 'Advanced offers') }
          ]}
        />
      </div>
      <div className='odc-promo-body'>
        {advanced
          ? <EnterprisePromotionListingUI {...props} registerOpenAdd={registerOpenAdd} registerLeaveGuard={registerLeaveGuard} addButtonRef={addButtonRef} />
          : (
            <PromotionJourneysListingUI
              {...props}
              registerLeaveGuard={registerLeaveGuard}
              onOpenAdvancedPromotion={promotion => {
                const open = () => changeView(JOURNEY_VIEWS.ADVANCED, promotion?.id)
                return leaveGuard.current ? leaveGuard.current(open) : open()
              }}
            />
            )}
      </div>
    </div>
  )
}

export const EnterprisePromotionListing = (props) => {
  const location = useLocation()
  const selectedView = getPromotionWorkspaceView(location.search)
  const query = new URLSearchParams(location.search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const enterprisePromotionsProps = {
    ...props,
    selectedView,
    orderBy: selectedView === JOURNEY_VIEWS.JOURNEYS ? '-id' : undefined,
    UIComponent: PromotionWorkspaceUI,
    paginationSettings: {
      initialPage: props.isUseQuery && selectedView === JOURNEY_VIEWS.ADVANCED && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && selectedView === JOURNEY_VIEWS.ADVANCED && !isNaN(defaultPageSize) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    },
    isSearchByPromotionName: true,
    isSearchByPromotionDescription: true
  }

  return <EnterprisePromontioListController key={selectedView} {...enterprisePromotionsProps} />
}
