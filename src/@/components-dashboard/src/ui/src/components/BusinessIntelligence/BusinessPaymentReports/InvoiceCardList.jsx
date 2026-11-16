import React, { useId } from 'react'

import { Skeleton } from '../../Shared/Product'
import './store-reports.css'

// redesign business-payments FC1 (D7): the invoices of a store under 768 px. Each one is a card of its own (`P/RecordCard` has one
// figure and the arrow of an order; an invoice has three figures), a single button over the whole card: ID and status on the first
// line, period and method on the second, and the three figures with their names on the third (BP-05: nothing is left outside the
// view). It draws what it is given: `InvoicesTable` works out the texts (it knows the project's date and price formats) and
// passes each invoice as
// `{ id, title, label, period, method, status, ordersTotal, charges, transfer }`, where `title` is «#859», `label` is the name of
// the card for a screen reader («Invoice #859, 31 Aug 2026 – 07 Sep 2026») and the rest are nodes already painted. `labels` is
// `{ list, ordersTotal, charges, transfer }`, already translated.
// A press calls `onOpen(id)`; `activeId` is the invoice whose panel is open (compared as text: the URL gives it as text).

const SKELETON_CARDS = 4

const sameId = (a, b) => a != null && b != null && String(a) === String(b)

const FigureSlot = ({ label, children }) => (
  <span className='odc-bp-card-figure'>
    <span className='odc-bp-card-figure-label'>{label}</span>
    {children}
  </span>
)

const SkeletonCard = ({ labels }) => (
  <li className='odc-bp-card-item' aria-hidden='true'>
    <div className='odc-bp-card' data-skeleton=''>
      <span className='odc-bp-card-top'>
        <Skeleton size='28%' />
        <Skeleton size='24%' align='end' />
      </span>
      <span className='odc-bp-card-line'>
        <Skeleton size='62%' />
      </span>
      <span className='odc-bp-card-figures'>
        {[labels.ordersTotal, labels.charges, labels.transfer].map(label => (
          <FigureSlot key={label} label={label}>
            <Skeleton size='80%' />
          </FigureSlot>
        ))}
      </span>
    </div>
  </li>
)

const Card = ({ item, active, onOpen, labels }) => {
  const bodyId = useId()
  return (
    <li className='odc-bp-card-item'>
      {/* redesign the card carries the same `data-row-id` as the table's row, so `settleFocusOn` (the focus when the panel
          closes) and the split view's opener find it; it sits on the button, a focusable thing with a name, never on a mute wrapper */}
      <button
        type='button'
        className='odc-bp-card'
        data-row-id={item.id}
        aria-label={item.label}
        aria-describedby={bodyId}
        aria-current={active ? 'true' : undefined}
        data-active={active ? '' : undefined}
        onClick={() => onOpen?.(item.id)}
      >
        <span id={bodyId} className='odc-bp-card-body'>
          <span className='odc-bp-card-top'>
            <bdi dir='ltr' className='odc-figure odc-bp-card-id'>{item.title}</bdi>
            {item.status}
          </span>
          <span className='odc-bp-card-line'>
            <bdi>{item.period}</bdi>
            <span aria-hidden='true'>·</span>
            <span>{item.method}</span>
          </span>
          <span className='odc-bp-card-figures'>
            <FigureSlot label={labels.ordersTotal}>{item.ordersTotal}</FigureSlot>
            <FigureSlot label={labels.charges}>{item.charges}</FigureSlot>
            <FigureSlot label={labels.transfer}>
              <span className='odc-bp-transfer'>{item.transfer}</span>
            </FigureSlot>
          </span>
        </span>
      </button>
    </li>
  )
}

export const InvoiceCardList = ({ items = [], loading = false, activeId, onOpen, labels }) => (
  <ul className='odc-bp-cards' role='list' aria-label={labels.list} aria-busy={loading || undefined}>
    {loading
      ? Array.from({ length: SKELETON_CARDS }, (_, index) => <SkeletonCard key={index} labels={labels} />)
      : items.map(item => (
        <Card key={item.id} item={item} active={sameId(item.id, activeId)} onOpen={onOpen} labels={labels} />
      ))}
  </ul>
)
