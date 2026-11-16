import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useLanguage, useSession } from '../../../../../index'
import { toAlertContent } from '../../../../../utils/alertContent'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { learnOptionsValues } from '../../../utils/learnOptionsValues'
import { Menu as MenuIcon, Plus, Trash2 } from '../../Shared/Icon'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import {
  AlertDialog,
  Button,
  ConfirmDialog,
  IconButton,
  InlineNotice,
  PageHeader,
  Pagination,
  RecordPanel,
  SearchField,
  SelectionBar,
  SplitView,
  useSplitView
} from '../../Shared/Product'
import { DriversGroupAddForm } from '../DriversGroupAddForm'
import { GroupPanel } from './GroupPanel'
import { GroupsTable } from './GroupsTable'
import { groupName } from './groupData'
import { discardTexts } from './groupSections'
import './drivers-groups-page.css'

// redesign DG-B5 (decisions 1, 5, 6, 17 | M-DG1, M-DG6, M-DG8, M-DG14, M-DG15): the delivery groups page. A header (title, count, Learn,
// «Add driver group»), the search, the selection bar, the table (B3) and the foot, beside the group panel (B4) in a split view (as
// /delivery/drivers-list). The controller (K/DriversGroupsList) owns the data; this owns what the person sees of it: the URL (?id, ?tab,
// ?config, ?page, ?pageSize, ?add), the group that is open, the add panel, the guard, the selection bar, the dialogs and the focus.
// `Delivery/DriversGroupsListing` mounts it as the UIComponent of the controller.
//
// What the add form (`D/DriversGroupAddForm`) must give this page, and today does not: its controller (K/DriversGroupDetails) keeps the
// pending values in `changesState` and starts with ~25 defaults, so «the form changed» can only be told by comparing with them.
// `onChangesStateChange(changesState)` is the opt-in callback this page passes; the form has to call it from an effect on `changesState`
// (the file is not in this lot). Until it does, the add panel never reports a change and Cancel/close do not ask (as main, which never asked).

export const PAGE_SIZES = [10, 25, 50]

// The wait before the search text reaches the controller, as the search of main (`SearchBar lazyLoad`): each change is a request
const SEARCH_DEBOUNCE_MS = 750

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

// Same key for the same values whatever the order they were written in; an undefined value is no value
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const body = Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable(value[key])}`)
    return `{${body.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// «_count_ selected» → the number becomes an .odc-figure node (decision 11) and keeps its direction in RTL
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})
const figure = (value) => <bdi className='odc-figure'>{value}</bdi>
const plain = (template, count) => template.replace('_count_', () => String(count))

// ---- the focus: after a panel closes it goes to the row, and when that is gone to the table (as the other redesigned lists) ----
// The DOM is not ready the moment the controller answers (the list re-renders, the panel and its dialog close and give the focus back),
// so it is tried on the next frames until it holds, and it leaves alone a focus the person already put somewhere in the list.
const FOCUS_FRAMES = 30
const FOCUS_STABLE_FRAMES = 3
const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

const focusableIn = (element) => {
  if (!element) return null
  if (element.hasAttribute('tabindex')) return element
  return element.querySelector('a[href], button, [tabindex]') ?? element
}

// The row of `id`; with no id, or once the rows have had time to arrive, the table's region
const rowOrRegion = (id) => (frame, final) => {
  if (id != null) {
    const row = Array.from(frame.querySelectorAll('[data-row-id]')).find(element => element.getAttribute('data-row-id') === String(id))
    if (row) return focusableIn(row)
    if (!final) return null
  }
  const region = frame.querySelector('.odc-table-scroll, ul[role="list"]') ?? frame
  if (!region.hasAttribute('tabindex')) region.setAttribute('tabindex', '-1')
  return region
}

const addButton = (frame) => frame.querySelector('[data-tour="tour_add_group"]:not(:disabled)')

