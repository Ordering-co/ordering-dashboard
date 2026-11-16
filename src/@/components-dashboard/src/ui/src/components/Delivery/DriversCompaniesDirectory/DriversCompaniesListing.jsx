import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useLanguage } from '../../../../../index'
import { toAlertContent } from '../../../../../utils/alertContent'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { Menu as MenuIcon, Plus, Trash2 } from '../../Shared/Icon'
import {
  AlertDialog,
  Button,
  ConfirmDialog,
  IconButton,
  PageHeader,
  Pagination,
  SearchField,
  SelectionBar,
  SplitView
} from '../../Shared/Product'
import { CompaniesTable } from './CompaniesTable'
import { CompanyAddPanel } from './CompanyAddPanel'
import { CompanyPanel } from './CompanyPanel'
import { companyName, filterCompanies, isIntegration } from './companyData'
import './drivers-companies-page.css'

// redesign DC-B5 (decisions 1, 2, 5 | M-DC5, M-DC6, M-DC8, M-DC11, M-DC19, M-DC21): the delivery companies page. A header (title,
// count, «Add driver company»), the search, the selection bar, the table (B2) and the pagination, beside the company panel (B3) or
// the add panel (B4) in a split view, as the other redesigned lists of Delivery. The controller (K/DriversCompaniesList) owns the
// data (it loads every company once); this owns what the person sees of it: the search and the page (in the browser, as main), the
// URL (?id, ?tab, ?page, ?pageSize, ?add), the panel, the selection bar, the dialogs and the focus.
// `Delivery/DriversCompaniesListing` mounts it as the UIComponent of the controller.

export const PAGE_SIZES = [10, 25, 50]

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// «_count_ selected» → the number becomes an .odc-figure node (decision 11)
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})
const figure = (value) => <bdi className='odc-figure'>{value}</bdi>
const plain = (template, count) => template.replace('_count_', () => String(count))
const plural = (count, one, other) => (count === 1 ? one : other)

// After a panel closes the focus goes to the row of that company, else to the table (tried over a few frames: the DOM settles late)
const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))
// `fallbacks`: selectors tried in order (the table first; «Add driver company» only when there is no table left)
const focusAfterClose = (getFrame, id, fallbacks) => {
  const fallbackList = Array.isArray(fallbacks) ? fallbacks : [fallbacks]
  let frames = 0
  const step = () => {
    frames++
    const frame = getFrame()
    if (frame) {
      const active = document.activeElement
      const row = id == null ? null : Array.from(frame.querySelectorAll('[data-row-id]')).find(element => element.getAttribute('data-row-id') === String(id))
      // already in the list: left alone (the split view gives the focus back to the row of the company that was open, F1)
      const inList = active && active !== document.body && active.isConnected && frame.contains(active)
      if (inList) return
      const target = (row && (row.hasAttribute('tabindex') ? row : row.querySelector('a[href], button, [tabindex]'))) ||
        (frames >= 4 ? fallbackList.map(selector => frame.querySelector(selector)).find(Boolean) : null)
      if (target) {
        if (!target.hasAttribute('tabindex') && target.matches('.odc-table-scroll, ul[role="list"]')) target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
        return
      }
    }
    if (frames < 30) nextFrame(step)
  }
  nextFrame(step)
}

const CompaniesHeader = ({ count, onAdd, addDisabled, search, onSearch, searchRef }) => {
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const known = count != null && Number.isFinite(Number(count))
  const countLabel = plain(plural(Number(count), t('DRIVERS_COMPANIES_COUNT_ONE', '_count_ company'), t('DRIVERS_COMPANIES_COUNT_OTHER', '_count_ companies')), count)
  const addLabel = t('ADD_DRIVER_COMPANY', 'Add driver company')
  return (
    <div className='odc-dcp-header'>
      <PageHeader
        title={t('DELIVERY_COMPANIES', 'Delivery companies')}
        count={known ? Number(count) : undefined}
        countLabel={known ? countLabel : undefined}
        primaryAction={(
          <Button variant='primary' icon={Plus} title={addLabel} disabled={addDisabled} data-add-company='' onClick={() => onAdd?.()}>
            <span data-collapse-label=''>{addLabel}</span>
          </Button>
        )}
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
      />
      <div className='odc-dcp-search'>
        {/* As main: the list is all in the browser, so the search filters as you type (main's SearchBar waited 750ms) */}
        <SearchField
          value={search}
          onChange={onSearch}
          onClear={() => onSearch('')}
          inputRef={searchRef}
          label={t('SEARCH', 'Search')}
          placeholder={t('SEARCH', 'Search')}
          clearLabel={t('CLEAR_SEARCH', 'Clear search')}
        />
      </div>
    </div>
  )
}

