import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { UsersList as UsersListController, useConfig, useLanguage, useSession } from '../../../../../index'
import { toAlertContent } from '../../../../../utils/alertContent'
import { useListingSearchSeed } from '../../../hooks/useListingSearchSeed'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { getUserType } from '../../../utils/navigationHelpers'
import { AlertDialog, Button, ConfirmDialog, InlineNotice, Pagination, SelectionBar, Sheet, SplitView } from '../../Shared/Product'
import { Trash2 } from '../../Shared/Icon'
import { ConfirmAdmin } from '../../Shared/ConfirmAdmin'
import { UserAddForm } from '../UserAddForm'
import { DriverPanel } from './DriverPanel'
import { DriversHeader } from './DriversHeader'
import { DriversTable } from './DriversTable'
import { directoryCopy, isManagersRole, panelStorageKey } from './directoryRole'
import { driverName } from './driverData'
import { sectionFromTab } from './driverSections'
import { useDriverToggles } from './useDriverToggles'
import './drivers-page.css'

// redesign DL-B5 (decisions 1-5, 7 | M-DL1..M-DL13): the drivers page is a header (title, count, Learn, Export CSV, Add driver), the
// search and status row, the selection bar, the table and its foot, beside the driver panel in a split view (as /users/customers).
// The controller (K/UsersList) owns the data; this owns what the person sees of it: the URL (?id, ?tab, ?status, ?page, ?pageSize,
// ?add), the driver that is open, the selection bar, the focus and the dialogs. `Delivery/DeliveryUsersListing` mounts it as the
// UIComponent of the controller when `isDriversPage`.
//
// redesign DM-B5 (decisions 1-3 | audit 2, 3, 5): it is also the managers page (`isDriversManagersPage`), with `role='managers'`: no
// status (no `?status=`, no live room, no filter), the texts of `directoryRole` and the add form of level 5.

export const PAGE_SIZES = [10, 25, 50]
export const STATUS_VALUES = ['all', 'available', 'busy', 'offline']

// redesign DL-B5 (decision 3): `?status=` → one of the four; absent or unknown is «all»
export const parseStatus = (value) => (STATUS_VALUES.includes(value) ? value : 'all')

// redesign DL-B5 (decision 3; M-DL8, M-DL11): what the drivers list asks the API for. K/UsersList does not export its `defaultProps`, and a
// `propsToFetch` passed replaces them whole, so they are repeated here (a test compares this list with the controller's source) plus the
// two verification fields the rows show.
export const DRIVERS_PROPS_TO_FETCH = [
  'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'schedule', 'external_id',
  'country_phone_code', 'city_id', 'city', 'address', 'addresses', 'max_days_in_future', 'push_tokens',
  'address_notes', 'driver_zone_restriction', 'mono_session', 'dropdown_option_id', 'dropdown_option', 'location', 'available',
  'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'birthdate', 'drivergroups', 'created_at', 'timezone', 'busy',
  'phone_verified', 'email_verified'
]

/**
 * redesign DL-B5 (decisions 3, 7): the wrapper of the drivers page. `Delivery/DeliveryUsersListing` mounts it for `isDriversPage` and
 * `isDriversManagersPage`. Same job as the wrapper the former listing had (search seed, search flags, page and page size
 * from the URL) with this page's UI and the opt-in props of the controller:
 *  - `isSearchByFullName`, `liveDriversRoom` and `propsToFetch`; for the managers page (redesign DM-B5, `role='managers'`) everything
 *    but `liveDriversRoom` and the status ones, whose keys are left out of the controller's props;
 *  - `statusFilter`, the state of `?status=`, kept here because the controller takes it as a prop and reloads page 1 by itself when it
 *    changes; `onStatusFilterChange` is how the UI changes it. Level 2's list is /professionals, which has no state to filter by: the
 *    filter is not drawn and never reaches the controller.
 */
