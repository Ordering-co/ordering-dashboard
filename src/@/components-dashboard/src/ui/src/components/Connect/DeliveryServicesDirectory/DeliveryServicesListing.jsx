import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useConfig, useLanguage } from '../../../../../index'
import { toAlertContent } from '../../../../../utils/alertContent'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { focusTargetIn, settleFocusOn } from '../../../utils/listFocus'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { Menu as MenuIcon } from '../../Shared/Icon'
import {
  AlertDialog,
  IconButton,
  PageHeader,
  Pagination,
  SearchField,
  SplitView
} from '../../Shared/Product'
import { getDeliveryServiceSetupError } from '../deliveryServiceSetupError'
import { ProviderPanel } from './ProviderPanel'
import { ProvidersTable } from './ProvidersTable'
import { groupOf, providerName, providerStatus, statusFamily, statusLabel } from './providerData'
import './delivery-services-page.css'

// redesign DS-B4 (decisions 1, 3, 4, 6, 7, 17 | M-DS1, M-DS5, M-DS7, M-DS10, M-DS21): the delivery services page. A header (title, count,
// the menu button of a collapsed sidebar) and the search, the table (B2) and the foot, beside the provider panel (B3) in a split view
// (as /delivery/drivers-groups). The controller (K/DeliveryServices) owns the data; this owns what the person sees of it: the URL
// (?id, ?tab, ?page, ?pageSize), the provider that is open and the checks to open it, the guard, the pages (client side, as main), Install,
// the dialogs and the focus. `Connect/DeliveryServices` mounts it as the UIComponent of the controller.
//
// What this page does not do: it asks for nothing. The configs dictionary comes from useConfig() (the row's status is computed from it),
// the stores from the controller's one `drivergroups` request, the group of a provider from `getDeliveryGroups` when it is opened.

export const PAGE_SIZES = [10, 25, 50]
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0]

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// «Showing _from_–_to_ of _total_» → the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// The switch of a provider writes ONLY `enabled`: that is the failure the switch says under itself
const isSwitchChange = (changes) => {
  const keys = Object.keys(changes ?? {})
  return keys.length === 1 && keys[0] === 'enabled'
}

