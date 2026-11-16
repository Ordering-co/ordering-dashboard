import React, { useEffect, useRef, useState } from 'react'
import { AnalyticsStatusSubFilter as Controller, useLanguage } from '../../../../../index'
import { Button, IconButton, Skeleton } from '../../Shared/Product'
import { ChevronLeft, ChevronRight } from '../../Shared/Icon'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { useOverflowEdges } from '../../Shared/Product/useOverflowEdges'
import './report-filters.css'

// redesign bi FB1 (D5, BI-15, BI-17, auditor 4): the channels (apps) of a report page as a row of chips at one click. The
// controller of `main` (`AnalyticsStatusSubFilter`, GET /reports/app_ids) is used as it is; this is only its UIComponent.
// `filterList.app_id` is `'all'` or an id; `null` (what `main` left after pressing the active chip) reads as «All channels».

const SKELETONS = 5

// redesign the row scrolls sideways with no scrollbar (report-filters.css), so a wheel mouse could not reach the channels
// that do not fit (19 of them at 1440 px). The arrows scroll it by a screenful minus one chip, so the chip at the edge stays in view.
// The attribute names are the ones useOverflowEdges keeps on the scroller while there is more content past that edge.
const EDGE_ATTRIBUTES = ['data-overflow-start', 'data-overflow-end']
const readEdges = (node) => ({ start: node.hasAttribute('data-overflow-start'), end: node.hasAttribute('data-overflow-end') })
const sameEdges = (a, b) => a.start === b.start && a.end === b.end
const isRtl = (node) => getComputedStyle(node).direction === 'rtl' || Boolean(node.closest?.('[dir="rtl"]'))
const prefersReducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)')?.matches === true

const ChannelsUI = ({ appIdList, filterList, handleChangeFilterList }) => {
  const [, t] = useLanguage()
  const rowRef = useRef(null)
  useOverflowEdges(rowRef)
  // redesign which sides have more channels, read from the attributes useOverflowEdges already keeps (it measures on scroll
  // and on resize), so the arrows and the fade always agree
  const [edges, setEdges] = useState({ start: false, end: false })
  const wrapRef = useRef(null)
  const lastArrow = useRef(null)
  useEffect(() => {
    const node = rowRef.current
    if (!node) return undefined
    const read = () => setEdges(current => (sameEdges(current, readEdges(node)) ? current : readEdges(node)))
    read()
    if (typeof MutationObserver === 'undefined') return undefined
    const observer = new MutationObserver(read)
    observer.observe(node, { attributes: true, attributeFilter: EDGE_ATTRIBUTES })
    return () => observer.disconnect()
  }, [])
  // redesign bi R1 (M2, decision 12): `sm` is 28 px visible; on a phone the chips are `md` (32 visible, 44 of area), like the presets
  const isPhone = useIsPhone()
  const chipSize = isPhone ? 'md' : 'sm'
  const chipHeight = isPhone ? 'var(--od-x-control-height)' : 'var(--od-x-control-height-sm)'

  const loading = Boolean(appIdList?.loading)
  // The controller of `main` keeps `loading: true` for ever when the API answers with an error (it cannot be fixed here: the
  // controller is not touched), so the row shows its skeletons there. When the ids come empty it is just «All channels».
  const ids = Array.isArray(appIdList?.ids) ? appIdList.ids : []
  const active = filterList?.app_id == null ? 'all' : filterList.app_id

  // redesign bi FB1 (D5): the active channel goes back to «all» (main left `null`, with no chip on); «All channels» when it already
  // is asks for nothing, because every change of the filters is ten requests
  const choose = (id) => {
    const next = id === active ? 'all' : id
    if (next !== active) handleChangeFilterList?.({ ...filterList, app_id: next })
  }

  // redesign `direction` is +1 toward the end of the row, -1 toward its start. scrollBy is physical: in RTL the end is to the left.
  const scrollRow = (direction) => {
    const node = rowRef.current
    if (!node) return
    lastArrow.current = direction
    const chip = node.querySelector('.odc-btn')
    const amount = Math.max(node.clientWidth / 2, node.clientWidth - (chip?.offsetWidth ?? 0))
    node.scrollBy({ left: direction * amount * (isRtl(node) ? -1 : 1), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  // The arrow that was just used goes away at the edge, and a button that unmounts drops the focus on <body>: it passes to the other arrow,
  // or to the chip at that edge.
  useEffect(() => {
    const pressed = lastArrow.current
    if (pressed == null) return
    const gone = pressed > 0 ? !edges.end : !edges.start
    if (!gone) return
    lastArrow.current = null
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const wrap = wrapRef.current
    const chips = rowRef.current?.querySelectorAll('.odc-btn')
    ;(wrap?.querySelector('.odc-bi-channels-arrow') ?? (chips && chips[pressed > 0 ? chips.length - 1 : 0]))?.focus()
  }, [edges])

  const rtl = typeof document !== 'undefined' && rowRef.current ? isRtl(rowRef.current) : false
  const arrowLabels = {
    start: rtl ? t('SCROLL_RIGHT', 'Scroll right') : t('SCROLL_LEFT', 'Scroll left'),
    end: rtl ? t('SCROLL_LEFT', 'Scroll left') : t('SCROLL_RIGHT', 'Scroll right')
  }

  return (
    <div ref={wrapRef} className='odc-bi-channels-wrap'>
      {!loading && edges.start && (
        <IconButton
          icon={ChevronLeft}
          flipInRtl
          variant='secondary'
          size='sm'
          className='odc-bi-channels-arrow'
          data-edge='start'
          label={arrowLabels.start}
          onClick={() => scrollRow(-1)}
        />
      )}
    <div
      ref={rowRef}
      role='group'
      aria-label={t('CHANNEL', 'Channel')}
      aria-busy={loading || undefined}
      className='odc-bi-channels odc-fade-x'
    >
      {loading && [...Array(SKELETONS).keys()].map(index => (
        <Skeleton key={index} size='var(--od-space-8)' block={chipHeight} />
      ))}
      {!loading && (
        <Button
          variant='secondary'
          size={chipSize}
          className='odc-bi-chip'
          aria-pressed={active === 'all'}
          onClick={() => choose('all')}
        >
          {t('BUSINESS_REPORTS_ALL_CHANNELS', 'All channels')}
        </Button>
      )}
      {!loading && ids.map(id => (
        <Button
          key={id}
          variant='secondary'
          size={chipSize}
          className='odc-bi-chip'
          aria-pressed={active === id}
          onClick={() => choose(id)}
        >
          {/* a channel is a datum of the API: it shows as it comes, with no translation and no text-transform */}
          {String(id)}
        </Button>
      ))}
    </div>
      {!loading && edges.end && (
        <IconButton
          icon={ChevronRight}
          flipInRtl
          variant='secondary'
          size='sm'
          className='odc-bi-channels-arrow'
          data-edge='end'
          label={arrowLabels.end}
          onClick={() => scrollRow(1)}
        />
      )}
    </div>
  )
}

/**
 * Channel filter. Takes `filterList` and `handleChangeFilterList` (the controller of the page's) and hands them to the
 * `AnalyticsStatusSubFilter` controller of `main`, which brings `appIdList`.
 */
export const ReportChannels = (props) => <Controller {...props} UIComponent={ChannelsUI} />
