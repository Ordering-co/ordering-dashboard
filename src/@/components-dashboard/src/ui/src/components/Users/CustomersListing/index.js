import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  UsersFilter as UsersFilterController,
  UsersList as UsersListController,
  useConfig,
  useLanguage
} from '../../../../../index'
import { toAlertContent } from '../../../../../utils/alertContent'
import { classifyUserSearchQuery } from '../../../../../utils/commandPaletteHandoff'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useListingSearchSeed } from '../../../hooks/useListingSearchSeed'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { addQueryToUrl, learnOptionsValues } from '../../../utils'
import { settleFocusOn } from '../../../utils/listFocus' // redesign BO-B2: promoted from this file; the focus patience after a delete is unchanged
import { AlertDialog, Button, ConfirmDialog, Pagination, SelectionBar, Sheet, SplitView, Tabs } from '../../Shared/Product'
import { Trash2 } from '../../Shared/Icon'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { ConfirmAdmin } from '../../Shared/ConfirmAdmin'
import { UserAddForm } from '../UserAddForm'
import { CustomerPanel } from '../CustomersDirectory/CustomerPanel'
import { CustomersExport } from '../CustomersDirectory/CustomersExport'
import { CustomersFilters } from '../CustomersDirectory/CustomersFilters'
import { CustomersHeader } from '../CustomersDirectory/CustomersHeader'
import { CustomersTable } from '../CustomersDirectory/CustomersTable'
import { CustomerWalletSection } from '../CustomersDirectory/CustomerWalletSection'
import { customerName } from '../CustomersDirectory/customerData'
import { completeFilterValues, hasActiveFilters } from '../CustomersDirectory/customerFilters'
import { useCustomerActiveToggle } from '../CustomersDirectory/useCustomerActiveToggle'
import { useCustomerQuery } from '../CustomersDirectory/useCustomerQuery'
import '../CustomersDirectory/customers-page.css'

// redesign UC-B7 (decisions 1-8; auditor #1, #3, #7, #14): the customers page is a header (title, count, Learn, Export CSV, Add
// customer), the Active / Inactive tabs, the filter bar, the selection bar, the table and its foot, beside the customer panel in a
// split view (as /cart-recovery/open-carts and /orders). The controller (K/UsersList) owns the data; this owns what the person sees
// of it: the URL (?id, ?section, ?wallet, ?enabled, ?page, ?pageSize), the customer that is open, the selection bar and the focus.

const PAGE_SIZES = [10, 25, 50]

// «_count_ selected» → the number becomes an .odc-figure node (decision 11) and keeps its direction in RTL
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})
const figure = (value) => <bdi className='odc-figure'>{value}</bdi>
const plain = (template, count) => template.replace('_count_', () => String(count))

// The loyalty levels the Loyalty pill lists come from K/UsersFilter (it fetches them); it is mounted only to read them
const LoyaltyLevelsUI = ({ children, loyaltyLevelState }) => children(loyaltyLevelState)
const LoyaltyLevels = ({ children }) => <UsersFilterController UIComponent={LoyaltyLevelsUI}>{children}</UsersFilterController>