export const DriversCompaniesListingUI = (props) => {
  const {
    isUseQuery,
    driversCompaniesState,
    setDriversCompaniesState,
    actionState,
    handleUpdateDriversCompany,
    selectedCompanyList,
    handleSelectCompany,
    handleAllSelectCompany,
    handleDeleteSelectedCompanies,
    setSelectedCompanyList,
    reloadDriversCompanies,
    actionDisabled = false
  } = props

  const location = useLocation()
  const [, t] = useLanguage()

  const companies = driversCompaniesState?.companies ?? []
  const loading = Boolean(driversCompaniesState?.loading)
  const failed = hasError(driversCompaniesState?.error)
  const selectedIds = selectedCompanyList ?? []

  // ---- search and page, in the browser as main (D/DriversCompaniesList:42-79) ----
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(() => positiveInt(new URLSearchParams(location.search).get('page')) ?? 1)
  const [pageSize, setPageSize] = useState(() => {
    const size = positiveInt(new URLSearchParams(location.search).get('pageSize'))
    return size ?? 10
  })
  const matching = useMemo(() => filterCompanies(companies, search), [companies, search])
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const shown = matching.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const onSearch = (text) => {
    setSearch(text)
    setPage(1) // M-DC5: a search starts at the first page
  }
  useEffect(() => {
    if (!isUseQuery || loading || matching.length === 0) return
    addQueryToUrl({ page: currentPage, pageSize })
  }, [isUseQuery, loading, currentPage, pageSize, matching.length])

  // ---- the company that is open (a row, or just an id: the panel loads it), and the add panel ----
  const [open, setOpen] = useState(() => {
    const id = positiveInt(new URLSearchParams(location.search).get('id'))
    return id == null ? null : { id, row: null }
  })
  const [section, setSection] = useState(() => new URLSearchParams(location.search).get('tab') || undefined)
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const openId = useRef(null)
  openId.current = open?.id ?? null
  const frameRef = useRef(null)
  const searchRef = useRef(null)
  const panelRef = useRef(null)
  const addRef = useRef(null)

  const forgetOpen = () => {
    openId.current = null
    setOpen(null)
    setExpanded(false)
    setSection(undefined)
    removeQueryToUrl(['id', 'tab'])
  }

  const closePanel = () => {
    if (openId.current == null) return
    const closedId = openId.current
    forgetOpen()
    focusAfterClose(() => frameRef.current, closedId, '.odc-table-scroll, ul[role="list"]')
  }

  const closeAdd = () => {
    setAdding(false)
    focusAfterClose(() => frameRef.current, null, '[data-add-company]')
  }

  // Escape, the scrim and the panels' own close end here (a dirty panel asks first, through its guard)
  const closeCurrent = () => (adding ? closeAdd() : closePanel())

  // decision 17 | M-DC17: another company, or the add panel, over a panel with unsaved changes asks first
  const openCompany = (row) => {
    const go = () => {
      if (openId.current !== row.id) {
        setSection(undefined) // another company starts at General
        removeQueryToUrl(['tab'])
      }
      setAdding(false)
      setOpen({ id: row.id, row })
      addQueryToUrl({ id: row.id })
    }
    if (adding && addRef.current) addRef.current.requestClose(go)
    else if (openId.current != null && openId.current !== row.id && panelRef.current) panelRef.current.requestClose(go)
    else go()
  }

  const openAdd = () => {
    if (adding) return
    const go = () => {
      if (openId.current != null) forgetOpen()
      setAdding(true)
    }
    if (openId.current != null && panelRef.current) panelRef.current.requestClose(go)
    else go()
  }

  // `?add=1` (command palette create:driver_company): the same rule as the button
  useOpenFromQuery('add', openAdd, { ready: !actionDisabled })

  const handleSection = (next) => {
    setSection(next)
    addQueryToUrl({ tab: next })
  }

  // M-DC21: a company deleted from its panel leaves the selection too (a later bulk delete would ask for it)
  const onDeleted = (id) => {
    if (selectedIds.includes(id)) setSelectedCompanyList?.(list => list.filter(item => item !== id))
    forgetOpen()
    focusAfterClose(() => frameRef.current, null, '.odc-table-scroll, ul[role="list"]')
  }

  // ---- selection: as main, «Select all» takes every company; the bar says how many of them are not on screen (M-DC19) ----
  // redesign (n.º 10, P-1): an integration (owner_type system) is read only here, so «Select all» skips it
  const shownIds = shown.map(company => company.id)
  const selectableShownIds = shown.filter(company => !isIntegration(company)).map(company => company.id)
  const selectableIds = companies.filter(company => !isIntegration(company)).map(company => company.id)
  const selectedCount = selectedIds.length
  const notShown = selectedIds.filter(id => !shownIds.includes(id)).length
  // review r1 F2: the header box reads the rows on screen (P/DataTable); its press does what it shows. Checked (every selectable row on
  // screen is selected): it clears the selection. Otherwise it selects every company that can be, as main («Select all» of K/DriversCompaniesList).
  const toggleAll = () => {
    const allShownSelected = selectableShownIds.length > 0 && selectableShownIds.every(id => selectedIds.includes(id))
    if (allShownSelected) setSelectedCompanyList?.([])
    else if (selectableIds.length === companies.length) handleAllSelectCompany?.()
    else setSelectedCompanyList?.(selectableIds)
  }

  // ---- bulk delete: C8 «Delete N driver companies?» → the controller deletes them one after the other ----
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    if (!deleting) return
    if (selectedIds.length === 0 || actionState?.error) {
      setDeleting(false)
      if (selectedIds.length === 0) focusAfterClose(() => frameRef.current, null, ['.odc-table-scroll, ul[role="list"]', '[data-add-company]'])
    }
  }, [selectedCompanyList, actionState?.error])
  const confirmDelete = () => {
    setDeleteOpen(false)
    setDeleting(true)
    handleDeleteSelectedCompanies?.()
  }

  // ---- the controller's errors, as main's Alert «Ordering»; what a switch already said under itself is not said twice ----
  const ownErrors = useRef(new Set())
  const [alertContent, setAlertContent] = useState(null)
  useEffect(() => {
    const error = actionState?.error
    if (!error) return undefined
    const key = JSON.stringify(error)
    // the answer and the state can arrive in either order: the decision waits a tick
    const timer = setTimeout(() => {
      if (ownErrors.current.delete(key)) return
      setAlertContent(toAlertContent(error, t('DRIVERS_COMPANIES_ACTION_ERROR', "The action didn't complete. Try again.")))
    }, 0)
    return () => clearTimeout(timer)
  }, [actionState?.error])

  // redesign D-5 (owner, 2026-10-19, C8): turning a company OFF asks first, for the row's switch and the panel's; the
  // switches pass this as AsyncSwitch's `confirmChange`, so Cancel saves nothing and ON never asks
  const { ask, dialog: disableDialog } = useConfirmStep()
  const confirmDisable = (company) => ask({
    title: t('DRIVERS_COMPANIES_DISABLE_TITLE', 'Disable _name_?').replace('_name_', companyName(company, t)),
    body: t('DRIVERS_COMPANIES_DISABLE_BODY', 'New orders are no longer sent to this company until you enable it again.'),
    confirmLabel: t('DRIVERS_COMPANIES_DISABLE_CONFIRM', 'Disable company'),
    tone: 'danger'
  })

  // decision 2 (M-DC2): the switch of a row or of the panel's header: one click to turn ON; it waits for the answer
  const toggleEnabled = async (company, next) => {
    const result = await handleUpdateDriversCompany?.(company.id, { enabled: next })
    if (result && result.ok === false && result.error) ownErrors.current.add(JSON.stringify(result.error))
    return result
  }

  const selectedText = plural(selectedCount, t('DRIVERS_COMPANIES_SELECTED_ONE', '_count_ selected'), t('DRIVERS_COMPANIES_SELECTED_OTHER', '_count_ selected'))
  const notShownText = plural(notShown, t('DRIVERS_COMPANIES_NOT_SHOWN_ONE', '_count_ not shown'), t('DRIVERS_COMPANIES_NOT_SHOWN_OTHER', '_count_ not shown'))
  const deleteTitle = plural(selectedCount, t('DRIVERS_COMPANIES_DELETE_MANY_TITLE_ONE', 'Delete _count_ driver company?'), t('DRIVERS_COMPANIES_DELETE_MANY_TITLE_OTHER', 'Delete _count_ driver companies?'))
  const deleteLabel = plural(selectedCount, t('DRIVERS_COMPANIES_DELETE_ONE', 'Delete company'), t('DRIVERS_COMPANIES_DELETE_MANY', 'Delete companies'))

  const listView = (
    <div ref={frameRef} className='odc-root odc-dcp-frame'>
      <CompaniesHeader
        count={loading || failed ? null : companies.length}
        onAdd={openAdd}
        addDisabled={actionDisabled}
        search={search}
        onSearch={onSearch}
        searchRef={searchRef}
      />
      {selectedCount > 0 && (
        <SelectionBar
          label={t('DRIVERS_COMPANIES_SELECTION_ACTIONS', 'Actions for selected companies')}
          countLabel={(
            <>
              {fill(selectedText, { count: figure(selectedCount) })}
              {notShown > 0 && <> · {fill(notShownText, { count: figure(notShown) })}</>}
            </>
          )}
          clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
          onClear={() => setSelectedCompanyList?.([])}
          busy={deleting}
          actions={(
            <Button data-tone='danger' icon={Trash2} disabled={deleting || actionDisabled} onClick={() => setDeleteOpen(true)}>
              {t('DELETE', 'Delete')}
            </Button>
          )}
        />
      )}
      <CompaniesTable
        companies={shown}
        loading={loading}
        error={driversCompaniesState?.error}
        searchValue={search}
        selectedIds={selectedIds}
        onToggleSelect={handleSelectCompany}
        onToggleAll={toggleAll}
        activeId={open?.id ?? null}
        onOpen={openCompany}
        onToggleEnabled={toggleEnabled}
        confirmDisable={confirmDisable}
        actionDisabled={actionDisabled}
        onAdd={openAdd}
        onClearSearch={() => {
          onSearch('')
          searchRef.current?.focus() // review r1 F3: the button goes away with the empty state; the focus goes to the search
        }}
        onRetry={() => reloadDriversCompanies?.()}
        pageSize={pageSize}
      />
      {!failed && !loading && matching.length > 0 && (
        <div className='odc-dcp-foot'>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={matching.length}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(size, next) => {
              setPageSize(size)
              setPage(next)
            }}
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            rangeLabel={(from, to, total, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(total) })}
            pageStatusLabel={(current, pages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(pages))}
          />
        </div>
      )}
    </div>
  )

  // The list's version of the open company when it has one; else the one we hold
  const shownRow = open ? (companies.find(company => company.id === open.id) ?? open.row) : null

  let panel = null
  if (adding) {
    panel = (
      <CompanyAddPanel
        panelRef={addRef}
        driversCompaniesState={driversCompaniesState}
        setDriversCompaniesState={setDriversCompaniesState}
        onClose={closeAdd}
        onAdded={closeAdd}
      />
    )
  } else if (open) {
    panel = (
      <CompanyPanel
        panelRef={panelRef}
        driversCompaniesState={driversCompaniesState}
        setDriversCompaniesState={setDriversCompaniesState}
        driversCompany={shownRow ?? undefined}
        driversCompanyId={open.id}
        section={section}
        onSectionChange={handleSection}
        expanded={expanded}
        onToggleExpanded={() => setExpanded(value => !value)}
        onClose={closePanel}
        onDeleted={onDeleted}
        onToggleEnabled={toggleEnabled}
        confirmDisable={confirmDisable}
        actionDisabled={actionDisabled}
      />
    )
  }

  return (
    <>
      <SplitView
        className='odc-dcp-split'
        list={listView}
        panel={panel}
        open={Boolean(panel)}
        expanded={expanded && !adding}
        panelLabel={adding ? t('ADD_DRIVER_COMPANY', 'Add driver company') : (shownRow ? companyName(shownRow, t) : t('DRIVER_COMPANY', 'Driver company'))}
        resizeLabel={t('DRIVERS_COMPANIES_RESIZE_PANEL', 'Resize the company panel')}
        storageKey='od.drivers-companies.panel'
        onClose={closeCurrent}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={plain(deleteTitle, selectedCount)}
        confirmLabel={deleteLabel}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      >
        {notShown > 0 && <>{plain(plural(notShown, t('DRIVERS_COMPANIES_DELETE_NOT_SHOWN_ONE', '_count_ of them is not on screen.'), t('DRIVERS_COMPANIES_DELETE_NOT_SHOWN_OTHER', '_count_ of them are not on screen.')), notShown)} </>}
        {t('DRIVERS_GROUPS_CANT_UNDO', "This can't be undone.")}
      </ConfirmDialog>

      {disableDialog}

      <AlertDialog
        open={Boolean(alertContent)}
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertContent ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setAlertContent(null)}
      />
    </>
  )
}
