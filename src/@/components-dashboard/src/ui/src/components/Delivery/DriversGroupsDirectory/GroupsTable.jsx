import React, { useEffect, useState } from 'react'

import { useLanguage } from '../../../../../index'
import {
  AsyncSwitch,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  RecordCardList,
  Status
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Search, TriangleAlert, Users } from '../../Shared/Icon'
import { assignsTo, groupName, managerText, storesCount, storesText, typeLabel } from './groupData'
import './groups-table.css'

// redesign DG-B3 (decisions 2, 4, 5; M-DG1, M-DG4, M-DG10, M-DG36): the delivery groups list as a Product DataTable (and
// RecordCards under 768px). It draws what the controller gives (`groups`) and what the host decides (selection, the open group,
// the save of the switch); it fetches nothing and owns no dialog. The ID and Type columns are gone on purpose (decision 2): the
// id sits under the name, as a figure, and the type reads in «Assigns to» and in the group's panel.
//
// Props (the contract the page, B5, consumes):
//   groups            the page's groups, as GET /drivergroups returns them (see groupData.js)
//   loading           true while the page loads: skeleton rows (cards under 768px), `pageSize` of them
//   error             the controller's error (a string, `{ message }` or a list): non-empty replaces the list, with «Retry»
//   searchValue       the text in the search box; non-blank turns the empty state into «No groups match» + «Clear search»
//   selectedIds       ids selected (they may include ids from other pages; only this page's count for the header)
//   onToggleSelect(id)        a row checkbox. Without it there is no selection column (and no checkboxes on the cards)
//   onToggleAll(pageIds)      the header (or the cards' «Select all»): the host adds these ids, or takes them off when all are in
//   activeId          the group open in the panel (a number or the string of the URL): its row is aria-current
//   onOpen(group)     a click or Enter on a row, a click on a card
//   onToggleEnabled(group, next) → Promise<{ ok, error }>   the save of the switch (B1: handleUpdateDriversGroup(id, { enabled })).
//                     The switch is P/AsyncSwitch: it is controlled by `group.enabled`, busy while this runs, and a failure
//                     (`{ ok: false, error }` or a throw) leaves it where it was and says so below it
//   onConfirmDisable(group) → Promise<boolean>   the host's question before turning a group OFF (D-5); optional
//   actionDisabled    the user may not change groups: the switches and «Add new driver group» are really disabled
//   onAdd()           «Add new driver group» of the empty state
//   onClearSearch()   «Clear search» of the empty state
//   onRetry()         «Retry» of the error state (reloadDriversGroups)
//   pageSize          how many skeleton rows to draw while loading (10 by default)
//
// Decision 5 + redesign D-5 (owner, 2026-10-19; C8): enabling is one click; DISABLING asks first. The question is the
// host's (it renders the one `P/ConfirmDialog`: «Disable _name_?» ('DRIVERS_GROUPS_DISABLE_TITLE'), «New orders are no longer
// assigned through this group until you enable it again.», «Disable group», danger, focus on Cancel): `onConfirmDisable(group)`
// answers true to go on and false to leave the switch where it was. Without it the switch stays one click.

const DEFAULT_PAGE_SIZE = 10