export const DriversPage = (props) => {
  // `?q=` from the command palette hand-off fills the search box once
  const searchSeed = useListingSearchSeed({ enabled: !!props.isUseQuery })
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const [session] = useSession()
  // redesign DM-B5 (audit 3): `isDriversPage` wins if both come; a managers list has no state, so `?status=` is not read for it
  const role = !props.isDriversPage && props.isDriversManagersPage ? 'managers' : 'drivers'
  const managers = isManagersRole(role)
  const [status, setStatus] = useState(() => (props.isUseQuery && !managers ? parseStatus(query.get('status')) : 'all'))
  const driversControllerProps = {
    ...props,
    UIComponent: DriversListing,
    role,
    isSearchByUserEmail: true,
    isSearchByUserPhone: true,
    isSearchByUserName: true,
    isSearchByFullName: true,
    // redesign DM-B5 (audit 3): the keys are absent for managers, not false: the controller reads their presence
    ...(managers
      ? {}
      : {
          liveDriversRoom: true,
          statusFilter: session?.user?.level === 2 ? 'all' : status,
          onStatusFilterChange: setStatus
        }),
    propsToFetch: DRIVERS_PROPS_TO_FETCH,
    searchSeed,
    isDriver: true,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }
  return <UsersListController {...driversControllerProps} />
}

// redesign DL-R1 (Q-5): same patience as settleFocusOn, for the «Add driver» button (`data-tour="tour_add"`) after the add sheet closes.
// The sheet leaves in `--od-duration-slow` (420ms) and hands the focus back when it is gone (to «Skip to content» when nothing opened
// it; to the first tabbable thing in some browsers), so the budget is longer than 30 frames and a focus that is not on the button is
// taken back until it holds. The person wins: a key or a click after the close ends it.
//
// redesign DL-R2 (Q-5): counting 3 stable frames (~50ms) was not enough: «Add driver» had the focus at ~11ms and the sheet took it at
// ~449ms, when its exit ended. P/Sheet has no documented completion hook or `finalFocus` prop (its own `finalFocus` applies the layer rules and
// returns to the opener; overriding it through the spread props would skip them, and P/ is not touched here), so the watch does not count a stable frame before the sheet has surely finished leaving: `--od-duration-slow` (read from
// the document, 420ms when it is not there) plus a margin. Until then a focus that was taken is still taken back.
const ADD_FOCUS_FRAMES = 90
const ADD_FOCUS_FALLBACK_MS = 420
const ADD_FOCUS_MARGIN_MS = 150
const cssTimeMs = (text) => {
  const match = String(text ?? '').trim().match(/^(-?\d*\.?\d+)(ms|s)$/)
  if (!match) return null
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
}
const addFocusMinimumMs = () => {
  const slow = typeof document !== 'undefined' && typeof getComputedStyle === 'function'
    ? cssTimeMs(getComputedStyle(document.documentElement).getPropertyValue('--od-duration-slow'))
    : null
  return (slow ?? ADD_FOCUS_FALLBACK_MS) + ADD_FOCUS_MARGIN_MS
}
const settleFocusOnAdd = (getFrame) => {
  const minimumMs = addFocusMinimumMs()
  const startedAt = performance.now()
  const maxFrames = ADD_FOCUS_FRAMES + Math.ceil(minimumMs / 16) // the cap covers the minimum
  let frames = 0
  let stable = 0
  let done = false
  const finish = () => {
    done = true
    document.removeEventListener('keydown', finish, true)
    document.removeEventListener('pointerdown', finish, true)
  }
  document.addEventListener('keydown', finish, true)
  document.addEventListener('pointerdown', finish, true)
  const step = () => {
    if (done) return
    frames++
    const target = getFrame()?.querySelector('[data-tour="tour_add"]')
    if (target && !target.disabled) {
      if (document.activeElement === target) {
        stable++
      } else {
        target.focus({ preventScroll: true })
        stable = 0
      }
      // redesign DL-R2 (Q-5): stable frames count only once the sheet has finished leaving
      if (performance.now() - startedAt < minimumMs) stable = 0
      if (stable >= FOCUS_STABLE_FRAMES) return finish()
    }
    if (frames < maxFrames) nextFrame(step)
    else finish()
  }
  nextFrame(step)
}

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

// redesign DL-B5 (as CustomersListing, UC-B7): closing the panel gives the focus back to the row, and after a delete it goes to the row
// that took the driver's place. DataTable's rows (and the cards of the phone list) carry `data-row-id`; with no row left it goes to
// the table's region. The DOM is not ready the moment the controller answers (the list re-renders, the panel and its dialog close and
// give the focus back), so it is tried on the next frames until it holds, and it leaves alone a focus the person already put somewhere
// in the list.
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

