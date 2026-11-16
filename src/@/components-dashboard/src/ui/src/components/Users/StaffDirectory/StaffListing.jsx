import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  UsersFilter as UsersFilterController,
  UsersList as UsersListController,
  useConfig,
  useLanguage,
  useSession
} from '../../../../../index'
import { toAlertContent } from '../../../../../utils/alertContent'
import { userFullName } from '../../../../../utils/userContact'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useActiveToggle } from '../../../hooks/useActiveToggle'
import { useListingSearchSeed } from '../../../hooks/useListingSearchSeed'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { addQueryToUrl, learnOptionsValues } from '../../../utils'
import { settleFocusOn } from '../../../utils/listFocus'
import { AlertDialog, Button, ConfirmDialog, IconButton, PageHeader, Pagination, SelectionBar, Sheet, SplitView, Tabs } from '../../Shared/Product'
import { Info, Menu as MenuIcon, Plus, Trash2 } from '../../Shared/Icon'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { ConfirmAdmin } from '../../Shared/ConfirmAdmin'
import { UserAddForm } from '../UserAddForm'
import { UsersExport } from '../UsersExport/UsersExport'
import { UsersFilterBar } from '../UsersFilterBar/UsersFilterBar'
import { completeFilterValues, hasActiveFilters } from '../UsersFilterBar/userFilters'
import { StaffPanel } from './StaffPanel'
import { StaffStoresSection } from './StaffStoresSection'
import { OccupationFilter } from './OccupationFilter'
import { StaffTable } from './StaffTable'
import { STAFF_KINDS, say, staffStoresKey } from './staffKinds'
import { useStaffQuery } from './useStaffQuery'
import './staff-page.css'

// redesign BO-B6 (decisions 1-9; auditor #3, #7d): the staff page (business owners, ; call center agents, ; admins, ) is a header (title, count, Learn,
// Export CSV, Add), the Active / Inactive tabs, the filter bar, the selection bar, the table and its foot, beside the record panel in a
// split view (as /users/customers). The controller (K/UsersList) owns the data; this owns what the person sees of it: the URL (?id,
// ?tab, ?enabled, ?page, ?pageSize), the record that is open, the selection bar, the draft guard and the focus. Everything that
// differs between staff lists (level, words, Learn, sheet fields, stores key) is the `kind` (staffKinds.js).

const PAGE_SIZES = [10, 25, 50]

// main's list of fields (src/pages/BusinessOwnersList, CallcenterAgentsList and ManagersList on main) plus what the new row and filter need:
// the stores of the record (`kind.storesKey`, only for a kind that has them) and the loyalty level (the Loyalty level pill filters by it)
const PROPS_TO_FETCH = [
  'name', 'lastname', 'email', 'phone', 'photo', 'cellphone',
  'country_phone_code', 'city_id', 'city', 'address', 'addresses',
  'address_notes', 'dropdown_option_id', 'dropdown_option', 'location',
  'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'birthdate', 'drivergroups',
  'phone_verified', 'email_verified', 'wallets', 'orders_count', 'push_tokens',
  'loyalty_level', 'loyalty_level_id', 'protected'
]

// «_count_ selected» → the number becomes an .odc-figure node (decision 11) and keeps its direction in RTL
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})
const figure = (value) => <bdi className='odc-figure'>{value}</bdi>
const plain = (template, count) => template.replace('_count_', () => String(count))

// redesign BO-R2 (review r1 #4): after creating a record the focus ends in the selected tab of the new record. The sheet gives the
// focus back to its opener when it finishes closing (from ⌘K or `?add=1` there is none: it falls on «Skip to content»), later than the
// record mounts; so, as settleFocusOn does for the list, it is tried on the next frames until it holds (3 stable frames, up to 40),
// and a focus the person already put inside the record is left alone.
// R2-3 (review r1): that finish can come well after 3 frames, so while a sheet (`.odc-sheet`) is still in the document the loop neither
// touches the focus nor counts frames; it waits up to RECORD_SHEET_WAIT_FRAMES for the sheet to go (past that it gives up: a sheet that
// stays is not the one that was closing, and the focus is not taken from it), and only then settles as above.
// R3 (decision 35): a record with more than four sections has a P/SectionNav instead of tabs: its current row (a list), or its trigger
// (the compact menu of a narrow panel). Only one of the three is ever in the record.
const RECORD_TAB = [
  '.odc-record [role="tab"][aria-selected="true"]',
  '.odc-record .odc-sectionnav [aria-current="page"]',
  '.odc-record .odc-sectionnav-trigger'
].join(', ')
const RECORD_FOCUS_FRAMES = 40
const RECORD_FOCUS_STABLE_FRAMES = 3
const RECORD_SHEET_WAIT_FRAMES = 300
const settleFocusOnRecord = () => {
  let frames = 0
  let stable = 0
  let waited = 0
  const step = () => {
    if (document.querySelector('.odc-sheet')) {
      if (++waited < RECORD_SHEET_WAIT_FRAMES) window.requestAnimationFrame(step)
      return
    }
    frames++
    const target = document.querySelector(RECORD_TAB)
    if (target) {
      const active = document.activeElement
      if (active === target) {
        stable++
      } else if (!active || active === document.body || !active.isConnected || !target.closest('.odc-record').contains(active)) {
        target.focus({ preventScroll: true })
        stable = 0
      } else {
        return // the person already put the focus inside the record
      }
      if (stable >= RECORD_FOCUS_STABLE_FRAMES) return
    }
    if (frames < RECORD_FOCUS_FRAMES) window.requestAnimationFrame(step)
  }
  window.requestAnimationFrame(step)
}

