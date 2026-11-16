import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { UserDetails as UserDetailsController, useLanguage, useSession } from '../../../../../index'
import { isDashboardFeatureEnabled } from '../../../../../utils/dashboardFeatureAccess'
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
import { CustomerOverview } from './CustomerOverview'
import { customerName } from './customerData'
import { customerSectionIds } from './customerSections'
import './customer-panel.css'

// redesign UC-B4 (auditor #10): what K/UserDetails asks for when the panel opens a customer by `?id=` (no row from the list):
// the controller's own list, plus what the Overview and the section counts read.
const PROPS_TO_FETCH = [
  'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'country_phone_code', 'city_id', 'city', 'address', 'external_id',
  'addresses', 'address_notes', 'driver_zone_restriction', 'mono_session', 'dropdown_option_id', 'dropdown_option', 'location', 'loyalty_level',
  'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'phone_verified', 'email_verified', 'schedule', 'timezone', 'max_days_in_future',
  'occupation_id', 'occupation', 'session', 'push_tokens', 'businesses_agent', 'settings',
  'orders_count', 'loyalty_level_id', 'wallets', 'created_at'
]

const noop = () => {}

// redesign UC-R2 (Q-02): the sections list is wide when the PANEL is, not when its own column is (a stable function: SectionNav sets its observer up again when it changes)
const measurePanel = (root) => root.closest('.odc-record')

// The text of a translation with its `_name_` marker replaced (a function, so a `$` in a name stays a `$`)
const withName = (text, name) => String(text).replace('_name_', () => name)

const figure = (value) => <span className='odc-figure'>{value}</span>

// The API answers a list of messages, one text or nothing
const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

