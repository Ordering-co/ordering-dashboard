import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { AsyncSwitch, Checkbox, DataTable, RecordCardList, Status } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import './customer-fees.css'

// redesign stores 5.12: the list of customer fees as a Product DataTable (RecordCards under 768px, as the stores list).
// It draws what the controller gives and fetches nothing. Columns: ID, Name (with the description under it), Amount («$200.00 + 0%»,
// and «Min: $x» when the fee has a fixed minimum), Conditions (site, payment method, delivery type) and Status, a switch that saves at
// once (P/AsyncSwitch: it goes back and says why when the save fails). A click on a row, or Enter on it, opens the fee; the name is a
// native button for the same; the checkbox and the switch are theirs and never open it.
// without `canManage` the API would refuse the switch and the delete, so the status is said in words and no row is selectable.

const SKELETON_ROWS = 5

const nameLabel = (template, fee) => template.replace('_name_', () => fee?.name ?? '')

/**
 * @param {object}   props
 * @param {Array<object>} props.fees
 * @param {boolean}  props.loading             Skeleton rows (only with no rows to keep on screen).
 * @param {Array}    props.selectedIds         Ids of the selected fees (they outlive the page).
 * @param {Function} props.onToggle            `(id)`: one row.
 * @param {Function} props.onToggleAll         `()`: the rows of the page.
 * @param {*}        [props.activeId]          The fee open in the detail.
 * @param {Function} props.onOpen              `(fee)`.
 * @param {Function} props.onToggleEnabled     `(fee, next) => Promise<{ ok, error? }>`: the switch.
 * @param {boolean}  props.canManage           The user can change and delete fees (level 0): the switch and the selection.
 * @param {Function} props.conditionsOf        `(fee) => string[]`: the names of its conditions.
 * @param {React.ReactNode} [props.empty]      What the table says when a search finds nothing.
 */