// The loyalty levels the Loyalty pill lists come from K/UsersFilter (it fetches them); it is mounted only to read them
const LoyaltyLevelsUI = ({ children, loyaltyLevelState }) => children(loyaltyLevelState)
const LoyaltyLevels = ({ children }) => <UsersFilterController UIComponent={LoyaltyLevelsUI}>{children}</UsersFilterController>

// The page header in ONE line at every width ('Opening or closing the detail never moves the page header'): Learn and Export collapse
// to their icon by a container query (staff-page.css). `onOpenMenu` (given while the sidebar is collapsed) puts the menu button
// before the title (it is the page header's `leading`). The words are clipped, not removed: the accessible name stays, and every button carries its `title`.
// redesign (B1c): `kind.info` (main's ⓘ next to the title) is a disclosure: a native icon button in the title's block (the page
// header's status slot) that shows the text on the muted line under the row (the header's `description`). It is a button with
// `aria-expanded`, so Tab, Enter and Space work and a reader hears the state; there is no hover-only tooltip. Without `onAdd` (the page
// without its add-on, decision 2) the header has no «Add» button, and `learn` and `actions` are simply not given.
const StaffHeader = ({ kind, total, learn, actions, onAdd, onOpenMenu }) => {
  const [, t] = useLanguage()
  const infoId = useId()
  const [infoOpen, setInfoOpen] = useState(false)
  const known = total != null && Number.isFinite(Number(total))
  const countLabel = Number(total) === 1
    ? say(t, kind.text.countOne)
    : say(t, kind.text.countOther, total)
  const addLabel = say(t, kind.text.add)

  return (
    <PageHeader
      className='sdl-head'
      leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
      title={say(t, kind.text.title)}
      count={known ? Number(total) : undefined}
      countLabel={known ? countLabel : undefined}
      status={kind.info
        ? (
          <IconButton
            icon={Info}
            label={t('MORE_INFORMATION', 'More information')}
            aria-expanded={infoOpen}
            aria-controls={infoOpen ? infoId : undefined}
            onClick={() => setInfoOpen(open => !open)}
          />
          )
        : undefined}
      description={kind.info && infoOpen ? <span id={infoId}>{say(t, kind.info)}</span> : undefined}
      learn={learn}
      // the page's own node (Export CSV): its holder carries the tooltip of the icon-only state, since the button is not this file's
      actions={actions ? <span className='sdl-export' title={say(t, kind.exportCopy.button)}>{actions}</span> : undefined}
      primaryAction={onAdd
        ? (
          // `data-tour` is the anchor of the Learn tour (today's «Add user» button had it)
          <Button variant='primary' icon={Plus} data-tour='tour_add' title={addLabel} onClick={onAdd}>
            <span data-collapse-label=''>{addLabel}</span>
          </Button>
          )
        : undefined}
    />
  )
}

