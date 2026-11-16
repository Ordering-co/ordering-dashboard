import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  DriverGroupDeliveryDetails as DriverGroupDeliveryDetailsController,
  useConfig,
  useLanguage
} from '../../../../../index'
import { useGoogleMapsSdk } from '../../../hooks/useGoogleMapsSdk'
import { MapPin, Plus, TriangleAlert } from '../Icon'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  MapFrame,
  SaveBar
} from '../Product'
import { useIsPhone } from '../Product/useIsPhone'
// The zone editor stays in Delivery/ (Delivery groups lot B2b); this shared section is its only host.
import { DriverGroupDeliveryZoneDetails } from '../../Delivery/DriversGroupsDeliveryZoneDetails'
import { visibleZones, zoneKind } from './zoneData'
import { ZonesTable, zoneNameOf } from './ZonesTable'
import { ZonesOverviewMap } from './ZonesOverviewMap'
import './group-zones.css'

// redesign stores 5.8: the table is ZonesTable, shared with the store's zones
// redesign DG-B2c (decision 3 | M-DG6, M-DG25, M-DG38): the delivery zones section of the group panel, in place of
// D/DriversGroupDeliveryDetails + D/DriversGroupDeliveryZoneList (their use in the page goes away; they stay as the reference of parity).
// redesign DS-B0 (decision 8, coordinator's yes): promoted from Delivery/DriversGroupsDirectory to Shared/DeliveryZones so
// Delivery groups and Connect › Delivery services (and Stores 5.8, ) mount the same section. It knows nothing of the page
// that hosts it: the group, its name and the guard's texts come in as props.
// It mounts K/DriverGroupDeliveryDetails with `GroupZonesUI`, so the controller brings `zoneList`, `zoneListState`, the handlers and the
// `{ ok, error }` of the save (lot B1); everything else comes from GroupPanel.
//
// Props GroupPanel (lot B4) gives:
//  - `drivergroup`: the group the controller of the panel loaded (its `business` are the stores whose circles a distance-based zone draws);
//  - `actionDisabled`: really disables the Active boxes, Save, Discard, Add and opening a zone (the panel also makes the content inert);
//  - `discardTexts` (required): the four texts of the host's discard guard (RecordPanel), for «← All zones» with a dirty form;
//  - `name` (optional): how the host calls the group, for the map's name; without it, the group's own name or «No name»;
//  - `onDirtyChange(bool)`: unsaved Active boxes or the form of the zone that is open; `false` when the section goes away.
// The rest of what the panel spreads (businesses, paymethods…) is ignored here.
//
// The overview map and the editor are never mounted together: opening a zone (or «Add delivery zone») replaces the list and the map with
// the editor of lot B2b; saving, deleting or «← All zones» brings the list back and the focus to the row. This section has no Escape of
// its own: Esc belongs to the panel. No SideBar, no handleParentSidebarMove.

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// The API answers a list of messages, one text or nothing
const errorLines = (error) => (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())

