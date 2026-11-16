import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

import {
  DriversGroupDetails as DriversGroupDetailsController,
  useConfig,
  useLanguage,
  useSession
} from '../../../../../index'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { learnOptionsValues } from '../../../utils/learnOptionsValues'
import { CircleAlert, Ellipsis, Maximize2, Minimize2, Trash2 } from '../../Shared/Icon'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import {
  AlertDialog,
  AsyncSwitch,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Menu,
  RecordPanel,
  SectionNav,
  Skeleton,
  Status,
  useSplitView
} from '../../Shared/Product'
import { DriversGroupBusinesses } from '../DriversGroupBusinesses'
import { DriversGroupGeneralForm } from '../DriversGroupGeneralForm'
import { DriversGroupLogistics } from '../DriversGroupLogistics'
import { DriversGroupLogs } from '../DriversGroupLogs'
import { DriversGroupPaymethods } from '../DriversGroupPaymethods'
import { DriversGroupSchedule } from '../DriversGroupSchedule'
import { GroupZones } from '../../Shared/DeliveryZones/GroupZones' // redesign DS-B0: promoted
import { GROUP_SECTION_IDS, discardTexts, groupSections, resolveSection, usesSectionNav } from './groupSections'
import './group-panel.css'

/**
 * The panel of a delivery group (redesign DG-B4, decisions 1, 5, 6 and 17), in place of D/DriversGroupDetails: one RecordPanel with
 * the sections of main's tab bar. It mounts K/DriversGroupDetails with `GroupPanelUI`, so the controller brings `driversGroupState`,
 * `changesState`, `actionState` and the handlers (`handleUpdateDriversGroup(changes)` and `handleDeleteDriversGroup()` answer
 * `{ ok, error }`, lot B1); everything else comes from the page.
 *
 * Props the page (lot B5) gives:
 *  - the ones D/DriversGroupsListing:269-298 gives D/DriversGroupDetails today: `driversGroupsState`, `setDriversGroupsState`,
 *    `curDriversGroup` (the row of the list; undefined when opened by `?id=`), `driversGroupId`, `driversManagers`, `businesses`,
 *    `businessesLoading`, `paymethods`, `drivers`, `companies`, `searchBusinesses`, `handleChangeBusinessPage`,
 *    `handleChangeBusinessPageSize`, `businessesPaginationProps`, `onClose`, `isTourOpen`, `handleNextTour`, `actionDisabled`, and
 *    (no side bar now, so optional, no-ops by default) `handleParentSidebarMove`, `setIsExtendExtraOpen`, `isExtendExtraOpen`;
 *  - `section` and `onSectionChange(id)`: the URL state the page owns (`?tab=`). `section` is the raw `?tab=`; the panel resolves
 *    it (`resolveSection`): a key main knew is respected, nothing or an unknown one is `general`;
 *  - `onClose()`, `expanded` and `onToggleExpanded()` («Open as page», not drawn on a phone or without the callback);
 *  - `onDirtyChange(bool)`: whether the panel has unsaved changes (the group's `changesState` or the zones' draft); it says
 *    `false` when the panel goes away;
 *  - `panelRef`: the ref of the RecordPanel. `panelRef.current.requestClose(proceed)` asks the discard question when dirty and
 *    calls `proceed` when the user discards (or at once when clean): the guard for opening another group.
 * The panel remounts the controller when `driversGroupId` changes (and on «Retry»), so each group starts clean.
 */

const noop = () => {}

// Props that are the panel's, not the sections': main spread the rest into each section
const PANEL_ONLY_PROPS = ['UIComponent', 'section', 'onSectionChange', 'expanded', 'onToggleExpanded', 'onDirtyChange', 'panelRef', 'onRetry', 'refreshOnOpen']

const PRIORITY_LABELS = (t) => ({
  '-1': t('LOW', 'Low'),
  0: t('NORMAL', 'Normal'),
  1: t('HIGH', 'High'),
  2: t('URGENT', 'Urgent')
})

// measured on the PANEL, not on the column of the nav (a stable function: SectionNav sets its observer up again when it changes)
const measurePanel = (root) => root.closest('.odc-record')

// The API answers a list of messages, one text or nothing
const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