// redesign DG-B3 (decision 2; as DriversTable): width priorities. A column steps aside when the table is narrower than all the
// columns that outrank it plus its own: Stores first, then Assigns to. Group is locked; Enabled stays (the switch is the action).
// What each asks for, in px, padding included (the selection cell counts too). What steps aside is not lost: the Group cell's
// second line takes it. The sum with the selection column is 590, so all four fit the ~728px of a 1024 window.
// redesign tanda AB (U-2): the Status column is gone from the table (its 112px with it): the switch of «Enabled» is
// the one place where a row says its state. The phone cards keep the word (below): there the switch has no column to read from.
const WIDTH_PRIORITY = ['stores', 'assigns']
const COLUMN_WIDTH = { selection: 48, group: 200, assigns: 150, stores: 88, enabled: 104 }

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpen`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

export const GroupsTable = ({
  groups = [],
  loading = false,
  error = null,
  searchValue = '',
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
  activeId,
  onOpen,
  onToggleEnabled,
  onConfirmDisable,
  actionDisabled = false,
  onAdd,
  onClearSearch,
  onRetry,
  pageSize
}) => {
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  // the columns DataTable hid for want of width (it reports them once per change)
  const [widthHiddenIds, setWidthHiddenIds] = useState([])
  useEffect(() => {
    if (isPhone) setWidthHiddenIds([]) // the cards have no columns: what a table reported earlier is stale
  }, [isPhone])

  const skeletonCount = Number(pageSize) || DEFAULT_PAGE_SIZE
  const hasSelection = typeof onToggleSelect === 'function'
  const pageIds = groups.map(group => group.id)
  const isActive = (group) => activeId != null && activeId !== '' && String(activeId) === String(group.id)
  const activeRowId = groups.find(isActive)?.id
  const searching = String(searchValue ?? '').trim() !== ''

  const selectLabel = (group) => t('DRIVERS_GROUPS_SELECT_GROUP', 'Select _name_').replace('_name_', groupName(group, t))

  // ---- the cells (the table and the cards draw the same ones) ----
  const statusCell = (group) => (group.enabled
    ? <Status family='done' label={t('ENABLED', 'Enabled')} />
    : <Status family='cancel' label={t('DISABLED', 'Disabled')} />)

  // redesign DG-B3 (decision 5; M-DG4): it waits for the API and, if it fails, does not move and says why
  // redesign D-5 (owner, 2026-10-19): turning OFF asks the host first; turning ON stays one click
  const enabledSwitch = (group) => (
    <AsyncSwitch
      checked={!!group.enabled}
      disabled={actionDisabled}
      label={t('DRIVERS_GROUPS_ENABLE_GROUP', 'Enable _name_').replace('_name_', groupName(group, t))}
      failureText={t('DRIVERS_GROUPS_TOGGLE_ERROR', "The group didn't change. Try again.")}
      confirmChange={onConfirmDisable ? next => next || onConfirmDisable(group) : undefined}
      onToggle={next => onToggleEnabled?.(group, next)}
    />
  )

  // «#id · manager», then what its column left when that column is away (Assigns to, Stores)
  const groupCell = (group) => {
    const name = groupName(group, t)
    const parts = [
      <bdi key='id' dir='ltr' className='odc-figure'>{`#${group.id}`}</bdi>,
      <span key='manager' dir='auto'>{managerText(group, t)}</span>,
      widthHiddenIds.includes('assigns') && <span key='assigns'>{assignsTo(group, t)}</span>,
      widthHiddenIds.includes('stores') && <span key='stores'>{storesText(group, t)}</span>
    ].filter(Boolean)
    return (
      <span className='odc-dg-who'>
        <strong className='odc-dg-name' dir='auto' title={name}>{name}</strong>
        <span className='odc-dg-sub'>
          {parts.map((part, index) => (
            <React.Fragment key={part.key}>
              {index > 0 && ' · '}
              {part}
            </React.Fragment>
          ))}
        </span>
      </span>
    )
  }

  // ---- the states that are not rows ----
  const loadingLabel = t('DRIVERS_GROUPS_LOADING', 'Loading groups')
  const listLabel = t('DELIVERY_GROUPS', 'Delivery groups')

  const emptyState = () => {
    if (searching) {
      return (
        <EmptyState
          icon={Search}
          title={t('DRIVERS_GROUPS_NO_MATCH', 'No groups match')}
          action={<Button onClick={() => onClearSearch?.()}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
        />
      )
    }
    return (
      <EmptyState
        icon={Users}
        title={t('DRIVERS_GROUPS_EMPTY', 'No delivery groups yet')}
        action={<Button disabled={actionDisabled} onClick={() => onAdd?.()}>{t('ADD_NEW_DRIVER_GROUP', 'Add new driver group')}</Button>}
      />
    )
  }

  // The anchor of the tour sits on the container of the list, whatever the list is drawing
  const anchored = (content) => <div className='odc-dg-list' data-tour='tour_delivery_completed'>{content}</div>

  // A failure takes the place of the list (M-DG10), with the way to try again
  if (!loading && hasError(error)) {
    return anchored(
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('DRIVERS_GROUPS_LOAD_ERROR', "We couldn't load the groups.")}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards (decision 4: nothing sideways, nothing out of reach) ----
  if (isPhone) {
    const toCard = (group) => {
      const name = groupName(group, t)
      return {
        id: group.id,
        href: hrefFor(group.id),
        label: name,
        // redesign DG-R1: the name is cut with an ellipsis on a phone in several languages; the full name in its title, as the row has it
        title: <span className='odc-dg-card-name' dir='auto' title={name}>{name}</span>,
        status: statusCell(group),
        from: (
          <span className='odc-dg-card-meta'>
            {[
              <bdi key='id' dir='ltr' className='odc-figure'>{`#${group.id}`}</bdi>,
              typeLabel(group, t),
              assignsTo(group, t),
              storesText(group, t)
            ].filter(Boolean).map((part, index) => (
              <React.Fragment key={index}>
                {index > 0 && ' · '}
                {part}
              </React.Fragment>
            ))}
          </span>
        ),
        // redesign DG-B3 (M-DG36): the phone card keeps the manager the desktop row shows
        assignee: <span dir='auto'>{managerText(group, t)}</span>,
        active: isActive(group),
        actions: (
          <div className='odc-dg-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
            {hasSelection && (
              <Checkbox
                label={selectLabel(group)}
                checked={selectedIds.includes(group.id)}
                onCheckedChange={() => onToggleSelect(group.id)}
              />
            )}
            {enabledSwitch(group)}
          </div>
        ),
        onOpen: () => onOpen?.(group)
      }
    }
    // the same contract as DataTable's header, for this page's ids (the cards have no header)
    const selectedOnPage = pageIds.filter(id => selectedIds.includes(id)).length
    const selectAll = hasSelection && pageIds.length > 0
      ? {
          label: t('SELECT_ALL', 'Select all'),
          checked: selectedOnPage === 0 ? false : (selectedOnPage === pageIds.length ? true : 'mixed'),
          onToggle: () => onToggleAll?.(pageIds)
        }
      : undefined
    return anchored(
      <div className='odc-dg-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : groups.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={skeletonCount}
          empty={emptyState()}
          selectAll={selectAll}
        />
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens (M-DG1) ----
  const DEFINITIONS = {
    group: { header: t('GROUP', 'Group'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2 }, cell: groupCell },
    assigns: {
      header: t('DRIVERS_GROUPS_ASSIGNS_TO', 'Assigns to'),
      skeleton: { lines: 1 },
      cell: group => <span className='odc-dg-assigns'>{assignsTo(group, t)}</span>
    },
    // redesign tanda AB (U-3): a count is read down its column, so header and cells align to the end
    stores: {
      header: t('STORES', 'Stores'),
      align: 'end',
      skeleton: { lines: 1 },
      cell: group => <span className='odc-figure'>{storesCount(group)}</span>
    },
    enabled: { header: t('ENABLED', 'Enabled'), skeleton: { lines: 1 }, cell: enabledSwitch }
  }
  const shown = ['group', 'assigns', 'stores', 'enabled']
  // The threshold of a priority column is the width of the table with it and everything that outranks it
  const hideBelow = {}
  let needed = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], hasSelection ? COLUMN_WIDTH.selection : 0)
  WIDTH_PRIORITY.filter(id => shown.includes(id)).forEach(id => {
    hideBelow[id] = needed
    needed -= COLUMN_WIDTH[id]
  })
  const columns = shown.map(id => ({ id, ...DEFINITIONS[id], hideBelow: hideBelow[id] }))

  return anchored(
    <DataTable
      label={listLabel}
      columns={columns}
      rows={groups}
      getRowId={group => group.id}
      onWidthHiddenChange={setWidthHiddenIds}
      activeRowId={activeRowId}
      onOpenRow={group => onOpen?.(group)}
      selection={hasSelection
        ? {
            selectedIds,
            onToggle: id => onToggleSelect(id),
            // the header toggles this page: the host adds these ids, or takes them off when they are all in
            onToggleAll: () => onToggleAll?.(pageIds),
            allLabel: t('SELECT_ALL', 'Select all'),
            rowLabel: selectLabel
          }
        : undefined}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState()}
    />
  )
}