const CustomersListingUI = (props) => {
  const {
    isUseQuery,
    headerTitle,
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
    handleSuccessDeleteUser
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()
  const urlQuery = new URLSearchParams(location.search)

  const users = usersList?.users ?? []
  const loading = !!usersList?.loading
  const currentPage = paginationProps?.currentPage
  const pageSize = paginationProps?.pageSize
  // `paginationDetail.total` follows the deletes and additions the controller counts; `totalItems` is what the last load said
  const total = paginationDetail?.total ?? paginationProps?.totalItems ?? null
  const selectedIds = selectedUsers ?? []

  // ---- the customer that is open: a row, or just an id (the panel loads it) ----
  const query = useCustomerQuery({ enabled: !!isUseQuery, search: location.search, locationKey: location.key })
  const [open, setOpen] = useState(null) // { id, row }
  const [expanded, setExpanded] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const openId = useRef(null)
  openId.current = open?.id ?? null
  const frameRef = useRef(null)
  // The row that will take a deleted customer's place, until the panel closes (K/UserDetails deletes, then closes)
  const successorRef = useRef(undefined)

  // The list's own version of the open customer when it has one; else the one we hold (it may have left the list: a switch off)
  const listRow = open ? users.find(user => user.id === open.id) : undefined
  const shownRow = listRow ?? open?.row ?? null

  // ---- unsaved changes in the panel (profile form, wallet form): switching customer or opening the add form asks first ----
  const draft = useRef({ profile: false, wallet: false })
  const [discard, setDiscard] = useState(null) // { go, stay }
  const resetDraft = () => { draft.current = { profile: false, wallet: false } }
  // `stay` runs on «Keep editing» (⌘K gives the address back to the customer that stays open)
  const withDraftGuard = (go, stay) => (draft.current.profile || draft.current.wallet ? setDiscard({ go, stay }) : go())
  const profileProps = useMemo(() => ({ onDirtyChange: (dirty) => { draft.current.profile = !!dirty } }), [])
  const renderWallet = ({ user: walletUser, wallet, onWalletChange, onDirtyChange, intent, onIntentConsumed }) => (
    <CustomerWalletSection
      user={walletUser}
      configs={configs}
      wallet={wallet}
      onWalletChange={onWalletChange}
      intent={intent}
      onIntentConsumed={onIntentConsumed}
      onDirtyChange={(dirty) => {
        draft.current.wallet = !!dirty
        onDirtyChange?.(dirty)
      }}
    />
  )

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

  const openCustomer = (row) => {
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

  // The router navigated to a customer while the page was open (⌘K). With another customer open and a draft in it, it asks first
  // (as a click on another row does; , like the owners' page). `useCustomerQuery` holds the link's section and wallet in
  // the request until it is accepted, so behind the dialog the open customer, and its draft, stay as they are; «Keep editing»
  // gives the address back to it.
  useEffect(() => {
    const request = query.request
    if (!request) return
    const id = request.id
    if (openId.current === id) {
      query.accept(request) // the same customer: only its place changes, as before
      return
    }
    const go = () => {
      resetDraft()
      setAddOpen(false)
      query.accept(request)
      setOpen({ id, row: users.find(user => user.id === id) ?? null })
    }
    if (openId.current != null) withDraftGuard(go, () => query.restore())
    else go()
  }, [query.request?.key])

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
    // the header switch of the open customer reflects it even if the list does not hold the customer
    setOpen(previous => (previous && previous.id === payload.id
      ? { ...previous, row: { ...(previous.row ?? { id: previous.id }), enabled } }
      : previous))
    // redesign UC-R2b (Q-06): K/UsersList takes the row out of its list when the new state is not the tab's (deactivate in Active,
    // activate in Inactive; never when the state condition is off) but does not discount the total, so the header count and
    // «Showing 1–10 of N» stayed at N. Asking for the current page once puts the count, the range and the last row back. The last
    // row of a page that has more pages is left to the empty-page effect below, which asks by itself: one request, not two.
    const rowLeft = inList && !disabledActiveStateCondition && !!enabled !== !!selectedUserActiveState
    const handledByEmptyPage = users.length === 1 && paginationProps?.totalPages > 1
    if (!inList) {
      // K/UsersList adds the customer to the list when it was not in it and now is the list's state, at the end of the page.
      // Asking again puts the order and the count back.
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
  const toggle = useCustomerActiveToggle({ handleChangeActiveUser: handleToggle })
  const tableToggle = (user, enabled) => {
    toggleSource.current = 'table'
    toggle.onToggleActive(user, enabled)
  }
  const panelToggle = (user, enabled) => {
    toggleSource.current = 'panel'
    toggle.onToggleActive(user, enabled)
  }

  // ---- what the panel reports back ----
  const handleSaved = (updated) => {
    if (updated?.id != null) {
      setOpen(previous => (previous && previous.id === updated.id && previous.row ? { ...previous, row: { ...previous.row, ...updated } } : previous))
      // K/UsersList takes the row out when the saved level is no longer one of the list's; the selection must not keep it
      const stillCustomer = !(typeof updated.level === 'number' && Array.isArray(userTypesSelected) && userTypesSelected.length > 0 && !userTypesSelected.includes(updated.level))
      if (!stillCustomer && selectedIds.includes(updated.id)) setSelectedUsers(selectedIds.filter(id => id !== updated.id))
    }
    handleSuccessUpdate?.(updated)
  }

  const handleDeleted = (deleted) => {
    const index = users.findIndex(user => user.id === deleted?.id)
    successorRef.current = index === -1 ? null : (users[index + 1]?.id ?? users[index - 1]?.id ?? null)
    if (selectedIds.includes(deleted?.id)) setSelectedUsers(selectedIds.filter(id => id !== deleted.id))
    handleSuccessDeleteUser?.(deleted)
  }

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

  // A page left empty (its customers were deleted) asks again: the same page, or the one before when it was the last
  useEffect(() => {
    const totalPages = paginationProps?.totalPages
    if (loading || usersList?.error || users.length > 0 || !(totalPages > 1)) return
    // past the last page the total allows, the foot asks for the last valid one itself
    if (total != null && pageSize > 0 && currentPage > Math.ceil(total / pageSize)) return
    getUsers?.(currentPage !== totalPages ? currentPage : currentPage - 1, pageSize)
  }, [usersList?.users, paginationProps])

  const activeTab = selectedUserActiveState ? 'active' : 'inactive'
  const handleTab = (next) => {
    if (next === activeTab) return // M-C15: the tab that is already selected does nothing
    handleChangeUserActiveState()
    if (isUseQuery) addQueryToUrl({ enabled: next })
  }

  // ---- filters ----
  const hasFilters = hasActiveFilters({ searchValue, orderFilterValue, multiFilterValues })
  // One handler call each, in one event: React batches them into one render, so the controller asks the API once
  const clearAll = () => {
    onSearch?.('')
    handleChangeOrderFilterValue?.(null)
    handleChangeMultiFilterValues?.(completeFilterValues())
  }

  // ---- selection (redesign , n.º 14, D-55: the controller empties it when the page, the filters or the search change, so it is always visible rows) ----
  const selectedCount = selectedIds.length
  const toggleIds = (ids) => {
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
        content: toAlertContent(deleteUsersActionState.error, t('CUSTOMERS_DELETE_SEVERAL_ERROR', "We couldn't delete the selected customers. Try again."))
      })
    } else if (requested) {
      settleFocusOn(() => frameRef.current, users[0]?.id ?? null) // the selection bar is gone with the customers
    }
  }, [deleteUsersActionState])

  const selectedText = selectedCount === 1
    ? t('CUSTOMERS_SELECTED_ONE', '_count_ selected')
    : t('CUSTOMERS_SELECTED_OTHER', '_count_ selected')
  const deleteLabel = selectedCount === 1
    ? t('CUSTOMERS_DELETE_N_ONE', 'Delete _count_ customer')
    : t('CUSTOMERS_DELETE_N_OTHER', 'Delete _count_ customers')
  const deleteTitle = selectedCount === 1
    ? t('CUSTOMERS_DELETE_N_TITLE_ONE', 'Delete _count_ customer?')
    : t('CUSTOMERS_DELETE_N_TITLE_OTHER', 'Delete _count_ customers?')

  // ---- what the pieces receive ----
  const learn = <LearnDropDown learnOptions={learnOptionsValues(['customers_general_view', 'customers_details'], t)} />

  const listView = (
    <div ref={frameRef} className='odc-root odc-cpg-frame'>
      <CustomersHeader
        title={headerTitle}
        total={total}
        learn={learn}
        actions={(
          <CustomersExport
            defaultUserTypesSelected={defaultUserTypesSelected}
            disabledActiveStateCondition={disabledActiveStateCondition}
            userTypesSelected={userTypesSelected}
            selectedUserActiveState={selectedUserActiveState}
            multiFilterValues={multiFilterValues}
          />
        )}
        onAdd={openAddForm}
        onOpenMenu={isCollapse ? () => handleMenuCollapse(false) : undefined}
      />
      <Tabs
        label={t('CUSTOMERS_STATUS_TABS', 'Customer status')}
        value={activeTab}
        onValueChange={handleTab}
        items={[
          { value: 'active', label: t('ACTIVE', 'Active') },
          { value: 'inactive', label: t('INACTIVE', 'Inactive') }
        ]}
      />
      <LoyaltyLevels>
        {(loyaltyLevels) => (
          <CustomersFilters
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
          label={t('CUSTOMERS_SELECTION_ACTIONS', 'Actions for selected customers')}
          countLabel={(
            <>
              {fill(selectedText, { count: figure(selectedCount) })}
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
      <CustomersTable
        users={users}
        loading={loading}
        error={usersList?.error}
        pageSize={pageSize}
        configs={configs}
        activeUserId={open?.id ?? null}
        onOpenUser={openCustomer}
        selection={{ selectedIds, onToggle: handleSelectedUsers, onToggleAll: toggleIds }}
        hasFilters={hasFilters}
        onClearFilters={clearAll}
        onRetry={() => getUsers?.(currentPage, pageSize)}
        onToggleActive={tableToggle}
        pendingIds={toggle.pendingIds}
      />
      <div className='odc-cpg-foot'>
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
    <CustomerPanel
      userId={open.id}
      user={shownRow}
      configs={configs}
      section={query.section}
      onSectionChange={query.setSection}
      wallet={query.wallet}
      onWalletChange={query.setWallet}
      customFieldsOpen={query.customFieldsOpen}
      onCustomFieldsOpenChange={query.setCustomFieldsOpen}
      onClose={closePanel}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onToggleActive={panelToggle}
      pendingIds={toggle.pendingIds}
      handleSuccessUpdate={handleSaved}
      handleSuccessDeleteUser={handleDeleted}
      renderWallet={renderWallet}
      profileProps={profileProps}
    />
  )

  return (
    <>
      <SplitView
        className='odc-cpg-split'
        list={listView}
        panel={panel}
        open={Boolean(open)}
        expanded={expanded}
        panelLabel={shownRow ? customerName(shownRow, t) : t('CUSTOMER', 'Customer')}
        resizeLabel={t('CUSTOMERS_RESIZE_PANEL', 'Resize the customer panel')}
        storageKey='od.customers.panel'
        onClose={closePanel}
      />

      <Sheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('CUSTOMERS_ADD', 'Add customer')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <UserAddForm
          showTitle={false} // redesign UF-B4 (M-UF9): the sheet already says «Add customer»
          defaultUserTypesSelected={defaultUserTypesSelected}
          handleSuccessAdd={handleSuccessAddUser}
          onClose={() => setAddOpen(false)}
        />
      </Sheet>

      {/* One instance of the hook's dialogs (deactivate, status error) for the table and the panel */}
      {toggle.dialogs}

      {/* The bulk delete goes through the admin confirmation (password or code, decision 27), now with the count */}
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
        title={t('CUSTOMERS_DELETE_SEVERAL_ERROR_TITLE', "The customers weren't deleted")}
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
          const stay = discard?.stay
          setDiscard(null)
          stay?.()
        }}
      >
        {t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

export const CustomersListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const listingSeed = useListingSearchSeed({ enabled: !!props.isUseQuery })
  const { searchSeed, filterSeed } = useMemo(() => {
    const target = listingSeed && classifyUserSearchQuery(listingSeed.value)
    return {
      searchSeed: target?.searchValue ? { key: listingSeed.key, value: target.searchValue } : null,
      filterSeed: target?.filters ? { key: listingSeed.key, values: target.filters } : null
    }
  }, [listingSeed?.key])
  const defaultUserActiveState = query.get('enabled') !== 'inactive'
  const page = Number(query.get('page'))
  const size = Number(query.get('pageSize'))
  const customersProps = {
    ...props,
    defaultUserActiveState,
    UIComponent: CustomersListingUI,
    // redesign UC-B7 (decision 2A): one box searches name, last name, full name, email and phone
    isSearchByUserName: true,
    isSearchByUserEmail: true,
    isSearchByUserPhone: true,
    isSearchByFullName: true,
    // redesign (n.º 14, D-55): the bulk delete only reaches visible rows
    clearSelectionOnQueryChange: true,
    searchSeed,
    filterSeed,
    paginationSettings: {
      initialPage: props.isUseQuery && Number.isInteger(page) && page >= 1 ? page : 1,
      pageSize: props.isUseQuery && PAGE_SIZES.includes(size) ? size : 10,
      controlType: 'pages'
    },
    propsToFetch: [
      'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'loyalty_level', 'loyalty_level_id', 'country_phone_code', 'city_id', 'city', 'address', 'addresses', 'address_notes', 'dropdown_option_id', 'dropdown_option', 'location', 'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'birthdate', 'phone_verified', 'email_verified', 'wallets', 'orders_count', 'push_tokens'
    ]
  }
  return (
    <UsersListController {...customersProps} />
  )
}
