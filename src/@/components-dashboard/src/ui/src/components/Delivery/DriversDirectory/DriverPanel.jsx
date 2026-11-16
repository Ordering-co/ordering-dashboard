import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { UserDetails as UserDetailsController, useConfig, useLanguage, useSession } from '../../../../../index'
// main, the flag of the Stripe Connect section is read as main's UserDetails reads it
import { isSettingsToggleOn } from '../../../../../utils/settingsCustomSections'
import { getUserType } from '../../../utils/navigationHelpers'
import { getScheduleLabels } from '../../../utils/scheduleLabels'
import { CircleAlert, Ellipsis, FileText, Maximize2, Minimize2, Trash2 } from '../../Shared/Icon'
import {
  AlertDialog,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconButton,
  Menu,
  RecordPanel,
  ScheduleEditor,
  SectionNav,
  Skeleton,
  Switch,
  useSplitView
} from '../../Shared/Product'
import { OrdersManager } from '../../Orders/OrdersManager'
import { AddressList } from '../AddressList'
import { DriverGroupSetting } from '../DriverGroupSetting'
import { ManagedGroupsSection } from './ManagedGroupsSection'
import { DriversAdvancedLogs } from '../DriversAdvancedLogs'
import { DriversGroupLogsUI } from '../DriversGroupLogs'
import { DriversLogs } from '../DriversLogs'
import { UserProfileForm } from '../UserProfileForm'
import { PushTokens } from '../../Shared/PushTokens'
// main, main's two pieces of the Stripe Connect tab, mounted as they are
import { StripeConnectAccount } from '../../Shared/StripeConnectAccount'
import { PayoutRuleForm } from '../../Shared/PayoutRuleForm'
import { UserMetaFields } from '../../Users/UserMetaFields'
import { directoryCopy, isManagersRole } from './directoryRole'
import { driverName } from './driverData'
import { DRIVER_SECTIONS, driverSectionIds } from './driverSections'
import './driver-panel.css'

// redesign DL-B3 (decision 1 | M-DL1, auditor 4): what K/UserDetails asks for on its own (its `defaultProps`, copied: the controller does not export
// them and is not ours to change) plus what the status strip and the identity line read, so a driver opened by `?id=` or ⌘K does not lie.
const PROPS_TO_FETCH = [...new Set([
  'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'country_phone_code', 'city_id', 'city', 'address', 'external_id',
  'addresses', 'address_notes', 'driver_zone_restriction', 'mono_session', 'dropdown_option_id', 'dropdown_option', 'location', 'loyalty_level',
  'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'phone_verified', 'email_verified', 'schedule', 'timezone', 'max_days_in_future',
  'occupation_id', 'occupation', 'session', 'push_tokens', 'businesses_agent', 'settings',
  'available', 'busy', 'enabled', 'phone_verified', 'email_verified'
])]

const noop = () => {}
// as the companies' panel (CompanyPanel `sameSchedule`)
const sameSchedule = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

// the sections are wide when the PANEL is, not when its own column is (a stable function: SectionNav sets its observer up again when it changes)
const measurePanel = (root) => root.closest('.odc-record')

const figure = (value) => <span className='odc-figure'>{value}</span>

// The API answers a list of messages, one text or nothing
const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

