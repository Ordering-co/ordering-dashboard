import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, useUtils, BusinessDeviceListing as BusinessDeviceListingController } from '../../../../../index'
import { matchesDeviceSearch, ownerNameOf } from '../../../../../utils/devices'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { settleFocusOn } from '../../../utils/listFocus'
import { Menu as MenuIcon, Plus, Search, Store, TriangleAlert } from '../../Shared/Icon'
import {
  Avatar,
  Button,
  ColumnManager,
  DataTable,
  EmptyState,
  FilterBar,
  IconButton,
  PageHeader,
  RecordCardList,
  SearchField,
  SplitView
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { BusinessDeviceDetail } from '../BusinessDeviceDetail'
import './devices-page.css'

// redesign stores devices (D1, D2 | G5-36, DV-02, DV-07): the list of /stores/devices on Product pieces, beside the panel
// of a device in a split view (as open carts and delivery groups). The controller (K/BusinessDeviceListing) owns the data
// (`deviceListState`, `searchValue`, `handleUpdateDeviceList`, `reloadDevices`); this owns what the person sees of it: the rows that
// match the search (always worked out from the list of THIS render, DV-02), the device that is open and its `?id=` (G5-36), the
// add panel, the discard guard, the columns and the focus.

const SKELETON_ROWS = 8 // main drew 8 loading rows
const MANAGED_COLUMNS = ['device', 'store', 'owner']
const defaultColumns = () => MANAGED_COLUMNS.map(id => ({ id, visible: true }))

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// A device with no name still has a row: it is named by its number
const nameOf = (device) => String(device?.name ?? '').trim() || `#${device?.id}`

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpen`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b)

export const BusinessDeviceListingUI = (props) => {
  const {
    searchValue,
    onSearch,
    deviceListState,
    handleUpdateDeviceList,
    reloadDevices
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()
  const isPhone = useIsPhone()

  const devices = deviceListState?.devices ?? []
  const loading = Boolean(deviceListState?.loading)
  const error = deviceListState?.error
  const failed = hasError(error)
  // DV-02: the rows are worked out from the list of this render, so deleting the last device leaves the list empty
  const rows = devices.filter(device => matchesDeviceSearch(device, searchValue))
  const searching = String(searchValue ?? '').trim() !== ''

  // ---- the device that is open (a number from the list, never a copy), the add panel and the URL ----
  const [openId, setOpenId] = useState(null)
  const [created, setCreated] = useState(null) // the device a create just answered, until the list carries it
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [columns, setColumns] = useState(defaultColumns)
  const frameRef = useRef(null)
  const panelRef = useRef(null)
  const state = useRef({ id: null, adding: false })
  state.current = { id: openId, adding }

  // The ?id= the page was opened with: decided once, when the first list is in
  const wanted = useRef(new URLSearchParams(location.search).get('id') ?? undefined)

  const selected = openId == null
    ? null
    : (devices.find(device => sameId(device.id, openId)) ?? (sameId(created?.id, openId) ? created : null))

  useEffect(() => {
    if (wanted.current === undefined || loading) return
    const id = wanted.current
    wanted.current = undefined
    // a failed or empty list has nothing to decide on: the URL stays as it is
    if (failed) return
    const found = devices.find(device => sameId(device.id, id))
    if (found) {
      setOpenId(found.id)
      return
    }
    if (devices.length > 0) removeQueryToUrl(['id'])
  }, [loading, deviceListState?.devices, failed])

  const focusAddButton = () => {
    const frame = typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame : (callback) => setTimeout(callback, 16)
    frame(() => frameRef.current?.querySelector('[data-devices-add]')?.focus?.({ preventScroll: true }))
  }

  /**
   * Closes the panel. After a delete (`deleted`, the controller's own `onClose`) the focus goes to the row that took the device's
   * place, the next one or the one before; after a plain close, back to its row. With no row left it goes to the table's region.
   */
  const closePanel = (deleted = false) => {
    const { id, adding: wasAdding } = state.current
    if (id == null && !wasAdding) return // already closed
    state.current = { id: null, adding: false }
    setOpenId(null)
    setCreated(null)
    setAdding(false)
    setExpanded(false)
    removeQueryToUrl(['id'])
    if (id != null) {
      const index = rows.findIndex(device => sameId(device.id, id))
      const successor = deleted && index !== -1 ? (rows[index + 1] ?? rows[index - 1])?.id ?? null : id
      settleFocusOn(() => frameRef.current, successor)
    } else {
      focusAddButton()
    }
  }

  // another device, or the add panel, over a panel with unsaved changes asks first (RecordPanel's guard)
  const openDevice = (device) => {
    if (sameId(state.current.id, device.id) && !state.current.adding) return
    const go = () => {
      state.current = { id: device.id, adding: false }
      setAdding(false)
      setCreated(null)
      setOpenId(device.id)
      addQueryToUrl({ id: device.id })
    }
    if (panelRef.current) panelRef.current.requestClose(go)
    else go()
  }

  const openAdd = () => {
    if (state.current.adding) return
    const go = () => {
      state.current = { id: null, adding: true }
      setOpenId(null)
      setCreated(null)
      setAdding(true)
      removeQueryToUrl(['id'])
    }
    if (panelRef.current) panelRef.current.requestClose(go)
    else go()
  }

  // D3: after a create the panel stays on the new device (its code is what the person came for)
  const handleCreated = (device) => {
    state.current = { id: device.id, adding: false }
    setCreated(device)
    setAdding(false)
    setOpenId(device.id)
    addQueryToUrl({ id: device.id })
  }

  // ---- the cells (the table and the cards draw the same data) ----
  const logoOf = (device) => (device?.business?.logo ? optimizeImage(device.business.logo, 'h_50,c_limit') : undefined)
  const ownerText = (device) => ownerNameOf(device) || t('NO_OWNER', 'No owner')

  const storeCell = (device) => (
    <span className='odc-dv-store'>
      <Avatar kind='business' name={device?.business?.name || ''} src={logoOf(device)} />
      <span className='odc-dv-store-text'>
        <span className='odc-dv-store-name' dir='auto' title={device?.business?.name}>{device?.business?.name}</span>
        {device?.business?.address && <span className='odc-dv-sub' dir='auto' title={device.business.address}>{device.business.address}</span>}
      </span>
    </span>
  )

  // «No owner» for a device with none and for one whose owner the API no longer returns (`user_id` set, `user` null: no name to show)
  const ownerCell = (device) => {
    const name = ownerNameOf(device)
    if (!name) return <span className='odc-dv-none'>{ownerText(device)}</span>
    return (
      <span className='odc-dv-owner'>
        <Avatar kind='person' name={name} src={device?.user?.photo || undefined} />
        <span className='odc-dv-owner-name' dir='auto' title={name}>{name}</span>
      </span>
    )
  }

  const labels = {
    device: t('DEVICE', 'Device'),
    store: t('DEVICE_STORE', 'Store'),
    owner: t('DEVICE_OWNER', 'Owner')
  }
  const DEFINITIONS = {
    device: {
      header: labels.device,
      rowHeader: true,
      wrap: true,
      skeleton: { lines: 1 },
      cell: device => <span className='odc-dv-name' dir='auto' title={nameOf(device)}>{nameOf(device)}</span>
    },
    store: { header: labels.store, skeleton: { lines: 2, lead: 'business' }, cell: storeCell },
    owner: { header: labels.owner, skeleton: { lines: 1, lead: 'avatar' }, cell: ownerCell }
  }
  // the order the person chose; what they hid is reported to the table, which keeps drawing the loading cells for it
  const tableColumns = columns.map(({ id }) => ({ id, ...DEFINITIONS[id] }))
  const hiddenColumnIds = columns.filter(column => !column.visible).map(column => column.id)

  // ---- the states that are not rows ----
  const listLabel = t('DEVICES', 'Devices')
  const loadingLabel = t('DEVICES_LOADING', 'Loading devices')
  const firstMessage = (Array.isArray(error) ? error : [error]).map(item => (typeof item === 'string' ? item : item?.message)).find(Boolean)

  const emptyState = () => {
    if (failed) {
      return (
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={t('DEVICES_LOAD_ERROR', "We couldn't load the devices.")}
          description={translateApiMessage(t, firstMessage, undefined)}
          action={<Button onClick={() => reloadDevices?.()}>{t('RETRY', 'Retry')}</Button>}
        />
      )
    }
    if (searching && devices.length > 0) {
      return (
        <EmptyState
          icon={Search}
          title={t('DEVICES_NO_MATCH', 'No devices match')}
          action={<Button onClick={() => onSearch?.('')}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
        />
      )
    }
    return (
      <EmptyState
        icon={Store}
        title={t('DEVICES_EMPTY', 'No devices yet')}
        action={<Button onClick={openAdd}>{t('ADD_NEW_DEVICE', 'Add new device')}</Button>}
      />
    )
  }

  const shown = failed ? [] : rows

  const toCard = (device) => {
    const name = nameOf(device)
    return {
      id: device.id,
      href: hrefFor(device.id),
      label: t('DEVICES_OPEN_DEVICE', 'Open _name_').replace('_name_', name),
      title: <span className='odc-dv-card-name' dir='auto' title={name}>{name}</span>,
      // one line: «store · owner»
      from: <span className='odc-dv-card-meta' dir='auto'>{[device?.business?.name, ownerText(device)].filter(Boolean).join(' · ')}</span>,
      active: sameId(selected?.id, device.id),
      onOpen: () => openDevice(device)
    }
  }

  const list = isPhone
    ? (
      <div className='odc-dv-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : shown.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={SKELETON_ROWS}
          empty={emptyState()}
        />
      </div>
      )
    : (
      <DataTable
        label={listLabel}
        columns={tableColumns}
        rows={shown}
        getRowId={device => device.id}
        hiddenColumnIds={hiddenColumnIds}
        activeRowId={selected?.id}
        onOpenRow={openDevice}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonRows={SKELETON_ROWS}
        empty={emptyState()}
      />
      )

  // ---- the header ----
  const known = !loading && !failed
  const count = devices.length
  const countLabel = count === 1
    ? t('DEVICES_COUNT_ONE', '1 device')
    : t('DEVICES_COUNT_OTHER', '_count_ devices').replace('_count_', count)
  const addLabel = t('ADD_NEW_DEVICE', 'Add new device')

  const columnsTool = !isPhone && (
    <ColumnManager
      // n.º 13, stores-devices PP-1: Device is the way to open the row, so it cannot be hidden (like «Group» in /drivers-groups)
      columns={columns.map(({ id, visible }) => ({ id, visible, label: labels[id], locked: id === 'device' }))}
      onChange={(next) => setColumns(next.map(({ id, visible }) => ({ id, visible })))}
      onReset={() => setColumns(defaultColumns())}
      triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
      title={t('MANAGE_COLUMNS', 'Manage columns')}
      resetLabel={t('COLUMNS_RESET', 'Reset')}
      lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
      widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
      moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', label)}
      moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', label)}
    />
  )

  const listView = (
    <div ref={frameRef} className='odc-root odc-dv-frame'>
      <div className='odc-dv-header'>
        <PageHeader
          leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
          title={t('DEVICES', 'Devices')}
          count={known ? count : undefined}
          countLabel={known ? countLabel : undefined}
          primaryAction={(
            <Button variant='primary' icon={Plus} data-devices-add='' title={addLabel} onClick={openAdd}>
              <span data-collapse-label=''>{addLabel}</span>
            </Button>
          )}
        />
        <FilterBar
          flush
          label={t('DEVICES_FILTERS', 'Device filters')}
          search={(
            <div className='odc-dv-search'>
              <SearchField
                value={searchValue ?? ''}
                onChange={(value) => onSearch?.(value)}
                label={t('SEARCH', 'Search')}
                placeholder={t('SEARCH', 'Search')}
                clearLabel={t('CLEAR_SEARCH', 'Clear search')}
              />
            </div>
          )}
          tools={columnsTool || undefined}
        />
      </div>
      <div className='odc-dv-list'>{list}</div>
      {/* J2 row 17 (stores-devices PP-2): the repeated «Add new device» at the foot is gone; the header's stays */}
    </div>
  )

  const panelOpen = adding || Boolean(selected)
  const panel = panelOpen
    ? (
      <BusinessDeviceDetail
        key={selected?.id ?? 'new'}
        selectedDevice={selected}
        devices={devices}
        handleUpdateDeviceList={handleUpdateDeviceList}
        panelRef={panelRef}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onClose={() => closePanel(true)}
        onDismiss={() => closePanel(false)}
        onCreated={handleCreated}
        focusCode={Boolean(selected) && sameId(created?.id, selected?.id)}
      />
      )
    : null

  return (
    <SplitView
      className='odc-dv-split'
      list={listView}
      panel={panel}
      open={panelOpen}
      expanded={expanded && panelOpen}
      panelLabel={selected ? nameOf(selected) : t('ADD_NEW_DEVICE', 'Add new device')}
      resizeLabel={t('DEVICES_RESIZE_PANEL', 'Resize the device panel')}
      storageKey='od.devices.panel'
      onClose={() => closePanel(false)}
    />
  )
}

export const BusinessDeviceListing = (props) => {
  const businessDeviceListingProps = {
    ...props,
    UIComponent: BusinessDeviceListingUI
  }
  return <BusinessDeviceListingController {...businessDeviceListingProps} />
}
