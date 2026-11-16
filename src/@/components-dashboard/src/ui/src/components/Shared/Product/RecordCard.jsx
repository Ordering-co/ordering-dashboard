import React from 'react'

import { ArrowRight } from '../Icon'
import { Checkbox } from './Checkbox'
import { Skeleton } from './Feedback'
import './product.css'
import './record-card.css'

// redesign W1-1 (T1-1): the card of a record, promoted from Orders/OrdersTable/OrderCard.jsx. It owns the anatomy and the
// link; the record's own content (the cells), the href, the accept / reject row and every text come in as props.
// It has no text of its own and knows nothing about orders: what it draws is named by the slot, not by the record.

// Before the page size is known, ten cards (the first page size of the list).
const SKELETON_CARDS = 10

// redesign stores 5.18: a slot that draws something (null, undefined, false and '' draw nothing)
const drawn = (node) => node != null && node !== false && node !== ''

const isModifiedClick = (event) => event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey

/**
 * One record as a card. Slots, all ready-made nodes:
 * - `title` (the identifier, inside the link) and `status`, on the first row;
 * - `from` and `to`, on the second row, with an arrow between them (only when both are given);
 * - `assignee` (a node or null) and `schedule` (a list of nodes or texts, the falsy ones skipped), on the third row;
 * - `indicator` with its `indicatorNote`, and `figure`, on the fourth;
 * - `actions`, an optional row below. The whole card opens the record; whatever is inside `actions` never does.
 * `href` makes the card a link (a middle click or «open in a new tab» works); a plain click goes through `onOpen()`.
 * `label` is the accessible name of the link.
 *
 * SC-4: `link={false}` (opt-in; default `true`, the card is exactly as before) is the card of a record that has no URL: the title is
 * no <a> (`href` is ignored). With `onOpen` it is a <button type='button'> (keyboard and pointer, named by `label`, which is then required);
 * without it a plain <span> and the card is not interactive at all (no overlay, no hover tint; `label` is not needed). The card itself stays
 * the <li> of its list either way.
 */
export const RecordCard = ({
  id, href, label, title, status, from, to, assignee, schedule = [], indicator, indicatorNote, figure,
  active, arrived, tint, tour, actions, onOpen, link = true
}) => {
  const isLink = link !== false
  const isStatic = !isLink && !onOpen
  if (label == null && !isStatic) throw new Error('RecordCard needs a label')
  const when = schedule.filter(Boolean)
  const handleLinkClick = (event) => {
    if (isModifiedClick(event)) return
    event.preventDefault()
    onOpen?.()
  }
  // The pointer reaches the card through the link's overlay in a browser; this covers the rest.
  const handleCardClick = (event) => {
    if (event.target.closest('a, button, [data-card-actions]')) return
    onOpen?.()
  }
  return (
    <li
      className='odc-order-card'
      data-row-id={id}
      data-active={active ? '' : undefined}
      data-static={isStatic ? '' : undefined}
      data-new={arrived ? '' : undefined}
      data-status={tint}
      data-tour={tour}
      aria-current={active ? 'true' : undefined}
      onClick={handleCardClick}
    >
      <div className='odc-order-card-top'>
        {isLink
          ? (
            <a
              className='odc-mono odc-order-card-link'
              href={href}
              aria-label={label}
              onClick={handleLinkClick}
            >
              {title}
            </a>
            )
          : isStatic
            ? <span className='odc-mono odc-order-card-title'>{title}</span>
            : (
              <button
                type='button'
                className='odc-mono odc-order-card-link'
                aria-label={label}
                onClick={() => onOpen()}
              >
                {title}
              </button>
              )}
        <span className='odc-order-card-status'>{status}</span>
      </div>
      <div className='odc-order-card-people'>
        {from}
        {/* redesign stores 5.18 (from 5.13): the arrow only stands between an origin and a destination */}
        {drawn(from) && drawn(to) && <ArrowRight className='odc-icon odc-icon-flip odc-order-card-arrow' aria-hidden='true' />}
        {to}
      </div>
      {(assignee || when.length > 0) && (
        <div className='odc-order-card-logistics'>
          <span className='odc-order-card-driver'>{assignee}</span>
          <span className='odc-order-card-when'>
            {when.map((node, index) => <span key={index}>{node}</span>)}
          </span>
        </div>
      )}
      <div className='odc-order-card-meta'>
        <span className='odc-order-card-sla'>
          {indicator}
          {indicatorNote && <span className='odc-order-card-age'>{indicatorNote}</span>}
        </span>
        <span className='odc-order-card-total'>{figure}</span>
      </div>
      {actions}
    </li>
  )
}