export const CustomerFeesTable = ({
  fees,
  loading,
  selectedIds,
  onToggle,
  onToggleAll,
  activeId,
  onOpen,
  onToggleEnabled,
  canManage,
  conditionsOf,
  empty
}) => {
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const isPhone = useIsPhone()

  const formatCurrency = (amount) => {
    const num = Number(amount)
    if (Number.isNaN(num)) return '-'
    return parsePrice(num)
  }

  const pageIds = fees.map(fee => fee.id)
  const selectedOnPage = pageIds.filter(id => selectedIds.includes(id))
  const allChecked = !loading && pageIds.length > 0 && selectedOnPage.length === pageIds.length
  const selectLabel = (fee) => nameLabel(t('STORES_SELECT_ROW', 'Select _name_'), fee)
  const openLabel = (fee) => `${fee?.name ?? ''}, ${t('VIEW_DETAILS', 'View details')}`
  const listLabel = t('CUSTOMER_FEES', 'Customer fees')
  const loadingLabel = t('CUSTOMER_FEES_LOADING', 'Loading customer fees')

  // ---- the cells (the table and the cards draw the same ones) ----
  const nameCell = (fee) => (
    <span className='odc-cf-namecell'>
      <button type='button' className='odc-cf-name' aria-label={openLabel(fee)} onClick={() => onOpen(fee)}>
        <span className='odc-cf-name-text' dir='auto' title={fee.name}>{fee.name}</span>
      </button>
      {fee.description && <span className='odc-cf-sub' dir='auto' title={fee.description}>{fee.description}</span>}
    </span>
  )

  const amountCell = (fee) => (
    <span className='odc-cf-amount'>
      <span className='odc-figure'>
        {`${fee?.fixed != null ? formatCurrency(fee.fixed) : formatCurrency(0)} + ${fee?.percentage != null ? fee.percentage : 0}%`}
      </span>
      {fee?.fixed_minimum != null && (
        <span className='odc-cf-sub odc-figure'>{`${t('MIN', 'Min')}: ${formatCurrency(fee.fixed_minimum)}`}</span>
      )}
    </span>
  )

  const conditionsCell = (fee) => {
    const names = conditionsOf(fee)
    if (names.length === 0) return <span className='odc-cf-none'>-</span>
    return (
      <span className='odc-cf-conditions'>
        {names.map((name, index) => <span key={index} className='odc-cf-badge' dir='auto'>{name}</span>)}
      </span>
    )
  }

  // The switch of a row: a click on it is its own, never the row's. Without `canManage`, the status in words.
  const statusCell = (fee) => {
    if (!canManage) {
      return <Status family={fee.enabled ? 'done' : 'cancel'} label={fee.enabled ? t('ACTIVE', 'Active') : t('INACTIVE', 'Inactive')} />
    }
    return (
      <span className='odc-cf-control' data-odc-no-open=''>
        <AsyncSwitch
          checked={Boolean(fee.enabled)}
          label={nameLabel(t('CUSTOMER_FEE_ENABLED_NAMED', 'Enabled: _name_'), fee)}
          failureText={t('CUSTOMER_FEE_TOGGLE_FAILED', "We couldn't change this fee.")}
          onToggle={(next) => onToggleEnabled(fee, next)}
        />
      </span>
    )
  }

  // ---- phone: the same data as cards ----
  if (isPhone) {
    const toCard = (fee) => ({
      id: fee.id,
      href: '#', // the card is a link for the keyboard and the screen reader; a plain click opens the detail (no address of its own)
      label: openLabel(fee),
      title: <span className='odc-cf-name-text' dir='auto'>{fee.name}</span>,
      from: (
        <span className='odc-cf-sub'>
          {t('ID', 'ID')} <bdi dir='ltr' className='odc-figure'>{fee.id}</bdi>
          {fee.description ? ` · ${fee.description}` : ''}
        </span>
      ),
      indicator: conditionsCell(fee),
      figure: amountCell(fee),
      active: activeId != null && String(activeId) === String(fee.id),
      actions: (
        <div className='odc-cf-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
          {canManage && <Checkbox label={selectLabel(fee)} checked={selectedIds.includes(fee.id)} onCheckedChange={() => onToggle(fee.id)} />}
          {statusCell(fee)}
        </div>
      ),
      onOpen: () => onOpen(fee)
    })
    return (
      <RecordCardList
        label={listLabel}
        items={loading ? [] : fees.map(toCard)}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonCount={SKELETON_ROWS}
        empty={empty}
        selectAll={canManage
          ? {
              label: t('SELECT_ALL', 'Select all'),
              checked: allChecked ? true : (selectedOnPage.length > 0 ? 'mixed' : false),
              onToggle: onToggleAll
            }
          : undefined}
      />
    )
  }

  const columns = [
    { id: 'id', header: t('ID', 'ID'), skeleton: { lines: 1 }, cell: fee => <bdi dir='ltr' className='odc-figure'>{fee.id}</bdi> },
    { id: 'name', header: t('NAME', 'Name'), rowHeader: true, wrap: true, skeleton: { lines: 2 }, cell: nameCell },
    { id: 'amount', header: t('AMOUNT', 'Amount'), skeleton: { lines: 2 }, cell: amountCell },
    { id: 'conditions', header: t('CONDITIONS', 'Conditions'), wrap: true, skeleton: { lines: 1 }, cell: conditionsCell },
    { id: 'status', header: t('STATUS', 'Status'), skeleton: { lines: 1 }, cell: statusCell }
  ]

  return (
    <DataTable
      label={listLabel}
      columns={columns}
      rows={fees}
      getRowId={fee => fee.id}
      selection={canManage
        ? {
            selectedIds,
            onToggle: id => onToggle(id),
            onToggleAll,
            allLabel: t('SELECT_ALL', 'Select all'),
            rowLabel: selectLabel
          }
        : undefined}
      activeRowId={activeId != null ? fees.find(fee => String(fee.id) === String(activeId))?.id : undefined}
      onOpenRow={onOpen}
      getRowAttributes={fee => ({ 'data-section-split-key': fee.id })}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={SKELETON_ROWS}
      scrollLabel={t('CUSTOMER_FEES_TABLE_SCROLL_REGION', 'Customer fees table, scrolls sideways')}
      empty={empty}
    />
  )
}
