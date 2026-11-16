import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { ChevronLeft, ChevronRight } from '../Icon'
import { IconButton } from './Button'
import { Menu } from './Menu'
import { cx } from './classNames'
import './product.css'
import './pagination.css'

// redesign W0-7 (T0-23): a figure is a metric (decision 11), so it travels in a node of its own with `.odc-figure`.
const figure = value => <bdi className='odc-figure'>{value}</bdi>

const sizesWith = (options, pageSize) => {
  const sizes = options.includes(pageSize) ? options : [...options, pageSize]
  return [...sizes].sort((a, b) => a - b)
}

/**
 * Pagination (T0-23). The foot of a list: «Showing 1–10 of 123», rows per page, an optional page field, previous and
 * next. It generalises the foot the Orders pilot built, for any list of the dashboard.
 *
 * Pages count from 1. Give `total` (the foot knows the last page) or leave it out and give `hasMore` (the next button
 * is enabled while it is true; `itemCount` is how many items this page holds, so the range ends where they do). With no
 * results (`total` 0, or `itemCount` 0 on the first page) it paints nothing.
 *
 * No text of its own: `label` names the `nav` region, `previousLabel` and `nextLabel` name the two buttons,
 * `pageSizeLabel` the rows-per-page selector (needed when `pageSizeOptions` and `onPageSizeChange` are given),
 * `pageLabel` the page field (needed with `showPageInput`). `rangeLabel(from, to, total, figure)` returns the
 * translated «Showing 1–10 of 123» (`total` is null when it is not known); `figure(n)` wraps a number in the
 * `.odc-figure` node, for a label built from parts. A label that is one translated string stays one string and its
 * numbers are not set in mono. `pageOfLabel(totalPages, figure)` is the optional «of 13» that follows the page field.
 *
 * With a known `total`, the page shown (range, page status, buttons, page field) is clamped to the last page the total allows.
 * When the page the owner holds is past it (the total dropped), the foot paints the last page and calls `onPageChange(lastPage)`
 * once, so the owner can follow (redesign tramo B r3, W0-QB2-08).
 *
 * `onPageChange(page)`; `onPageSizeChange(size, page)` also gives the page that keeps the first item of the current
 * page in view. While `busy` the buttons stay enabled (so focus is never dropped) but do nothing, and the region is
 * `aria-busy`. A button that has just been used and reached its edge hands its focus to the page field, or to the
 * other button, instead of losing it to the body.
 */
