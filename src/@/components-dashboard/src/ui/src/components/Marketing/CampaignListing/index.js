import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { CampaignListing as CampaignListingController, useLanguage, useSession } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { settleFocusOn } from '../../../utils/listFocus'
import { AlertDialog, ConfirmDialog, SplitView } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { CampaignOpensDialog } from '../CampaignDirectory/CampaignOpensDialog'
import { CampaignPanel } from '../CampaignDirectory/CampaignPanel'
import { CampaignsFilters } from '../CampaignDirectory/CampaignsFilters'
import { CampaignsHeader } from '../CampaignDirectory/CampaignsHeader'
import { CampaignColumnManager, CampaignsTable, useCampaignColumns } from '../CampaignDirectory/CampaignsTable'
import { useCampaignEnabledToggle } from '../CampaignDirectory/useCampaignEnabledToggle'
import '../CampaignDirectory/campaigns-page.css'

// redesign CA-B7 (decisions 1-4): the campaigns page is a header (title, count, Refresh, New campaign), the filter bar and the table,
// beside ONE panel (create or view) in a split view, as /users/customers and /orders. The controller (K/CampaignListing) owns the data;
// this owns what the person sees of it: the URL (?id, ?add, ?page, ?pageSize), the campaign that is open, the status-switch alert, the
// opens dialog, the hidden columns and the focus. The search is not in the URL (as before).

// K/CampaignDetail re-runs its load when `campaign` changes identity, and an empty object means «create» (or «load by id»): the empty
// record must be the same object on every render.
const NO_RECORD = {}

// LF-1: the focus after a delete or a close is `settleFocusOn` (utils/listFocus), with `takeover` and `emptyTarget` for a delete
// (it was a local copy here, CA-R2 M2; promoted in and now used from there).

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