const BodySkeleton = ({ label }) => (
  <div className='gp-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

const GroupPanelUI = (props) => {
  const {
    driversGroupState,
    changesState,
    actionState,
    handleUpdateDriversGroup,
    handleDeleteDriversGroup,
    handleNextTour,
    actionDisabled,
    section,
    onSectionChange,
    onClose,
    expanded = false,
    onToggleExpanded,
    onDirtyChange,
    panelRef,
    onRetry
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [configState] = useConfig()
  const split = useSplitView()
  const phone = split.mode === 'full'

  const group = driversGroupState?.driversGroup ?? null
  const loading = Boolean(driversGroupState?.loading)
  // redesign DG-B4 (M-DG12): a group that did not open (not found, an error, nothing at all) is never the add form
  const failed = !group && !loading
  const level = user?.level
  const sections = groupSections({ group, level, autoassignType: configState?.configs?.autoassign_type?.value, t })
  const current = resolveSection(section, sections)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // redesign DG-B4 (decision 17): dirty is the group's own changes (the General form and the others write to `changesState`)
  // or what the zones report (unchecked-saved boxes, the form of the zone that is open)
  const [zonesDirty, setZonesDirty] = useState(false)
  const reportZonesDirty = useCallback((value) => setZonesDirty(Boolean(value)), [])
  const anyDirty = Boolean(group) && (Object.keys(changesState ?? {}).length > 0 || zonesDirty)
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  useEffect(() => { onDirtyChangeRef.current?.(anyDirty) }, [anyDirty])
  useEffect(() => () => { onDirtyChangeRef.current?.(false) }, [])

  // a save that worked empties `changesState`, so «Save» of General and Businesses turns `disabled` and takes the focus
  // with it (<body>). When that leaves the focus on <body> or on a disabled control, it goes to the panel itself; a focus that is
  // somewhere else (a dialog, another field, the header switch) is left alone. Same rule as the promotion panel.
  const panelId = useId()
  const wasSaving = useRef(false)
  useEffect(() => {
    let frame = 0
    if (wasSaving.current && !actionState?.loading && !actionState?.error) {
      frame = window.requestAnimationFrame(() => {
        const active = document.activeElement
        if (active && active !== document.body && active.isConnected && !active.matches(':disabled')) return
        document.getElementById(panelId)?.focus({ preventScroll: true })
      })
    }
    wasSaving.current = Boolean(actionState?.loading)
    return () => window.cancelAnimationFrame(frame)
  }, [actionState?.loading, actionState?.error])

  // Errors of the saves a section makes itself (it calls `handleUpdateDriversGroup` and drops the answer): an alert, as main had.
  // The ones this panel asked for (the switch, Delete) are said where they were asked, so they are not said twice: the key of
  // their error is remembered and the alert skips it. The check waits a tick: the answer and the state can arrive in either order.
  const ownErrors = useRef(new Set())
  const noteOwnError = (result) => {
    if (result && result.ok === false && result.error) ownErrors.current.add(JSON.stringify(result.error))
  }
  const [actionAlert, setActionAlert] = useState(null)
  useEffect(() => {
    const error = actionState?.error
    if (!error) return undefined
    const key = JSON.stringify(error)
    const timer = setTimeout(() => {
      if (ownErrors.current.delete(key)) return
      setActionAlert(error)
    }, 0)
    return () => clearTimeout(timer)
  }, [actionState?.error])

  // redesign DG-B4 (decision 5 | M-DG5): the switch sends only `{ enabled }` (after the question when it turns off, D-5 below); since B1 the controller keeps the other pending changes
  const toggleEnabled = async (next) => {
    const result = await handleUpdateDriversGroup({ enabled: next })
    noteOwnError(result)
    return result
  }

  // redesign D-5 (owner, 2026-10-19; C8): turning the header switch OFF asks first; turning it on stays immediate. The
  // panel renders its own dialog (the row's switch has the page's); Cancel writes nothing and the switch stays on.
  const { ask: askConfirm, dialog: confirmDialog } = useConfirmStep()

  // redesign DG-B4 (decision 6, C8): Delete asks first. The focus starts on Cancel (ConfirmDialog does that).
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const deleteFallback = t('DRIVERS_GROUPS_DELETE_ERROR', "We couldn't delete this group. Try again.")
  const deleteGroup = async () => {
    if (deleting) return
    setDeleting(true)
    let result
    try {
      result = await handleDeleteDriversGroup()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    noteOwnError(result)
    // On ok the controller has told the list and asked the page to close; there is nothing left to paint
    if (!mounted.current) return
    setDeleting(false)
    setConfirmOpen(false)
    if (result && result.ok === false) setDeleteErrors(errorLines(result.error, deleteFallback))
  }

  const name = group ? (String(group.name ?? '').trim() || t('DRIVERS_GROUPS_NO_NAME', 'No name')) : t('DRIVER_GROUP', 'Driver group')

  const typeText = group?.type === 1
    ? t('DRIVER_COMPANIES', 'Driver companies')
    : group?.type === 0 ? t('IN_HOUSE_DRIVERS', 'In house drivers') : null
  const priorityText = group ? PRIORITY_LABELS(t)[String(group.priority)] : null
  const subtitle = group && (
    <span>
      <span className='odc-figure'>{`#${group.id}`}</span>
      {typeText && ` · ${typeText}`}
      {priorityText && ` · ${priorityText}`}
    </span>
  )

  // redesign DG-R1 (R1-02): the row switch (list controller) and the header switch (this panel's controller) both write to the group
  // of the list (`driversGroupsState.groups`), but the panel keeps its own copy, which only the header switch updates. The header
  // therefore reads the list's group when it is there, and its own copy when it is not (a page other than the one in view).
  const listed = group ? props.driversGroupsState?.groups?.find(item => item.id === group.id) : null
  const enabled = Boolean((listed ?? group)?.enabled)
  const status = group && (
    <span className='gp-status'>
      <Status family={enabled ? 'done' : 'cancel'} label={enabled ? t('ENABLED', 'Enabled') : t('DISABLED', 'Disabled')} />
      <AsyncSwitch
        checked={enabled}
        disabled={Boolean(actionDisabled)}
        label={t('DRIVERS_GROUPS_ENABLE_NAME', 'Enable _name_').replace('_name_', name)}
        failureText={t('DRIVERS_GROUPS_TOGGLE_ERROR', "The group didn't change. Try again.")}
        confirmChange={next => next || askConfirm({
          title: t('DRIVERS_GROUPS_DISABLE_TITLE', 'Disable _name_?').replace('_name_', name),
          body: t('DRIVERS_GROUPS_DISABLE_BODY', 'New orders are no longer assigned through this group until you enable it again.'),
          confirmLabel: t('DRIVERS_GROUPS_DISABLE_GROUP', 'Disable group'),
          tone: 'danger'
        })}
        onToggle={toggleEnabled}
      />
    </span>
  )

  const menuItems = [
    {
      key: 'delete',
      label: t('DELETE', 'Delete'),
      icon: Trash2,
      tone: 'danger',
      disabled: Boolean(actionDisabled),
      onSelect: () => setConfirmOpen(true)
    }
  ]
  const headerActions = group && (
    <>
      {/* Learn draws only for a level-zero session with options (LearnDropDown itself, as in main) */}
      <LearnDropDown learnOptions={learnOptionsValues(['advance_logistics'], t)} />
      {!phone && onToggleExpanded && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => split.guardPlaceChange(() => onToggleExpanded())}
        />
      )}
      <Menu label={t('ACTIONS', 'Actions')} icon={Ellipsis} items={menuItems} triggerProps={{ disabled: Boolean(actionDisabled) }} />
    </>
  )

  // redesign DG-B4 (decision 1): the tour's «next» of the General form goes to Businesses
  const handleNextClick = () => {
    onSectionChange?.('businesses')
    handleNextTour?.()
  }

  // What main gave each section: all the props, plus the group the controller loaded. The side bar is gone, so its two movers are no-ops.
  const sectionProps = { handleParentSidebarMove: noop, setIsExtendExtraOpen: noop }
  for (const [key, value] of Object.entries(props)) {
    if (!PANEL_ONLY_PROPS.includes(key)) sectionProps[key] = value
  }
  sectionProps.curDriversGroup = group
  const discard = discardTexts(t)

  const renderSection = (id) => {
    switch (id) {
      case 'general':
        return <DriversGroupGeneralForm {...sectionProps} handleNextClick={handleNextClick} />
      case 'businesses':
        return <DriversGroupBusinesses {...sectionProps} />
      case 'paymethods':
        return <DriversGroupPaymethods {...sectionProps} />
      case 'delivery_zones':
        return (
          <GroupZones
            {...sectionProps}
            drivergroup={group}
            discardTexts={discard}
            onDirtyChange={reportZonesDirty}
          />
        )
      case 'schedule':
        return <DriversGroupSchedule {...sectionProps} />
      case 'advanced_logistics':
        return <DriversGroupLogistics {...sectionProps} inline />
      case 'logs':
        return <DriversGroupLogs driversGroupId={group.id} formatDates />
      default:
        return null
    }
  }

  // Only the current section is drawn, plus the zones when they have an unsaved draft (hidden): it survives going elsewhere.
  // redesign DG-B4 (M-DG6): with `actionDisabled` the content is inert and says so (as Schedule already did).
  const drawn = GROUP_SECTION_IDS.filter(id => id === current || (id === 'delivery_zones' && zonesDirty))
  const wrap = (id) => (
    <div key={id} className='gp-section' hidden={id !== current}>
      <div
        className='gp-section-content'
        inert={actionDisabled ? '' : undefined}
        aria-disabled={actionDisabled ? 'true' : undefined}
      >
        {renderSection(id)}
      </div>
    </div>
  )

  const label = t('DRIVER_GROUP_SETTINGS', 'Driver group settings')
  const navigation = {}
  let body
  if (failed) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('DRIVERS_GROUPS_OPEN_ERROR', "We couldn't open this group.")}
        action={(
          <span className='gp-state-actions'>
            {onRetry && <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
            {onClose && <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>}
          </span>
        )}
      />
    )
  } else if (!group) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else if (usesSectionNav(sections)) {
    // Level 0, more than four sections: the vertical list (decision 1)
    navigation.nav = (
      <SectionNav
        label={label}
        compactLabel={t('SECTION', 'Section')}
        items={sections}
        value={current}
        onValueChange={onSectionChange}
        wideMinWidth={640}
        measureTarget={measurePanel}
      />
    )
    body = drawn.map(wrap)
  } else {
    // Level 5 (four sections), the add form, a basic autoassign type…: Tabs. A section the list lacks (a known ?tab= of main) goes in the body.
    navigation.tabs = {
      label,
      value: current,
      onValueChange: onSectionChange,
      items: sections.map(item => ({ value: item.id, label: item.label, content: drawn.includes(item.id) ? wrap(item.id) : null }))
    }
    body = drawn.filter(id => !sections.some(item => item.id === id)).map(wrap)
  }

  return (
    <>
      <RecordPanel
        ref={panelRef}
        title={group || failed ? name : <span className='gp-title-skeleton'><Skeleton /></span>}
        subtitle={subtitle}
        status={status}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose}
        headerActions={headerActions}
        {...navigation}
        dirty={anyDirty}
        id={panelId}
        tabIndex={-1}
        className='gp-record'
        {...discard}
      >
        <div className='gp-body'>{body}</div>
      </RecordPanel>

      <ConfirmDialog
        open={confirmOpen}
        title={t('DRIVERS_GROUPS_DELETE_ONE_TITLE', 'Delete _name_?').replace('_name_', name)}
        confirmLabel={t('DRIVERS_GROUPS_DELETE_ONE', 'Delete group')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={deleteGroup}
        onCancel={() => setConfirmOpen(false)}
      >
        {t('DRIVERS_GROUPS_CANT_UNDO', "This can't be undone.")}
      </ConfirmDialog>

      {confirmDialog}

      <AlertDialog
        open={Boolean(deleteErrors)}
        title={t('DRIVERS_GROUPS_DELETE_ERROR_TITLE', "The group wasn't deleted")}
        content={deleteErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteErrors(null)}
      />

      <AlertDialog
        open={Boolean(actionAlert)}
        title={t('WEB_APPNAME', 'Ordering')}
        content={actionAlert ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setActionAlert(null)}
      />
    </>
  )
}

export const GroupPanel = (props) => {
  // The controller has no refetch: a new `key` mounts it again, which asks the API again (it is also how each group starts clean)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(count => count + 1), [])
  return (
    <DriversGroupDetailsController
      key={`${props.driversGroupId}:${attempt}`}
      {...props}
      onRetry={retry}
      refreshOnOpen // redesign DG-R1 (R1-01): a row has stores without `location`; the controller asks for the detail once
      UIComponent={GroupPanelUI}
    />
  )
}