const StaffListingUI = (props) => {
  const {
    kind: kindId,
    isUseQuery,
    defaultUserTypesSelected,
    disabledActiveStateCondition,
    userTypesSelected,
    usersList,
    paginationProps,
    paginationDetail,
    getUsers,
    searchValue,
    onSearch,
    orderFilterValue,
    handleChangeOrderFilterValue,
    multiFilterValues,
    handleChangeMultiFilterValues,
    occupationsState,
    selectedOccupation,
    handleSelectOccupation,
    selectedUserActiveState,
    handleChangeUserActiveState,
    handleChangeActiveUser,
    selectedUsers,
    handleSelectedUsers,
    setSelectedUsers,
    deleteUsersActionState,
    handleDeleteSeveralUsers,
    handleSuccessUpdate,
    handleSuccessAddUser,
    handleSuccessDeleteUser,
    // redesign the page's own add form for its kind (the professionals' ProfessionalAddForm); without it, UserAddForm
    AddForm
  } = props
  const kind = STAFF_KINDS[kindId]

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ user: sessionUser }] = useSession()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()
  const urlQuery = new URLSearchParams(location.search)

  const users = usersList?.users ?? []
  const loading = !!usersList?.loading
  const currentPage = paginationProps?.currentPage
  const pageSize = paginationProps?.pageSize
  // `paginationDetail.total` follows the deletes and additions the controller counts; `totalItems` is what the last load said
  const total = paginationDetail?.total ?? paginationProps?.totalItems ?? null
  // redesign D-3 (owner, 2026-10-19): the signed-in person cannot deactivate or delete themselves, so they are never in the
  // selection: not through a row (the table disables it), not through «Select all», and not when the controller still holds their id
  // (it deletes what IT holds, so the id is taken out of its state, below)
  const selfId = sessionUser?.id
  const isSelf = (id) => selfId != null && id != null && String(id) === String(selfId)
  const selectedIds = (selectedUsers ?? []).filter(id => !isSelf(id))
  useEffect(() => {
    if ((selectedUsers ?? []).some(isSelf)) setSelectedUsers?.((selectedUsers ?? []).filter(id => !isSelf(id)))
  }, [selectedUsers, selfId])

  // ---- the record that is open: a row, or just an id (the panel loads it) ----
  const query = useStaffQuery({ enabled: !!isUseQuery, search: location.search, locationKey: location.key })
  const [open, setOpen] = useState(null) // { id, row }
  const [expanded, setExpanded] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const openId = useRef(null)
  openId.current = open?.id ?? null
  const frameRef = useRef(null)
  // The row that will take a deleted record's place, until the panel closes (K/UserDetails deletes, then closes)
  const successorRef = useRef(undefined)

  // The list's own version of the open record when it has one; else the one we hold (it may have left the list: a switch off)
  const listRow = open ? users.find(user => user.id === open.id) : undefined
  const shownRow = listRow ?? open?.row ?? null

  // ---- unsaved changes in the panel (the profile form, the stores): switching record or opening the add form asks first ----
  const draft = useRef({ profile: false, businesses: false })
  const [discard, setDiscard] = useState(null) // { go, cancel }
  const resetDraft = () => { draft.current = { profile: false, businesses: false } }
  // `go` runs on «Discard»; `cancel` (optional) on «Keep editing», for a caller that already moved the address (⌘K) and must undo it
  const withDraftGuard = (go, cancel) => (draft.current.profile || draft.current.businesses ? setDiscard({ go, cancel }) : go())
  // redesign (B1c, decision 13b): the professionals' profile form gets `isProfessional` and the occupations (the controller's
  // list, which an occupation created from the selector refreshes); without them it asks for a «User type», which main does not offer here
  const occupations = occupationsState?.occupations
  const profileProps = useMemo(() => ({
    onDirtyChange: (dirty) => { draft.current.profile = !!dirty },
    ...(kind.isProfessional ? { isProfessional: true, occupations } : {})
  }), [kind.isProfessional, occupations])

  // `options.focus === false`: the caller (the add form) takes the focus itself. Anything else (a click event) closes as usual.
  const closePanel = (options) => {
    const focus = options?.focus !== false
    if (openId.current == null) return // already closed (the panel closes itself after a delete too)
    const closedId = openId.current
    openId.current = null
    resetDraft()
    setOpen(null)
    setExpanded(false)
    query.close()
    const focusId = successorRef.current !== undefined ? successorRef.current : closedId
    successorRef.current = undefined
    if (focus) settleFocusOn(() => frameRef.current, focusId)
  }

  const openRecord = (row) => {
    const go = () => {
      if (openId.current !== row.id) resetDraft()
      setAddOpen(false)
      setOpen({ id: row.id, row })
      query.open(row.id)
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

  // `?add=1` (command palette) opens the add form like the button
  useOpenFromQuery('add', openAddForm, { ready: !loading })

  // decision 6: a created record opens in its Stores (the next thing to do with a new one); a kind with no stores (admins, decision 4)
  // opens it in Profile. The controller adds it to the list when its level is the list's; closing the record leaves the list as it is.
  // (decision 10): a kind that sets `afterAddSection` says where its new record opens (the professional: Business & Services,
  // since the add form already gave it a 24/7 schedule and without services it cannot be booked).
  const handleAdded = (newUser) => {
    handleSuccessAddUser?.(newUser)
    if (newUser?.id == null) {
      setAddOpen(false)
      return
    }
    resetDraft()
    setAddOpen(false)
    setOpen({ id: newUser.id, row: newUser })
    query.open(newUser.id, { section: kind.afterAddSection ?? (kind.storesKey ? 'businesses' : 'profile') })
    settleFocusOnRecord()
  }

  // ?id= decided once, when the first list is in (a list that failed counts: the panel does not need it)
  const pendingId = useRef(query.initialId)
  const listArrived = !loading && (users.length > 0 || !!usersList?.error || paginationDetail?.total != null || paginationProps?.totalItems != null)
  useEffect(() => {
    if (pendingId.current == null || !listArrived) return
    const id = pendingId.current
    pendingId.current = null
    query.adopt(id)
    setOpen({ id, row: users.find(user => user.id === id) ?? null })
  }, [listArrived])

  // The router navigated to a record while the page was open (⌘K). With another record open and a draft in it, it asks first (as a click
  // on another row does); «Keep editing» gives the address back to the record that stays open. By the time this runs `useStaffQuery`
  // has already taken the new address's section, so the open record's section is the one the ref below saved on the render before.
  const openSection = useRef(query.section)
  useEffect(() => {
    if (!query.request) return
    const id = query.request.id
    if (openId.current === id) return
    const previousId = openId.current
    const previousSection = openSection.current
    const go = () => {
      resetDraft()
      setAddOpen(false)
      setOpen({ id, row: users.find(user => user.id === id) ?? null })
    }
    if (previousId != null) withDraftGuard(go, () => query.open(previousId, { section: previousSection }))
    else go()
  }, [query.request?.key])
  // Declared AFTER the ⌘K effect on purpose: effects of one component run in order, so when that one runs this still holds the section of
  // the render before the address changed
  useEffect(() => { openSection.current = query.section })

  // ---- the status switch: one hook, its dialogs once, the same handler and pending list for the table and the panel ----
  const toggleSource = useRef('table')
  const handleToggle = async (payload) => {
    const index = users.findIndex(user => user.id === payload.id)
    const inList = index !== -1
    const successor = inList ? (users[index + 1]?.id ?? users[index - 1]?.id ?? null) : null
    const result = await handleChangeActiveUser?.(payload)
    if (result?.ok === false) return result
    // the state the API returned (K/UsersList's `user`); what was asked only when the controller says nothing
    const enabled = typeof result?.user?.enabled === 'boolean' ? result.user.enabled : payload.enabled
    // the header switch of the open record reflects it even if the list does not hold the record
    setOpen(previous => (previous && previous.id === payload.id
      ? { ...previous, row: { ...(previous.row ?? { id: previous.id }), enabled } }
      : previous))
    // K/UsersList takes the row out of its list when the new state is not the tab's (deactivate in Active, activate in Inactive; never
    // when the state condition is off) but does not discount the total, so the header count and «Showing 1–10 of N» stayed at N.
    // Asking for the current page once puts the count, the range and the last row back. The last row of a page that has more pages
    // is left to the empty-page effect below, which asks by itself: one request, not two.
    const rowLeft = inList && !disabledActiveStateCondition && !!enabled !== !!selectedUserActiveState
    const handledByEmptyPage = users.length === 1 && paginationProps?.totalPages > 1
    if (!inList) {
      // K/UsersList adds what it was given to the list when the record was not in it: a partial row. Asking again puts the truth back.
      getUsers?.(currentPage, pageSize)
    } else {
      const reload = rowLeft && !handledByEmptyPage ? getUsers?.(currentPage, pageSize) : undefined
      if (toggleSource.current === 'table') {
        // the row left the list: the focus goes to the one that took its place. The reload swaps the rows (a skeleton, then the
        // page), so it waits for the page: settling on the skeleton would leave the focus on the table, which then keeps it.
        // a row the API kept in the list keeps the focus itself.
        const settle = () => settleFocusOn(() => frameRef.current, rowLeft ? successor : payload.id)
        if (reload) Promise.resolve(reload).then(settle, settle)
        else settle()
      }
    }
    return result
  }
  // decision 5: the switch waits for the API and a failure says so (BO-4). redesign D-1 (owner, 2026-10-19, decision 25 C8):
  // deactivating a business owner, a call center agent or a professional asks first (row, phone card and record share this hook); activating
  // stays immediate. The admin kind has no `deactivateCopy`, so it stays `null` there and a level 0 row gets ConfirmAdmin alone.
  const toggle = useActiveToggle({
    handleChangeActiveUser: handleToggle,
    confirmDeactivate: kind.deactivateCopy
      ? {
          title: (user) => say(t, kind.deactivateCopy.title).replace('_name_', () => (user ? userFullName(user) : '') || t('CUSTOMERS_NO_NAME', 'No name')),
          body: say(t, kind.deactivateCopy.body),
          confirmLabel: say(t, kind.deactivateCopy.confirm)
        }
      : null,
    failureTitle: t('CUSTOMERS_STATUS_ERROR_TITLE', "The status didn't change"),
    failureFallback: t('CUSTOMERS_STATUS_ERROR', 'Something went wrong. Try again.')
  })
  // main asked ConfirmAdmin before switching a level 0 row from the TABLE, both ways (U/UsersList handleEnable:81-93); the record's switch changed
  // the state without it (U/UserDetails:106-110). Owners and call center agents say no, admins say yes.
  // redesign D-2 (owner, 2026-10-19): the table (and its phone cards) keeps asking both ways; the record asks only to DEACTIVATE
  // (it cuts service), activating from it stays immediate. the API asks the proof (user_enabled) both ways, so the
  // record asks to activate too.
  const [adminToggle, setAdminToggle] = useState({ open: false, user: null, enabled: false })
  const requestToggle = (source) => (user, enabled) => {
    if (user?.protected && !enabled) return
    toggleSource.current = source
    if (kind.confirmAdminOnToggle && user?.level === 0) {
      setAdminToggle({ open: true, user, enabled })
      return
    }
    toggle.onToggleActive(user, enabled)
  }
  const adminToggleName = (adminToggle.user ? userFullName(adminToggle.user) : '') || t('CUSTOMERS_NO_NAME', 'No name')
  const adminToggleCopy = adminToggle.enabled
    ? {
        title: t('STAFF_ACTIVATE_ADMIN_TITLE', 'Activate _name_?').replace('_name_', () => adminToggleName),
        body: t('STAFF_ACTIVATE_ADMIN_BODY', 'They can sign in to the dashboard again.'),
        confirm: t('STAFF_ACTIVATE_ADMIN_CONFIRM', 'Activate admin')
      }
    : {
        title: t('STAFF_DEACTIVATE_ADMIN_TITLE', 'Deactivate _name_?').replace('_name_', () => adminToggleName),
        body: t('STAFF_DEACTIVATE_ADMIN_BODY', "They can't sign in to the dashboard until you activate them again."),
        confirm: t('STAFF_DEACTIVATE_ADMIN_CONFIRM', 'Deactivate admin')
      }
  const tableToggle = requestToggle('table')
  const panelToggle = requestToggle('panel')

  // ---- what the panel reports back ----
  const handleSaved = (updated) => {
    if (updated?.id != null) {
      setOpen(previous => (previous && previous.id === updated.id && previous.row ? { ...previous, row: { ...previous.row, ...updated } } : previous))
      // K/UsersList takes the row out when the saved level is no longer one of the list's; the selection must not keep it
      const stillListed = !(typeof updated.level === 'number' && Array.isArray(userTypesSelected) && userTypesSelected.length > 0 && !userTypesSelected.includes(updated.level))
      if (!stillListed && selectedIds.includes(updated.id)) setSelectedUsers(selectedIds.filter(id => id !== updated.id))
    }
    handleSuccessUpdate?.(updated)
  }

  const handleDeleted = (deleted) => {
    const index = users.findIndex(user => user.id === deleted?.id)
    successorRef.current = index === -1 ? null : (users[index + 1]?.id ?? users[index - 1]?.id ?? null)
    if (selectedIds.includes(deleted?.id)) setSelectedUsers(selectedIds.filter(id => id !== deleted.id))
    handleSuccessDeleteUser?.(deleted)
  }

  // The Stores section is the page's to draw (B5): its draft joins the guard, and a save repaints the row (the controller's update)
  // redesign CA-B1 (CA-3): the stores property follows the level OF THE RECORD (the panel passes the one that picks its sections: the
  // row over the detail), as main does (U/UserDetails:193); the kind's level is the last resort. A save comes back as
  // `{ id, [storesKey]: [...] }` and the row repaints it under that same key.
  const renderStores = ({ user: storesUser, level, onDirtyChange }) => (
    <StaffStoresSection
      userId={storesUser.id}
      storesKey={staffStoresKey(level ?? storesUser?.level ?? kind.level)}
      onDirtyChange={(dirty) => {
        draft.current.businesses = !!dirty
        onDirtyChange?.(dirty)
      }}
      onSaved={handleSaved}
    />
  )

  // ---- the URL: ?enabled= (as before), ?page and ?pageSize after each load ----
  const urlEnabled = urlQuery.get('enabled')
  useEffect(() => {
    if (!isUseQuery || urlEnabled) return
    addQueryToUrl({ enabled: 'active' })
  }, [])

  useEffect(() => {
    if (!isUseQuery || !currentPage || !pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({ page: currentPage, pageSize })
  }, [isUseQuery, currentPage, pageSize, paginationProps?.totalPages])

  // A page left empty (its records were deleted) asks again: the same page, or the one before when it was the last
  useEffect(() => {
    const totalPages = paginationProps?.totalPages
    if (loading || usersList?.error || users.length > 0 || !(totalPages > 1)) return
    // past the last page the total allows, the foot asks for the last valid one itself
    if (total != null && pageSize > 0 && currentPage > Math.ceil(total / pageSize)) return
    getUsers?.(currentPage !== totalPages ? currentPage : currentPage - 1, pageSize)
  }, [usersList?.users, paginationProps])

  const activeTab = selectedUserActiveState ? 'active' : 'inactive'
  const handleTab = (next) => {
    if (next === activeTab) return // the tab that is already selected does nothing
    handleChangeUserActiveState()
    if (isUseQuery) addQueryToUrl({ enabled: next })
  }

  // ---- filters ----
  // redesign (auditor 10): the occupation row narrows the list too, so an empty list under it says «no match», not «empty»
  const hasFilters = hasActiveFilters({ searchValue, orderFilterValue, multiFilterValues }) || Boolean(kind.isProfessional && selectedOccupation != null)
  // redesign CA-B1 (CA-4): a list that loaded empty, with no error and no filter already has «Add» in the table's empty state, so the
  // link of the foot would be the second one. With rows, or with filters that empty the list, it stays. Not while the first page
  // loads either (rows still to come): it would show and vanish.
  const showFootAdd = users.length > 0 || hasFilters || Boolean(usersList?.error)
  // One handler call each, in one event: React batches them into one render, so the controller asks the API once
  const clearAll = () => {
    onSearch?.('')
    handleChangeOrderFilterValue?.(null)
    handleChangeMultiFilterValues?.(completeFilterValues())
    if (kind.isProfessional) handleSelectOccupation?.(null)
  }

  // ---- selection ----
  // redesign (n.º 14, D-55): admins, business owners and call-center agents empty it when the page, the filters or the search
  // change (the controller does it), so there is nothing «on other pages» to say; professionals are not in D-55 and keep it as today
  const selectedCount = selectedIds.length
  const pageIds = users.map(user => user.id)
  const elsewhere = kind.isProfessional ? selectedIds.filter(id => !pageIds.includes(id)).length : 0
  const isLocked = (id) => isSelf(id) || users.some(user => String(user.id) === String(id) && user.protected)
  const toggleIds = (rows) => {
    const ids = rows.filter(id => !isLocked(id)) // D-3
    const allIn = ids.every(id => selectedIds.includes(id))
    setSelectedUsers(allIn ? selectedIds.filter(id => !ids.includes(id)) : [...selectedIds, ...ids.filter(id => !selectedIds.includes(id))])
  }

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
        content: toAlertContent(deleteUsersActionState.error, say(t, kind.text.deleteSeveralError))
      })
    } else if (requested) {
      settleFocusOn(() => frameRef.current, users[0]?.id ?? null) // the selection bar is gone with the records
    }
  }, [deleteUsersActionState])

  const selectedText = selectedCount === 1
    ? t('CUSTOMERS_SELECTED_ONE', '_count_ selected')
    : t('CUSTOMERS_SELECTED_OTHER', '_count_ selected')
  const elsewhereText = elsewhere === 1
    ? t('CUSTOMERS_SELECTED_ELSEWHERE_ONE', '_count_ on another page')
    : t('CUSTOMERS_SELECTED_ELSEWHERE_OTHER', '_count_ on other pages')
  const deleteLabel = say(t, selectedCount === 1 ? kind.text.deleteOne : kind.text.deleteOther, selectedCount)
  const deleteTitle = say(t, selectedCount === 1 ? kind.text.deleteTitleOne : kind.text.deleteTitleOther, selectedCount)

  // ---- what the pieces receive ----
  const learn = <LearnDropDown learnOptions={learnOptionsValues(kind.learn, t)} />
  const addLabel = say(t, kind.text.add)

  const listView = (
    <div ref={frameRef} className='odc-root sdl-frame'>
      <StaffHeader
        kind={kind}
        total={total}
        learn={learn}
        actions={(
          // as main: every record of the level, active and inactive, with no search, tab or filter (decision 8; P-3 is the owner's, the agents' copy says the same)
          <UsersExport
            copy={kind.exportCopy}
            defaultUserTypesSelected={defaultUserTypesSelected}
            disabledActiveStateCondition={disabledActiveStateCondition}
            userTypesSelected={userTypesSelected}
            selectedUserActiveState={selectedUserActiveState}
          />
        )}
        onAdd={openAddForm}
        onOpenMenu={isCollapse ? () => handleMenuCollapse(false) : undefined}
      />
      <Tabs
        label={say(t, kind.text.statusTabs)}
        value={activeTab}
        onValueChange={handleTab}
        items={[
          { value: 'active', label: t('ACTIVE', 'Active') },
          { value: 'inactive', label: t('INACTIVE', 'Inactive') }
        ]}
      />
      {/* decision 4: main's occupation row, ONE click each, on its own row before the filter bar (a kind with occupations only) */}
      {kind.isProfessional && (
        <OccupationFilter
          label={say(t, kind.text.occupations)}
          occupations={occupationsState?.occupations}
          loading={!!occupationsState?.loading}
          value={selectedOccupation ?? null}
          onChange={handleSelectOccupation}
        />
      )}
      <LoyaltyLevels>
        {(loyaltyLevels) => (
          <UsersFilterBar
            showOrders={false}
            showLoyalty={kind.showLoyalty !== false}
            sheetKeys={kind.sheetKeys}
            searchLabel={kind.text.search}
            barLabel={kind.text.filterBar}
            searchValue={searchValue}
            onSearch={onSearch}
            orderFilterValue={orderFilterValue}
            onOrderFilterChange={handleChangeOrderFilterValue}
            multiFilterValues={multiFilterValues}
            onMultiFilterChange={handleChangeMultiFilterValues}
            loyaltyLevels={loyaltyLevels}
            onClearAll={clearAll}
          />
        )}
      </LoyaltyLevels>
      {selectedCount > 0 && (
        <SelectionBar
          label={say(t, kind.text.selectionActions)}
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
            <Button data-tone='danger' icon={Trash2} disabled={deleting} onClick={() => setDeleteOpen(true)}>
              {t('DELETE', 'Delete')}
            </Button>
          )}
        />
      )}
      <StaffTable
        kind={kind}
        users={users}
        loading={loading}
        error={usersList?.error}
        pageSize={pageSize}
        activeUserId={open?.id ?? null}
        onOpenUser={openRecord}
        currentUserId={selfId}
        selection={{ selectedIds, onToggle: (id) => { if (!isLocked(id)) handleSelectedUsers?.(id) }, onToggleAll: toggleIds }}
        hasFilters={hasFilters}
        inactive={activeTab === 'inactive'}
        onClearFilters={clearAll}
        onRetry={() => getUsers?.(currentPage, pageSize)}
        onAdd={openAddForm}
        onToggleActive={tableToggle}
        pendingIds={toggle.pendingIds}
      />
      <div className='sdl-foot'>
        {showFootAdd && <Button variant='link' onClick={openAddForm}>{addLabel}</Button>}
        {!usersList?.error && total != null && (
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
            rangeLabel={(from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(count) })}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        )}
      </div>
    </div>
  )

  const panel = open && (
    <StaffPanel
      kind={kind}
      userId={open.id}
      user={shownRow}
      configs={configs}
      section={query.section}
      onSectionChange={query.setSection}
      customFieldsOpen={query.customFieldsOpen}
      onCustomFieldsOpenChange={query.setCustomFieldsOpen}
      onClose={closePanel}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onToggleActive={panelToggle}
      pendingIds={toggle.pendingIds}
      handleSuccessUpdate={handleSaved}
      handleSuccessDeleteUser={handleDeleted}
      renderStores={renderStores}
      profileProps={profileProps}
    />
  )

  return (
    <>
      <SplitView
        className='sdl-split'
        list={listView}
        panel={panel}
        open={Boolean(open)}
        expanded={expanded}
        panelLabel={shownRow ? (userFullName(shownRow) || say(t, kind.text.one)) : say(t, kind.text.one)}
        resizeLabel={say(t, kind.text.resizePanel)}
        storageKey={kind.storageKey}
        onClose={closePanel}
      />

      <Sheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title={addLabel}
        closeLabel={t('CLOSE', 'Close')}
      >
        {AddForm
          ? (
            // A kind's own add form, injected by its page (the professionals': main's form, shared with Stores). Not imported here: every
            // staff route would reach its date range (residue ratchet). Its occupations are the list's; the sheet already has its title.
            <AddForm
              showTitle={false}
              occupations={occupations}
              handleSuccessAdd={handleAdded}
              onClose={() => setAddOpen(false)}
            />
            )
          : (
            <UserAddForm
              showTitle={false} // the sheet already says the kind's «Add …»
              defaultUserTypesSelected={[kind.level]}
              handleSuccessAdd={handleAdded}
              onClose={() => setAddOpen(false)}
            />
            )}
      </Sheet>

      {/* One instance of the hook's status error dialog for the table and the panel */}
      {toggle.dialogs}

      {/* A row the kind protects (level 0 for admins, ) goes through the admin confirmation before the switch of the table (both ways,
          as main) and before deactivating from the record (D-2); it says WHO, in the one sentence the code tab reads too */}
      <ConfirmAdmin
        open={adminToggle.open}
        action='user_enabled'
        targetId={adminToggle.user?.id}
        title={adminToggleCopy.title}
        description={adminToggleCopy.body}
        otpDescription={adminToggleCopy.body}
        confirmLabel={adminToggleCopy.confirm}
        onClose={() => setAdminToggle(current => ({ ...current, open: false }))}
        onConfirm={(token) => {
          const { user: target, enabled } = adminToggle
          setAdminToggle(current => ({ ...current, open: false }))
          if (target) toggle.onToggleActive(target, enabled, token)
        }}
      />

      {/* The bulk delete goes through the admin confirmation (password or code, decision 27), with the count */}
      <ConfirmAdmin
        open={deleteOpen}
        action='users_delete'
        title={plain(deleteTitle, selectedCount)}
        description={t('CUSTOMERS_DELETE_BODY', "This can't be undone.")}
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
        title={say(t, kind.text.deleteSeveralErrorTitle)}
        content={deleteError.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteError(current => ({ ...current, open: false }))}
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
        onCancel={() => {
          const cancel = discard?.cancel
          setDiscard(null)
          cancel?.()
        }}
      >
        {t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

/**
 * The staff page of a kind (`STAFF_KINDS[kind]`: `business_owner`, `callcenter_agent`, `admin`, `professional`): mounts K/UsersList with the kind's level and the page's
 * own UI. `isUseQuery` makes it read and write `?enabled=`, `?page=`, `?pageSize=`, `?id=` and `?tab=`.
 */
export const StaffListing = (props) => {
  const kind = STAFF_KINDS[props.kind]
  if (!kind) throw new Error(`StaffListing: unknown kind "${props.kind}"`)
  const query = new URLSearchParams(useLocation().search)
  // review r1 #1: `?q=` (the ⌘K hand-off) fills the one search box, as main's staff lists did (U/UsersListing): the box
  // already searches name, last name, full name, email and phone (decision 4). Turning a word into a first-name filter found nothing
  // for «support» while the box found every «Ordering Support».
  const searchSeed = useListingSearchSeed({ enabled: !!props.isUseQuery })
  const defaultUserActiveState = query.get('enabled') !== 'inactive'
  const page = Number(query.get('page'))
  const size = Number(query.get('pageSize'))
  const usersProps = {
    ...props,
    defaultUserActiveState,
    UIComponent: StaffListingUI,
    defaultUserTypesSelected: [kind.level],
    // decision 4: one box searches name, last name, full name, email and phone
    isSearchByUserName: true,
    isSearchByUserEmail: true,
    isSearchByUserPhone: true,
    isSearchByFullName: true,
    // redesign (n.º 14, D-55): admins, business owners and call-center agents; the professionals' list is not in D-55
    clearSelectionOnQueryChange: !kind.isProfessional,
    searchSeed,
    paginationSettings: {
      initialPage: props.isUseQuery && Number.isInteger(page) && page >= 1 ? page : 1,
      pageSize: props.isUseQuery && PAGE_SIZES.includes(size) ? size : 10,
      controlType: 'pages'
    },
    // the occupations and the filter by `occupation_id` (a kind with `isProfessional`)
    isProfessional: !!kind.isProfessional,
    // a kind with no stores (admins) asks for none: the list never holds `null` or `undefined`. `kind.extraPropsToFetch` is what its
    // record's sections paint and the list does not ask for (the professional's schedule, occupation and timezone: without them the
    // schedule would draw 24/7 and a Save would overwrite the real one, auditor 1-2); a repeated key is asked once.
    propsToFetch: [...new Set([
      ...PROPS_TO_FETCH,
      ...(kind.storesKey ? [kind.storesKey] : []),
      ...(kind.extraPropsToFetch ?? [])
    ])]
  }
  return <UsersListController {...usersProps} />
}