export const Pagination = ({
  page,
  pageSize,
  total,
  hasMore = false,
  itemCount,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  showPageInput = false,
  busy = false,
  label,
  previousLabel,
  nextLabel,
  pageSizeLabel,
  pageLabel,
  rangeLabel,
  pageOfLabel,
  pageStatusLabel,
  dir,
  className,
  ...props
}) => {
  const [draft, setDraft] = useState(null)
  const navRef = useRef(null)
  const pressed = useRef(false)
  const sizeLabelId = useId()
  const sizeTriggerId = useId()

  // redesign tramo B r3 (W0-QB2-08): the last page the total allows (null while the total is not known). When the total drops
  // under the page shown (a filter, a socket update), the owner of the page is asked for the last valid one, once.
  const lastPage = total != null && Number.isFinite(Number(total)) && pageSize > 0 ? Math.max(1, Math.ceil(Number(total) / pageSize)) : null
  useEffect(() => {
    if (lastPage != null && page > lastPage) onPageChange?.(lastPage)
    // only when the page or the last page change: a new onPageChange identity every render must not ask again
  }, [page, lastPage])

  // The page field shows what the person types until Enter or leaving it; a new page puts the page back.
  useEffect(() => { setDraft(null) }, [page])

  // Reaching the first or the last page disables the button that was just pressed, and a disabled button drops the
  // focus to <body>. After a page change that came from this foot, lost focus goes to the page field or the other button.
  useLayoutEffect(() => {
    if (!pressed.current) return
    pressed.current = false
    const nav = navRef.current
    const active = document.activeElement
    const lost = !active || active === document.body || (nav?.contains(active) && active.disabled)
    if (nav && lost) (nav.querySelector('.odc-pagination-input') ?? nav.querySelector('.odc-pagination-step:not(:disabled)'))?.focus()
  }, [page])

  // redesign W0-7 (T0-23): missing, not empty
  if (label == null) throw new Error('Pagination needs a label')
  if (previousLabel == null) throw new Error('Pagination needs a previousLabel')
  if (nextLabel == null) throw new Error('Pagination needs a nextLabel')
  if (rangeLabel == null) throw new Error('Pagination needs a rangeLabel')
  if (pageStatusLabel == null) throw new Error('Pagination needs a pageStatusLabel')

  const knownTotal = total != null && Number.isFinite(Number(total))
  const count = knownTotal ? Number(total) : null
  const totalPages = knownTotal ? Math.max(1, Math.ceil(count / pageSize)) : null
  const noResults = knownTotal ? count <= 0 : itemCount === 0 && page <= 1
  const sizes = pageSizeOptions?.length && onPageSizeChange ? sizesWith(pageSizeOptions, pageSize) : null
  const pageInput = showPageInput && totalPages > 1
  if (sizes && pageSizeLabel == null) throw new Error('Pagination needs a pageSizeLabel')
  if (pageInput && pageLabel == null) throw new Error('Pagination needs a pageLabel')
  if (noResults) return null

  // redesign tramo B r3 (W0-QB2-08): what is painted and announced is the page the total allows, never «111–5 of 5» or «Page 12 of 1»
  const shown = knownTotal ? Math.min(page, totalPages) : page
  const from = (shown - 1) * pageSize + 1
  const to = knownTotal
    ? Math.min(shown * pageSize, count)
    : itemCount != null ? from + itemCount - 1 : shown * pageSize
  const atStart = shown <= 1
  const atEnd = knownTotal ? shown >= totalPages : !hasMore

  const goTo = next => {
    if (busy) return
    pressed.current = true
    onPageChange?.(next)
  }
  const commit = () => {
    const typed = parseInt(draft, 10)
    setDraft(null)
    if (Number.isFinite(typed)) {
      const next = Math.min(Math.max(typed, 1), totalPages)
      if (next !== shown) goTo(next)
    }
  }
  const changeSize = size => {
    if (busy || size === pageSize) return
    onPageSizeChange(size, Math.ceil(((shown - 1) * pageSize + 1) / size))
  }

  return (
    <nav
      ref={navRef}
      aria-label={label}
      aria-busy={busy || undefined}
      dir={dir}
      className={cx('odc-root', 'odc-pagination', className)}
      data-busy={busy ? 'true' : undefined}
      data-at-start={atStart ? '' : undefined}
      data-at-end={atEnd ? '' : undefined}
      {...props}
    >
      {/* redesign tramo B r2 (W0-QB1-07): the focus stays on «Next page», so the new page is announced by a live region */}
      <span className='odc-sr-only' role='status' aria-live='polite' aria-atomic='true'>
        {pageStatusLabel(shown, totalPages)}
      </span>
      <span className='odc-pagination-range' dir='auto'>
        {rangeLabel(from, to, knownTotal ? count : null, figure)}
      </span>
      <span className='odc-pagination-pager'>
        {sizes && (
          <>
            <span id={sizeLabelId} className='odc-pagination-size-label'>{pageSizeLabel}</span>
            <Menu
              label={String(pageSize)}
              side='top'
              dir={dir}
              triggerProps={{ id: sizeTriggerId, 'aria-labelledby': `${sizeLabelId} ${sizeTriggerId}` }}
              items={sizes.map(size => ({
                key: String(size),
                label: String(size),
                type: 'radio',
                checked: size === pageSize,
                onSelect: () => changeSize(size)
              }))}
            />
          </>
        )}
        {pageInput && (
          <span className='odc-pagination-jump'>
            <InputPrimitive
              className='odc-pagination-input odc-figure'
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              autoComplete='off'
              size={Math.max(String(totalPages).length, 2)}
              aria-label={pageLabel}
              value={draft ?? String(shown)}
              onFocus={event => event.target.select()}
              onValueChange={next => setDraft(next.replace(/\D/g, ''))}
              onBlur={() => { if (draft !== null) commit() }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commit()
                } else if (event.key === 'Escape' && draft !== null) {
                  event.preventDefault()
                  setDraft(null)
                }
              }}
            />
            {pageOfLabel && <span>{pageOfLabel(totalPages, figure)}</span>}
          </span>
        )}
        {/* redesign tramo B cierre (W0-QB4-05): one group that never splits, so on a phone «Previous page» and «Next page» wrap together */}
        <span className='odc-pagination-steps'>
          <IconButton
            icon={ChevronLeft}
            flipInRtl
            size='sm'
            className='odc-pagination-step'
            label={previousLabel}
            disabled={atStart}
            onClick={() => goTo(shown - 1)}
          />
          <IconButton
            icon={ChevronRight}
            flipInRtl
            size='sm'
            className='odc-pagination-step'
            label={nextLabel}
            disabled={atEnd}
            onClick={() => goTo(shown + 1)}
          />
        </span>
      </span>
    </nav>
  )
}
