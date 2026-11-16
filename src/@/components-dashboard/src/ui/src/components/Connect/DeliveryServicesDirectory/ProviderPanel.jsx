import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DeliveryServiceDetails as DeliveryServiceDetailsController, useApi, useLanguage } from '../../../../../index'
import { Maximize2, Minimize2 } from '../../Shared/Icon'
import {
  AlertDialog,
  AsyncSwitch,
  Button,
  IconButton,
  RecordPanel,
  ScheduleEditor,
  SectionNav,
  Skeleton,
  Status,
  useSplitView
} from '../../Shared/Product'
import { GroupZones } from '../../Shared/DeliveryZones/GroupZones'
import { DeliveryServiceBusinesses } from '../DeliveryServicesBusinesses'
import { DeliveryServicePaymethods } from '../DeliveryServicePaymethods'
import { CredentialsSection } from './CredentialsSection'
import { getScheduleLabels } from '../../../utils/scheduleLabels'
import { PROVIDER_SECTION_IDS, discardTexts, providerSections, resolveSection } from './providerSections'
import './provider-panel.css'

/**
 * The panel of a delivery provider (redesign DS-B3, decisions 1, 2, 5, 7 and 17), in place of C/N/DeliveryServiceDetails: one
 * RecordPanel with the sections of main's tab bar. It mounts K/DeliveryServiceDetails with `ProviderPanelUI`, so the controller brings
 * `deliveryServiceState`, `changesState`, `actionState`, `pluginState`, `availableModifyData` and the handlers
 * (`handleUpdateDeliveryGroup(changes)` answers `{ ok, error }`, `reloadPluginInformation()`; lot B1); everything else comes from the page.
 *
 * Props the page (lot B4) gives:
 *  - the ones C/N/DeliveryServices:165-187 gives C/N/DeliveryServiceDetails today: `deliveryServicesState`, `setDeliveryServicesState`,
 *    `scheduleState` (`{ loading, change, companyId }`), `curDriversGroup` (the group of the provider with `plugin` and `schedule`),
 *    `deliveryServiceId`, `driverGroupId`, `businesses`, `businessesLoading`, `paymethods`, `handleUpdateDeliveryService(id, changes)`
 *    (answers `{ ok, error }`), `handleScheduleState(list, companyId)`, `actionDisabled`, `deliveryGroups`, `setDeliveryGroups`;
 *  - `company`: the company of the list, fresh from the page's state at every render (the switch of the header reads its `enabled`);
 *  - `statusLabel` and `statusFamily`: the state the page computed for the company (providerData, lot B2): the translated text and the
 *    family of `Status` («Active» `done`, «Paused» `cancel`, «Credentials incomplete» `review`…). Without them no state is drawn;
 *  - `section` and `onSectionChange(id)`: the URL state the page owns (`?tab=`). `section` is the raw `?tab=`; the panel resolves
 *    it (`resolveSection`): a known and enabled key is respected, anything else is `general`;
 *  - `onClose()`, `expanded` and `onToggleExpanded()` («Open as page», not drawn on a phone or without the callback);
 *  - `onStoresChanged()`: (redesign DS-R1-02) a save of the group that carried `business` went well, so the stores count of the row
 *    is stale; the page reloads it (`reloadGroupsInfo`);
 *  - `confirmPause(company) → Promise<boolean>`: (optional, redesign D-5) the page's question before PAUSING from the header
 *    switch (AsyncSwitch's `confirmChange`); the switch saves only on a true. Resuming never asks. Without it a press saves at once;
 *  - `onDirtyChange(bool)`: whether the panel has unsaved changes; it says `false` when the panel goes away;
 *  - `panelRef`: the ref of the RecordPanel. `panelRef.current.requestClose(proceed)` asks the discard question when dirty and calls
 *    `proceed` when the user discards (or at once when clean): the guard for opening another provider;
 *  - `resetScheduleState()`: clears the schedule change the page keeps. The panel calls it when the user discards a pending schedule
 *    and when it goes away with one of its own.
 * The controller is mounted again when the company changes (`key`), so each provider starts clean.
 */

const noop = () => {}

