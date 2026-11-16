import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage, useUtils, BusinessDeviceDetail as BusinessDeviceDetailController } from '../../../../../index'
import { toAlertContent } from '../../../../../utils/alertContent'
import { effectiveDeviceChanges, hasMissingOwner, missingDeviceFields, ownerNameOf } from '../../../../../utils/devices'
import { getFeatureFlags } from '../../../utils'
import { Ellipsis, LogOut, Maximize2, Minimize2, Trash2 } from '../../Shared/Icon'
import {
  AlertDialog,
  Avatar,
  Button,
  ConfirmDialog,
  CopyButton,
  IconButton,
  Menu,
  Pagination,
  RecordPanel,
  SelectField,
  Skeleton,
  TextField,
  useSplitView
} from '../../Shared/Product'
import './device-panel.css'

// redesign stores devices (D3-D7 | G5-34, G5-35, G5-37, DV-01, DV-04, DV-09, DV-10): the panel of a device, a RecordPanel
// with the form of main. It mounts K/BusinessDeviceDetail with `BusinessDeviceDetailUI`, so the controller brings the draft
// (`formState.changes`), the lists of stores and the requests (each answers `{ ok }` / `{ ok: false, error }`); the list gives the rest:
//  - `selectedDevice`: the device, or null for «Add new device»; the list mounts the panel again for each one (`key`, DV-08);
//  - `devices`, `handleUpdateDeviceList`, `onCreated(device)`: as the controller documents them;
//  - `onClose()`: what the controller calls after a delete; `onDismiss()`: the panel's own close (X, Esc, scrim, a discarded close).
//    Without `onDismiss` both go through `onClose`;
//  - `expanded`, `onExpandedChange(next)`: «Open as page», also in the add panel;
//  - `panelRef`: the ref of the RecordPanel. `panelRef.current.requestClose(proceed)` asks the discard question when the draft has
//    changes and calls `proceed` when they are discarded (or at once when clean): the guard for changing device;
//  - `focusCode`: after a create the focus goes to «Copy device code», so it does not fall to <body>.
// The code is hidden until «Show» (P9): with device_code_login_enabled it signs in as the device's user without a password.

// The four texts of the discard guard of RecordPanel: the keys of the drivers panel's guard
const discardTexts = (t) => ({
  discardTitle: t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?'),
  discardDescription: t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.'),
  discardConfirmLabel: t('DISCARD', 'Discard'),
  keepEditingLabel: t('KEEP_EDITING', 'Keep editing')
})

// (main #486): the API's «The User ID field is required» (any spelling of user id) is said as the missing owner
const USER_ID_ERROR_PATTERN = /user[\s_]?id/i

// a translated template with a node (a figure) in place of each _name_
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// «Downtown» with its logo, as an option of a list
const Option = ({ name, kind, src }) => (
  <span className='odc-dp-option'>
    <Avatar kind={kind} name={name} src={src || undefined} />
    <span className='odc-dp-option-name'>{name}</span>
  </span>
)