// «_count_ selected» → the number becomes an .odc-figure node (decision 11) and keeps its direction in RTL
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})
const figure = (value) => <bdi className='odc-figure'>{value}</bdi>
const plain = (template, count) => template.replace('_count_', () => String(count))

export const DriversListing = (props) => {
  const {
    isUseQuery,
    headerTitle,
    learnOptions,
    defaultUserTypesSelected,
    disabledActiveStateCondition,
    userTypesSelected,
    selectedUserActiveState,
    usersList,
    paginationProps,
    paginationDetail,
    getUsers,
    searchValue,
    onSearch,
    statusFilter,
    onStatusFilterChange,
    handleChangeActiveUser,
    handleChangeAvailable,
    handleChangeBusyUser,
    selectedUsers,
    handleSelectedUsers,
    setSelectedUsers,
    deleteUsersActionState,
    handleDeleteSeveralUsers,
    handleSuccessUpdate,
    handleSuccessAddUser,
    handleSuccessDeleteUser,
    actionDisabled,
    actionStatus,
    driversGroupsState,
    onUserRedirect,
    role // redesign DM-B5 (decisions 1-3 | audit 2, 3, 5): 'drivers' (the default) or 'managers'
  } = props

  const [, t] = useLanguage()
  const managers = isManagersRole(role)
  const copy = directoryCopy(role, t) // redesign DM-B5: every text that changes by role
  const [{ configs }] = useConfig()
  const [{ user: sessionUser }] = useSession()
  const location = useLocation()
  // Both are hooks in disguise (useSession): called every render, never behind a condition
  const readOnlyDeliveryManager = getUserType('readOnlyDeliveryManager')
  const disabled = !!actionDisabled || readOnlyDeliveryManager // as main: both turn off the same things

  const users = usersList?.users ?? []
  const loading = !!usersList?.loading
  const currentPage = paginationProps?.currentPage
  const pageSize = paginationProps?.pageSize
  // `paginationDetail.total` follows the deletes and additions the controller counts; `totalItems` is what the last load said
  const total = paginationDetail?.total ?? paginationProps?.totalItems ?? null
  const selectedIds = selectedUsers ?? []
  const status = managers ? 'all' : parseStatus(statusFilter) // redesign DM-B5 (audit 3): a managers list has no state to filter by
  const level = sessionUser?.level

  // ---- the driver that is open: a row, or just an id (the panel loads it) ----
  const [open, setOpen] = useState(null) // { id, row }
  const [expanded, setExpanded] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [section, setSection] = useState(() => sectionFromTab(new URLSearchParams(location.search).get('tab')))
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false)
  const [patches, setPatches] = useState({}) // { [id]: { available?, busy?, enabled? } } what switches said ok, for a driver the list may not hold
  const openId = useRef(null)
  openId.current = open?.id ?? null
  const frameRef = useRef(null)
  // The row that will take a deleted driver's place, until the panel closes (K/UserDetails deletes, then closes)
  const successorRef = useRef(undefined)

  // The list's own version of the open driver when it has one; else the one we hold (it may have left the page)
  const listRow = open ? users.find(user => user.id === open.id) : undefined
  const shownRow = listRow ?? open?.row ?? null

  // ---- unsaved changes in the panel (the profile form): opening another driver or the add sheet asks first ----
  // The schedule's pending changes live in K/UserDetails and the panel guards its own close with them; this page hears the profile.
  const draft = useRef({ profile: false, panel: false })
  const [discard, setDiscard] = useState(null) // { go }
  const resetDraft = () => { draft.current = { profile: false, panel: false } }
  // redesign DL-B5 (review): the panel reports any unsaved section (the schedule lives in the controller)
  const withDraftGuard = (go) => (draft.current.profile || draft.current.panel ? setDiscard({ go }) : go())
  const handlePanelDirty = useCallback((dirty) => { draft.current.panel = !!dirty }, [])
  const profileProps = useMemo(() => ({ onDirtyChange: (dirty) => { draft.current.profile = !!dirty } }), [])

  // redesign DL-B5 (main's onUserRedirect): the page wrapper owns how `id` and `tab` reach the address; without one the address is written here
  const writeOpenToUrl = (id, changed) => {
    if (!isUseQuery) return
    if (changed) removeQueryToUrl(['tab'])
    if (onUserRedirect) onUserRedirect(id)
    else addQueryToUrl({ id })
  }
  const writeCloseToUrl = () => {
    if (onUserRedirect) onUserRedirect()
    else if (isUseQuery) removeQueryToUrl(['id', 'tab'])
  }

  // `options.focus === false`: the caller (the add form) takes the focus itself. Anything else (a click event) closes as usual.
  const closePanel = (options) => {
    const focus = options?.focus !== false
    if (openId.current == null) return // already closed (the panel closes itself after a delete too)
    const closedId = openId.current
    openId.current = null
    resetDraft()
    setOpen(null)
    setExpanded(false)
    setSection('profile')
    setCustomFieldsOpen(false)
    writeCloseToUrl()
    const focusId = successorRef.current !== undefined ? successorRef.current : closedId
    successorRef.current = undefined
    if (focus) settleFocusOn(() => frameRef.current, focusId)
  }

  const openDriver = (row) => {
    const go = () => {
      const changed = openId.current !== row.id
      if (changed) {
        resetDraft()
        setSection('profile') // another driver starts at Profile
        setCustomFieldsOpen(false)
      }
      setAddOpen(false)
      setOpen({ id: row.id, row })
      writeOpenToUrl(row.id, changed)
    }
    if (openId.current != null && openId.current !== row.id) withDraftGuard(go)
    else go()
  }

  const openAddForm = () => {
    const go = () => {
      closePanel({ focus: false }) // the form is a sheet: the focus is its own
      setAddOpen(true)
    }
    if (openId.current != null) withDraftGuard(go)
    else go()
  }

  // redesign DL-R1 (Q-5): Escape, the sheet's close and the form's own close all end here. A form opened by `?add=1` or ⌘K has no trigger
  // to give the focus back to, and it went to the top of the document («Skip to content»): «Add driver» takes it, on the next frames
  // (the sheet gives the focus back when its exit animation ends, so this keeps at it until it holds).
  const closeAddForm = () => {
    setAddOpen(false)
    settleFocusOnAdd(() => frameRef.current)
  }

  // `?add=1` (command palette) opens the add form like the button, under main's condition
  useOpenFromQuery('add', openAddForm, { ready: !loading && !actionDisabled && !readOnlyDeliveryManager })

  // ?id= decided once, when the first list is in (a list that failed counts: the panel does not need it); `?tab=` was read into `section`
  const pendingId = useRef(isUseQuery ? positiveInt(new URLSearchParams(location.search).get('id')) : null)
  const listArrived = !loading && (users.length > 0 || !!usersList?.error || paginationDetail?.total != null || paginationProps?.totalItems != null)
  useEffect(() => {
    if (pendingId.current == null || !listArrived) return
    const id = pendingId.current
    pendingId.current = null
    setOpen({ id, row: users.find(user => user.id === id) ?? null })
  }, [listArrived])

  // The router navigated to a driver while the page was open (⌘K): our own replaceState writes never reach the router, so they never come here
  const visited = useRef({ search: location.search, key: location.key })
  useEffect(() => {
    if (visited.current.search === location.search && visited.current.key === location.key) return
    visited.current = { search: location.search, key: location.key }
    if (!isUseQuery) return
    const params = new URLSearchParams(location.search)
    const id = positiveInt(params.get('id'))
    if (id == null || openId.current === id) return
    resetDraft()
    setAddOpen(false)
    setCustomFieldsOpen(false)
    setSection(sectionFromTab(params.get('tab')))
    setOpen({ id, row: users.find(user => user.id === id) ?? null })
  }, [location.key, location.search])

  const handleSection = (next) => {
    setSection(next)
    if (isUseQuery) addQueryToUrl({ tab: next })
  }

  // ---- the three switches: one hook, its dialogs once, the same handlers and pending list for the table and the panel ----
  // The controller leaves its error in `actionStatus` too: the hook already says it, so the page's own dialog skips what a switch reported.
  const switchFailures = useRef({ failed: 0, told: 0 })
  const tracked = (handler) => async (payload) => {
    let result
    try {
      result = await handler?.(payload)
    } catch (error) {
      switchFailures.current.failed++
      throw error
    }
    if (result && result.ok === false) switchFailures.current.failed++
    return result
  }
  const onUpdated = (id, patch) => setPatches(previous => ({ ...previous, [id]: { ...previous[id], ...patch } }))
  const toggles = useDriverToggles({
    handleChangeActiveUser: tracked(handleChangeActiveUser),
    handleChangeAvailable: tracked(handleChangeAvailable),
    handleChangeBusyUser: tracked(handleChangeBusyUser),
    onUpdated,
    // redesign D-1 (owner, 2026-10-19, decision 25 C8): deactivating a driver asks first; (n.º 26, D-86):
    // so does deactivating a manager (its own button text)
    confirmDeactivate: true,
    managers
  })

  const [actionError, setActionError] = useState({ open: false, content: [] })
  useEffect(() => {
    if (!actionStatus?.error) return undefined
    // Whichever comes first (this render or the switch's continuation), the decision waits until both have happened
    const timer = setTimeout(() => {
      if (switchFailures.current.failed > switchFailures.current.told) {
        switchFailures.current.told++
        return
      }
      setActionError({
        open: true,
        content: toAlertContent(actionStatus.error, t('DRIVERS_ACTION_ERROR', 'Something went wrong. Try again.'))
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [actionStatus?.error])

  // ---- what the panel reports back ----
  const handleSaved = (updated) => {
    if (updated?.id != null) {
      setOpen(previous => (previous && previous.id === updated.id && previous.row ? { ...previous, row: { ...previous.row, ...updated } } : previous))
      // K/UsersList takes the row out when the saved level is no longer one of the list's; the selection must not keep it
      const stillDriver = !(typeof updated.level === 'number' && Array.isArray(userTypesSelected) && userTypesSelected.length > 0 && !userTypesSelected.includes(updated.level))
      if (!stillDriver && selectedIds.includes(updated.id)) setSelectedUsers(selectedIds.filter(id => id !== updated.id))
    }
    handleSuccessUpdate?.(updated)
  }

  const handleDeleted = (deleted) => {
    const index = users.findIndex(user => user.id === deleted?.id)
    successorRef.current = index === -1 ? null : (users[index + 1]?.id ?? users[index - 1]?.id ?? null)
    if (selectedIds.includes(deleted?.id)) setSelectedUsers(selectedIds.filter(id => id !== deleted.id))
    handleSuccessDeleteUser?.(deleted)
  }

  // ---- the URL: ?page and ?pageSize after each load, as main (the former list UI) ----
  useEffect(() => {
    if (!isUseQuery || !currentPage || !pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({ page: currentPage, pageSize })
  }, [isUseQuery, currentPage, pageSize, paginationProps?.totalPages])

  // A page left empty (its drivers were deleted) asks again: the same page, or the one before when it was the last
  useEffect(() => {
    const totalPages = paginationProps?.totalPages
    if (loading || usersList?.error || users.length > 0 || !(totalPages > 1)) return
    // past the last page the total allows, the foot asks for the last valid one itself
    if (total != null && pageSize > 0 && currentPage > Math.ceil(total / pageSize)) return
    getUsers?.(currentPage !== totalPages ? currentPage : currentPage - 1, pageSize)
  }, [usersList?.users, paginationProps])

  // ---- search and status: both narrow the list, both are cleared together ----
  const hasFilters = !!searchValue || status !== 'all'
  const handleStatus = (next) => {
    if (managers) return // redesign DM-B5 (audit 3): `?status=` is neither read nor written for managers
    const value = parseStatus(next)
    if (value === status) return
    if (isUseQuery) {
      if (value === 'all') removeQueryToUrl(['status'])
      else addQueryToUrl({ status: value })
    }
    onStatusFilterChange?.(value) // the wrapper keeps it and gives it to the controller, which goes back to page 1 by itself
  }
  const clearAll = () => {
    onSearch?.('')
    handleStatus('all')
  }

  // redesign DL-B5 (auditor 16): K/UsersList starts a level 5 session with `actionDisabled` true and lifts it only when GET /drivergroups
  // answers with a group the manager administers (it stays true when there is none). Until that answer arrives (the controller replaces
  // `driversGroupsState` when it asks and when it answers) or when it failed, the reason is not known, so nothing is said.
  const firstGroupsState = useRef(driversGroupsState)
  const groupsAnswered = driversGroupsState !== firstGroupsState.current && !driversGroupsState?.loading && !driversGroupsState?.error
  const showNoGroupsNotice = !managers && level === 5 && !!actionDisabled && groupsAnswered && !loading

  // ---- selection (it survives pages and filters, as main) ----
  const selectedCount = selectedIds.length
  const pageIds = users.map(user => user.id)
  const elsewhere = selectedIds.filter(id => !pageIds.includes(id)).length
  const toggleIds = (ids) => {
    const allIn = ids.every(id => selectedIds.includes(id))
    setSelectedUsers(allIn ? selectedIds.filter(id => !ids.includes(id)) : [...selectedIds, ...ids.filter(id => !selectedIds.includes(id))])
  }

  // ---- bulk delete: main's flow, ConfirmAdmin (password or code) → handleDeleteSeveralUsers(code), now with the count ----
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState({ open: false, content: [] })
  const deleteRequested = useRef(false)
  const deleting = !!deleteUsersActionState?.loading
  useEffect(() => {
    if (!deleteUsersActionState || deleteUsersActionState.loading) return
    const requested = deleteRequested.current
    deleteRequested.current = false
    if (deleteUsersActionState.error) {
      setDeleteError({
        open: true,
        content: toAlertContent(deleteUsersActionState.error, copy.deleteSeveralError)
      })
    } else if (requested) {
      settleFocusOn(() => frameRef.current, users[0]?.id ?? null) // the selection bar is gone with the drivers
    }
  }, [deleteUsersActionState])

  const selectedText = selectedCount === 1
    ? t('DRIVERS_SELECTED_ONE', '_count_ selected')
    : t('DRIVERS_SELECTED_OTHER', '_count_ selected')
  const elsewhereText = elsewhere === 1
    ? t('DRIVERS_SELECTED_ELSEWHERE_ONE', '_count_ on another page')
    : t('DRIVERS_SELECTED_ELSEWHERE_OTHER', '_count_ on other pages')
  const deleteLabel = selectedCount === 1 ? copy.deleteNOne : copy.deleteNOther
  const deleteTitle = selectedCount === 1 ? copy.deleteNTitleOne : copy.deleteNTitleOther

  // ---- what the pieces receive ----
  const listView = (
    <div ref={frameRef} className='odc-root odc-dlp-frame'>
      <DriversHeader
        title={headerTitle}
        count={total}
        learnOptions={learnOptions}
        actionDisabled={disabled}
        onAddDriver={openAddForm}
        role={role}
        exportProps={{ defaultUserTypesSelected, disabledActiveStateCondition, userTypesSelected, selectedUserActiveState }}
        search={searchValue || ''}
        onSearch={onSearch}
        status={status}
        onStatusChange={handleStatus}
        showStatusFilter={!managers && level !== 2} // level 2's list is /professionals: no state to filter by (M-DL7)
        notice={showNoGroupsNotice
          ? (
            <InlineNotice tone='info'>
              {t('DRIVERS_NO_GROUPS_NOTICE', "You don't administer any driver group, so adding, exporting, deleting and changing drivers is turned off.")}
            </InlineNotice>
            )
          : undefined}
      />
      {selectedCount > 0 && (
        <SelectionBar
          label={copy.selectionActions}
          countLabel={(
            <>
              {fill(selectedText, { count: figure(selectedCount) })}
              {elsewhere > 0 && <> · {fill(elsewhereText, { count: figure(elsewhere) })}</>}
            </>
          )}
          clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
          onClear={() => setSelectedUsers([])}
          busy={deleting}
          actions={(
            <Button data-tone='danger' icon={Trash2} disabled={deleting || disabled} onClick={() => setDeleteOpen(true)}>
              {t('DELETE', 'Delete')}
            </Button>
          )}
        />
      )}
      <DriversTable
        users={users}
        loading={loading}
        error={usersList?.error}
        pageSize={pageSize}
        activeUserId={open?.id ?? null}
        onOpenUser={openDriver}
        selection={{ selectedIds, onToggle: handleSelectedUsers, onToggleAll: toggleIds }}
        hasFilters={hasFilters}
        onClearFilters={clearAll}
        onRetry={() => getUsers?.(currentPage, pageSize)}
        onAddDriver={openAddForm}
        role={role}
        onToggle={toggles.onToggle}
        pendingKeys={toggles.pendingKeys}
        actionDisabled={disabled}
      />
      {!usersList?.error && total != null && (
        <div className='odc-dlp-foot'>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={total}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={(page) => getUsers?.(page, pageSize)}
            onPageSizeChange={(size, page) => getUsers?.(page, size)}
            busy={loading}
            showPageInput
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            pageLabel={t('PAGE', 'Page')}
            pageOfLabel={(totalPages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(totalPages) })}
            // redesign DL-R1 (Q-4): after a delete the page holds fewer rows than its size until the next load; never claim more than the rows on screen
            rangeLabel={(from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(users.length > 0 ? Math.min(to, from + users.length - 1) : to), total: figureOf(count) })}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        </div>
      )}
    </div>
  )

  const panel = open && (
    <DriverPanel
      userId={open.id}
      user={shownRow}
      configs={configs}
      section={section}
      onSectionChange={handleSection}
      customFieldsOpen={customFieldsOpen}
      onCustomFieldsOpenChange={setCustomFieldsOpen}
      onClose={closePanel}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onToggle={toggles.onToggle}
      pendingKeys={toggles.pendingKeys}
      // a driver the page does not hold (opened by ?id= or ⌘K) has no row to show what a switch just did: the switches' answers stand in
      patch={listRow ? undefined : patches[open.id]}
      actionDisabled={disabled}
      handleSuccessUpdate={handleSaved}
      handleSuccessDeleteUser={handleDeleted}
      profileProps={profileProps}
      onDirtyChange={handlePanelDirty}
      role={role}
    />
  )

  return (
    <>
      <SplitView
        className='odc-dlp-split'
        list={listView}
        panel={panel}
        open={Boolean(open)}
        expanded={expanded}
        panelLabel={shownRow ? driverName(shownRow, t) : copy.one}
        resizeLabel={copy.resizePanel}
        storageKey={panelStorageKey(role)}
        onClose={closePanel}
      />

      <Sheet
        open={addOpen}
        onOpenChange={(next) => (next ? setAddOpen(true) : closeAddForm())} // redesign DL-R1 (Q-5)
        title={copy.add}
        closeLabel={t('CLOSE', 'Close')}
      >
        <UserAddForm
          showTitle={false} // the sheet already says «Add driver» («Add driver manager»)
          // redesign DM-B5 (audit 5): the add form makes a level 4 or a level 5 by which of the two it is told
          {...(managers ? { isDriversManagersPage: true } : { isDriversPage: true })}
          driversGroupsState={driversGroupsState}
          handleSuccessAdd={(newUser) => {
            handleSuccessAddUser?.(newUser)
            // a filter that may not hold the new driver (the controller appends it to the page): page 1 says the truth
            if (!managers && status !== 'all') getUsers?.(1, pageSize)
          }}
          onClose={closeAddForm} // redesign DL-R1 (Q-5)
        />
      </Sheet>

      {/* One instance of the hook's dialog (the status error) for the table and the panel */}
      {toggles.dialogs}

      {/* The bulk delete goes through the admin confirmation (password or code), as in main, now with the count */}
      <ConfirmAdmin
        open={deleteOpen}
        action='users_delete'
        title={plain(deleteTitle, selectedCount)}
        description={t('DRIVERS_DELETE_BODY', "This can't be undone.")}
        confirmLabel={plain(deleteLabel, selectedCount)}
        onClose={() => setDeleteOpen(false)}
        onConfirm={(token) => {
          setDeleteOpen(false)
          deleteRequested.current = true
          handleDeleteSeveralUsers(token)
        }}
      />
      <AlertDialog
        open={deleteError.open}
        title={copy.deleteSeveralErrorTitle}
        content={deleteError.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteError(current => ({ ...current, open: false }))}
      />
      <AlertDialog
        open={actionError.open}
        title={t('DRIVERS_ACTION_ERROR_TITLE', "The action didn't complete")}
        content={actionError.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setActionError(current => ({ ...current, open: false }))}
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
          resetDraft()
          go?.()
        }}
        onCancel={() => setDiscard(null)}
      >
        {t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}