// Props that are the panel's, not the sections': main spread the rest into each section
const PANEL_ONLY_PROPS = [
  'UIComponent',
  'section',
  'onSectionChange',
  'expanded',
  'onToggleExpanded',
  'onDirtyChange',
  'onStoresChanged',
  'confirmPause',
  'panelRef',
  'company',
  'status',
  'statusLabel',
  'statusFamily',
  'resetScheduleState'
]

// redesign DS-R1-03: the schedule of a company as a list. The synthetic API answers `schedule` as a JSON string after a save (the real one
// probably a list); the editor needs the list, and a string spread into it would be a list of characters.
const toScheduleList = (schedule) => {
  if (typeof schedule !== 'string') return schedule
  try {
    const parsed = JSON.parse(schedule)
    return Array.isArray(parsed) ? parsed : undefined
  } catch (error) {
    return undefined
  }
}

const BodySkeleton = ({ label }) => (
  <div className='dsp-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

const ProviderPanelUI = (props) => {
  const {
    company,
    deliveryServiceState,
    changesState,
    actionState,
    availableModifyData,
    scheduleState,
    handleUpdateDeliveryService,
    handleScheduleState,
    resetScheduleState,
    actionDisabled,
    statusLabel,
    statusFamily,
    section,
    onSectionChange,
    onClose,
    expanded = false,
    onToggleExpanded,
    onDirtyChange,
    onStoresChanged,
    confirmPause,
    handleUpdateDeliveryGroup,
    setAvailableModifyData,
    panelRef
  } = props

  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  const service = deliveryServiceState?.deliveryService ?? null
  const sections = providerSections({ availableModifyData, t })
  const current = resolveSection(section, sections)

  // the address says the section the person sees. main rewrote an unknown or blocked `?tab=` to `general`; the panel
  // resolves it, so it tells the page (which writes it with replaceState, no history entry). An unknown key is wrong at once. A known
  // key that is blocked may only be blocked until the credentials load, so it waits until SettingsList has reported whether they are
  // complete (`setAvailableModifyData` goes through `reportAvailability`): writing it before would lose a good `?tab=schedule`.
  const [credentialsReported, setCredentialsReported] = useState(false)
  const setAvailableRef = useRef(setAvailableModifyData)
  setAvailableRef.current = setAvailableModifyData
  const reportAvailability = useCallback((value) => {
    setAvailableRef.current?.(value)
    setCredentialsReported(true)
  }, [])
  useEffect(() => {
    if (!service || section == null || section === current) return
    if (PROVIDER_SECTION_IDS.includes(section) && !credentialsReported) return
    onSectionChange?.(current)
  }, [Boolean(service), section, current, credentialsReported])

  // redesign DS-B3 (decision 1): a section is mounted when it is visited and kept (hidden) while this is the same provider,
  // so a draft in Businesses survives a visit to Credentials. Adding is idempotent, so doing it while rendering is safe.
  const visited = useRef(new Set())
  if (service) visited.current.add(current)

  // redesign DS-B3 (decision 17 | M-DS11, M-DS30): dirty is any of the five places that can hold a draft: the credentials form (its
  // `report`), Businesses (`business` in the changes), Payment methods (`allowed_paymethods`), the schedule change that is of this
  // provider (M-DS11 a/b) and the zones (`onDirtyChange`). The automatic assignment saves on its own and is not a draft.
  const [credentialsDirty, setCredentialsDirty] = useState(false)
  const [zonesDirty, setZonesDirty] = useState(false)
  const reportCredentialsDirty = useCallback((value) => setCredentialsDirty(Boolean(value)), [])
  const reportZonesDirty = useCallback((value) => setZonesDirty(Boolean(value)), [])
  const schedulePending = Boolean(company) && scheduleState?.companyId === company.id && scheduleState?.change != null
  const changes = changesState ?? {}
  const anyDirty = Boolean(service) && (
    credentialsDirty || 'business' in changes || 'allowed_paymethods' in changes || schedulePending || zonesDirty
  )
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  useEffect(() => { onDirtyChangeRef.current?.(anyDirty) }, [anyDirty])
  useEffect(() => () => { onDirtyChangeRef.current?.(false) }, [])

  // redesign DS-B3 (decision 17): a schedule change the user discards, or that is left behind when the panel goes away, is cleared
  // in the page's state: it is not the next provider's
  const resetRef = useRef(resetScheduleState)
  resetRef.current = resetScheduleState
  const schedulePendingRef = useRef(schedulePending)
  schedulePendingRef.current = schedulePending
  useEffect(() => () => { if (schedulePendingRef.current) resetRef.current?.() }, [])
  const handleClose = () => {
    if (schedulePending) resetScheduleState?.()
    onClose?.()
  }

  // redesign DS-R1-03: the schedule the editor compares with is the one the list holds NOW, not the one copied when the panel opened.
  // After a good «Update» the editor is mounted again (`scheduleEpoch` in its key), so its change detection starts from what was saved:
  // going back to the previous schedule is a change again (Update enabled, the panel dirty).
  const [scheduleEpoch, setScheduleEpoch] = useState(0)
  const rawSchedule = company?.schedule ?? service?.schedule
  const savedSchedule = useMemo(() => toScheduleList(rawSchedule), [rawSchedule])

  // redesign DS-R1-02: the stores count of the row is the group's `business`; a save of the group that carried it makes the row stale
  const updateGroup = useCallback(async (changes) => {
    const result = await handleUpdateDeliveryGroup?.(changes)
    if (result?.ok === true && changes && Object.prototype.hasOwnProperty.call(changes, 'business')) onStoresChanged?.()
    return result
  }, [handleUpdateDeliveryGroup, onStoresChanged])

  // Errors of the saves a section makes itself (Businesses, Payment methods, the automatic assignment): an alert, as main had
  const [actionAlert, setActionAlert] = useState(null)
  useEffect(() => {
    if (actionState?.error) setActionAlert(actionState.error)
  }, [actionState?.error])

  // redesign DS-R1-06: where the focus goes when that alert closes. The «Save» that failed is disabled while it saves, loses the focus, and
  // the dialog would give it to the start of the page: it goes to the control of the panel that had it last (or to the panel).
  const bodyRef = useRef(null)
  const lastControlRef = useRef(null)
  const returnFocus = () => {
    const last = lastControlRef.current
    if (last?.isConnected && !last.disabled) return last
    const body = bodyRef.current
    const target = body?.closest('[tabindex]') ?? body?.querySelector('button:not([disabled]), input:not([disabled]), [href]') ?? body
    if (target && !target.hasAttribute('tabindex') && !target.matches('button, input, a[href]')) target.setAttribute('tabindex', '-1')
    return target
  }

  // the same fallback as the list (providerName): the id, never an empty title
  const name = String(company?.name ?? '').trim() || `#${company?.id}`

  // redesign DS-B3 (decision 7 | M-DS6): the switch reads and writes the company; the group is only mentioned when it is paused
  const groupId = service?.id ?? company?.driver_groups?.[0]?.id ?? null
  const groupPaused = props.curDriversGroup?.enabled === false
  const subtitle = (
    <>
      <span>
        <bdi dir='ltr' className='odc-figure'>{`#${company?.id}`}</bdi>
        {groupId != null && (
          <>
            {' · '}
            <bdi dir='ltr' className='odc-figure'>{t('DELIVERY_SERVICES_GROUP_NUMBER', 'group #_number_').replace('_number_', groupId)}</bdi>
          </>
        )}
      </span>
      {groupPaused && (
        <span className='dsp-group-paused'>{t('DELIVERY_SERVICES_GROUP_PAUSED', 'Group paused in Delivery groups')}</span>
      )}
    </>
  )
  const status = (
    <span className='dsp-status'>
      {statusLabel && statusFamily && <Status family={statusFamily} label={statusLabel} />}
      <AsyncSwitch
        checked={Boolean(company?.enabled)}
        disabled={Boolean(actionDisabled)}
        label={t('DELIVERY_SERVICES_ENABLE_NAME', 'Enable _name_').replace('_name_', name)}
        failureText={t('DELIVERY_SERVICES_TOGGLE_ERROR', "The provider didn't change. Try again.")}
        // redesign D-5 (owner, 2026-10-19): pausing asks first, like the row's switch; resuming is immediate
        confirmChange={confirmPause ? (next) => next || confirmPause(company) : undefined}
        onToggle={(next) => handleUpdateDeliveryService(company.id, { enabled: next })}
      />
    </span>
  )

  const headerActions = !phone && onToggleExpanded && (
    <IconButton
      icon={expanded ? Minimize2 : Maximize2}
      label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
      onClick={() => split.guardPlaceChange(() => onToggleExpanded())}
    />
  )

  // What main gave each section: all the props, plus the group the controller holds. There is no side bar now, so its two movers are no-ops.
  const sectionProps = { handleParentSidebarMove: noop, setIsExtendExtraOpen: noop }
  for (const [key, value] of Object.entries(props)) {
    if (!PANEL_ONLY_PROPS.includes(key)) sectionProps[key] = value
  }
  sectionProps.handleUpdateDeliveryGroup = updateGroup // redesign DS-R1-02
  sectionProps.setAvailableModifyData = reportAvailability //
  const discard = discardTexts(t)

  const renderSection = (id) => {
    switch (id) {
      case 'general':
        return <CredentialsSection {...sectionProps} deliveryServiceId={company.id} onDirtyChange={reportCredentialsDirty} />
      case 'businesses':
        return <DeliveryServiceBusinesses {...sectionProps} curDeliveryService={service} />
      case 'schedule':
        return (
          <>
            {/* P/ScheduleEditor, as the driver and driver company panels (same controller, same change list) */}
            <ScheduleEditor
              key={`schedule-${scheduleEpoch}`}
              labels={getScheduleLabels(t)}
              scheduleList={savedSchedule}
              handleChangeScheduleState={(list) => handleScheduleState?.(list, company.id)}
            />
            <div className='dsp-schedule-actions'>
              <Button
                variant='primary'
                busy={Boolean(scheduleState?.loading)}
                disabled={!schedulePending || Boolean(actionDisabled)}
                onClick={async () => {
                  const result = await handleUpdateDeliveryService(company.id, { schedule: JSON.stringify(scheduleState.change) })
                  if (result?.ok === true) setScheduleEpoch(count => count + 1)
                }}
              >
                {t('UPDATE', 'Update')}
              </Button>
            </div>
          </>
        )
      case 'paymethods':
        return <DeliveryServicePaymethods {...sectionProps} curDeliveryService={service} />
      case 'delivery_zones':
        return (
          <GroupZones
            drivergroup={service}
            name={name}
            discardTexts={discard}
            actionDisabled={actionDisabled}
            onDirtyChange={reportZonesDirty}
          />
        )
      default:
        return null
    }
  }

  // redesign DS-B3 (M-DS6 of the drivers panel, as there): with `actionDisabled` the content is inert and says so
  const wrap = (id) => (
    <div key={id} className='dsp-section' hidden={id !== current}>
      <div
        className='dsp-section-content'
        inert={actionDisabled ? '' : undefined}
        aria-disabled={actionDisabled ? 'true' : undefined}
      >
        {renderSection(id)}
      </div>
    </div>
  )

  const navigation = {}
  let body
  if (!service) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else {
    // redesign DS-B3 (decision 1 | auditor 1): a list at any width, so each section is one press, on a phone too
    navigation.nav = (
      <SectionNav
        label={t('DELIVERY_SERVICES_SECTIONS', 'Provider settings')}
        compactLabel={t('SECTION', 'Section')}
        items={sections}
        value={current}
        onValueChange={onSectionChange}
        listOnly
      />
    )
    body = PROVIDER_SECTION_IDS.filter(id => visited.current.has(id)).map(wrap)
  }

  return (
    <>
      <RecordPanel
        ref={panelRef}
        title={name}
        subtitle={subtitle}
        status={status}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose ? handleClose : undefined}
        headerActions={headerActions || null}
        {...navigation}
        dirty={anyDirty}
        {...discard}
      >
        <div ref={bodyRef} className='dsp-body' onFocusCapture={event => { lastControlRef.current = event.target }}>{body}</div>
      </RecordPanel>

      <AlertDialog
        open={Boolean(actionAlert)}
        returnFocus={returnFocus}
        title={t('WEB_APPNAME', 'Ordering')}
        content={actionAlert ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setActionAlert(null)}
      />
    </>
  )
}

export const ProviderPanel = (props) => {
  // main (c98a3b6f, ): the project of the API context; the raw localStorage key is namespaced for a pinned local tenant
  const [ordering] = useApi()
  return (
    // The controller has no reset: a new `key` mounts it again, which is how each provider starts clean
    <DeliveryServiceDetailsController
      key={props.company?.id}
      {...props}
      UIComponent={ProviderPanelUI}
      projectCode={ordering?.project}
    />
  )
}
