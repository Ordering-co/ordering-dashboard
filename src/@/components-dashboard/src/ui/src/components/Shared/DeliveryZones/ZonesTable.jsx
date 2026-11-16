import React, { useEffect, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Checkbox, DataTable, RecordCardList, Switch } from '../Product'
import { useIsPhone } from '../Product/useIsPhone'
import { zoneDistanceText, zoneTypeLabel } from './zoneData'
import './group-zones.css'

// redesign stores 5.8: the zones table, taken out of GroupZones so the delivery group, Connect › Delivery services and the
// store draw the same one. Presentation only: no controller and no request. The host gives the zones (already through `visibleZones`),
// what is active and what a toggle does; the classes (`gz-*`) and the attributes (`data-gz-open`, `data-row-id`) are the ones GroupZones
// has always painted, so the host's stylesheet, focus restore and map link keep working.
//
// Props:
//  - `zones`: the rows; `loading` / `loadingLabel` / `label`: the skeletons and the name of the list (texts come from the host);
//  - `isActive(zone)`, `onToggle(zone, next)`, `onToggleAll(next)`, `allChecked`: the Active column and the «Select all» of the header;
//  - `actionDisabled`: really disables the Active controls and the name buttons;
//  - `selectedId` → the highlighted row (`activeRowId`); `onOpen(zone)`: click or Enter on a row, or on the name button;
//  Opt-in, without them the table is the one GroupZones had:
//  - `activeControl`: 'checkbox' (default) or 'switch' for each row and card; «Select all» stays a Checkbox either way;
//  - `getRowAttributes(zone)`: extra attributes of the table row (DataTable keeps only `data-*` and `className`). RecordCard has no
//    such slot, so the phone cards do not get them;
//  - `currentId`: the zone that is open; its name button carries `aria-current='true'`.

const DASH = '—'
const SKELETON_ROWS = 3
const PHONE_CARD_HREF = '#' // the card is a link so the keyboard reaches it; a plain click goes through onOpen, which prevents the jump

// width priorities, in px, padding included: Minimum steps aside first, then Type. What steps aside goes to the second line of the Zone cell.
const WIDTH_PRIORITY = ['minimum', 'type']
const COLUMN_WIDTH = { active: 112, zone: 160, type: 168, minimum: 104, fee: 104 }

// How the zone is called, with «No name» for an empty one. GroupZones uses it too (its map, notes and Save bar).
export const zoneNameOf = (zone, t) => String(zone?.name ?? '').trim() || t('DRIVERS_GROUPS_NO_NAME', 'No name')