const BodySkeleton = ({ label }) => (
  <div className='ucp-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

/**
 * The UI of the customer panel (redesign UC-B4, decisions 1 and 6): one RecordPanel with the sections of the customer
 * (Overview, Orders, Wallet, Saved places, Profile, Push tokens, School students), in place of the three stacked panels
 * of main. It is the UIComponent of K/UserDetails, which brings `userState`, `handleDeleteUser` (`{ ok, error }`) and
 * `handleSuccessUserUpdate`; everything else comes from the page through `CustomerPanel`.
 */
const CustomerPanelUI = ({
  userId,
  user: row,
  userState,
  configs,
  section,
  onSectionChange,
  wallet,
  onWalletChange,
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
  renderWallet,
  profileProps
}) => {
  const [, t] = useLanguage()
  const [{ user: sessionUser }] = useSession()
  const split = useSplitView()
  const phone = split.mode === 'full'

  // Which sections have unsaved changes: they stay mounted (hidden) when the user goes elsewhere, and guard the close
  const [dirty, setDirty] = useState({})
  const dirtyOf = useMemo(() => {
    const make = id => (value) => setDirty(previous => (previous[id] === !!value ? previous : { ...previous, [id]: !!value }))
    return { profile: make('profile'), wallet: make('wallet') }
  }, [])
  const anyDirty = Object.values(dirty).some(Boolean)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // `detail` is what the controller loaded (the forms edit this one); `base` also takes the freshest row of the list
  // (its switch moved, its figures changed) so the header and the Overview never lag behind the table.
  // redesign UC-R2 (Q-01): an id that does not exist is not a loading customer. The API answers 400 `["User does not exist"]` and K/UserDetails
  // (not touched) turns an array into `user: null` with `error: null`, so «null after a load that started and ended, no error» is not-found
  // (before the load starts it is the same state, and that is loading); a non-object `user` (the message left as a string) is not-found too.
  // No Retry: the answer will not change. A network error sets `error` and keeps Retry. A row from the list means no fetch, so never this.
  const loaded = userState?.user ?? null
  const started = useRef(false)
  if (userState?.loading) started.current = true
  const notFound = (loaded != null && typeof loaded !== 'object') ||
    (started.current && !row && !userState?.loading && loaded == null && !userState?.error)
  const detail = notFound ? null : loaded
  const base = useMemo(() => (!notFound && (detail || row) ? { ...detail, ...row } : null), [detail, row, notFound])
  const failed = notFound || (Boolean(userState?.error) && !base)
  const name = base ? customerName(base, t) : t('CUSTOMER', 'Customer')
  const id = userId ?? base?.id

  const isSchoolsOn = isDashboardFeatureEnabled({ featureKey: 'schools', configs })
  const ids = customerSectionIds({ configs, isSchoolsOn })
  const current = ids.includes(section) ? section : 'overview'

  const labels = {
    overview: t('CUSTOMERS_OVERVIEW', 'Overview'),
    orders: t('ORDERS', 'Orders'),
    wallet: t('WALLET', 'Wallet'),
    addresses: t('SAVED_PLACES', 'Saved places'),
    profile: t('PROFILE', 'Profile'),
    push_tokens: t('PUSH_TOKENS', 'Push tokens'),
    school_students: t('SCHOOL_STUDENTS', 'School students')
  }
  const ordersCount = base && base.orders_count != null && Number.isFinite(Number(base.orders_count)) ? Number(base.orders_count) : null
  const items = ids.map(sectionId => ({
    id: sectionId,
    label: labels[sectionId],
    count: sectionId === 'orders' && ordersCount != null ? ordersCount : undefined
  }))

  // redesign apply-list row 20 (P-6, D-37): «Add points» asks the Wallet to open in Add with the amount focused. One shot: the wallet
  // consumes it (`onIntentConsumed`), and leaving the Wallet drops it, so a later visit behaves as before.
  const [walletIntent, setWalletIntent] = useState(null)
  const intentCount = useRef(0)
  const consumeWalletIntent = useCallback((consumed) => setWalletIntent(previous => (!consumed || previous === consumed ? null : previous)), [])
  useEffect(() => { if (current !== 'wallet') setWalletIntent(null) }, [current])

  const goTo = (sectionId, extra) => {
    if (extra?.wallet) onWalletChange?.(extra.wallet)
    setWalletIntent(extra?.mode === 'add' ? { mode: 'add', wallet: extra.wallet, id: ++intentCount.current } : null)
    onSectionChange?.(sectionId)
  }

  const saved = (updated) => {
    handleSuccessUserUpdate?.(updated)
    onRowUpdate?.(updated)
  }

  const deleteFallback = t('CUSTOMERS_DELETE_ERROR', "We couldn't delete this customer. Try again.")
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
  // As main: you cannot delete the account you are signed in with
  if (base && sessionUser?.id !== base.id) {
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
      <Menu label={t('MORE_ACTIONS', 'More actions')} icon={Ellipsis} items={menuItems} />
    </>
  )

  const pending = base != null && [...(pendingIds ?? [])].includes(base.id)
  const status = base && (
    // redesign UC-R2 (M3-4): the wrapper lets the narrow header give this row the room its 44px area needs under «Back»
    <span className='ucp-status'>
      <Switch checked={!!base.enabled} busy={pending} onCheckedChange={next => onToggleActive?.(base, next)}>
        {base.enabled ? t('ACTIVE', 'Active') : t('INACTIVE', 'Inactive')}
      </Switch>
    </span>
  )

  const subtitle = base && (
    <>
      {base.email && <><bdi>{base.email}</bdi> · </>}
      {figure(`#${base.id}`)}
    </>
  )

  const renderSection = (sectionId) => {
    // The forms edit the controller's copy; the Overview reads the freshest one
    if (sectionId === 'overview') return <CustomerOverview user={base} configs={configs} onGoTo={goTo} />
    if (!detail) return <BodySkeleton label={t('LOADING', 'Loading')} />
    switch (sectionId) {
      case 'orders':
        // redesign UC-B4 (decision 6): opens in «Completed», where the history is
        return (
          <div className='ucp-orders'>
            <OrdersManager isSelectedOrders customerId={detail.id} statusGroup='completed' handleCustomOrderDetail={noop} />
          </div>
        )
      case 'wallet':
        return renderWallet?.({ user: base, wallet, onWalletChange, onDirtyChange: dirtyOf.wallet, intent: walletIntent, onIntentConsumed: consumeWalletIntent }) ?? null
      case 'addresses':
        // The form opens in the panel (`isEmbedded`): the fixed full-screen overlay of main cannot live inside a container
        return (
          <div className='ucp-addresses'>
            <AddressList
              isEmbedded
              isSeletectedUserAddresses
              userId={detail.id}
              addresses={detail.addresses}
              userState={userState}
              // redesign (row 90, M-UF21): `saved` also tells the list, so the row refreshes after an address save
              handleSuccessUpdate={saved}
              setExtraOpen={noop}
            />
          </div>
        )
      case 'profile':
        return (
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
      case 'push_tokens':
        return <PushTokens userId={detail.id} pushTokens={detail.push_tokens || []} />
      case 'school_students':
        return <SchoolUserStudents userId={detail.id} />
      default:
        return null
    }
  }

  // Only the current section is drawn, plus any with unsaved changes (hidden): a draft survives going to another section
  const drawn = ids.filter(sectionId => sectionId === current || dirty[sectionId])

  let body
  if (notFound) {
    // redesign UC-R2 (Q-01)
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('CUSTOMERS_NOT_FOUND', "This customer doesn't exist or was deleted.")}
        action={onClose && <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>}
      />
    )
  } else if (failed) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('CUSTOMERS_DETAIL_LOAD_ERROR', "We couldn't load this customer.")}
        action={onRetry && <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  } else if (!base) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else {
    body = drawn.map(sectionId => (
      <div key={sectionId} className='ucp-section' hidden={sectionId !== current}>
        {renderSection(sectionId)}
      </div>
    ))
  }

  return (
    <>
      <RecordPanel
        title={base || failed ? name : <span className='ucp-title-skeleton'><Skeleton /></span>}
        subtitle={subtitle}
        status={status}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose}
        headerActions={headerActions}
        // redesign UC-R2 (Q-01): a customer that does not exist has no sections to go to
        nav={notFound
          ? undefined
          : (
          <SectionNav
            label={t('CUSTOMERS_SECTIONS', 'Customer sections')}
            compactLabel={t('SECTION', 'Section')}
            items={items}
            value={current}
            onValueChange={onSectionChange}
            wideMinWidth={640}
            measureTarget={measurePanel}
          />
            )}
        dirty={anyDirty}
        discardTitle={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        discardDescription={t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
        discardConfirmLabel={t('DISCARD', 'Discard')}
        keepEditingLabel={t('KEEP_EDITING', 'Keep editing')}
      >
        <div className='ucp-body'>{body}</div>
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
        title={withName(t('CUSTOMERS_DELETE_TITLE', 'Delete _name_?'), name)}
        confirmLabel={t('CUSTOMERS_DELETE_CONFIRM', 'Delete customer')}
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
        title={t('CUSTOMERS_DELETE_ERROR_TITLE', "The customer wasn't deleted")}
        content={deleteErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteErrors(null)}
      />
    </>
  )
}