export const CampaignListingUI = (props) => {
  const {
    isUseQuery,
    campaignList,
    paginationProps,
    filterValues,
    searchValue,
    getCampaignList,
    setFilterValues,
    handleChangeSearch,
    handleUpdateCampaign,
    handleSuccessAddCampaign,
    handleSuccessUpdateCampaign,
    handleSuccessDeleteCampaign
  } = props

  const [, t] = useLanguage()
  const [sessionState] = useSession()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()

  const campaigns = campaignList?.campaigns ?? []
  const loading = !!campaignList?.loading
  const currentPage = paginationProps?.currentPage
  const pageSize = paginationProps?.pageSize
  const frameRef = useRef(null)

  // ---- the campaign that is open: a row, just an id (?id=, the panel loads it) or a new one ----
  // `{ mode: 'new' }` | `{ mode: 'view', id, campaign }`
  const [panelState, setPanelState] = useState(null)
  const stateRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  // The row that will take a deleted campaign's place, until the panel closes (K/CampaignDetail deletes, then closes)
  const successorRef = useRef(undefined)
  const show = (next) => {
    stateRef.current = next
    setPanelState(next)
  }

  const open = panelState?.mode === 'view' ? panelState : null
  // The list's own version of the open campaign when it has one (a switch changed it); else the one we hold (it may have left the list)
  const listRow = open ? campaigns.find(campaign => campaign.id === open.id) : undefined
  const shownCampaign = open && Object.keys(open.campaign).length > 0 ? (listRow ?? open.campaign) : NO_RECORD

  // ---- unsaved changes in the create form (CampaignPanel reports them): opening another row, «New campaign» or `?add=1` asks first ----
  // redesign CA-B7 (M-CA11; as CustomersListing's withDraftGuard)
  const draft = useRef(false)
  const [discard, setDiscard] = useState(null) // { go }
  const onDirtyChange = useRef((dirty) => { draft.current = !!dirty }).current
  const withDraftGuard = (go) => (draft.current ? setDiscard({ go }) : go())

  // redesign CA-R2 (M2): the page header's «New campaign» (the first one in the frame; the empty state repeats it) takes the focus when a delete leaves no row
  const newCampaignButton = (frame) => {
    const label = t('CAMPAIGNS_NEW', 'New campaign')
    return Array.from(frame.querySelectorAll('button')).find(button => button.getAttribute('title') === label) ?? null
  }

  const closePanel = () => {
    const closed = stateRef.current
    if (!closed) return // already closed (the panel closes itself after a delete or a create too)
    draft.current = false
    show(null)
    setExpanded(false)
    removeQueryToUrl(['id', 'tab']) // `tab` of an old link goes too
    const deleted = successorRef.current !== undefined
    const focusId = deleted ? successorRef.current : (closed.id ?? null)
    successorRef.current = undefined
    // redesign CA-R2 (M2): after a delete the successor row takes the focus even from the table's tab stop; with no row left, «New campaign»
    settleFocusOn(() => frameRef.current, focusId, deleted ? { takeover: true, emptyTarget: newCampaignButton } : undefined)
  }

  const openCampaign = (campaign) => withDraftGuard(() => {
    draft.current = false
    successorRef.current = undefined
    show({ mode: 'view', id: campaign.id, campaign })
    addQueryToUrl({ id: campaign.id })
  })

  // Add mode has no id: don't write `id=undefined`
  const openCreate = () => {
    // a clean create panel that is already open is not replaced by an identical one
    if (stateRef.current?.mode === 'new' && !draft.current) return
    withDraftGuard(() => {
      draft.current = false
      successorRef.current = undefined
      show({ mode: 'new', nonce: (stateRef.current?.nonce ?? 0) + 1 }) // a discarded draft starts over: the panel is a new one
      setExpanded(false)
      removeQueryToUrl(['id'])
    })
  }

  // `?add=1` (command palette) opens the add form like the button
  useOpenFromQuery('add', openCreate)

  // ?id= opens that campaign on mount, whatever its status and whatever page it is on (the panel loads it); `?tab=` of an old link is ignored
  useEffect(() => {
    const id = positiveInt(new URLSearchParams(location.search).get('id'))
    if (id != null) show({ mode: 'view', id, campaign: NO_RECORD })
  }, [])

  // ---- the status switch: one hook, its alert and its «turn on» confirmation once, the same handler and pending list for the table and the panel ----
  const toggle = useCampaignEnabledToggle({ handleUpdateCampaign })
  const lastAlert = useRef(null)
  if (toggle.alert) lastAlert.current = toggle.alert // the text stays while the dialog fades out
  const alert = toggle.alert ?? lastAlert.current

  // ---- the opens dialog: the campaign stays while it fades out ----
  const [opens, setOpens] = useState({ campaign: null, open: false })
  const openOpens = (campaign) => setOpens({ campaign, open: true })

  // ---- the columns the person hid (the table is controlled, so the choice outlives its re-renders) ----
  // CM-1: the choice lives here because the manager is in the filter bar and the table draws the result. A phone has cards, no
  // columns, so no manager.
  const columnsState = useCampaignColumns()
  const isPhone = useIsPhone()

  // ---- what the panel reports back ----
  const handleDeleted = (campaignId) => {
    const index = campaigns.findIndex(campaign => campaign.id === campaignId)
    successorRef.current = index === -1 ? null : (campaigns[index + 1]?.id ?? campaigns[index - 1]?.id ?? null)
    handleSuccessDeleteCampaign?.(campaignId)
  }

  // ---- the URL: ?page and ?pageSize after each load ----
  useEffect(() => {
    if (!isUseQuery || !currentPage || !pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({ page: currentPage, pageSize })
  }, [isUseQuery, currentPage, pageSize, paginationProps?.totalPages])

  // A page left empty (its campaigns were deleted) asks again: the same page, or the one before when it was the last
  useEffect(() => {
    const totalPages = paginationProps?.totalPages
    if (loading || campaignList?.error || campaigns.length > 0 || !(totalPages > 1)) return
    getCampaignList?.(currentPage !== totalPages ? currentPage : currentPage - 1, pageSize)
  }, [campaignList?.campaigns, paginationProps])

  // ---- filters ----
  const changes = filterValues?.clear ? {} : (filterValues?.changes ?? {})
  const channels = Array.isArray(changes.contact_type) ? changes.contact_type : []
  const audiences = Array.isArray(changes.audience_type) ? changes.audience_type : []
  const search = searchValue || ''
  const hasFilters = Boolean(search) || channels.length > 0 || audiences.length > 0
  const clearAll = () => {
    setFilterValues?.({ clear: true, changes: {} })
    if (search) handleChangeSearch?.('')
  }

  const reload = () => getCampaignList?.(currentPage ?? 1, pageSize ?? 10)

  // ---- what the pieces receive ----
  const supportUrl = sessionState?.user?.level === 0 ? 'https://www.ordering.co/support/' : undefined

  const listView = (
    <div ref={frameRef} className='odc-root odc-campaign-frame'>
      <CampaignsHeader
        count={paginationProps?.totalItems}
        onNew={openCreate}
        onRefresh={reload}
        refreshing={loading}
        supportUrl={supportUrl}
        onOpenMenu={isCollapse ? () => handleMenuCollapse(false) : undefined}
      />
      <CampaignsFilters
        search={search}
        onSearch={handleChangeSearch}
        values={{ contact_type: channels, audience_type: audiences }}
        onChange={(next) => setFilterValues?.({ changes: next })}
        onClear={clearAll}
        tools={isPhone ? undefined : <CampaignColumnManager state={columnsState} />}
      />
      <CampaignsTable
        campaigns={campaigns}
        loading={loading}
        error={campaignList?.error}
        onRetry={reload}
        activeId={open?.id ?? null}
        onOpen={openCampaign}
        onOpenOpens={openOpens}
        toggle={toggle}
        pagination={paginationProps}
        onPageChange={(page) => getCampaignList?.(page, pageSize)}
        onPageSizeChange={(size, page) => getCampaignList?.(page, size)}
        hasFilters={hasFilters}
        onClearFilters={clearAll}
        onNew={openCreate}
        columnsState={columnsState}
      />
    </div>
  )

  const creating = panelState?.mode === 'new'
  const panel = panelState && (
    <CampaignPanel
      key={creating ? `new-${panelState.nonce}` : panelState.id}
      onDirtyChange={onDirtyChange}
      campaign={creating ? NO_RECORD : shownCampaign}
      campaignId={creating ? null : panelState.id}
      campaignList={campaignList}
      handleSuccessAddCampaign={handleSuccessAddCampaign}
      handleSuccessUpdateCampaign={handleSuccessUpdateCampaign}
      handleSuccessDeleteCampaign={handleDeleted}
      toggle={toggle}
      onOpenOpens={openOpens}
      onClose={closePanel}
      expanded={expanded}
      onExpandedChange={setExpanded}
    />
  )

  const panelLabel = creating
    ? t('CAMPAIGNS_NEW', 'New campaign')
    : ((listRow ?? open?.campaign)?.name || t('CAMPAIGN', 'Campaign'))

  return (
    <>
      <SplitView
        className='odc-campaign-split'
        list={listView}
        panel={panel}
        open={Boolean(panelState)}
        expanded={expanded}
        panelLabel={panelLabel}
        resizeLabel={t('CAMPAIGNS_RESIZE_PANEL', 'Resize the campaign panel')}
        storageKey='odc-campaign-panel'
        onClose={closePanel}
      />

      {/* One instance of the alert of the status switch for the table and the panel */}
      <AlertDialog
        open={!!toggle.alert}
        title={alert?.title ?? ''}
        content={alert?.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => toggle.alert?.close()}
      />

      {/* redesign D-6 (owner, 2026-10-19): the confirmation of turning a campaign ON, once, for the table and the panel */}
      {toggle.dialog}

      <CampaignOpensDialog
        campaign={opens.campaign}
        open={opens.open}
        onOpenChange={(next) => { if (!next) setOpens(current => ({ ...current, open: false })) }}
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
        onCancel={() => setDiscard(null)}
      >
        {t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

export const CampaignListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const campaignListingProps = {
    ...props,
    UIComponent: CampaignListingUI,
    isSearchByContactType: true,
    isSearchByName: true,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      // redesign CA-B7 (inventory 1.5): the page size was gated by `defaultPage`; it is gated by itself
      pageSize: props.isUseQuery && !isNaN(defaultPageSize) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }
  return <CampaignListingController {...campaignListingProps} />
}
