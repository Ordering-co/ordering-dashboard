import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { AdBannersList as AdBannersListController, useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { ConfirmDialog, SplitView } from '../../Shared/Product'
import { BannerPanel } from '../AdBannersDirectory/BannerPanel'
import { BannersHeader } from '../AdBannersDirectory/BannersHeader'
import { BannersSections } from '../AdBannersDirectory/BannersSections'
import { positionByKey } from '../AdBannersDirectory/bannerPositions'
import { useBannerEnabledToggle } from '../AdBannersDirectory/useBannerEnabledToggle'
import '../AdBannersDirectory/ad-banners-page.css'

// redesign AB-B5 (decision 1; defects M-AB05, M-AB06, M-AB10, M-AB11, M-AB17; auditor findings 4, 5 and 8): the ad banners page is the
// header and ONE list of banners grouped by position (Web and App), beside ONE panel (create or view) in a split view, as
// /marketing/campaign. `main` drew six cards that each opened a sidebar per position, each loading its own banners. The controller
// (K/AdBannersList) loads every banner in one request and owns the list; this owns what the person sees of it: the URL (?position,
// ?banner), the banner that is open, the discard guard, the focus, and how an update lands in the list.

// K/BannerDetails runs its load when `banner` changes identity and an empty object means «create»: the empty record must be the
// same object on every render.
const EMPTY = Object.freeze({})
const NO_BANNERS = Object.freeze([])

// redesign AB-B5 (as CampaignListing, CA-R2): after a delete the focus goes to the row that took the deleted banner's place (or, with
// none, the position's «Add banner»), and closing the panel gives it back to the row (also when it was opened by ?banner= and nothing
// had the focus). DataTable's rows (and the cards of the phone list) carry `data-row-id`. The DOM is not ready the moment the
// controller answers, so it is tried on the next frames until it holds, and it leaves alone a focus the person already put somewhere
// in the list. In `takeover` mode (a delete) a focus that sits on a ROW is not the person's choice (the closing dialog and the table's
// tab stop put it there) and is replaced.
const FOCUS_FRAMES = 30
const FOCUS_STABLE_FRAMES = 3
const TAKEOVER_STABLE_FRAMES = 10
const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

const focusableIn = (element) => {
  if (!element) return null
  if (element.hasAttribute('tabindex')) return element
  return element.querySelector('a[href], button, [tabindex]') ?? element
}

const addButtonOf = (frame, positionKey) => (
  positionKey ? frame.querySelector(`section[data-position="${positionKey}"] .odc-banners-section-head button`) : null
)

const focusTargetIn = (frame, id, final, positionKey) => {
  if (!frame) return null
  if (id != null) {
    const row = Array.from(frame.querySelectorAll('[data-row-id]')).find(element => element.getAttribute('data-row-id') === String(id))
    if (row) return focusableIn(row)
    if (!final) return null // the list may not have rendered yet
  }
  const add = addButtonOf(frame, positionKey)
  if (add) return add
  if (!frame.hasAttribute('tabindex')) frame.setAttribute('tabindex', '-1')
  return frame
}

const settleFocusOn = (getFrame, id, { takeover = false, positionKey } = {}) => {
  let frames = 0
  let stable = 0
  const step = () => {
    frames++
    const frame = getFrame()
    const target = focusTargetIn(frame, id, frames >= 4, positionKey)
    if (target) {
      const active = document.activeElement
      if (active === target) {
        stable++
      } else if (
        !active || active === document.body || !active.isConnected || !frame.contains(active) ||
        (takeover && active.closest('[data-row-id]'))
      ) {
        target.focus({ preventScroll: true })
        stable = 0
      } else {
        return // the focus is already on something in the list
      }
      if (stable >= (takeover ? TAKEOVER_STABLE_FRAMES : FOCUS_STABLE_FRAMES)) return
    }
    if (frames < FOCUS_FRAMES) nextFrame(step)
  }
  nextFrame(step)
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// A banner the API (or a create) answered may lack what the list draws (auditor 4): the defaults go in here, once
const withDefaults = (banner) => ({
  ...banner,
  items: banner?.items ?? [],
  business: banner?.business ?? [],
  sites: banner?.sites ?? []
})

export const AdBannersListingUI = (props) => {
  const {
    bannersListState,
    handleUpdateBanner,
    handleSuccessUpdate,
    handleSuccessAdd,
    handleSuccessDelete,
    getAdBanners
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()
  const frameRef = useRef(null)

  const banners = bannersListState?.banners ?? NO_BANNERS
  const loading = Boolean(bannersListState?.loading)
  const error = bannersListState?.error ?? null
  const failed = hasError(error)

  const [search, setSearch] = useState('')

  // The handlers the controller gave THIS render, and the list as it is now: the panel's controller calls the page after an await, with
  // the closures of the render it started in, so every handler below reads these refs instead of what it closed over.
  const latest = useRef({})
  latest.current = { banners, search, handleUpdateBanner, handleSuccessUpdate, handleSuccessAdd, handleSuccessDelete }

  // ---- the banner that is open ----
  // `{ mode: 'new', position, nonce }` | `{ mode: 'view', id }`
  const [panelState, setPanelState] = useState(null)
  const stateRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const successorRef = useRef(undefined) // { id, position }: the row that takes a deleted banner's place, until the panel closes
  const createdRef = useRef(null) // the banner a create just answered, until the panel closes: it is opened instead (decision 2)
  const rowCache = useRef(null) // the last row shown, so a render between a list update and the close never paints nothing
  const show = (next) => {
    stateRef.current = next
    setPanelState(next)
  }

  // The panel always receives the LIST'S current row for the open id, never a copy taken when it opened: the row switch and the panel
  // switch are then the same value (M-AB05, auditor 5)
  const open = panelState?.mode === 'view' ? panelState : null
  const listRow = open ? banners.find(banner => banner.id === open.id) : undefined
  if (listRow) rowCache.current = listRow
  const shownRow = open ? (listRow ?? (rowCache.current?.id === open.id ? rowCache.current : undefined)) : undefined

  // ---- unsaved text in the create form (BannerPanel reports it): another row or «Add banner» asks first ----
  // redesign AB-B5 (decision 17; as CampaignListing's withDraftGuard)
  const draft = useRef(false)
  const [discard, setDiscard] = useState(null) // { go }
  const onDirtyChange = useRef((dirty) => { draft.current = !!dirty }).current
  // redesign (row 49, Q-08): the guard returns the focus to what was focused when it opened (the clicked row), except
  // after «Keep editing», which sends it back to the Name field (first input of the create form's panel body) the person is still typing in
  const guardOpener = useRef(null)
  const keepEditing = useRef(false)
  const withDraftGuard = (go) => {
    if (!draft.current) return go()
    guardOpener.current = document.activeElement
    keepEditing.current = false
    setDiscard({ go })
  }
  const guardFinalFocus = () => {
    if (keepEditing.current) {
      keepEditing.current = false
      const field = document.querySelector('.odc-banners-panel-body input')
      if (field?.isConnected) return field
    }
    const opener = guardOpener.current
    return opener?.isConnected && opener !== document.body ? opener : true
  }

  const openBanner = (row) => {
    draft.current = false
    successorRef.current = undefined
    rowCache.current = row
    show({ mode: 'view', id: row.id })
    // M-AB10: only the params there are values for
    addQueryToUrl(row.position ? { position: row.position, banner: row.id } : { banner: row.id })
  }

  const openRow = (row) => {
    if (stateRef.current?.mode === 'view' && stateRef.current.id === row.id) return
    withDraftGuard(() => openBanner(row))
  }

  const openCreate = (positionKey) => {
    const current = stateRef.current
    // a clean create form of that position that is already open is not replaced by an identical one
    if (current?.mode === 'new' && current.position === positionKey && !draft.current) return
    withDraftGuard(() => {
      draft.current = false
      successorRef.current = undefined
      createdRef.current = null
      // a discarded draft starts over: the panel is a new one
      show({ mode: 'new', position: positionKey, nonce: (stateRef.current?.nonce ?? 0) + 1 })
      removeQueryToUrl(['banner']) // M-AB10: a create has no id; today's code wrote `?banner=undefined`
      addQueryToUrl({ position: positionKey })
    })
  }

  const closePanel = () => {
    const closed = stateRef.current
    if (!closed) return // already closed (the panel closes itself after a delete or a create too)
    // Decision 2: the controller calls onClose after a create. A banner was just created, so «close» means «open it»
    const created = createdRef.current
    if (created && closed.mode === 'new') {
      createdRef.current = null
      openBanner(created)
      return
    }
    draft.current = false
    show(null)
    setExpanded(false)
    removeQueryToUrl(['banner']) // only the banner: the position stays
    const successor = successorRef.current
    successorRef.current = undefined
    if (successor) {
      settleFocusOn(() => frameRef.current, successor.id, { takeover: true, positionKey: successor.position })
    } else if (closed.mode === 'view') {
      settleFocusOn(() => frameRef.current, closed.id, { positionKey: rowCache.current?.position })
    } else {
      settleFocusOn(() => frameRef.current, null, { positionKey: closed.position })
    }
  }

  // ---- what the panel reports back ----
  // Auditor 4: the API's answer to an update may lack `items` or `business`; it is merged into the row the list has, so nothing the
  // list knew is lost (the images of a banner whose name was just saved), and the row is a NEW object, so what shows it redraws
  const mergeIntoList = (updated) => {
    if (!updated || updated.id == null) return
    const { banners: rows, handleSuccessUpdate: update } = latest.current
    const current = rows.find(banner => banner.id === updated.id) ?? {}
    update?.({
      ...current,
      ...updated,
      items: updated.items ?? current.items ?? [],
      business: updated.business ?? current.business ?? []
    })
  }

  const handleAdded = (created) => {
    const row = withDefaults(created)
    createdRef.current = row
    rowCache.current = row
    latest.current.handleSuccessAdd?.(row)
  }

  // The controller calls handleSuccessAdd, then onClose (which opens the banner); the panel then calls onCreated too. Nothing to do if
  // the banner is already open; if the create form is still there, open it.
  const onCreated = (created) => {
    const current = stateRef.current
    if (current?.mode !== 'new') return
    const row = createdRef.current ?? withDefaults(created)
    createdRef.current = null
    openBanner(row)
  }

  const handleDeleted = (bannerId) => {
    const { banners: rows, search: text } = latest.current
    const gone = rows.find(banner => banner.id === bannerId)
    const needle = text.trim().toLocaleLowerCase()
    const sameSection = rows.filter(banner => banner.position === gone?.position && (needle === '' || String(banner.name ?? '').toLocaleLowerCase().includes(needle)))
    const index = sameSection.findIndex(banner => banner.id === bannerId)
    successorRef.current = { id: index === -1 ? null : (sameSection[index + 1]?.id ?? null), position: gone?.position }
    latest.current.handleSuccessDelete?.(bannerId)
  }

  // ---- the switch: one hook, the same handler and pending list for the rows and the panel ----
  // Its failure is told by the AsyncSwitch that was pressed (a row or the panel header): the page renders no dialog for it.
  // The controller changes the row IN PLACE; merging its answer puts a new object in the list, so the panel (which redraws when its
  // row changes identity) never lags behind the row (M-AB05).
  const updateBanner = async (payload, bannerId) => {
    const outcome = await latest.current.handleUpdateBanner?.(payload, bannerId)
    if (outcome?.ok && outcome.result) mergeIntoList({ id: bannerId, ...outcome.result })
    return outcome
  }
  const toggle = useBannerEnabledToggle({ handleUpdateBanner: updateBanner })

  // ---- the URL ----
  // ?banner=<id> opens that banner once the list is there; an id that is not in it goes out of the URL (M-AB11). Once per navigation:
  // closing the panel does not bring it back.
  const query = new URLSearchParams(location.search)
  const bannerParam = query.get('banner')
  const handledParam = useRef(null)
  useEffect(() => {
    if (bannerParam == null || bannerParam === '' || loading || failed) return
    const handled = `${location.key}|${bannerParam}`
    if (handledParam.current === handled) return
    handledParam.current = handled
    const row = banners.find(banner => String(banner.id) === bannerParam)
    if (row) withDraftGuard(() => openBanner(row))
    else removeQueryToUrl(['banner'])
  }, [bannerParam, location.key, loading, failed, banners])

  // ?position=<key> is followed while the page is open (⌘K): the section takes the focus. It no longer opens anything: the position
  // panel is gone (auditor 8).
  const focusPosition = query.get('position') || null

  // ---- what the pieces receive ----
  const known = !loading && !failed
  const listView = (
    <div ref={frameRef} className='odc-root odc-banners-frame'>
      <BannersHeader
        count={known ? banners.length : undefined}
        onCount={known ? banners.filter(banner => banner.enabled).length : undefined}
        onOpenMenu={isCollapse ? () => handleMenuCollapse(false) : undefined}
      />
      <BannersSections
        banners={banners}
        loading={loading}
        error={error}
        onRetry={() => getAdBanners?.()}
        search={search}
        onSearch={setSearch}
        activeId={open?.id ?? null}
        onOpen={openRow}
        onAdd={openCreate}
        toggle={toggle}
        focusPosition={focusPosition}
      />
    </div>
  )

  const creating = panelState?.mode === 'new'
  let panel = null
  if (creating) {
    panel = (
      <BannerPanel
        key={`new-${panelState.nonce}`}
        banner={EMPTY}
        position={positionByKey(panelState.position)}
        onClose={closePanel}
        onCreated={onCreated}
        handleSuccessUpdate={mergeIntoList}
        handleSuccessAdd={handleAdded}
        handleSuccessDelete={handleDeleted}
        toggle={toggle}
        onDirtyChange={onDirtyChange}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
    )
  } else if (shownRow) {
    panel = (
      <BannerPanel
        key={shownRow.id}
        banner={shownRow}
        position={positionByKey(shownRow.position)}
        onClose={closePanel}
        onCreated={onCreated}
        handleSuccessUpdate={mergeIntoList}
        handleSuccessAdd={handleAdded}
        handleSuccessDelete={handleDeleted}
        toggle={toggle}
        onDirtyChange={onDirtyChange}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
    )
  }

  const panelLabel = creating
    ? t('ADD_BANNER', 'Add banner')
    : (shownRow?.name || t('BANNER', 'Banner'))

  return (
    <>
      <SplitView
        className='odc-banners-split'
        list={listView}
        panel={panel}
        open={Boolean(panel)}
        expanded={expanded}
        panelLabel={panelLabel}
        resizeLabel={t('AD_BANNERS_RESIZE_PANEL', 'Resize the banner panel')}
        storageKey='odc-banners-panel'
        onClose={closePanel}
      />

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
        onCancel={() => {
          keepEditing.current = true
          setDiscard(null)
        }}
      >
        {t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

// One request for every position (no `defaultPosition`): the controller loads them all and the page groups them. The page
// wrapper passes no props this UI reads (today's AdBannersListing ignored them too), so none are forwarded.
export const AdBannersListing = () => (
  <AdBannersListController UIComponent={AdBannersListingUI} />
)
