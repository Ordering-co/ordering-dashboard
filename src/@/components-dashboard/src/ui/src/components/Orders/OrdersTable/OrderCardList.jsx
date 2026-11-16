import React, { useEffect, useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { Button, Checkbox, ConfirmDialog } from '../../Shared/Product'
import { RecordCardList } from '../../Shared/Product/RecordCard' // by file until the coordinator adds it to the barrel (W1-1)
import { Check } from '../../Shared/Icon'
import { getUserType } from '../../../utils'
import './order-card.css'

// redesign 5.6-A: /orders below 768px of VIEWPORT is a list of cards (a row of the table, stacked).
// The cells are the table's own renderers, handed in as `parts`, so a card and a row never disagree.
// redesign W1-1 (T1-1): the card itself is Product's RecordCard (Shared/Product/RecordCard.jsx). What stays here is
// Orders' own: the adapter from an order to a card, and the accept / reject of a pending order (session, role, dialog).
// The phone cut (< 768px) is Product's `useIsPhone`, the same query the card stylesheet follows.

// The statuses the actions move a pending order to (the codes the detail footer sends).
const STATUS_PENDING = 0
const STATUS_ACCEPTED_BY_BUSINESS = 7
const STATUS_REJECTED_BY_ADMIN = 2
const STATUS_REJECTED_BY_BUSINESS = 5

// The card is a link to `?id=`: a middle click or «open in a new tab» works; a plain click goes
// through the same handler the table rows use.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

/**
 * The list of order cards: loading (`skeletonCount` skeleton cards, the page size), empty, and one card per order. It owns the
 * accept / reject of a pending order: `onUpdateStatus` is the controller's `handleUpdateOrderStatus`
 * and rejecting asks first, with the copy of the detail footer. This sends nothing by itself.
 * `getParts(order)` gives the ready-made nodes: title, status, business, customer, sla, age, total, and the
 * logistics row: driver (a node or null), delivery (text) and eta (text or null).
 *
 * (W1, owner decision 1 A): `selection` (opt-in) gives the cards the multi-select main had at every width:
 * `{ selectedIds, onToggle(id), onToggleAll(next), onClear(), isSelectable(order) }`, the same contract as the table's. A «Select»
 * button above the cards turns a Select mode on (a checkbox on each selectable card, the page «Select all» above them) and reads
 * «Cancel», which clears the selection and turns it off. A selection that already exists (it came from the table) turns the mode
 * on by itself. The bulk bar is not drawn here: it is OrdersListing's, the same as the table's.
 */
export const OrderCardList = ({
  label,
  orders,
  loading,
  loadingLabel,
  skeletonCount,
  empty,
  activeId,
  newIds = [],
  getParts,
  getOrderLabel,
  getTint,
  onOpen,
  onUpdateStatus,
  selection
}) => {
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [busy, setBusy] = useState(null)
  const selectedIds = selection?.selectedIds ?? []
  const selectedCount = selectedIds.length
  const [selecting, setSelecting] = useState(selectedCount > 0)
  // A selection that arrives while the mode is off (from the table, at a wider viewport) must be visible.
  useEffect(() => {
    if (selectedCount > 0) setSelecting(true)
  }, [selectedCount])
  const selectMode = !!selection && selecting
  const [reject, setReject] = useState({ open: false, order: null })
  // redesign fix-qa C2: what the API answered when a change failed, kept on the card it failed on.
  const [failure, setFailure] = useState(null)

  // Same rule as the detail footer: a view-only role gets no action.
  const viewOnly = getUserType('readOnlyAdmin') || getUserType('readOnlyDeliveryManager') ||
    (!getUserType('viewOnlyBusinessOwner') && getUserType('readOnlyBusinessOwner'))
  const canAct = typeof onUpdateStatus === 'function' && !viewOnly

  // The controller answers `{ error: true, result: [messages] }`; the messages are strings (or `{ message }`).
  const failureText = (result) => {
    const messages = (Array.isArray(result) ? result : [result])
      .map(item => typeof item === 'string' ? item : item?.message)
      .filter(Boolean)
    return messages.length ? messages.join(' ') : t('ORDER_STATUS_CHANGE_FAILED', 'We couldn’t change the status of the order.')
  }

  const change = async (order, action, newStatus) => {
    setBusy({ id: order.id, action })
    setFailure(null)
    try {
      const response = await onUpdateStatus({ id: order.id, newStatus })
      if (response?.error) setFailure({ id: order.id, text: failureText(response.result) })
      return response
    } catch (error) {
      setFailure({ id: order.id, text: failureText(error?.message) })
      return undefined
    } finally {
      setBusy(null)
    }
  }
  // redesign fix-qa E7 (owner decision, 2026-10-06): an admin (level 0) rejects as admin (2), anyone else as the business (5).
  const rejectStatus = user?.level === 0 ? STATUS_REJECTED_BY_ADMIN : STATUS_REJECTED_BY_BUSINESS
  const rejectStatusName = rejectStatus === STATUS_REJECTED_BY_ADMIN
    ? t('REJECTED_BY_ADMIN', 'Rejected by admin')
    : t('REJECTED_BY_BUSINESS', 'Rejected by business')
  const handleReject = async () => {
    await change(reject.order, 'reject', rejectStatus)
    setReject(current => ({ ...current, open: false }))
  }

  // The checkbox of a selectable card (a locked order has none), named like the table's row checkbox. It sits in a card-actions
  // row, so pressing it never opens the order.
  const renderSelect = (order) => {
    if (!selectMode || !(selection.isSelectable?.(order) ?? true)) return null
    return (
      <div className='odc-order-card-select' data-card-actions='' onClick={event => event.stopPropagation()}>
        <Checkbox
          className='orderCheckBox'
          label={`${t('ORDER', 'Order')} ${order.id}`}
          checked={selectedIds.includes(order.id)}
          onCheckedChange={() => selection.onToggle?.(order.id)}
        />
      </div>
    )
  }

  const renderDecision = (order) => {
    if (!canAct || parseInt(order.status, 10) !== STATUS_PENDING) return undefined
    const mine = busy?.id === order.id ? busy.action : null
    const working = !!busy
    return (
      <div className='odc-order-card-actions' data-card-actions=''>
        <Button
          size='lg'
          aria-label={`${t('REJECT_ORDER', 'Reject order')} #${order.id}`}
          disabled={working}
          onClick={() => setReject({ open: true, order })}
        >
          {`${t('REJECT', 'Reject')}…`}
        </Button>
        <Button
          size='lg'
          variant='primary'
          icon={Check}
          aria-label={`${t('ACCEPT_ORDER', 'Accept order')} #${order.id}`}
          busy={mine === 'accept'}
          disabled={working && mine !== 'accept'}
          onClick={() => change(order, 'accept', STATUS_ACCEPTED_BY_BUSINESS)}
        >
          {t('ACCEPT', 'Accept')}
        </Button>
        {failure?.id === order.id && <p className='odc-order-card-error' role='alert'>{failure.text}</p>}
      </div>
    )
  }

  const renderActions = (order) => {
    const select = renderSelect(order)
    const decision = renderDecision(order)
    if (!select && !decision) return undefined
    return <>{select}{decision}</>
  }

  const arrived = new Set(newIds)
  // The adapter: an order, the cells of the table and the row of actions, as the props of a RecordCard.
  const toCard = (order, index) => {
    const parts = getParts(order)
    return {
      id: order.id,
      href: hrefFor(order.id),
      label: getOrderLabel(order),
      title: parts.title,
      status: parts.status,
      from: parts.business,
      to: parts.customer,
      assignee: parts.driver,
      schedule: [parts.delivery, parts.eta],
      indicator: parts.sla,
      indicatorNote: parts.age,
      figure: parts.total,
      active: activeId != null && order.id === activeId,
      arrived: arrived.has(order.id),
      tint: getTint?.(order),
      tour: index === 0 ? 'tour_start' : undefined,
      actions: renderActions(order),
      onOpen: () => onOpen(order)
    }
  }

  // The page's «Select all» is the table header's: it takes the orders of the page that can be selected, and is checked,
  // mixed or clear by how many of them are in.
  const selectableIds = selection ? orders.filter(order => selection.isSelectable?.(order) ?? true).map(order => order.id) : []
  const selectedOnPage = selectableIds.filter(id => selectedIds.includes(id)).length
  const selectAllState = selectedOnPage === 0 ? false : (selectedOnPage === selectableIds.length ? true : 'mixed')
  const selectAll = selectMode && selectableIds.length > 0
    ? {
        label: t('SELECT_ALL', 'Select all'),
        checked: selectAllState,
        onToggle: () => selection.onToggleAll?.(selectAllState !== true)
      }
    : undefined
  const handleToggleMode = () => {
    if (selectMode) selection.onClear?.()
    setSelecting(!selectMode)
  }

  return (
    <>
      {selection && !loading && orders.length > 0 && (
        <div className='odc-order-cards-bar'>
          <Button size='lg' onClick={handleToggleMode}>
            {selectMode ? t('CANCEL', 'Cancel') : t('SELECT', 'Select')}
          </Button>
        </div>
      )}
      <RecordCardList
        label={label}
        items={loading ? [] : orders.map(toCard)}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonCount={skeletonCount}
        empty={empty}
        selectAll={selectAll}
      >
        <ConfirmDialog
          open={reject.open}
          title={t('REJECT_ORDER_TITLE', 'Reject order #_id_?').replace('_id_', reject.order?.id ?? '')}
          confirmLabel={t('REJECT_ORDER', 'Reject order')}
          cancelLabel={t('KEEP_ORDER', 'Keep order')}
          closeLabel={t('CLOSE', 'Close')}
          busy={busy?.action === 'reject'}
          onConfirm={handleReject}
          onCancel={() => setReject(current => ({ ...current, open: false }))}
        >
          {t('REJECT_ORDER_CONSEQUENCE', 'The order moves to _status_.').replace('_status_', rejectStatusName)}
        </ConfirmDialog>
      </RecordCardList>
    </>
  )
}