export const BusinessDeviceDetailUI = (props) => {
  const {
    selectedDevice,
    deleteDevice,
    logoutDevice,
    logoutDeviceState,
    clearLogoutError,
    formState,
    handleChangeFormState,
    clearFormChanges,
    businessList,
    chosenBusiness,
    adminList,
    businessPagination,
    handleChangeBusinessPage,
    searchBusinesses,
    updateDevice,
    addDevice,
    onClose,
    onDismiss,
    expanded = false,
    onExpandedChange,
    panelRef,
    focusCode = false
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const split = useSplitView()
  const phone = split.mode === 'full'
  const isEnabledDeleteAllSessions = getFeatureFlags('dominos_enable_delete_all_sessions_by_user')

  const bodyRef = useRef(null)
  const submitting = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const changes = formState?.changes ?? {}
  const isEdit = Boolean(selectedDevice)
  const dirty = Object.keys(effectiveDeviceChanges(changes, selectedDevice)).length > 0 // R-2: a value typed back is not a change
  const saving = Boolean(formState?.loading)

  const [attempted, setAttempted] = useState(false)
  const [storeSearch, setStoreSearch] = useState('')
  // redesign (review 2): once the stores have loaded, a later load (a search, or its clearing) never brings the skeleton back
  const [storesLoaded, setStoresLoaded] = useState(false)
  useEffect(() => {
    if (!businessList?.loading) setStoresLoaded(true)
  }, [businessList?.loading])
  const [alertLines, setAlertLines] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [codeShown, setCodeShown] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // ---- the stores and the owners of the one chosen: read from the lists of this render, never from state kept from an earlier one ----
  const businessId = changes.business_id ?? selectedDevice?.business_id
  // R-1: the chosen store stays an option (and keeps its owners) while the list shows another page or a search
  const listed = businessList?.businesses
  const businesses = useMemo(() => {
    const items = listed || []
    if (!chosenBusiness || items.some(item => item?.id === chosenBusiness.id)) return items
    return [chosenBusiness, ...items]
  }, [listed, chosenBusiness])
  const business = useMemo(() => (businesses || []).find(item => item?.id === businessId), [businesses, businessId])
  const owners = Array.isArray(business?.owners) ? business.owners : null
  const storeName = business?.name ?? selectedDevice?.business?.name ?? ''
  const logo = (src) => (src ? optimizeImage(src, 'h_50,c_limit') : undefined)

  const storeOptions = useMemo(() => (businesses || []).map(item => ({
    value: item?.id,
    // the label is the row with the logo; the name is what the search finds
    label: <Option name={item?.name ?? ''} kind='business' src={logo(item?.logo)} />,
    keywords: [item?.name ?? '']
  })), [businesses])

  // the search of the owners is local: P/Select filters by the keywords (the name), so no list is filtered here
  const storeHasNoOwners = Array.isArray(owners) && owners.length === 0
  const admins = storeHasNoOwners && adminList?.users?.length ? adminList.users : null
  const linkableUsers = admins ?? owners
  const ownerOptions = useMemo(() => (linkableUsers || []).map(owner => ({
    value: owner?.id,
    label: <Option name={ownerNameOf({ user: owner })} kind='person' src={owner?.photo} />,
    keywords: [ownerNameOf({ user: owner })]
  })), [linkableUsers])
  // a linked owner that is not among the owners of the store (DV-04) pre-selects nothing
  const linkedOwner = changes.user_id ?? selectedDevice?.user_id
  const ownerValue = (linkableUsers || []).some(owner => String(owner?.id) === String(linkedOwner)) ? linkedOwner : undefined

  // ---- what is missing (G5-37): shown after the first Save, and then it follows what is typed ----
  const missing = missingDeviceFields(changes, selectedDevice)
  const nameError = attempted && missing.name ? t('NAME_IS_REQUIRED', 'Name is required') : undefined
  const storeError = attempted && missing.business ? t('DEVICES_STORE_IS_REQUIRED', 'Store is required') : undefined
  const ownerMissing = hasMissingOwner(selectedDevice) && changes.user_id === undefined
  // (main #486): a device needs its business owner. Save asks for one, and a store with no owners says what to do first.
  const hasNoOwners = storeHasNoOwners && !admins
  const adminsLoading = storeHasNoOwners && Boolean(adminList?.loading)
  const adminsMessage = t('DEVICE_BUSINESS_WITHOUT_OWNERS_ADMIN', 'This business has no active Business Owner users, so you can choose an administrator. The device signs in as the user you choose.')
  const noOwnersMessage = t('DEVICE_BUSINESS_WITHOUT_OWNERS', 'This business has no active Business Owner users. Create one in Users > Business Owners, or assign this business to an existing one, first.')
  const ownerRequiredMessage = t('BUSINESS_OWNER_USER_REQUIRED', 'Business owner user is required')
  const getOwnerHint = () => {
    if (adminsLoading) return undefined
    if (admins) return adminsMessage
    if (hasNoOwners) return noOwnersMessage
    if (ownerMissing) return t('DEVICE_OWNER_MISSING', 'The linked owner no longer exists. Choose another owner.')
    return undefined
  }
  const noOwnerChosen = !linkedOwner
  const ownerError = attempted && noOwnerChosen ? ownerRequiredMessage : undefined
  const getOwnerErrors = () => [ownerRequiredMessage, ...(hasNoOwners ? [noOwnersMessage] : [])]
  const getResultErrors = (result) => {
    const messages = Array.isArray(result) ? result : [result]
    if (!messages.some(message => USER_ID_ERROR_PATTERN.test(message))) return result
    return [...new Set(messages.flatMap(message => USER_ID_ERROR_PATTERN.test(message) ? getOwnerErrors() : [message]))]
  }

  // ---- the errors of the requests, said in one alert (as main's Alert «Devices») ----
  useEffect(() => {
    if (formState?.result?.error) {
      setAlertLines(toAlertContent(getResultErrors(formState.result.result), t('ERROR', 'Error')))
    }
  }, [formState?.result])

  useEffect(() => {
    const error = logoutDeviceState?.error
    if (error) setAlertLines(toAlertContent(typeof error === 'string' ? error : error?.result, t('ERROR', 'Error')))
  }, [logoutDeviceState?.error])

  const closeAlert = () => {
    setAlertLines(null)
    clearLogoutError?.()
  }

  // after a create the focus is on the code, the thing the person came for
  useEffect(() => {
    if (!focusCode || !isEdit) return
    bodyRef.current?.querySelector('.odc-dp-code-row .odc-copy button')?.focus()
  }, [])

  // ---- Save ----
  // the first thing that is missing gets the focus, decided now (not from the DOM a frame later: the person may already be typing)
  const focusMissing = (absent) => {
    const root = bodyRef.current
    const combos = root?.querySelectorAll('button[role="combobox"]')
    const target = absent.name
      ? root?.querySelector('input')
      : absent.business
        ? combos?.[0]
        : combos?.[1] ?? combos?.[0]
    target?.focus?.()
  }

  const handleSubmit = async () => {
    // DV-09: a second press while the first one is on its way sends nothing
    if (saving || submitting.current) return
    const absent = missingDeviceFields(changes, selectedDevice)
    if (absent.name || absent.business || noOwnerChosen) {
      setAttempted(true)
      focusMissing({ ...absent, owner: noOwnerChosen })
      return
    }
    submitting.current = true
    try {
      if (selectedDevice) await updateDevice(selectedDevice.id)
      else await addDevice()
    } finally {
      submitting.current = false
    }
  }

  // «Discard» (and a plain close) empties the draft and goes on; the list mounts the panel again for the next device anyway
  const handleClose = () => {
    clearFormChanges?.()
    ;(onDismiss ?? onClose)?.()
  }

  // ---- Delete and Logout all devices: each asks first (decision 6, C8) ----
  const deviceName = String(selectedDevice?.name ?? '').trim() || `#${selectedDevice?.id ?? ''}`
  const ownerName = ownerNameOf(selectedDevice)

  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteDevice()
    } catch {}
    // on ok the controller has told the list and closed the panel; on a failure its alert says why
    if (!mounted.current) return
    setDeleting(false)
    setDeleteOpen(false)
  }

  const confirmLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutDevice()
    } catch {}
    if (!mounted.current) return
    setLoggingOut(false)
    setLogoutOpen(false)
  }

  const menuItems = [
    { key: 'delete', label: t('DELETE', 'Delete'), icon: Trash2, tone: 'danger', onSelect: () => setDeleteOpen(true) },
    ...(isEnabledDeleteAllSessions
      ? [{
          key: 'logout',
          label: t('LOG_OUT_ALL_DEVICES', 'Log out all devices'),
          icon: LogOut,
          // DV-10: without an owner (`user_id` empty) the request has nobody to log out
          disabled: !selectedDevice?.user_id || Boolean(logoutDeviceState?.loading),
          description: !selectedDevice?.user_id ? t('DEVICE_HAS_NO_OWNER', 'This device has no owner') : undefined,
          onSelect: () => setLogoutOpen(true)
        }]
      : [])
  ]

  const headerActions = (
    <>
      {!phone && onExpandedChange && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => split.guardPlaceChange(() => onExpandedChange(!expanded))}
        />
      )}
      {isEdit && <Menu label={t('ACTIONS', 'Actions')} icon={Ellipsis} items={menuItems} />}
    </>
  )

  const logoutTitle = ownerName
    ? t('DEVICES_LOGOUT_TITLE', 'Log out _owner_?').replace('_owner_', ownerName)
    : t('DEVICES_LOGOUT_TITLE_NO_NAME', 'Log out the owner of _name_?').replace('_name_', deviceName)
  const logoutBody = ownerName
    ? t('DEVICES_LOGOUT_BODY', "This ends every session of _owner_, the owner linked to this device, not only this device's. They will need to sign in again.").replace('_owner_', ownerName)
    : t('DEVICES_LOGOUT_BODY_NO_NAME', "This ends every session of the owner linked to this device, not only this device's. They will need to sign in again.")
  const deleteBody = storeName
    ? t('DEVICES_DELETE_BODY', "The device is removed from _store_. This can't be undone.").replace('_store_', storeName)
    : t('DEVICES_DELETE_BODY_NO_STORE', "The device is removed. This can't be undone.")

  const discard = discardTexts(t)
  const code = selectedDevice?.code
  const showCodeLabel = codeShown ? t('HIDE', 'Hide') : t('SHOW', 'Show')
  // the skeleton is for the first load only: while a search is typed the list is P/Select's own «Loading», so the select is never
  // unmounted (and its popover with the search field) between two keystrokes
  const storeLoading = Boolean(businessList?.loading) && (businesses || []).length === 0 && !storesLoaded

  return (
    <>
      <RecordPanel
        ref={panelRef}
        title={isEdit ? deviceName : t('ADD_NEW_DEVICE', 'Add new device')}
        subtitle={isEdit && storeName ? storeName : undefined}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={handleClose}
        headerActions={headerActions}
        dirty={dirty}
        discardTitle={discard.discardTitle}
        discardDescription={discard.discardDescription}
        discardConfirmLabel={discard.discardConfirmLabel}
        keepEditingLabel={discard.keepEditingLabel}
        footer={(
          <Button variant='primary' busy={saving && !deleting} onClick={handleSubmit}>
            {t('SAVE', 'Save')}
          </Button>
        )}
      >
        <div ref={bodyRef} className='odc-dp-body'>
          <TextField
            label={t('NAME', 'Name')}
            required
            requiredLabel={t('REQUIRED', 'Required')}
            value={changes.name ?? selectedDevice?.name ?? ''}
            onChange={(value) => handleChangeFormState({ name: value })}
            error={nameError}
            autoComplete='off'
          />

          {storeLoading
            ? (
              <div className='odc-dp-select'>
                <span className='odc-dp-label'>{t('DEVICE_STORE', 'Store')}</span>
                <span className='odc-dp-skeleton'><Skeleton block='var(--od-x-control-height)' /></span>
              </div>
              )
            : (
              <SelectField
                label={t('DEVICE_STORE', 'Store')}
                placeholder={t('SELECT_OPTION', 'Select an option')}
                options={storeOptions}
                value={businessId}
                valueLabel={storeName || undefined}
                // (main #486): another store drops the owner of the one before (it is not among the new store's owners)
                onValueChange={(value) => {
                  if (value === businessId) return
                  handleChangeFormState({ business_id: value, user_id: undefined })
                }}
                disabled={isEdit}
                // tanda P: Save asks for the store when adding, so its label says so beforehand, as the name's
                required={!isEdit}
                requiredLabel={t('REQUIRED', 'Required')}
                error={storeError}
                searchable
                searchValue={storeSearch}
                onSearchChange={(value) => {
                  setStoreSearch(value ?? '')
                  searchBusinesses?.(value ?? '')
                }}
                searchDelay={750} // redesign the legacy search bar waited 750 ms (lazyLoad), not a fetch per key
                searchLabel={t('SEARCH', 'Search')}
                clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
                noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
                loading={Boolean(businessList?.loading)}
                loadingLabel={t('LOADING', 'Loading')}
                footer={businessPagination?.totalPages > 1
                  ? (
                    <Pagination
                      page={businessPagination.currentPage}
                      pageSize={businessPagination.pageSize}
                      total={businessPagination.totalItems ?? undefined}
                      hasMore={businessPagination.currentPage < businessPagination.totalPages}
                      itemCount={(businessList?.businesses || []).length}
                      onPageChange={handleChangeBusinessPage}
                      busy={Boolean(businessList?.loading)}
                      label={t('PAGINATION', 'Pagination')}
                      previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
                      nextLabel={t('NEXT_PAGE', 'Next page')}
                      rangeLabel={(from, to, count, figureOf) => fill(
                        t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'),
                        { from: figureOf(from), to: figureOf(to), total: figureOf(count) }
                      )}
                      pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
                    />
                    )
                  : undefined}
              />
              )}

          {businessId != null && businessId !== '' && (owners === null && businessList?.loading
            ? (
              <div className='odc-dp-select'>
                <span className='odc-dp-label'>{t('DEVICE_OWNER', 'Owner')}</span>
                <span className='odc-dp-skeleton'><Skeleton block='var(--od-x-control-height)' /></span>
              </div>
              )
            : (
              <SelectField
                label={t('DEVICE_OWNER', 'Owner')}
                placeholder={t('SELECT_OPTION', 'Select an option')}
                options={ownerOptions}
                value={ownerValue}
                onValueChange={(value) => handleChangeFormState({ user_id: value })}
                required
                requiredLabel={t('REQUIRED', 'Required')}
                error={ownerError}
                hint={getOwnerHint()}
                loading={adminsLoading}
                loadingLabel={t('LOADING', 'Loading')}
                searchable
                searchLabel={t('SEARCH', 'Search')}
                clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
                noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
              />
              ))}

          {isEdit && (
            <div className='odc-dp-code-field'>
              <span className='odc-dp-label'>{t('DEVICE_CODE', 'Device Code')}</span>
              <div className='odc-dp-code-row'>
                {codeShown || !code
                  ? <span className='odc-figure odc-dp-code' dir='ltr'>{code ?? '—'}</span>
                  : <span className='odc-dp-code' aria-hidden='true'>••••••</span>}
                {code && (
                  <Button
                    variant='secondary'
                    aria-label={`${showCodeLabel} ${t('DEVICE_CODE', 'Device Code')}`}
                    onClick={() => setCodeShown(shown => !shown)}
                  >
                    {showCodeLabel}
                  </Button>
                )}
                <CopyButton
                  text={code ? String(code) : undefined}
                  label={t('DEVICES_COPY_DEVICE_CODE', 'Copy device code')}
                  copyLabel={t('COPY_BUTTON', 'Copy')}
                  copiedLabel={t('COPIED', 'Copied')}
                  failedLabel={t('DEVICES_COPY_FAILED', "Couldn't copy")}
                />
              </div>
            </div>
          )}
        </div>
      </RecordPanel>

      <ConfirmDialog
        open={deleteOpen}
        title={t('DEVICES_DELETE_TITLE', 'Delete _name_?').replace('_name_', deviceName)}
        confirmLabel={t('DEVICES_DELETE_CONFIRM', 'Delete device')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      >
        {deleteBody}
      </ConfirmDialog>

      <ConfirmDialog
        open={logoutOpen}
        title={logoutTitle}
        confirmLabel={t('DEVICES_LOGOUT_CONFIRM', 'Log out everywhere')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        busy={loggingOut}
        onConfirm={confirmLogout}
        onCancel={() => setLogoutOpen(false)}
      >
        {logoutBody}
      </ConfirmDialog>

      <AlertDialog
        open={Boolean(alertLines)}
        title={t('DEVICES', 'Devices')}
        content={alertLines ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('ACCEPT', 'Accept')}
        onClose={closeAlert}
      />
    </>
  )
}

const PROPS_TO_FETCH = ['id', 'name', 'logo', 'owners', 'address']

// redesign stores devices: the list is the only host, so the panel hands the controller its props one by one (no spread
// into a component, so the l4-b7 rule needs no spread exception)
export const BusinessDeviceDetail = ({
  selectedDevice,
  devices,
  handleUpdateDeviceList,
  onClose,
  onDismiss,
  onCreated,
  expanded,
  onExpandedChange,
  panelRef,
  focusCode
}) => (
  <BusinessDeviceDetailController
    UIComponent={BusinessDeviceDetailUI}
    propsToFetch={PROPS_TO_FETCH}
    selectedDevice={selectedDevice}
    devices={devices}
    handleUpdateDeviceList={handleUpdateDeviceList}
    onClose={onClose}
    onDismiss={onDismiss}
    onCreated={onCreated}
    expanded={expanded}
    onExpandedChange={onExpandedChange}
    panelRef={panelRef}
    focusCode={focusCode}
  />
)