export const ZonesTable = ({
  zones = [],
  isActive,
  onToggle,
  onToggleAll,
  allChecked = false,
  actionDisabled = false,
  loading = false,
  label,
  loadingLabel,
  selectedId,
  onOpen,
  activeControl = 'checkbox',
  getRowAttributes,
  currentId
}) => {
  const [, t] = useLanguage()
  const [{ parsePrice } = {}] = useUtils()
  const isPhone = useIsPhone()
  const useSwitch = activeControl === 'switch'

  // the columns DataTable hid for want of width (it reports them once per change)
  const [widthHiddenIds, setWidthHiddenIds] = useState([])
  useEffect(() => {
    if (isPhone) setWidthHiddenIds([])
  }, [isPhone])

  const hasZones = zones.length > 0
  // redesign bugs F row 31: one three-state «Select all» (false / true / 'mixed') for the table header and the cards
  const checkedCount = zones.filter(isActive).length
  const selectAllValue = checkedCount === 0 ? false : (checkedCount === zones.length ? true : 'mixed')
  const selectedZone = zones.find(zone => String(zone.id) === String(selectedId))

  // ---- text ----
  const zoneName = (zone) => zoneNameOf(zone, t)
  const money = (value) => {
    if (value === null || value === undefined || String(value).trim() === '') return DASH
    return typeof parsePrice === 'function' ? parsePrice(value) : String(value)
  }
  const typeCell = (zone) => {
    const distance = zoneDistanceText(zone)
    return (
      <span className='gz-type'>
        {zoneTypeLabel(zone, t)}
        {distance && <>{' · '}<span className='odc-figure'>{distance}</span></>}
      </span>
    )
  }
  const activeName = (zone) => t('DRIVERS_GROUPS_ZONE_ACTIVE', 'Active: _name_').replace('_name_', zoneName(zone))

  const openButton = (zone) => (
    <button
      type='button'
      className='gz-open'
      dir='auto'
      data-gz-open={zone.id}
      aria-current={currentId != null && String(zone.id) === String(currentId) ? 'true' : undefined}
      disabled={actionDisabled}
      onClick={() => onOpen(zone)}
    >
      {zoneName(zone)}
    </button>
  )

  const activeBox = (zone) => (useSwitch
    ? (
      <Switch
        label={activeName(zone)}
        checked={isActive(zone)}
        disabled={actionDisabled}
        onCheckedChange={next => onToggle(zone, next)}
      />
      )
    : (
      <Checkbox
        label={activeName(zone)}
        checked={isActive(zone)}
        disabled={actionDisabled}
        onCheckedChange={next => onToggle(zone, next)}
      />
      ))

  const zoneCell = (zone) => {
    const rest = [
      widthHiddenIds.includes('type') && <span key='type'>{typeCell(zone)}</span>,
      widthHiddenIds.includes('minimum') && (
        <span key='minimum'>{`${t('MINIMUM', 'Minimum')} `}<span className='odc-figure'>{money(zone.minimum)}</span></span>
      )
    ].filter(Boolean)
    return (
      <span className='gz-who'>
        {openButton(zone)}
        {rest.length > 0 && (
          <span className='gz-sub'>
            {rest.map((part, index) => <React.Fragment key={part.key}>{index > 0 && ' · '}{part}</React.Fragment>)}
          </span>
        )}
      </span>
    )
  }

  if (isPhone) {
    // On a card the visible text is «Active», the name stays «Active: <zone>» (the visible text is inside the name)
    const cardControl = (zone) => (useSwitch
      ? (
        <Switch
          aria-label={activeName(zone)}
          checked={isActive(zone)}
          disabled={actionDisabled}
          onCheckedChange={next => onToggle(zone, next)}
        >
          {t('ACTIVE', 'Active')}
        </Switch>
        )
      : (
        <Checkbox checked={isActive(zone)} disabled={actionDisabled} onCheckedChange={next => onToggle(zone, next)}>
          {t('ACTIVE', 'Active')}
        </Checkbox>
        ))
    const toCard = (zone) => ({
      id: zone.id,
      href: PHONE_CARD_HREF,
      label: zoneName(zone),
      title: <span className='gz-card-name' dir='auto'>{zoneName(zone)}</span>,
      status: typeCell(zone),
      from: (
        <span className='gz-card-meta'>
          {`${t('MINIMUM', 'Minimum')} `}<span className='odc-figure'>{money(zone.minimum)}</span>
          {` · ${t('FEE', 'Fee')} `}<span className='odc-figure'>{money(zone.price)}</span>
        </span>
      ),
      active: selectedZone?.id === zone.id,
      actions: (
        <div className='gz-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
          {cardControl(zone)}
        </div>
      ),
      onOpen: () => onOpen(zone)
    })
    return (
      <div className='gz-cards'>
        <RecordCardList
          label={label}
          items={loading ? [] : zones.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={SKELETON_ROWS}
          selectAll={hasZones
            ? {
                label: t('SELECT_ALL', 'Select all'),
                checked: selectAllValue,
                onToggle: () => onToggleAll(!allChecked)
              }
            : undefined}
        />
      </div>
    )
  }

  const definitions = {
    active: {
      header: (
        <span className='gz-active-head'>
          <Checkbox
            label={t('SELECT_ALL', 'Select all')}
            checked={selectAllValue}
            disabled={actionDisabled || loading}
            onCheckedChange={onToggleAll}
          />
          <span>{t('ACTIVE', 'Active')}</span>
        </span>
      ),
      locked: true,
      skeleton: { lines: 1, lead: 'dot' },
      cell: activeBox
    },
    zone: { header: t('ZONE', 'Zone'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2 }, cell: zoneCell },
    type: { header: t('TYPE', 'Type'), skeleton: { lines: 1 }, cell: typeCell },
    minimum: {
      header: t('MINIMUM', 'Minimum'),
      align: 'end',
      skeleton: { lines: 1 },
      cell: zone => <span className='odc-figure'>{money(zone.minimum)}</span>
    },
    fee: {
      header: t('FEE', 'Fee'),
      align: 'end',
      locked: true,
      skeleton: { lines: 1 },
      cell: zone => <span className='odc-figure'>{money(zone.price)}</span>
    }
  }
  const shown = ['active', 'zone', 'type', 'minimum', 'fee']
  // The threshold of a priority column is the width of the table with it and everything that outranks it
  const hideBelow = {}
  let needed = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0)
  WIDTH_PRIORITY.forEach(id => {
    hideBelow[id] = needed
    needed -= COLUMN_WIDTH[id]
  })
  return (
    <DataTable
      label={label}
      columns={shown.map(id => ({ id, ...definitions[id], hideBelow: hideBelow[id] }))}
      rows={zones}
      getRowId={zone => zone.id}
      getRowAttributes={getRowAttributes}
      onWidthHiddenChange={setWidthHiddenIds}
      activeRowId={selectedZone?.id}
      onOpenRow={onOpen}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={SKELETON_ROWS}
    />
  )
}