// redesign F4 (C20): a loading card has the four rows of a real one (id and status, from to to, assignee and
// dates, indicator and figure), with the avatars where the real card draws them, so it is as tall as the real card
// (record-card.css gives each placeholder row the line of the text it stands for).
const SkeletonCard = ({ index }) => (
  <li className='odc-order-card' data-skeleton='' aria-hidden='true'>
    <div className='odc-order-card-top'>
      <Skeleton size={index % 2 ? '24%' : '30%'} />
      <Skeleton size='38%' align='end' />
    </div>
    <div className='odc-order-card-people'>
      <Skeleton shape='box' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
      <Skeleton size='28%' />
      <Skeleton shape='round' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
      <Skeleton size='24%' />
    </div>
    <div className='odc-order-card-logistics'>
      <span className='odc-order-card-driver'>
        <Skeleton shape='round' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
        <Skeleton size='30%' />
      </span>
      <Skeleton size='40%' align='end' />
    </div>
    <div className='odc-order-card-meta'>
      <Skeleton size={index % 2 ? '44%' : '52%'} />
      <Skeleton size='18%' align='end' />
    </div>
  </li>
)

/**
 * The list of cards: loading (`skeletonCount` skeleton cards, the page size), empty (the `empty` node), and one card per
 * item. `items` are the props of a RecordCard, each with its `id` (the key). `loadingLabel` is the text read while it
 * loads. `children` render after the list inside the same root (a dialog the actions of the cards open, for example).
 *
 * redesign DL-R2: `selectAll` is opt-in, `{ label, checked, onToggle }`: a «select all» row above the cards, for a list whose
 * table has the same control in its header (a phone has no header). `checked` is true, false or 'mixed'; `onToggle()` is called
 * with nothing; `label` is the visible text and the name (required; the list has no text of its own, `''` paints empty). It is
 * drawn only with cards to select (not while loading, not when empty). Without it the list is exactly what it was.
 */
export const RecordCardList = ({
  label,
  items,
  loading,
  loadingLabel,
  skeletonCount = SKELETON_CARDS,
  empty,
  selectAll,
  children
}) => {
  if (label == null) throw new Error('RecordCardList needs a label')
  if (selectAll && selectAll.label == null) throw new Error('RecordCardList selectAll needs a label')
  const showEmpty = !loading && items.length === 0
  return (
    <div className='odc-root odc-order-cards'>
      {selectAll && !loading && !showEmpty && (
        <div className='odc-order-cards-select'>
          <Checkbox checked={selectAll.checked} onCheckedChange={() => selectAll.onToggle?.()}>
            {selectAll.label}
          </Checkbox>
        </div>
      )}
      {loading && loadingLabel && <span className='odc-sr-only'>{loadingLabel}</span>}
      {showEmpty
        ? empty
        : (
          <ul className='odc-order-card-list' role='list' aria-label={label} aria-busy={loading}>
            {loading
              ? Array.from({ length: skeletonCount }, (_, index) => <SkeletonCard key={index} index={index} />)
              : items.map(item => <RecordCard key={item.id} {...item} />)}
          </ul>
          )}
      {children}
    </div>
  )
}