export const DeliveryServicesListingUI = (props) => {
  const {
    isUseQuery,
    deliveryServicesState,
    setDeliveryServicesState,
    businessesList,
    paymethodsList,
    actionState,
    scheduleState,
    groupsInfo,
    deliveryGroups,
    setDeliveryGroups,
    actionDisabled,
    handleUpdateDeliveryService,
    handleScheduleState,
    resetScheduleState,
    handleInstallSysPlugin,
    handleInstallDeliveryService,
    reloadDeliveryServices,
    reloadGroupsInfo,
    getDeliveryGroups
  } = props

  const location = useLocation()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [configState] = useConfig()

  const companies = deliveryServicesState?.companies ?? []
  const failed = hasError(deliveryServicesState?.error)
  // a reload that keeps the providers keeps the rows (Install, Retry after a first load): skeletons only when there is nothing to show
  const listLoading = Boolean(deliveryServicesState?.loading) && companies.length === 0
  const configs = configState?.configs
  const configsLoading = Boolean(configState?.loading)

  // ---- search and pages: all on the client, as main (the API answers every provider at once) ----
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(() => positiveInt(new URLSearchParams(location.search).get('page')) ?? 1)
  const [pageSize, setPageSize] = useState(() => {
    const size = positiveInt(new URLSearchParams(location.search).get('pageSize'))
    return PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE
  })

  // redesign DS-B4 (M-DS7): the search is the name, as main; a new search starts at the first page
  const needle = search.trim().toLowerCase()
  const filtered = needle ? companies.filter(company => String(company?.name ?? '').toLowerCase().includes(needle)) : companies
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages) // ?page=99 is the last page, never an empty table
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const changeSearch = (text) => {
    setSearch(text)
    setPage(1)
  }

  // ?page and ?pageSize, as the list wrote them, once there are providers to put in pages (an empty first render must not overwrite them)
  const hasRows = filtered.length > 0
  useEffect(() => {
    if (!isUseQuery || listLoading || failed || !hasRows) return
    addQueryToUrl({ page: currentPage, pageSize })
  }, [isUseQuery, listLoading, failed, hasRows, currentPage, pageSize])

  // ---- the provider that is open: its id and the group of the panel (the row of the list plus the group's plugin and schedule) ----
  const [open, setOpen] = useState(null) // { id, group }
  const [section, setSection] = useState(undefined) // raw ?tab=: the panel resolves it
  const [expanded, setExpanded] = useState(false)
  const openId = useRef(null)
  openId.current = open?.id ?? null
  const openSeq = useRef(0)
  const frameRef = useRef(null)
  const panelRef = useRef(null)

  // ---- the dialog: main's Alert «Ordering». One content at a time ----
  const [alertContent, setAlertContent] = useState(null)
  const actionFallback = () => t('DELIVERY_SERVICES_ACTION_ERROR', "The action didn't complete. Try again.")

  // ---- what the person's own switch and Install already said are not said again by the dialog ----
  // The controller leaves the error of a failed action in `actionState.error` AND returns it. A failed switch says it under itself;
  // a failed Install is shown here from its answer. The state and the answer can arrive in either order: the decision waits a tick.
  const ownErrors = useRef(new Set())
  const noteOwnError = (result) => {
    if (result && result.ok === false && result.error) ownErrors.current.add(JSON.stringify(result.error))
  }
  useEffect(() => {
    const error = actionState?.error
    if (!error || (Array.isArray(error) && error.length === 0)) return undefined
    const key = JSON.stringify(error)
    const timer = setTimeout(() => {
      if (ownErrors.current.delete(key)) return
      setAlertContent(toAlertContent(error, actionFallback()))
    }, 0)
    return () => clearTimeout(timer)
  }, [actionState?.error])

  // redesign DS-B4 (M-DS1, M-DS5): the switch of a row and the one of the panel go through here, with the id of THE PROVIDER they belong to
  const updateService = async (id, changes) => {
    const result = await handleUpdateDeliveryService?.(id, changes)
    if (isSwitchChange(changes)) noteOwnError(result)
    return result
  }

  // redesign D-5 (owner, 2026-10-19): pausing a provider asks first (decision 25, C8): it cuts service. ONE dialog for the row
  // switch and the one of the panel: both get `confirmPause(company)` and hand it to AsyncSwitch's `confirmChange` (resuming never asks).
  // «Cancel» (or Close, or Escape) is `false`: nothing is written and the switch stays where it was.
  const { ask: askToConfirm, dialog: confirmDialog } = useConfirmStep()
  const confirmPause = (target) => {
    const name = providerName(target)
    return askToConfirm({
      title: t('DELIVERY_SERVICES_PAUSE_TITLE', 'Pause _name_?').replace('_name_', name),
      body: t('DELIVERY_SERVICES_PAUSE_BODY', 'New orders stop going to _name_ until you resume it.').replace('_name_', name),
      confirmLabel: t('DELIVERY_SERVICES_PAUSE_CONFIRM', 'Pause provider'),
      tone: 'danger'
    })
  }

  // ---- open (decision 6, auditor 3/4): the checks of main, then the group, then the panel ----
  const showNotice = (scenario, target) => setAlertContent(getDeliveryServiceSetupError(target, scenario, t))
  // a failed open that nothing else holds leaves the address clean: the link would show the notice again at every reload (M-DS21)
  const failOpen = () => {
    if (openId.current == null) removeQueryToUrl(['id', 'tab'])
  }

  const openProvider = (target, { tab } = {}) => {
    if (!target) return
    if (openId.current === target.id) {
      if (tab !== undefined) setSection(tab)
      return
    }
    if (!target.plugin_id) {
      showNotice('plugin_not_installed', target)
      failOpen()
      return
    }
    const groupId = groupOf(target)?.id
    if (!groupId) {
      showNotice('driver_group_missing', target)
      failOpen()
      return
    }
    const go = async () => {
      const seq = ++openSeq.current // the last request wins: a slow answer of another provider must not open over this one
      const group = await getDeliveryGroups?.(groupId)
      if (seq !== openSeq.current) return
      if (!group?.id) {
        showNotice('driver_group_load_failed', target)
        failOpen()
        return
      }
      const changed = openId.current !== target.id
      openId.current = target.id
      setOpen({ id: target.id, group: { ...group, plugin: target.plugin, schedule: target.schedule } })
      if (changed) setSection(tab) // another provider starts at Credentials (nothing in ?tab=)
      addQueryToUrl({ id: target.id })
      if (changed && tab === undefined) removeQueryToUrl(['tab'])
    }
    // redesign DS-B4 (decision 17): another provider over a panel with unsaved changes asks first
    if (openId.current != null && panelRef.current) panelRef.current.requestClose(go)
    else go()
  }

  const closePanel = () => {
    if (openId.current == null) return // already closed
    const closedId = openId.current
    openId.current = null
    openSeq.current++ // an answer still on its way must not reopen it
    setOpen(null)
    setExpanded(false)
    setSection(undefined)
    removeQueryToUrl(['id', 'tab']) // the panel's whole address
    settleFocusOn(() => frameRef.current, closedId)
    returnFocusToClosedRow(closedId)
  }

  // redesign DS-R1-05: the panel gives the focus back to the control that had it when it OPENED (SplitView's opener), which after a switch
  // by mouse (Uber → Shipday → X) is the row of the first provider; settleFocusOn leaves a focus that is already in the list alone.
  // So, in the first frames after closing, a focus that sits on the row of ANOTHER provider moves to the row that was closed.
  const returnFocusToClosedRow = (closedId) => {
    const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))
    let frames = 0
    const step = () => {
      frames++
      const list = frameRef.current
      const staleRow = document.activeElement?.closest?.('[data-row-id]')
      if (list && staleRow && list.contains(staleRow) && staleRow.getAttribute('data-row-id') !== String(closedId)) {
        const target = focusTargetIn(list, closedId, false)
        if (target) {
          target.focus({ preventScroll: true })
          return
        }
      }
      if (frames < 6) nextFrame(step)
    }
    nextFrame(step)
  }

  // redesign DS-B4 (M-DS21): ?id= is applied each time the address changes (also a ⌘K link while this page is on screen) as soon as there
  // are providers; not each time the providers change (a switch, an install), which would reopen what was closed
  const query = new URLSearchParams(location.search)
  const urlId = positiveInt(query.get('id'))
  const urlTab = query.get('tab') || undefined
  const hasCompanies = companies.length > 0
  useEffect(() => {
    if (urlId == null || !hasCompanies) return
    const target = companies.find(company => company?.id === urlId)
    if (!target) {
      // a link to a provider that is not in the list says so (as /connect/pos-menu?id= does) and the address is cleaned,
      // instead of an id that stays in the URL and nothing on screen. A panel that is open is left alone.
      setAlertContent(t('DELIVERY_SERVICES_PROVIDER_NOT_FOUND', "Sorry, we couldn't find this provider."))
      failOpen()
      return
    }
    openProvider(target, { tab: urlTab })
  }, [location.key, urlId, hasCompanies])

  // redesign DS-R1-01 (follow-up): the address went to this page WITHOUT `?id=` while a panel is open and the page did not cause it (⌘K to
  // «Delivery services», the Back button). Our own open, switch and close write the address with replaceState, which the router never sees,
  // so a new router location is always somebody else's. The panel closes through the same guard as the X: clean → it closes (id and tab go);
  // dirty → the guard asks. The address is put back first (`?id=` of the open provider, and its tab), so it agrees with the panel while the
  // question is open and after «Keep editing»; closing takes it away again.
  useEffect(() => {
    const current = openId.current
    if (urlId != null || current == null || !panelRef.current) return
    addQueryToUrl(section ? { id: current, tab: section } : { id: current })
    panelRef.current.requestClose(closePanel)
  }, [location.key])

  const handleSection = (next) => {
    setSection(next)
    addQueryToUrl({ tab: next })
  }

  // ---- Install (decision 4): POST /plugins, then the list again; the page is not reloaded ----
  const [installingId, setInstallingId] = useState(null)
  const installProvider = async (target) => {
    setInstallingId(target.id)
    // (row 27, delivery-services P-9, D-39 (a)): the installed provider's record opens on Credentials, once the busy state is
    // cleared (the `finally`). A record without a group does not open: openProvider would answer with the driver_group_missing dialog.
    let installedRecord = null
    // (review L7): the wait can be long (the controller polls up to ~15 s). What was open when the install started (usually none),
    // and the opens begun since, are remembered: if the person opened another provider (or one is still loading) meanwhile, it is not replaced.
    const openedAtStart = openId.current
    const openSeqAtStart = openSeq.current
    try {
      // main: the controller installs and waits until the provider is linked, then puts the new list (and its groups) in
      // place: no second request here. A failure is in actionState, which the dialog already shows. Without plugin_root the
      // controller's handleInstallSysPlugin answers why (below).
      if (handleInstallDeliveryService && target.plugin_root) {
        const { installed, company: installedCompany } = await handleInstallDeliveryService(target)
        if (installed && installedCompany && groupOf(installedCompany)?.id) installedRecord = installedCompany
        return { ok: !!installed }
      }
      const result = await handleInstallSysPlugin?.(target.plugin_root)
      if (result?.ok) {
        // the controller asks for the stores of the new list by itself (K/DeliveryServices.getDeliveryServices)
        await reloadDeliveryServices?.()
      } else if (result) {
        setAlertContent(toAlertContent(result.error, actionFallback()))
        // with a plugin_root the controller also left the error in actionState: it is already shown. Without it, it did not touch it.
        if (target.plugin_root) noteOwnError(result)
      }
      return result
    } finally {
      setInstallingId(null)
      if (installedRecord && openId.current === openedAtStart && openSeq.current === openSeqAtStart) openProvider(installedRecord)
    }
  }

  // ---- the header: title and count, then the search ----
  const known = !failed && !listLoading
  const countLabel = filtered.length === 1
    ? t('DELIVERY_SERVICES_COUNT_ONE', '1 provider')
    : t('DELIVERY_SERVICES_COUNT_OTHER', '_count_ providers').replace('_count_', filtered.length)

  const listView = (
    <div ref={frameRef} className='odc-root odc-dsl-frame'>
      <div className='odc-dsl-header'>
        <PageHeader
          title={t('CONNECT_DELIVERY_SERVICES', 'Delivery services')}
          count={known ? filtered.length : undefined}
          countLabel={known ? countLabel : undefined}
          leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        />
        <div className='odc-dsl-filters'>
          <div className='odc-dsl-search'>
            <SearchField
              value={search}
              onChange={changeSearch}
              onClear={() => changeSearch('')}
              label={t('SEARCH', 'Search')}
              placeholder={t('SEARCH', 'Search')}
              clearLabel={t('CLEAR_SEARCH', 'Clear search')}
            />
          </div>
        </div>
      </div>
      <ProvidersTable
        companies={visible}
        groupsInfo={groupsInfo}
        configs={configs}
        configsLoading={configsLoading}
        actionDisabled={Boolean(actionDisabled)}
        activeId={open?.id ?? null}
        onOpen={target => openProvider(target)}
        onToggle={(target, next) => updateService(target.id, { enabled: next })}
        confirmPause={confirmPause}
        onInstall={installProvider}
        installingId={installingId}
        loading={listLoading}
        error={deliveryServicesState?.error}
        onRetry={() => reloadDeliveryServices?.()}
        searchValue={search}
        onClearSearch={() => changeSearch('')}
        pageSize={pageSize}
      />
      {known && (
        <div className='odc-dsl-foot'>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(size, nextPage) => {
              setPageSize(size)
              setPage(nextPage)
            }}
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
    </div>
  )

  // ---- the panel: the company fresh from the controller's state (its header switch reads `enabled`), and its status like the list's ----
  const shown = open ? companies.find(company => company?.id === open.id) : null
  let statusProps = {}
  if (shown && !(configsLoading && shown.plugin_id && groupOf(shown))) {
    const status = providerStatus(shown, { configs })
    statusProps = { statusLabel: statusLabel(status, t), statusFamily: statusFamily(status) }
  }

  const panel = shown
    ? (
      // redesign DS-B4: the key makes each provider a new panel (a late answer of the previous one cannot land in the next)
      <ProviderPanel
        key={shown.id}
        company={shown}
        {...statusProps}
        panelRef={panelRef}
        deliveryServicesState={deliveryServicesState}
        setDeliveryServicesState={setDeliveryServicesState}
        scheduleState={scheduleState}
        curDriversGroup={open.group}
        deliveryServiceId={shown.id}
        driverGroupId={open.group.id}
        businesses={businessesList?.businesses}
        businessesLoading={businessesList?.loading}
        paymethods={paymethodsList?.paymethods}
        handleUpdateDeliveryService={updateService}
        confirmPause={confirmPause}
        handleScheduleState={handleScheduleState}
        resetScheduleState={resetScheduleState}
        actionDisabled={actionDisabled}
        deliveryGroups={deliveryGroups}
        setDeliveryGroups={setDeliveryGroups}
        section={section}
        onSectionChange={handleSection}
        expanded={expanded}
        onToggleExpanded={() => setExpanded(value => !value)}
        onClose={closePanel}
        onStoresChanged={() => reloadGroupsInfo?.()} // redesign DS-R1-02
      />
      )
    : null

  return (
    <>
      <SplitView
        className='odc-dsl-split'
        list={listView}
        panel={panel}
        open={Boolean(panel)}
        expanded={expanded}
        panelLabel={shown ? providerName(shown) : t('DELIVERY_SERVICE', 'Delivery service')}
        resizeLabel={t('DELIVERY_SERVICES_RESIZE_PANEL', 'Resize the provider panel')}
        storageKey='od.delivery-services.panel'
        onClose={closePanel}
      />

      <AlertDialog
        open={Boolean(alertContent)}
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertContent ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        returnFocus={() => focusTargetIn(frameRef.current, openId.current, true)} // redesign DS-R1-06: a notice with no origin (a link) lands on the open row or the list
        onClose={() => setAlertContent(null)}
      />
      {confirmDialog}
    </>
  )
}