const settleFocus = (getFrame, find) => {
  let frames = 0
  let stable = 0
  const step = () => {
    frames++
    const frame = getFrame()
    const target = frame ? find(frame, frames >= 4) : null
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

// ---- the header: title and count, Learn, «Add driver group», then the search ----
const GroupsHeader = ({ count, learnOptions, addDisabled, onAdd, search = '', onSearch, notice }) => {
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const known = count != null && Number.isFinite(Number(count))
  const countLabel = Number(count) === 1
    ? t('DRIVERS_GROUPS_COUNT_ONE', '1 group')
    : t('DRIVERS_GROUPS_COUNT_OTHER', '_count_ groups').replace('_count_', count)
  const addLabel = t('ADD_DRIVER_GROUP', 'Add driver group')

  // typed here, sent after a wait (at once on Enter and on clear)
  const [searchText, setSearchText] = useState(search || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  const sentSearch = useRef(search || '')
  sentSearch.current = search || ''
  // a value set from outside («Clear search» of the empty state) shows unless the user is typing
  useEffect(() => {
    if (!search) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(search)
  }, [search])
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

  return (
    <div className='odc-dgp-header'>
      <PageHeader
        className='odc-dgp-head'
        title={t('DELIVERY_GROUPS', 'Delivery groups')}
        count={known ? Number(count) : undefined}
        countLabel={known ? countLabel : undefined}
        learn={<LearnDropDown learnOptions={learnOptions} />}
        primaryAction={(
          // `data-tour` is main's anchor of the delivery tour: not a class
          <Button variant='primary' icon={Plus} data-tour='tour_add_group' title={addLabel} disabled={addDisabled} onClick={() => onAdd?.()}>
            <span data-collapse-label=''>{addLabel}</span>
          </Button>
        )}
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
      />
      <div className='odc-dgp-filters'>
        <div className='odc-dgp-search'>
          <SearchField
            value={searchText}
            onChange={typeSearch}
            onClear={() => sendSearch('')}
            onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
            inputRef={searchInput}
            label={t('SEARCH', 'Search')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
        </div>
      </div>
      {notice}
    </div>
  )
}

// ---- the add panel: «Add new driver group» with the form of main, in the same split view as the groups ----
const AddPanel = React.forwardRef(function AddPanel ({ dirty, onClose, children }, ref) {
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'
  return (
    <RecordPanel
      ref={ref}
      title={t('ADD_NEW_DRIVER_GROUP', 'Add new driver group')}
      closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
      onClose={onClose}
      dirty={dirty}
      {...discardTexts(t)}
    >
      <div className='odc-dgp-add'>{children}</div>
    </RecordPanel>
  )
})

export const DriversGroupsListingUI = (props) => {
  const {
    isUseQuery,
    driversGroupsState,
    setDriversGroupsState,
    driversManagersList,
    businessesList,
    paymethodsList,
    driversList,
    driversCompanyList,
    actionState,
    handleUpdateDriversGroup,
    reloadDriversGroups,
    handleDeleteSelectedGroups,
    selectedGroupList,
    handleSelectGroup,
    actionDisabled,
    pagination,
    setPagination,
    searchValue,
    onSearch,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    businessesPaginationProps
  } = props

  const location = useLocation()
  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const groups = driversGroupsState?.groups ?? []
  const loading = Boolean(driversGroupsState?.loading)
  const failed = hasError(driversGroupsState?.error)
  const selectedIds = selectedGroupList ?? []
  const level = user?.level

  // ---- the group that is open: a row, or just an id (the panel loads it) ----
  const [open, setOpen] = useState(() => {
    const id = positiveInt(new URLSearchParams(location.search).get('id'))
    return id == null ? null : { id, row: null }
  })
  const [section, setSection] = useState(() => new URLSearchParams(location.search).get('tab') || undefined) // raw: the panel resolves it
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const openId = useRef(null)
  openId.current = open?.id ?? null
  const frameRef = useRef(null)
  const panelRef = useRef(null)
  const addRef = useRef(null)
  const learnOptions = learnOptionsValues(['drivers_delivery_groups'], t)

  // ---- the add panel: dirty is «differs from the values the form started with» ----
  // The controller starts with `{}` and fills ~25 defaults in its mount effect: the first report that has values is the baseline.
  const [addDirty, setAddDirty] = useState(false)
  const addBaseline = useRef(null)
  const addSaved = useRef(false)
  const resetAdd = () => {
    addBaseline.current = null
    addSaved.current = false
    setAddDirty(false)
  }
  const reportAddChanges = useCallback((changes) => {
    if (!changes || Object.keys(changes).length === 0) return
    const key = stable(changes)
    if (addBaseline.current == null) {
      addBaseline.current = key
      setAddDirty(false)
      return
    }
    setAddDirty(key !== addBaseline.current)
  }, [])
  // The form tells the list about the group it saved through this setter, and only then (K/DriversGroupDetails.handleAddDriversGroup):
  // that is how a close after a save is told from a Cancel, and only the Cancel asks.
  const addSetGroupsState = useCallback((next) => {
    addSaved.current = true
    return setDriversGroupsState?.(next)
  }, [setDriversGroupsState])

  const closeAdd = (options) => {
    resetAdd()
    setAdding(false)
    if (options?.focus !== false) settleFocus(() => frameRef.current, addButton)
  }
  // the form's own Cancel and its close after saving
  const closeAddForm = () => {
    if (addSaved.current || !addRef.current) closeAdd()
    else addRef.current.requestClose(closeAdd)
  }

  const closePanel = () => {
    if (openId.current == null) return // already closed
    const closedId = openId.current
    openId.current = null
    setOpen(null)
    setExpanded(false)
    setSection(undefined)
    removeQueryToUrl(['id', 'tab', 'config']) // M-DG14: the panel's whole address
    settleFocus(() => frameRef.current, rowOrRegion(closedId))
  }

  // Escape, the scrim and the panel's own close all end here (the panel asks first when it is dirty, through its guard)
  const closeCurrent = () => (adding ? closeAdd() : closePanel())

  // redesign DG-B5 (decision 17 | M-DG15): another group, or the add panel, over a panel with unsaved changes asks first
  // `row` null: the panel loads the group by its id (as with ?id= on arrival)
  const showGroup = (id, row = null) => {
    const changed = openId.current !== id
    if (changed) {
      setSection(undefined) // another group starts at General
      removeQueryToUrl(['tab', 'config'])
    }
    resetAdd()
    setAdding(false)
    setOpen({ id, row })
    addQueryToUrl({ id })
  }
  const openGroup = (row) => {
    const go = () => showGroup(row.id, row)
    if (adding) addRef.current ? addRef.current.requestClose(go) : go()
    else if (openId.current != null && openId.current !== row.id && panelRef.current) panelRef.current.requestClose(go)
    else go()
  }

  // (row 27, drivers-groups P-10, D-39 (a)): a created group opens its record (General, its ?id=) instead of dropping back to the list.
  // It goes straight to showGroup: the group is saved, so the add panel's leave question (openGroup's guard) has nothing to ask. The form
  // already marked the save through addSetGroupsState; the focus is not sent to the Add button, the panel keeps it (SplitView).
  // Review H1: only the id travels. The POST answer may lack the relations the record reads (business, drivers) and broke the page;
  // the panel loads the group by id, as with ?id= on arrival.
  const openCreated = (created) => {
    addSaved.current = true
    closeAdd({ focus: false })
    if (created?.id != null) showGroup(created.id)
  }

  const openAdd = () => {
    if (adding) return
    const go = () => {
      if (openId.current != null) {
        openId.current = null
        setOpen(null)
        setExpanded(false)
        setSection(undefined)
        removeQueryToUrl(['id', 'tab', 'config'])
      }
      resetAdd()
      setAdding(true)
    }
    if (openId.current != null && panelRef.current) panelRef.current.requestClose(go)
    else go()
  }

  // `?add=1` (command palette): same rule as the Add button
  useOpenFromQuery('add', openAdd, { ready: !actionDisabled })

  const handleSection = (next) => {
    setSection(next)
    addQueryToUrl({ tab: next })
  }

  // ---- the address: ?page and ?pageSize after each load, as the list wrote them ----
  useEffect(() => {
    if (!isUseQuery || !pagination?.totalPages) return
    addQueryToUrl({ page: pagination.currentPage, pageSize: pagination.pageSize })
  }, [pagination, pagination?.totalPages])

  // ---- the count: the API's total as of the last load, moved by the groups that left or joined the page since (a delete, an add) ----
  const totalItems = pagination?.totalItems
  const loaded = useRef({ key: null, total: null, length: 0 })
  if (!loading && totalItems != null && loaded.current.key !== pagination) {
    loaded.current = { key: pagination, total: Number(totalItems), length: groups.length }
  }
  const known = totalItems != null && Number.isFinite(Number(totalItems))
  const count = known ? Math.max(0, loaded.current.total + (groups.length - loaded.current.length)) : null

  // redesign DG-B5 (M-DG8): the controller turns `actionDisabled` on for a level 5 session until a group it administers arrives, and
  // leaves it on when there is none. Once the list is in, the reason is said. The check is the controller's own (the administrator of
  // a group is the session), so a session that has a group never sees the notice while the controller's answer is on its way.
  const loadedOk = !loading && !failed && totalItems != null
  const administers = groups.some(group => group?.administrator_id === user?.id)
  const showReadOnlyNotice = level === 5 && Boolean(actionDisabled) && loadedOk && !administers

  // ---- selection (it survives pages and searches, as main) ----
  // The controller only toggles one id at a time, building the next list from the list of ITS render: several toggles in one go would
  // each start from the same list and the last would win. So the header box and «Clear selection» toggle one id now and the rest as
  // each answer arrives.
  const toggleQueue = useRef([])
  useEffect(() => {
    const next = toggleQueue.current.shift()
    if (next !== undefined) handleSelectGroup?.(next)
  }, [selectedGroupList])
  const toggleIds = (ids) => {
    const allIn = ids.length > 0 && ids.every(id => selectedIds.includes(id))
    const flip = allIn ? ids : ids.filter(id => !selectedIds.includes(id))
    if (flip.length === 0) return
    toggleQueue.current = flip.slice(1)
    handleSelectGroup?.(flip[0])
  }
  const selectedCount = selectedIds.length
  const pageIds = groups.map(group => group.id)
  const elsewhere = selectedIds.filter(id => !pageIds.includes(id)).length

  // ---- bulk delete: C8 «Delete N delivery groups?» → the controller deletes them one after the other ----
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    if (!deleting) return
    if (selectedIds.length === 0 || actionState?.error) {
      setDeleting(false)
      if (selectedIds.length === 0) settleFocus(() => frameRef.current, rowOrRegion(groups[0]?.id ?? null)) // the bar is gone with the groups
    }
  }, [selectedGroupList, actionState?.error])
  const confirmDelete = () => {
    setDeleteOpen(false)
    setDeleting(true)
    handleDeleteSelectedGroups?.()
  }

  // ---- the controller's errors, as main's Alert «Ordering». What a switch already said under its own control is not said twice. ----
  const ownErrors = useRef(new Set())
  const noteOwnError = (result) => {
    if (result && result.ok === false && result.error) ownErrors.current.add(JSON.stringify(result.error))
  }
  const [alertContent, setAlertContent] = useState(null)
  useEffect(() => {
    const error = actionState?.error
    if (!error) return undefined
    const key = JSON.stringify(error)
    // the answer and the state can arrive in either order: the decision waits a tick
    const timer = setTimeout(() => {
      if (ownErrors.current.delete(key)) return
      setAlertContent(toAlertContent(error, t('DRIVERS_GROUPS_ACTION_ERROR', "The action didn't complete. Try again.")))
    }, 0)
    return () => clearTimeout(timer)
  }, [actionState?.error])

  // redesign DG-B3 (decision 5): the switch of a row waits for the answer, which B3 turns into «didn't change». The question
  // before turning it off is `confirmDisable` below (D-5); this is only the write
  const toggleEnabled = async (group, next) => {
    const result = await handleUpdateDriversGroup?.(group.id, { enabled: next })
    noteOwnError(result)
    return result
  }

  // redesign D-5 (owner, 2026-10-19; C8): turning a row's switch OFF asks first. The page renders the one dialog; the
  // table calls this before it saves (AsyncSwitch `confirmChange`), so Cancel writes nothing. The panel asks for its own switch.
  const { ask: askConfirm, dialog: confirmDialog } = useConfirmStep()
  const confirmDisable = (group) => askConfirm({
    title: t('DRIVERS_GROUPS_DISABLE_TITLE', 'Disable _name_?').replace('_name_', groupName(group, t)),
    body: t('DRIVERS_GROUPS_DISABLE_BODY', 'New orders are no longer assigned through this group until you enable it again.'),
    confirmLabel: t('DRIVERS_GROUPS_DISABLE_GROUP', 'Disable group'),
    tone: 'danger'
  })

  const selectedText = selectedCount === 1
    ? t('DRIVERS_GROUPS_SELECTED_ONE', '_count_ selected')
    : t('DRIVERS_GROUPS_SELECTED_OTHER', '_count_ selected')
  const elsewhereText = elsewhere === 1
    ? t('DRIVERS_GROUPS_SELECTED_ELSEWHERE_ONE', '_count_ on another page')
    : t('DRIVERS_GROUPS_SELECTED_ELSEWHERE_OTHER', '_count_ on other pages')
  const deleteTitle = selectedCount === 1
    ? t('DRIVERS_GROUPS_DELETE_MANY_TITLE_ONE', 'Delete _count_ delivery group?')
    : t('DRIVERS_GROUPS_DELETE_MANY_TITLE_OTHER', 'Delete _count_ delivery groups?')
  const deleteLabel = selectedCount === 1
    ? t('DRIVERS_GROUPS_DELETE_ONE', 'Delete group')
    : t('DRIVERS_GROUPS_DELETE_MANY', 'Delete groups')

  const currentPage = pagination?.currentPage
  const pageSize = pagination?.pageSize

  // ---- what the pieces receive ----
  const listView = (
    <div ref={frameRef} className='odc-root odc-dgp-frame'>
      <GroupsHeader
        count={count}
        learnOptions={learnOptions}
        addDisabled={Boolean(actionDisabled)}
        onAdd={openAdd}
        search={searchValue || ''}
        onSearch={onSearch}
        notice={showReadOnlyNotice
          ? (
            <InlineNotice tone='info'>
              {t('DRIVERS_GROUPS_READONLY_NOTICE', 'You can edit the groups you manage. Ask an admin to make you the manager of a group.')}
            </InlineNotice>
            )
          : undefined}
      />
      {selectedCount > 0 && (
        <SelectionBar
          label={t('DRIVERS_GROUPS_SELECTION_ACTIONS', 'Actions for selected groups')}
          countLabel={(
            <>
              {fill(selectedText, { count: figure(selectedCount) })}
              {elsewhere > 0 && <> · {fill(elsewhereText, { count: figure(elsewhere) })}</>}
            </>
          )}
          clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
          onClear={() => toggleIds(selectedIds)}
          busy={deleting}
          actions={(
            <Button data-tone='danger' icon={Trash2} disabled={deleting || Boolean(actionDisabled)} onClick={() => setDeleteOpen(true)}>
              {t('DELETE', 'Delete')}
            </Button>
          )}
        />
      )}
      <GroupsTable
        groups={groups}
        loading={loading}
        error={driversGroupsState?.error}
        searchValue={searchValue ?? ''}
        selectedIds={selectedIds}
        onToggleSelect={handleSelectGroup}
        onToggleAll={toggleIds}
        activeId={open?.id ?? null}
        onOpen={openGroup}
        onToggleEnabled={toggleEnabled}
        onConfirmDisable={confirmDisable}
        actionDisabled={Boolean(actionDisabled)}
        onAdd={openAdd}
        onClearSearch={() => onSearch?.('')}
        onRetry={() => reloadDriversGroups?.()}
        pageSize={pageSize}
      />
      {!failed && count != null && (
        <div className='odc-dgp-foot'>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={count}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={(page) => setPagination?.({ ...pagination, currentPage: page })}
            onPageSizeChange={(size, page) => setPagination?.({ ...pagination, pageSize: size, currentPage: page })}
            busy={loading}
            showPageInput
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            pageLabel={t('PAGE', 'Page')}
            pageOfLabel={(totalPages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(totalPages) })}
            // after a delete the page holds fewer rows than its size until the next load; never claim more than the rows on screen
            rangeLabel={(from, to, total, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(groups.length > 0 ? Math.min(to, from + groups.length - 1) : to), total: figureOf(total) })}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        </div>
      )}
    </div>
  )

  // The list's version of the open group when it has one; else the one we hold (it may have left the page)
  const shownRow = open ? (groups.find(group => group.id === open.id) ?? open.row) : null

  // The same props main gave D/DriversGroupDetails (D/DriversGroupsListing:269-298) and D/DriversGroupAddForm (:237-256)
  const formProps = {
    driversGroupsState,
    driversManagers: driversManagersList?.managers,
    businesses: businessesList?.businesses,
    businessesLoading: businessesList?.loading,
    paymethods: paymethodsList?.paymethods,
    drivers: driversList?.drivers,
    companies: driversCompanyList?.companies,
    // (main #490): a list counts as loaded (and empty means «none yet») once its request ended without an error
    driversManagersLoaded: !driversManagersList?.loading && !driversManagersList?.error,
    driversLoaded: !driversList?.loading && !driversList?.error,
    companiesLoaded: !driversCompanyList?.loading && !driversCompanyList?.error,
    // redesign (AD-6): `{ loading, error }` of each list the sections pick from, for their skeleton and empty states
    pickLists: {
      managers: { loading: Boolean(driversManagersList?.loading), error: driversManagersList?.error ?? null },
      drivers: { loading: Boolean(driversList?.loading), error: driversList?.error ?? null },
      companies: { loading: Boolean(driversCompanyList?.loading), error: driversCompanyList?.error ?? null },
      paymethods: { loading: Boolean(paymethodsList?.loading), error: paymethodsList?.error ?? null }
    },
    actionDisabled,
    reloadDriversGroups, // an add or a delete asks the list for the real page and total
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    businessesPaginationProps
  }

  let panel = null
  if (adding) {
    panel = (
      <AddPanel ref={addRef} dirty={addDirty} onClose={closeAdd}>
        <DriversGroupAddForm
          {...formProps}
          setDriversGroupsState={addSetGroupsState}
          curDriversGroup={null}
          driversGroupId={undefined}
          onClose={closeAddForm}
          onCreated={openCreated}
          onChangesStateChange={reportAddChanges}
        />
      </AddPanel>
    )
  } else if (open) {
    panel = (
      <GroupPanel
        {...formProps}
        panelRef={panelRef}
        setDriversGroupsState={setDriversGroupsState}
        curDriversGroup={open.row}
        driversGroupId={open.id}
        handleUpdateDriversGroup={handleUpdateDriversGroup}
        section={section}
        onSectionChange={handleSection}
        expanded={expanded}
        onToggleExpanded={() => setExpanded(value => !value)}
        onClose={closePanel}
      />
    )
  }

  return (
    <>
      <SplitView
        className='odc-dgp-split'
        list={listView}
        panel={panel}
        open={Boolean(panel)}
        expanded={expanded && !adding}
        panelLabel={adding
          ? t('ADD_NEW_DRIVER_GROUP', 'Add new driver group')
          : (shownRow ? groupName(shownRow, t) : t('DRIVER_GROUP', 'Driver group'))}
        resizeLabel={t('DRIVERS_GROUPS_RESIZE_PANEL', 'Resize the group panel')}
        storageKey='od.drivers-groups.panel'
        onClose={closeCurrent}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={plain(deleteTitle, selectedCount)}
        confirmLabel={deleteLabel}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      >
        {t('DRIVERS_GROUPS_CANT_UNDO', "This can't be undone.")}
      </ConfirmDialog>

      {confirmDialog}

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