const GroupZonesUI = (props) => {
  const {
    drivergroup,
    actionDisabled = false,
    discardTexts: guardTexts,
    name: nameProp,
    onDirtyChange,
    actionState,
    zoneList,
    setZoneList,
    zoneListState,
    handleChangeZoneState,
    handleChangeAllZoneState,
    onDeliveryStateSave,
    resetZoneState,
    reloadZones
  } = props

  const [, t] = useLanguage()
  const [configState] = useConfig()
  const isPhone = useIsPhone()
  const apiKey = configState?.configs?.google_maps_api_key?.value
  const sdk = useGoogleMapsSdk(apiKey)

  const rootRef = useRef(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  if (guardTexts == null) throw new Error('GroupZones needs discardTexts')
  const guard = guardTexts
  const name = (nameProp == null ? String(drivergroup?.name ?? '') : String(nameProp)).replace(/\s+/g, ' ').trim() || t('DRIVERS_GROUPS_NO_NAME', 'No name')
  const zones = visibleZones(zoneList?.zones)
  const changes = zoneListState?.changes ?? {}

  // ---- the controller starts with an empty, not loading list and asks for the zones in an effect: until it has, this is loading ----
  const requestedRef = useRef(false)
  if (zoneList?.loading) requestedRef.current = true
  const failed = !zoneList?.loading && hasError(zoneList?.error)
  const loading = Boolean(zoneList?.loading) || (!requestedRef.current && !failed)

  // ---- the Active boxes: pending state against the stored one ----
  const changedZones = zones.filter(zone => zone.id in changes && Boolean(changes[zone.id]) !== Boolean(zone.enabled))
  const count = changedZones.length
  const isActive = (zone) => Boolean(zone.id in changes ? changes[zone.id] : zone.enabled)

  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = busy || Boolean(actionState?.loading)
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(timer)
  }, [saved])

  const settle = () => { setSaveError(null); setSaved(false) }
  const toggleZone = (zone, next) => { settle(); handleChangeZoneState(zone.id, next) }
  const toggleAll = (next) => { settle(); handleChangeAllZoneState(next) }
  const discard = () => { settle(); resetZoneState() }
  // redesign DG-B2c (M-DG25): the controller answers `{ ok, error }`; a failure is said in the bar, where the user is
  const save = async () => {
    if (saving || actionDisabled) return
    setBusy(true)
    settle()
    let result
    try {
      result = await onDeliveryStateSave()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return
    setBusy(false)
    if (result?.ok === false) setSaveError(errorLines(result.error))
    else setSaved(true)
  }
  const saveErrorText = saveError
    ? t('DRIVERS_GROUPS_ZONES_SAVE_ERROR', "We couldn't save the zones. _message_").replace('_message_', saveError.join(' ')).trim()
    : null

  // ---- the zone that is open (null: the list) ----
  const [editor, setEditor] = useState(null)
  const [formDirty, setFormDirty] = useState(false)
  const [guardOpen, setGuardOpen] = useState(false)
  const restoreRef = useRef(null)
  const reportFormDirty = useCallback((value) => setFormDirty(Boolean(value)), [])

  const openZone = (zone) => {
    if (actionDisabled) return
    restoreRef.current = zone ? zone.id : 'add'
    setEditor({ zone: zone ?? null })
  }
  const closeEditor = () => {
    setGuardOpen(false)
    setFormDirty(false)
    setEditor(null)
  }
  // «← All zones»: a form with changes asks first
  const requestBack = () => (formDirty ? setGuardOpen(true) : closeEditor())

  // The focus goes back to the zone that was open; a new or deleted zone has no row, so it goes to «Add delivery zone»
  useEffect(() => {
    if (editor || restoreRef.current == null) return
    const id = restoreRef.current
    restoreRef.current = null
    const root = rootRef.current
    const target = (id !== 'add' && (root?.querySelector(`[data-gz-open="${id}"]`) || root?.querySelector(`[data-row-id="${id}"] a`))) ||
      root?.querySelector('[data-gz-add]') ||
      root
    target?.focus?.()
  }, [editor])

  // redesign DG-R1 (R1-04): opening the editor moves the focus into it, to its first button («← All zones»), instead of leaving it
  // on the panel (the button that opened it is gone). The editor's own first button is the way back.
  const editorRef = useRef(null)
  useEffect(() => {
    if (!editor) return
    editorRef.current?.querySelector('button')?.focus()
  }, [editor])

  // redesign DG-B2c (decision 17): dirty is unsaved Active boxes or the form of the zone that is open
  const dirty = count > 0 || formDirty
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  useEffect(() => { onDirtyChangeRef.current?.(dirty) }, [dirty])
  useEffect(() => () => { onDirtyChangeRef.current?.(false) }, [])

  // ---- the map and the list talk: a focused row (or card) selects its zone; a click on a shape focuses its row ----
  const [selectedId, setSelectedId] = useState(null)
  const selectedZone = zones.find(zone => String(zone.id) === String(selectedId))
  const handleListFocus = (event) => {
    const row = event.target.closest?.('[data-row-id]')
    if (row) setSelectedId(row.getAttribute('data-row-id'))
  }
  const selectOnMap = (id) => {
    setSelectedId(id)
    const row = rootRef.current?.querySelector(`[data-row-id="${id}"]`)
    if (!row) return
    if (row.tagName === 'TR') row.focus()
    else row.querySelector('a')?.focus()
  }

  // ---- text ----
  const zoneName = (zone) => zoneNameOf(zone, t)
  const listLabel = t('DELIVERY_ZONES_TITLE', 'Delivery zones')
  const loadingLabel = t('DRIVERS_GROUPS_ZONES_LOADING', 'Loading delivery zones')
  const mapLabel = t('DRIVERS_GROUPS_ZONES_MAP', 'Delivery zones of _name_').replace('_name_', name)
  const addLabel = t('ADD_DELIVERY_ZONE', 'Add delivery zone')

  const addButton = (
    <Button icon={Plus} data-gz-add='' disabled={actionDisabled} onClick={() => openZone(null)}>{addLabel}</Button>
  )

  // ---- the editor ----
  if (editor) {
    return (
      <>
        <div ref={editorRef}>
          <DriverGroupDeliveryZoneDetails
            key={editor.zone ? editor.zone.id : 'new'}
            zone={editor.zone}
            setZoneList={setZoneList}
            drivergroup={drivergroup}
            onClose={closeEditor}
            driverGroupsZones={zoneList}
            onBack={requestBack}
            onDirtyChange={reportFormDirty}
          />
        </div>
        <ConfirmDialog
          open={guardOpen}
          title={guard.discardTitle}
          confirmLabel={guard.discardConfirmLabel}
          cancelLabel={guard.keepEditingLabel}
          closeLabel={t('CLOSE', 'Close')}
          onConfirm={closeEditor}
          onCancel={() => setGuardOpen(false)}
        >
          {guard.discardDescription}
        </ConfirmDialog>
      </>
    )
  }

  // ---- the list ----
  const everywhere = zones.filter(zone => zoneKind(zone) === 'everywhere' && isActive(zone))
  const hasZones = zones.length > 0
  const showMap = !failed && (loading || hasZones)

  const renderList = () => {
    if (failed) {
      return (
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={t('DRIVERS_GROUPS_ZONES_LOAD_ERROR', "We couldn't load the delivery zones.")}
          action={<Button onClick={() => reloadZones()}>{t('RETRY', 'Retry')}</Button>}
        />
      )
    }
    if (!loading && !hasZones) {
      return (
        <EmptyState
          icon={MapPin}
          title={t('DRIVERS_GROUPS_ZONES_EMPTY', 'No delivery zones yet')}
          action={addButton}
        />
      )
    }

    return (
      <ZonesTable
        zones={zones}
        isActive={isActive}
        onToggle={toggleZone}
        onToggleAll={toggleAll}
        allChecked={Boolean(zoneListState?.isCheckAll)}
        actionDisabled={actionDisabled}
        loading={loading}
        label={listLabel}
        loadingLabel={loadingLabel}
        selectedId={selectedZone?.id}
        onOpen={openZone}
      />
    )
  }

  return (
    <div ref={rootRef} className='gz' tabIndex={-1}>
      {everywhere.length > 0 && (
        <ul className='gz-notes'>
          {everywhere.map(zone => (
            <li key={zone.id}>{t('DRIVERS_GROUPS_ZONE_EVERYWHERE', '_name_ covers everywhere.').replace('_name_', zoneName(zone))}</li>
          ))}
        </ul>
      )}

      {showMap && (
        <MapFrame
          label={mapLabel}
          apiKey={apiKey}
          unavailable={sdk.status === 'error'}
          unavailableTitle={t('MAP_UNAVAILABLE', 'Map unavailable')}
          unavailableDescription={t('DRIVERS_GROUPS_MAP_UNAVAILABLE_LIST', 'The zones are still listed below and can be edited.')}
          size={isPhone ? 'compact' : 'default'}
        >
          {sdk.status === 'ready' && (
            <ZonesOverviewMap
              key={sdk.generation}
              zones={zones}
              businesses={drivergroup?.business ?? []}
              selectedId={selectedZone?.id}
              onSelect={selectOnMap}
              label={mapLabel}
            />
          )}
        </MapFrame>
      )}

      <div className='gz-list' onFocus={handleListFocus}>
        {renderList()}
      </div>

      {!failed && !loading && hasZones && <div className='gz-add'>{addButton}</div>}

      {/* P/SaveBar has no `disabled`: with `actionDisabled` its buttons are really out of reach (inert), as the panel does with a section.
          The wrapper draws no box (display: contents), so the bar stays sticky in the section. */}
      <div
        className='gz-bar'
        inert={actionDisabled ? '' : undefined}
        aria-disabled={actionDisabled ? 'true' : undefined}
      >
        <SaveBar
          formSelector='.gz'
          label={t('SAVE_CHANGES', 'Save changes')}
          count={count}
          countText={(count === 1
            ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
            : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', String(count))}
          names={changedZones.map(zoneName)}
          moreText={n => t('SETTINGS_UNSAVED_MORE', '+_count_').replace('_count_', String(n))}
          saving={saving}
          errorText={saveErrorText}
          saved={saved}
          savedText={t('SAVED', 'Saved')}
          discardLabel={t('DISCARD', 'Discard')}
          saveLabel={t('SAVE', 'Save')}
          onDiscard={discard}
          onSave={save}
        />
      </div>
    </div>
  )
}

export const GroupZones = (props) => (
  <DriverGroupDeliveryDetailsController {...props} UIComponent={GroupZonesUI} />
)
