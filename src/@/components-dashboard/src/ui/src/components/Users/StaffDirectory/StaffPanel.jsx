import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { UserDetails as UserDetailsController, useLanguage, useSession } from '../../../../../index'
import { isDashboardFeatureEnabled } from '../../../../../utils/dashboardFeatureAccess'
import { phoneOf, userFullName } from '../../../../../utils/userContact'
import { Calendar, Check, CircleAlert, Ellipsis, FileText, LoaderCircle, Maximize2, Minimize2, Trash2 } from '../../Shared/Icon'
import {
  AlertDialog,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconButton,
  Menu,
  RecordPanel,
  SectionNav,
  Skeleton,
  Switch,
  useSplitView
} from '../../Shared/Product'
import { OrdersManager } from '../../Orders/OrdersManager'
import { AddressList } from '../../Delivery/AddressList'
import { PushTokens } from '../../Shared/PushTokens'
import { SchoolUserStudents } from '../../Schools/SchoolUserStudents'
import { UserMetaFields } from '../UserMetaFields'
import { UserProfileForm } from '../UserProfileForm'
import { ProfessionalScheduleSection } from './ProfessionalScheduleSection'
import { ProfessionalServicesSection } from './ProfessionalServicesSection'
import { say, sectionOrDefault, staffSectionIds } from './staffKinds'
import './staff-panel.css'

// redesign BO-B4 (auditor #10): what K/UserDetails asks for when the panel opens a record by `?id=` (no row from the list). It is the
// customers' panel's list plus `businesses` (id and name), so a record opened by `?id=` has its stores; `businesses_agent` was there.
const PROPS_TO_FETCH = [
  'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'country_phone_code', 'city_id', 'city', 'address', 'external_id',
  'addresses', 'address_notes', 'driver_zone_restriction', 'mono_session', 'dropdown_option_id', 'dropdown_option', 'location', 'loyalty_level',
  'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'phone_verified', 'email_verified', 'schedule', 'timezone', 'max_days_in_future',
  'occupation_id', 'occupation', 'session', 'push_tokens', 'businesses_agent', 'settings',
  'orders_count', 'loyalty_level_id', 'wallets', 'created_at',
  'businesses', 'protected'
]

const noop = () => {}

// Up to this many sections are tabs; more are a SectionNav (decision 35 of the owner)
const MAX_TABS = 4

// (R3), as the customers' panel: the sections list is wide when the PANEL is, not when its own column is (a stable function:
// SectionNav sets its observer up again when it changes)
const measurePanel = (root) => root.closest('.odc-record')

// The text of a translation with its `_name_` marker replaced (a function, so a `$` in a name stays a `$`)
const withName = (text, name) => String(text).replace('_name_', () => name)

const figure = (value) => <span className='odc-figure'>{value}</span>

// The API answers a list of messages, one text or nothing
const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

// The icon of a busy IconButton: IconButton gives its icon no spin class, and `.odc-btn .odc-spin` is the Product button's own rule
const SpinningLoader = ({ className, ...props }) => <LoaderCircle {...props} className={`${className ?? ''} odc-spin`.trim()} />