/**
 * The panel of a customer (redesign UC-B4). Props:
 *  - `userId`, `user` (the row of the list; null when opened by `?id=`), `configs`;
 *  - `section`, `onSectionChange(id)`, `wallet` (`'cash' | 'points'`), `onWalletChange`, `customFieldsOpen`,
 *    `onCustomFieldsOpenChange`: the URL state the page owns;
 *  - `onClose`, `expanded`, `onExpandedChange`;
 *  - `onToggleActive(user, enabled)` and `pendingIds` (from `useCustomerActiveToggle`);
 *  - `handleSuccessUpdate(user)` (the list's: called after the controller's, when the profile saves, auditor #15) and
 *    `handleSuccessDeleteUser(user)` (the controller calls it);
 *  - `renderWallet({ user, wallet, onWalletChange, onDirtyChange, intent, onIntentConsumed })`: the wallet section, drawn by the host
 *    (`intent` is `{ mode: 'add', wallet, id }` after «Add points», else null; the wallet calls `onIntentConsumed(intent)` once it has applied it);
 *  - `profileProps`: extra props for `UserProfileForm`.
 * It mounts K/UserDetails with `CustomerPanelUI`. The list's `handleSuccessUpdate` is kept out of the controller on purpose:
 * the controller would call it from its own `handleSuccessUserUpdate`, and the panel calls it itself (once) after that.
 */
export const CustomerPanel = ({ handleSuccessUpdate, ...props }) => {
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
      UIComponent={CustomerPanelUI}
    />
  )
}