const BodySkeleton = ({ label }) => (
  <div className='dlp-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

/**
 * The UI of the driver panel (redesign DL-B3, decisions 1, 2, 4 and 6): one RecordPanel with the seven sections of main's
 * side bar (Profile, Driver group, Saved places, Schedule, Logs, Advanced logs, Push tokens), in place of the former driver detail side bar.
 * It is the UIComponent of K/UserDetails, which brings `userState`, `handleDeleteUser` (`{ ok, error }`), `handleSuccessUserUpdate`
 * and the schedule handlers; everything else comes from the page through `DriverPanel`.
 */
const DriverPanelUI = ({
  userId,
  user: row,
  userState,
  configs,
  section,
  onSectionChange,
  customFieldsOpen,
  onCustomFieldsOpenChange,
  onClose,
  expanded = false,
  onExpandedChange,
  onToggle,
  pendingKeys,
  patch,
  actionDisabled,
  onRowUpdate,
  onRetry,
  handleDeleteUser,
  handleSuccessUserUpdate,
  scheduleState,
  handleScheduleState,
  handleScheduleUpdateUser,
  profileProps,
  onDirtyChange,
  role = 'drivers'
}) => {
  const [, t] = useLanguage()
  // redesign DM-B3 (decision 3 | M-DM1, M-DL19): `role='managers'` is the panel of a driver manager; without it (or 'drivers') nothing changes
  const managers = isManagersRole(role)
  const copy = directoryCopy(role, t)
  const [{ user: sessionUser }] = useSession()
  // main, as main's UserDetails: session level 0, the drivers page (not managers) and the payouts toggle on
  const [{ configs: projectConfigs }] = useConfig()
  const isStripeConnectEnabled = !managers && sessionUser?.level === 0 && isSettingsToggleOn(projectConfigs?.stripe_connect_payouts_enabled?.value)
  // Both are hooks in disguise (useSession): called every time, never behind a `||`
  const readOnlyAdmin = getUserType('readOnlyAdmin')
  const readOnlyDeliveryManager = getUserType('readOnlyDeliveryManager')
  const split = useSplitView()
  const phone = split.mode === 'full'

  // Which sections have unsaved changes: they stay mounted (hidden) when the user goes elsewhere, and guard the close
  const [dirty, setDirty] = useState({})
  const dirtyOf = useMemo(() => {
    const make = id => (value) => setDirty(previous => (previous[id] === !!value ? previous : { ...previous, [id]: !!value }))
    return { profile: make('profile'), driver_group: make('driver_group') }
  }, [])
  // The schedule's pending changes live in the controller (K/UserDetails `scheduleState.change`), not in the section.
  // K/Schedule reports the week it draws when the driver has none, so `change` is never empty: as the companies' panel, that
  // first report (or the saved schedule) is the baseline, and only a change that differs from it counts. A new driver starts a new baseline.
  const scheduleBaseline = useRef({ id: undefined, schedule: null })
  // The URL gives the id as text and the record as a number: one driver is one baseline
  const scheduleOwner = userState?.user?.id ?? userId
  if (scheduleBaseline.current.id !== scheduleOwner) scheduleBaseline.current = { id: scheduleOwner, schedule: null }
  if (Array.isArray(userState?.user?.schedule)) scheduleBaseline.current.schedule = userState.user.schedule
  const onScheduleChange = (next) => {
    if (scheduleBaseline.current.schedule == null) scheduleBaseline.current.schedule = next
    handleScheduleState?.(next)
  }
  const scheduleChange = scheduleState?.change ?? []
  const scheduleDirty = scheduleChange.length > 0 && !sameSchedule(scheduleChange, scheduleBaseline.current.schedule)
  const isDirty = { ...dirty, schedule: scheduleDirty }
  const anyDirty = Object.values(isDirty).some(Boolean)
  // redesign DL-B5 (review): the page guards switching driver or opening Add with it (an unsaved schedule too, not only the profile)
  useEffect(() => { onDirtyChange?.(anyDirty) }, [anyDirty])

  const [deleteErrors, setDeleteErrors] = useState(null)
  // redesign D-4 (owner, 2026-10-19): the confirmation of ⋯ › Delete (C8); `deleteBusy` paints the call in the dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const deleting = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // redesign DL-B3 (decision 1): `?tab=metafields` of main opened the Custom fields modal; here it opens the dialog over the Profile, once per arrival
  useEffect(() => {
    if (section === 'metafields') onCustomFieldsOpenChange?.(true)
  }, [section])

  // `detail` is what the controller loaded (the forms edit this one); `base` also takes the freshest row of the list and the page's
  // patch (a switch that just moved) so the header and the strip never lag behind the table.
  // An id that does not exist is not a loading driver. The API answers 400 `["User does not exist"]` and K/UserDetails (not touched)
  // turns an array into `user: null` with `error: null`, so «null after a load that started and ended, no error» is not-found (before the
  // load starts it is the same state, and that is loading); a non-object `user` (the message left as a string) is not-found too.
  // No Retry: the answer will not change. A network error sets `error` and keeps Retry. A row from the list means no fetch, so never this.
  const loaded = userState?.user ?? null
  const started = useRef(false)
  if (userState?.loading) started.current = true
  const notFound = (loaded != null && typeof loaded !== 'object') ||
    (started.current && !row && !userState?.loading && loaded == null && !userState?.error)
  const detail = notFound ? null : loaded
  // redesign DL-R1 (Q-1, Q-2): no memo. K/UsersList mutates the row in place (`_user.available = …`, `Object.assign` on save), so the
  // reference never changes and a memo keyed on it kept the old strip and the old name. Nothing depends on the identity of `base`.
  const base = !notFound && (detail || row) ? { ...detail, ...row, ...patch } : null
  const failed = notFound || (Boolean(userState?.error) && !base)
  const name = base ? driverName(base, t) : copy.one
  const id = userId ?? base?.id

  const ids = driverSectionIds({ level: sessionUser?.level, role, stripeConnect: isStripeConnectEnabled })
  // `orders` is main's URL-only tab: it has no entry in the nav. Anything else the level lacks, or does not know, is the Profile.
  // redesign DM-B3 (audit 6): main's manager panel drew every `?tab=` its body knew whatever the menu showed (the former driver detail bar), so a
  // manager keeps the driver sections (Schedule, Logs, Advanced logs, Push tokens) reachable by URL only, like `orders`.
  // main, `stripe_connect` is not in DRIVER_SECTIONS, so it is never URL-only: without the flag it is the Profile
  const urlOnly = managers ? ['orders', ...DRIVER_SECTIONS.filter(sectionId => !ids.includes(sectionId))] : ['orders']
  const current = ids.includes(section) || urlOnly.includes(section) ? section : 'profile'

  const labels = {
    profile: t('PROFILE', 'Profile'),
    driver_group: copy.groupSection,
    saved_places: t('SAVED_PLACES', 'Saved places'),
    schedule: t('SCHEDULE', 'Schedule'),
    logs: t('LOGS', 'Logs'),
    advanced_logs: t('ADVANCED_LOGS', 'Advanced logs'),
    push_tokens: t('PUSH_TOKENS', 'Push tokens'),
    // main,
    stripe_connect: t('SETTINGS_SECTION_STRIPE_CONNECT', 'Stripe Connect'),
    orders: t('ORDERS', 'Orders')
  }
  // redesign DM-R1 (review r1, R1-1): a manager reaches five sections by URL only; while one is open the nav names it at the end (selected),
  // so the selector does not read «Section» over a body with no title. Going to one of the three takes it out again.
  const shownIds = managers && !ids.includes(current) && current !== 'profile' ? [...ids, current] : ids
  const items = shownIds.map(sectionId => ({ id: sectionId, label: labels[sectionId] }))

  const disableSchedule = (configs?.allow_driver_manager_update_driver_schedule?.value === '0' && sessionUser?.level === 5) ||
    readOnlyAdmin || readOnlyDeliveryManager

  const saved = (updated) => {
    handleSuccessUserUpdate?.(updated)
    onRowUpdate?.(updated)
  }

  // redesign DL-B3 (decision 1 | M-DL2) + D-4 (owner, 2026-10-19): ⋯ › Delete asks first (C8, ConfirmDialog tone 'danger', focus on
  // Cancel); the confirm runs the controller's delete (main's call, unchanged). A failure closes the confirmation and is said in an AlertDialog.
  const deleteFallback = copy.deleteError
  const deleteDriver = async () => {
    if (deleting.current) return
    deleting.current = true
    setDeleteBusy(true)
    let result
    try {
      result = await handleDeleteUser()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    deleting.current = false
    // On ok the controller has told the list and closed the panel; there is nothing left to paint
    if (!mounted.current) return
    setDeleteBusy(false)
    setDeleteOpen(false)
    if (result && result.ok === false) setDeleteErrors(errorLines(result.error, deleteFallback))
  }

  const menuItems = [
    {
      key: 'custom-fields',
      label: t('CUSTOM_FIELDS', 'Custom fields'),
      icon: FileText,
      disabled: !!actionDisabled,
      onSelect: () => onCustomFieldsOpenChange?.(true)
    }
  ]
  // As main: you cannot delete the account you are signed in with
  if (base && sessionUser?.id !== base.id) {
    menuItems.push({
      key: 'delete',
      label: t('DELETE', 'Delete'),
      icon: Trash2,
      tone: 'danger',
      separatorBefore: true,
      disabled: !!actionDisabled,
      onSelect: () => setDeleteOpen(true)
    })
  }

  const headerActions = (
    <>
      {!phone && onExpandedChange && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => split.guardPlaceChange(() => onExpandedChange(!expanded))}
        />
      )}
      {/* as the former driver detail bar: with `actionDisabled` the menu cannot be used (main disabled its two items) */}
      <Menu label={t('MORE_ACTIONS', 'More actions')} icon={Ellipsis} items={menuItems} triggerProps={{ disabled: !!actionDisabled }} />
    </>
  )

  const pending = [...(pendingKeys ?? [])]
  const toggle = (attribute) => (next) => onToggle?.(base, attribute, next)
  const busyOf = (attribute) => pending.includes(`${base?.id}:${attribute}`)
  // redesign DL-B3 (decision 2): the three switches of the row, the same `useDriverToggles` as the list; Busy is there for every driver (main #479: it can be turned on too).
  // redesign DL-R0 (live check): under the email, full width (beside the title three switches squeezed the name onto two lines at 520px)
  const statusStrip = base && (
    <span className='dlp-status'>
      {/* redesign DM-B3 (decision 3 | M-DM1, M-DL19): a manager has no Online and no Busy, only Active */}
      {!managers && (
        <Switch checked={!!base.available} busy={busyOf('available')} disabled={!!actionDisabled} onCheckedChange={toggle('available')}>
          {t('DRIVERS_ONLINE', 'Online')}
        </Switch>
      )}
      {!managers && (
        <Switch checked={!!base.busy} busy={busyOf('busy')} disabled={!!actionDisabled} onCheckedChange={toggle('busy')}>
          {t('BUSY', 'Busy')}
        </Switch>
      )}
      <Switch checked={!!base.enabled} busy={busyOf('enabled')} disabled={!!actionDisabled} onCheckedChange={toggle('enabled')}>
        {t('ACTIVE', 'Active')}
      </Switch>
    </span>
  )

  const subtitle = base && (
    <>
      <div className='dlp-subtitle-line'>{base.email && <><bdi>{base.email}</bdi> · </>}{figure(`#${base.id}`)}</div>
      {statusStrip}
    </>
  )

  const renderSection = (sectionId) => {
    if (!detail) return <BodySkeleton label={t('LOADING', 'Loading')} />
    switch (sectionId) {
      case 'profile':
        return (
          <UserProfileForm
            {...profileProps}
            {...(managers ? { isDriversManagersPage: true } : { isDriversPage: true })}
            user={detail}
            handleSuccessUpdate={saved}
            onDirtyChange={(value) => {
              dirtyOf.profile(value)
              profileProps?.onDirtyChange?.(value)
            }}
          />
        )
      case 'driver_group':
        // (owner, option A): a manager's groups save with a bar; a driver's still save on each click
        return detail.level === 5
          ? <ManagedGroupsSection userId={detail.id} label={copy.groupSection} onDirtyChange={dirtyOf.driver_group} />
          : <DriverGroupSetting userId={detail.id} />
      case 'saved_places':
        // The form opens in the panel (`isEmbedded`): the fixed full-screen overlay of main cannot live inside a container, and passing
        // `setExtraOpen` would widen it to a second, empty column
        return (
          <div className='odc-uf-saved-places dlp-addresses'>
            <AddressList
              isEmbedded
              isSeletectedUserAddresses
              userId={detail.id}
              addresses={detail.addresses}
              userState={userState}
              handleSuccessUpdate={handleSuccessUserUpdate}
            />
          </div>
        )
      case 'schedule':
        // redesign DL-B3 (decision 6): the Product editor; the date of each day goes through parseDate (the project's format, decision 13)
        return (
          <div className='dlp-schedule'>
            <ScheduleEditor
              isShowDate={!managers} // as the former driver detail bar (`isShowDate={!!isDriversPage}`): the dates only on a driver's schedule
              scheduleList={detail.schedule}
              handleChangeScheduleState={onScheduleChange}
              disableSchedule={disableSchedule}
              labels={getScheduleLabels(t)}
            />
            {!disableSchedule && (
              <div className='dlp-schedule-actions'>
                <Button
                  variant='primary'
                  busy={!!scheduleState?.loading}
                  disabled={!scheduleDirty}
                  onClick={() => handleScheduleUpdateUser()}
                >
                  {t('UPDATE', 'Update')}
                </Button>
              </div>
            )}
          </div>
        )
      case 'logs':
        return <DriversLogs userId={detail.id} UIComponent={DriversGroupLogsUI} formatDates />
      case 'advanced_logs':
        return <DriversAdvancedLogs userId={detail.id} UIComponent={DriversGroupLogsUI} formatDates />
      case 'push_tokens':
        return <PushTokens userId={detail.id} pushTokens={detail.push_tokens || []} />
      case 'stripe_connect':
        // main, the account the driver is paid on, then their own payout rule (main's UserDetails:241-246)
        return (
          <div className='dlp-stripe-connect'>
            <StripeConnectAccount ownerType='driver' ownerId={detail.id} />
            <PayoutRuleForm scope='driver' ownerId={detail.id} />
          </div>
        )
      case 'orders':
        // main's `?tab=orders` (no entry in the nav): the orders of the user, as the former driver detail bar
        return (
          <div className='dlp-orders'>
            <OrdersManager isSelectedOrders customerId={detail.id} handleCustomOrderDetail={noop} />
          </div>
        )
      default:
        return null
    }
  }

  // Only the current section is drawn, plus any with unsaved changes (hidden): a draft survives going to another section
  const drawn = [...ids, ...urlOnly].filter(sectionId => sectionId === current || isDirty[sectionId])

  let body
  if (notFound) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={copy.notFound}
        action={onClose && <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>}
      />
    )
  } else if (failed) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={copy.detailLoadError}
        action={onRetry && <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  } else if (!base) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else {
    body = drawn.map(sectionId => (
      <div key={sectionId} className='dlp-section' hidden={sectionId !== current}>
        {renderSection(sectionId)}
      </div>
    ))
  }

  return (
    <>
      <RecordPanel
        title={base || failed ? name : <span className='dlp-title-skeleton'><Skeleton /></span>}
        subtitle={subtitle}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose}
        headerActions={headerActions}
        // a driver that does not exist has no sections to go to
        nav={notFound
          ? undefined
          : (
          <SectionNav
            label={copy.sections}
            compactLabel={t('SECTION', 'Section')}
            items={items}
            value={current}
            onValueChange={onSectionChange}
            // redesign DM-B3 (decision 3, audit 4): the same threshold for both roles: SectionNav is a vertical list, and RecordPanel puts it
            // beside the body only from 640px, so a lower one stacked the three buttons over the body; the docked panel shows the selector
            wideMinWidth={640}
            measureTarget={measurePanel}
          />
            )}
        dirty={anyDirty}
        discardTitle={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        discardDescription={t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
        discardConfirmLabel={t('DISCARD', 'Discard')}
        keepEditingLabel={t('KEEP_EDITING', 'Keep editing')}
      >
        <div className='dlp-body'>{body}</div>
      </RecordPanel>

      <Dialog
        open={!!customFieldsOpen && !failed}
        onOpenChange={next => onCustomFieldsOpenChange?.(next)}
        size='lg'
        title={t('CUSTOM_FIELDS', 'Custom fields')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <UserMetaFields userId={id} />
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title={copy.deleteTitle.replace('_name_', name)}
        confirmLabel={copy.deleteConfirm}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        busy={deleteBusy}
        onConfirm={deleteDriver}
        onCancel={() => setDeleteOpen(false)}
      >
        {copy.deleteBody}
      </ConfirmDialog>

      <AlertDialog
        open={!!deleteErrors}
        title={copy.deleteErrorTitle}
        content={deleteErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteErrors(null)}
      />
    </>
  )
}

/**
 * The panel of a driver (redesign DL-B3). Props:
 *  - `userId`, `user` (the row of the list; null when opened by `?id=`), `configs`;
 *  - `section`, `onSectionChange(id)`, `customFieldsOpen`, `onCustomFieldsOpenChange`: the URL state the page owns
 *    (`section` comes from `sectionFromTab(?tab=)`);
 *  - `onClose`, `expanded`, `onExpandedChange`;
 *  - `onToggle(user, attribute, next)` and `pendingKeys` (`${id}:${attribute}`) from `useDriverToggles`, and `patch`, the
 *    latest values the page knows for this driver (merged on top of the row and the detail);
 *  - `actionDisabled`: disables the switches and the ⋯ menu, as main did;
 *  - `handleSuccessUpdate(user)` (the list's: called after the controller's, when the profile saves) and
 *    `handleSuccessDeleteUser(user)` (the controller calls it);
 *  - `profileProps`: extra props for `UserProfileForm`;
 *  - `role` (redesign DM-B3, opt-in): `'drivers'` (default) or `'managers'`, the panel of a driver manager: three sections (Profile, Saved places,
 *    Managed groups), only the Active switch, the managers' profile form and the managers' texts (D/directoryRole).
 * It mounts K/UserDetails with `DriverPanelUI`. The list's `handleSuccessUpdate` is kept out of the controller on purpose:
 * the controller would call it from its own `handleSuccessUserUpdate`, and the panel calls it itself (once) after that.
 */
export const DriverPanel = ({ handleSuccessUpdate, ...props }) => {
  // The controller has no refetch: a new `key` mounts it again, which asks the API again
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(count => count + 1), [])
  return (
    <UserDetailsController
      key={`${props.userId}:${attempt}`}
      {...props}
      propsToFetch={PROPS_TO_FETCH}
      onRowUpdate={handleSuccessUpdate}
      onRetry={retry}
      UIComponent={DriverPanelUI}
    />
  )
}