const BodySkeleton = ({ label }) => (
  <div className='sdp-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

/**
 * The UI of the staff panel (redesign BO-B4, decisions 1 and 3): one RecordPanel with the sections of the record as tabs
 * (Profile, Saved places, Stores, Orders, …; as main's `?tab=`), in place of the three stacked panels of main. With more than four
 * sections (a call center agent, or any record with School students) the tabs are a SectionNav (R3, decision 35). It is the UIComponent
 * of K/UserDetails, which brings `userState`, `handleDeleteUser` (`{ ok, error }`) and `handleSuccessUserUpdate`; everything else
 * comes from the page through `StaffPanel`.
 */
const StaffPanelUI = ({
  kind,
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
  onToggleActive,
  pendingIds,
  onRowUpdate,
  onRetry,
  handleDeleteUser,
  handleSuccessUserUpdate,
  handleGoogleCalendarSync,
  actionStatus,
  renderStores,
  profileProps
}) => {
  const [, t] = useLanguage()
  const [{ user: sessionUser }] = useSession()
  const ownReasonId = useId()
  const split = useSplitView()
  const phone = split.mode === 'full'

  // Which sections have unsaved changes: they guard the close. A section the user visited stays mounted (hidden), so its draft survives.
  const [dirty, setDirty] = useState({})
  const dirtyOf = useMemo(() => {
    const make = id => (value) => setDirty(previous => (previous[id] === !!value ? previous : { ...previous, [id]: !!value }))
    return { profile: make('profile'), businesses: make('businesses'), schedule: make('schedule') }
  }, [])
  const anyDirty = Object.values(dirty).some(Boolean)

  // The sections the user has been to: their content is mounted from then on. The ones never visited cost nothing (no orders, no catalog).
  const visited = useRef(new Set())

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // redesign (B1c, decision 9 and auditor 5): Calendar sync of a professional. The button is busy from the panel's OWN state:
  // K/UserDetails sets `actionStatus.loading` to true when it starts and never back to false after a success. Its error (`actionStatus.error`,
  // a list of messages or a text) opens an alert when it turns into a value. The Google account link (OAuth) is not called from here.
  const [syncing, setSyncing] = useState(false)
  const [syncErrors, setSyncErrors] = useState(null)
  const syncError = actionStatus?.error
  const syncFallback = t('PROFESSIONALS_CALENDAR_SYNC_ERROR', "We couldn't sync the calendar. Try again.")
  useEffect(() => {
    if (kind.calendarSync && syncError) setSyncErrors(errorLines(syncError, syncFallback))
  }, [syncError])
  const calendarSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await handleGoogleCalendarSync?.()
    } catch (error) {
      // The controller reports its own failures through `actionStatus.error`; a promise that rejects anyway must not leave the button busy
    } finally {
      if (mounted.current) setSyncing(false)
    }
  }

  // `detail` is what the controller loaded (the forms edit this one); `base` also takes the freshest row of the list
  // (its switch moved, its figures changed) so the header never lags behind the table.
  // An id that does not exist is not a loading record. The API answers 400 `["User does not exist"]` and K/UserDetails (not touched)
  // turns an array into `user: null` with `error: null`, so «null after a load that started and ended, no error» is not-found (before
  // the load starts it is the same state, and that is loading); a non-object `user` (the message left as a string) is not-found too.
  // No Retry: the answer will not change. A network error sets `error` and keeps Retry. A row from the list means no fetch, so never this.
  const loaded = userState?.user ?? null
  const started = useRef(false)
  if (userState?.loading) started.current = true
  const notFound = (loaded != null && typeof loaded !== 'object') ||
    (started.current && !row && !userState?.loading && loaded == null && !userState?.error)
  const detail = notFound ? null : loaded
  // Not memoized (R2-2): K/UserDetails and K/UsersList change the user object IN PLACE when the profile saves, so a memo on `[detail, row]`
  // never recomputes and the title keeps the old name. The spread is cheap, and nothing here depends on `base` by identity.
  const base = !notFound && (detail || row) ? { ...detail, ...row } : null
  const failed = notFound || (Boolean(userState?.error) && !base)
  const name = base ? userFullName(base) || t('CUSTOMERS_NO_NAME', 'No name') : say(t, kind.text.one)
  const id = userId ?? base?.id

  // The sections follow the level of the RECORD, as main's menu does: saving the profile with another level changes them
  const isSchoolsOn = isDashboardFeatureEnabled({ featureKey: 'schools', configs })
  const level = base?.level != null && Number.isFinite(Number(base.level)) ? Number(base.level) : kind.level
  const ids = staffSectionIds({ level, isSchoolsOn })
  const current = sectionOrDefault(section, ids)
  if (base && !failed) visited.current.add(current)

  const labels = {
    profile: t('PROFILE', 'Profile'),
    saved_places: t('SAVED_PLACES', 'Saved places'),
    businesses: t('STAFF_STORES', 'Stores'),
    orders: t('ORDERS', 'Orders'),
    push_tokens: t('PUSH_TOKENS', 'Push tokens'),
    school_students: t('SCHOOL_STUDENTS', 'School students'),
    schedule: t('SCHEDULE', 'Schedule'),
    business_services: t('BUSINESS_AND_SERVICES', 'Business & Services')
  }

  const saved = (updated) => {
    handleSuccessUserUpdate?.(updated)
    onRowUpdate?.(updated)
  }

  const deleteFallback = say(t, kind.text.deleteError)
  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    let result
    try {
      result = await handleDeleteUser()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    // On ok the controller has told the list and closed the panel; there is nothing left to paint
    if (!mounted.current) return
    setDeleting(false)
    setDeleteOpen(false)
    if (!result?.ok) setDeleteErrors(errorLines(result?.error, deleteFallback))
  }
  const cancelDelete = () => { if (!deleting) setDeleteOpen(false) }

  const menuItems = [
    {
      key: 'custom-fields',
      label: t('CUSTOM_FIELDS', 'Custom fields'),
      icon: FileText,
      onSelect: () => onCustomFieldsOpenChange?.(true)
    }
  ]
  // As main: you cannot delete the account you are signed in with. A professional (`deleteRequiresLevel0`) is deleted only by a level 0
  // session (main, ProfessionalDetail); the other kinds do not look at the level of the session.
  if (base && !base.protected && sessionUser?.id !== base.id && (!kind.deleteRequiresLevel0 || sessionUser?.level === 0)) {
    menuItems.push({
      key: 'delete',
      label: t('DELETE', 'Delete'),
      icon: Trash2,
      tone: 'danger',
      separatorBefore: true,
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
      {/* review r1 #2: a text button in the split view left the record's name no room; it has its text only as a page. Phase 3 F3: the
          icon keeps the space its 44px area needs from the ⋯ menu (.sdp-sync) */}
      {kind.calendarSync && (phone || !expanded
        ? (
          <IconButton
            className='sdp-sync'
            icon={syncing ? SpinningLoader : Calendar}
            label={t('CALENDAR_SYNC', 'Calendar sync')}
            aria-busy={syncing || undefined}
            data-busy={syncing ? 'true' : undefined}
            onClick={syncing ? undefined : calendarSync}
          />
          )
        : (
          <Button icon={Calendar} busy={syncing} onClick={calendarSync}>
            {t('CALENDAR_SYNC', 'Calendar sync')}
          </Button>
          ))}
      <Menu label={t('MORE_ACTIONS', 'More actions')} icon={Ellipsis} items={menuItems} />
    </>
  )

  const pending = base != null && [...(pendingIds ?? [])].includes(base.id)
  // redesign D-3 (owner, 2026-10-19): you cannot deactivate the account you are signed in with. The switch stays, disabled, and
  // the reason is its accessible description, a `title` on the wrapper (which answers over a disabled button too) and, R-4, a visible line
  const ownRecord = base != null && sessionUser?.id != null && String(sessionUser.id) === String(base.id)
  const ownReason = t('STAFF_CANNOT_DEACTIVATE_SELF', "You can't deactivate your own account.")
  const protectedRecord = !ownRecord && !!base?.protected
  const protectedReason = t('STAFF_PROTECTED_CANNOT_DEACTIVATE', "You can't deactivate a protected account.")
  const lockReason = ownRecord ? ownReason : (protectedRecord && base.enabled ? protectedReason : null)
  const lockNote = ownRecord
    ? t('STAFF_CANNOT_CHANGE_SELF', "You can't deactivate or delete your own account.")
    : (protectedRecord ? t('STAFF_PROTECTED_CANNOT_CHANGE', "This account is protected. You can't deactivate or delete it.") : null)
  const status = base && (
    // The wrapper lets the narrow header give this row the room its 44px area needs under «Back»
    <span className={lockNote ? 'sdp-status sdp-status-own' : 'sdp-status'} title={lockReason ?? undefined}>
      <Switch
        checked={!!base.enabled}
        busy={pending}
        disabled={!!lockReason}
        aria-describedby={lockReason ? ownReasonId : undefined}
        onCheckedChange={next => onToggleActive?.(base, next)}
      >
        {base.enabled ? t('ACTIVE', 'Active') : t('INACTIVE', 'Inactive')}
      </Switch>
      {lockReason && <span id={ownReasonId} className='odc-sr-only'>{lockReason}</span>}
      {/* redesign R-4: a touch user never sees the `title`, so the reason is also a visible hint line under the switch (the
          Field hint pattern). It repeats the switch's description, so it is hidden from assistive tech rather than read twice. */}
      {lockNote && (
        <span className='odc-field-hint sdp-self-note' aria-hidden='true'>
          {lockNote}
        </span>
      )}
    </span>
  )

  // «email ✓ · phone ✓ · #id»: a mark is the check with its name, only for what is verified
  const verifiedMark = () => (
    <span className='sdp-verified' role='img' aria-label={t('VERIFIED', 'Verified')}>
      <Check className='odc-icon' aria-hidden='true' />
    </span>
  )
  const subtitleParts = []
  if (base?.email) {
    subtitleParts.push(
      <span key='email' className='sdp-inline'>
        <bdi className='sdp-datum'>{base.email}</bdi>
        {!!base.email_verified && verifiedMark()}
      </span>
    )
  }
  const phoneText = base ? phoneOf(base) : null
  if (phoneText) {
    subtitleParts.push(
      <span key='phone' className='sdp-inline'>
        <bdi className='sdp-datum'>{phoneText}</bdi>
        {!!base.phone_verified && verifiedMark()}
      </span>
    )
  }
  if (base) subtitleParts.push(<React.Fragment key='id'>{figure(`#${base.id}`)}</React.Fragment>)
  const subtitle = base && (
    <>
      {subtitleParts.map((part, index) => (
        <React.Fragment key={part.key}>{index > 0 && ' · '}{part}</React.Fragment>
      ))}
    </>
  )

  const renderSection = (sectionId) => {
    if (!detail) return <BodySkeleton label={t('LOADING', 'Loading')} />
    switch (sectionId) {
      case 'profile':
        return (
          // redesign BO-B6: the host hears the profile draft too (its guard when switching record or opening the add form)
          <UserProfileForm
            {...profileProps}
            user={detail}
            handleSuccessUpdate={saved}
            onDirtyChange={(isDirty) => {
              dirtyOf.profile(isDirty)
              profileProps?.onDirtyChange?.(isDirty)
            }}
          />
        )
      case 'saved_places':
        // The form opens in the panel (`isEmbedded`): the fixed full-screen overlay of main cannot live inside a container
        return (
          <div className='sdp-addresses'>
            <AddressList
              isEmbedded
              isSeletectedUserAddresses
              userId={detail.id}
              addresses={detail.addresses}
              userState={userState}
              handleSuccessUpdate={handleSuccessUserUpdate}
              setExtraOpen={noop}
            />
          </div>
        )
      case 'businesses':
        // The Stores section is the host's (B5); here is its place and its draft in the discard guard. `level` is the number that
        // decided the sections above, so the host reads the stores of the same kind of user the panel is showing (CA-3)
        return renderStores?.({ user: detail, level, onDirtyChange: dirtyOf.businesses }) ?? null
      case 'orders':
        // As main: the orders the record placed as a customer, opening where main opens (no status group)
        return (
          <div className='sdp-orders'>
            <OrdersManager isSelectedOrders customerId={detail.id} handleCustomOrderDetail={noop} />
          </div>
        )
      case 'push_tokens':
        return <PushTokens userId={detail.id} pushTokens={detail.push_tokens || []} />
      case 'school_students':
        return <SchoolUserStudents userId={detail.id} />
      case 'schedule':
        // (B1c): saved by K/ProfessionalSchedule; its draft joins the discard guard as the profile's does
        return <ProfessionalScheduleSection user={detail} handleSuccessUpdate={saved} onDirtyChange={dirtyOf.schedule} />
      case 'business_services':
        return <ProfessionalServicesSection user={detail} />
      default:
        return null
    }
  }

  let body = null
  let tabs
  let nav
  if (notFound) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={say(t, kind.text.notFound)}
        action={onClose && <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>}
      />
    )
  } else if (failed) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={say(t, kind.text.detailLoadError)}
        action={onRetry && <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  } else if (!base) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else if (ids.length > MAX_TABS) {
    // (R3, decision 35): more than four sections are a vertical list (a selector in a narrow panel), never tabs that scroll
    // sideways. The choice is by the number of sections of the record, not by the kind of the page. As the customers' panel: the sections
    // the user has been to stay mounted (hidden when they are not the current one), so a draft survives; the others cost nothing.
    nav = (
      <SectionNav
        label={say(t, kind.text.sections)}
        compactLabel={t('SECTION', 'Section')}
        items={ids.map(sectionId => ({ id: sectionId, label: labels[sectionId] }))}
        value={current}
        onValueChange={onSectionChange}
        wideMinWidth={640}
        measureTarget={measurePanel}
      />
    )
    body = ids.filter(sectionId => visited.current.has(sectionId)).map(sectionId => (
      <div key={sectionId} className='sdp-section' hidden={sectionId !== current}>
        {renderSection(sectionId)}
      </div>
    ))
  } else {
    // Every tab keeps its panel, but only a visited one has content: the others are null
    tabs = {
      label: say(t, kind.text.sections),
      value: current,
      onValueChange: onSectionChange,
      // redesign (row 91 O1): at 390 the fourth tab («Push tokens») was off view behind the fade; four tabs now break into lines
      wrap: true,
      items: ids.map(sectionId => ({
        value: sectionId,
        label: labels[sectionId],
        content: visited.current.has(sectionId) ? <div className='sdp-section'>{renderSection(sectionId)}</div> : null
      }))
    }
  }

  return (
    <>
      <RecordPanel
        title={base || failed ? name : <span className='sdp-title-skeleton'><Skeleton /></span>}
        subtitle={subtitle}
        status={status}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose}
        headerActions={headerActions}
        tabs={tabs}
        nav={nav}
        dirty={anyDirty}
        discardTitle={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        discardDescription={t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
        discardConfirmLabel={t('DISCARD', 'Discard')}
        keepEditingLabel={t('KEEP_EDITING', 'Keep editing')}
      >
        {body && <div className='sdp-body'>{body}</div>}
      </RecordPanel>

      <Dialog
        open={!!customFieldsOpen}
        onOpenChange={next => onCustomFieldsOpenChange?.(next)}
        size='lg'
        title={t('CUSTOM_FIELDS', 'Custom fields')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <UserMetaFields userId={id} />
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        tone='danger'
        title={withName(t('STAFF_DELETE_TITLE', 'Delete _name_?'), name)}
        confirmLabel={say(t, kind.text.deleteConfirm)}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      >
        {t('CUSTOMERS_DELETE_BODY', "This can't be undone.")}
      </ConfirmDialog>

      <AlertDialog
        open={!!deleteErrors}
        title={say(t, kind.text.deleteErrorTitle)}
        content={deleteErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteErrors(null)}
      />

      {kind.calendarSync && (
        <AlertDialog
          open={!!syncErrors}
          title={t('CALENDAR_SYNC', 'Calendar sync')}
          content={syncErrors ?? []}
          closeLabel={t('CLOSE', 'Close')}
          confirmLabel={t('OK', 'OK')}
          onClose={() => setSyncErrors(null)}
        />
      )}
    </>
  )
}

/**
 * The panel of a staff record (redesign BO-B4), driven by a kind (`STAFF_KINDS[...]`). Props:
 *  - `kind`, `userId`, `user` (the row of the list; null when opened by `?id=`), `configs`;
 *  - `section`, `onSectionChange(id)`, `customFieldsOpen`, `onCustomFieldsOpenChange`: the URL state the page owns (`useStaffQuery`);
 *  - `onClose`, `expanded`, `onExpandedChange`;
 *  - `onToggleActive(user, enabled)` and `pendingIds` (from the active toggle);
 *  - `handleSuccessUpdate(user)` (the list's: called after the controller's, when the profile saves) and
 *    `handleSuccessDeleteUser(user)` (the controller calls it);
 *  - `renderStores({ user, level, onDirtyChange })`: the Stores section, drawn by the host (B5). `level` is the record's level (the
 *    row of the list over the detail, else `kind.level`): the same one that picks the sections.
 * It mounts K/UserDetails with `StaffPanelUI`. The list's `handleSuccessUpdate` is kept out of the controller on purpose:
 * the controller would call it from its own `handleSuccessUserUpdate`, and the panel calls it itself (once) after that.
 */
export const StaffPanel = ({ handleSuccessUpdate, ...props }) => {
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
      UIComponent={StaffPanelUI}
    />
  )
}
